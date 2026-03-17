import { resolveTierFromPriceId, type PaddlePriceMap } from './paddle-billing.ts';
import { asTrimmedString, fetchPaddleJson } from './paddle-request.ts';
import { extractServiceError } from './paddle-webhook-sync.ts';

export type PaddleSubscriptionRecord = Record<string, unknown>;
export type PaddleCustomerRecord = Record<string, unknown>;

const FALLBACK_ELIGIBLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled']);
const STATUS_PRIORITY = ['active', 'trialing', 'past_due', 'paused', 'canceled'];

export const getConfiguredPriceIds = (priceMap: PaddlePriceMap): string[] => {
  const ids = [priceMap.tier_mid, priceMap.tier_premium].filter((value): value is string => Boolean(value));
  return Array.from(new Set(ids));
};

const getSubscriptionItems = (subscription: Record<string, unknown>): Array<Record<string, unknown>> => {
  return Array.isArray(subscription.items)
    ? subscription.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
};

export const getSubscriptionPriceIds = (subscription: Record<string, unknown>): string[] => {
  return getSubscriptionItems(subscription)
    .map((item) => {
      const price = item.price && typeof item.price === 'object' ? item.price as Record<string, unknown> : null;
      return asTrimmedString(price?.id) || asTrimmedString(item.price_id);
    })
    .filter((value): value is string => Boolean(value));
};

export const getSubscriptionStatus = (subscription: Record<string, unknown>): string => {
  return (asTrimmedString(subscription.status) || '').toLowerCase();
};

export const getSubscriptionTimestamp = (subscription: Record<string, unknown>): number => {
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

const compareSubscriptions = (
  left: PaddleSubscriptionRecord,
  right: PaddleSubscriptionRecord,
  priceMap: PaddlePriceMap,
): number => {
  const leftStatus = STATUS_PRIORITY.indexOf(getSubscriptionStatus(left));
  const rightStatus = STATUS_PRIORITY.indexOf(getSubscriptionStatus(right));
  if (leftStatus !== rightStatus) return leftStatus - rightStatus;

  const timeDelta = getSubscriptionTimestamp(right) - getSubscriptionTimestamp(left);
  if (timeDelta !== 0) return timeDelta;

  const leftTierWeight = Math.max(
    ...getSubscriptionPriceIds(left).map((priceId) => {
      const tier = resolveTierFromPriceId(priceId, priceMap);
      return tier === 'tier_premium' ? 2 : tier === 'tier_mid' ? 1 : 0;
    }),
    0,
  );
  const rightTierWeight = Math.max(
    ...getSubscriptionPriceIds(right).map((priceId) => {
      const tier = resolveTierFromPriceId(priceId, priceMap);
      return tier === 'tier_premium' ? 2 : tier === 'tier_mid' ? 1 : 0;
    }),
    0,
  );
  return rightTierWeight - leftTierWeight;
};

export const pickBestFallbackSubscription = (
  subscriptions: PaddleSubscriptionRecord[],
  priceMap: PaddlePriceMap,
): PaddleSubscriptionRecord | null => {
  const configuredPriceIds = new Set(getConfiguredPriceIds(priceMap));
  const eligible = subscriptions.filter((subscription) => {
    const status = getSubscriptionStatus(subscription);
    if (!FALLBACK_ELIGIBLE_STATUSES.has(status)) return false;
    return getSubscriptionPriceIds(subscription).some((priceId) => configuredPriceIds.has(priceId));
  });

  eligible.sort((left, right) => compareSubscriptions(left, right, priceMap));
  return eligible[0] || null;
};

export const listPaddleCustomersByEmail = async (
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

export const listPaddleSubscriptionsForCustomer = async (
  baseUrl: string,
  apiKey: string,
  customerId: string,
  priceMap: PaddlePriceMap,
): Promise<PaddleSubscriptionRecord[]> => {
  const params = new URLSearchParams({
    customer_id: customerId,
    per_page: '50',
  });
  const configuredPriceIds = getConfiguredPriceIds(priceMap);
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

export const loadPaddleSubscriptionDetail = async (
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
    throw new Error(extractServiceError(typedPayload, `Could not load Paddle subscription (${response.status}).`));
  }
  const data = typedPayload?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Paddle returned an incomplete subscription payload.');
  }
  return data as PaddleSubscriptionRecord;
};

export const resolveFallbackSubscriptionDetail = async ({
  baseUrl,
  apiKey,
  email,
  priceMap,
}: {
  baseUrl: string;
  apiKey: string;
  email: string;
  priceMap: PaddlePriceMap;
}): Promise<PaddleSubscriptionRecord | null> => {
  const customers = await listPaddleCustomersByEmail(baseUrl, apiKey, email);
  if (customers.length === 0) return null;

  let resolved: PaddleSubscriptionRecord | null = null;
  for (const customer of customers) {
    const customerId = asTrimmedString(customer.id);
    if (!customerId) continue;
    const subscriptions = await listPaddleSubscriptionsForCustomer(baseUrl, apiKey, customerId, priceMap);
    const candidate = pickBestFallbackSubscription(subscriptions, priceMap);
    if (candidate) {
      resolved = candidate;
      break;
    }
  }

  const subscriptionId = asTrimmedString(resolved?.id);
  if (!subscriptionId) return null;
  return loadPaddleSubscriptionDetail(baseUrl, apiKey, subscriptionId);
};
