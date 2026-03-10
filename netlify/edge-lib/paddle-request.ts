import type { PlanTierKey } from '../../types';
import { normalizePaddleEnvironment, readPaddlePriceMapFromEnv, type PaddleEnvironment, type PaddlePriceMap } from './paddle-billing.ts';
import { extractServiceError, safeJsonParse } from './paddle-webhook-sync.ts';

export const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const AUTH_HEADER = 'authorization';
const PADDLE_API_BASE_URL_LIVE = 'https://api.paddle.com';
const PADDLE_API_BASE_URL_SANDBOX = 'https://sandbox-api.paddle.com';

export interface SupabaseAnonConfig {
  url: string;
  anonKey: string;
}

export interface AuthenticatedBillingUser {
  userId: string;
  email: string | null;
  tierKey: PlanTierKey;
  isAnonymous: boolean;
  systemRole: string;
  termsAcceptanceRequired: boolean;
}

export interface CurrentUserSubscriptionSummary {
  user_id: string;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_price_id: string | null;
  provider_product_id: string | null;
  provider_status: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  grace_ends_at: string | null;
  currency: string | null;
  amount: number | null;
  last_event_id: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
}

export interface PaddleApiConfig {
  apiKey: string;
  environment: PaddleEnvironment;
  priceMap: PaddlePriceMap;
  checkoutDomain: string;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_PADDLE_API_ATTEMPTS = 3;

export const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || '';
  } catch {
    return '';
  }
};

export const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });

export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

export const normalizeReturnPath = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return null;
  return normalized.slice(0, 300);
};

export const getAuthToken = (request: Request): string | null => {
  const headerValue = request.headers.get(AUTH_HEADER) || '';
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
};

export const getSupabaseAnonConfig = (): SupabaseAnonConfig | null => {
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

export const supabaseFetch = async (
  config: SupabaseAnonConfig,
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

export const authorizeBillingUser = async (
  config: SupabaseAnonConfig,
  authToken: string,
): Promise<{ ok: true; user: AuthenticatedBillingUser } | { ok: false; response: Response }> => {
  const accessResponse = await supabaseFetch(
    config,
    authToken,
    '/rest/v1/rpc/get_current_user_access',
    {
      method: 'POST',
      headers: {
        Prefer: 'params=single-object',
      },
      body: '{}',
    },
  );

  if (!accessResponse.ok) {
    const payload = await safeJsonParse(accessResponse);
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: extractServiceError(payload, 'Could not validate user session.'),
      }),
    };
  }

  const payload = await safeJsonParse(accessResponse);
  const row = Array.isArray(payload) ? payload[0] : payload;
  const userId = typeof row?.user_id === 'string' ? row.user_id : '';
  const isAnonymous = row?.is_anonymous === true;
  if (!userId || isAnonymous) {
    return {
      ok: false,
      response: json(403, {
        ok: false,
        error: 'Authenticated non-anonymous user session is required.',
      }),
    };
  }

  const tierKey: PlanTierKey = row?.tier_key === 'tier_premium'
    ? 'tier_premium'
    : row?.tier_key === 'tier_mid'
      ? 'tier_mid'
      : 'tier_free';

  return {
    ok: true,
    user: {
      userId,
      email: typeof row?.email === 'string' && row.email.trim() ? row.email.trim() : null,
      tierKey,
      isAnonymous,
      systemRole: typeof row?.system_role === 'string' ? row.system_role : 'user',
      termsAcceptanceRequired: row?.terms_acceptance_required === true,
    },
  };
};

export const getCurrentUserSubscriptionSummary = async (
  config: SupabaseAnonConfig,
  authToken: string,
): Promise<CurrentUserSubscriptionSummary | null> => {
  const response = await supabaseFetch(
    config,
    authToken,
    '/rest/v1/rpc/get_current_user_subscription_summary',
    {
      method: 'POST',
      headers: {
        Prefer: 'params=single-object',
      },
      body: '{}',
    },
  );

  if (!response.ok) {
    const payload = await safeJsonParse(response);
    throw new Error(extractServiceError(payload, 'Could not load current subscription summary.'));
  }

  const payload = await safeJsonParse(response);
  const row = Array.isArray(payload) ? payload[0] : payload;
  return row ? (row as CurrentUserSubscriptionSummary) : null;
};

export const getPaddleApiConfig = (): PaddleApiConfig | null => {
  const apiKey = readEnv('PADDLE_API_KEY').trim();
  if (!apiKey) return null;
  return {
    apiKey,
    environment: normalizePaddleEnvironment(readEnv('PADDLE_ENV')),
    priceMap: readPaddlePriceMapFromEnv(readEnv),
    checkoutDomain: readEnv('PADDLE_CHECKOUT_DOMAIN').trim(),
  };
};

export const resolvePaddleApiBaseUrl = (environment: string): string => (
  environment === 'sandbox'
    ? PADDLE_API_BASE_URL_SANDBOX
    : PADDLE_API_BASE_URL_LIVE
);

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

export const fetchPaddleJson = async (
  url: string,
  apiKey: string,
  init?: RequestInit,
): Promise<{ response: Response; payload: unknown }> => {
  let attempt = 0;

  while (true) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init?.headers || {}),
      },
    });
    const payload = await safeJsonParse(response);

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= MAX_PADDLE_API_ATTEMPTS - 1) {
      return { response, payload };
    }

    const waitMs = parseRetryAfterMs(response) ?? (700 * (attempt + 1));
    await sleep(waitMs);
    attempt += 1;
  }
};
