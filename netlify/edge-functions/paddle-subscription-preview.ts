import type { PlanTierKey } from '../../types';
import { resolveBillingTierDecision } from '../../lib/billing/subscriptionState.ts';
import {
  collectPaddleEnvironmentIssues,
  extractSubscriptionSnapshot,
  extractTransactionSnapshot,
  resolvePriceIdForTier,
} from '../edge-lib/paddle-billing.ts';
import {
  authorizeBillingUser,
  fetchPaddleJson,
  getAuthToken,
  getCurrentUserSubscriptionSummary,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
} from '../edge-lib/paddle-request.ts';
import { extractServiceError } from '../edge-lib/paddle-webhook-sync.ts';

type CheckoutTierKey = Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;

interface PreviewRequestBody {
  tierKey?: string | null;
}

const parseTierKey = (value: unknown): CheckoutTierKey | null => {
  if (value === 'tier_mid') return 'tier_mid';
  if (value === 'tier_premium') return 'tier_premium';
  return null;
};

const buildPreviewPayload = (
  currentTierKey: PlanTierKey,
  targetTierKey: CheckoutTierKey,
  summary: Awaited<ReturnType<typeof getCurrentUserSubscriptionSummary>>,
  data: unknown,
) => {
  const subscriptionSnapshot = extractSubscriptionSnapshot('subscription.updated', data, new Date().toISOString());
  const source = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const immediateTransaction = source.immediate_transaction;
  const immediateSnapshot = extractTransactionSnapshot(immediateTransaction);

  return {
    mode: 'upgrade',
    currentTierKey,
    targetTierKey,
    providerSubscriptionId: summary?.provider_subscription_id || subscriptionSnapshot.providerSubscriptionId,
    providerStatus: subscriptionSnapshot.providerStatus,
    currentAmount: summary?.amount ?? null,
    currentCurrency: summary?.currency ?? null,
    recurringAmount: subscriptionSnapshot.amount,
    recurringCurrency: subscriptionSnapshot.currency,
    immediateAmount: immediateSnapshot.amount,
    immediateCurrency: immediateSnapshot.currency,
    prorationMessage: immediateSnapshot.amount !== null
      ? 'The plan change applies immediately. Paddle will charge the prorated difference now.'
      : 'The plan change applies immediately and the recurring total updates in Paddle.',
  };
};

export const __paddleSubscriptionPreviewInternals = {
  parseTierKey,
  buildPreviewPayload,
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const authToken = getAuthToken(request);
  if (!authToken) {
    return json(401, { ok: false, error: 'Missing bearer token.' });
  }

  const supabaseConfig = getSupabaseAnonConfig();
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

  let body: PreviewRequestBody;
  try {
    body = (await request.json()) as PreviewRequestBody;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body.' });
  }

  const targetTierKey = parseTierKey(body?.tierKey);
  if (!targetTierKey) {
    return json(400, { ok: false, error: 'A supported paid tier key is required.' });
  }

  const targetPriceId = resolvePriceIdForTier(targetTierKey, paddleConfig.priceMap);
  if (!targetPriceId) {
    return json(400, { ok: false, error: `No Paddle price ID configured for ${targetTierKey}.` });
  }

  const authorization = await authorizeBillingUser(supabaseConfig, authToken);
  if ('response' in authorization) {
    return authorization.response;
  }

  const summary = await getCurrentUserSubscriptionSummary(supabaseConfig, authToken);
  const decision = resolveBillingTierDecision({
    currentTierKey: authorization.user.tierKey,
    targetTierKey,
    subscription: summary,
  });

  if (decision.action !== 'upgrade') {
    return json(409, {
      ok: false,
      error: 'Subscription upgrade preview is not available for the current billing state.',
      code: decision.reason,
    });
  }

  if (!summary?.provider_subscription_id) {
    return json(409, {
      ok: false,
      error: 'Current paid subscription could not be resolved.',
      code: 'missing_subscription',
    });
  }

  const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/subscriptions/${encodeURIComponent(summary.provider_subscription_id)}/preview`,
    paddleConfig.apiKey,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ price_id: targetPriceId, quantity: 1 }],
        proration_billing_mode: 'prorated_immediately',
      }),
    },
  );

  const typedPayload = payload as { data?: unknown } | null;
  if (!response.ok) {
    return json(502, {
      ok: false,
      error: extractServiceError(typedPayload, `Paddle subscription preview failed (${response.status}).`),
    });
  }

  return json(200, {
    ok: true,
    data: buildPreviewPayload(authorization.user.tierKey, targetTierKey, summary, typedPayload?.data),
  });
};
