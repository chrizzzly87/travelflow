import { collectPaddleEnvironmentIssues } from '../edge-lib/paddle-billing.ts';
import { resolveCurrentPaddleSubscription } from '../edge-lib/paddle-current-subscription.ts';
import {
  authorizeBillingUser,
  getAuthToken,
  getCurrentUserSubscriptionSummary,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
} from '../edge-lib/paddle-request.ts';

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

  try {
    const resolved = await resolveCurrentPaddleSubscription({
      baseUrl,
      apiKey: paddleConfig.apiKey,
      priceMap: paddleConfig.priceMap,
      userId: authorization.user.userId,
      email: authorization.user.email,
      summary,
      syncSource: 'subscription_refresh',
    });

    return json(200, {
      ok: true,
      data: {
        summary: resolved.summary,
        localSync: resolved.localSync
          ? {
            status: resolved.localSync.status,
            duplicate: resolved.localSync.duplicate,
            reason: resolved.localSync.reason,
          }
          : null,
      },
    });
  } catch (error) {
    return json(502, {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not refresh the linked Paddle subscription.',
    });
  }
};
