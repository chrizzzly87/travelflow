// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfileTripCard } from '../../components/profile/ProfileTripCard';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

const baseLabels = {
  open: 'Open trip',
  favorite: 'Favorite',
  unfavorite: 'Unfavorite',
  pin: 'Pin',
  unpin: 'Unpin',
  pinnedTag: 'Pinned',
  mapUnavailable: 'Map unavailable',
  mapLoading: 'Loading map',
};

describe('components/profile/ProfileTripCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens the trip from both the map preview and the headline link', async () => {
    const user = userEvent.setup();
    const trip = makeTrip({
      id: 'trip-42',
      title: 'Weekend in Lisbon',
    });
    const onOpen = vi.fn();

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProfileTripCard, {
          trip,
          locale: 'en',
          sourceLabel: 'Saved trip',
          labels: baseLabels,
          onOpen,
        })
      )
    );

    const mapPreviewLink = screen.getByRole('link', { name: 'Open trip: Weekend in Lisbon' });
    const titleLink = screen.getByRole('link', { name: 'Weekend in Lisbon' });

    expect(mapPreviewLink).toHaveAttribute('href', '/trip/trip-42');
    expect(mapPreviewLink).toHaveClass('cursor-pointer');
    expect(titleLink).toHaveAttribute('href', '/trip/trip-42');
    expect(titleLink).toHaveClass('hover:text-accent-700');

    await user.click(mapPreviewLink);
    await user.click(titleLink);

    expect(onOpen).toHaveBeenNthCalledWith(1, trip);
    expect(onOpen).toHaveBeenNthCalledWith(2, trip);
  });

  it('does not carry a failed map image state to the next trip', async () => {
    const renderCard = (tripId: string, title: string) => React.createElement(
      MemoryRouter,
      null,
      React.createElement(ProfileTripCard, {
        trip: makeTrip({
          id: tripId,
          title,
          items: [makeCityItem({ id: `${tripId}-city`, title: 'Porto', startDateOffset: 0, duration: 2 })],
        }),
        locale: 'en',
        sourceLabel: 'Saved trip',
        labels: baseLabels,
        onOpen: vi.fn(),
        showFavoriteAction: false,
        showPinAction: false,
      })
    );

    const { rerender } = render(renderCard('map-trip-1', 'Alpine Loop'));

    const firstMap = await screen.findByAltText('Map preview for Alpine Loop');
    fireEvent.error(firstMap);

    expect(screen.getByText('Map unavailable')).toBeInTheDocument();

    rerender(renderCard('map-trip-2', 'Desert Route'));

    await waitFor(() => {
      expect(screen.getByAltText('Map preview for Desert Route')).toBeInTheDocument();
    });
    expect(screen.queryByText('Map unavailable')).toBeNull();
  });
});
