import { describe, expect, it } from 'vitest';

import {
  getTripMapProviderTuning,
  resolveTripMapSelectionSafeInsetRatio,
  resolveTripMapViewportPadding,
  resolveTripMapRestingProjection,
  shouldUseTripMapGlobeIntro,
} from '../../components/maps/tripMapProviderTuning';

describe('components/maps/tripMapProviderTuning', () => {
  it('returns provider-specific trip-map tuning values', () => {
    const googleTuning = getTripMapProviderTuning('google');
    const mapboxTuning = getTripMapProviderTuning('mapbox');

    expect(googleTuning.selection.cityFocusZoom).toBe(10);
    expect(mapboxTuning.selection.cityFocusZoom).toBeLessThan(googleTuning.selection.cityFocusZoom);
    expect(mapboxTuning.selection.safeInsetRatio).toBeLessThan(googleTuning.selection.safeInsetRatio);
    expect(mapboxTuning.selection.floatingSafeInsetRatio).toBeLessThan(mapboxTuning.selection.safeInsetRatio);
    expect(mapboxTuning.markers.cityZoomProfile.mediumCircleMaxZoom)
      .toBeGreaterThan(googleTuning.markers.cityZoomProfile.mediumCircleMaxZoom);
  });

  it('creates roomier viewport padding for the mixed Mapbox renderer', () => {
    const googleDockedPadding = resolveTripMapViewportPadding({
      provider: 'google',
      mapDockMode: 'docked',
      mapViewportSize: { width: 640, height: 420 },
    });
    const mapboxDockedPadding = resolveTripMapViewportPadding({
      provider: 'mapbox',
      mapDockMode: 'docked',
      mapViewportSize: { width: 640, height: 420 },
    });
    const mapboxFloatingPadding = resolveTripMapViewportPadding({
      provider: 'mapbox',
      mapDockMode: 'floating',
      mapViewportSize: { width: 640, height: 420 },
    });

    expect(googleDockedPadding).toEqual({
      top: 130,
      right: 130,
      bottom: 130,
      left: 130,
    });
    expect(mapboxDockedPadding.top).toBeLessThan(googleDockedPadding.top);
    expect(mapboxDockedPadding.left).toBeLessThan(googleDockedPadding.left);
    expect(mapboxFloatingPadding.top).toBeLessThan(mapboxDockedPadding.top);
    expect(mapboxFloatingPadding.left).toBeLessThan(mapboxDockedPadding.left);
  });

  it('uses a tighter safe inset for floating Mapbox recentering than for docked maps', () => {
    expect(resolveTripMapSelectionSafeInsetRatio({
      provider: 'mapbox',
      mapDockMode: 'floating',
    })).toBeLessThan(resolveTripMapSelectionSafeInsetRatio({
      provider: 'mapbox',
      mapDockMode: 'docked',
    }));

    expect(resolveTripMapSelectionSafeInsetRatio({
      provider: 'google',
      mapDockMode: 'floating',
    })).toBeLessThan(resolveTripMapSelectionSafeInsetRatio({
      provider: 'google',
      mapDockMode: 'docked',
    }));
  });

  it('uses a flat resting projection for Mapbox trip views and only enables the globe intro on larger docked viewports', () => {
    expect(resolveTripMapRestingProjection({
      provider: 'mapbox',
      mapDockMode: 'docked',
    })).toBe('mercator');
    expect(resolveTripMapRestingProjection({
      provider: 'mapbox',
      mapDockMode: 'floating',
    })).toBe('mercator');
    expect(resolveTripMapRestingProjection({
      provider: 'google',
      mapDockMode: 'docked',
    })).toBe(null);

    expect(shouldUseTripMapGlobeIntro({
      provider: 'mapbox',
      mapDockMode: 'floating',
      mapViewportSize: { width: 800, height: 520 },
    })).toBe(false);
    expect(shouldUseTripMapGlobeIntro({
      provider: 'mapbox',
      mapDockMode: 'docked',
      mapViewportSize: { width: 420, height: 280 },
    })).toBe(false);
    expect(shouldUseTripMapGlobeIntro({
      provider: 'mapbox',
      mapDockMode: 'docked',
      mapViewportSize: { width: 860, height: 520 },
    })).toBe(true);
  });
});
