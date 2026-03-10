import { describe, expect, it } from 'vitest';
import { __paddleSubscriptionManageInternals } from '../../netlify/edge-functions/paddle-subscription-manage';

describe('paddle subscription manage edge internals', () => {
  it('extracts Paddle management URLs and keeps local lifecycle fields', () => {
    const result = __paddleSubscriptionManageInternals.extractManagementResponse(
      {
        provider_subscription_id: 'sub_123',
        provider_status: 'active',
        current_period_end: '2026-04-01T00:00:00.000Z',
        cancel_at: null,
        canceled_at: null,
        grace_ends_at: null,
      },
      {
        management_urls: {
          cancel: 'https://paddle.test/cancel/sub_123',
          update_payment_method: 'https://paddle.test/payment-method/sub_123',
        },
      },
    );

    expect(result).toEqual({
      provider: 'paddle',
      providerSubscriptionId: 'sub_123',
      cancelUrl: 'https://paddle.test/cancel/sub_123',
      updatePaymentMethodUrl: 'https://paddle.test/payment-method/sub_123',
      providerStatus: 'active',
      currentPeriodEnd: '2026-04-01T00:00:00.000Z',
      cancelAt: null,
      canceledAt: null,
      graceEndsAt: null,
    });
  });
});
