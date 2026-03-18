import { describe, expect, it } from 'vitest';

import { buildTripMapCameraIntroPlan } from '../../components/maps/tripMapProviderCameraIntro';

describe('components/maps/tripMapProviderCameraIntro', () => {
  it('returns a provider-aware globe intro plan for larger docked Mapbox trip views', () => {
    const introPlan = buildTripMapCameraIntroPlan({
      provider: 'mapbox',
      mapDockMode: 'docked',
      mapViewportSize: { width: 960, height: 620 },
      target: {
        center: [100.5, 13.75],
        zoom: 5.2,
      },
    });

    expect(introPlan).not.toBeNull();
    expect(introPlan?.startCamera.zoom).toBeLessThan(introPlan?.flyToCamera.zoom ?? 0);
    expect(introPlan?.flyToCamera.center).toEqual([100.5, 13.75]);
    expect(introPlan?.flyToCamera.bearing).toBeGreaterThan(0);
  });

  it('skips the globe intro for floating or compact trip-map surfaces', () => {
    expect(buildTripMapCameraIntroPlan({
      provider: 'mapbox',
      mapDockMode: 'floating',
      mapViewportSize: { width: 960, height: 620 },
      target: {
        center: [100.5, 13.75],
        zoom: 5.2,
      },
    })).toBeNull();

    expect(buildTripMapCameraIntroPlan({
      provider: 'mapbox',
      mapDockMode: 'docked',
      mapViewportSize: { width: 340, height: 240 },
      target: {
        center: [100.5, 13.75],
        zoom: 5.2,
      },
    })).toBeNull();
  });
});
