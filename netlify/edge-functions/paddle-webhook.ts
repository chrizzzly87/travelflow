import type { PlanTierKey } from '../../types';
import {
  PADDLE_PROVIDER,
  PADDLE_SIGNATURE_HEADER,
  extractPaddleUserIdFromCustomData,
  extractSubscriptionSnapshot,
  extractTransactionSnapshot,
  normalizePaddleStatus,
  readPaddlePriceMapFromEnv,
  resolveTierFromPriceId,
  shouldGrantPaidTier,
  verifyPaddleSignature,
} from '../edge-lib/paddle-billing.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const SUBSCRIPTION_SELECT = [
  'user_id',
  'status',
  'provider',
  'provider_customer_id',
  'provider_subscription_id',
  'provider_price_id',
  'provider_product_id',
  'provider_status',
  'current_period_start',
  'current_period_end',
  'cancel_at',
  'canceled_at',
  'grace_ends_at',
  'currency',
  'amount',
  'last_event_id',
  'last_event_type',
  'last_event_at',
].join(',');

type ProcessStatus = 'processed' | 'ignored';

interface PaddleWebhookEnvelope {
  event_id?: string;
  event_type?: string;
  occurred_at?: string;
  data?: unknown;
}

interface SubscriptionRow {
  user_id: string;
  status: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_price_id: string | null;
  provider_product_id: string | null;
  provider_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  grace_ends_at: string | null;
  currency: string | null;
  amount: number | null;
  last_event_id: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
}

interface WebhookProcessResult {
  status: ProcessStatus;
  reason: string;
  userId: string | null;
}

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

const safeJsonParse = async (source: { text: () => Promise<string> }): Promise<any> => {
  const text = await source.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

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

const getSupabaseServiceConfig = () => {
  const url = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY').trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
};

const buildServiceHeaders = (
  serviceRoleKey: string,
  extra?: Record<string, string>,
) => ({
  'Content-Type': 'application/json',
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  ...extra,
});

const supabaseServiceFetch = async (
  config: { url: string; serviceRoleKey: string },
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildServiceHeaders(config.serviceRoleKey),
      ...(init.headers || {}),
    },
  });
};

const extractServiceError = (payload: any, fallback: string): string => {
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (payload.error && typeof payload.error === 'object') {
      if (typeof payload.error.detail === 'string' && payload.error.detail.trim()) return payload.error.detail.trim();
      if (typeof payload.error.message === 'string' && payload.error.message.trim()) return payload.error.message.trim();
    }
  }
  return fallback;
};

const readSingleSubscription = async (
  config: { url: string; serviceRoleKey: string },
  path: string,
): Promise<SubscriptionRow | null> => {
  const response = await supabaseServiceFetch(config, path, {
    method: 'GET',
  });
  if (!response.ok) {
    return null;
  }
  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? payload[0] : payload;
  return row ? (row as SubscriptionRow) : null;
};

const findSubscriptionByProviderId = async (
  config: { url: string; serviceRoleKey: string },
  providerSubscriptionId: string,
): Promise<SubscriptionRow | null> => {
  const encoded = encodeURIComponent(providerSubscriptionId);
  return readSingleSubscription(
    config,
    `/rest/v1/subscriptions?provider_subscription_id=eq.${encoded}&select=${SUBSCRIPTION_SELECT}&limit=1`,
  );
};

const findSubscriptionByCustomerId = async (
  config: { url: string; serviceRoleKey: string },
  providerCustomerId: string,
): Promise<SubscriptionRow | null> => {
  const encoded = encodeURIComponent(providerCustomerId);
  return readSingleSubscription(
    config,
    `/rest/v1/subscriptions?provider_customer_id=eq.${encoded}&select=${SUBSCRIPTION_SELECT}&limit=1`,
  );
};

const findSubscriptionByUserId = async (
  config: { url: string; serviceRoleKey: string },
  userId: string,
): Promise<SubscriptionRow | null> => {
  const encoded = encodeURIComponent(userId);
  return readSingleSubscription(
    config,
    `/rest/v1/subscriptions?user_id=eq.${encoded}&select=${SUBSCRIPTION_SELECT}&limit=1`,
  );
};

