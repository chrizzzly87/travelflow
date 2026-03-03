// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PrintLayout } from '../../components/PrintLayout';
import type { ITrip } from '../../types';

vi.mock('../../components/ItineraryMap', () => ({
  ItineraryMap: () => React.createElement('div', { 'data-testid': 'print-map-mock' }, 'map'),
}));

const trip: ITrip = {
  id: 'trip-print',
  title: 'Print Export Trip',
  startDate: '2026-04-01',
  createdAt: 1,
  updatedAt: 1,
  items: [
    {
      id: 'city-1',
      type: 'city',
      title: 'Berlin',
      location: 'Berlin, Germany',
      startDateOffset: 0,
      duration: 2,
      color: 'bg-blue-100 border-blue-300 text-blue-800',
      coordinates: { lat: 52.52, lng: 13.405 },
    },
  ],
};

describe('components/PrintLayout calendar exports', () => {
  afterEach(() => {
    cleanup();
  });

  it('triggers export handlers from print toolbar', () => {
    const onExportActivitiesCalendar = vi.fn();
    const onExportCitiesCalendar = vi.fn();
    const onExportAllCalendar = vi.fn();

    render(
      <PrintLayout
        trip={trip}
        onClose={vi.fn()}
        onUpdateTrip={vi.fn()}
        onExportActivitiesCalendar={onExportActivitiesCalendar}
        onExportCitiesCalendar={onExportCitiesCalendar}
        onExportAllCalendar={onExportAllCalendar}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export activities (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export cities (.ics)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download everything (.ics)' }));

    expect(onExportActivitiesCalendar).toHaveBeenCalledTimes(1);
    expect(onExportCitiesCalendar).toHaveBeenCalledTimes(1);
    expect(onExportAllCalendar).toHaveBeenCalledTimes(1);
  });
});
