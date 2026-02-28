// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripTimelineListView } from '../../../components/tripview/TripTimelineListView';
import { makeActivityItem, makeCityItem, makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/TripTimelineListView', () => {
  it('renders a clickable transfer pill between city sections', () => {
    const travel = makeTravelItem('travel-a-b', 2.05, 'Morning transfer');
    travel.description = 'Transfer from **Kabul** to _Herat_.';

    const activity = makeActivityItem('activity-b-1', 'Herat', 2.5);
    activity.description = 'Visit the **Citadel** and [book ahead](https://example.com).';

    const heratCity = makeCityItem({ id: 'city-b', title: 'Herat', startDateOffset: 2.3, duration: 2, color: 'bg-amber-400' });
    heratCity.description = 'Historic center with **old citadel walls**.';

    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [
        makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' }),
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

    fireEvent.click(transferButton);
    expect(onSelect).toHaveBeenCalledWith('travel-a-b');

    expect(screen.queryByText('From Kabul via Train')).not.toBeInTheDocument();
    expect(screen.getByText('old citadel walls', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('**Citadel**')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'book ahead' })).toHaveAttribute('href', 'https://example.com');
  });
});
