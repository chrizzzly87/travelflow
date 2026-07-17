import {
  generateProviderItinerary,
  readEnv,
  resolveTimeoutMs,
} from '../edge-lib/ai-provider-runtime.ts';
import {
  createTokenBucketRateLimiter,
  getBearerToken,
  resolveClientIp,
  verifySupabaseUser,
} from '../edge-lib/ai-generate-guard.ts';
import { persistAiGenerationTelemetry } from '../edge-lib/ai-generation-telemetry.ts';
import {
  JOURNEY_PERSONALIZATION_OUTPUT_SCHEMA,
  buildJourneyPersonalizationPrompt,
  validateJourneyPersonalizationProposal,
  validateJourneyPersonalizationRequest,
  type JourneyPersonalizationRequestV1,
} from '../../shared/journeyPersonalization.ts';

interface PersonalizationRequestBody extends JourneyPersonalizationRequestV1 {
  requestId?: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const MAX_BODY_BYTES = 96_000;
const MAX_PROMPT_CHARS = 40_000;
const PROVIDER_TIMEOUT_MS = resolveTimeoutMs(
  'AI_JOURNEY_PERSONALIZATION_TIMEOUT_MS',
  25_000,
  8_000,
  60_000,
);
const verifiedUserLimiter = createTokenBucketRateLimiter({ capacity: 8, refillPerMinute: 4 });
const anonymousIpLimiter = createTokenBucketRateLimiter({ capacity: 3, refillPerMinute: 2 });

const json = (status: number, payload: unknown, extraHeaders?: Record<string, string>): Response => (
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
);

const configuredTarget = (): { provider: string; model: string } => ({
  provider: readEnv('AI_JOURNEY_PERSONALIZATION_PROVIDER').trim().toLowerCase() || 'gemini',
  model: readEnv('AI_JOURNEY_PERSONALIZATION_MODEL').trim() || 'gemini-3.1-flash-lite',
});

export default async (request: Request, context?: { ip?: string }) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.', code: 'METHOD_NOT_ALLOWED' });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { error: 'Personalization request is too large.', code: 'REQUEST_TOO_LARGE' });
  }

  let body: PersonalizationRequestBody;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body.', code: 'INVALID_JSON' });
  }
  const validation = validateJourneyPersonalizationRequest(body);
  if (!validation.valid) {
    return json(400, {
      error: 'Journey personalization request is invalid.',
      code: 'PERSONALIZATION_REQUEST_INVALID',
      details: validation.errors.join(' '),
    });
  }

  const authToken = getBearerToken(request);
  let verifiedUserId: string | null = null;
  let verifiedAnonymousSession = false;
  if (authToken) {
    const verification = await verifySupabaseUser(authToken);
    if (verification.ok) {
      verifiedUserId = verification.userId;
      verifiedAnonymousSession = verification.isAnonymous;
    } else if (verification.reason === 'invalid') {
      return json(401, {
        error: 'Invalid or expired Supabase access token.',
        code: 'AUTH_TOKEN_INVALID',
      });
    }
  }

  const clientIp = resolveClientIp(request, context);
  const rateDecision = verifiedUserId
    ? verifiedUserLimiter.take(`user:${verifiedUserId}`)
    : anonymousIpLimiter.take(`ip:${clientIp}`);
  if (!rateDecision.allowed) {
    return json(429, {
      error: 'Too many personalization requests. Please retry shortly.',
      code: 'RATE_LIMITED',
      retryAfterSeconds: rateDecision.retryAfterSeconds,
    }, { 'Retry-After': String(rateDecision.retryAfterSeconds) });
  }

  const requestId = typeof body.requestId === 'string' && body.requestId.trim()
    ? body.requestId.trim()
    : crypto.randomUUID();
  const target = configuredTarget();
  const prompt = buildJourneyPersonalizationPrompt(body);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json(413, {
      error: 'Personalization context is too large.',
      code: 'PERSONALIZATION_CONTEXT_TOO_LARGE',
    });
  }

  const startedAt = Date.now();
  try {
    const result = await generateProviderItinerary({
      prompt,
      provider: target.provider,
      model: target.model,
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxOutputTokens: 2_048,
      jsonSchema: JOURNEY_PERSONALIZATION_OUTPUT_SCHEMA,
    });
    const durationMs = Date.now() - startedAt;
    if (!result.ok) {
      await persistAiGenerationTelemetry({
        source: 'create_trip',
        requestId,
        provider: target.provider,
        model: target.model,
        providerModel: result.value.providerModel,
        status: 'failed',
        latencyMs: durationMs,
        httpStatus: result.status,
        errorCode: result.value.code,
        errorMessage: result.value.error,
        metadata: {
          endpoint: '/api/ai/personalize-journey',
          flow: 'journey_personalization',
          user_id: verifiedUserId,
          dataset_version: body.context.datasetVersion,
          template_key: body.context.templateKey,
          context_entity_count: body.context.entities.length,
        },
      });
      return json(result.status, {
        ...result.value,
        meta: {
          requestId,
          durationMs,
          provider: target.provider,
          model: target.model,
          providerModel: result.value.providerModel || null,
        },
      });
    }

    const proposalValidation = validateJourneyPersonalizationProposal(
      result.value.data,
      body.context,
    );
    if (!proposalValidation.valid) {
      await persistAiGenerationTelemetry({
        source: 'create_trip',
        requestId,
        provider: result.value.meta.provider,
        model: result.value.meta.model,
        providerModel: result.value.meta.providerModel,
        status: 'failed',
        latencyMs: durationMs,
        httpStatus: 422,
        errorCode: 'PERSONALIZATION_RESPONSE_INVALID',
        errorMessage: proposalValidation.errors.join(' '),
        metadata: {
          endpoint: '/api/ai/personalize-journey',
          flow: 'journey_personalization',
          dataset_version: body.context.datasetVersion,
          template_key: body.context.templateKey,
        },
      });
      return json(422, {
        error: 'The personalization response did not pass catalogue validation.',
        code: 'PERSONALIZATION_RESPONSE_INVALID',
        details: proposalValidation.errors.join(' '),
        meta: { requestId, durationMs },
      });
    }

    await persistAiGenerationTelemetry({
      source: 'create_trip',
      requestId,
      provider: result.value.meta.provider,
      model: result.value.meta.model,
      providerModel: result.value.meta.providerModel,
      status: 'success',
      latencyMs: durationMs,
      httpStatus: 200,
      estimatedCostUsd: result.value.meta.usage?.estimatedCostUsd,
      promptTokens: result.value.meta.usage?.promptTokens,
      completionTokens: result.value.meta.usage?.completionTokens,
      totalTokens: result.value.meta.usage?.totalTokens,
      metadata: {
        endpoint: '/api/ai/personalize-journey',
        flow: 'journey_personalization',
        user_id: verifiedUserId,
        auth: verifiedUserId
          ? (verifiedAnonymousSession ? 'supabase_anonymous' : 'supabase_user')
          : 'unverified',
        dataset_version: body.context.datasetVersion,
        template_key: body.context.templateKey,
        context_entity_count: body.context.entities.length,
      },
    });

    return json(200, {
      data: result.value.data,
      meta: {
        ...result.value.meta,
        requestId,
        durationMs,
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await persistAiGenerationTelemetry({
      source: 'create_trip',
      requestId,
      provider: target.provider,
      model: target.model,
      status: 'failed',
      latencyMs: durationMs,
      httpStatus: 500,
      errorCode: 'PERSONALIZATION_UNEXPECTED_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        endpoint: '/api/ai/personalize-journey',
        flow: 'journey_personalization',
        dataset_version: body.context.datasetVersion,
        template_key: body.context.templateKey,
      },
    });
    return json(500, {
      error: 'Unexpected server error during journey personalization.',
      code: 'PERSONALIZATION_UNEXPECTED_ERROR',
      meta: { requestId, durationMs },
    });
  }
};
