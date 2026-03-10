import { collectPaddleEnvironmentIssues } from '../edge-lib/paddle-billing.ts';
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
  if (!summary?.provider_subscription_id) {
    return json(409, {
      ok: false,
      error: 'No paid Paddle subscription is linked to this account yet.',
    });
  }

  const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/subscriptions/${encodeURIComponent(summary.provider_subscription_id)}`,
    paddleConfig.apiKey,
  );
  const typedPayload = payload as { data?: Record<string, unknown> | null } | null;
  if (!response.ok) {
    return json(502, {
      ok: false,
      error: extractServiceError(typedPayload, `Could not load Paddle management URLs (${response.status}).`),
    });
  }

  return json(200, {
    ok: true,
    data: extractManagementResponse(summary, typedPayload?.data),
  });
};
