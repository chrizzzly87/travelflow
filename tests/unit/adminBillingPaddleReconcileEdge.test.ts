import { describe, expect, it } from 'vitest';
import { __adminBillingPaddleReconcileInternals } from '../../netlify/edge-functions/admin-billing-paddle-reconcile';

describe('admin billing Paddle reconcile edge internals', () => {
  it('builds deterministic synthetic event ids from subscription state', () => {
    const baseSubscription = {
      id: 'sub_123',
      status: 'active',
      updated_at: '2026-03-08T10:15:30.000Z',
    };

    expect(__adminBillingPaddleReconcileInternals.buildSyntheticEventId(baseSubscription)).toBe(
      'reconcile__sub_123__active__20260308T101530000Z',
    );
    expect(__adminBillingPaddleReconcileInternals.buildSyntheticEventId(baseSubscription)).toBe(
      'reconcile__sub_123__active__20260308T101530000Z',
    );
  });

  it('marks only configured paid-tier subscriptions in supported statuses as eligible', () => {
    const configuredPriceIds = new Set(['pri_mid', 'pri_premium']);

    expect(__adminBillingPaddleReconcileInternals.isEligibleSubscription({
      id: 'sub_active',
      status: 'active',
      items: [{ price: { id: 'pri_mid' } }],
    }, configuredPriceIds)).toBe(true);

    expect(__adminBillingPaddleReconcileInternals.isEligibleSubscription({
      id: 'sub_unconfigured',
      status: 'active',
      items: [{ price: { id: 'pri_other' } }],
    }, configuredPriceIds)).toBe(false);

    expect(__adminBillingPaddleReconcileInternals.isEligibleSubscription({
      id: 'sub_inactive',
      status: 'inactive',
      items: [{ price: { id: 'pri_mid' } }],
    }, configuredPriceIds)).toBe(false);
  });

  it('maps subscription statuses to the expected synthetic webhook event types', () => {
    expect(__adminBillingPaddleReconcileInternals.buildSyntheticEventType('active')).toBe('subscription.activated');
    expect(__adminBillingPaddleReconcileInternals.buildSyntheticEventType('canceled')).toBe('subscription.canceled');
    expect(__adminBillingPaddleReconcileInternals.buildSyntheticEventType('past_due')).toBe('subscription.updated');
  });

  it('normalizes targeted subscription ids from admin input', () => {
    expect(__adminBillingPaddleReconcileInternals.normalizeSubscriptionId('  sub_01kk6fcs5t4f75tddavgjx1rtz  ')).toBe(
      'sub_01kk6fcs5t4f75tddavgjx1rtz',
    );
    expect(__adminBillingPaddleReconcileInternals.normalizeSubscriptionId('')).toBeNull();
  });
});
