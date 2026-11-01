// @vitest-environment jsdom
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItineraryMap, MAP_INIT_TIMEOUT_MS } from '../../components/ItineraryMap';
import { useGoogleMaps, useMapRuntime } from '../../components/GoogleMapsLoader';
import { resolveMapRuntime } from '../../shared/mapRuntime';
import { loadEnglishCommonTranslations } from '../helpers/i18n';

// A Google map that never produces an instance: the bridge never fires.
const fakes = vi.hoisted(() => ({
  // null until a test lets the Google map "start".
  googleMap: null as null | Record<string, unknown>,
}));
const startedGoogleMap = {
  getDiv: () => null,
  getZoom: () => 5,
  getBounds: () => undefined,
  addListener: () => ({ remove: () => undefined }),
  setMapTypeId: () => undefined,
  setOptions: () => undefined,
  panTo: () => undefined,
  setZoom: () => undefined,
  fitBounds: () => undefined,
};
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

const mockedUseGoogleMaps = vi.mocked(useGoogleMaps);
const mockedUseMapRuntime = vi.mocked(useMapRuntime);

const renderMap = () => render(React.createElement(ItineraryMap, { items: [], onLayoutChange: vi.fn() }));

const useRuntime = (defaultPreset: 'google_all' | 'mapbox_all' | 'mapbox_visual_google_services', presetSettled = true) => {
  mockedUseMapRuntime.mockReturnValue({
    runtime: resolveMapRuntime({
      defaultPreset,
      availability: { googleMapsKeyAvailable: defaultPreset !== 'mapbox_all', mapboxAccessTokenAvailable: defaultPreset !== 'google_all' },
    }),
    mapboxAccessToken: defaultPreset === 'google_all' ? '' : 'pk.test',
    presetSettled,
    rendererLocked: false,
  } as ReturnType<typeof useMapRuntime>);
};

describe('components/ItineraryMap Google that never starts', () => {
  beforeAll(loadEnglishCommonTranslations);

  beforeEach(() => {
    fakes.googleMap = null;
    vi.useFakeTimers();
    (window as { google?: unknown }).google = { maps: {} };
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
    vi.useRealTimers();
    delete (window as { google?: unknown }).google;
  });

  it('a Google map that never initializes ends on an error, not a spinner', () => {
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: true, loadError: null, disabled: false });
    renderMap();
    expect(screen.getByText('Loading map…')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS); });

    expect(screen.getByText(/Error loading map/)).toBeTruthy();
    expect(screen.getByText(/Google Maps did not start/)).toBeTruthy();
    expect(screen.queryByText('Loading map…')).toBeNull();
  });

  it('also ends on an error when the Google script never reports loaded', () => {
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: null, disabled: false });
    renderMap();

    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS); });

    expect(screen.getByText(/Error loading map/)).toBeTruthy();
    expect(screen.queryByText('Loading map…')).toBeNull();
  });

  it('clears the error when the map starts late and keeps the canvas mounted', () => {
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: true, loadError: null, disabled: false });
    const view = renderMap();
    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS); });
    expect(screen.getByText(/Error loading map/)).toBeTruthy();

    fakes.googleMap = startedGoogleMap;
    view.rerender(React.createElement(ItineraryMap, { items: [], onLayoutChange: vi.fn() }));

    expect(screen.queryByText(/Error loading map/)).toBeNull();
    expect(screen.queryByText('Loading map…')).toBeNull();
  });

  it('recovers when the Google script loads late', () => {
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: null, disabled: false });
    const view = renderMap();
    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS); });
    expect(screen.getByText(/Error loading map/)).toBeTruthy();

    mockedUseGoogleMaps.mockReturnValue({ isLoaded: true, loadError: null, disabled: false });
    fakes.googleMap = startedGoogleMap;
    view.rerender(React.createElement(ItineraryMap, { items: [], onLayoutChange: vi.fn() }));

    expect(screen.queryByText(/Error loading map/)).toBeNull();
  });

  it('shows no error after 15 s in mixed mode once the hidden Google map started', () => {
    useRuntime('mapbox_visual_google_services');
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: true, loadError: null, disabled: false });
    fakes.googleMap = startedGoogleMap;
    renderMap();
    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS); });
    expect(screen.queryByText(/Error loading map/)).toBeNull();
  });

  it('does not run the timer before the preset has settled', () => {
    useRuntime('google_all', false);
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: null, disabled: false });
    renderMap();
    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS * 2); });
    expect(screen.queryByText(/Error loading map/)).toBeNull();
  });

  it('does not run the timer in standalone Mapbox', () => {
    useRuntime('mapbox_all');
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: null, disabled: true });
    renderMap();
    act(() => { vi.advanceTimersByTime(MAP_INIT_TIMEOUT_MS * 2); });
    expect(screen.queryByText(/Google Maps did not start/)).toBeNull();
  });
});
