import type { PlanTierKey } from '../../types';

export const PADDLE_PROVIDER = 'paddle' as const;
export const PADDLE_SIGNATURE_HEADER = 'Paddle-Signature';

export type PaddleEnvironment = 'sandbox' | 'live';

export type PaddleNormalizedStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'inactive'
  | 'unknown';

export interface PaddlePriceMap {
  tier_mid: string | null;
  tier_premium: string | null;
}

export interface PaddleEnvironmentIssue {
  code:
    | 'api_key_environment_mismatch'
    | 'client_token_environment_mismatch';
  message: string;
}

export interface PaddleSignatureParts {
  timestamp: number;
  signatures: string[];
}

export interface PaddleSignatureVerifyResult {
  ok: boolean;
  reason?:
    | 'missing_signature'
    | 'invalid_signature_header'
    | 'invalid_timestamp'
    | 'timestamp_out_of_range'
    | 'invalid_signature';
}

export interface PaddleSubscriptionSnapshot {
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  providerStatus: PaddleNormalizedStatus;
  providerPriceId: string | null;
  providerProductId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  graceEndsAt: string | null;
  currency: string | null;
  amount: number | null;
  customData: Record<string, unknown> | null;
}

export interface PaddleTransactionSnapshot {
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  currency: string | null;
  amount: number | null;
  customData: Record<string, unknown> | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeDate = (value: unknown): string | null => {
  const raw = asTrimmedString(value);
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

const addDaysToIso = (isoDate: string, days: number): string | null => {
  const timestamp = Date.parse(isoDate);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + (days * 24 * 60 * 60 * 1000)).toISOString();
};

const timingSafeEquals = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
};

const digestToHex = (digest: ArrayBuffer): string =>
  Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const readPaddlePriceMapFromEnv = (
  envReader: (name: string) => string | undefined,
): PaddlePriceMap => {
  const tierMid = asTrimmedString(envReader('PADDLE_PRICE_ID_TIER_MID'));
  const tierPremium = asTrimmedString(envReader('PADDLE_PRICE_ID_TIER_PREMIUM'));
  return {
    tier_mid: tierMid,
    tier_premium: tierPremium,
  };
};

export const normalizePaddleEnvironment = (value: string | null | undefined): PaddleEnvironment => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  return normalized === 'sandbox' ? 'sandbox' : 'live';
};

export const detectPaddleApiKeyEnvironment = (
  apiKey: string | null | undefined,
): PaddleEnvironment | null => {
  const normalized = asTrimmedString(apiKey);
  if (!normalized) return null;
  if (normalized.startsWith('pdl_sdbx_apikey_')) return 'sandbox';
  if (normalized.startsWith('pdl_live_apikey_')) return 'live';
  return null;
};

export const detectPaddleClientTokenEnvironment = (
  clientToken: string | null | undefined,
): PaddleEnvironment | null => {
  const normalized = asTrimmedString(clientToken);
  if (!normalized) return null;
  if (normalized.startsWith('test_')) return 'sandbox';
  if (normalized.startsWith('live_')) return 'live';
  return null;
};

export const collectPaddleEnvironmentIssues = ({
  declaredEnvironment,
  apiKey,
  clientToken,
}: {
  declaredEnvironment: PaddleEnvironment;
  apiKey?: string | null;
  clientToken?: string | null;
}): PaddleEnvironmentIssue[] => {
  const issues: PaddleEnvironmentIssue[] = [];
  const apiKeyEnvironment = detectPaddleApiKeyEnvironment(apiKey);
  const clientTokenEnvironment = detectPaddleClientTokenEnvironment(clientToken);

  if (apiKeyEnvironment && apiKeyEnvironment !== declaredEnvironment) {
    issues.push({
      code: 'api_key_environment_mismatch',
      message: `PADDLE_API_KEY appears to be a ${apiKeyEnvironment} key while PADDLE_ENV=${declaredEnvironment}. Create and use a ${declaredEnvironment} API key from Paddle Developer tools -> Authentication -> API keys.`,
    });
  }

  if (clientTokenEnvironment && clientTokenEnvironment !== declaredEnvironment) {
    issues.push({
      code: 'client_token_environment_mismatch',
      message: `VITE_PADDLE_CLIENT_TOKEN appears to be a ${clientTokenEnvironment} token while PADDLE_ENV=${declaredEnvironment}. Use a ${declaredEnvironment === 'sandbox' ? 'sandbox client-side token (test_) and set Paddle.Environment.set("sandbox") before Paddle.Initialize().' : 'live client-side token (live_) for production checkout.'}`,
    });
  }

  return issues;
};

