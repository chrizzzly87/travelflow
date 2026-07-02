import type { PlanTierKey } from '../../types';
import {
  collectPaddleEnvironmentIssues,
  resolvePriceIdForTier,
} from '../edge-lib/paddle-billing.ts';
import {
  authorizeBillingUser,
  fetchPaddleJson,
  getAuthToken,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
  asTrimmedString,
} from '../edge-lib/paddle-request.ts';
import {
  createTokenBucketLimiter,
  normalizeVoucherCode,
  shapeDiscountLookupData,
  RATE_LIMITED_MESSAGE,
  UNIFORM_INVALID_VOUCHER_MESSAGE,
} from '../edge-lib/discount-lookup-guard.ts';
import { extractServiceError } from '../edge-lib/paddle-webhook-sync.ts';

type CheckoutTierKey = Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;
type PaddleDiscountRecord = Record<string, unknown>;

// Per-isolate token buckets. Not globally durable, but they cap the voucher
// enumeration rate any single edge isolate will serve.
const ipLimiter = createTokenBucketLimiter({ capacity: 10, refillIntervalMs: 60_000 });
const codeLimiter = createTokenBucketLimiter({ capacity: 20, refillIntervalMs: 60_000 });
const userLimiter = createTokenBucketLimiter({ capacity: 15, refillIntervalMs: 60_000 });

/** Constant delay before negative responses to blunt high-speed enumeration. */
const NEGATIVE_RESPONSE_DELAY_MS = 150;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseTierKey = (value: unknown): CheckoutTierKey | null => {
  if (value === 'tier_mid') return 'tier_mid';
  if (value === 'tier_premium') return 'tier_premium';
  return null;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeCode = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  return normalized ? normalized.toUpperCase() : null;
};

/**
 * Matches by exact redeemable checkout code only. Matching against discount
 * descriptions (a previous "diagnostics" behavior) allowed unauthenticated
 * callers to enumerate internal discount descriptions and must not return.
 */
const findDiscountByCode = (
  discounts: PaddleDiscountRecord[],
  code: string,
): PaddleDiscountRecord | null =>
  discounts.find((candidate) => normalizeCode(candidate.code) === code) || null;

const isCheckoutEnabled = (discount: PaddleDiscountRecord): boolean =>
  discount.enabled_for_checkout !== false;

const isDiscountActive = (discount: PaddleDiscountRecord): boolean =>
  (asTrimmedString(discount.status) || '').toLowerCase() === 'active';

const getRestrictionIds = (discount: PaddleDiscountRecord): { priceIds: string[]; productIds: string[] } => {
  const restrictTo = asObject(discount.restrict_to);
  const prices = Array.isArray(restrictTo?.prices) ? restrictTo.prices : [];
  const products = Array.isArray(restrictTo?.products) ? restrictTo.products : [];
  return {
    priceIds: prices.map((value) => asTrimmedString(value)).filter((value): value is string => Boolean(value)),
    productIds: products.map((value) => asTrimmedString(value)).filter((value): value is string => Boolean(value)),
  };
};

const isDiscountApplicableToTarget = (
  discount: PaddleDiscountRecord,
  targetPriceId: string,
  targetProductId: string | null,
): boolean => {
  const restrictions = getRestrictionIds(discount);
  if (restrictions.priceIds.length === 0 && restrictions.productIds.length === 0) {
    return true;
  }
  if (restrictions.priceIds.includes(targetPriceId)) return true;
  return Boolean(targetProductId && restrictions.productIds.includes(targetProductId));
};

const buildEstimate = (
  discount: PaddleDiscountRecord,
  priceAmount: number | null,
  priceCurrencyCode: string | null,
) => {
  if (priceAmount === null || priceCurrencyCode === null) return null;

  const type = asTrimmedString(discount.type);
  const discountAmount = asInteger(discount.amount);
  const discountCurrencyCode = asTrimmedString(discount.currency_code) || priceCurrencyCode;
  if (!type || discountAmount === null) return null;

  let savingsAmount: number | null = null;
  if (type === 'percentage') {
    savingsAmount = Math.max(0, Math.min(priceAmount, Math.round((priceAmount * discountAmount) / 100)));
  } else if ((type === 'flat' || type === 'flat_per_seat') && discountCurrencyCode === priceCurrencyCode) {
    savingsAmount = Math.max(0, Math.min(priceAmount, discountAmount));
  }

  if (savingsAmount === null) return null;
  return {
    originalAmount: priceAmount,
    discountedAmount: Math.max(0, priceAmount - savingsAmount),
    savingsAmount,
    currencyCode: priceCurrencyCode,
  };
};

