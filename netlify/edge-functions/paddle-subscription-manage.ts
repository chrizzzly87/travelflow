import { collectPaddleEnvironmentIssues } from '../edge-lib/paddle-billing.ts';
import {
  resolveCurrentPaddleSubscription,
} from '../edge-lib/paddle-current-subscription.ts';
import {
  authorizeBillingUser,
  asTrimmedString,
  getAuthToken,
  getCurrentUserSubscriptionSummary,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
} from '../edge-lib/paddle-request.ts';
import {
  getSubscriptionPriceIds,
  pickBestFallbackSubscription,
} from '../edge-lib/paddle-subscription-resolution.ts';

const extractManagementResponse = (
  summary: Awaited<ReturnType<typeof getCurrentUserSubscriptionSummary>>,
  data: Record<string, unknown> | null | undefined,
) => {
  const managementUrls = (data?.management_urls && typeof data.management_urls === 'object')
    ? data.management_urls as Record<string, unknown>
    : {};

  return {
    provider: 'paddle' as const,
    providerSubscriptionId: summary?.provider_subscription_id ?? null,
    cancelUrl: typeof managementUrls.cancel === 'string' ? managementUrls.cancel : null,
    updatePaymentMethodUrl: typeof managementUrls.update_payment_method === 'string'
      ? managementUrls.update_payment_method
      : null,
    providerStatus: summary?.provider_status ?? null,
    currentPeriodEnd: summary?.current_period_end ?? null,
    cancelAt: summary?.cancel_at ?? null,
    canceledAt: summary?.canceled_at ?? null,
    graceEndsAt: summary?.grace_ends_at ?? null,
  };
};

export const __paddleSubscriptionManageInternals = {
  extractManagementResponse,
  getSubscriptionPriceIds,
  pickBestFallbackSubscription,
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

  const authorization = await authorizeBillingUser(supabaseConfig, authToken);
  if ('response' in authorization) {
    return authorization.response;
  }

  const summary = await getCurrentUserSubscriptionSummary(supabaseConfig, authToken);
  const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
  let resolvedSummary = summary;
  let resolvedSubscription = null;

  try {
    const resolved = await resolveCurrentPaddleSubscription({
      baseUrl,
      apiKey: paddleConfig.apiKey,
      priceMap: paddleConfig.priceMap,
      userId: authorization.user.userId,
      email: authorization.user.email,
      summary,
      syncSource: 'profile_billing_management_lookup',
    });
    resolvedSummary = resolved.summary;
    resolvedSubscription = resolved.subscription;
  } catch (error) {
    return json(502, {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not resolve the linked Paddle subscription.',
    });
  }

  if (!resolvedSummary?.provider_subscription_id || !resolvedSubscription) {
    return json(409, {
      ok: false,
      error: 'No paid Paddle subscription is linked to this account yet.',
    });
  }

  return json(200, {
    ok: true,
    data: extractManagementResponse(resolvedSummary, resolvedSubscription),
  });
};