export const resolvePriceIdForTier = (
  tierKey: PlanTierKey,
  priceMap: PaddlePriceMap,
): string | null => {
  if (tierKey === 'tier_mid') return priceMap.tier_mid;
  if (tierKey === 'tier_premium') return priceMap.tier_premium;
  return null;
};

export const resolveTierFromPriceId = (
  priceId: string | null | undefined,
  priceMap: PaddlePriceMap,
): PlanTierKey | null => {
  const normalized = asTrimmedString(priceId);
  if (!normalized) return null;
  if (priceMap.tier_mid && normalized === priceMap.tier_mid) return 'tier_mid';
  if (priceMap.tier_premium && normalized === priceMap.tier_premium) return 'tier_premium';
  return null;
};

export const normalizePaddleStatus = (value: unknown): PaddleNormalizedStatus => {
  const normalized = (asTrimmedString(value) || '').toLowerCase();
  if (normalized === 'active') return 'active';
  if (normalized === 'trialing') return 'trialing';
  if (normalized === 'past_due') return 'past_due';
  if (normalized === 'paused') return 'paused';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'inactive') return 'inactive';
  return 'unknown';
};

export const shouldGrantPaidTier = (
  status: PaddleNormalizedStatus,
  graceEndsAtIso: string | null,
  nowMs = Date.now(),
): boolean => {
  if (status === 'active' || status === 'trialing' || status === 'past_due') {
    return true;
  }
  if (status === 'canceled' && graceEndsAtIso) {
    const graceEndsMs = Date.parse(graceEndsAtIso);
    return Number.isFinite(graceEndsMs) && graceEndsMs > nowMs;
  }
  return false;
};

export const parsePaddleSignatureHeader = (headerValue: string | null): PaddleSignatureParts | null => {
  const raw = asTrimmedString(headerValue);
  if (!raw) return null;

  const entries = raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const entry of entries) {
    const [key, value] = entry.split('=', 2);
    const normalizedKey = (key || '').trim().toLowerCase();
    const normalizedValue = (value || '').trim();
    if (!normalizedKey || !normalizedValue) continue;

    if (normalizedKey === 'ts') {
      const parsed = Number.parseInt(normalizedValue, 10);
      if (Number.isFinite(parsed)) {
        timestamp = parsed;
      }
      continue;
    }

    if (normalizedKey === 'h1') {
      signatures.push(normalizedValue.toLowerCase());
    }
  }

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
};

export const computePaddleSignature = async (
  secret: string,
  timestamp: number,
  rawBody: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payload = encoder.encode(`${timestamp}:${rawBody}`);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const digest = await crypto.subtle.sign('HMAC', cryptoKey, payload);
  return digestToHex(digest);
};

export const verifyPaddleSignature = async ({
  secret,
  headerValue,
  rawBody,
  nowMs = Date.now(),
  maxAgeSeconds = 5 * 60,
}: {
  secret: string;
  headerValue: string | null;
  rawBody: string;
  nowMs?: number;
  maxAgeSeconds?: number;
}): Promise<PaddleSignatureVerifyResult> => {
  const signatureParts = parsePaddleSignatureHeader(headerValue);
  if (!signatureParts) {
    return { ok: false, reason: 'missing_signature' };
  }

  if (!Number.isFinite(signatureParts.timestamp)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  const maxAgeMs = maxAgeSeconds * 1000;
  const timestampMs = signatureParts.timestamp * 1000;
  if (Math.abs(nowMs - timestampMs) > maxAgeMs) {
    return { ok: false, reason: 'timestamp_out_of_range' };
  }

  const expectedSignature = await computePaddleSignature(secret, signatureParts.timestamp, rawBody);
  const matches = signatureParts.signatures.some((candidate) =>
    timingSafeEquals(candidate, expectedSignature),
  );

  if (!matches) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true };
};

