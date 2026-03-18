import { describe, expect, it } from 'vitest';

import {
  getTripMapProviderPresentation,
  resolveTripMapCityLabelOffsetPx,
  resolveTripMapDarkRoutePresentation,
  resolveTripMapFlightCurveOptions,
  resolveTripMapFlightGroundShadowStyle,
} from '../../components/maps/tripMapProviderPresentation';

describe('components/maps/tripMapProviderPresentation', () => {
  it('keeps mapbox presentation independently tunable from google', () => {
    const google = getTripMapProviderPresentation('google');
    const mapbox = getTripMapProviderPresentation('mapbox');

    expect(mapbox.cityLabels.offsetMultiplier).toBeGreaterThan(google.cityLabels.offsetMultiplier);
    expect(mapbox.cityLabels.minOffsetPx).toBeGreaterThan(google.cityLabels.minOffsetPx);
    expect(mapbox.flights.curve.samples).toBeGreaterThan(google.flights.curve.samples);
    expect(mapbox.flights.groundShadow.weightMultiplier).toBeGreaterThan(google.flights.groundShadow.weightMultiplier);
  });

  it('exposes future-ready image badge support on city markers', () => {
    const google = getTripMapProviderPresentation('google');
    const mapbox = getTripMapProviderPresentation('mapbox');

    expect(google.markers.city.imageBadge.supported).toBe(true);
    expect(mapbox.markers.city.imageBadge.supported).toBe(true);
    expect(mapbox.markers.city.imageBadge.sizeRatio).toBeGreaterThan(google.markers.city.imageBadge.sizeRatio);
  });

  it('derives provider-aware label offsets and flight shadow styling', () => {
    expect(resolveTripMapCityLabelOffsetPx({
      provider: 'mapbox',
      markerSize: 28,
    })).toBeGreaterThan(resolveTripMapCityLabelOffsetPx({
      provider: 'google',
      markerSize: 28,
    }));

    expect(resolveTripMapFlightCurveOptions('mapbox').samples).toBe(28);
    expect(resolveTripMapFlightGroundShadowStyle({
      provider: 'mapbox',
      style: 'satellite',
      baseWeight: 3,
    })).toMatchObject({
      color: 'rgba(15, 23, 42, 0.34)',
      opacity: 0.18,
      weight: 2.82,
    });
  });

  it('keeps dark-route presentation independently tunable per provider', () => {
    const googleDarkRoutes = resolveTripMapDarkRoutePresentation('google');
    const mapboxDarkRoutes = resolveTripMapDarkRoutePresentation('mapbox');

    expect(mapboxDarkRoutes.mainOpacity).toBeGreaterThan(googleDarkRoutes.mainOpacity);
    expect(mapboxDarkRoutes.shadowOpacity).toBeLessThan(googleDarkRoutes.shadowOpacity);
    expect(mapboxDarkRoutes.shadowWidthBoost).toBeLessThan(googleDarkRoutes.shadowWidthBoost);
  });
});
