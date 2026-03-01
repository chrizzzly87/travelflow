// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTripUpdateItemsHandler } from '../../../components/tripview/useTripUpdateItemsHandler';
import { makeCityItem, makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/useTripUpdateItemsHandler', () => {
  it('labels city-duration changes with quoted names and schedules a commit', () => {
    const cityA = makeCityItem({
      id: 'city-a',
      title: 'Tirana',
      startDateOffset: 0,
      duration: 2,
    });
    const cityB = makeCityItem({
      id: 'city-b',
      title: 'Durres',
      startDateOffset: 2,
      duration: 2,
    });
    const trip = makeTrip({
      id: 'trip-1',
      startDate: '2026-04-01',
      items: [cityA, cityB],
    });

    const markUserEdit = vi.fn();
    const safeUpdateTrip = vi.fn();
    const setPendingLabel = vi.fn();
    const scheduleCommit = vi.fn();
    const normalizeOffsetsForTrip = vi.fn((items) => ({
      items,
      startDate: trip.startDate,
      shiftedDays: 0,
    }));

    const { result } = renderHook(() => useTripUpdateItemsHandler({
      trip,
      currentViewSettings: {
        layoutMode: 'vertical',
        timelineView: 'vertical',
        mapStyle: 'standard',
        routeMode: 'driving',
        showCityNames: true,
        zoomLevel: 1,
      },
      markUserEdit,
      safeUpdateTrip,
      setPendingLabel,
      pendingHistoryLabelRef: { current: null },
      scheduleCommit,
      normalizeOffsetsForTrip,
    }));

    const updatedItems = [
      { ...cityA, duration: 3 },
      cityB,
    ];

    act(() => {
      result.current(updatedItems);
    });

    expect(markUserEdit).toHaveBeenCalled();
    expect(setPendingLabel).toHaveBeenCalledWith('Data: Changed city duration in "Tirana"');
    expect(safeUpdateTrip).toHaveBeenCalledWith(expect.objectContaining({
      items: updatedItems,
      startDate: trip.startDate,
    }), { persist: true });
    expect(scheduleCommit).toHaveBeenCalled();
  });
});