export const extractPaddleUserIdFromCustomData = (customData: unknown): string | null => {
  const record = asObject(customData);
  const candidate = asTrimmedString(record?.tf_user_id);
  if (!candidate || !UUID_REGEX.test(candidate)) return null;
  return candidate;
};

export const extractSubscriptionSnapshot = (
  eventType: string,
  data: unknown,
  occurredAtIso: string | null,
): PaddleSubscriptionSnapshot => {
  const source = asObject(data);
  const currentBillingPeriod = asObject(source?.current_billing_period);
  const scheduledChange = asObject(source?.scheduled_change);
  const recurringTransactionDetails = asObject(source?.recurring_transaction_details);
  const recurringTotals = asObject(recurringTransactionDetails?.totals);
  const nextTransaction = asObject(source?.next_transaction);
  const nextTransactionDetails = asObject(nextTransaction?.details);
  const nextTransactionTotals = asObject(nextTransactionDetails?.totals);

  const items = Array.isArray(source?.items) ? source.items : [];
  const firstItem = asObject(items[0]);
  const firstItemPrice = asObject(firstItem?.price);

  const providerPriceId = asTrimmedString(firstItemPrice?.id) || asTrimmedString(firstItem?.price_id);
  const providerProductId = asTrimmedString(firstItemPrice?.product_id) || asTrimmedString(firstItem?.product_id);

  const canceledAt = normalizeDate(source?.canceled_at)
    || (eventType === 'subscription.canceled' ? occurredAtIso : null);
  const graceEndsAt = canceledAt ? addDaysToIso(canceledAt, 7) : null;
  const currency = asTrimmedString(recurringTotals?.currency_code)
    || asTrimmedString(nextTransaction?.currency_code)
    || asTrimmedString(nextTransactionTotals?.currency_code);
  const amount = parseAmountToInteger(recurringTotals?.total)
    ?? parseAmountToInteger(recurringTotals?.grand_total)
    ?? parseAmountToInteger(nextTransactionTotals?.total)
    ?? parseAmountToInteger(nextTransactionTotals?.grand_total);

  return {
    providerSubscriptionId: asTrimmedString(source?.id),
    providerCustomerId: asTrimmedString(source?.customer_id),
    providerStatus: normalizePaddleStatus(source?.status),
    providerPriceId,
    providerProductId,
    currentPeriodStart: normalizeDate(currentBillingPeriod?.starts_at),
    currentPeriodEnd: normalizeDate(currentBillingPeriod?.ends_at),
    cancelAt: normalizeDate(scheduledChange?.effective_at),
    canceledAt,
    graceEndsAt,
    currency,
    amount,
    customData: asObject(source?.custom_data),
  };
};

const parseAmountToInteger = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    if (!/^-?\d+$/.test(normalized)) return null;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const extractTransactionSnapshot = (data: unknown): PaddleTransactionSnapshot => {
  const source = asObject(data);
  const details = asObject(source?.details);
  const totals = asObject(details?.totals);

  const currency = asTrimmedString(source?.currency_code)
    || asTrimmedString(totals?.currency_code);
  const amount = parseAmountToInteger(totals?.total)
    ?? parseAmountToInteger(totals?.grand_total)
    ?? parseAmountToInteger(source?.total);

  return {
    providerSubscriptionId: asTrimmedString(source?.subscription_id),
    providerCustomerId: asTrimmedString(source?.customer_id),
    currency,
    amount,
    customData: asObject(source?.custom_data),
  };
};

export const __paddleBillingInternals = {
  addDaysToIso,
  asTrimmedString,
  normalizeDate,
  parseAmountToInteger,
  timingSafeEquals,
};
