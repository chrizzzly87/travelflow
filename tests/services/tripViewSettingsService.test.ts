// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { readPersistedTripViewSettings, resolveTripInitialViewSettings } from '../../services/tripViewSettingsService';

describe('services/tripViewSettingsService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads persisted trip-view settings from storage without inventing unrelated defaults', () => {
    window.localStorage.setItem('tf_map_style', 'satellite');
    window.localStorage.setItem('tf_route_mode', 'realistic');
    window.localStorage.setItem('tf_city_names', 'false');
    window.localStorage.setItem('tf_zoom_level', '2.25');

    expect(readPersistedTripViewSettings()).toEqual({
      mapStyle: 'satellite',
      routeMode: 'realistic',
      showCityNames: false,
      zoomLevel: 2.25,
    });
  });

  it('keeps owner-route visual preferences on refresh when persisted storage is allowed to override fallback defaults', () => {
    window.localStorage.setItem('tf_map_style', 'dark');
    window.localStorage.setItem('tf_route_mode', 'realistic');

    expect(resolveTripInitialViewSettings({
      preferredView: {
        mapStyle: 'minimal',
        routeMode: 'simple',
        layoutMode: 'horizontal',
        timelineMode: 'calendar',
        timelineView: 'horizontal',
        zoomLevel: 1,
      },
      allowPersistedOverrides: true,
    })).toMatchObject({
      mapStyle: 'dark',
      routeMode: 'realistic',
      layoutMode: 'horizontal',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
    });
  });

  it('preserves authoritative shared/history view settings when persisted overrides are disabled', () => {
    window.localStorage.setItem('tf_map_style', 'dark');

    expect(resolveTripInitialViewSettings({
      preferredView: {
        mapStyle: 'satellite',
        layoutMode: 'horizontal',
        timelineMode: 'calendar',
        timelineView: 'horizontal',
        zoomLevel: 1,
      },
      allowPersistedOverrides: false,
    })).toMatchObject({
      mapStyle: 'satellite',
    });
  });
});
