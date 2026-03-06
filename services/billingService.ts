import type { PlanTierKey } from '../types';
import { dbGetAccessToken, ensureExistingDbSession, DB_ENABLED } from './dbService';

export type BillingCheckoutTierKey = Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;

interface StartPaddleCheckoutPayload {
  tierKey: BillingCheckoutTierKey;
  source?: string;
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
}

export interface PaddleCheckoutSession {
  provider: 'paddle';
  environment: string;
  transactionId: string;
  checkoutUrl: string;
  tierKey: BillingCheckoutTierKey;
}

const parseCheckoutResponse = (payload: unknown): PaddleCheckoutResponse => {
  if (!payload || typeof payload !== 'object') return {};
  return payload as PaddleCheckoutResponse;
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

const parseJsonPayload = async (response: Response): Promise<PaddleCheckoutResponse> => {
  const responseText = await response.text().catch(() => '');
  if (!responseText) return {};
  try {
    return parseCheckoutResponse(JSON.parse(responseText));
  } catch {
    return {};
  }
};

export const startPaddleCheckoutSession = async (
  payload: StartPaddleCheckoutPayload,
): Promise<PaddleCheckoutSession> => {
  if (!DB_ENABLED) {
    throw new Error('Database session is not available. Paddle checkout requires authenticated database mode.');
  }

  const userId = await ensureExistingDbSession();
  if (!userId) {
    throw new Error('No active user session found for checkout.');
  }

  const accessToken = await dbGetAccessToken();
  if (!accessToken) {
    throw new Error('Missing access token for checkout request.');
  }

  const response = await fetch('/api/billing/paddle/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tierKey: payload.tierKey,
      source: payload.source || 'pricing_page',
    }),
  });

  const parsed = await parseJsonPayload(response);

  if (!response.ok || parsed.ok === false) {
    const devRoutingHint = response.status === 404 && import.meta.env.DEV
      ? ' Paddle checkout route is unavailable in Vite-only dev. Run `pnpm dev:netlify` to proxy `/api/billing/paddle/*`.'
      : '';
    throw new Error(`${normalizeErrorMessage(parsed, response.status, 'Paddle checkout request failed')}${devRoutingHint}`.trim());
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
