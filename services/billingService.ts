import type { PlanTierKey } from '../types';
import { buildPath } from '../config/routes';
import { dbGetAccessToken, ensureExistingDbSession, DB_ENABLED } from './dbService';
import { supabase } from './supabaseClient';

export type BillingCheckoutTierKey = Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;
export type BillingCheckoutSource =
  | 'pricing_page'
  | 'checkout_page'
  | 'trip_paywall_strip'
  | 'trip_paywall_overlay';

const BILLING_CHECKOUT_TIER_QUERY_KEY = 'tier';
const BILLING_CHECKOUT_SOURCE_QUERY_KEY = 'source';
const BILLING_CHECKOUT_CLAIM_QUERY_KEY = 'claim';
const BILLING_CHECKOUT_RETURN_QUERY_KEY = 'return_to';
const BILLING_CHECKOUT_TRIP_QUERY_KEY = 'trip_id';
const BILLING_CHECKOUT_DISCOUNT_QUERY_KEY = 'discount';
const BILLING_CHECKOUT_VOUCHER_QUERY_KEY = 'voucher';

interface StartPaddleCheckoutPayload {
  tierKey: BillingCheckoutTierKey;
  source?: BillingCheckoutSource | string;
  claimId?: string | null;
  returnTo?: string | null;
  tripId?: string | null;
  discountCode?: string | null;
}

interface PaddleCheckoutResponse {
  ok?: boolean;
  data?: {
    provider?: string;
    environment?: string;
    transactionId?: string;
    checkoutUrl?: string;
    tierKey?: string;
  };
  error?: string;
  message?: string;
  code?: string;
}

interface BillingSubscriptionSummaryResponse {
  ok?: boolean;
  data?: {
    user_id?: string;
    provider?: string | null;
    provider_customer_id?: string | null;
    provider_subscription_id?: string | null;
    provider_price_id?: string | null;
    provider_product_id?: string | null;
    provider_status?: string | null;
    status?: string | null;
    current_period_start?: string | null;
    current_period_end?: string | null;
    cancel_at?: string | null;
    canceled_at?: string | null;
    grace_ends_at?: string | null;
    currency?: string | null;
    amount?: number | null;
    last_event_id?: string | null;
    last_event_type?: string | null;
    last_event_at?: string | null;
  };
  error?: string;
  message?: string;
}

interface BillingUpgradePreviewResponse {
  ok?: boolean;
  data?: {
    mode?: string;
    currentTierKey?: string;
    targetTierKey?: string;
    providerSubscriptionId?: string | null;
    providerStatus?: string | null;
    currentAmount?: number | null;
    currentCurrency?: string | null;
    recurringAmount?: number | null;
    recurringCurrency?: string | null;
    immediateAmount?: number | null;
    immediateCurrency?: string | null;
    prorationMessage?: string | null;
  };
  error?: string;
  message?: string;
  code?: string;
}

interface BillingUpgradeChangeResponse {
  ok?: boolean;
  data?: {
    mode?: string;
    currentTierKey?: string;
    targetTierKey?: string;
    providerSubscriptionId?: string | null;
    providerStatus?: string | null;
    recurringAmount?: number | null;
    recurringCurrency?: string | null;
    localSync?: {
      status?: string;
      duplicate?: boolean;
      reason?: string | null;
    } | null;
  };
  error?: string;
  message?: string;
  code?: string;
}

interface BillingManagementResponse {
  ok?: boolean;
  data?: {
    provider?: string;
    providerSubscriptionId?: string | null;
    cancelUrl?: string | null;
    updatePaymentMethodUrl?: string | null;
    providerStatus?: string | null;
    currentPeriodEnd?: string | null;
    cancelAt?: string | null;
    canceledAt?: string | null;
    graceEndsAt?: string | null;
  };
  error?: string;
  message?: string;
}

interface BillingTransactionSyncResponse {
  ok?: boolean;
  data?: {
    provider?: string;
    transactionId?: string | null;
    providerSubscriptionId?: string | null;
    providerStatus?: string | null;
    localSync?: {
      status?: string;
      duplicate?: boolean;
      reason?: string | null;
    } | null;
  };
  error?: string;
  message?: string;
}

