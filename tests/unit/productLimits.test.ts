import { describe, expect, it } from 'vitest';

import {
  ANONYMOUS_TRIP_EXPIRATION_DAYS,
  buildTripExpiryIso,
  resolveTripExpiryDays,
  resolveTripExpiryFromEntitlements,
} from '../../config/productLimits';

describe('config/productLimits', () => {
  it('resolves expiry days from entitlement values', () => {
    expect(resolveTripExpiryDays(null)).toBeNull();
    expect(resolveTripExpiryDays(90)).toBe(90);
    expect(resolveTripExpiryDays(0)).toBe(ANONYMOUS_TRIP_EXPIRATION_DAYS);
    expect(resolveTripExpiryDays(undefined)).toBe(ANONYMOUS_TRIP_EXPIRATION_DAYS);
  });

  it('keeps existing trip expiry when already present', () => {
    const existing = '2026-06-01T00:00:00.000Z';
    expect(resolveTripExpiryFromEntitlements(Date.parse('2026-03-01T00:00:00Z'), existing, 30)).toBe(existing);
  });

  it('returns null expiry when entitlement is unlimited', () => {
    expect(resolveTripExpiryFromEntitlements(Date.parse('2026-03-01T00:00:00Z'), undefined, null)).toBeNull();
  });

  it('builds expiry from now and entitlement days', () => {
    const createdAtMs = Date.parse('2026-03-01T00:00:00Z');
    expect(resolveTripExpiryFromEntitlements(createdAtMs, undefined, 14)).toBe(buildTripExpiryIso(createdAtMs, 14));
  });
});
