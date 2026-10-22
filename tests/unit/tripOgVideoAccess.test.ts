import { describe, expect, it, vi } from 'vitest';
vi.mock('../../netlify/edge-lib/trip-og-data.ts', () => ({ fetchSharedTrip: vi.fn(), fetchSharedTripByTripId: vi.fn() }));
import { canManageTripVideo, resolvePublicVideoTrip } from '../../netlify/lib/trip-video-access';
import { fetchSharedTrip, fetchSharedTripByTripId } from '../../netlify/edge-lib/trip-og-data';

describe('trip video access', () => {
  it('rejects unauthenticated render requests before accessing data', async () => {
    const mock = vi.fn(); vi.stubGlobal('fetch', mock);
    expect(await canManageTripVideo(new Request('https://example.com'), 'trip')).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });
  it('rechecks share access and does not fall back to privileged trip data', async () => {
    vi.mocked(fetchSharedTripByTripId).mockResolvedValue(null);
    expect(await resolvePublicVideoTrip(new URL('https://example.com?trip=private'))).toBeNull();
    expect(fetchSharedTripByTripId).toHaveBeenCalledWith('private', null);
  });
  it('does not let a trip ID bypass a revoked supplied token', async () => {
    vi.mocked(fetchSharedTrip).mockResolvedValue(null);
    expect(await resolvePublicVideoTrip(new URL('https://example.com?s=revoked&trip=other'))).toBeNull();
    expect(fetchSharedTrip).toHaveBeenCalledWith('revoked', null);
  });
  it('rejects versioned video access', async () => {
    expect(await resolvePublicVideoTrip(new URL('https://example.com?trip=trip&v=past'))).toBeNull();
  });
});
