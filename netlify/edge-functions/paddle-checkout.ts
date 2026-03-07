import type { PlanTierKey } from '../../types';
import {
  collectPaddleEnvironmentIssues,
  normalizePaddleEnvironment,
  readPaddlePriceMapFromEnv,
  resolvePriceIdForTier,
} from '../edge-lib/paddle-billing.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const AUTH_HEADER = 'authorization';
const PADDLE_API_BASE_URL_LIVE = 'https://api.paddle.com';
const PADDLE_API_BASE_URL_SANDBOX = 'https://sandbox-api.paddle.com';

type CheckoutTierKey = Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;

interface PaddleCheckoutRequestBody {
  tierKey?: string;
  source?: string | null;
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

const safeJsonParse = async (source: { text: () => Promise<string> }): Promise<any> => {
  const text = await source.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getAuthToken = (request: Request): string | null => {
  const headerValue = request.headers.get(AUTH_HEADER) || '';
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
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

const getPaddleApiConfig = () => {
  const apiKey = readEnv('PADDLE_API_KEY').trim();
  if (!apiKey) return null;
  return {
    apiKey,
    environment: normalizePaddleEnvironment(readEnv('PADDLE_ENV')),
    priceMap: readPaddlePriceMapFromEnv(readEnv),
    checkoutDomain: readEnv('PADDLE_CHECKOUT_DOMAIN').trim(),
  };
};

const resolvePaddleApiBaseUrl = (environment: string): string => (
  environment === 'sandbox'
    ? PADDLE_API_BASE_URL_SANDBOX
    : PADDLE_API_BASE_URL_LIVE
);

const buildSupabaseHeaders = (authToken: string, anonKey: string) => ({
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
      ...buildSupabaseHeaders(authToken, config.anonKey),
      ...(init.headers || {}),
    },
  });
};

const extractServiceError = (payload: any, fallback: string): string => {
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
    if (payload.error && typeof payload.error === 'object') {
      if (typeof payload.error.detail === 'string' && payload.error.detail.trim()) return payload.error.detail.trim();
      if (typeof payload.error.message === 'string' && payload.error.message.trim()) return payload.error.message.trim();
    }
  }
  return fallback;
};

const authorizeCheckoutRequest = async (
  config: { url: string; anonKey: string },
  authToken: string,
): Promise<{ ok: true; userId: string; email: string | null } | { ok: false; response: Response }> => {
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

  return {
    ok: true,
    userId,
    email: typeof row?.email === 'string' && row.email.trim() ? row.email.trim() : null,
  };
};

const parseCheckoutTierKey = (value: unknown): CheckoutTierKey | null => {
  if (value === 'tier_mid') return 'tier_mid';
  if (value === 'tier_premium') return 'tier_premium';
  return null;
};

const normalizeCheckoutSource = (value: unknown): string => {
  if (typeof value !== 'string') return 'pricing_page';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'pricing_page';
  return normalized.slice(0, 80);
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

  let body: PaddleCheckoutRequestBody;
  try {
    body = (await request.json()) as PaddleCheckoutRequestBody;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body.' });
  }

  const tierKey = parseCheckoutTierKey(body?.tierKey);
  if (!tierKey) {
    return json(400, {
      ok: false,
      error: 'A supported paid tier key is required.',
    });
  }

  const priceId = resolvePriceIdForTier(tierKey, paddleConfig.priceMap);
  if (!priceId) {
    return json(400, {
      ok: false,
      error: `No Paddle price ID configured for ${tierKey}.`,
    });
  }

  const authorization = await authorizeCheckoutRequest(supabaseConfig, authToken);
  if (!authorization.ok) {
    return authorization.response;
  }

  const source = normalizeCheckoutSource(body?.source);

  const transactionPayload: Record<string, unknown> = {
    items: [{ price_id: priceId, quantity: 1 }],
    collection_mode: 'automatic',
    custom_data: {
      tf_user_id: authorization.userId,
      tf_tier_key: tierKey,
      tf_source: source,
    },
  };

  if (paddleConfig.checkoutDomain) {
    transactionPayload.checkout = {
      url: paddleConfig.checkoutDomain,
    };
  }

  const paddleResponse = await fetch(`${resolvePaddleApiBaseUrl(paddleConfig.environment)}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${paddleConfig.apiKey}`,
    },
    body: JSON.stringify(transactionPayload),
  });

  const paddlePayload = await safeJsonParse(paddleResponse);
  if (!paddleResponse.ok) {
    const forbiddenMessage = paddleResponse.status === 403
      ? ' Confirm the API key belongs to the same Paddle environment as PADDLE_ENV and can create transactions.'
      : '';
    return json(502, {
      ok: false,
      error: `${extractServiceError(paddlePayload, `Paddle transaction creation failed (${paddleResponse.status}).`)}${forbiddenMessage}`.trim(),
    });
  }

  const transactionId = typeof paddlePayload?.data?.id === 'string' ? paddlePayload.data.id : null;
  const checkoutUrl = typeof paddlePayload?.data?.checkout?.url === 'string'
    ? paddlePayload.data.checkout.url
    : null;

  if (!transactionId || !checkoutUrl) {
    return json(502, {
      ok: false,
      error: 'Paddle returned an incomplete checkout transaction payload.',
    });
  }

  return json(200, {
    ok: true,
    data: {
      provider: 'paddle',
      environment: paddleConfig.environment,
      transactionId,
      checkoutUrl,
      tierKey,
    },
  });
};

export const __paddleCheckoutInternals = {
  resolvePaddleApiBaseUrl,
};
