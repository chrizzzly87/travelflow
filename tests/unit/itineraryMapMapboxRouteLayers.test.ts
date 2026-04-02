import { describe, expect, it } from 'vitest';

import { buildMapboxRouteLayerConfigs } from '../../components/ItineraryMap';

describe('components/ItineraryMap Mapbox dark route layers', () => {
  it('keeps vivid colored route lines in dark Mapbox styles', () => {
    const layers = buildMapboxRouteLayerConfigs({
      routeId: 'route-1',
      provider: 'mapbox',
      style: 'dark',
      options: {
        path: [
          { lat: 13.75, lng: 100.5 },
          { lat: 18.78, lng: 98.98 },
        ],
        strokeColor: '#7c3aed',
        strokeOpacity: 0.72,
        strokeWeight: 4,
      } as google.maps.PolylineOptions,
    });

    expect(layers.map((layer) => layer.id)).toEqual([
      'route-1-shadow',
      'route-1-glow',
      'route-1-main',
    ]);
    expect(layers.at(-1)).toMatchObject({
      color: '#7c3aed',
      opacity: 0.97,
      emissiveStrength: 1,
    });
    expect(layers[0]?.color).toContain('rgba(');
  });

  it('keeps clean dark route layers colorful instead of flattening to black', () => {
    const layers = buildMapboxRouteLayerConfigs({
      routeId: 'route-2',
      provider: 'mapbox',
      style: 'cleanDark',
      options: {
        path: [
          { lat: 13.75, lng: 100.5 },
          { lat: 18.78, lng: 98.98 },
        ],
        strokeColor: '#14b8a6',
        strokeOpacity: 0.7,
        strokeWeight: 4,
      } as google.maps.PolylineOptions,
    });

    expect(layers.map((layer) => layer.id)).toEqual([
      'route-2-shadow',
      'route-2-glow',
      'route-2-main',
    ]);
    expect(layers.at(-1)).toMatchObject({
      color: '#14b8a6',
      emissiveStrength: 1.22,
    });
    expect(layers[0]?.opacity).toBeLessThan(layers.at(-1)?.opacity ?? 1);
  });
});
