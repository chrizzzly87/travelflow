import {
  collectPaddleEnvironmentIssues,
  normalizePaddleEnvironment,
  readPaddlePriceMapFromEnv,
} from '../edge-lib/paddle-billing.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

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

export const buildPaddlePublicConfig = (envReader: (name: string) => string | undefined) => {
  const environment = normalizePaddleEnvironment(envReader('PADDLE_ENV'));
  const checkoutEnabled = String(envReader('VITE_PADDLE_CHECKOUT_ENABLED') || '').trim().toLowerCase() === 'true';
  const clientToken = String(envReader('VITE_PADDLE_CLIENT_TOKEN') || '').trim();
  const apiKey = String(envReader('PADDLE_API_KEY') || '').trim();
  const priceMap = readPaddlePriceMapFromEnv(envReader);
  const issues = collectPaddleEnvironmentIssues({
    declaredEnvironment: environment,
    apiKey,
    clientToken,
  });

  return {
    provider: 'paddle' as const,
    environment,
    checkoutEnabled,
    clientTokenConfigured: Boolean(clientToken),
    tierAvailability: {
      tier_mid: Boolean(priceMap.tier_mid),
      tier_premium: Boolean(priceMap.tier_premium),
    },
    issues,
  };
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  return json(200, {
    ok: true,
    data: buildPaddlePublicConfig(readEnv),
  });
};

export const __paddleConfigInternals = {
  buildPaddlePublicConfig,
};
