import { normalizePaddleEnvironment, readPaddlePriceMapFromEnv } from '../edge-lib/paddle-billing.ts';
import { pickBestFallbackSubscription } from '../edge-lib/paddle-subscription-resolution.ts';
import {
  extractServiceError as extractSyncServiceError,
  getSupabaseServiceConfig,
  processPaddleBillingEvent,
  safeJsonParse as safeSyncJsonParse,
} from '../edge-lib/paddle-webhook-sync.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const AUTH_HEADER = 'authorization';
const PADDLE_API_BASE_URL_LIVE = 'https://api.paddle.com';
const PADDLE_API_BASE_URL_SANDBOX = 'https://sandbox-api.paddle.com';
const DEFAULT_MAX_SUBSCRIPTIONS = 200;
const MAX_SUBSCRIPTIONS = 1000;
const RECONCILE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled']);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_PADDLE_API_ATTEMPTS = 5;

interface AdminReconcileRequestBody {
  maxSubscriptions?: number | null;
  subscriptionId?: string | null;
}

interface PaddleListResponse<T> {
  data?: T[];
  meta?: {
    pagination?: {
      next?: string | null;
      has_more?: boolean;
    };
  };
}

interface PaddleSubscriptionItem {
  price?: {
    id?: string | null;
  } | null;
  price_id?: string | null;
}

interface PaddleSubscription {
  id?: string;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  canceled_at?: string | null;
  customer_id?: string | null;
  custom_data?: Record<string, unknown> | null;
  items?: PaddleSubscriptionItem[] | null;
  [key: string]: unknown;
}

interface ReconcileInvocationResult {
  processed: boolean;
  ignored: boolean;
  duplicate: boolean;
  failed: boolean;
  userId: string | null;
  message: string;
  statusCode: number;
}

interface ReconcileSummary {
  fetched: number;
  eligible: number;
  processed: number;
  ignored: number;
  duplicates: number;
  failed: number;
  resolvedUsers: number;
  unresolved: number;
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

const safeJsonParse = safeSyncJsonParse;

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown runtime error.';
};

const extractServiceError = (payload: unknown, fallback: string): string => {
  const syncMessage = extractSyncServiceError(payload, '');
  if (syncMessage) return syncMessage;
  if (payload && typeof payload === 'object') {
    const typed = payload as Record<string, unknown>;
    if (typeof typed.error_description === 'string' && typed.error_description.trim()) return typed.error_description.trim();
  }
  return fallback;
};

const extractBooleanRpcResult = (payload: unknown): boolean | null => {
  if (typeof payload === 'boolean') return payload;
  if (Array.isArray(payload) && payload.length > 0) {
    if (typeof payload[0] === 'boolean') return payload[0];
    if (payload[0] && typeof payload[0] === 'object') {
      const firstValue = Object.values(payload[0] as Record<string, unknown>)[0];
      return typeof firstValue === 'boolean' ? firstValue : null;
    }
  }
  if (payload && typeof payload === 'object') {
    const firstValue = Object.values(payload as Record<string, unknown>)[0];
    return typeof firstValue === 'boolean' ? firstValue : null;
  }
  return null;
};

const getAuthToken = (request: Request): string | null => {
  const raw = request.headers.get(AUTH_HEADER) || '';
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

const getSupabaseConfig = () => {
  const url = readEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

const buildAnonHeaders = (authToken: string, anonKey: string) => ({
  'Content-Type': 'application/json',
  apikey: anonKey,
  Authorization: `Bearer ${authToken}`,
});

const supabaseFetch = async (
  config: { url: string; anonKey: string },
  authToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> => {
  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...buildAnonHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const hasAdminPermission = async (
  config: { url: string; anonKey: string },
  authToken: string,
  permission: string,
): Promise<{ allowed: boolean; errorMessage?: string }> => {
  const response = await supabaseFetch(config, authToken, '/rest/v1/rpc/has_admin_permission', {
    method: 'POST',
    headers: {
      Prefer: 'params=single-object',
    },
    body: JSON.stringify({ p_permission: permission }),
  });

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    return {
      allowed: false,
      errorMessage: extractServiceError(payload, `Permission check failed (${response.status}).`),
    };
  }

  const payload = await safeJsonParse(response);
  const result = extractBooleanRpcResult(payload);
  return { allowed: result !== false };
};

const authorizeAdminRequest = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<{ ok: true; actorUserId: string } | { ok: false; response: Response }> => {
  const accessResponse = await supabaseFetch(config, authToken, '/rest/v1/rpc/get_current_user_access', {
    method: 'POST',
    headers: {
      Prefer: 'params=single-object',
    },
    body: '{}',
  });

  if (!accessResponse.ok) {
    const payload = await safeJsonParse(accessResponse);
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: extractServiceError(payload, 'Admin role verification failed.'),
      }),
    };
  }

  const accessPayload = await safeJsonParse(accessResponse);
  const accessRow = Array.isArray(accessPayload) ? accessPayload[0] : accessPayload;
  if (!accessRow || typeof accessRow !== 'object' || (accessRow as Record<string, unknown>).system_role !== 'admin') {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: 'Admin role required.',
      }),
    };
  }

  const actorUserId = typeof (accessRow as Record<string, unknown>).user_id === 'string'
    ? ((accessRow as Record<string, unknown>).user_id as string)
    : '';
  if (!actorUserId) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: 'Admin user ID is missing.',
      }),
    };
  }

  const writePermission = await hasAdminPermission(config, authToken, 'billing.write');
  if (writePermission.allowed) {
    return { ok: true, actorUserId };
  }

  const fallbackPermission = await hasAdminPermission(config, authToken, 'billing.read');
  if (fallbackPermission.allowed) {
    return { ok: true, actorUserId };
  }

  return {
    ok: false,
    response: json(403, {
      ok: false,
      error: writePermission.errorMessage || fallbackPermission.errorMessage || 'Missing billing admin permission.',
    }),
  };
};

