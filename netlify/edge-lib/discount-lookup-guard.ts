/**
 * Hardening helpers for the public Paddle voucher lookup endpoint.
 *
 * The lookup is reachable without authentication (guests can apply vouchers at
 * checkout), so it needs strict input validation, per-key token-bucket rate
 * limiting, uniform negative responses, and a minimized success payload to
 * prevent high-speed voucher-code enumeration against the Paddle account.
 */

/** Paddle checkout codes are short alphanumeric identifiers; allow `-`/`_` too. */
export const VOUCHER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/**
 * Normalizes a raw voucher-code input to uppercase and validates it against a
 * strict charset/length allowlist. Returns `null` for anything suspicious so
 * callers can reject early without touching the Paddle API.
 */
export const normalizeVoucherCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized.length > 32) return null;
  return VOUCHER_CODE_PATTERN.test(normalized) ? normalized : null;
};

/** Single message used for every negative lookup outcome (not found, inactive,
 * checkout-disabled, description-only) so responses are indistinguishable. */
export const UNIFORM_INVALID_VOUCHER_MESSAGE = 'Voucher code not found or not available for checkout.';

export const RATE_LIMITED_MESSAGE = 'Too many voucher lookups. Please wait a moment and try again.';

export interface TokenBucketLimiterOptions {
  /** Maximum burst size (tokens available when idle). */
  capacity: number;
  /** Time for a fully drained bucket to refill completely, in ms. */
  refillIntervalMs: number;
  /** Cap on tracked keys to bound isolate memory. */
  maxKeys?: number;
}

export interface TokenBucketLimiter {
  /** Consumes one token for `key`. Returns `false` when the bucket is empty. */
  tryConsume: (key: string, nowMs?: number) => boolean;
  /** Number of currently tracked keys (for tests/diagnostics). */
  size: () => number;
}

interface BucketState {
  tokens: number;
  updatedAtMs: number;
}

/**
 * In-memory token bucket limiter (per edge isolate). Not globally durable, but
 * it removes the "unlimited unauthenticated requests" property and caps the
 * enumeration rate any single isolate will serve.
 */
export const createTokenBucketLimiter = (
  options: TokenBucketLimiterOptions,
): TokenBucketLimiter => {
  const capacity = Math.max(1, Math.floor(options.capacity));
  const refillIntervalMs = Math.max(1, Math.floor(options.refillIntervalMs));
  const maxKeys = Math.max(1, Math.floor(options.maxKeys ?? 5000));
  const refillPerMs = capacity / refillIntervalMs;
  const buckets = new Map<string, BucketState>();

  const prune = (nowMs: number): void => {
    if (buckets.size <= maxKeys) return;
    for (const [key, state] of buckets) {
      const elapsed = Math.max(0, nowMs - state.updatedAtMs);
      if (state.tokens + elapsed * refillPerMs >= capacity) {
        buckets.delete(key);
      }
      if (buckets.size <= maxKeys) return;
    }
    // Still over budget (sustained attack across many keys): drop oldest entries.
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (buckets.size <= maxKeys) return;
    }
  };

  return {
    tryConsume: (key: string, nowMs: number = Date.now()): boolean => {
      const state = buckets.get(key);
      let tokens = capacity;
      if (state) {
        const elapsed = Math.max(0, nowMs - state.updatedAtMs);
        tokens = Math.min(capacity, state.tokens + elapsed * refillPerMs);
      } else {
        prune(nowMs);
      }
      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAtMs: nowMs });
        return false;
      }
      buckets.set(key, { tokens: tokens - 1, updatedAtMs: nowMs });
      return true;
    },
    size: () => buckets.size,
  };
};

export interface DiscountLookupEstimate {
  originalAmount: number;
  discountedAmount: number;
  savingsAmount: number;
  currencyCode: string;
}

export interface DiscountLookupData {
  code: string;
  type: string | null;
  amount: number | null;
  currencyCode: string | null;
  applicableToTier: boolean;
  estimate: DiscountLookupEstimate | null;
}

/**
 * Shapes the success payload down to exactly the fields the checkout UI
 * consumes (badge + savings estimate). Internal Paddle metadata such as the
 * discount description, recurrence settings, ids, or restriction lists must
 * never be exposed to unauthenticated callers.
 */
export const shapeDiscountLookupData = (input: {
  code: string;
  type: unknown;
  amount: unknown;
  currencyCode: unknown;
  applicableToTier: boolean;
  estimate: DiscountLookupEstimate | null;
}): DiscountLookupData => ({
  code: input.code,
  type: typeof input.type === 'string' && input.type.trim() ? input.type.trim() : null,
  amount: typeof input.amount === 'number' && Number.isFinite(input.amount) ? Math.trunc(input.amount) : null,
  currencyCode: typeof input.currencyCode === 'string' && input.currencyCode.trim() ? input.currencyCode.trim() : null,
  applicableToTier: input.applicableToTier === true,
  estimate: input.applicableToTier === true ? input.estimate : null,
});
