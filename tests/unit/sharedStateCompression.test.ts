import { describe, expect, it, vi } from 'vitest';

import { compressTrip, decompressTrip } from '../../utils';
import { makeTrip } from '../helpers/tripFixtures';

describe('shared trip compression', () => {
  it('round-trips valid shared trip payloads', () => {
    const trip = makeTrip({ title: 'Compressed trip' });
    const encoded = compressTrip(trip, {
      layoutMode: 'horizontal',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      mapDockMode: 'floating',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1.25,
      sidebarWidth: 640,
      detailsWidth: 420,
      timelineHeight: 360,
    });

    expect(decompressTrip(encoded)).toEqual({
      trip,
      view: expect.objectContaining({
        mapDockMode: 'floating',
        detailsWidth: 420,
      }),
    });
  });

  it('returns null without logging for non-shared route ids', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(decompressTrip('trip-plain-route-id')).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
