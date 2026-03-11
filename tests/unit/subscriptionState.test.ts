import { describe, expect, it } from 'vitest';

import { comparePaidTierOrder, normalizeManagedBillingStatus, resolveBillingTierDecision, resolveEffectiveBillingTierKey } from '../../lib/billing/subscriptionState';

describe('lib/billing/subscriptionState', () => {
  it('normalizes supported managed billing statuses', () => {
    expect(normalizeManagedBillingStatus('active')).toBe('active');
    expect(normalizeManagedBillingStatus('cancelled')).toBe('canceled');
    expect(normalizeManagedBillingStatus(null, 'past_due')).toBe('past_due');
    expect(normalizeManagedBillingStatus(undefined, undefined)).toBe('none');
  });

  it('compares paid tiers in upgrade order', () => {
    expect(comparePaidTierOrder('tier_mid', 'tier_premium')).toBe(1);
    expect(comparePaidTierOrder('tier_premium', 'tier_mid')).toBe(-1);
    expect(comparePaidTierOrder('tier_mid', 'tier_mid')).toBe(0);
  });

  it('routes free users into acquisition flow', () => {
    expect(resolveBillingTierDecision({
      currentTierKey: 'tier_free',
      targetTierKey: 'tier_mid',
      subscription: null,
    })).toMatchObject({
      action: 'acquire',
      reason: 'free_acquisition',
    });
  });

  it('marks the same active paid tier as current', () => {
    expect(resolveBillingTierDecision({
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_mid',
      subscription: {
        provider_subscription_id: 'sub_123',
        provider_status: 'active',
        status: 'active',
      },
    })).toMatchObject({
      action: 'current',
      reason: 'same_paid_tier',
    });
  });

  it('allows upgrades for active paid subscriptions', () => {
    expect(resolveBillingTierDecision({
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_premium',
      subscription: {
        provider_subscription_id: 'sub_123',
        provider_status: 'active',
        status: 'active',
      },
    })).toMatchObject({
      action: 'upgrade',
      reason: 'upgrade_available',
    });
  });

  it('routes downgrades and blocked states to management', () => {
    expect(resolveBillingTierDecision({
      currentTierKey: 'tier_premium',
      targetTierKey: 'tier_mid',
      subscription: {
        provider_subscription_id: 'sub_123',
        provider_status: 'active',
        status: 'active',
      },
    })).toMatchObject({
      action: 'manage',
      reason: 'downgrade_requires_management',
    });

    expect(resolveBillingTierDecision({
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_premium',
      subscription: {
        provider_subscription_id: 'sub_123',
        provider_status: 'past_due',
        status: 'past_due',
      },
    })).toMatchObject({
      action: 'manage',
      reason: 'blocked_status',
    });
  });

  it('routes scheduled cancellations to management instead of inline upgrade', () => {
    expect(resolveBillingTierDecision({
      currentTierKey: 'tier_mid',
      targetTierKey: 'tier_premium',
      nowMs: Date.parse('2026-03-10T10:00:00.000Z'),
      subscription: {
        provider_subscription_id: 'sub_123',
        provider_status: 'active',
        status: 'active',
        cancel_at: '2026-03-20T10:00:00.000Z',
      },
    })).toMatchObject({
      action: 'manage',
      reason: 'scheduled_cancel',
    });
  });

  it('derives the effective paid tier from the synced provider price id', () => {
    expect(resolveEffectiveBillingTierKey({
      currentTierKey: 'tier_free',
      subscription: {
        provider_price_id: 'pri_premium',
      },
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
    })).toBe('tier_premium');

    expect(resolveEffectiveBillingTierKey({
      currentTierKey: 'tier_free',
      subscription: {
        providerPriceId: 'pri_mid',
      },
      priceIds: {
        tier_mid: 'pri_mid',
        tier_premium: 'pri_premium',
      },
    })).toBe('tier_mid');
  });
});
