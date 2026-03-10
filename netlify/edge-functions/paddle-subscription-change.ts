import type { PlanTierKey } from '../../types';
import { resolveBillingTierDecision } from '../../lib/billing/subscriptionState.ts';
import {
  collectPaddleEnvironmentIssues,
  extractSubscriptionSnapshot,
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
import { extractServiceError, getSupabaseServiceConfig, processPaddleBillingEvent } from '../edge-lib/paddle-webhook-sync.ts';

type CheckoutTierKey = Extract<PlanTierKey, 'tier_mid' | 'tier_premium'>;

interface ChangeRequestBody {
  tierKey?: string | null;
  source?: string | null;
  returnTo?: string | null;
  tripId?: string | null;
  claimId?: string | null;
}

const parseTierKey = (value: unknown): CheckoutTierKey | null => {
  if (value === 'tier_mid') return 'tier_mid';
  if (value === 'tier_premium') return 'tier_premium';
  return null;
};

const buildSyntheticEventId = (subscriptionId: string, targetTierKey: CheckoutTierKey): string => (
  `subscription_change__${subscriptionId}__${targetTierKey}__${Date.now()}`
);

export const __paddleSubscriptionChangeInternals = {
  parseTierKey,
  buildSyntheticEventId,
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

  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return json(500, { ok: false, error: 'Supabase service role configuration missing.' });
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

  let body: ChangeRequestBody;
  try {
    body = (await request.json()) as ChangeRequestBody;
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
      error: 'Subscription upgrade is not available for the current billing state.',
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
    `${baseUrl}/subscriptions/${encodeURIComponent(summary.provider_subscription_id)}`,
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
      error: extractServiceError(typedPayload, `Paddle subscription change failed (${response.status}).`),
    });
  }

  const data = typedPayload?.data;
  const subscriptionSnapshot = extractSubscriptionSnapshot('subscription.updated', data, new Date().toISOString());
  const providerSubscriptionId = subscriptionSnapshot.providerSubscriptionId || summary.provider_subscription_id;
  if (!providerSubscriptionId) {
    return json(502, {
      ok: false,
      error: 'Paddle returned an incomplete subscription payload after the plan change.',
    });
  }

  const syntheticPayload = {
    event_id: buildSyntheticEventId(providerSubscriptionId, targetTierKey),
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      ...(data && typeof data === 'object' ? data as Record<string, unknown> : {}),
      custom_data: {
        ...(((data && typeof data === 'object' ? data as Record<string, unknown> : {}).custom_data as Record<string, unknown> | null) || {}),
        tf_user_id: authorization.user.userId,
        tf_source: typeof body.source === 'string' ? body.source : 'checkout_upgrade',
        ...(typeof body.returnTo === 'string' && body.returnTo ? { tf_return_to: body.returnTo } : {}),
        ...(typeof body.tripId === 'string' && body.tripId ? { tf_trip_id: body.tripId } : {}),
        ...(typeof body.claimId === 'string' && body.claimId ? { tf_claim_id: body.claimId } : {}),
        tf_mutation: 'subscription_change',
      },
    },
  };

  const syncResult = await processPaddleBillingEvent(serviceConfig, {
    eventId: syntheticPayload.event_id,
    eventType: syntheticPayload.event_type,
    occurredAtIso: syntheticPayload.occurred_at,
    eventData: syntheticPayload.data,
    rawEventPayload: syntheticPayload,
  });

  return json(200, {
    ok: true,
    data: {
      mode: 'upgrade_applied',
      currentTierKey: authorization.user.tierKey,
      targetTierKey,
      providerSubscriptionId,
      providerStatus: subscriptionSnapshot.providerStatus,
      recurringAmount: subscriptionSnapshot.amount,
      recurringCurrency: subscriptionSnapshot.currency,
      localSync: {
        status: syncResult.status,
        duplicate: syncResult.duplicate,
        reason: syncResult.reason,
      },
    },
  });
};