const upsertSubscription = async (
  config: { url: string; serviceRoleKey: string },
  row: Record<string, unknown>,
): Promise<void> => {
  const response = await supabaseServiceFetch(
    config,
    '/rest/v1/subscriptions?on_conflict=user_id',
    {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    },
  );

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, 'Could not upsert subscription state.'));
  }
};

const updateProfileTier = async (
  config: { url: string; serviceRoleKey: string },
  userId: string,
  tierKey: PlanTierKey,
): Promise<void> => {
  const encoded = encodeURIComponent(userId);
  const response = await supabaseServiceFetch(
    config,
    `/rest/v1/profiles?id=eq.${encoded}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ tier_key: tierKey }),
    },
  );

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, 'Could not sync profile tier.'));
  }
};

const insertWebhookEvent = async (
  config: { url: string; serviceRoleKey: string },
  payload: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    rawEventPayload: unknown;
  },
): Promise<{ duplicate: boolean }> => {
  const response = await supabaseServiceFetch(config, '/rest/v1/billing_webhook_events', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      event_id: payload.eventId,
      provider: PADDLE_PROVIDER,
      event_type: payload.eventType,
      occurred_at: payload.occurredAtIso,
      status: 'received',
      payload: payload.rawEventPayload,
    }),
  });

  if (response.ok) {
    return { duplicate: false };
  }

  const body = await response.text().catch(() => '');
  if (response.status === 409 || /duplicate key/i.test(body)) {
    return { duplicate: true };
  }

  let parsedPayload: any = null;
  try {
    parsedPayload = body ? JSON.parse(body) : null;
  } catch {
    parsedPayload = null;
  }
  throw new Error(extractServiceError(parsedPayload, 'Could not persist webhook event log.'));
};

const finalizeWebhookEvent = async (
  config: { url: string; serviceRoleKey: string },
  payload: {
    eventId: string;
    status: 'processed' | 'ignored' | 'failed';
    userId?: string | null;
    reason?: string | null;
  },
): Promise<void> => {
  const encoded = encodeURIComponent(payload.eventId);
  const response = await supabaseServiceFetch(
    config,
    `/rest/v1/billing_webhook_events?event_id=eq.${encoded}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        status: payload.status,
        processed_at: new Date().toISOString(),
        user_id: payload.userId ?? null,
        error_message: payload.reason ?? null,
      }),
    },
  );

  if (!response.ok) {
    const parsed = await safeJsonParse(response);
    throw new Error(extractServiceError(parsed, 'Could not update webhook event log.'));
  }
};

const coalesceDate = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (value && Number.isFinite(Date.parse(value))) {
      return new Date(Date.parse(value)).toISOString();
    }
  }
  return null;
};

const resolveEventTimestamp = (occurredAtIso: string | null, nowIso: string): string => {
  if (occurredAtIso && Number.isFinite(Date.parse(occurredAtIso))) {
    return new Date(Date.parse(occurredAtIso)).toISOString();
  }
  return nowIso;
};

const shouldIgnoreAsStale = (
  existingLastEventAt: string | null,
  incomingEventAt: string,
): boolean => {
  if (!existingLastEventAt) return false;
  const existingMs = Date.parse(existingLastEventAt);
  const incomingMs = Date.parse(incomingEventAt);
  if (!Number.isFinite(existingMs) || !Number.isFinite(incomingMs)) return false;
  return incomingMs < existingMs;
};

const resolveFallbackUserId = (
  existingByProvider: SubscriptionRow | null,
  existingByCustomer: SubscriptionRow | null,
  existingByUser: SubscriptionRow | null,
): string | null => (
  existingByProvider?.user_id
  || existingByCustomer?.user_id
  || existingByUser?.user_id
  || null
);

