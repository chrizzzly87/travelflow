// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { TripTimelineListView } from '../../../components/tripview/TripTimelineListView';
import { makeActivityItem, makeCityItem, makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/TripTimelineListView', () => {
  it('renders a clickable transfer pill between city sections', () => {
    const trip = makeTrip({
      startDate: '2026-03-01',
      items: [
        makeCityItem({ id: 'city-a', title: 'Kabul', startDateOffset: 0, duration: 2, color: 'bg-rose-400' }),
        makeTravelItem('travel-a-b', 2.05, 'Morning transfer'),
        makeCityItem({ id: 'city-b', title: 'Herat', startDateOffset: 2.3, duration: 2, color: 'bg-amber-400' }),
        makeActivityItem('activity-a-1', 'Kabul', 0.5),
        makeActivityItem('activity-b-1', 'Herat', 2.5),
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
  });
});
