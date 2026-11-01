// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildTripCalendarExport: vi.fn(),
  downloadTripCalendarExport: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../../../services/tripCalendarExportService', () => ({
  buildTripCalendarExport: mocks.buildTripCalendarExport,
  downloadTripCalendarExport: mocks.downloadTripCalendarExport,
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

import { useTripCalendarExport } from '../../../components/tripview/useTripCalendarExport';
import { makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/useTripCalendarExport', () => {
  beforeEach(() => {
    mocks.buildTripCalendarExport.mockReset();
    mocks.downloadTripCalendarExport.mockReset();
    mocks.trackEvent.mockReset();
  });

  it('exports one activity from the details panel and tracks it with the item id', () => {
    const bundle = { eventCount: 1 };
    mocks.buildTripCalendarExport.mockReturnValue(bundle);
    mocks.downloadTripCalendarExport.mockReturnValue(true);
    const displayTrip = makeTrip({ id: 'trip-1' });

    const { result } = renderHook(() => useTripCalendarExport({ displayTrip, tripId: 'trip-1' }));
    result.current.handleExportSelectedActivityCalendar('item-7');

    expect(mocks.buildTripCalendarExport).toHaveBeenCalledWith({ trip: displayTrip, scope: 'activity', activityId: 'item-7' });
    expect(mocks.downloadTripCalendarExport).toHaveBeenCalledWith(bundle);
    expect(mocks.trackEvent).toHaveBeenCalledWith('trip_view__calendar_export--activity', {
      trip_id: 'trip-1',
      source: 'details_panel',
      event_count: 1,
      item_id: 'item-7',
    });
  });

  it.each([
    ['handleExportActivitiesCalendar', 'activities'],
    ['handleExportCitiesCalendar', 'cities'],
    ['handleExportAllCalendar', 'all'],
  ] as const)('%s exports the %s scope with its source', (handlerName, scope) => {
    mocks.buildTripCalendarExport.mockReturnValue({ eventCount: 4 });
    mocks.downloadTripCalendarExport.mockReturnValue(true);
    const displayTrip = makeTrip({ id: 'trip-2' });

    const { result } = renderHook(() => useTripCalendarExport({ displayTrip, tripId: 'trip-2' }));
    result.current[handlerName]('print_view');

    expect(mocks.buildTripCalendarExport).toHaveBeenCalledWith({ trip: displayTrip, scope, activityId: undefined });
    expect(mocks.trackEvent).toHaveBeenCalledWith(`trip_view__calendar_export--${scope}`, {
      trip_id: 'trip-2',
      source: 'print_view',
      event_count: 4,
    });
  });

  it('does not download or track when there is nothing to export', () => {
    mocks.buildTripCalendarExport.mockReturnValue(null);
    const { result } = renderHook(() => useTripCalendarExport({ displayTrip: makeTrip(), tripId: 'trip-1' }));
    result.current.handleExportAllCalendar('trip_info_modal');

    expect(mocks.downloadTripCalendarExport).not.toHaveBeenCalled();
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });

  it('does not track when the download did not start', () => {
    mocks.buildTripCalendarExport.mockReturnValue({ eventCount: 2 });
    mocks.downloadTripCalendarExport.mockReturnValue(false);
    const { result } = renderHook(() => useTripCalendarExport({ displayTrip: makeTrip(), tripId: 'trip-1' }));
    result.current.handleExportCitiesCalendar('trip_info_modal');

    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });

  it('keeps handler identities stable across re-renders with the same trip', () => {
    const displayTrip = makeTrip({ id: 'trip-1' });
    const { result, rerender } = renderHook(
      ({ trip }) => useTripCalendarExport({ displayTrip: trip, tripId: trip.id }),
      { initialProps: { trip: displayTrip } },
    );
    const first = result.current;
    rerender({ trip: displayTrip });
    expect(result.current.handleExportSelectedActivityCalendar).toBe(first.handleExportSelectedActivityCalendar);
    expect(result.current.handleExportAllCalendar).toBe(first.handleExportAllCalendar);

    rerender({ trip: makeTrip({ id: 'trip-1' }) });
    expect(result.current.handleExportAllCalendar).not.toBe(first.handleExportAllCalendar);
  });
});
