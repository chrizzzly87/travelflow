import { extractSubscriptionSnapshot, type PaddlePriceMap } from './paddle-billing.ts';
import type { CurrentUserSubscriptionSummary } from './paddle-request.ts';
import {
  loadPaddleSubscriptionDetail,
  resolveFallbackSubscriptionDetail,
  type PaddleSubscriptionRecord,
} from './paddle-subscription-resolution.ts';
import {
  getSupabaseServiceConfig,
  processPaddleBillingEvent,
  type PaddleBillingProcessResult,
} from './paddle-webhook-sync.ts';

const readText = (value: unknown): string | null => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const buildSyntheticEventType = (status: string | null): string => {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'subscription.activated';
    case 'canceled':
      return 'subscription.canceled';
    default:
      return 'subscription.updated';
  }
};

export const buildSummaryFromSubscription = (
  subscription: PaddleSubscriptionRecord,
  userId: string,
): CurrentUserSubscriptionSummary => {
  const snapshot = extractSubscriptionSnapshot('subscription.updated', subscription, new Date().toISOString());
  return {
    user_id: userId,
    provider: 'paddle',
    provider_customer_id: snapshot.providerCustomerId,
    provider_subscription_id: snapshot.providerSubscriptionId,
    provider_price_id: snapshot.providerPriceId,
    provider_product_id: snapshot.providerProductId,
    provider_status: snapshot.providerStatus,
    status: snapshot.providerStatus,
    current_period_start: snapshot.currentPeriodStart,
    current_period_end: snapshot.currentPeriodEnd,
    cancel_at: snapshot.cancelAt,
    canceled_at: snapshot.canceledAt,
    grace_ends_at: snapshot.graceEndsAt,
    currency: snapshot.currency,
    amount: snapshot.amount,
    last_event_id: null,
    last_event_type: null,
    last_event_at: null,
  };
};

export const syncResolvedSubscription = async (
  subscription: PaddleSubscriptionRecord,
  userId: string,
  source: string,
): Promise<(PaddleBillingProcessResult & { duplicate: boolean }) | null> => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return null;

  const existingCustomData = (
    subscription.custom_data && typeof subscription.custom_data === 'object' && !Array.isArray(subscription.custom_data)
  )
    ? subscription.custom_data as Record<string, unknown>
    : {};
  const subscriptionForSync = {
    ...subscription,
    custom_data: {
      ...existingCustomData,
      tf_user_id: userId,
      tf_source: source,
      tf_mutation: 'subscription_lookup',
    },
  };
  const snapshot = extractSubscriptionSnapshot('subscription.updated', subscriptionForSync, new Date().toISOString());
  const providerSubscriptionId = snapshot.providerSubscriptionId;
  if (!providerSubscriptionId) return null;

  const occurredAtIso = readText(subscription.updated_at)
    || readText(subscription.canceled_at)
    || readText(subscription.created_at)
    || new Date().toISOString();
  const eventType = buildSyntheticEventType(snapshot.providerStatus);
  const eventId = `${source}__${providerSubscriptionId}__${Date.now()}`;

  return processPaddleBillingEvent(serviceConfig, {
    eventId,
    eventType,
    occurredAtIso,
    eventData: subscriptionForSync,
    rawEventPayload: {
      event_id: eventId,
      event_type: eventType,
      occurred_at: occurredAtIso,
      data: subscriptionForSync,
    },
  });
};

export const resolveCurrentPaddleSubscription = async ({
  baseUrl,
  apiKey,
  priceMap,
  userId,
  email,
  summary,
  syncSource,
}: {
  baseUrl: string;
  apiKey: string;
  priceMap: PaddlePriceMap;
  userId: string;
  email: string | null;
  summary: CurrentUserSubscriptionSummary | null;
  syncSource: string;
}): Promise<{
  summary: CurrentUserSubscriptionSummary | null;
  subscription: PaddleSubscriptionRecord | null;
  localSync: (PaddleBillingProcessResult & { duplicate: boolean }) | null;
}> => {
  let resolvedSubscription: PaddleSubscriptionRecord | null = null;

  if (summary?.provider_subscription_id) {
    try {
      resolvedSubscription = await loadPaddleSubscriptionDetail(
        baseUrl,
        apiKey,
        summary.provider_subscription_id,
      );
    } catch (error) {
      console.warn('Primary Paddle subscription lookup failed; falling back to customer email resolution.', error);
    }
  }

  if (!resolvedSubscription && email) {
    resolvedSubscription = await resolveFallbackSubscriptionDetail({
      baseUrl,
      apiKey,
      email,
      priceMap,
    });
  }

  if (!resolvedSubscription) {
    return {
      summary,
      subscription: null,
      localSync: null,
    };
  }

  const resolvedSummary = buildSummaryFromSubscription(resolvedSubscription, userId);
  let localSync: (PaddleBillingProcessResult & { duplicate: boolean }) | null = null;
  try {
    localSync = await syncResolvedSubscription(resolvedSubscription, userId, syncSource);
  } catch (error) {
    console.warn('Best-effort local Paddle subscription sync failed.', error);
  }

  return {
    summary: resolvedSummary,
    subscription: resolvedSubscription,
    localSync,
  };
};
