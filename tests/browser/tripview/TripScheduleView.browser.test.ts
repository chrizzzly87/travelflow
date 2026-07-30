// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TripScheduleView } from '../../../components/tripview/TripScheduleView';
import { makeActivityItem, makeCityItem, makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

const TRANSLATIONS: Record<string, string> = {
  'tripView.workspace.schedule.eyebrow': 'Day by day',
  'tripView.workspace.schedule.title': 'Schedule',
  'tripView.workspace.schedule.description': 'Scan the trip one day at a time.',
  'tripView.workspace.schedule.transfer': 'Transfer',
  'tripView.workspace.schedule.activity': 'Activity',
  'tripView.workspace.schedule.today': 'Today',
  'tripView.workspace.schedule.destinations': 'Destinations',
  'tripView.workspace.schedule.multiDayDestination': 'Continues across multiple days',
  'tripView.workspace.schedule.emptyDay': 'No timed plans yet',
  'tripView.workspace.schedule.previousWeek': 'Previous week',
  'tripView.workspace.schedule.nextWeek': 'Next week',
  'tripView.workspace.schedule.truncated': 'Schedule shortened',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, number>) => {
      if (key === 'tripView.workspace.schedule.dayNumber') return `Day ${values?.count}`;
      if (key === 'tripView.workspace.schedule.weekNumber') return `Week ${values?.count}`;
      if (key === 'tripView.workspace.schedule.weekProgress') return `${values?.current} of ${values?.total}`;
      return TRANSLATIONS[key] || key;
    },
  }),
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: analyticsMocks.trackEvent,
  getAnalyticsDebugAttributes: (eventName: string, payload?: Record<string, unknown>) => ({
    'data-tf-track-event': eventName,
    'data-tf-track-payload': payload ? JSON.stringify(payload) : undefined,
  }),
}));

beforeEach(() => analyticsMocks.trackEvent.mockReset());
afterEach(cleanup);

describe('components/tripview/TripScheduleView', () => {
  it('renders a readable week and reuses the current selection contract', () => {
    const city = makeCityItem({
      id: 'city-berlin',
      title: 'Berlin',
      startDateOffset: 0,
      duration: 3,
    });
    const transfer = makeTravelItem('transfer-berlin', 1.1, 'Train to Berlin');
    transfer.departureTime = '09:30';
    const activity = makeActivityItem('activity-museum', 'Berlin', 1.5);
    activity.title = 'Museum Island';
    const onSelect = vi.fn();

    render(
      React.createElement(TripScheduleView, {
        trip: makeTrip({
          id: 'trip-berlin',
          startDate: '2026-05-04',
          items: [city, transfer, activity],
        }),
        locale: 'en',
        selectedItemId: 'activity-museum',
        onSelect,
      }),
    );

    expect(screen.getByRole('heading', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByText('May 4')).toBeInTheDocument();
    expect(screen.getByText('May 6')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button').filter((button) => (
        button.getAttribute('data-tf-track-event') === 'trip_view__timeline_city--open'
      )),
    ).toHaveLength(3);

    const activityButton = screen.getByRole('button', { name: /Museum Island/ });
    expect(activityButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(activityButton);
    expect(onSelect).toHaveBeenCalledWith('activity-museum', { isCity: false });
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_view__timeline_activity--open', {
      trip_id: 'trip-berlin',
      item_id: 'activity-museum',
      source: 'schedule',
    });

    const transferButton = screen.getByRole('button', { name: /Train to Berlin/ });
    expect(transferButton).toHaveTextContent('09:30');
    fireEvent.click(transferButton);
    expect(onSelect).toHaveBeenCalledWith('transfer-berlin', { isCity: false });
  });

  it('moves between seven-day schedule pages', () => {
    const onSelect = vi.fn();
    render(
      React.createElement(TripScheduleView, {
        trip: makeTrip({
          startDate: '2026-05-04',
          items: [
            makeCityItem({
              id: 'city-long',
              title: 'Long stay',
              startDateOffset: 0,
              duration: 9,
            }),
          ],
        }),
        locale: 'en',
        selectedItemId: null,
        onSelect,
      }),
    );

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText('May 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
  });
});
