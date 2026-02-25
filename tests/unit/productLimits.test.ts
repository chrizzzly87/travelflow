import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_TRIP_EXPIRATION_DAYS,
  ANONYMOUS_TRIP_LIMIT,
  buildTripExpiryIso,
  getTripExpiryMs,
  isTripExpiredByTimestamp,
} from '../../config/productLimits';

describe('config/productLimits', () => {
  it('uses positive defaults from free plan entitlements', () => {
    expect(ANONYMOUS_TRIP_LIMIT).toBeGreaterThan(0);
    expect(ANONYMOUS_TRIP_EXPIRATION_DAYS).toBeGreaterThan(0);
  });

  it('builds trip expiry timestamps based on days', () => {
    const createdAt = Date.parse('2026-01-01T00:00:00Z');
    const expiry = buildTripExpiryIso(createdAt, 10);
    expect(expiry).toBe('2026-01-11T00:00:00.000Z');
  });

  it('parses expiry timestamps safely', () => {
    expect(getTripExpiryMs('2026-01-01T00:00:00Z')).toBe(Date.parse('2026-01-01T00:00:00Z'));
    expect(getTripExpiryMs('not-a-date')).toBeNull();
    expect(getTripExpiryMs(null)).toBeNull();
  });

  it('treats equality boundary as expired', () => {
    const expiry = '2026-01-01T00:00:00Z';
    const now = Date.parse(expiry);
    expect(isTripExpiredByTimestamp(expiry, now)).toBe(true);
    expect(isTripExpiredByTimestamp(expiry, now - 1)).toBe(false);
    expect(isTripExpiredByTimestamp(undefined, now)).toBe(false);
  });
});
