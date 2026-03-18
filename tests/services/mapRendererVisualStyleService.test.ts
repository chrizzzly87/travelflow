import { describe, expect, it, vi } from 'vitest';

import {
  applyMapboxTripVisualPolish,
  buildMapboxStyleConfig,
  getMapSurfaceBackgroundColor,
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
    expect(config.colorAdminBoundaries).toBe('#ffffff');
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
        colorAdminBoundaries: '#ffffff',
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
        colorAdminBoundaries: '#ffffff',
        showRoadsAndTransit: false,
        showPedestrianRoads: false,
      },
    });
  });

  it('hides smaller settlement labels while preserving country context layers', () => {
    expect(shouldHideMapboxTripLabelLayer('settlement-major-label')).toBe(false);
    expect(shouldHideMapboxTripLabelLayer('airport-label')).toBe(true);
    expect(shouldHideMapboxTripLabelLayer('country-label')).toBe(false);
    expect(shouldHideMapboxTripLabelLayer('state-label')).toBe(true);
  });

  it('applies visibility, filtering, and country-border polish to the trip-facing Mapbox layers', () => {
    const setLayoutProperty = vi.fn();
    const setPaintProperty = vi.fn();
    const setFilter = vi.fn();
    applyMapboxTripVisualPolish({
      getStyle: () => ({
        layers: [
          { id: 'admin-1-boundary' },
          { id: 'admin_1_boundary' },
          { id: 'admin-2-boundary' },
          { id: 'region-boundary' },
          { id: 'admin-0-boundary' },
          { id: 'admin_0_boundary' },
          { id: 'admin-0-boundary-bg' },
          { id: 'settlement-major-label' },
          { id: 'airport-label' },
          { id: 'country-label' },
        ],
      } as any),
      getLayer: () => ({ id: 'mock' } as any),
      setLayoutProperty,
      setPaintProperty,
      setFilter,
    }, 'satellite');

    expect(setLayoutProperty).toHaveBeenCalledTimes(8);
    expect(setLayoutProperty).toHaveBeenNthCalledWith(1, 'admin-1-boundary', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(2, 'admin_1_boundary', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(3, 'admin-2-boundary', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(4, 'region-boundary', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(5, 'admin-0-boundary', 'visibility', 'visible');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(6, 'admin_0_boundary', 'visibility', 'visible');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(7, 'admin-0-boundary-bg', 'visibility', 'visible');
    expect(setLayoutProperty).toHaveBeenNthCalledWith(8, 'airport-label', 'visibility', 'none');
    expect(setFilter).toHaveBeenCalledWith('settlement-major-label', expect.any(Array));
    expect(setPaintProperty).toHaveBeenCalledWith('admin-0-boundary', 'line-color', 'rgba(255, 255, 255, 0.99)');
    expect(setPaintProperty).toHaveBeenCalledWith('admin-0-boundary-bg', 'line-opacity', 0.34);
  });

  it('removes roads and major settlement labels from clean map styles while keeping country context', () => {
    const setLayoutProperty = vi.fn();
    const setPaintProperty = vi.fn();
    const setFilter = vi.fn();

    applyMapboxTripVisualPolish({
      getStyle: () => ({
        layers: [
          { id: 'road-primary' },
          { id: 'bridge-motorway' },
          { id: 'settlement-major-label' },
          { id: 'country-label' },
          { id: 'admin-0-boundary' },
        ],
      } as any),
      getLayer: () => ({ id: 'mock' } as any),
      setLayoutProperty,
      setPaintProperty,
      setFilter,
    }, 'cleanDark');

    expect(setLayoutProperty).toHaveBeenCalledWith('road-primary', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenCalledWith('bridge-motorway', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenCalledWith('settlement-major-label', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenCalledWith('admin-0-boundary', 'visibility', 'visible');
    expect(setFilter).not.toHaveBeenCalled();
  });

  it('uses darker surface backgrounds for satellite and dark trip-map styles', () => {
    expect(getMapSurfaceBackgroundColor('standard')).toBe('#dbe5ee');
    expect(getMapSurfaceBackgroundColor('satellite')).toBe('#4d6972');
    expect(getMapSurfaceBackgroundColor('dark')).toBe('#0f172a');
  });
});
