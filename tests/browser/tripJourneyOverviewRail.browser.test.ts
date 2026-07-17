// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ITrip } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'journeyLab.chapter.nights') return `${options?.count} nights`;
      if (key === 'journeyLab.transfer.ariaLabel') return `${options?.from} to ${options?.to}, ${options?.duration}`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../services/analyticsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/analyticsService')>();
  return { ...actual, trackEvent: vi.fn() };
});

import { TripJourneyOverviewRail } from '../../components/journey-overview/TripJourneyOverviewRail';
import { trackEvent } from '../../services/analyticsService';

const trip: ITrip = {
  id: 'legacy-thailand-trip',
  title: 'Bangkok and Chiang Mai',
  startDate: '2026-11-01',
  createdAt: 1,
  updatedAt: 1,
  items: [
    {
      id: 'city-bangkok',
      type: 'city',
      title: 'Bangkok',
      color: '#ffc433',
      startDateOffset: 0,
      duration: 3,
      coordinates: { lat: 13.7563, lng: 100.5018 },
    },
    {
      id: 'travel-bangkok-chiang-mai',
      type: 'travel',
      title: 'Train to Chiang Mai',
      color: '#6b7280',
      startDateOffset: 3,
      duration: 0.5,
      transportMode: 'train',
      routeDurationHours: 11,
      routeDistanceKm: 685,
    },
    {
      id: 'city-chiang-mai',
      type: 'city',
      title: 'Chiang Mai',
      color: '#9ae1de',
      startDateOffset: 3.5,
      duration: 4,
      coordinates: { lat: 18.7883, lng: 98.9853 },
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.mocked(trackEvent).mockClear();
});

describe('components/journey-overview/TripJourneyOverviewRail', () => {
  it('keeps the live planning rail independent from playful decision-card styling', () => {
    render(React.createElement(TripJourneyOverviewRail, {
      trip,
      selectedItemId: 'city-bangkok',
      onSelectItem: vi.fn(),
    }));

    const rail = screen.getByTestId('trip-journey-overview');
    const bangkok = screen.getAllByRole('button', { name: 'Bangkok, 3 nights' })[0]!;

    expect(rail).not.toHaveClass('tf-travel-experience');
    expect(bangkok).toHaveClass('tf-trip-journey-route__chapter');
    expect(bangkok).not.toHaveClass('tf-playful-decision-card');
    expect(bangkok).toHaveAttribute('data-selected', 'true');
  });

  it('maps chapter and transfer choices back to the shared TripView item selection', async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();
    render(React.createElement(TripJourneyOverviewRail, {
      trip,
      selectedItemId: 'city-bangkok',
      onSelectItem,
    }));

    await user.click(screen.getAllByRole('button', { name: 'Chiang Mai, 4 nights' })[0]!);
    expect(onSelectItem).toHaveBeenLastCalledWith('city-chiang-mai', true);
    expect(trackEvent).toHaveBeenCalledWith(
      'trip_view__journey_overview--chapter_select',
      expect.objectContaining({ trip_id: trip.id, item_id: 'city-chiang-mai' }),
    );

    await user.click(screen.getAllByRole('button', { name: /Bangkok to Chiang Mai/i })[0]!);
    expect(onSelectItem).toHaveBeenLastCalledWith('travel-bangkok-chiang-mai', false);
    expect(trackEvent).toHaveBeenCalledWith(
      'trip_view__journey_overview--transfer_select',
      expect.objectContaining({ trip_id: trip.id, item_id: 'travel-bangkok-chiang-mai' }),
    );
  });

  it('opens an accessible mobile chapter sheet without changing the route selection', async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();
    render(React.createElement(TripJourneyOverviewRail, {
      trip,
      selectedItemId: null,
      onSelectItem,
    }));

    await user.click(screen.getByRole('button', { name: /journeyLab\.concepts\.lens\.title/i }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(onSelectItem).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'journeyLab.live.close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('consumes Escape while the mobile sheet is open so TripView keeps its selection', async () => {
    const user = userEvent.setup();
    const parentEscapeHandler = vi.fn();
    window.addEventListener('keydown', parentEscapeHandler);

    try {
      render(React.createElement(TripJourneyOverviewRail, {
        trip,
        selectedItemId: 'city-chiang-mai',
        onSelectItem: vi.fn(),
      }));

      await user.click(screen.getByRole('button', { name: /journeyLab\.concepts\.lens\.title/i }));
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(parentEscapeHandler).not.toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'trip_view__journey_overview--toggle',
        expect.objectContaining({ state: 'closed', surface: 'escape' }),
      );
    } finally {
      window.removeEventListener('keydown', parentEscapeHandler);
    }
  });
});