const getPaddleApiConfig = () => {
  const apiKey = readEnv('PADDLE_API_KEY').trim();
  if (!apiKey) return null;
  return {
    apiKey,
    environment: normalizePaddleEnvironment(readEnv('PADDLE_ENV')),
    priceMap: readPaddlePriceMapFromEnv(readEnv),
  };
};

const resolvePaddleApiBaseUrl = (environment: string): string => (
  environment === 'sandbox'
    ? PADDLE_API_BASE_URL_SANDBOX
    : PADDLE_API_BASE_URL_LIVE
);

const normalizeMaxSubscriptions = (value: unknown): number => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_SUBSCRIPTIONS;
  return Math.max(1, Math.min(MAX_SUBSCRIPTIONS, Math.trunc(parsed)));
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const asIsoString = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
};

const normalizeSubscriptionId = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return normalized.slice(0, 120);
};

const getConfiguredPriceIds = (config: { priceMap: { tier_mid: string | null; tier_premium: string | null } }): string[] => {
  const ids = [config.priceMap.tier_mid, config.priceMap.tier_premium].filter((value): value is string => Boolean(value));
  return Array.from(new Set(ids));
};

const getSubscriptionPriceIds = (subscription: PaddleSubscription): string[] => {
  const items = Array.isArray(subscription.items) ? subscription.items : [];
  return items
    .map((item) => asTrimmedString(item?.price?.id) || asTrimmedString(item?.price_id))
    .filter((value): value is string => Boolean(value));
};

const isEligibleSubscription = (subscription: PaddleSubscription, configuredPriceIds: Set<string>): boolean => {
  const status = (asTrimmedString(subscription.status) || '').toLowerCase();
  if (!RECONCILE_STATUSES.has(status)) return false;
  const priceIds = getSubscriptionPriceIds(subscription);
  return priceIds.some((priceId) => configuredPriceIds.has(priceId));
};

const resolveReconcileGroupKey = (subscription: PaddleSubscription): string => {
  const customData = subscription.custom_data && typeof subscription.custom_data === 'object'
    ? subscription.custom_data as Record<string, unknown>
    : null;
  const tfUserId = asTrimmedString(customData?.tf_user_id);
  if (tfUserId) {
    return `user:${tfUserId}`;
  }

  const customerId = asTrimmedString(subscription.customer_id);
  if (customerId) {
    return `customer:${customerId}`;
  }

  return `subscription:${asTrimmedString(subscription.id) || 'unknown'}`;
};

