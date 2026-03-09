// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTripItemUpdateHandlers } from '../../../components/tripview/useTripItemUpdateHandlers';
import { makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/useTripItemUpdateHandlers', () => {
  it('ignores no-op transport mode updates (including aliases) to avoid history churn', () => {
    const travelItem = {
      ...makeTravelItem('travel-1', 1, 'Train Travel'),
      transportMode: 'train' as const,
      routeDistanceKm: 312,
      routeDurationHours: 4.5,
    };
    const trip = makeTrip({
      id: 'trip-transport-noop',
      items: [travelItem],
    });

    const markUserEdit = vi.fn();
    const setPendingLabel = vi.fn();
    const handleUpdateItems = vi.fn();
    const clearRouteStatusForItem = vi.fn();

    const { result } = renderHook(() => useTripItemUpdateHandlers({
      trip,
      cityColorPaletteId: 'default',
      mapColorMode: 'trip',
      currentViewSettings: {
        layoutMode: 'horizontal',
        timelineView: 'horizontal',
        mapStyle: 'standard',
        zoomLevel: 1,
      },
      requireEdit: () => true,
      markUserEdit,
      setPendingLabel,
      handleUpdateItems,
      clearRouteStatusForItem,
      safeUpdateTrip: vi.fn(),
      scheduleCommit: vi.fn(),
    }));

    act(() => {
      result.current.handleUpdateItem('travel-1', { transportMode: 'train' });
    });

    act(() => {
      result.current.handleUpdateItem('travel-1', { transportMode: 'rail' as any });
    });

    expect(markUserEdit).not.toHaveBeenCalled();
    expect(setPendingLabel).not.toHaveBeenCalled();
    expect(handleUpdateItems).not.toHaveBeenCalled();
    expect(clearRouteStatusForItem).not.toHaveBeenCalled();
  });

  it('applies changed transport mode once and clears stale route metrics', () => {
    const travelItem = {
      ...makeTravelItem('travel-2', 1, 'Train Travel'),
      transportMode: 'train' as const,
      routeDistanceKm: 312,
      routeDurationHours: 4.5,
    };
    const trip = makeTrip({
      id: 'trip-transport-change',
      items: [travelItem],
    });

    const markUserEdit = vi.fn();
    const setPendingLabel = vi.fn();
    const handleUpdateItems = vi.fn();
    const clearRouteStatusForItem = vi.fn();

    const { result } = renderHook(() => useTripItemUpdateHandlers({
      trip,
      cityColorPaletteId: 'default',
      mapColorMode: 'trip',
      currentViewSettings: {
        layoutMode: 'horizontal',
        timelineView: 'horizontal',
        mapStyle: 'standard',
        zoomLevel: 1,
      },
      requireEdit: () => true,
      markUserEdit,
      setPendingLabel,
      handleUpdateItems,
      clearRouteStatusForItem,
      safeUpdateTrip: vi.fn(),
      scheduleCommit: vi.fn(),
    }));

    act(() => {
      result.current.handleUpdateItem('travel-2', { transportMode: 'bus' });
    });

    expect(clearRouteStatusForItem).toHaveBeenCalledWith('travel-2');
    expect(markUserEdit).toHaveBeenCalledTimes(1);
    expect(setPendingLabel).toHaveBeenCalledWith('Data: Changed transport type');
    expect(handleUpdateItems).toHaveBeenCalledTimes(1);

    const [nextItems] = handleUpdateItems.mock.calls[0];
    expect(nextItems).toEqual([
      expect.objectContaining({
        id: 'travel-2',
        type: 'travel',
        transportMode: 'bus',
        routeDistanceKm: undefined,
        routeDurationHours: undefined,
      }),
    ]);
  });
});
