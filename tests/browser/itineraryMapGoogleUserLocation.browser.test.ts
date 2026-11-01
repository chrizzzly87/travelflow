// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { ItineraryMap } from '../../components/ItineraryMap';
import { useGoogleMaps, useMapRuntime } from '../../components/GoogleMapsLoader';
import { resolveMapRuntime } from '../../shared/mapRuntime';
import { loadEnglishCommonTranslations } from '../helpers/i18n';

const fakes = vi.hoisted(() => {
  const listeners = new Map<string, Array<() => void>>();
  const googleMap = {
    getDiv: () => null,
    getZoom: () => 5,
    // Google has no bounds until the map has rendered once.
    getBounds: (): { contains: () => boolean } | undefined => undefined,
    addListener: (type: string, listener: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      return { remove: () => undefined };
    },
    setMapTypeId: () => undefined,
    setOptions: () => undefined,
    panTo: () => undefined,
    setZoom: () => undefined,
    fitBounds: () => undefined,
  };
  return { googleMap, listeners };
});

vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useMap: () => fakes.googleMap,
}));
vi.mock('../../components/GoogleMapsLoader', () => ({
  useGoogleMaps: vi.fn(),
  useMapRuntime: vi.fn(),
}));
vi.mock('../../services/routeService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/routeService')>()),
  loadGoogleRouteRuntime: vi.fn(async () => null),
}));
vi.mock('../../hooks/useTripUserLocation', () => ({
  useTripUserLocation: () => ({
    enabled: true,
    status: 'ready',
    fix: { lat: 48.85, lng: 2.35, isLive: true },
    isOffered: true,
  }),
}));
vi.mock('../../components/maps/userLocationMarker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/maps/userLocationMarker')>()),
  createGoogleUserLocationOverlay: () => ({ setMap: () => undefined, update: () => undefined }),
}));

const mockedUseGoogleMaps = vi.mocked(useGoogleMaps);
const mockedUseMapRuntime = vi.mocked(useMapRuntime);

describe('components/ItineraryMap user location on Google', () => {
  beforeAll(loadEnglishCommonTranslations);

  beforeEach(() => {
    fakes.listeners.clear();
    (window as { google?: unknown }).google = {
      maps: {
        OverlayView: class {
          setMap() {}
        },
        event: { trigger: () => undefined, removeListener: () => undefined },
      },
    };
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: true, loadError: null, disabled: false });
    mockedUseMapRuntime.mockReturnValue({
      runtime: resolveMapRuntime({
        defaultPreset: 'google_all',
        availability: { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: false },
      }),
      mapboxAccessToken: '',
      presetSettled: true,
      rendererLocked: false,
    } as ReturnType<typeof useMapRuntime>);
  });

  afterEach(() => {
    delete (window as { google?: unknown }).google;
  });

  it('does not report the traveller out of view before Google has bounds', async () => {
    render(React.createElement(ItineraryMap, {
      items: [],
      showUserLocation: true,
      onLayoutChange: vi.fn(),
    }));

    const button = await screen.findByTestId('map-user-location-button');
    await waitFor(() => expect(button).toBeEnabled());
    await waitFor(() => expect(fakes.listeners.get('idle')?.length ?? 0).toBeGreaterThan(0));
    expect(button).not.toHaveAttribute('data-out-of-view');
  });
});
