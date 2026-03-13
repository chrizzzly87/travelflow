import type { PlanTierKey } from '../../types';
import {
  PADDLE_PROVIDER,
  extractPaddleUserIdFromCustomData,
  extractSubscriptionSnapshot,
  extractTransactionSnapshot,
  normalizePaddleStatus,
  readPaddlePriceMapFromEnv,
  resolveTierFromPriceId,
  shouldGrantPaidTier,
} from './paddle-billing.ts';

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

export type PaddleBillingProcessStatus = 'processed' | 'ignored';

export interface PaddleBillingProcessResult {
  status: PaddleBillingProcessStatus;
  reason: string;
  userId: string | null;
}

export interface PaddleBillingEventEnvelope {
  eventId: string;
  eventType: string;
  occurredAtIso: string;
  eventData: unknown;
  rawEventPayload: unknown;
  nowMs?: number;
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

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || '';
  } catch {
    return '';
  }
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

export const safeJsonParse = async (source: { text: () => Promise<string> }): Promise<any> => {
  const text = await source.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const extractServiceError = (payload: any, fallback: string): string => {
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

const supabaseServiceFetch = async (
  config: SupabaseServiceConfig,
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

export const getSupabaseServiceConfig = (): SupabaseServiceConfig | null => {
  const url = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = readEnv('SUPABASE_SERVICE_ROLE_KEY').trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
};

const readSingleSubscription = async (
  config: SupabaseServiceConfig,
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
  config: SupabaseServiceConfig,
  providerSubscriptionId: string,
): Promise<SubscriptionRow | null> => {
  const encoded = encodeURIComponent(providerSubscriptionId);
  return readSingleSubscription(
    config,
    `/rest/v1/subscriptions?provider_subscription_id=eq.${encoded}&select=${SUBSCRIPTION_SELECT}&limit=1`,
  );
};

const findSubscriptionByCustomerId = async (
  config: SupabaseServiceConfig,
  providerCustomerId: string,
): Promise<SubscriptionRow | null> => {
  const encoded = encodeURIComponent(providerCustomerId);
  return readSingleSubscription(
    config,
    `/rest/v1/subscriptions?provider_customer_id=eq.${encoded}&select=${SUBSCRIPTION_SELECT}&limit=1`,
  );
};

const findSubscriptionByUserId = async (
  config: SupabaseServiceConfig,
  userId: string,
): Promise<SubscriptionRow | null> => {
  const encoded = encodeURIComponent(userId);
  return readSingleSubscription(
    config,
    `/rest/v1/subscriptions?user_id=eq.${encoded}&select=${SUBSCRIPTION_SELECT}&limit=1`,
  );
};

const upsertSubscription = async (
  config: SupabaseServiceConfig,
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
  config: SupabaseServiceConfig,
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
  config: SupabaseServiceConfig,
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
  config: SupabaseServiceConfig,
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
  config: SupabaseServiceConfig,
  event: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    eventData: unknown;
    nowMs: number;
  },
): Promise<PaddleBillingProcessResult> => {
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
    currency: snapshot.currency || existing?.currency || null,
    amount: snapshot.amount ?? existing?.amount ?? null,
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
  config: SupabaseServiceConfig,
  event: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    eventData: unknown;
  },
): Promise<PaddleBillingProcessResult> => {
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
  config: SupabaseServiceConfig,
  event: {
    eventId: string;
    eventType: string;
    occurredAtIso: string;
    eventData: unknown;
    nowMs: number;
  },
): Promise<PaddleBillingProcessResult> => {
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

export const processPaddleBillingEvent = async (
  config: SupabaseServiceConfig,
  envelope: PaddleBillingEventEnvelope,
): Promise<PaddleBillingProcessResult & { duplicate: boolean }> => {
  const nowMs = envelope.nowMs ?? Date.now();

  const inserted = await insertWebhookEvent(config, {
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    occurredAtIso: envelope.occurredAtIso,
    rawEventPayload: envelope.rawEventPayload,
  });

  if (inserted.duplicate) {
    return {
      duplicate: true,
      status: 'ignored',
      reason: 'Duplicate Paddle event ignored.',
      userId: null,
    };
  }

  try {
    const processResult = await processWebhookEvent(config, {
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      occurredAtIso: envelope.occurredAtIso,
      eventData: envelope.eventData,
      nowMs,
    });

    await finalizeWebhookEvent(config, {
      eventId: envelope.eventId,
      status: processResult.status,
      userId: processResult.userId,
      reason: processResult.reason,
    });

    return {
      duplicate: false,
      ...processResult,
    };
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : 'Unhandled Paddle billing sync error.';

    try {
      await finalizeWebhookEvent(config, {
        eventId: envelope.eventId,
        status: 'failed',
        reason: message,
      });
    } catch {
      // best effort only
    }

    throw error;
  }
};

export const __paddleWebhookSyncInternals = {
  coalesceDate,
  shouldIgnoreAsStale,
};
