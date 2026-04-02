import { describe, expect, it } from 'vitest';

import type { ITrip } from '../../types';
import { normalizeTripForRuntime, normalizeViewSettingsForRuntime } from '../../shared/tripRuntimeNormalization';

describe('shared/tripRuntimeNormalization', () => {
  it('normalizes malformed trip items and default view payloads for runtime use', () => {
    const trip = {
      id: 'trip-1',
      title: 'Broken trip',
      startDate: '2026-03-18',
      items: [
        {
          id: 'city-1',
          type: 'city',
          title: 'Broken city',
          startDateOffset: undefined,
          duration: undefined,
          color: 'bg-slate-100',
          coordinates: { lat: undefined, lng: 13.405 },
        },
        {
          id: 'travel-1',
          type: 'travel',
          title: 'Legacy rail leg',
          startDateOffset: 1,
          duration: 0,
          color: 'bg-slate-100',
          transportMode: 'rail',
          routeDistanceKm: Number.NaN,
          routeDurationHours: 4.5,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      defaultView: {
        layoutMode: 'horizontal',
        timelineView: 'horizontal',
        mapStyle: 'standard',
        zoomLevel: undefined,
        timelineMode: undefined,
      },
    } as unknown as ITrip;

    const normalized = normalizeTripForRuntime(trip);

    expect(normalized.defaultView).toMatchObject({
      layoutMode: 'horizontal',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      mapStyle: 'standard',
      zoomLevel: 1,
    });
    expect(normalized.items[0]).toMatchObject({
      startDateOffset: 0,
      duration: 1,
      coordinates: undefined,
    });
    expect(normalized.items[1]).toMatchObject({
      type: 'travel',
      transportMode: 'train',
      duration: 0.25,
      routeDistanceKm: undefined,
    });
  });

  it('normalizes partial view settings with safe defaults', () => {
    expect(normalizeViewSettingsForRuntime({
      layoutMode: 'vertical',
      timelineView: 'horizontal',
      mapStyle: 'cleanDark',
      zoomLevel: undefined,
    } as any)).toEqual({
      layoutMode: 'vertical',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      mapStyle: 'cleanDark',
      zoomLevel: 1,
      zoomBehavior: 'fit',
      mapDockMode: undefined,
      routeMode: undefined,
      showCityNames: undefined,
      sidebarWidth: undefined,
      detailsWidth: undefined,
      timelineHeight: undefined,
    });
  });
});
