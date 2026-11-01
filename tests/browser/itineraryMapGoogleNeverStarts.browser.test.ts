// @vitest-environment jsdom
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItineraryMap, MAP_INIT_TIMEOUT_MS } from '../../components/ItineraryMap';
import { useGoogleMaps, useMapRuntime } from '../../components/GoogleMapsLoader';
import { resolveMapRuntime } from '../../shared/mapRuntime';
import { loadEnglishCommonTranslations } from '../helpers/i18n';

// A Google map that never produces an instance: the bridge never fires.
vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({ children }: { children?: React.ReactNode }) => children ?? null,
  useMap: () => null,
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

describe('components/ItineraryMap Google that never starts', () => {
  beforeAll(loadEnglishCommonTranslations);

  beforeEach(() => {
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
});