interface BillingSubscriptionRefreshResponse {
  ok?: boolean;
  data?: {
    summary?: BillingSubscriptionSummaryResponse['data'] | null;
    localSync?: {
      status?: string;
      duplicate?: boolean;
      reason?: string | null;
    } | null;
  };
  error?: string;
  message?: string;
}

interface BillingDiscountLookupResponse {
  ok?: boolean;
  data?: {
    code?: string;
    type?: string | null;
    amount?: number | null;
    currencyCode?: string | null;
    description?: string | null;
    appliesToAllRecurring?: boolean;
    maximumRecurringIntervals?: number | null;
    applicableToTier?: boolean;
    estimate?: {
      originalAmount?: number | null;
      discountedAmount?: number | null;
      savingsAmount?: number | null;
      currencyCode?: string | null;
    } | null;
  };
  error?: string;
  message?: string;
}

export interface PaddleCheckoutSession {
  provider: 'paddle';
  environment: string;
  transactionId: string;
  checkoutUrl: string;
  tierKey: BillingCheckoutTierKey;
}

export interface BillingCheckoutPathOptions {
  tierKey: BillingCheckoutTierKey;
  source?: BillingCheckoutSource | string | null;
  claimId?: string | null;
  returnTo?: string | null;
  tripId?: string | null;
  discountCode?: string | null;
}

export interface BillingSubscriptionSummary {
  userId: string;
  provider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  providerPriceId: string | null;
  providerProductId: string | null;
  providerStatus: string | null;
  status: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  graceEndsAt: string | null;
  currency: string | null;
  amount: number | null;
  lastEventId: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
}

export interface BillingUpgradePreview {
  mode: 'upgrade';
  currentTierKey: BillingCheckoutTierKey;
  targetTierKey: BillingCheckoutTierKey;
  providerSubscriptionId: string;
  providerStatus: string | null;
  currentAmount: number | null;
  currentCurrency: string | null;
  recurringAmount: number | null;
  recurringCurrency: string | null;
  immediateAmount: number | null;
  immediateCurrency: string | null;
  prorationMessage: string | null;
}

export interface BillingUpgradeResult {
  mode: 'upgrade_applied';
  currentTierKey: BillingCheckoutTierKey;
  targetTierKey: BillingCheckoutTierKey;
  providerSubscriptionId: string;
  providerStatus: string | null;
  recurringAmount: number | null;
  recurringCurrency: string | null;
  localSync: {
    status: string;
    duplicate: boolean;
    reason: string | null;
  } | null;
}

export interface PaddleSubscriptionManagementUrls {
  provider: 'paddle';
  providerSubscriptionId: string | null;
  cancelUrl: string | null;
  updatePaymentMethodUrl: string | null;
  providerStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  graceEndsAt: string | null;
}

export interface BillingTransactionSyncResult {
  provider: 'paddle';
  transactionId: string;
  providerSubscriptionId: string | null;
  providerStatus: string | null;
  localSync: {
    status: string;
    duplicate: boolean;
    reason: string | null;
  } | null;
}

export interface BillingSubscriptionRefreshResult {
  summary: BillingSubscriptionSummary | null;
  localSync: {
    status: string;
    duplicate: boolean;
    reason: string | null;
  } | null;
}

export interface BillingDiscountLookup {
  code: string;
  type: string | null;
  amount: number | null;
  currencyCode: string | null;
  description: string | null;
  appliesToAllRecurring: boolean;
  maximumRecurringIntervals: number | null;
  applicableToTier: boolean;
  estimate: {
    originalAmount: number | null;
    discountedAmount: number | null;
    savingsAmount: number | null;
    currencyCode: string | null;
  } | null;
}

const asTrimmedString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const isSafeInternalPath = (value: string | null): value is string =>
  Boolean(value && value.startsWith('/') && !value.startsWith('//'));