const collapseSubscriptionsForReconcile = (
  subscriptions: PaddleSubscription[],
  priceMap: { tier_mid: string | null; tier_premium: string | null },
): PaddleSubscription[] => {
  const grouped = new Map<string, PaddleSubscription[]>();
  for (const subscription of subscriptions) {
    const key = resolveReconcileGroupKey(subscription);
    const current = grouped.get(key) || [];
    current.push(subscription);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((group) => (pickBestFallbackSubscription(group, priceMap) as PaddleSubscription | null) || group[0])
    .filter((subscription): subscription is PaddleSubscription => Boolean(subscription));
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

const buildSyntheticEventId = (subscription: PaddleSubscription): string => {
  const subscriptionId = asTrimmedString(subscription.id) || 'unknown';
  const updatedAt = asIsoString(subscription.updated_at) || asIsoString(subscription.canceled_at) || asIsoString(subscription.created_at) || 'unknown';
  const status = (asTrimmedString(subscription.status) || 'unknown').toLowerCase();
  const normalizedUpdatedAt = updatedAt.replace(/[^a-z0-9]+/gi, '');
  return `reconcile__${subscriptionId}__${status}__${normalizedUpdatedAt}`.slice(0, 180);
};

const buildSyntheticEnvelope = (subscription: PaddleSubscription): { rawBody: string; eventId: string } => {
  const occurredAt = asIsoString(subscription.updated_at)
    || asIsoString(subscription.canceled_at)
    || asIsoString(subscription.created_at)
    || new Date().toISOString();
  const eventId = buildSyntheticEventId(subscription);
  return {
    eventId,
    rawBody: JSON.stringify({
      event_id: eventId,
      event_type: buildSyntheticEventType(asTrimmedString(subscription.status)),
      occurred_at: occurredAt,
      data: subscription,
    }),
  };
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (response: Response): number | null => {
  const raw = response.headers.get('retry-after')?.trim();
  if (!raw) return null;

  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(raw);
  if (!Number.isFinite(retryAt)) return null;
  const waitMs = retryAt - Date.now();
  return waitMs > 0 ? waitMs : null;
};

const fetchPaddleJson = async (
  url: string,
  apiKey: string,
): Promise<{ response: Response; payload: unknown }> => {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const payload = await safeJsonParse(response);

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= MAX_PADDLE_API_ATTEMPTS - 1) {
      return { response, payload };
    }

    const waitMs = parseRetryAfterMs(response) ?? (1200 * (attempt + 1));
    await sleep(waitMs);
    attempt += 1;
  }
};

const invokeWebhookSync = async (
  serviceConfig: { url: string; serviceRoleKey: string },
  rawBody: string,
): Promise<ReconcileInvocationResult> => {
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {
      processed: false,
      ignored: false,
      duplicate: false,
      failed: true,
      userId: null,
      message: 'Synthetic reconcile payload was not valid JSON.',
      statusCode: 400,
    };
  }

  try {
    const result = await processPaddleBillingEvent(serviceConfig, {
      eventId: typeof payload.event_id === 'string' ? payload.event_id : 'reconcile_unknown',
      eventType: typeof payload.event_type === 'string' ? payload.event_type : 'subscription.updated',
      occurredAtIso: typeof payload.occurred_at === 'string' ? payload.occurred_at : new Date().toISOString(),
      eventData: payload.data,
      rawEventPayload: payload,
    });

    return {
      processed: result.status === 'processed',
      ignored: result.status === 'ignored',
      duplicate: result.duplicate,
      failed: false,
      userId: result.userId,
      message: result.reason,
      statusCode: 200,
    };
  } catch (error) {
    return {
      processed: false,
      ignored: false,
      duplicate: false,
      failed: true,
      userId: null,
      message: toErrorMessage(error),
      statusCode: 500,
    };
  }
};

const listPaddleSubscriptions = async (
  apiKey: string,
  baseUrl: string,
  maxSubscriptions: number,
): Promise<PaddleSubscription[]> => {
  const rows: PaddleSubscription[] = [];
  let nextUrl: string | null = `${baseUrl}/subscriptions?per_page=${Math.min(maxSubscriptions, 200)}`;

  while (nextUrl && rows.length < maxSubscriptions) {
    const { response, payload } = await fetchPaddleJson(nextUrl, apiKey);
    const typedPayload = payload as PaddleListResponse<PaddleSubscription> | null;
    if (!response.ok) {
      const fallback = response.status === 429
        ? 'Could not list Paddle subscriptions (429). Paddle rate limited the broad reconcile. Retry shortly or reconcile a specific sub_... ID instead.'
        : `Could not list Paddle subscriptions (${response.status}).`;
      throw new Error(extractServiceError(typedPayload, fallback));
    }

    const pageRows = Array.isArray(typedPayload?.data) ? typedPayload!.data! : [];
    rows.push(...pageRows);

    if (rows.length >= maxSubscriptions) break;

    const candidate = typeof typedPayload?.meta?.pagination?.next === 'string'
      ? typedPayload.meta.pagination.next.trim()
      : '';
    nextUrl = candidate || null;
  }

  return rows.slice(0, maxSubscriptions);
};

