import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTripVideoMap, buildTripVideoStops, tripVideoStopLabel } from '../../netlify/lib/trip-video-map';
import { videoRevision, claimVideo } from '../../netlify/lib/trip-video-store';
import { TRIP_VIDEO } from '../../shared/tripOgVideo';

const trip = { title: 'Taiwan', items: [
  { type: 'city', title: 'Tainan', startDateOffset: 3, duration: 4, coordinates: { lat: 22.9999, lng: 120.2269 } },
  { type: 'activity', title: 'Alishan day trip', startDateOffset: 6, duration: .5, coordinates: { lat: 23.519, lng: 120.809 } },
  { type: 'activity', title: 'Night market', startDateOffset: 6, duration: .1, coordinates: { lat: 23.011, lng: 120.2015 } },
  { type: 'city', title: 'Kaohsiung', startDateOffset: 7, duration: 3, coordinates: { lat: 22.6273, lng: 120.3014 } },
] };
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('video rendering preferences and excursions', () => {
  it('keeps excursion labels short without cutting a word', () => {
    expect(tripVideoStopLabel('Day Trip to Alishan National Scenic Area')).toBe('Alishan National Scenic…');
  });
  it('returns to the overnight city after a mapped day trip before continuing', () => {
    expect(buildTripVideoStops(trip).map(stop => [stop.title, Boolean(stop.returnToBase)])).toEqual([
      ['Tainan', false], ['Alishan day trip', false], ['Tainan', true], ['Kaohsiung', false],
    ]);
    expect(buildTripVideoStops({ items: [{ type: 'city', coordinates: { lat: NaN, lng: 0 } }] })).toEqual([]);
  });
  it('uses Mapbox satellite with matching projection and no Google or directions request in simple mode', async () => {
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'test-token'); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const map = await buildTripVideoMap(trip, 'satellite', 'simple');
    expect(map.mapUrl).toContain('api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/');
    expect(map.mapUrl).toContain('/426x574@2x'); expect(fetcher).not.toHaveBeenCalled();
    expect(map.points[1]).toMatchObject({ label: 'Alishan day trip', excursion: true });
    expect(map.points[2]).toMatchObject({ label: '', hidden: true });
    expect(map.legs).toHaveLength(3);
    expect(map.points.every(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)).toBe(true);
  });
  it('uses returned road geometry, bounds lookups, and falls back when unavailable', async () => {
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'test-token');
    const fetcher = vi.fn(async () => Response.json({ routes: [{ geometry: { coordinates: [[120.2269, 22.9999], [120.5, 23.1], [120.809, 23.519]] } }] }));
    vi.stubGlobal('fetch', fetcher);
    const map = await buildTripVideoMap(trip, 'dark', 'realistic');
    expect(map.legs[0]).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ hostname: 'api.mapbox.com' }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fetcher.mockImplementation(async () => { throw new Error('offline'); });
    const many = { items: Array.from({ length: 30 }, (_, i) => ({ type: 'city', coordinates: { lat: 23 + i * .01, lng: 121 } })) };
    fetcher.mockClear();
    const fallback = await buildTripVideoMap(many, 'clean', 'realistic');
    expect(fetcher).toHaveBeenCalledTimes(8); expect(fallback.legs.every(leg => leg.length === 2)).toBe(true);
  });
  it('invalidates video content when routes, activity coordinates, or styles change', () => {
    expect(videoRevision(trip, 'clean')).not.toBe(videoRevision(trip, 'clean', 'realistic'));
    expect(videoRevision(trip, 'clean')).not.toBe(videoRevision({ ...trip, items: trip.items.map(item => item.type === 'activity' ? { ...item, coordinates: { lat: 24, lng: 121 } } : item) }, 'clean'));
  });
  it('allows explicit refresh after five minutes but still deduplicates and rate limits autosaves', async () => {
    const now = 10_000_000;
    const old = { data: { status: 'ready', revision: 'old', requestedAt: now - TRIP_VIDEO.refreshCooldownMs }, etag: 'etag' };
    const store = { getWithMetadata: vi.fn(async () => old), setJSON: vi.fn(async () => ({ modified: true })) };
    expect(await claimVideo(store as any, 'trip', 'new', 'dark', false, now)).toMatchObject({ limited: true });
    expect(await claimVideo(store as any, 'trip', 'new', 'dark', true, now, 'realistic')).toMatchObject({ claimed: true, state: { style: 'dark', routeMode: 'realistic' } });
    old.data.status = 'rendering'; old.data.requestedAt = now - 1;
    expect(await claimVideo(store as any, 'trip', 'new', 'dark', true, now)).toMatchObject({ claimed: false });
  });
});
