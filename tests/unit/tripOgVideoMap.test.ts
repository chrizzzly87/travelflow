import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTripVideoMap, buildTripVideoStops, tripVideoStopLabel } from '../../netlify/lib/trip-video-map';
import { videoRevision, claimVideo } from '../../netlify/lib/trip-video-store';
import { buildTripOgSummary } from '../../netlify/edge-lib/trip-og-data';
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
    expect(map.legs[2]).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ hostname: 'api.mapbox.com' }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fetcher.mockImplementation(async () => { throw new Error('offline'); });
    const many = { items: Array.from({ length: 30 }, (_, i) => ({ type: 'city', coordinates: { lat: 23 + i * .01, lng: 121 } })) };
    fetcher.mockClear();
    const fallback = await buildTripVideoMap(many, 'clean', 'realistic');
    expect(fetcher).toHaveBeenCalledTimes(8); expect(fallback.legs.every(leg => leg.length === 2)).toBe(true);
  });
  it('honors explicit nearby day trips and their custom return stay, while ordinary distant activities stay ordinary', async () => {
    const items = [
      { id: 'base', type: 'city', title: 'Base', color: '#ff0000', startDateOffset: 0, duration: 1, coordinates: { lat: 23, lng: 121 } },
      { id: 'next', type: 'city', title: 'Next', color: '#00ff00', startDateOffset: 1, duration: 1, coordinates: { lat: 24, lng: 121 } },
      { id: 'day', type: 'activity', activityKind: 'day-trip', stayCityId: 'base', dayTripReturnCityId: 'next', title: 'Nearby visit', startDateOffset: 0, coordinates: { lat: 23.001, lng: 121 } },
      { id: 'ordinary', type: 'activity', activityKind: 'activity', title: 'Ordinary far visit', startDateOffset: 0, coordinates: { lat: 25, lng: 121 } },
    ];
    const stops = buildTripVideoStops({ items });
    expect(stops.map(stop => stop.id)).toEqual(['base', 'day', 'next', 'next']);
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'test-token');
    const map = await buildTripVideoMap({ items }, 'standard');
    expect(map.legStyles.slice(0, 2)).toEqual([{ color: '#ff0000', dashed: true }, { color: '#ff0000', dashed: true }]);
  });
  it.each(['train', 'flight', 'ferry'])('does not road-route an overnight %s leg', async transportMode => {
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'test-token'); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const items = [
      { type: 'city', startDateOffset: 0, duration: 2, coordinates: { lat: 23, lng: 121 } },
      { type: 'travel', startDateOffset: 2, duration: 1, transportMode },
      { type: 'city', startDateOffset: 3, duration: 1, coordinates: { lat: 24, lng: 121 } },
    ];
    await buildTripVideoMap({ items }, 'standard', 'realistic');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reuses bounded geometry on style changes and refresh, keyed by coordinates and mode', async () => {
    vi.stubEnv('VITE_MAPBOX_ACCESS_TOKEN', 'test-token');
    const fetcher = vi.fn(async () => Response.json({ routes: [{ geometry: { coordinates: [[121, 23], [121.1, 23.5], [121, 24]] } }] }));
    vi.stubGlobal('fetch', fetcher);
    const items = [
      { type: 'city', color: '#ff0000', startDateOffset: 0, duration: 1, coordinates: { lat: 23, lng: 121 } },
      { type: 'travel', startDateOffset: 1, transportMode: 'bus' },
      { type: 'city', color: '#00ff00', startDateOffset: 1, duration: 1, coordinates: { lat: 24, lng: 121 } },
    ];
    const cache: import('../../netlify/lib/trip-video-map').TripVideoRouteCache = [];
    const first = await buildTripVideoMap({ items }, 'standard', 'realistic', cache);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(first.legStyles[0].color).toBe('#ff0000');
    await buildTripVideoMap({ items }, 'dark', 'realistic', cache);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await buildTripVideoMap({ items: items.map(item => item.type === 'travel' ? { ...item, transportMode: 'walk' } : item) }, 'standard', 'realistic', cache);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.length).toBeLessThanOrEqual(16);
  });
  it.each(['google', 'mapbox'] as const)('keeps per-leg colors on the %s OG image as well as the video', async provider => {
    const items = [
      { type: 'city', color: '#ff0000', startDateOffset: 0, duration: 1, coordinates: { lat: 23, lng: 121 } },
      { type: 'city', color: '#00ff00', startDateOffset: 1, duration: 1, coordinates: { lat: 24, lng: 121 } },
      { type: 'city', color: '#0000ff', startDateOffset: 2, duration: 1, coordinates: { lat: 25, lng: 121 } },
    ];
    const summary = await buildTripOgSummary({ items }, { includeMapImage: true, mapsApiKey: 'test', mapboxAccessToken: 'test', mapStyle: 'standard', routeMode: 'simple', mapColorMode: 'trip',
      mapRuntimeSelection: { renderer: provider, routes: provider, locationSearch: provider, staticMaps: provider } });
    const url = decodeURIComponent(summary.mapImageUrl || '');
    expect(url).toContain('ff0000'); expect(url).toContain('00ff00');
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
