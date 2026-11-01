// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddCityModal } from '../../components/AddCityModal';

const locationSearchMocks = vi.hoisted(() => ({
  searchCitySuggestions: vi.fn(),
  resolveCitySuggestion: vi.fn(),
}));

const googleMapsMocks = vi.hoisted(() => ({
  isLoaded: true,
}));

const runtimeMocks = vi.hoisted(() => ({
  locationSearch: 'google' as 'google' | 'mapbox' | 'none',
}));

vi.mock('../../services/mapRuntimeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/mapRuntimeService')>();
  return {
    ...actual,
    getMapboxAccessToken: () => 'pk.test-token',
    getClientMapRuntimeResolution: () => {
      const resolution = actual.getClientMapRuntimeResolution();
      return {
        ...resolution,
        effectiveSelection: {
          ...resolution.effectiveSelection,
          locationSearch: runtimeMocks.locationSearch,
        },
      };
    },
  };
});

vi.mock('../../components/GoogleMapsLoader', () => ({
  useGoogleMaps: () => ({ isLoaded: googleMapsMocks.isLoaded, loadError: undefined, disabled: !googleMapsMocks.isLoaded }),
  useMapRuntime: () => ({
    runtime: { effectiveSelection: { locationSearch: runtimeMocks.locationSearch } },
  }),
}));

vi.mock('../../services/locationSearchService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/locationSearchService')>();
  return {
    ...actual,
    searchCitySuggestions: locationSearchMocks.searchCitySuggestions,
    resolveCitySuggestion: locationSearchMocks.resolveCitySuggestion,
  };
});

const renderAddCityModal = (props?: {
  onAdd?: (name: string, lat: number, lng: number) => void;
  onClose?: () => void;
}) => render(React.createElement(AddCityModal, {
  isOpen: true,
  onAdd: props?.onAdd ?? vi.fn(),
  onClose: props?.onClose ?? vi.fn(),
}));

