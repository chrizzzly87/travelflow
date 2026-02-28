import { describe, expect, it, vi } from 'vitest';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

vi.mock('../../utils', async () => {
  const actual = await vi.importActual<typeof import('../../utils')>('../../utils');
  return {
    ...actual,
    getGoogleMapsApiKey: () => 'maps-key',
  };
});

import { buildMiniMapUrl } from '../../components/profile/tripPreviewUtils';

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

    const params = new URL(url!).searchParams;
    const markers = params.getAll('markers');
    const paths = params.getAll('path');

    expect(markers[0]).toContain('size:mid|color:0x16a34a|label:S');
    expect(markers[1]).toContain('size:mid|color:0x2563eb|label:E');
    expect(markers.some((marker) => marker.includes('size:tiny|color:0xdc2626|'))).toBe(true);

    expect(paths).toHaveLength(2);
    expect(paths[0]).toContain('color:0xdc2626|weight:4');
    expect(paths[1]).toContain('color:0x2563eb|weight:4');
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

    const params = new URL(url!).searchParams;
    const markers = params.getAll('markers');
    const paths = params.getAll('path');

    expect(markers[0]).toContain('size:mid|color:0xf97316|label:S');
    expect(markers[1]).toContain('size:mid|color:0xef4444|label:E');
    expect(markers.some((marker) => marker.includes('size:tiny|color:0xf97316|'))).toBe(true);
    expect(paths.every((path) => path.includes('color:0xf97316|weight:4'))).toBe(true);
  });
});
