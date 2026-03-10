import { collectPaddleEnvironmentIssues, extractSubscriptionSnapshot } from '../edge-lib/paddle-billing.ts';
import {
  authorizeBillingUser,
  asTrimmedString,
  getAuthToken,
  getCurrentUserSubscriptionSummary,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
} from '../edge-lib/paddle-request.ts';
import {
  getSubscriptionPriceIds,
  pickBestFallbackSubscription,
  resolveFallbackSubscriptionDetail,
  loadPaddleSubscriptionDetail,
  type PaddleSubscriptionRecord,
} from '../edge-lib/paddle-subscription-resolution.ts';
import { extractServiceError, getSupabaseServiceConfig, processPaddleBillingEvent } from '../edge-lib/paddle-webhook-sync.ts';

const extractManagementResponse = (
  summary: Awaited<ReturnType<typeof getCurrentUserSubscriptionSummary>>,
  data: Record<string, unknown> | null | undefined,
) => {
  const managementUrls = (data?.management_urls && typeof data.management_urls === 'object')
    ? data.management_urls as Record<string, unknown>
    : {};

  return {
    provider: 'paddle' as const,
    providerSubscriptionId: summary?.provider_subscription_id ?? null,
    cancelUrl: typeof managementUrls.cancel === 'string' ? managementUrls.cancel : null,
    updatePaymentMethodUrl: typeof managementUrls.update_payment_method === 'string'
      ? managementUrls.update_payment_method
      : null,
    providerStatus: summary?.provider_status ?? null,
    currentPeriodEnd: summary?.current_period_end ?? null,
    cancelAt: summary?.cancel_at ?? null,
    canceledAt: summary?.canceled_at ?? null,
    graceEndsAt: summary?.grace_ends_at ?? null,
  };
};


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

const buildSummaryFromSubscription = (subscription: PaddleSubscriptionRecord, userId: string) => {
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
  } satisfies NonNullable<Awaited<ReturnType<typeof getCurrentUserSubscriptionSummary>>>;
};

const syncResolvedSubscription = async (
  subscription: PaddleSubscriptionRecord,
  userId: string,
) => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return;

  const subscriptionForSync = {
    ...subscription,
    custom_data: {
      ...((subscription.custom_data && typeof subscription.custom_data === 'object')
        ? subscription.custom_data as Record<string, unknown>
        : {}),
      tf_user_id: userId,
      tf_source: 'profile_billing_management_lookup',
      tf_mutation: 'subscription_lookup',
    },
  };
  const snapshot = extractSubscriptionSnapshot('subscription.updated', subscriptionForSync, new Date().toISOString());
  const providerSubscriptionId = snapshot.providerSubscriptionId;
  if (!providerSubscriptionId) return;

  const occurredAtIso = asTrimmedString(subscription.updated_at)
    || asTrimmedString(subscription.canceled_at)
    || asTrimmedString(subscription.created_at)
    || new Date().toISOString();
  const eventType = buildSyntheticEventType(snapshot.providerStatus);
  const eventId = `subscription_manage_lookup__${providerSubscriptionId}__${Date.now()}`;

  await processPaddleBillingEvent(serviceConfig, {
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

export const __paddleSubscriptionManageInternals = {
  extractManagementResponse,
  getSubscriptionPriceIds,
  pickBestFallbackSubscription,
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, { ok: false, error: 'Missing bearer token.' });
  }

  const supabaseConfig = getSupabaseAnonConfig();
  if (!supabaseConfig) {
    return json(500, { ok: false, error: 'Supabase environment variables are not configured.' });
  }

  const paddleConfig = getPaddleApiConfig();
  if (!paddleConfig) {
    return json(500, { ok: false, error: 'Paddle API key is not configured.' });
  }

  const environmentIssues = collectPaddleEnvironmentIssues({
    declaredEnvironment: paddleConfig.environment,
    apiKey: paddleConfig.apiKey,
  });
  if (environmentIssues.length > 0) {
    return json(500, {
      ok: false,
      error: environmentIssues[0]?.message || 'Paddle environment configuration is invalid.',
    });
  }

  const authorization = await authorizeBillingUser(supabaseConfig, authToken);
  if ('response' in authorization) {
    return authorization.response;
  }

  const summary = await getCurrentUserSubscriptionSummary(supabaseConfig, authToken);
  const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
  let resolvedSummary = summary;
  let resolvedSubscription: PaddleSubscriptionRecord | null = null;

  if (summary?.provider_subscription_id) {
    try {
      resolvedSubscription = await loadPaddleSubscriptionDetail(
        baseUrl,
        paddleConfig.apiKey,
        summary.provider_subscription_id,
      );
    } catch (error) {
      console.warn('Primary Paddle management lookup failed; falling back to email resolution.', error);
    }
  }

  if (!resolvedSubscription && authorization.user.email) {
    try {
      resolvedSubscription = await resolveFallbackSubscriptionDetail({
        baseUrl,
        apiKey: paddleConfig.apiKey,
        email: authorization.user.email,
        priceMap: paddleConfig.priceMap,
      });
      if (resolvedSubscription) {
        resolvedSummary = buildSummaryFromSubscription(resolvedSubscription, authorization.user.userId);
        try {
          await syncResolvedSubscription(resolvedSubscription, authorization.user.userId);
        } catch (syncError) {
          console.warn('Best-effort local billing sync failed after Paddle management lookup.', syncError);
        }
      }
    } catch (error) {
      return json(502, {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not resolve the linked Paddle subscription.',
      });
    }
  }

  if (!resolvedSummary?.provider_subscription_id || !resolvedSubscription) {
    return json(409, {
      ok: false,
      error: 'No paid Paddle subscription is linked to this account yet.',
    });
  }

  return json(200, {
    ok: true,
    data: extractManagementResponse(resolvedSummary, resolvedSubscription),
  });
};