export const buildBillingCheckoutPath = ({
  tierKey,
  source,
  claimId,
  returnTo,
  tripId,
  discountCode,
}: BillingCheckoutPathOptions): string => {
  const params = new URLSearchParams();
  params.set(BILLING_CHECKOUT_TIER_QUERY_KEY, tierKey);

  const normalizedSource = asTrimmedString(source);
  if (normalizedSource) {
    params.set(BILLING_CHECKOUT_SOURCE_QUERY_KEY, normalizedSource.slice(0, 80));
  }

  const normalizedClaimId = asTrimmedString(claimId);
  if (normalizedClaimId) {
    params.set(BILLING_CHECKOUT_CLAIM_QUERY_KEY, normalizedClaimId.slice(0, 120));
  }

  const normalizedReturnTo = asTrimmedString(returnTo);
  if (isSafeInternalPath(normalizedReturnTo)) {
    params.set(BILLING_CHECKOUT_RETURN_QUERY_KEY, normalizedReturnTo);
  }

  const normalizedTripId = asTrimmedString(tripId);
  if (normalizedTripId) {
    params.set(BILLING_CHECKOUT_TRIP_QUERY_KEY, normalizedTripId.slice(0, 120));
  }

  const normalizedDiscountCode = asTrimmedString(discountCode);
  if (normalizedDiscountCode) {
    params.set(BILLING_CHECKOUT_DISCOUNT_QUERY_KEY, normalizedDiscountCode.slice(0, 80));
  }

  return `${buildPath('checkout')}?${params.toString()}`;
};

export const readBillingDiscountCodeFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return asTrimmedString(params.get(BILLING_CHECKOUT_DISCOUNT_QUERY_KEY))
    || asTrimmedString(params.get(BILLING_CHECKOUT_VOUCHER_QUERY_KEY));
};

const parseCheckoutResponse = (payload: unknown): PaddleCheckoutResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as PaddleCheckoutResponse;
};

const parseSubscriptionSummaryResponse = (payload: unknown): BillingSubscriptionSummaryResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingSubscriptionSummaryResponse;
};

const parseUpgradePreviewResponse = (payload: unknown): BillingUpgradePreviewResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingUpgradePreviewResponse;
};

const parseUpgradeChangeResponse = (payload: unknown): BillingUpgradeChangeResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingUpgradeChangeResponse;
};

const parseManagementResponse = (payload: unknown): BillingManagementResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingManagementResponse;
};

const parseTransactionSyncResponse = (payload: unknown): BillingTransactionSyncResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingTransactionSyncResponse;
};

const parseDiscountLookupResponse = (payload: unknown): BillingDiscountLookupResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingDiscountLookupResponse;
};

const parseSubscriptionRefreshResponse = (payload: unknown): BillingSubscriptionRefreshResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as BillingSubscriptionRefreshResponse;
};

const normalizeErrorMessage = (
  payload: PaddleCheckoutResponse,
  responseStatus: number,
  fallback: string,
): string => {
  const direct = typeof payload.error === 'string'
    ? payload.error.trim()
    : typeof payload.message === 'string'
      ? payload.message.trim()
      : '';
  if (direct) return direct;
  return `${fallback} (status ${responseStatus}).`;
};

export interface BillingApiError extends Error {
  code?: string;
  status?: number;
}

const buildBillingApiError = (
  payload: PaddleCheckoutResponse,
  responseStatus: number,
  fallback: string,
): BillingApiError => {
  const error = new Error(normalizeErrorMessage(payload, responseStatus, fallback)) as BillingApiError;
  error.code = typeof payload.code === 'string' ? payload.code : undefined;
  error.status = responseStatus;
  return error;
};

const parseJsonPayload = async (response: Response): Promise<PaddleCheckoutResponse> => {
  const responseText = await response.text().catch(() => '');
  if (!responseText) return {};
  try {
    return parseCheckoutResponse(JSON.parse(responseText));
  } catch {
    return {};
  }
};

const requireAuthenticatedBillingSession = async (): Promise<string> => {
  if (!DB_ENABLED) {
    throw new Error('Database session is not available. Billing actions require authenticated database mode.');
  }

  const userId = await ensureExistingDbSession();
  if (!userId) {
    throw new Error('No active user session found for billing request.');
  }

  const accessToken = await dbGetAccessToken();
  if (!accessToken) {
    throw new Error('Missing access token for billing request.');
  }

  return accessToken;
};

