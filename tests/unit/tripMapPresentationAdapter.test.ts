import { describe, expect, it } from 'vitest';
import { buildTripMapPresentation, mapPresentationToTimelineItems } from '../../services/tripMapPresentationAdapter';
import { validateMapPresentation, type MapPresentationModel } from '../../shared/mapPresentation';
import type { JourneySpec } from '../../shared/journeySpec';
import type { ITrip } from '../../types';

const trip: ITrip = {
  id: 'trip-map-contract',
  title: 'Thailand route',
  startDate: '2026-12-01',
  createdAt: 1,
  updatedAt: 1,
  planningMeta: {
    journeySpec: {} as JourneySpec,
    routeStage: 'skeleton',
    datasetVersion: '2026.07.16-v3',
    templateKey: 'th-test-route',
    templateVersion: 1,
    destinationBriefs: [],
  },
  items: [
    { id: 'bangkok', type: 'city', title: 'Bangkok', startDateOffset: 0, duration: 3, color: '#f59e0b', coordinates: { lat: 13.7563, lng: 100.5018 } },
    { id: 'to-chiang-mai', type: 'travel', title: 'Train north', startDateOffset: 2.9, duration: 0.1, color: '#64748b', transportMode: 'train', routeDistanceKm: 685, routeDurationHours: 11 },
    { id: 'chiang-mai', type: 'city', title: 'Chiang Mai', startDateOffset: 3, duration: 4, color: '#14b8a6', coordinates: { lat: 18.7883, lng: 98.9853 } },
    { id: 'old-city', type: 'activity', title: 'Old City', startDateOffset: 3.4, duration: 0.2, color: '#a855f7', activityType: ['culture'], coordinates: { lat: 18.7878, lng: 98.9817 } },
    { id: 'night-market', type: 'activity', title: 'Night Market', startDateOffset: 4.2, duration: 0.2, color: '#f59e0b', activityType: ['food'] },
  ],
};

describe('trip map presentation adapter', () => {
  it('builds a provider-neutral marker and route contract with provenance', () => {
    const presentation = buildTripMapPresentation(trip, { selectedItemId: 'chiang-mai' });

    expect(validateMapPresentation(presentation)).toEqual({ valid: true, errors: [] });
    expect(presentation.markers).toHaveLength(4);
    expect(presentation.routeLegs).toEqual([
      expect.objectContaining({
        fromMarkerId: 'city:bangkok',
        toMarkerId: 'city:chiang-mai',
        mode: 'train',
        geometryStatus: 'computed',
        distanceMeters: 685_000,
        durationSeconds: 39_600,
      }),
    ]);
    expect(presentation.selection.markerId).toBe('city:chiang-mai');
    expect(presentation.markers.find((marker) => marker.sourceItemId === 'night-market')).toMatchObject({
      position: { lat: 18.7883, lng: 98.9853 },
      metadata: { coordinateSource: 'city' },
    });
    expect(presentation.context).toMatchObject({
      source: 'travelflow_trip',
      datasetVersion: '2026.07.16-v3',
      templateKey: 'th-test-route',
    });
  });

  it('adapts the neutral model back into the current map timeline boundary', () => {
    const presentation = buildTripMapPresentation(trip);
    const items = mapPresentationToTimelineItems(presentation);

    expect(items.find((item) => item.id === 'old-city')).toMatchObject({
      type: 'activity',
      activityType: ['culture'],
    });
    expect(items.find((item) => item.id === 'to-chiang-mai')).toMatchObject({
      type: 'travel',
      transportMode: 'train',
      routeDistanceKm: 685,
      routeDurationHours: 11,
    });
    expect(items.find((item) => item.id === 'night-market')).toMatchObject({
      type: 'activity',
      coordinates: undefined,
    });
  });

  it('keeps legacy trips with reused travel item ids renderable', () => {
    const legacyTrip: ITrip = {
      ...trip,
      id: 'legacy-duplicate-travel-ids',
      planningMeta: undefined,
      items: [
        { id: 'bangkok', type: 'city', title: 'Bangkok', startDateOffset: 0, duration: 3, color: '#f59e0b', coordinates: { lat: 13.7563, lng: 100.5018 } },
        { id: 'travel-5-1773407232863', type: 'travel', title: 'Travel', startDateOffset: 2.9, duration: 0.1, color: '#64748b', transportMode: 'train' },
        { id: 'ayutthaya', type: 'city', title: 'Ayutthaya', startDateOffset: 3, duration: 2, color: '#f97316', coordinates: { lat: 14.3532, lng: 100.5689 } },
        { id: 'travel-5-1773407232863', type: 'travel', title: 'Travel', startDateOffset: 4.9, duration: 0.1, color: '#64748b', transportMode: 'bus' },
        { id: 'sukhothai', type: 'city', title: 'Sukhothai', startDateOffset: 5, duration: 2, color: '#d97706', coordinates: { lat: 17.0056, lng: 99.8264 } },
      ],
    };

    const presentation = buildTripMapPresentation(legacyTrip);

    expect(validateMapPresentation(presentation)).toEqual({ valid: true, errors: [] });
    expect(presentation.routeLegs.map((leg) => leg.id)).toEqual([
      'route:travel-5-1773407232863',
      'route:travel-5-1773407232863:leg-1',
    ]);
  });

  it('rejects duplicate markers and dangling route references', () => {
    const presentation = buildTripMapPresentation(trip);
    const invalid: MapPresentationModel = {
      ...presentation,
      markers: [...presentation.markers, presentation.markers[0]!],
      routeLegs: [{ ...presentation.routeLegs[0]!, toMarkerId: 'city:missing' }],
    };

    const result = validateMapPresentation(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Marker id city:bangkok is duplicated.',
      'Route leg route:to-chiang-mai references an unknown end marker.',
    ]));
  });
});
