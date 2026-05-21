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

vi.mock('../../components/GoogleMapsLoader', () => ({
  useGoogleMaps: () => ({ isLoaded: googleMapsMocks.isLoaded }),
}));

vi.mock('../../services/locationSearchService', () => ({
  searchCitySuggestions: locationSearchMocks.searchCitySuggestions,
  resolveCitySuggestion: locationSearchMocks.resolveCitySuggestion,
}));

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
});