const getPaddleSubscription = async (
  apiKey: string,
  baseUrl: string,
  subscriptionId: string,
): Promise<PaddleSubscription> => {
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
    apiKey,
  );
  const typedPayload = payload as { data?: PaddleSubscription | null } | null;

  if (!response.ok) {
    const fallback = response.status === 429
      ? `Could not load Paddle subscription ${subscriptionId} (429). Paddle rate limited the targeted reconcile. Retry shortly.`
      : `Could not load Paddle subscription ${subscriptionId} (${response.status}).`;
    throw new Error(extractServiceError(typedPayload, fallback));
  }

  const row = typedPayload?.data;
  if (!row || typeof row !== 'object') {
    throw new Error(`Paddle subscription ${subscriptionId} returned no data.`);
  }

  return row;
};

const writeAuditLog = async (
  config: { url: string; anonKey: string },
  authToken: string,
  summary: ReconcileSummary,
): Promise<void> => {
  await supabaseFetch(config, authToken, '/rest/v1/rpc/admin_write_audit', {
    method: 'POST',
    headers: {
      Prefer: 'params=single-object',
    },
    body: JSON.stringify({
      p_action: 'admin.billing.reconcile_paddle',
      p_target_type: 'billing',
      p_target_id: 'paddle',
      p_before_data: null,
      p_after_data: summary,
      p_metadata: {
        via: 'admin-billing-paddle-reconcile-edge',
      },
    }),
  });
};

export const __adminBillingPaddleReconcileInternals = {
  normalizeMaxSubscriptions,
  normalizeSubscriptionId,
  buildSyntheticEventId,
  buildSyntheticEventType,
  buildSyntheticEnvelope,
  isEligibleSubscription,
  collapseSubscriptionsForReconcile,
  getSubscriptionPriceIds,
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, { ok: false, error: 'Missing bearer token.' });
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    return json(500, { ok: false, error: 'Supabase environment variables are not configured.' });
  }

  const authorization = await authorizeAdminRequest(supabaseConfig, authToken);
  if ('response' in authorization) {
    return authorization.response;
  }

  let body: AdminReconcileRequestBody;
  try {
    body = (await request.json()) as AdminReconcileRequestBody;
  } catch {
    body = {};
  }

  const paddleConfig = getPaddleApiConfig();
  if (!paddleConfig) {
    return json(500, { ok: false, error: 'Paddle API key is not configured.' });
  }

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return json(500, { ok: false, error: 'Supabase service role configuration missing.' });
  }

  const configuredPriceIds = getConfiguredPriceIds(paddleConfig);
  if (configuredPriceIds.length === 0) {
    return json(500, { ok: false, error: 'No Paddle price IDs are configured for paid tiers.' });
  }

  try {
    const maxSubscriptions = normalizeMaxSubscriptions(body?.maxSubscriptions);
    const subscriptionId = normalizeSubscriptionId(body?.subscriptionId);
    const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
    const configuredPriceIdSet = new Set(configuredPriceIds);
    const subscriptions = subscriptionId
      ? [await getPaddleSubscription(paddleConfig.apiKey, baseUrl, subscriptionId)]
      : await listPaddleSubscriptions(
          paddleConfig.apiKey,
          baseUrl,
          maxSubscriptions,
        );

    const eligibleSubscriptions = subscriptionId
      ? subscriptions
      : collapseSubscriptionsForReconcile(
          subscriptions.filter((subscription) => isEligibleSubscription(subscription, configuredPriceIdSet)),
          paddleConfig.priceMap,
        );

    const summary: ReconcileSummary = {
      fetched: subscriptions.length,
      eligible: eligibleSubscriptions.length,
      processed: 0,
      ignored: 0,
      duplicates: 0,
      failed: 0,
      resolvedUsers: 0,
      unresolved: 0,
    };

    const results: Array<{ subscriptionId: string | null; eventId: string; message: string; statusCode: number }> = [];

    for (const subscription of eligibleSubscriptions) {
      const { rawBody, eventId } = buildSyntheticEnvelope(subscription);
      const invocation = await invokeWebhookSync(serviceConfig, rawBody);
      if (invocation.processed) summary.processed += 1;
      if (invocation.ignored) summary.ignored += 1;
      if (invocation.duplicate) summary.duplicates += 1;
      if (invocation.failed) summary.failed += 1;
      if (invocation.userId) summary.resolvedUsers += 1;
      if (!invocation.userId) summary.unresolved += 1;
      results.push({
        subscriptionId: asTrimmedString(subscription.id),
        eventId,
        message: invocation.message,
        statusCode: invocation.statusCode,
      });
    }

    await writeAuditLog(supabaseConfig, authToken, summary);

    return json(200, {
      ok: true,
      data: {
        summary,
        results: results.slice(0, 25),
      },
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: toErrorMessage(error),
    });
  }
};
