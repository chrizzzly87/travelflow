import { describe, expect, it } from 'vitest';
import {
  buildAdminUserSheetPath,
  getAdminTripExpirationBucket,
  getLegacyOwnerDeepLinkTarget,
  getPageSelectionState,
  resolveAdminTripGenerationState,
  summarizeAdminTrips,
} from '../../components/admin/adminTripsModel';
import { buildAdminTripsFilterPath, isAdminTripInDateRange } from '../../components/admin/adminTripsModel';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');
const inHours = (hours: number) => new Date(NOW + hours * 60 * 60 * 1000).toISOString();

describe('components/admin/adminTripsModel', () => {
  it('buckets expiry relative to now', () => {
    expect(getAdminTripExpirationBucket({ trip_expires_at: null }, NOW)).toBe('no_expiration');
    expect(getAdminTripExpirationBucket({ trip_expires_at: 'not a date' }, NOW)).toBe('no_expiration');
    expect(getAdminTripExpirationBucket({ trip_expires_at: inHours(-1) }, NOW)).toBe('already_expired');
    expect(getAdminTripExpirationBucket({ trip_expires_at: inHours(5) }, NOW)).toBe('expiring_24h');
    expect(getAdminTripExpirationBucket({ trip_expires_at: inHours(72) }, NOW)).toBe('expiring_7d');
    expect(getAdminTripExpirationBucket({ trip_expires_at: inHours(24 * 30) }, NOW)).toBe('scheduled');
  });

  it('treats an unknown generation state as succeeded', () => {
    expect(resolveAdminTripGenerationState({ generation_state: 'failed' })).toBe('failed');
    expect(resolveAdminTripGenerationState({ generation_state: null as never })).toBe('succeeded');
  });

  it('counts the KPI tiles: failed, in flight, expiring soon (archived excluded) and active', () => {
    const summary = summarizeAdminTrips([
      { status: 'active', generation_state: 'failed', trip_expires_at: null },
      { status: 'active', generation_state: 'running', trip_expires_at: inHours(3) },
      { status: 'active', generation_state: 'queued', trip_expires_at: inHours(100) },
      { status: 'expired', generation_state: 'succeeded', trip_expires_at: inHours(48) },
      { status: 'archived', generation_state: 'succeeded', trip_expires_at: inHours(2) },
      { status: 'active', generation_state: 'succeeded', trip_expires_at: inHours(24 * 20) },
    ], NOW);

    expect(summary).toEqual({
      total: 6,
      active: 4,
      failedGeneration: 1,
      generating: 2,
      expiringSoon: 3,
    });
  });

  it('forwards only the old owner drawer link to the Users sheet', () => {
    expect(getLegacyOwnerDeepLinkTarget(new URLSearchParams('user=abc&drawer=user'))).toBe('/admin/users?user=abc&drawer=user');
    expect(getLegacyOwnerDeepLinkTarget(new URLSearchParams('trip=t1&drawer=trip'))).toBeNull();
    expect(getLegacyOwnerDeepLinkTarget(new URLSearchParams('user=abc'))).toBeNull();
    expect(getLegacyOwnerDeepLinkTarget(new URLSearchParams('drawer=user&user='))).toBeNull();
    expect(buildAdminUserSheetPath('a b')).toBe('/admin/users?user=a%20b&drawer=user');
  });

  it('reports the header checkbox state for the current page only', () => {
    expect(getPageSelectionState([], new Set(['a']))).toBe('none');
    expect(getPageSelectionState(['a', 'b'], new Set())).toBe('none');
    expect(getPageSelectionState(['a', 'b'], new Set(['a', 'z']))).toBe('some');
    expect(getPageSelectionState(['a', 'b'], new Set(['a', 'b', 'z']))).toBe('all');
  });
});

describe('buildAdminTripsFilterPath', () => {
  it('links to the Trips filter the Overview tile counted, keeping a non-default range', () => {
    expect(buildAdminTripsFilterPath({ generation: 'failed' }, '30d')).toBe('/admin/trips?generation=failed');
    expect(buildAdminTripsFilterPath({ expires: 'expiring_24h,expiring_7d' }, '7d'))
      .toBe('/admin/trips?expires=expiring_24h%2Cexpiring_7d&range=7d');
  });
});

describe('isAdminTripInDateRange', () => {
  it('scopes by last update so an old trip edited recently still counts', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000).toISOString();
    expect(isAdminTripInDateRange({ created_at: old, updated_at: recent }, '30d')).toBe(true);
    expect(isAdminTripInDateRange({ created_at: old, updated_at: old }, '30d')).toBe(false);
    expect(isAdminTripInDateRange({ created_at: recent, updated_at: null as unknown as string }, '7d')).toBe(true);
    expect(isAdminTripInDateRange({ created_at: old, updated_at: old }, 'all')).toBe(true);
  });
});