const postBillingJson = async <T>(
  path: string,
  body: Record<string, unknown>,
  parser: (payload: unknown) => T,
  fallbackMessage: string,
): Promise<{ response: Response; parsed: T }> => {
  const accessToken = await requireAuthenticatedBillingSession();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text().catch(() => '');
  let parsed = parser({});
  if (responseText) {
    try {
      parsed = parser(JSON.parse(responseText));
    } catch {
      parsed = parser({});
    }
  }

  if (!response.ok || (parsed as { ok?: boolean }).ok === false) {
    throw new Error(normalizeErrorMessage(parsed as PaddleCheckoutResponse, response.status, fallbackMessage));
  }

  return { response, parsed };
};

export const startPaddleCheckoutSession = async (
  payload: StartPaddleCheckoutPayload,
): Promise<PaddleCheckoutSession> => {
  const accessToken = await requireAuthenticatedBillingSession();
  const response = await fetch('/api/billing/paddle/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tierKey: payload.tierKey,
      source: payload.source || 'pricing_page',
      claimId: asTrimmedString(payload.claimId),
      returnTo: isSafeInternalPath(asTrimmedString(payload.returnTo)) ? asTrimmedString(payload.returnTo) : null,
      tripId: asTrimmedString(payload.tripId),
      discountCode: asTrimmedString(payload.discountCode),
    }),
  });

  const parsed = await parseJsonPayload(response);

  if (!response.ok || parsed.ok === false) {
    const devRoutingHint = response.status === 404 && import.meta.env.DEV
      ? ' Paddle checkout route is unavailable in Vite-only dev. Run `pnpm dev:netlify` to proxy `/api/billing/paddle/*`.'
      : '';
    const error = buildBillingApiError(parsed, response.status, 'Paddle checkout request failed');
    error.message = `${error.message}${devRoutingHint}`.trim();
    throw error;
  }

  const provider = parsed.data?.provider === 'paddle' ? 'paddle' : null;
  const environment = typeof parsed.data?.environment === 'string' ? parsed.data.environment : null;
  const transactionId = typeof parsed.data?.transactionId === 'string' ? parsed.data.transactionId : null;
  const checkoutUrl = typeof parsed.data?.checkoutUrl === 'string' ? parsed.data.checkoutUrl : null;
  const tierKey = parsed.data?.tierKey === 'tier_mid' || parsed.data?.tierKey === 'tier_premium'
    ? parsed.data.tierKey
    : null;

  if (!provider || !environment || !transactionId || !checkoutUrl || !tierKey) {
    throw new Error('Paddle checkout response did not contain a complete session payload.');
  }

  return {
    provider,
    environment,
    transactionId,
    checkoutUrl,
    tierKey,
  };
};

export const getCurrentSubscriptionSummary = async (): Promise<BillingSubscriptionSummary | null> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('get_current_user_subscription_summary');
  if (error) {
    throw new Error(error.message || 'Could not load current subscription summary.');
  }

  const row = Array.isArray(data) ? data[0] : data;
  const parsed = parseSubscriptionSummaryResponse({ ok: true, data: row });
  const summary = parsed.data;
  if (!summary?.user_id) return null;

  return {
    userId: summary.user_id,
    provider: summary.provider ?? null,
    providerCustomerId: summary.provider_customer_id ?? null,
    providerSubscriptionId: summary.provider_subscription_id ?? null,
    providerPriceId: summary.provider_price_id ?? null,
    providerProductId: summary.provider_product_id ?? null,
    providerStatus: summary.provider_status ?? null,
    status: summary.status ?? null,
    currentPeriodStart: summary.current_period_start ?? null,
    currentPeriodEnd: summary.current_period_end ?? null,
    cancelAt: summary.cancel_at ?? null,
    canceledAt: summary.canceled_at ?? null,
    graceEndsAt: summary.grace_ends_at ?? null,
    currency: summary.currency ?? null,
    amount: typeof summary.amount === 'number' ? summary.amount : null,
    lastEventId: summary.last_event_id ?? null,
    lastEventType: summary.last_event_type ?? null,
    lastEventAt: summary.last_event_at ?? null,
  };
};

