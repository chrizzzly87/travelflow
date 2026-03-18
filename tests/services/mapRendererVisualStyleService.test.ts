import { describe, expect, it, vi } from 'vitest';

import {
  applyMapboxTripLabelVisibilityPolish,
  buildMapboxStyleConfig,
  getMapboxStyleDescriptor,
  shouldHideMapboxTripLabelLayer,
} from '../../services/mapRendererVisualStyleService';

describe('services/mapRendererVisualStyleService', () => {
  it('keeps the trip-facing standard basemap clean by removing clutter layers', () => {
    const descriptor = getMapboxStyleDescriptor('standard');
    const config = Object.fromEntries(
      (descriptor.configProperties ?? []).map((entry) => [entry.property, entry.value]),
    );

    expect(descriptor.styleUrl).toBe('mapbox://styles/mapbox/standard');
    expect(config.showAdminBoundaries).toBe(true);
    expect(config.showPointOfInterestLabels).toBe(false);
    expect(config.showRoadLabels).toBe(false);
    expect(config.showTransitLabels).toBe(false);
    expect(config.showPlaceLabels).toBe(true);
  });

  it('uses cleaner Mapbox Standard themes for the light and minimal trip styles', () => {
    const cleanDescriptor = getMapboxStyleDescriptor('clean');
    const minimalDescriptor = getMapboxStyleDescriptor('minimal');

    const cleanConfig = Object.fromEntries(
      (cleanDescriptor.configProperties ?? []).map((entry) => [entry.property, entry.value]),
    );
    const minimalConfig = Object.fromEntries(
      (minimalDescriptor.configProperties ?? []).map((entry) => [entry.property, entry.value]),
    );

    expect(cleanConfig.theme).toBe('faded');
    expect(minimalConfig.theme).toBe('monochrome');
  });

  it('builds nested Mapbox style config objects for initial style loads and style switches', () => {
    expect(buildMapboxStyleConfig('standard')).toEqual({
      basemap: {
        theme: 'default',
        lightPreset: 'day',
        showPlaceLabels: true,
        showPointOfInterestLabels: false,
        showTransitLabels: false,
        showRoadLabels: false,
        showAdminBoundaries: true,
      },
    });
  });

  it('keeps satellite basemaps clean by removing roads, transit, and ferry-like route overlays while keeping country context', () => {
    expect(buildMapboxStyleConfig('satellite')).toEqual({
      basemap: {
        lightPreset: 'day',
        showPlaceLabels: true,
        showPointOfInterestLabels: false,
        showTransitLabels: false,
        showRoadLabels: false,
        showAdminBoundaries: true,
        showRoadsAndTransit: false,
        showPedestrianRoads: false,
      },
    });
  });

  it('hides smaller settlement labels while preserving country context layers', () => {
    expect(shouldHideMapboxTripLabelLayer('settlement-major-label')).toBe(true);
    expect(shouldHideMapboxTripLabelLayer('airport-label')).toBe(true);
    expect(shouldHideMapboxTripLabelLayer('country-label')).toBe(false);
  });

  it('applies visibility polish only to the noisy trip-label layers', () => {
    const setLayoutProperty = vi.fn();
    applyMapboxTripLabelVisibilityPolish({
      getStyle: () => ({
        layers: [
          { id: 'settlement-major-label' },
          { id: 'airport-label' },
          { id: 'country-label' },
        ],
      } as any),
      getLayer: () => ({ id: 'mock' } as any),
      setLayoutProperty,
    });

    expect(setLayoutProperty).toHaveBeenCalledTimes(2);
    expect(setLayoutProperty).toHaveBeenNthCalledWith(1, 'settlement-major-label', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(2, 'airport-label', 'visibility', 'none');
  });
});
