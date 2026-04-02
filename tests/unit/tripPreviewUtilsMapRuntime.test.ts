import { describe, expect, it, vi } from 'vitest';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

vi.mock('../../services/mapRuntimeService', () => ({
  getClientMapRuntimeResolution: () => ({
    defaultPreset: 'google_all',
    requestedPreset: 'mapbox_visual_google_services',
    requestedSelection: {
      renderer: 'mapbox',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'mapbox',
    },
    effectiveSelection: {
      renderer: 'mapbox',
      routes: 'google',
      locationSearch: 'google',
      staticMaps: 'mapbox',
    },
    effectivePresetMatch: 'mapbox_visual_google_services',
    override: { preset: 'mapbox_visual_google_services' },
    overrideSource: 'cookie',
    warnings: [],
    availability: {
      googleMapsKeyAvailable: true,
      mapboxAccessTokenAvailable: true,
    },
    activeSelectionKey: 'mggm',
    implementationCapabilities: {
      google: {
        renderer: true,
        routes: true,
        locationSearch: true,
        staticMaps: true,
      },
      mapbox: {
        renderer: true,
        routes: false,
        locationSearch: false,
        staticMaps: true,
      },
    },
  }),
  getMapboxAccessToken: () => 'mapbox-token',
}));

import {
  buildDirectMapboxStaticMapPreviewUrlWithToken,
  buildMiniMapUrl,
} from '../../components/profile/tripPreviewUtils';

describe('components/profile/tripPreviewUtils map runtime support', () => {
  it('threads the active runtime selection key into preview requests', () => {
    const trip = makeTrip({
      items: [
        makeCityItem({
          id: 'city-1',
          title: 'Berlin',
          startDateOffset: 0,
          duration: 2,
          color: '#2563eb',
          coordinates: { lat: 52.52, lng: 13.405 },
        }),
        makeCityItem({
          id: 'city-2',
          title: 'Prague',
          startDateOffset: 2,
          duration: 2,
          color: '#16a34a',
          coordinates: { lat: 50.0755, lng: 14.4378 },
        }),
      ],
    });

    const url = buildMiniMapUrl(trip, 'en');
    expect(url).toContain('/api/trip-map-preview?');

    const params = new URL(url!, 'https://travelflow.local').searchParams;
    expect(params.get('mr')).toBe('mggm');
  });

  it('builds a direct Mapbox static preview URL when Mapbox static maps are active', () => {
    const params = new URLSearchParams();
    params.set('coords', '52.520000,13.405000|50.075500,14.437800');
    params.set('style', 'standard');
    params.set('routeMode', 'simple');
    params.set('colorMode', 'trip');
    params.set('pathColor', '2563eb');
    params.set('startMarkerColor', '2563eb');
    params.set('endMarkerColor', '16a34a');
    params.set('w', '640');
    params.set('h', '360');
    params.set('scale', '2');

    const url = buildDirectMapboxStaticMapPreviewUrlWithToken(params, 'mapbox-token');
    expect(url).toBeTruthy();
    expect(url).toContain('https://api.mapbox.com/styles/v1/mapbox/standard/static/');
    expect(url).toContain('access_token=mapbox-token');
    expect(decodeURIComponent(url!)).toContain('path-4+2563eb-0.85');
  });
});
