// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfileTripCard } from '../../components/profile/ProfileTripCard';
import { makeTrip } from '../helpers/tripFixtures';

describe('components/profile/ProfileTripCard', () => {
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
          labels: {
            open: 'Open trip',
            favorite: 'Favorite',
            unfavorite: 'Unfavorite',
            pin: 'Pin',
            unpin: 'Unpin',
            pinnedTag: 'Pinned',
            mapUnavailable: 'Map unavailable',
            mapLoading: 'Loading map',
          },
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
});
