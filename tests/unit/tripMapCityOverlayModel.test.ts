import { describe, expect, it } from 'vitest';

import type { ITimelineItem } from '../../types';
import {
  buildTripMapCityLabelOverlayDescriptors,
  buildTripMapCityOverlayDescriptors,
} from '../../components/maps/tripMapCityOverlayModel';

const buildCity = (overrides: Partial<ITimelineItem>): ITimelineItem => ({
  id: overrides.id ?? 'city',
  type: 'city',
  title: overrides.title ?? 'Bangkok',
  location: overrides.location ?? 'Bangkok, Thailand',
  coordinates: overrides.coordinates ?? { lat: 13.7563, lng: 100.5018 },
  startDateOffset: overrides.startDateOffset ?? 0,
  duration: overrides.duration ?? 2,
  color: overrides.color ?? 'from-blue-500 to-cyan-400',
  notes: overrides.notes ?? '',
  link: overrides.link ?? '',
  activityType: overrides.activityType ?? [],
  transportMode: overrides.transportMode ?? '',
  travelTime: overrides.travelTime ?? '',
  cost: overrides.cost ?? '',
  imageUrl: overrides.imageUrl ?? '',
} as ITimelineItem);

describe('components/maps/tripMapCityOverlayModel', () => {
  it('prefers the real city/location name over custom stay titles', () => {
    const descriptors = buildTripMapCityOverlayDescriptors([
      buildCity({
        id: 'bangkok-return',
        title: 'Bangkok (Return)',
        location: 'Bangkok, Thailand',
      }),
    ]);

    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]?.labelName).toBe('Bangkok');
    expect(descriptors[0]?.cityKey).toBe('bangkok');
  });

  it('uses the visible offset marker position for overlapping cities', () => {
    const descriptors = buildTripMapCityOverlayDescriptors([
      buildCity({
        id: 'bangkok-start',
        title: 'Bangkok',
        location: 'Bangkok, Thailand',
      }),
      buildCity({
        id: 'bangkok-end',
        title: 'Bangkok (Return)',
        location: 'Bangkok, Thailand',
      }),
    ]);

    expect(descriptors).toHaveLength(2);
    expect(descriptors[0]?.cityKey).toBe(descriptors[1]?.cityKey);
    expect(descriptors[0]?.markerPosition).not.toEqual(descriptors[1]?.markerPosition);
    expect(descriptors[0]?.labelName).toBe('Bangkok');
    expect(descriptors[1]?.labelName).toBe('Bangkok');
  });

  it('dedupes round-trip labels while keeping the shared visible pin position', () => {
    const cityOverlays = buildTripMapCityOverlayDescriptors([
      buildCity({
        id: 'bangkok-start',
        title: 'Bangkok',
        location: 'Bangkok, Thailand',
      }),
      buildCity({
        id: 'siem-reap',
        title: 'Siem Reap',
        location: 'Siem Reap, Cambodia',
        coordinates: { lat: 13.3633, lng: 103.8564 },
      }),
      buildCity({
        id: 'bangkok-end',
        title: 'Bangkok (Return)',
        location: 'Bangkok, Thailand',
      }),
    ]);

    const labelDescriptors = buildTripMapCityLabelOverlayDescriptors({
      provider: 'mapbox',
      cityOverlays,
    });

    expect(labelDescriptors.map((descriptor) => descriptor.labelName)).toEqual([
      'Bangkok',
      'Siem Reap',
    ]);
    expect(labelDescriptors[0]?.subLabel).toBe('START • END');
    expect(labelDescriptors[0]?.markerPosition).toEqual(cityOverlays[0]?.markerPosition);
  });
});
