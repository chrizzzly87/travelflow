// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProfileTripCard } from '../../components/profile/ProfileTripCard';
import { makeCityItem, makeTrip } from '../helpers/tripFixtures';

const baseLabels = {
  open: 'Open',
  favorite: 'Favorite',
  unfavorite: 'Unfavorite',
  pin: 'Pin',
  unpin: 'Unpin',
  makePublic: 'Public',
  makePrivate: 'Private',
  pinnedTag: 'Pinned',
  mapUnavailable: 'Map preview unavailable',
  mapLoading: 'Loading preview...',
  creatorPrefix: 'By',
};

describe('components/profile/ProfileTripCard', () => {
  it('renders creator attribution link when enabled', async () => {
    const user = userEvent.setup();
    const onCreatorClick = vi.fn();

    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProfileTripCard, {
          trip: makeTrip({
            id: 'card-trip-1',
            title: 'City Break',
            items: [makeCityItem({ id: 'city-1', title: 'Seoul', startDateOffset: 0, duration: 2 })],
          }),
          locale: 'en',
          sourceLabel: 'Created by you',
          labels: baseLabels,
          onOpen: vi.fn(),
          showCreatorAttribution: true,
          creatorHandle: 'original_creator',
          creatorProfilePath: '/u/original_creator',
          onCreatorClick,
          showFavoriteAction: false,
          showPinAction: false,
        })
      )
    );

    const attributionLink = screen.getByRole('link', { name: '@original_creator' });
    expect(attributionLink).toHaveAttribute('href', '/u/original_creator');

    await user.click(attributionLink);
    expect(onCreatorClick).toHaveBeenCalledTimes(1);
  });

  it('hides favorite and pin actions when disabled', () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProfileTripCard, {
          trip: makeTrip({
            id: 'card-trip-2',
            title: 'No Actions Trip',
            items: [makeCityItem({ id: 'city-2', title: 'Tokyo', startDateOffset: 0, duration: 3 })],
          }),
          locale: 'en',
          sourceLabel: 'Created by you',
          labels: baseLabels,
          onOpen: vi.fn(),
          showFavoriteAction: false,
          showPinAction: false,
        })
      )
    );

    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Favorite' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument();
  });

  it('renders an expired badge and fallback title for expired generation drafts', () => {
    render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(ProfileTripCard, {
          trip: makeTrip({
            id: 'card-trip-expired',
            title: 'Trip generation failed. Please try again.',
            status: 'expired',
            items: [
              makeCityItem({
                id: 'loading-error-card-trip-expired',
                title: 'Trip generation failed. Please try again.',
                startDateOffset: 0,
                duration: 2,
              }),
            ],
          }),
          locale: 'en',
          sourceLabel: 'Created by you',
          labels: {
            ...baseLabels,
            expiredTag: 'Expired',
            expiredFallbackTitle: 'Expired trip draft',
          },
          onOpen: vi.fn(),
          showFavoriteAction: false,
          showPinAction: false,
        })
      )
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Expired trip draft')).toBeInTheDocument();
    expect(screen.queryByText('Trip generation failed. Please try again.')).toBeNull();
  });
});
