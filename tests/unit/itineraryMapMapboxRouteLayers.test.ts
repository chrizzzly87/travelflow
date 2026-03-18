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
    });
    expect(layers[0]?.color).toContain('rgba(');
  });
});
