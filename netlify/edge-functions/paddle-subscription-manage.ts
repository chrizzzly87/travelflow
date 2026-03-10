import { collectPaddleEnvironmentIssues, extractSubscriptionSnapshot } from '../edge-lib/paddle-billing.ts';
import {
  authorizeBillingUser,
  asTrimmedString,
  fetchPaddleJson,
  getAuthToken,
  getCurrentUserSubscriptionSummary,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
} from '../edge-lib/paddle-request.ts';
import { extractServiceError, getSupabaseServiceConfig, processPaddleBillingEvent } from '../edge-lib/paddle-webhook-sync.ts';

type PaddleSubscriptionRecord = Record<string, unknown>;
type PaddleCustomerRecord = Record<string, unknown>;

const FALLBACK_ELIGIBLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled']);
const STATUS_PRIORITY = ['active', 'trialing', 'past_due', 'paused', 'canceled'];

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

const getConfiguredPriceIds = (priceMap: { tier_mid: string | null; tier_premium: string | null }): string[] => {
  const ids = [priceMap.tier_mid, priceMap.tier_premium].filter((value): value is string => Boolean(value));
  return Array.from(new Set(ids));
};

const getSubscriptionItems = (subscription: Record<string, unknown>): Array<Record<string, unknown>> => {
  return Array.isArray(subscription.items)
    ? subscription.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
};

const getSubscriptionPriceIds = (subscription: Record<string, unknown>): string[] => {
  return getSubscriptionItems(subscription)
    .map((item) => {
      const price = item.price && typeof item.price === 'object' ? item.price as Record<string, unknown> : null;
      return asTrimmedString(price?.id) || asTrimmedString(item.price_id);
    })
    .filter((value): value is string => Boolean(value));
};

const getSubscriptionStatus = (subscription: Record<string, unknown>): string => {
  return (asTrimmedString(subscription.status) || '').toLowerCase();
};

const getSubscriptionTimestamp = (subscription: Record<string, unknown>): number => {
  const candidates = [
    asTrimmedString(subscription.updated_at),
    asTrimmedString(subscription.next_billed_at),
    asTrimmedString(subscription.canceled_at),
    asTrimmedString(subscription.created_at),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const pickBestFallbackSubscription = (
  subscriptions: PaddleSubscriptionRecord[],
  configuredPriceIds: Set<string>,
): PaddleSubscriptionRecord | null => {
  const eligible = subscriptions.filter((subscription) => {
    const status = getSubscriptionStatus(subscription);
    if (!FALLBACK_ELIGIBLE_STATUSES.has(status)) return false;
    return getSubscriptionPriceIds(subscription).some((priceId) => configuredPriceIds.has(priceId));
  });

  eligible.sort((left, right) => {
    const leftStatus = STATUS_PRIORITY.indexOf(getSubscriptionStatus(left));
    const rightStatus = STATUS_PRIORITY.indexOf(getSubscriptionStatus(right));
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    return getSubscriptionTimestamp(right) - getSubscriptionTimestamp(left);
  });

  return eligible[0] || null;
};

const listPaddleCustomersByEmail = async (
  baseUrl: string,
  apiKey: string,
  email: string,
): Promise<PaddleCustomerRecord[]> => {
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/customers?email=${encodeURIComponent(email)}&per_page=50`,
    apiKey,
  );
  const typedPayload = payload as { data?: unknown } | null;
  if (!response.ok) {
    throw new Error(extractServiceError(typedPayload, `Could not look up Paddle customers (${response.status}).`));
  }
  return Array.isArray(typedPayload?.data)
    ? typedPayload.data.filter((row): row is PaddleCustomerRecord => Boolean(row) && typeof row === 'object')
    : [];
};

const listPaddleSubscriptionsForCustomer = async (
  baseUrl: string,
  apiKey: string,
  customerId: string,
  configuredPriceIds: string[],
): Promise<PaddleSubscriptionRecord[]> => {
  const params = new URLSearchParams({
    customer_id: customerId,
    per_page: '50',
  });
  if (configuredPriceIds.length > 0) {
    params.set('price_id', configuredPriceIds.join(','));
  }

  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/subscriptions?${params.toString()}`,
    apiKey,
  );
  const typedPayload = payload as { data?: unknown } | null;
  if (!response.ok) {
    throw new Error(extractServiceError(typedPayload, `Could not look up Paddle subscriptions (${response.status}).`));
  }
  return Array.isArray(typedPayload?.data)
    ? typedPayload.data.filter((row): row is PaddleSubscriptionRecord => Boolean(row) && typeof row === 'object')
    : [];
};

const loadPaddleSubscriptionDetail = async (
  baseUrl: string,
  apiKey: string,
  subscriptionId: string,
): Promise<PaddleSubscriptionRecord> => {
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    apiKey,
  );
  const typedPayload = payload as { data?: unknown } | null;
  if (!response.ok) {
    throw new Error(extractServiceError(typedPayload, `Could not load Paddle management URLs (${response.status}).`));
  }
  const data = typedPayload?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Paddle returned an incomplete subscription payload.');
  }
  return data as PaddleSubscriptionRecord;
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

const resolveFallbackSubscriptionDetail = async ({
  baseUrl,
  apiKey,
  email,
  priceMap,
}: {
  baseUrl: string;
  apiKey: string;
  email: string;
  priceMap: { tier_mid: string | null; tier_premium: string | null };
}): Promise<PaddleSubscriptionRecord | null> => {
  const customers = await listPaddleCustomersByEmail(baseUrl, apiKey, email);
  if (customers.length === 0) return null;

  const configuredPriceIds = getConfiguredPriceIds(priceMap);
  const configuredPriceIdSet = new Set(configuredPriceIds);

  let resolved: PaddleSubscriptionRecord | null = null;
  for (const customer of customers) {
    const customerId = asTrimmedString(customer.id);
    if (!customerId) continue;
    const subscriptions = await listPaddleSubscriptionsForCustomer(baseUrl, apiKey, customerId, configuredPriceIds);
    const candidate = pickBestFallbackSubscription(subscriptions, configuredPriceIdSet);
    if (candidate) {
      resolved = candidate;
      break;
    }
  }

  const subscriptionId = asTrimmedString(resolved?.id);
  if (!subscriptionId) return null;
  return loadPaddleSubscriptionDetail(baseUrl, apiKey, subscriptionId);
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
