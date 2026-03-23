// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TripWorkspacePlacesPage } from '../../../components/tripview/workspace/TripWorkspacePlacesPage';
import type { ITrip } from '../../../types';

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: vi.fn(),
  getAnalyticsDebugAttributes: () => ({}),
}));

vi.mock('../../../components/GoogleMapsLoader', () => ({
  useGoogleMaps: () => ({
    isLoaded: false,
    loadError: null,
  }),
}));

const buildTrip = (): ITrip => ({
  id: 'trip-thailand',
  title: 'Thailand Explorer',
  startDate: '2026-03-21',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  items: [
    {
      id: 'city-bangkok',
      type: 'city',
      title: 'Bangkok',
      startDateOffset: 0,
      duration: 3,
      color: 'bg-amber-500',
      coordinates: { lat: 13.7563, lng: 100.5018 },
    },
    {
      id: 'city-chiang-mai',
      type: 'city',
      title: 'Chiang Mai',
      startDateOffset: 3,
      duration: 4,
      color: 'bg-emerald-500',
      coordinates: { lat: 18.7883, lng: 98.9853 },
    },
  ],
});

describe('components/tripview/workspace/TripWorkspacePlacesPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows country prep framing and city overlay details with filtered context', async () => {
    render(
      React.createElement(TripWorkspacePlacesPage, {
        trip: buildTrip(),
        selectedItem: null,
        travelerWarnings: [],
      }),
    );

    expect(screen.getByText('Keep the regulatory and practical layer readable')).toBeInTheDocument();
    expect(screen.getByText('Trip-specific city notes')).toBeInTheDocument();
    expect(screen.queryByText('Traveler warnings')).not.toBeInTheDocument();
    expect(screen.getByText(/Sathorn and Ari reduce first-night friction/i)).toBeInTheDocument();

    const districtsTab = screen.getByRole('tab', { name: 'Districts' });
    fireEvent.mouseDown(districtsTab, { button: 0 });
    await waitFor(() => expect(districtsTab).toHaveAttribute('data-state', 'active'));

    expect(screen.getByRole('radio', { name: 'All areas' })).toBeInTheDocument();
    expect(screen.getAllByText('Sathorn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Talat Noi').length).toBeGreaterThan(0);
    expect(screen.getByText(/area anchors currently visible/i)).toBeInTheDocument();
  });
});