const processSubscriptionEvent = async (
  config: { url: string; serviceRoleKey: string },
  event: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    eventData: unknown;
    nowMs: number;
  },
): Promise<WebhookProcessResult> => {
  const priceMap = readPaddlePriceMapFromEnv(readEnv);
  const snapshot = extractSubscriptionSnapshot(event.eventType, event.eventData, event.occurredAtIso);

  if (!snapshot.providerSubscriptionId) {
    return {
      status: 'ignored',
      reason: 'Missing provider subscription id in event payload.',
      userId: null,
    };
  }

  const existingByProvider = await findSubscriptionByProviderId(config, snapshot.providerSubscriptionId);
  const existingByCustomer = snapshot.providerCustomerId
    ? await findSubscriptionByCustomerId(config, snapshot.providerCustomerId)
    : null;

  const explicitUserId = extractPaddleUserIdFromCustomData(snapshot.customData);
  const existingByUser = explicitUserId
    ? await findSubscriptionByUserId(config, explicitUserId)
    : null;

  const userId = explicitUserId || resolveFallbackUserId(existingByProvider, existingByCustomer, existingByUser);
  if (!userId) {
    return {
      status: 'ignored',
      reason: 'Could not resolve user from custom_data or existing subscription mapping.',
      userId: null,
    };
  }

  const existing = existingByProvider || existingByUser || existingByCustomer;
  if (existing && shouldIgnoreAsStale(existing.last_event_at, event.occurredAtIso)) {
    return {
      status: 'ignored',
      reason: 'Skipped stale webhook event (older than last applied event).',
      userId,
    };
  }

  const effectivePriceId = snapshot.providerPriceId || existing?.provider_price_id || null;
  const mappedTier = resolveTierFromPriceId(effectivePriceId, priceMap);
  const effectiveGraceEndsAt = coalesceDate(snapshot.graceEndsAt, existing?.grace_ends_at);
  const grantPaidTier = shouldGrantPaidTier(snapshot.providerStatus, effectiveGraceEndsAt, event.nowMs);

  let targetTier: PlanTierKey | null = null;
  if (grantPaidTier) {
    if (!mappedTier) {
      return {
        status: 'ignored',
        reason: 'Paid status received but Paddle price ID is not mapped to an internal tier.',
        userId,
      };
    }
    targetTier = mappedTier;
  } else {
    targetTier = 'tier_free';
  }

  const upsertPayload: Record<string, unknown> = {
    user_id: userId,
    status: snapshot.providerStatus,
    provider: PADDLE_PROVIDER,
    provider_customer_id: snapshot.providerCustomerId || existing?.provider_customer_id || null,
    provider_subscription_id: snapshot.providerSubscriptionId,
    provider_price_id: effectivePriceId,
    provider_product_id: snapshot.providerProductId || existing?.provider_product_id || null,
    provider_status: snapshot.providerStatus,
    current_period_start: coalesceDate(snapshot.currentPeriodStart, existing?.current_period_start),
    current_period_end: coalesceDate(snapshot.currentPeriodEnd, existing?.current_period_end),
    cancel_at: coalesceDate(snapshot.cancelAt),
    canceled_at: coalesceDate(snapshot.canceledAt),
    grace_ends_at: effectiveGraceEndsAt,
    currency: existing?.currency || null,
    amount: existing?.amount ?? null,
    last_event_id: event.eventId,
    last_event_type: event.eventType,
    last_event_at: event.occurredAtIso,
  };

  await upsertSubscription(config, upsertPayload);
  await updateProfileTier(config, userId, targetTier);

  return {
    status: 'processed',
    reason: `Applied subscription lifecycle update (${snapshot.providerStatus})`,
    userId,
  };
};

