import { computePaddleSignature, normalizePaddleEnvironment, readPaddlePriceMapFromEnv } from '../edge-lib/paddle-billing.ts';
import paddleWebhookHandler from './paddle-webhook.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const AUTH_HEADER = 'authorization';
const PADDLE_SIGNATURE_HEADER = 'Paddle-Signature';
const PADDLE_API_BASE_URL_LIVE = 'https://api.paddle.com';
const PADDLE_API_BASE_URL_SANDBOX = 'https://sandbox-api.paddle.com';
const DEFAULT_MAX_SUBSCRIPTIONS = 200;
const MAX_SUBSCRIPTIONS = 1000;
const RECONCILE_STATUSES = new Set(['active', 'trialing', 'past_due', 'paused', 'canceled']);

interface AdminReconcileRequestBody {
  maxSubscriptions?: number | null;
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

const safeJsonParse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown runtime error.';
};

const extractServiceError = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === 'object') {
    const typed = payload as Record<string, unknown>;
    if (typeof typed.message === 'string' && typed.message.trim()) return typed.message.trim();
    if (typeof typed.error_description === 'string' && typed.error_description.trim()) return typed.error_description.trim();
    if (typeof typed.error === 'string' && typed.error.trim()) return typed.error.trim();
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
  const webhookSecret = readEnv('PADDLE_WEBHOOK_SECRET').trim();
  if (!apiKey || !webhookSecret) return null;
  return {
    apiKey,
    webhookSecret,
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

const invokeWebhookSync = async (
  webhookSecret: string,
  rawBody: string,
): Promise<ReconcileInvocationResult> => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await computePaddleSignature(webhookSecret, timestamp, rawBody);
  const request = new Request('https://internal.travelflow/api/billing/paddle/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [PADDLE_SIGNATURE_HEADER]: `ts=${timestamp};h1=${signature}`,
    },
    body: rawBody,
  });

  const response = await paddleWebhookHandler(request);
  const payload = await safeJsonParse(response) as Record<string, unknown> | null;
  const message = typeof payload?.reason === 'string'
    ? payload.reason
    : typeof payload?.error === 'string'
      ? payload.error
      : response.ok
        ? 'Processed.'
        : `Webhook sync failed (${response.status}).`;
  const userId = typeof payload?.userId === 'string' ? payload.userId : null;
  return {
    processed: payload?.status === 'processed',
    ignored: payload?.status === 'ignored',
    duplicate: payload?.duplicate === true,
    failed: !response.ok || payload?.status === 'failed',
    userId,
    message,
    statusCode: response.status,
  };
};

const listPaddleSubscriptions = async (
  apiKey: string,
  baseUrl: string,
  maxSubscriptions: number,
): Promise<PaddleSubscription[]> => {
  const rows: PaddleSubscription[] = [];
  let nextUrl: string | null = `${baseUrl}/subscriptions?per_page=${Math.min(maxSubscriptions, 200)}`;

  while (nextUrl && rows.length < maxSubscriptions) {
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const payload = await safeJsonParse(response) as PaddleListResponse<PaddleSubscription> | null;
    if (!response.ok) {
      throw new Error(extractServiceError(payload, `Could not list Paddle subscriptions (${response.status}).`));
    }

    const pageRows = Array.isArray(payload?.data) ? payload!.data! : [];
    rows.push(...pageRows);

    if (rows.length >= maxSubscriptions) break;

    const candidate = typeof payload?.meta?.pagination?.next === 'string'
      ? payload.meta.pagination.next.trim()
      : '';
    nextUrl = candidate || null;
  }

  return rows.slice(0, maxSubscriptions);
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
  buildSyntheticEventId,
  buildSyntheticEventType,
  buildSyntheticEnvelope,
  isEligibleSubscription,
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
  if (!authorization.ok) {
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
    return json(500, { ok: false, error: 'Paddle API key or webhook secret is not configured.' });
  }

  const configuredPriceIds = getConfiguredPriceIds(paddleConfig);
  if (configuredPriceIds.length === 0) {
    return json(500, { ok: false, error: 'No Paddle price IDs are configured for paid tiers.' });
  }

  try {
    const maxSubscriptions = normalizeMaxSubscriptions(body?.maxSubscriptions);
    const subscriptions = await listPaddleSubscriptions(
      paddleConfig.apiKey,
      resolvePaddleApiBaseUrl(paddleConfig.environment),
      maxSubscriptions,
    );

    const eligibleSubscriptions = subscriptions.filter((subscription) => isEligibleSubscription(subscription, new Set(configuredPriceIds)));

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
      const invocation = await invokeWebhookSync(paddleConfig.webhookSecret, rawBody);
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
