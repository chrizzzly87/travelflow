import { collectPaddleEnvironmentIssues, extractSubscriptionSnapshot } from '../edge-lib/paddle-billing.ts';
import {
  authorizeBillingUser,
  asTrimmedString,
  fetchPaddleJson,
  getAuthToken,
  getPaddleApiConfig,
  getSupabaseAnonConfig,
  json,
  resolvePaddleApiBaseUrl,
} from '../edge-lib/paddle-request.ts';
import { extractServiceError, getSupabaseServiceConfig, processPaddleBillingEvent } from '../edge-lib/paddle-webhook-sync.ts';
import { loadPaddleSubscriptionDetail } from '../edge-lib/paddle-subscription-resolution.ts';

interface TransactionSyncRequestBody {
  transactionId?: string | null;
}

type PaddleTransactionRecord = Record<string, unknown>;

const parseTransactionId = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return /^txn_[a-z0-9]+$/i.test(normalized) ? normalized : null;
};

const buildEventType = (status: string | null): string => {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'subscription.activated';
    case 'canceled':
      return 'subscription.canceled';
    default:
      return 'subscription.updated';
  }
};

export const __paddleTransactionSyncInternals = {
  buildEventType,
  parseTransactionId,
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

  let body: TransactionSyncRequestBody;
  try {
    body = (await request.json()) as TransactionSyncRequestBody;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body.' });
  }

  const transactionId = parseTransactionId(body.transactionId);
  if (!transactionId) {
    return json(400, { ok: false, error: 'A valid Paddle transaction ID is required.' });
  }

  const authorization = await authorizeBillingUser(supabaseConfig, authToken);
  if ('response' in authorization) {
    return authorization.response;
  }

  const baseUrl = resolvePaddleApiBaseUrl(paddleConfig.environment);
  const { response, payload } = await fetchPaddleJson(
    `${baseUrl}/transactions/${encodeURIComponent(transactionId)}`,
    paddleConfig.apiKey,
  );
  const typedPayload = payload as { data?: PaddleTransactionRecord | null } | null;
  if (!response.ok) {
    return json(502, {
      ok: false,
      error: extractServiceError(typedPayload, `Could not load Paddle transaction ${transactionId} (${response.status}).`),
    });
  }

  const transaction = typedPayload?.data;
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
    return json(502, {
      ok: false,
      error: 'Paddle returned an incomplete transaction payload.',
    });
  }

  const transactionCustomData = (transaction.custom_data && typeof transaction.custom_data === 'object')
    ? transaction.custom_data as Record<string, unknown>
    : {};
  const transactionUserId = asTrimmedString(transactionCustomData.tf_user_id);
  if (transactionUserId && transactionUserId !== authorization.user.userId) {
    return json(403, {
      ok: false,
      error: 'This Paddle transaction belongs to a different TravelFlow account.',
    });
  }

  const subscriptionId = asTrimmedString(transaction.subscription_id);
  if (!subscriptionId) {
    return json(409, {
      ok: false,
      error: 'This Paddle transaction does not have a linked subscription yet.',
    });
  }

  const subscription = await loadPaddleSubscriptionDetail(baseUrl, paddleConfig.apiKey, subscriptionId);
  const subscriptionCustomData = (subscription.custom_data && typeof subscription.custom_data === 'object')
    ? subscription.custom_data as Record<string, unknown>
    : {};
  const subscriptionForSync = {
    ...subscription,
    custom_data: {
      ...transactionCustomData,
      ...subscriptionCustomData,
      tf_user_id: authorization.user.userId,
      tf_source: asTrimmedString(subscriptionCustomData.tf_source) || asTrimmedString(transactionCustomData.tf_source) || 'checkout_transaction_sync',
      tf_mutation: 'transaction_sync',
    },
  };
  const snapshot = extractSubscriptionSnapshot('subscription.updated', subscriptionForSync, new Date().toISOString());
  const eventType = buildEventType(snapshot.providerStatus);
  const eventId = `transaction_sync__${transactionId}__${subscriptionId}`;
  const occurredAtIso = asTrimmedString(transaction.updated_at)
    || asTrimmedString(transaction.created_at)
    || new Date().toISOString();

  const syncResult = await processPaddleBillingEvent(serviceConfig, {
    eventId,
    eventType,
    occurredAtIso,
    eventData: subscriptionForSync,
    rawEventPayload: {
      event_id: eventId,
      event_type: eventType,
      occurred_at: occurredAtIso,
      data: subscriptionForSync,
    },
  });

  return json(200, {
    ok: true,
    data: {
      provider: 'paddle',
      transactionId,
      providerSubscriptionId: snapshot.providerSubscriptionId,
      providerStatus: snapshot.providerStatus,
      localSync: {
        status: syncResult.status,
        duplicate: syncResult.duplicate,
        reason: syncResult.reason,
      },
    },
  });
};
