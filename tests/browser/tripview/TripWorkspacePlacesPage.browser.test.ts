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

    expect(screen.getByText('Keep practical rules separate from city-specific choices')).toBeInTheDocument();
    const cityGuideTab = screen.getByRole('tab', { name: 'City guide' });
    fireEvent.mouseDown(cityGuideTab, { button: 0 });
    await waitFor(() => expect(cityGuideTab).toHaveAttribute('data-state', 'active'));
    fireEvent.click(screen.getByRole('radio', { name: 'Arrival flow' }));

    expect(screen.getAllByText('Trip-specific').length).toBeGreaterThan(0);
    expect(screen.getByText('No saved traveler warnings yet')).toBeInTheDocument();
    expect(screen.getByText(/Keep the first-night base near easy airport handoffs/i)).toBeInTheDocument();
    expect(screen.getByText('Neighborhoods for arrival flow')).toBeInTheDocument();
    expect(screen.getAllByText('Sathorn').length).toBeGreaterThan(0);
    expect(screen.getByText('2 map zones')).toBeInTheDocument();
    expect(screen.getAllByText('1 stay anchor').length).toBeGreaterThan(0);
  });
});
