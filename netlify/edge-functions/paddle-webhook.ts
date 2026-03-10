import {
  PADDLE_SIGNATURE_HEADER,
  verifyPaddleSignature,
} from '../edge-lib/paddle-billing.ts';
import {
  getSupabaseServiceConfig,
  processPaddleBillingEvent,
  __paddleWebhookSyncInternals,
} from '../edge-lib/paddle-webhook-sync.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

interface PaddleWebhookEnvelope {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: unknown;
}

type WebhookSyncMode = 'full' | 'verify_only';

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || '';
  } catch {
    return '';
  }
};

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const toIsoDate = (value: unknown): string | null => {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
};

const normalizeEventType = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return normalized.toLowerCase();
};

const resolveEventTimestamp = (occurredAtIso: string | null, nowIso: string): string => {
  if (occurredAtIso && Number.isFinite(Date.parse(occurredAtIso))) {
    return new Date(Date.parse(occurredAtIso)).toISOString();
  }
  return nowIso;
};

const getWebhookSignatureSecret = (): string => readEnv('PADDLE_WEBHOOK_SECRET').trim();

const getWebhookSignatureMaxAgeSeconds = (): number => {
  const raw = Number.parseInt(readEnv('PADDLE_WEBHOOK_MAX_AGE_SECONDS').trim(), 10);
  if (!Number.isFinite(raw)) return 5 * 60;
  return Math.max(30, Math.min(raw, 30 * 60));
};

const getWebhookSyncMode = (): WebhookSyncMode => {
  const normalized = readEnv('PADDLE_WEBHOOK_SYNC_MODE').trim().toLowerCase();
  if (normalized === 'verify_only') return 'verify_only';
  return 'full';
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const webhookSecret = getWebhookSignatureSecret();
  if (!webhookSecret) {
    return json(500, { ok: false, error: 'Paddle webhook secret is not configured.' });
  }
  const syncMode = getWebhookSyncMode();

  const rawBody = await request.text();
  const nowMs = Date.now();
  const signatureResult = await verifyPaddleSignature({
    secret: webhookSecret,
    headerValue: request.headers.get(PADDLE_SIGNATURE_HEADER),
    rawBody,
    nowMs,
    maxAgeSeconds: getWebhookSignatureMaxAgeSeconds(),
  });

  if (!signatureResult.ok) {
    return json(401, {
      ok: false,
      error: `Invalid Paddle webhook signature (${signatureResult.reason || 'unknown'}).`,
    });
  }

  let parsedEnvelope: PaddleWebhookEnvelope;
  try {
    parsedEnvelope = JSON.parse(rawBody) as PaddleWebhookEnvelope;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON payload.' });
  }

  const eventId = asTrimmedString(parsedEnvelope?.event_id);
  const eventType = normalizeEventType(parsedEnvelope?.event_type);
  const nowIso = new Date(nowMs).toISOString();
  const occurredAtIso = resolveEventTimestamp(toIsoDate(parsedEnvelope?.occurred_at), nowIso);

  if (!eventId || !eventType) {
    return json(400, { ok: false, error: 'Webhook payload missing event_id or event_type.' });
  }

  if (syncMode === 'verify_only') {
    return json(200, {
      ok: true,
      status: 'ignored',
      reason: 'Webhook verified in verify_only mode; database sync skipped.',
      eventId,
      eventType,
      occurredAtIso,
      syncMode,
    });
  }

  const supabaseConfig = getSupabaseServiceConfig();
  if (!supabaseConfig) {
    return json(500, { ok: false, error: 'Supabase service role configuration missing.' });
  }

  try {
    const processResult = await processPaddleBillingEvent(supabaseConfig, {
      eventId,
      eventType,
      occurredAtIso,
      eventData: parsedEnvelope?.data,
      rawEventPayload: parsedEnvelope,
      nowMs,
    });

    return json(200, {
      ok: true,
      duplicate: processResult.duplicate,
      status: processResult.status,
      reason: processResult.reason,
      userId: processResult.userId,
      syncMode,
    });
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : 'Unhandled Paddle webhook processing error.';

    return json(500, {
      ok: false,
      error: message,
    });
  }
};

export const __paddleWebhookInternals = {
  coalesceDate: __paddleWebhookSyncInternals.coalesceDate,
  getWebhookSyncMode,
  resolveEventTimestamp,
  shouldIgnoreAsStale: __paddleWebhookSyncInternals.shouldIgnoreAsStale,
};
