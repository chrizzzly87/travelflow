import { describe, expect, it, vi } from 'vitest';
import { __paddleSubscriptionChangeInternals } from '../../netlify/edge-functions/paddle-subscription-change';

describe('paddle subscription change edge internals', () => {
  it('accepts only supported paid tier keys', () => {
    expect(__paddleSubscriptionChangeInternals.parseTierKey('tier_mid')).toBe('tier_mid');
    expect(__paddleSubscriptionChangeInternals.parseTierKey('tier_premium')).toBe('tier_premium');
    expect(__paddleSubscriptionChangeInternals.parseTierKey('tier_free')).toBeNull();
  });

  it('builds deterministic synthetic event ids when the clock is fixed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T08:45:00.000Z'));

    expect(__paddleSubscriptionChangeInternals.buildSyntheticEventId('sub_123', 'tier_premium')).toBe(
      'subscription_change__sub_123__tier_premium__1773132300000',
    );

    vi.useRealTimers();
  });
});