describe('AddCityModal', () => {
  beforeEach(() => {
    googleMapsMocks.isLoaded = true;
    runtimeMocks.locationSearch = 'google';
    locationSearchMocks.searchCitySuggestions.mockResolvedValue([
      {
        id: 'kyoto-japan',
        name: 'Kyoto',
        label: 'Kyoto, Kyoto Prefecture, Japan',
        coordinates: { lat: 35.0116, lng: 135.7681 },
      },
    ]);
    locationSearchMocks.resolveCitySuggestion.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('searches suggestions and resets state after selecting a city', async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();

    renderAddCityModal({ onAdd, onClose });

    fireEvent.change(screen.getByLabelText('Search City'), {
      target: { value: 'Ky' },
    });

    await waitFor(() => {
      expect(locationSearchMocks.searchCitySuggestions).toHaveBeenCalledWith('Ky', expect.objectContaining({
        maxResults: 5,
      }));
    });

    const suggestion = await screen.findByRole('button', { name: /kyoto/i });
    fireEvent.click(suggestion);

    expect(onAdd).toHaveBeenCalledWith('Kyoto', 35.0116, 135.7681);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows manual fallback when city resolution fails', async () => {
    renderAddCityModal();

    fireEvent.change(screen.getByLabelText('Search City'), {
      target: { value: 'Unknown place' },
    });
    fireEvent.keyDown(screen.getByLabelText('Search City'), { key: 'Enter' });

    await waitFor(() => {
      expect(locationSearchMocks.resolveCitySuggestion).toHaveBeenCalledWith('Unknown place', expect.any(Object));
    });

    expect(await screen.findByText('No matching city found. Try "City, Country" or choose a suggestion.')).toBeInTheDocument();
    expect(screen.getByLabelText('City Name')).toBeInTheDocument();
  });

  it('ignores stale manual resolution results after the input changes', async () => {
    // This case exercises free-form resolution, not selecting an autocomplete hit.
    locationSearchMocks.searchCitySuggestions.mockResolvedValue([]);
    const onAdd = vi.fn();
    let resolveManualLookup: ((value: unknown) => void) | null = null;
    locationSearchMocks.resolveCitySuggestion.mockReturnValue(new Promise((resolve) => {
      resolveManualLookup = resolve;
    }));

    renderAddCityModal({ onAdd });

    fireEvent.change(screen.getByLabelText('Search City'), {
      target: { value: 'Old query' },
    });
    fireEvent.keyDown(screen.getByLabelText('Search City'), { key: 'Enter' });

    await waitFor(() => {
      expect(locationSearchMocks.resolveCitySuggestion).toHaveBeenCalledWith('Old query', expect.any(Object));
    });

    fireEvent.change(screen.getByLabelText('Search City'), {
      target: { value: 'New query' },
    });

    await act(async () => {
      resolveManualLookup?.({
        id: 'old-result',
        name: 'Old Result',
        label: 'Old Result',
        coordinates: { lat: 1, lng: 2 },
      });
      await Promise.resolve();
    });

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Search City')).toHaveValue('New query');

    locationSearchMocks.resolveCitySuggestion.mockResolvedValueOnce({
      id: 'new-result',
      name: 'New Result',
      label: 'New Result',
      coordinates: { lat: 3, lng: 4 },
    });

    fireEvent.keyDown(screen.getByLabelText('Search City'), { key: 'Enter' });

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('New Result', 3, 4);
    });
  });

  it('shows a map loading error before manual resolution is available', async () => {
    googleMapsMocks.isLoaded = false;

    renderAddCityModal();

    fireEvent.change(screen.getByLabelText('Search City'), {
      target: { value: 'Kyoto' },
    });
    fireEvent.keyDown(screen.getByLabelText('Search City'), { key: 'Enter' });

    expect(await screen.findByText('Map services are still loading. Please try again in a moment.')).toBeInTheDocument();
    expect(locationSearchMocks.resolveCitySuggestion).not.toHaveBeenCalled();
  });
  describe('with Mapbox city search and no Google', () => {
    const capeTown = {
      type: 'Feature',
      properties: {
        mapbox_id: 'cape-town',
        name: 'Kapstadt',
        full_address: 'Kapstadt, Westkap, Südafrika',
        coordinates: { latitude: -33.92, longitude: 18.42 },
        context: { country: { name: 'Südafrika', country_code: 'za' } },
      },
    };

    beforeEach(async () => {
      googleMapsMocks.isLoaded = false;
      runtimeMocks.locationSearch = 'mapbox';
      const actual = await vi.importActual<typeof import('../../services/locationSearchService')>(
        '../../services/locationSearchService',
      );
      locationSearchMocks.searchCitySuggestions.mockImplementation(actual.searchCitySuggestions);
      locationSearchMocks.resolveCitySuggestion.mockImplementation(actual.resolveCitySuggestion);
      expect((window as unknown as { google?: unknown }).google).toBeUndefined();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ features: [capeTown] }),
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('adds a city through Mapbox with no Google loaded', async () => {
      const onAdd = vi.fn();
      renderAddCityModal({ onAdd });

      expect(screen.queryByText('Loading Map services…')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Search City'), { target: { value: 'Kapstadt' } });
      const suggestion = await screen.findByRole('button', { name: /kapstadt/i });
      fireEvent.click(suggestion);

      expect(onAdd).toHaveBeenCalledWith('Kapstadt', -33.92, 18.42);
      const requested = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
      expect(requested.every((url) => url.startsWith('https://api.mapbox.com/'))).toBe(true);
    });

    it('resolves a typed name on Enter', async () => {
      const onAdd = vi.fn();
      renderAddCityModal({ onAdd });
      locationSearchMocks.searchCitySuggestions.mockResolvedValue([]);

      fireEvent.change(screen.getByLabelText('Search City'), { target: { value: 'Kapstadt' } });
      fireEvent.keyDown(screen.getByLabelText('Search City'), { key: 'Enter' });

      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledWith('Kapstadt', -33.92, 18.42);
      });
    });
  });
});
