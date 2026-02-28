// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ItineraryMap } from '../../components/ItineraryMap';
import { useGoogleMaps } from '../../components/GoogleMapsLoader';

vi.mock('../../components/GoogleMapsLoader', () => ({
  useGoogleMaps: vi.fn(),
}));

const mockedUseGoogleMaps = vi.mocked(useGoogleMaps);

describe('components/ItineraryMap map controls availability', () => {
  beforeEach(() => {
    mockedUseGoogleMaps.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps controls visible while map is loading and disables map-only actions', () => {
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: null });

    const onLayoutChange = vi.fn();

    render(
      React.createElement(ItineraryMap, {
        items: [],
        layoutMode: 'horizontal',
        onLayoutChange,
        onStyleChange: vi.fn(),
      }),
    );

    expect(screen.getByText('Loading Map...')).toBeInTheDocument();
    expect(screen.getByLabelText('Vertical layout')).toBeInTheDocument();
    expect(screen.getByLabelText('Horizontal layout')).toBeInTheDocument();

    const fitButton = screen.getByLabelText('Fit to itinerary');
    const styleButton = screen.getByLabelText('Map style');
    expect(fitButton).toBeDisabled();
    expect(styleButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Vertical layout'));
    expect(onLayoutChange).toHaveBeenCalledWith('vertical');
  });

  it('shows load errors with controls still visible and map-only actions disabled', () => {
    mockedUseGoogleMaps.mockReturnValue({ isLoaded: false, loadError: new Error('Failed to load map') });

    render(
      React.createElement(ItineraryMap, {
        items: [],
        layoutMode: 'vertical',
        onLayoutChange: vi.fn(),
        onStyleChange: vi.fn(),
      }),
    );

    expect(screen.getByText('Error loading map: Failed to load map')).toBeInTheDocument();
    expect(screen.getByLabelText('Vertical layout')).toBeInTheDocument();
    expect(screen.getByLabelText('Horizontal layout')).toBeInTheDocument();
    expect(screen.getByLabelText('Fit to itinerary')).toBeDisabled();
    expect(screen.getByLabelText('Map style')).toBeDisabled();
  });
});