export const refreshCurrentPaddleSubscription = async (): Promise<BillingSubscriptionRefreshResult> => {
  const { parsed } = await postBillingJson(
    '/api/billing/paddle/subscription-refresh',
    {},
    parseSubscriptionRefreshResponse,
    'Could not refresh Paddle subscription state',
  );

  const summaryPayload = parsed.data?.summary;
  const summary = summaryPayload?.user_id
    ? {
      userId: summaryPayload.user_id,
      provider: summaryPayload.provider ?? null,
      providerCustomerId: summaryPayload.provider_customer_id ?? null,
      providerSubscriptionId: summaryPayload.provider_subscription_id ?? null,
      providerPriceId: summaryPayload.provider_price_id ?? null,
      providerProductId: summaryPayload.provider_product_id ?? null,
      providerStatus: summaryPayload.provider_status ?? null,
      status: summaryPayload.status ?? null,
      currentPeriodStart: summaryPayload.current_period_start ?? null,
      currentPeriodEnd: summaryPayload.current_period_end ?? null,
      cancelAt: summaryPayload.cancel_at ?? null,
      canceledAt: summaryPayload.canceled_at ?? null,
      graceEndsAt: summaryPayload.grace_ends_at ?? null,
      currency: summaryPayload.currency ?? null,
      amount: typeof summaryPayload.amount === 'number' ? summaryPayload.amount : null,
      lastEventId: summaryPayload.last_event_id ?? null,
      lastEventType: summaryPayload.last_event_type ?? null,
      lastEventAt: summaryPayload.last_event_at ?? null,
    } satisfies BillingSubscriptionSummary
    : null;

  return {
    summary,
    localSync: parsed.data?.localSync
      ? {
        status: parsed.data.localSync.status || 'unknown',
        duplicate: parsed.data.localSync.duplicate === true,
        reason: parsed.data.localSync.reason ?? null,
      }
      : null,
  };
};

export const previewPaddleSubscriptionUpgrade = async (
  tierKey: BillingCheckoutTierKey,
): Promise<BillingUpgradePreview> => {
  const { parsed } = await postBillingJson(
    '/api/billing/paddle/subscription-preview',
    { tierKey },
    parseUpgradePreviewResponse,
    'Could not preview Paddle subscription upgrade',
  );

  const data = parsed.data;
  if (
    data?.mode !== 'upgrade'
    || (data.currentTierKey !== 'tier_mid' && data.currentTierKey !== 'tier_premium')
    || (data.targetTierKey !== 'tier_mid' && data.targetTierKey !== 'tier_premium')
    || typeof data.providerSubscriptionId !== 'string'
  ) {
    throw new Error('Paddle subscription preview returned an incomplete payload.');
  }

  return {
    mode: 'upgrade',
    currentTierKey: data.currentTierKey,
    targetTierKey: data.targetTierKey,
    providerSubscriptionId: data.providerSubscriptionId,
    providerStatus: data.providerStatus ?? null,
    currentAmount: typeof data.currentAmount === 'number' ? data.currentAmount : null,
    currentCurrency: data.currentCurrency ?? null,
    recurringAmount: typeof data.recurringAmount === 'number' ? data.recurringAmount : null,
    recurringCurrency: data.recurringCurrency ?? null,
    immediateAmount: typeof data.immediateAmount === 'number' ? data.immediateAmount : null,
    immediateCurrency: data.immediateCurrency ?? null,
    prorationMessage: data.prorationMessage ?? null,
  };
};

export const applyPaddleSubscriptionUpgrade = async (
  payload: StartPaddleCheckoutPayload,
): Promise<BillingUpgradeResult> => {
  const { parsed } = await postBillingJson(
    '/api/billing/paddle/subscription-change',
    {
      tierKey: payload.tierKey,
      source: payload.source || 'pricing_page',
      claimId: asTrimmedString(payload.claimId),
      returnTo: isSafeInternalPath(asTrimmedString(payload.returnTo)) ? asTrimmedString(payload.returnTo) : null,
      tripId: asTrimmedString(payload.tripId),
    },
    parseUpgradeChangeResponse,
    'Could not apply Paddle subscription upgrade',
  );

  const data = parsed.data;
  if (
    data?.mode !== 'upgrade_applied'
    || (data.currentTierKey !== 'tier_mid' && data.currentTierKey !== 'tier_premium')
    || (data.targetTierKey !== 'tier_mid' && data.targetTierKey !== 'tier_premium')
    || typeof data.providerSubscriptionId !== 'string'
  ) {
    throw new Error('Paddle subscription change returned an incomplete payload.');
  }

  return {
    mode: 'upgrade_applied',
    currentTierKey: data.currentTierKey,
    targetTierKey: data.targetTierKey,
    providerSubscriptionId: data.providerSubscriptionId,
    providerStatus: data.providerStatus ?? null,
    recurringAmount: typeof data.recurringAmount === 'number' ? data.recurringAmount : null,
    recurringCurrency: data.recurringCurrency ?? null,
    localSync: data.localSync
      ? {
        status: data.localSync.status || 'unknown',
        duplicate: data.localSync.duplicate === true,
        reason: data.localSync.reason ?? null,
      }
      : null,
  };
};

