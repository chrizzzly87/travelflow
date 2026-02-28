// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripTimelineListView } from '../../../components/tripview/TripTimelineListView';
import { makeActivityItem, makeCityItem, makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: (eventName: string, payload?: Record<string, unknown>) => {
    const attributes: Record<string, string> = {
      'data-tf-track-event': eventName,
    };
    if (payload) {
      attributes['data-tf-track-payload'] = JSON.stringify(payload);
    }
    return attributes;
  },
}));

describe('components/tripview/TripTimelineListView', () => {
  it('renders timeline interactions with hover affordances and analytics events', () => {
    analyticsMocks.trackEvent.mockReset();

    const travel = makeTravelItem('travel-a-b', 2.05, 'Morning transfer');
    travel.description = 'Transfer from **Kabul** to _Herat_.';

    const activity = makeActivityItem('activity-b-1', 'Herat', 2.5);
    activity.title = 'Citadel of Herat';
    activity.description = 'Visit the **Citadel** and [book ahead](https://example.com).';

    const heratCity = makeCityItem({ id: 'city-b', title: 'Herat', startDateOffset: 2.3, duration: 2, color: 'bg-amber-400' });
    heratCity.countryName = 'Iran';
    heratCity.description = 'Historic center with **old citadel walls**.';
    const kabulCity = makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' });
    kabulCity.countryName = 'Afghanistan';

    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [
        kabulCity,
        travel,
        heratCity,
        makeActivityItem('activity-a-1', 'Kabul', 0.5),
        activity,
      ],
    });

    const onSelect = vi.fn();

    render(
      React.createElement(TripTimelineListView, {
        trip,
        selectedItemId: null,
        onSelect,
      }),
    );

    const transferButton = screen.getByLabelText('Open Train transfer details');
    expect(transferButton).toBeInTheDocument();
    expect(transferButton).toHaveAttribute('data-tf-track-event', 'trip_view__timeline_transfer--open');

    fireEvent.click(transferButton);
    expect(onSelect).toHaveBeenCalledWith('travel-a-b');
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_transfer--open', {
      trip_id: 'trip-1',
      item_id: 'travel-a-b',
      city_id: 'city-b',
      mode: 'train',
    });

    const cityButton = screen.getByRole('heading', { name: 'Herat' }).closest('button');
    if (!cityButton) {
      throw new Error('Expected Herat heading button to exist');
    }
    fireEvent.click(cityButton);
    expect(onSelect).toHaveBeenCalledWith('city-b', { isCity: true });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_city--open', {
      trip_id: 'trip-1',
      city_id: 'city-b',
    });

    expect(screen.queryByText('From Kabul via Train')).not.toBeInTheDocument();
    expect(screen.getByText('old citadel walls', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('**Citadel**')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'book ahead' })).toHaveAttribute('href', 'https://example.com');

    const heratHeading = screen.getByRole('heading', { name: 'Herat' });
    expect(heratHeading.closest('header')).toHaveClass('sticky');
    expect(screen.getByText('old citadel walls', { exact: false }).closest('header')).toBeNull();

    expect(screen.getByText('Iran')).toBeInTheDocument();

    const activityTitle = screen.getByText('Citadel of Herat');
    expect(activityTitle).toHaveClass('cursor-pointer');
    expect(activityTitle.className).toContain('group-hover:underline');
    expect(activityTitle.className).toContain('group-hover:translate-x-1');

    fireEvent.click(activityTitle);
    expect(onSelect).toHaveBeenCalledWith('activity-b-1');
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_activity--open', {
      trip_id: 'trip-1',
      item_id: 'activity-b-1',
      city_id: 'city-b',
    });
  });
});
