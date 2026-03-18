import { describe, expect, it } from 'vitest';

import type { ITimelineItem } from '../../types';
import { collectTripMapFitBoundsCoordinates } from '../../components/maps/tripMapFitBoundsGeometry';

const buildCity = (
  overrides: Partial<ITimelineItem>,
): ITimelineItem => ({
  id: overrides.id ?? 'city',
  type: overrides.type ?? 'city',
  title: overrides.title ?? 'City',
  startDateOffset: overrides.startDateOffset ?? 0,
  duration: overrides.duration ?? 1,
  color: overrides.color ?? 'bg-blue-500',
  coordinates: overrides.coordinates,
  transportMode: overrides.transportMode,
});

describe('components/maps/tripMapFitBoundsGeometry', () => {
  it('includes curved flight arc points so fit bounds reflect the visible route', () => {
    const cities: ITimelineItem[] = [
      buildCity({
        id: 'bangkok',
        title: 'Bangkok',
        coordinates: { lat: 13.7563, lng: 100.5018 },
      }),
      buildCity({
        id: 'siem-reap',
        title: 'Siem Reap',
        startDateOffset: 3,
        coordinates: { lat: 13.3633, lng: 103.8564 },
      }),
    ];
    const flightItem: ITimelineItem = buildCity({
      id: 'flight-1',
      type: 'travel',
      title: 'Bangkok to Siem Reap',
      startDateOffset: 2,
      duration: 0.25,
      transportMode: 'plane',
    });

    const coordinates = collectTripMapFitBoundsCoordinates({
      cities,
      items: [cities[0], flightItem, cities[1]],
      provider: 'mapbox',
    });

    expect(coordinates.length).toBeGreaterThan(2);
    const midpoint = coordinates[Math.floor(coordinates.length / 2)];
    expect(midpoint.lat).toBeGreaterThan((cities[0].coordinates!.lat + cities[1].coordinates!.lat) / 2);
  });
});
