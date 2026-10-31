import { describe, expect, it } from 'vitest';

import {
  CITY_MARKER_SELECTED_Z_INDEX,
  CITY_MARKER_Z_INDEX,
  COMPACT_MARKER_RENDER_PROFILE,
  DOCKED_DEFAULT_MARKER_RENDER_PROFILE,
  FLOATING_DEFAULT_MARKER_RENDER_PROFILE,
  MICRO_MARKER_RENDER_PROFILE,
  estimateNearestMarkerGapPx,
  estimateRoutePixelSpan,
  resolveCityMarkerZIndex,
  resolveCrowdedCityMarkerProfile,
  resolveMarkerRenderProfile,
  resolveMarkerRenderTier,
  resolveZoomEnhancedCityMarkerProfile,
} from '../../components/maps/markerRenderProfiles';
import { getTripMapProviderTuning } from '../../components/maps/tripMapProviderTuning';

const berlin = { lat: 52.52, lng: 13.405 };
const potsdam = { lat: 52.3906, lng: 13.0645 };
const munich = { lat: 48.1351, lng: 11.582 };

describe('components/maps/markerRenderProfiles', () => {
  it('returns the same profile object on every call, so memoised profiles never churn', () => {
    expect(resolveMarkerRenderProfile()).toBe(DOCKED_DEFAULT_MARKER_RENDER_PROFILE);
    expect(resolveMarkerRenderProfile({ mapDockMode: 'docked' })).toBe(resolveMarkerRenderProfile({ mapDockMode: 'docked' }));
    expect(resolveMarkerRenderProfile({ mapDockMode: 'floating' })).toBe(FLOATING_DEFAULT_MARKER_RENDER_PROFILE);
    expect(resolveMarkerRenderProfile({ mapDockMode: 'floating', markerTier: 'compact' })).toBe(COMPACT_MARKER_RENDER_PROFILE);
    expect(resolveMarkerRenderProfile({ mapDockMode: 'docked', markerTier: 'micro' })).toBe(MICRO_MARKER_RENDER_PROFILE);
  });

  it('shrinks markers from default through compact to micro', () => {
    const profiles = [
      DOCKED_DEFAULT_MARKER_RENDER_PROFILE,
      COMPACT_MARKER_RENDER_PROFILE,
      MICRO_MARKER_RENDER_PROFILE,
    ];
    for (let index = 1; index < profiles.length; index += 1) {
      expect(profiles[index].city.size).toBeLessThan(profiles[index - 1].city.size);
      expect(profiles[index].activity.size).toBeLessThan(profiles[index - 1].activity.size);
      expect(profiles[index].routeStrokeScale).toBeLessThan(profiles[index - 1].routeStrokeScale);
    }
    expect(MICRO_MARKER_RENDER_PROFILE.transport.show).toBe(false);
  });

  it('doubles the projected route span with every zoom level', () => {
    const atTen = estimateRoutePixelSpan([berlin, munich], 10);
    const atEleven = estimateRoutePixelSpan([berlin, munich], 11);

    expect(atTen).toBeGreaterThan(0);
    expect(atEleven / atTen).toBeCloseTo(2, 6);
    expect(estimateRoutePixelSpan([berlin], 10)).toBe(0);
    expect(estimateRoutePixelSpan([berlin, munich], null)).toBe(0);
  });

  it('measures the nearest pair of distinct markers and ignores duplicates', () => {
    const nearest = estimateNearestMarkerGapPx([berlin, munich, potsdam], 8);
    expect(nearest).toBeCloseTo(estimateRoutePixelSpan([berlin, potsdam], 8), 6);
    expect(estimateNearestMarkerGapPx([berlin, { ...berlin }], 8)).toBe(Number.POSITIVE_INFINITY);
    expect(estimateNearestMarkerGapPx([berlin, munich], null)).toBe(Number.POSITIVE_INFINITY);
  });

  describe('tier selection', () => {
    const tier = getTripMapProviderTuning('google').markers.tier;
    const roomy = { routePixelSpan: 0, nearestMarkerGapPx: 200 };

    it('falls back to the default tier for an unmeasured viewport', () => {
      expect(resolveMarkerRenderTier({ viewportWidth: 0, viewportHeight: 600, zoom: 4, ...roomy })).toBe('default');
      expect(resolveMarkerRenderTier({ viewportWidth: Number.NaN, viewportHeight: 600, zoom: 4, ...roomy })).toBe('default');
    });

    it('goes micro at or below the micro short edge, whatever the zoom', () => {
      expect(resolveMarkerRenderTier({
        viewportWidth: tier.microShortEdge,
        viewportHeight: 900,
        zoom: 14,
        ...roomy,
      })).toBe('micro');
    });

    it('goes compact on a small viewport or at low zoom', () => {
      expect(resolveMarkerRenderTier({
        viewportWidth: tier.compactShortEdge,
        viewportHeight: 900,
        zoom: 14,
        ...roomy,
      })).toBe('compact');
      expect(resolveMarkerRenderTier({ viewportWidth: 900, viewportHeight: 700, zoom: tier.lowZoom, ...roomy })).toBe('compact');
      expect(resolveMarkerRenderTier({ viewportWidth: 900, viewportHeight: 700, zoom: tier.lowZoom + 0.01, ...roomy })).toBe('default');
    });

    it('normalises route coverage to the reference zoom, so zooming alone does not change density', () => {
      const shortEdge = tier.compactDenseMaxShortEdge;
      const denseSpanAtReference = shortEdge * (tier.denseRouteCoverage + 0.1);
      const base = { viewportWidth: shortEdge, viewportHeight: 900, nearestMarkerGapPx: 200 };

      // Same on-the-ground route, one zoom level apart: twice the pixels, same coverage.
      expect(resolveMarkerRenderTier({ ...base, zoom: 7, routePixelSpan: denseSpanAtReference / 8 })).toBe('compact');
      expect(resolveMarkerRenderTier({ ...base, zoom: 8, routePixelSpan: denseSpanAtReference / 4 })).toBe('compact');
      // A route that is not dense enough stays on the default tier.
      expect(resolveMarkerRenderTier({ ...base, zoom: 8, routePixelSpan: (shortEdge * tier.denseRouteCoverage * 0.9) / 4 })).toBe('default');
      // Past the dense-route zoom cutoff, density no longer compacts markers.
      expect(resolveMarkerRenderTier({
        ...base,
        zoom: tier.compactDenseZoomCutoff + 0.5,
        routePixelSpan: denseSpanAtReference * (2 ** (tier.compactDenseZoomCutoff + 0.5 - 10)),
      })).toBe('default');
    });

    it('uses the provider tuning it is given', () => {
      const mapbox = getTripMapProviderTuning('mapbox').markers.tier;
      const zoom = (tier.lowZoom + mapbox.lowZoom) / 2;
      const expectGoogle = zoom <= tier.lowZoom ? 'compact' : 'default';
      const expectMapbox = zoom <= mapbox.lowZoom ? 'compact' : 'default';
      expect(resolveMarkerRenderTier({ provider: 'google', viewportWidth: 900, viewportHeight: 700, zoom, ...roomy })).toBe(expectGoogle);
      expect(resolveMarkerRenderTier({ provider: 'mapbox', viewportWidth: 900, viewportHeight: 700, zoom, ...roomy })).toBe(expectMapbox);
    });
  });

  describe('city marker zoom and crowding adjustments', () => {
    const base = DOCKED_DEFAULT_MARKER_RENDER_PROFILE.city;
    const cityZoom = getTripMapProviderTuning('google').markers.cityZoomProfile;
    const crowding = getTripMapProviderTuning('google').markers.crowding;

    it('only adjusts the default tier and leaves the base profile untouched', () => {
      const snapshot = structuredClone(base);
      expect(resolveZoomEnhancedCityMarkerProfile({ baseProfile: base, markerTier: 'compact', zoom: 3 })).toBe(base);
      expect(resolveZoomEnhancedCityMarkerProfile({ baseProfile: base, markerTier: 'default', zoom: null })).toBe(base);
      resolveZoomEnhancedCityMarkerProfile({ baseProfile: base, markerTier: 'default', zoom: 3 });
      expect(base).toEqual(snapshot);
    });

    it('turns pins into plain circles when zoomed far out and back into pins up close', () => {
      const far = resolveZoomEnhancedCityMarkerProfile({ baseProfile: base, markerTier: 'default', zoom: cityZoom.farCircleMaxZoom - 0.1 });
      expect(far).toMatchObject({ shape: 'circle', showInnerDot: false, numberColor: '#ffffff' });
      expect(far.size).toBe(Math.max(16, Math.round(base.size * 0.64)));

      const close = resolveZoomEnhancedCityMarkerProfile({ baseProfile: base, markerTier: 'default', zoom: 14 });
      expect(close.shape).toBe('pin');
      expect(close.size).toBe(Math.round(base.size * 0.92));
    });

    it('compacts crowded city markers below the crowding zoom', () => {
      const crowded = resolveCrowdedCityMarkerProfile({
        baseProfile: base,
        markerTier: 'default',
        zoom: crowding.disableCrowdingAtZoom - 1,
        nearestMarkerGapPx: crowding.veryCrowdedGapPx - 1,
      });
      expect(crowded).toMatchObject({ shape: 'circle', showInnerDot: false, numberColor: '#ffffff' });
      expect(crowded.size).toBe(Math.max(17, Math.round(base.size * 0.8)));
      expect(crowded.selectedSize).toBeGreaterThanOrEqual(crowded.size + 2);

      expect(resolveCrowdedCityMarkerProfile({
        baseProfile: base,
        markerTier: 'default',
        zoom: crowding.disableCrowdingAtZoom,
        nearestMarkerGapPx: 1,
      })).toBe(base);
      expect(resolveCrowdedCityMarkerProfile({
        baseProfile: base,
        markerTier: 'micro',
        zoom: 3,
        nearestMarkerGapPx: 1,
      })).toBe(base);
      expect(resolveCrowdedCityMarkerProfile({
        baseProfile: base,
        markerTier: 'default',
        zoom: 3,
        nearestMarkerGapPx: crowding.crowdedGapPx,
      })).toBe(base);
    });
  });

  it('stacks bigger and selected city markers above smaller ones', () => {
    const profile = DOCKED_DEFAULT_MARKER_RENDER_PROFILE;
    expect(resolveCityMarkerZIndex(false, profile)).toBe(CITY_MARKER_Z_INDEX + Math.round(profile.city.size / 2));
    expect(resolveCityMarkerZIndex(true, profile)).toBe(CITY_MARKER_SELECTED_Z_INDEX + Math.round(profile.city.selectedSize / 2));
    expect(resolveCityMarkerZIndex(true, profile)).toBeGreaterThan(resolveCityMarkerZIndex(false, profile));
  });
});
