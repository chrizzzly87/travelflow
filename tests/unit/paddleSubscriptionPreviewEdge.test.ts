import { describe, expect, it } from 'vitest';
import { __paddleSubscriptionPreviewInternals } from '../../netlify/edge-functions/paddle-subscription-preview';

describe('paddle subscription preview edge internals', () => {
  it('accepts only supported paid tier keys', () => {
    expect(__paddleSubscriptionPreviewInternals.parseTierKey('tier_mid')).toBe('tier_mid');
    expect(__paddleSubscriptionPreviewInternals.parseTierKey('tier_premium')).toBe('tier_premium');
    expect(__paddleSubscriptionPreviewInternals.parseTierKey('tier_free')).toBeNull();
  });

  it('builds an upgrade preview payload from Paddle preview data', () => {
    const payload = __paddleSubscriptionPreviewInternals.buildPreviewPayload(
      'tier_mid',
      'tier_premium',
      {
        user_id: 'user_1',
        provider_subscription_id: 'sub_123',
        amount: 900,
        currency: 'USD',
      },
      {
        id: 'sub_123',
        status: 'active',
        items: [
          {
            price: {
              id: 'pri_premium',
              product_id: 'pro_premium',
              unit_price: {
                amount: '1900',
                currency_code: 'USD',
              },
            },
          },
        ],
        recurring_transaction_details: {
          totals: {
            total: '1900',
            currency_code: 'USD',
          },
        },
        immediate_transaction: {
          details: {
            totals: {
              total: '1000',
              currency_code: 'USD',
            },
          },
        },
      },
    );

    expect(payload).toMatchObject({
      mode: 'upgrade',
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_premium',
      providerSubscriptionId: 'sub_123',
      currentAmount: 900,
      currentCurrency: 'USD',
      recurringAmount: 1900,
      recurringCurrency: 'USD',
      immediateAmount: 1000,
      immediateCurrency: 'USD',
    });
    expect(payload.prorationMessage).toContain('prorated difference');
  });
});
