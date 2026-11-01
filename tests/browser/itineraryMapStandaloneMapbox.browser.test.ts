// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import { ItineraryMap } from '../../components/ItineraryMap';
import { useGoogleMaps, useMapRuntime } from '../../components/GoogleMapsLoader';
import { getTripMapProviderTuning } from '../../components/maps/tripMapProviderTuning';
import { resolveMapRuntime } from '../../shared/mapRuntime';
import type { ITimelineItem } from '../../types';
import { FakeMapboxMap } from '../helpers/fakeMapboxGl';
import { loadEnglishCommonTranslations } from '../helpers/i18n';

const routeServiceMocks = vi.hoisted(() => ({
  loadGoogleRouteRuntime: vi.fn(),
  computeGoogleRouteLeg: vi.fn(),
}));

vi.mock('../../components/GoogleMapsLoader', () => ({
  useGoogleMaps: vi.fn(),
  useMapRuntime: vi.fn(),
}));
vi.mock('mapbox-gl', async () => ({ default: (await import('../helpers/fakeMapboxGl')).fakeMapboxModule }));
vi.mock('../../services/routeService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/routeService')>()),
  loadGoogleRouteRuntime: routeServiceMocks.loadGoogleRouteRuntime,
  computeGoogleRouteLeg: routeServiceMocks.computeGoogleRouteLeg,
}));

const mockedUseGoogleMaps = vi.mocked(useGoogleMaps);
const mockedUseMapRuntime = vi.mocked(useMapRuntime);
const MAPBOX_TUNING = getTripMapProviderTuning('mapbox');

const city = (id: string, startDateOffset: number, lat: number, lng: number): ITimelineItem => ({
  id,
  type: 'city',
  title: id,
  location: id,
  startDateOffset,
  duration: 2,
  color: 'bg-blue-500',
  coordinates: { lat, lng },
});

const PARIS = city('Paris', 0, 48.85, 2.35);
const BERLIN = city('Berlin', 2, 52.52, 13.4);
const VIENNA = city('Vienna', 4, 48.21, 16.37);
const LOUVRE: ITimelineItem = {
  id: 'louvre',
  type: 'activity',
  title: 'Louvre',
  startDateOffset: 0.5,
  duration: 0.2,
  color: 'bg-amber-500',
  activityType: ['culture'],
  coordinates: { lat: 48.86, lng: 2.34 },
} as ITimelineItem;

let googleAccessCount = 0;

const mockMapboxAllRuntime = ({ presetSettled = true }: { presetSettled?: boolean } = {}) => {
  mockedUseMapRuntime.mockReturnValue({
    runtime: resolveMapRuntime({
      defaultPreset: 'mapbox_all',
      availability: { googleMapsKeyAvailable: false, mapboxAccessTokenAvailable: true },
    }),
    mapboxAccessToken: 'pk.test',
    presetSettled,
    rendererLocked: true,
  } as ReturnType<typeof useMapRuntime>);
};

const renderMap = (items: ITimelineItem[]) => render(
  React.createElement(ItineraryMap, {
    items,
    layoutMode: 'horizontal',
    onLayoutChange: vi.fn(),
    onOpenCustomize: vi.fn(),
  }),
);

const waitForMapReady = async () => {
  await waitFor(() => expect(FakeMapboxMap.latest()?.styleLoaded).toBe(true));
  await waitFor(() => expect(screen.queryByText('Loading map…')).not.toBeInTheDocument());
};

