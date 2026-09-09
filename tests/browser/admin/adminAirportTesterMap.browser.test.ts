// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resolveMapRuntime } from '../../../shared/mapRuntime';
import type { AirportReference, NearbyAirportsResponse } from '../../../shared/airportReference';

const googleRuntime = resolveMapRuntime({
  defaultPreset: 'google_all',
  availability: { googleMapsKeyAvailable: true, mapboxAccessTokenAvailable: false },
});

vi.mock('../../../components/GoogleMapsLoader', () => ({
  GoogleMapsLoader: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useGoogleMaps: () => ({ isLoaded: true, loadError: null }),
  useMapRuntime: () => ({ runtime: googleRuntime, mapboxAccessToken: '' }),
}));

const fakeGoogleMap = { fitBounds: vi.fn(), getZoom: () => 5, setZoom: vi.fn() };

vi.mock('@vis.gl/react-google-maps', () => ({
  Map: ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'google-map' }, children),
  useMap: () => fakeGoogleMap,
}));

import { AdminAirportTesterMap } from '../../../components/admin/AdminAirportTesterMap';

const origin = {
  label: 'Berlin, Germany',
  lat: 52.52,
  lng: 13.405,
  countryCode: 'DE',
  countryName: 'Germany',
};

const berlinBrandenburg: AirportReference = {
  ident: 'EDDB',
  iataCode: 'BER',
  icaoCode: 'EDDB',
  name: 'Berlin Brandenburg Airport',
  municipality: 'Berlin',
  subdivisionName: 'Brandenburg',
  regionCode: 'DE-BB',
  countryCode: 'DE',
  countryName: 'Germany',
  latitude: 52.3667,
  longitude: 13.5033,
  timezone: 'Europe/Berlin',
  airportType: 'large_airport',
  scheduledService: true,
  isCommercial: true,
  commercialServiceTier: 'major',
  isMajorCommercial: true,
};

const lookupResult: NearbyAirportsResponse = {
  origin: { lat: origin.lat, lng: origin.lng },
  airports: [{ airport: berlinBrandenburg, airDistanceKm: 18.42, rank: 1 }],
  dataVersion: '2026-01-01',
};

/**
 * Minimal Google overlay stand-ins: the tester draws its pills through
 * OverlayView, so the panes have to exist for a click test to mean anything.
 */
const installGoogleMapsStubs = (): HTMLElement => {
  const floatPane = document.createElement('div');
  document.body.appendChild(floatPane);

  class StubOverlayView {
    onAdd: (() => void) | null = null;
    draw: (() => void) | null = null;
    onRemove: (() => void) | null = null;

    getPanes() {
      return { floatPane };
    }

    getProjection() {
      return { fromLatLngToDivPixel: () => ({ x: 10, y: 20 }) };
    }

    setMap(map: unknown) {
      if (map) {
        this.onAdd?.();
        this.draw?.();
        return;
      }
      this.onRemove?.();
    }
  }

  (window as unknown as { google: unknown }).google = {
    maps: {
      OverlayView: StubOverlayView,
      LatLng: class { constructor(public lat: number, public lng: number) {} },
      LatLngBounds: class { extend() { return this; } },
      Polyline: class { setMap() {} },
      event: { addListenerOnce: vi.fn() },
    },
  };

  return floatPane;
};

describe('AdminAirportTesterMap', () => {
  beforeEach(() => {
    installGoogleMapsStubs();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    delete (window as unknown as { google?: unknown }).google;
  });

  it('opens the detail card when an airport pill is clicked', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportTesterMap, { origin, result: lookupResult }));

    const pill = await screen.findByRole('button', { name: /Berlin Brandenburg Airport — open details/ });
    await user.click(pill);

    const dialog = await screen.findByRole('dialog', { name: /Berlin Brandenburg Airport details/ });
    expect(dialog).toHaveTextContent('BER · EDDB · EDDB');
    expect(dialog).toHaveTextContent('18.4 km');
    expect(dialog).toHaveTextContent('Europe/Berlin');
    expect(dialog).toHaveTextContent('Major');
  });

  it('closes the detail card again from its close button', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportTesterMap, { origin, result: lookupResult }));

    await user.click(await screen.findByRole('button', { name: /Berlin Brandenburg Airport — open details/ }));
    await user.click(await screen.findByRole('button', { name: 'Close airport details' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('exposes the origin pill as its own detail target', async () => {
    const user = userEvent.setup();
    render(React.createElement(AdminAirportTesterMap, { origin, result: lookupResult }));

    await user.click(await screen.findByRole('button', { name: /Berlin, Germany — open details/ }));

    const dialog = await screen.findByRole('dialog', { name: /Berlin, Germany details/ });
    expect(dialog).toHaveTextContent('52.52000, 13.40500');
    expect(dialog).toHaveTextContent('Germany · DE');
  });
});
