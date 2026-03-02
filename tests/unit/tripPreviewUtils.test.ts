import { describe, expect, it } from 'vitest';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

import { buildDirectStaticMapPreviewUrlWithKey, buildMiniMapUrl } from '../../components/profile/tripPreviewUtils';

describe('components/profile/tripPreviewUtils buildMiniMapUrl', () => {
  it('uses city colors for markers and route legs when color data is available', () => {
    const trip = makeTrip({
      items: [
        makeCityItem({
          id: 'city-1',
          title: 'Osaka',
          startDateOffset: 0,
          duration: 2,
          color: '#16a34a',
          coordinates: { lat: 34.6937, lng: 135.5023 },
        }),
        makeCityItem({
          id: 'city-2',
          title: 'Kyoto',
          startDateOffset: 2,
          duration: 2,
          color: 'rgb(220, 38, 38)',
          coordinates: { lat: 35.0116, lng: 135.7681 },
        }),
        makeCityItem({
          id: 'city-3',
          title: 'Tokyo',
          startDateOffset: 4,
          duration: 3,
          color: '#2563eb',
          coordinates: { lat: 35.6762, lng: 139.6503 },
        }),
      ],
    });

    const url = buildMiniMapUrl(trip, 'en');
    expect(url).toBeTruthy();
    expect(url).toContain('/api/trip-map-preview?');

    const params = new URL(url!, 'https://travelflow.local').searchParams;

    expect(params.get('coords')).toBe('34.693700,135.502300|35.011600,135.768100|35.676200,139.650300');
    expect(params.get('style')).toBe('standard');
    expect(params.get('routeMode')).toBe('simple');
    expect(params.get('colorMode')).toBe('trip');
    expect(params.get('pathColor')).toBe('16a34a');
    expect(params.get('legColors')).toBe('dc2626|2563eb');
    expect(params.get('startMarkerColor')).toBe('16a34a');
    expect(params.get('endMarkerColor')).toBe('2563eb');
    expect(params.get('waypointColor')).toBe('f97316');
    expect(params.get('language')).toBe('en');
  });

  it('falls back to orange-red map colors when trip city colors are unavailable', () => {
    const trip = makeTrip({
      items: [
        { ...makeCityItem({
          id: 'city-a',
          title: 'Lisbon',
          startDateOffset: 0,
          duration: 2,
          coordinates: { lat: 38.7223, lng: -9.1393 },
        }), color: '' },
        { ...makeCityItem({
          id: 'city-b',
          title: 'Porto',
          startDateOffset: 2,
          duration: 2,
          coordinates: { lat: 41.1579, lng: -8.6291 },
        }), color: '' },
        { ...makeCityItem({
          id: 'city-c',
          title: 'Madrid',
          startDateOffset: 4,
          duration: 2,
          coordinates: { lat: 40.4168, lng: -3.7038 },
        }), color: '' },
      ],
    });

    const url = buildMiniMapUrl(trip, 'en');
    expect(url).toBeTruthy();

    const params = new URL(url!, 'https://travelflow.local').searchParams;

    expect(params.get('pathColor')).toBe('f97316');
    expect(params.get('legColors')).toBe('f97316|f97316');
    expect(params.get('startMarkerColor')).toBe('f97316');
    expect(params.get('endMarkerColor')).toBe('ef4444');
    expect(params.get('waypointColor')).toBe('f97316');
  });

  it('supports one-city trips via edge proxy fallback params', () => {
    const trip = makeTrip({
      items: [
        makeCityItem({
          id: 'city-only',
          title: 'Berlin',
          startDateOffset: 0,
          duration: 2,
          color: '#2563eb',
          coordinates: { lat: 52.52, lng: 13.405 },
        }),
      ],
    });

    const url = buildMiniMapUrl(trip, 'de');
    expect(url).toBeTruthy();

    const params = new URL(url!, 'https://travelflow.local').searchParams;

    expect(params.get('coords')).toBe('52.520000,13.405000');
    expect(params.get('legColors')).toBeNull();
    expect(params.get('pathColor')).toBe('2563eb');
    expect(params.get('startMarkerColor')).toBe('2563eb');
    expect(params.get('endMarkerColor')).toBe('2563eb');
    expect(params.get('language')).toBe('de');
  });

  it('builds a valid direct Static Maps URL with paths and markers for local fallback', () => {
    const params = new URLSearchParams();
    params.set('coords', '34.693700,135.502300|35.011600,135.768100|35.676200,139.650300');
    params.set('style', 'standard');
    params.set('routeMode', 'simple');
    params.set('colorMode', 'trip');
    params.set('pathColor', '16a34a');
    params.set('startMarkerColor', '16a34a');
    params.set('endMarkerColor', '2563eb');
    params.set('waypointColor', 'f97316');
    params.set('legColors', 'dc2626|2563eb');
    params.set('w', '640');
    params.set('h', '360');
    params.set('scale', '2');
    params.set('language', 'en');

    const url = buildDirectStaticMapPreviewUrlWithKey(params, 'test-key');
    expect(url).toBeTruthy();

    const query = new URL(url!, 'https://travelflow.local').searchParams;
    expect(query.get('size')).toBe('640x360');
    expect(query.get('scale')).toBe('2');
    expect(query.get('maptype')).toBe('roadmap');
    expect(query.get('language')).toBe('en');
    expect(query.get('key')).toBe('test-key');
    expect(query.getAll('path')).toEqual([
      'color:0xdc2626|weight:4|34.693700,135.502300|35.011600,135.768100',
      'color:0x2563eb|weight:4|35.011600,135.768100|35.676200,139.650300',
    ]);
    expect(query.getAll('markers')).toEqual([
      'size:mid|color:0x16a34a|label:S|34.693700,135.502300',
      'size:mid|color:0x2563eb|label:E|35.676200,139.650300',
      'size:tiny|color:0x2563eb|35.011600,135.768100',
    ]);
  });

  it('builds a direct Static Maps URL for one-city previews without path params', () => {
    const params = new URLSearchParams();
    params.set('coords', '52.520000,13.405000');
    params.set('style', 'dark');
    params.set('colorMode', 'trip');
    params.set('pathColor', '2563eb');
    params.set('startMarkerColor', '2563eb');
    params.set('w', '640');
    params.set('h', '360');
    params.set('scale', '2');

    const url = buildDirectStaticMapPreviewUrlWithKey(params, 'test-key');
    expect(url).toBeTruthy();

    const query = new URL(url!, 'https://travelflow.local').searchParams;
    expect(query.getAll('path')).toHaveLength(0);
    expect(query.getAll('markers')).toEqual([
      'size:mid|color:0x2563eb|label:S|52.520000,13.405000',
    ]);
    expect(query.getAll('style').length).toBeGreaterThan(0);
  });
});