const processTransactionCompletedEvent = async (
  config: { url: string; serviceRoleKey: string },
  event: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    eventData: unknown;
  },
): Promise<WebhookProcessResult> => {
  const snapshot = extractTransactionSnapshot(event.eventData);

  const existingByProvider = snapshot.providerSubscriptionId
    ? await findSubscriptionByProviderId(config, snapshot.providerSubscriptionId)
    : null;
  const existingByCustomer = snapshot.providerCustomerId
    ? await findSubscriptionByCustomerId(config, snapshot.providerCustomerId)
    : null;

  const explicitUserId = extractPaddleUserIdFromCustomData(snapshot.customData);
  const existingByUser = explicitUserId
    ? await findSubscriptionByUserId(config, explicitUserId)
    : null;

  const userId = explicitUserId || resolveFallbackUserId(existingByProvider, existingByCustomer, existingByUser);
  if (!userId) {
    return {
      status: 'ignored',
      reason: 'Transaction event could not be linked to a user.',
      userId: null,
    };
  }

  const existing = existingByProvider || existingByUser || existingByCustomer;
  if (!existing) {
    return {
      status: 'ignored',
      reason: 'Transaction event arrived before subscription mapping exists.',
      userId,
    };
  }

  if (shouldIgnoreAsStale(existing.last_event_at, event.occurredAtIso)) {
    return {
      status: 'ignored',
      reason: 'Skipped stale transaction webhook event.',
      userId,
    };
  }

  await upsertSubscription(config, {
    user_id: userId,
    status: existing.status || 'active',
    provider: PADDLE_PROVIDER,
    provider_customer_id: snapshot.providerCustomerId || existing.provider_customer_id,
    provider_subscription_id: snapshot.providerSubscriptionId || existing.provider_subscription_id,
    provider_price_id: existing.provider_price_id,
    provider_product_id: existing.provider_product_id,
    provider_status: normalizePaddleStatus(existing.provider_status),
    current_period_start: existing.current_period_start,
    current_period_end: existing.current_period_end,
    cancel_at: existing.cancel_at,
    canceled_at: existing.canceled_at,
    grace_ends_at: existing.grace_ends_at,
    currency: snapshot.currency || existing.currency,
    amount: snapshot.amount ?? existing.amount,
    last_event_id: event.eventId,
    last_event_type: event.eventType,
    last_event_at: event.occurredAtIso,
  });

  return {
    status: 'processed',
    reason: 'Recorded transaction totals for subscription.',
    userId,
  };
};

const processWebhookEvent = async (
  config: { url: string; serviceRoleKey: string },
  event: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    eventData: unknown;
    nowMs: number;
  },
): Promise<WebhookProcessResult> => {
  if (event.eventType.startsWith('subscription.')) {
    return processSubscriptionEvent(config, event);
  }

  if (event.eventType === 'transaction.completed') {
    return processTransactionCompletedEvent(config, event);
  }

  return {
    status: 'ignored',
    reason: `Event type ${event.eventType} is not handled.`,
    userId: null,
  };
};

const getWebhookSignatureSecret = (): string => readEnv('PADDLE_WEBHOOK_SECRET').trim();

const getWebhookSignatureMaxAgeSeconds = (): number => {
  const raw = Number.parseInt(readEnv('PADDLE_WEBHOOK_MAX_AGE_SECONDS').trim(), 10);
  if (!Number.isFinite(raw)) return 5 * 60;
  return Math.max(30, Math.min(raw, 30 * 60));
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const webhookSecret = getWebhookSignatureSecret();
  if (!webhookSecret) {
    return json(500, { ok: false, error: 'Paddle webhook secret is not configured.' });
  }

  const supabaseConfig = getSupabaseServiceConfig();
  if (!supabaseConfig) {
    return json(500, { ok: false, error: 'Supabase service role configuration missing.' });
  }

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

  try {
    const inserted = await insertWebhookEvent(supabaseConfig, {
      eventId,
      eventType,
      occurredAtIso,
      rawEventPayload: parsedEnvelope,
    });

    if (inserted.duplicate) {
      return json(200, {
        ok: true,
        duplicate: true,
      });
    }

    const processResult = await processWebhookEvent(supabaseConfig, {
      eventId,
      eventType,
      occurredAtIso,
      eventData: parsedEnvelope?.data,
      nowMs,
    });

    await finalizeWebhookEvent(supabaseConfig, {
      eventId,
      status: processResult.status,
      userId: processResult.userId,
      reason: processResult.reason,
    });

    return json(200, {
      ok: true,
      status: processResult.status,
      reason: processResult.reason,
      userId: processResult.userId,
    });
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : 'Unhandled Paddle webhook processing error.';

    try {
      await finalizeWebhookEvent(supabaseConfig, {
        eventId,
        status: 'failed',
        reason: message,
      });
    } catch {
      // best effort: preserve original failure status
    }

    return json(500, {
      ok: false,
      error: message,
    });
  }
};

export const __paddleWebhookInternals = {
  coalesceDate,
  resolveEventTimestamp,
  shouldIgnoreAsStale,
};
