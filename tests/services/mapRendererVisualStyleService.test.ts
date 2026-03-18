import { describe, expect, it } from 'vitest';

import {
  buildMapboxStyleConfig,
  getMapboxStyleDescriptor,
} from '../../services/mapRendererVisualStyleService';

describe('services/mapRendererVisualStyleService', () => {
  it('keeps the trip-facing standard basemap clean by removing clutter layers', () => {
    const descriptor = getMapboxStyleDescriptor('standard');
    const config = Object.fromEntries(
      (descriptor.configProperties ?? []).map((entry) => [entry.property, entry.value]),
    );

    expect(descriptor.styleUrl).toBe('mapbox://styles/mapbox/standard');
    expect(config.showAdminBoundaries).toBe(false);
    expect(config.showPointOfInterestLabels).toBe(false);
    expect(config.showRoadLabels).toBe(false);
    expect(config.showTransitLabels).toBe(false);
    expect(config.showPlaceLabels).toBe(false);
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
        showPointOfInterestLabels: false,
        showTransitLabels: false,
        showRoadLabels: false,
        showAdminBoundaries: false,
        showPlaceLabels: false,
      },
    });
  });

  it('keeps satellite basemaps clean by removing roads, transit, and ferry-like route overlays', () => {
    expect(buildMapboxStyleConfig('satellite')).toEqual({
      basemap: {
        lightPreset: 'day',
        showPointOfInterestLabels: false,
        showTransitLabels: false,
        showRoadLabels: false,
        showAdminBoundaries: false,
        showPlaceLabels: false,
        showRoadsAndTransit: false,
        showPedestrianRoads: false,
      },
    });
  });
});