describe('components/ItineraryMap standalone Mapbox (mapbox_all)', () => {
  beforeAll(loadEnglishCommonTranslations);

  beforeEach(() => {
    FakeMapboxMap.reset();
    googleAccessCount = 0;
    // Any read of `window.google` on the Mapbox path is counted: under
    // mapbox_all no Google script exists, so every read is a bug.
    Object.defineProperty(window, 'google', {
      configurable: true,
      get: () => {
        googleAccessCount += 1;
        return undefined;
      },
    });
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: null, disabled: true });
    mockMapboxAllRuntime();
  });

  afterEach(() => {
    delete (window as { google?: unknown }).google;
  });

  it('keeps "Loading map…" and mounts no map until the preset has settled', async () => {
    mockMapboxAllRuntime({ presetSettled: false });
    const view = renderMap([PARIS, BERLIN]);

    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(screen.getByText('Loading map…')).toBeInTheDocument();
    expect(FakeMapboxMap.instances).toHaveLength(0);

    mockMapboxAllRuntime({ presetSettled: true });
    view.rerender(React.createElement(ItineraryMap, {
      items: [PARIS, BERLIN],
      layoutMode: 'horizontal',
      onLayoutChange: vi.fn(),
      onOpenCustomize: vi.fn(),
    }));

    await waitForMapReady();
    expect(FakeMapboxMap.instances).toHaveLength(1);
  });

  it('renders a Mapbox map and no "Loading map…" once the surface is ready', async () => {
    const view = renderMap([PARIS, BERLIN, VIENNA]);

    expect(screen.getByText('Loading map…')).toBeInTheDocument();
    await waitForMapReady();

    expect(FakeMapboxMap.instances).toHaveLength(1);
    expect(view.container.querySelector('[data-tf-map-basemap="mapbox"]')).not.toBeNull();
    expect(view.container.querySelector('[data-tf-marker-id="city:Paris"]')).not.toBeNull();
    expect(screen.getByLabelText('Fit to itinerary')).toBeEnabled();
    expect(googleAccessCount).toBe(0);
  });

  it('draws one straight line per leg and never imports Google routes', async () => {
    renderMap([PARIS, BERLIN, VIENNA]);
    await waitForMapReady();

    const map = FakeMapboxMap.latest()!;
    // Route lines only: the basemap polish adds a country-boundary source of its own.
    const routeSources = () => [...map.sources.entries()]
      .filter(([id]) => id.startsWith('tf-mapbox-route-'))
      .map(([, source]) => source as { data: { geometry: { coordinates: number[][] } } });
    await waitFor(() => expect(routeSources()).toHaveLength(2));
    const legPaths = routeSources().map((source) => source.data.geometry.coordinates);
    expect(legPaths).toEqual([
      [[2.35, 48.85], [13.4, 52.52]],
      [[13.4, 52.52], [16.37, 48.21]],
    ]);
    expect(routeServiceMocks.loadGoogleRouteRuntime).not.toHaveBeenCalled();
    expect(routeServiceMocks.computeGoogleRouteLeg).not.toHaveBeenCalled();
    expect(googleAccessCount).toBe(0);
  });

  it('fits the camera to the trip', async () => {
    renderMap([PARIS, BERLIN, VIENNA]);
    await waitForMapReady();

    const map = FakeMapboxMap.latest()!;
    await waitFor(() => expect(map.fitBoundsCalls).toHaveLength(1));
    expect(map.fitBoundsCalls[0][0]).toEqual([[2.35, 48.21], [16.37, 52.52]]);
    expect(googleAccessCount).toBe(0);
  });

  it('shows activity markers after zooming past the gate', async () => {
    const view = renderMap([PARIS, LOUVRE, BERLIN]);
    await waitForMapReady();

    const map = FakeMapboxMap.latest()!;
    await waitFor(() => expect(view.container.querySelector('[data-tf-marker-id="city:Paris"]')).not.toBeNull());
    expect(view.container.querySelector('[data-tf-marker-id="activity:louvre"]')).toBeNull();

    act(() => {
      map.zoom = MAPBOX_TUNING.markers.activityMinZoom + 1;
      map.emit('zoom');
    });

    await waitFor(() => expect(view.container.querySelector('[data-tf-marker-id="activity:louvre"]')).not.toBeNull());
    expect(googleAccessCount).toBe(0);
  });

  it('a one-city trip pans instead of fitting and still becomes ready', async () => {
    renderMap([PARIS]);
    await waitForMapReady();

    const map = FakeMapboxMap.latest()!;
    await waitFor(() => expect(map.easeToCalls.length + map.jumpToCalls.length).toBe(1));
    const target = map.easeToCalls[0] ?? map.jumpToCalls[0];
    expect(target).toEqual({ center: [2.35, 48.85], zoom: MAPBOX_TUNING.selection.cityFocusZoom });
    expect(map.fitBoundsCalls).toHaveLength(0);
    expect(screen.getByLabelText('Fit to itinerary')).toBeEnabled();
  });

  it('a zero-city trip becomes ready without camera calls', async () => {
    renderMap([]);
    await waitForMapReady();

    // Give a scheduled fit time to run, if one was (wrongly) queued.
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    expect(FakeMapboxMap.latest()!.cameraCallCount).toBe(0);
    expect(screen.getByLabelText('Fit to itinerary')).toBeEnabled();
    expect(googleAccessCount).toBe(0);
  });
});