const loadPriceDetail = async (
  baseUrl: string,
  apiKey: string,
  priceId: string,
): Promise<{ priceAmount: number | null; currencyCode: string | null; productId: string | null }> => {
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/prices/${encodeURIComponent(priceId)}`,
    apiKey,
  );
  const typedPayload = payload as { data?: Record<string, unknown> | null } | null;
  if (!response.ok) {
    throw new Error(extractServiceError(typedPayload, `Could not load Paddle price ${priceId} (${response.status}).`));
  }
  const data = typedPayload?.data;
  const unitPrice = asObject(data?.unit_price);
  return {
    priceAmount: asInteger(unitPrice?.amount),
    currencyCode: asTrimmedString(unitPrice?.currency_code),
    productId: asTrimmedString(data?.product_id),
  };
};

const listDiscounts = async (
  baseUrl: string,
  apiKey: string,
): Promise<PaddleDiscountRecord[]> => {
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/discounts?status=active&per_page=200`,
    apiKey,
  );
  const typedPayload = payload as { data?: unknown } | null;
  if (!response.ok) {
    throw new Error(extractServiceError(typedPayload, `Could not list Paddle discounts (${response.status}).`));
  }
  return Array.isArray(typedPayload?.data)
    ? typedPayload.data.filter((row): row is PaddleDiscountRecord => Boolean(row) && typeof row === 'object')
    : [];
};

const rateLimited = (): Response =>
  json(429, { ok: false, error: RATE_LIMITED_MESSAGE });

const resolveClientIp = (request: Request, context?: { ip?: string }): string =>
  asTrimmedString(context?.ip)
    || asTrimmedString(request.headers.get('x-nf-client-connection-ip'))
    || 'unknown';

export const __paddleDiscountLookupInternals = {
  buildEstimate,
  getRestrictionIds,
  isDiscountApplicableToTarget,
  normalizeCode,
  parseTierKey,
  findDiscountByCode,
};

export default async (request: Request, context?: { ip?: string }): Promise<Response> => {
  if (request.method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed.' });
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

  // Strict input validation before any network work: uppercase alphanumeric
  // voucher codes (max 32 chars) and an allowlisted checkout tier only.
  const url = new URL(request.url);
  const code = normalizeVoucherCode(url.searchParams.get('code'));
  const tierKey = parseTierKey(url.searchParams.get('tier'));
  if (!code || !tierKey) {
    return json(400, { ok: false, error: 'A voucher code and supported tier key are required.' });
  }

  // Rate limit per client IP and per candidate code before touching Paddle.
  const clientIp = resolveClientIp(request, context);
  if (!ipLimiter.tryConsume(`ip:${clientIp}`)) {
    return rateLimited();
  }
  if (!codeLimiter.tryConsume(`code:${code}`)) {
    return rateLimited();
  }

  // Checkout also serves anonymous visitors, so authentication cannot be
  // required here. But when the client does send a Supabase session token,
  // verify it and rate limit on the user id as an additional key.
  const authToken = getAuthToken(request);
  if (authToken) {
    const supabaseConfig = getSupabaseAnonConfig();
    if (supabaseConfig) {
      const authorization = await authorizeBillingUser(supabaseConfig, authToken).catch(() => null);
      if (authorization?.ok && !userLimiter.tryConsume(`user:${authorization.user.userId}`)) {
        return rateLimited();
      }
    }
  }

  const targetPriceId = resolvePriceIdForTier(tierKey, paddleConfig.priceMap);
  if (!targetPriceId) {
    return json(400, { ok: false, error: `No Paddle price ID configured for ${tierKey}.` });
  }

  try {
    const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
    const [discounts, priceDetail] = await Promise.all([
      listDiscounts(baseUrl, paddleConfig.apiKey),
      loadPriceDetail(baseUrl, paddleConfig.apiKey, targetPriceId),
    ]);
    const discount = findDiscountByCode(discounts, code);

    // Uniform negative response: "not found", "inactive", and "not enabled
    // for checkout" are indistinguishable so the endpoint cannot be used as
    // an oracle for the Paddle discount catalog.
    if (!discount || !isDiscountActive(discount) || !isCheckoutEnabled(discount)) {
      await delay(NEGATIVE_RESPONSE_DELAY_MS);
      return json(404, { ok: false, error: UNIFORM_INVALID_VOUCHER_MESSAGE });
    }

    const applicableToTier = isDiscountApplicableToTarget(discount, targetPriceId, priceDetail.productId);
    const estimate = applicableToTier
      ? buildEstimate(discount, priceDetail.priceAmount, priceDetail.currencyCode)
      : null;

    return json(200, {
      ok: true,
      data: shapeDiscountLookupData({
        code,
        type: asTrimmedString(discount.type),
        amount: asInteger(discount.amount),
        currencyCode: asTrimmedString(discount.currency_code) || priceDetail.currencyCode,
        applicableToTier,
        estimate,
      }),
    });
  } catch (error) {
    return json(502, {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not validate the Paddle voucher.',
    });
  }
};
