import { supabase } from './supabaseClient';
import type { JourneySpec } from '../shared/journeySpec';
import type { TravelDestinationPack } from '../shared/travelKnowledge';
import {
  JOURNEY_PERSONALIZATION_VERSION,
  applyJourneyPersonalizationProposal,
  buildJourneyPersonalizationContext,
  validateJourneyPersonalizationProposal,
  validateJourneyPersonalizationRequest,
  type JourneyPersonalizationApplyResult,
  type JourneyPersonalizationContextV1,
  type JourneyPersonalizationProposalV1,
  type JourneyPersonalizationRequestV1,
} from '../shared/journeyPersonalization';

export interface JourneyPersonalizationProviderMeta {
  requestId: string;
  durationMs: number;
  provider: string;
  model: string;
  providerModel?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
  };
}

export interface JourneyPersonalizationResult {
  request: JourneyPersonalizationRequestV1;
  proposal: JourneyPersonalizationProposalV1;
  applied: JourneyPersonalizationApplyResult;
  meta: JourneyPersonalizationProviderMeta;
}

export class JourneyPersonalizationError extends Error {
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.name = 'JourneyPersonalizationError';
    this.code = code;
    this.requestId = requestId;
  }
}

export interface RequestJourneyPersonalizationOptions {
  spec: JourneySpec;
  pack: TravelDestinationPack;
  retrieverVersion: string;
  locale: string;
  travelerRequest: string;
  signal?: AbortSignal;
  endpoint?: string;
  timeoutMs?: number;
}

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `journey-personalization-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseFailure = async (response: Response): Promise<JourneyPersonalizationError> => {
  try {
    const payload = await response.json() as {
      error?: unknown;
      code?: unknown;
      meta?: { requestId?: unknown };
    };
    return new JourneyPersonalizationError(
      typeof payload.error === 'string' ? payload.error : 'Journey personalization failed.',
      typeof payload.code === 'string' ? payload.code : `HTTP_${response.status}`,
      typeof payload.meta?.requestId === 'string' ? payload.meta.requestId : undefined,
    );
  } catch {
    return new JourneyPersonalizationError('Journey personalization failed.', `HTTP_${response.status}`);
  }
};

const readAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

export const requestJourneyPersonalization = async (
  options: RequestJourneyPersonalizationOptions,
): Promise<JourneyPersonalizationResult> => {
  const context = buildJourneyPersonalizationContext(
    options.spec,
    options.pack,
    options.retrieverVersion,
  );
  const request: JourneyPersonalizationRequestV1 = {
    version: JOURNEY_PERSONALIZATION_VERSION,
    locale: options.locale,
    travelerRequest: options.travelerRequest.trim(),
    journeySpec: options.spec,
    context,
  };
  const requestValidation = validateJourneyPersonalizationRequest(request);
  if (!requestValidation.valid) {
    throw new JourneyPersonalizationError(
      requestValidation.errors.join(' '),
      'PERSONALIZATION_REQUEST_INVALID',
    );
  }

  const requestId = createRequestId();
  const controller = new AbortController();
  const timeoutMs = Math.max(5_000, Math.min(60_000, options.timeoutMs ?? 30_000));
  const timeoutId = globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abortFromCaller = () => controller.abort(options.signal?.reason ?? 'cancelled');
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const accessToken = await readAccessToken();
    const response = await fetch(options.endpoint ?? '/api/ai/personalize-journey', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ requestId, ...request }),
      signal: controller.signal,
    });
    if (!response.ok) throw await parseFailure(response);

    const payload = await response.json() as {
      data?: unknown;
      meta?: Partial<JourneyPersonalizationProviderMeta>;
    };
    const validation = validateJourneyPersonalizationProposal(payload.data, context);
    if (!validation.valid) {
      throw new JourneyPersonalizationError(
        validation.errors.join(' '),
        'PERSONALIZATION_RESPONSE_INVALID',
        typeof payload.meta?.requestId === 'string' ? payload.meta.requestId : requestId,
      );
    }
    const proposal = payload.data as JourneyPersonalizationProposalV1;
    const applied = applyJourneyPersonalizationProposal(options.spec, options.pack, context, proposal);
    const meta: JourneyPersonalizationProviderMeta = {
      requestId: typeof payload.meta?.requestId === 'string' ? payload.meta.requestId : requestId,
      durationMs: Number.isFinite(payload.meta?.durationMs) ? Number(payload.meta?.durationMs) : 0,
      provider: typeof payload.meta?.provider === 'string' ? payload.meta.provider : 'unknown',
      model: typeof payload.meta?.model === 'string' ? payload.meta.model : 'unknown',
      providerModel: typeof payload.meta?.providerModel === 'string' ? payload.meta.providerModel : undefined,
      usage: payload.meta?.usage,
    };
    return { request, proposal, applied, meta };
  } catch (error) {
    if (error instanceof JourneyPersonalizationError) throw error;
    if (controller.signal.aborted) {
      throw new JourneyPersonalizationError(
        controller.signal.reason === 'timeout'
          ? 'Journey personalization timed out.'
          : 'Journey personalization was cancelled.',
        controller.signal.reason === 'timeout' ? 'PERSONALIZATION_TIMEOUT' : 'PERSONALIZATION_CANCELLED',
        requestId,
      );
    }
    throw new JourneyPersonalizationError(
      error instanceof Error ? error.message : 'Journey personalization failed.',
      'PERSONALIZATION_NETWORK_ERROR',
      requestId,
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
};

export const countJourneyPersonalizationOperations = (
  result: Pick<JourneyPersonalizationResult, 'applied'>,
): number => result.applied.changes.length;

export const getJourneyPersonalizationContext = (
  result: Pick<JourneyPersonalizationResult, 'request'>,
): JourneyPersonalizationContextV1 => result.request.context;
