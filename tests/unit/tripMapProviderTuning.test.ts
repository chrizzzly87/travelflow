import { describe, expect, it } from 'vitest';

import {
  getTripMapProviderTuning,
  resolveTripMapViewportPadding,
} from '../../components/maps/tripMapProviderTuning';

describe('components/maps/tripMapProviderTuning', () => {
  it('returns provider-specific trip-map tuning values', () => {
    const googleTuning = getTripMapProviderTuning('google');
    const mapboxTuning = getTripMapProviderTuning('mapbox');

    expect(googleTuning.selection.cityFocusZoom).toBe(10);
    expect(mapboxTuning.selection.cityFocusZoom).toBeLessThan(googleTuning.selection.cityFocusZoom);
    expect(mapboxTuning.selection.safeInsetRatio).toBeGreaterThan(googleTuning.selection.safeInsetRatio);
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
    expect(mapboxDockedPadding.top).toBeGreaterThan(googleDockedPadding.top);
    expect(mapboxDockedPadding.left).toBeGreaterThan(googleDockedPadding.left);
    expect(mapboxFloatingPadding.top).toBeGreaterThan(mapboxDockedPadding.top);
    expect(mapboxFloatingPadding.left).toBeGreaterThan(mapboxDockedPadding.left);
  });
});
