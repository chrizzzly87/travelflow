import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  collectPaddleEnvironmentIssues: vi.fn(),
  resolveCurrentPaddleSubscription: vi.fn(),
  authorizeBillingUser: vi.fn(),
  getAuthToken: vi.fn(),
  getCurrentUserSubscriptionSummary: vi.fn(),
  getPaddleApiConfig: vi.fn(),
  getSupabaseAnonConfig: vi.fn(),
  json: vi.fn((status: number, payload: unknown) => new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })),
  resolvePaddleApiBaseUrl: vi.fn(),
}));

vi.mock('../../netlify/edge-lib/paddle-billing.ts', () => ({
  collectPaddleEnvironmentIssues: mocks.collectPaddleEnvironmentIssues,
}));

vi.mock('../../netlify/edge-lib/paddle-current-subscription.ts', () => ({
  resolveCurrentPaddleSubscription: mocks.resolveCurrentPaddleSubscription,
}));

vi.mock('../../netlify/edge-lib/paddle-request.ts', () => ({
  authorizeBillingUser: mocks.authorizeBillingUser,
  getAuthToken: mocks.getAuthToken,
  getCurrentUserSubscriptionSummary: mocks.getCurrentUserSubscriptionSummary,
  getPaddleApiConfig: mocks.getPaddleApiConfig,
  getSupabaseAnonConfig: mocks.getSupabaseAnonConfig,
  json: mocks.json,
  resolvePaddleApiBaseUrl: mocks.resolvePaddleApiBaseUrl,
}));

import handler from '../../netlify/edge-functions/paddle-subscription-refresh';

describe('paddle subscription refresh edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectPaddleEnvironmentIssues.mockReturnValue([]);
    mocks.getAuthToken.mockReturnValue('token_123');
    mocks.getSupabaseAnonConfig.mockReturnValue({
      url: 'https://supabase.test',
      anonKey: 'anon-key',
    });
    mocks.getPaddleApiConfig.mockReturnValue({
      apiKey: 'pdl_sdbx_apikey_123',
      environment: 'sandbox',
      priceMap: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
      checkoutDomain: '',
    });
    mocks.authorizeBillingUser.mockResolvedValue({
      ok: true,
      user: {
        userId: 'user_123',
        email: 'ada@example.com',
        tierKey: 'tier_mid',
        isAnonymous: false,
        systemRole: 'user',
        termsAcceptanceRequired: false,
      },
    });
    mocks.getCurrentUserSubscriptionSummary.mockResolvedValue({
      user_id: 'user_123',
      provider: 'paddle',
      provider_customer_id: 'ctm_123',
      provider_subscription_id: 'sub_123',
      provider_price_id: 'pri_mid',
      provider_product_id: 'pro_mid',
      provider_status: 'active',
      status: 'active',
      current_period_start: '2026-03-01T00:00:00.000Z',
      current_period_end: '2026-04-01T00:00:00.000Z',
      cancel_at: null,
      canceled_at: null,
      grace_ends_at: null,
      currency: 'USD',
      amount: 900,
      last_event_id: 'evt_123',
      last_event_type: 'subscription.updated',
      last_event_at: '2026-03-08T10:00:00.000Z',
    });
    mocks.resolvePaddleApiBaseUrl.mockReturnValue('https://sandbox-api.paddle.test');
    mocks.resolveCurrentPaddleSubscription.mockResolvedValue({
      summary: {
        user_id: 'user_123',
        provider: 'paddle',
        provider_customer_id: 'ctm_123',
        provider_subscription_id: 'sub_123',
        provider_price_id: 'pri_mid',
        provider_product_id: 'pro_mid',
        provider_status: 'active',
        status: 'active',
        current_period_start: '2026-03-01T00:00:00.000Z',
        current_period_end: '2026-04-01T00:00:00.000Z',
        cancel_at: null,
        canceled_at: null,
        grace_ends_at: null,
        currency: 'USD',
        amount: 900,
        last_event_id: null,
        last_event_type: null,
        last_event_at: null,
      },
      subscription: {
        id: 'sub_123',
      },
      localSync: {
        status: 'processed',
        duplicate: false,
        reason: null,
      },
    });
  });

  it('rejects requests without a bearer token', async () => {
    mocks.getAuthToken.mockReturnValueOnce(null);

    const response = await handler(new Request('https://travelflow.test/api/billing/paddle/subscription-refresh', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing bearer token.',
    });
  });

  it('resolves the current Paddle subscription and returns normalized sync data', async () => {
    const response = await handler(new Request('https://travelflow.test/api/billing/paddle/subscription-refresh', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token_123',
      },
    }));

    expect(mocks.resolveCurrentPaddleSubscription).toHaveBeenCalledWith({
      baseUrl: 'https://sandbox-api.paddle.test',
      apiKey: 'pdl_sdbx_apikey_123',
      priceMap: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
      userId: 'user_123',
      email: 'ada@example.com',
      summary: expect.objectContaining({
        provider_subscription_id: 'sub_123',
      }),
      syncSource: 'subscription_refresh',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        summary: expect.objectContaining({
          provider_subscription_id: 'sub_123',
          provider_status: 'active',
        }),
        localSync: {
          status: 'processed',
          duplicate: false,
          reason: null,
        },
      },
    });
  });
});