export const getPaddleSubscriptionManagementUrls = async (): Promise<PaddleSubscriptionManagementUrls> => {
  const { parsed } = await postBillingJson(
    '/api/billing/paddle/subscription-manage',
    {},
    parseManagementResponse,
    'Could not load Paddle billing management URLs',
  );

  const data = parsed.data;
  return {
    provider: 'paddle',
    providerSubscriptionId: data?.providerSubscriptionId ?? null,
    cancelUrl: data?.cancelUrl ?? null,
    updatePaymentMethodUrl: data?.updatePaymentMethodUrl ?? null,
    providerStatus: data?.providerStatus ?? null,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    cancelAt: data?.cancelAt ?? null,
    canceledAt: data?.canceledAt ?? null,
    graceEndsAt: data?.graceEndsAt ?? null,
  };
};

export const syncPaddleTransaction = async (transactionId: string): Promise<BillingTransactionSyncResult> => {
  const { parsed } = await postBillingJson(
    '/api/billing/paddle/transaction-sync',
    { transactionId: asTrimmedString(transactionId) },
    parseTransactionSyncResponse,
    'Could not sync Paddle transaction',
  );

  const data = parsed.data;
  if (data?.provider !== 'paddle' || typeof data.transactionId !== 'string') {
    throw new Error('Paddle transaction sync returned an incomplete payload.');
  }

  return {
    provider: 'paddle',
    transactionId: data.transactionId,
    providerSubscriptionId: data.providerSubscriptionId ?? null,
    providerStatus: data.providerStatus ?? null,
    localSync: data.localSync
      ? {
        status: data.localSync.status || 'unknown',
        duplicate: data.localSync.duplicate === true,
        reason: data.localSync.reason ?? null,
      }
      : null,
  };
};

export const lookupPaddleDiscount = async (
  code: string,
  tierKey: BillingCheckoutTierKey,
): Promise<BillingDiscountLookup> => {
  const normalizedCode = asTrimmedString(code);
  if (!normalizedCode) {
    throw new Error('A voucher code is required.');
  }

  const response = await fetch(
    `/api/billing/paddle/discount-lookup?code=${encodeURIComponent(normalizedCode)}&tier=${encodeURIComponent(tierKey)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
  const responseText = await response.text().catch(() => '');
  let parsed = parseDiscountLookupResponse({});
  if (responseText) {
    try {
      parsed = parseDiscountLookupResponse(JSON.parse(responseText));
    } catch {
      parsed = parseDiscountLookupResponse({});
    }
  }

  if (!response.ok || parsed.ok === false) {
    throw new Error(normalizeErrorMessage(parsed as PaddleCheckoutResponse, response.status, 'Could not validate Paddle voucher'));
  }

  const data = parsed.data;
  if (!data?.code) {
    throw new Error('Paddle voucher lookup returned an incomplete payload.');
  }

  return {
    code: data.code,
    type: data.type ?? null,
    amount: typeof data.amount === 'number' ? data.amount : null,
    currencyCode: data.currencyCode ?? null,
    description: data.description ?? null,
    appliesToAllRecurring: data.appliesToAllRecurring === true,
    maximumRecurringIntervals: typeof data.maximumRecurringIntervals === 'number' ? data.maximumRecurringIntervals : null,
    applicableToTier: data.applicableToTier !== false,
    estimate: data.estimate
      ? {
        originalAmount: typeof data.estimate.originalAmount === 'number' ? data.estimate.originalAmount : null,
        discountedAmount: typeof data.estimate.discountedAmount === 'number' ? data.estimate.discountedAmount : null,
        savingsAmount: typeof data.estimate.savingsAmount === 'number' ? data.estimate.savingsAmount : null,
        currencyCode: data.estimate.currencyCode ?? null,
      }
      : null,
  };
};
