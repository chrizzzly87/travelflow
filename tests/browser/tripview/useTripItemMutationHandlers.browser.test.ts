// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ITimelineItem } from '../../../types';
import { useTripItemMutationHandlers } from '../../../components/tripview/useTripItemMutationHandlers';
import { makeCityItem, makeTrip } from '../../helpers/tripFixtures';

describe('components/tripview/useTripItemMutationHandlers', () => {
  it('emits a quoted remove toast with undo action context', () => {
    const cityItem = makeCityItem({
      id: 'city-1',
      title: 'Albanian Heritage & Riviera Loop',
      startDateOffset: 0,
      duration: 2,
    });
    const activityItem: ITimelineItem = {
      id: 'activity-1',
      type: 'activity',
      title: 'Museum',
      location: 'Tirana',
      startDateOffset: 0,
      duration: 0.5,
      color: '#0ea5e9',
      description: '',
      transportMode: 'na',
      hotels: [],
      activities: [],
      notes: '',
    };
    const trip = makeTrip({
      items: [cityItem, activityItem],
    });

    const showToast = vi.fn();
    const handleUpdateItems = vi.fn();
    const onUndoDelete = vi.fn();

    const { result } = renderHook(() => useTripItemMutationHandlers({
      trip,
      addActivityState: { isOpen: false, dayOffset: 0, location: '' },
      setAddActivityState: vi.fn(),
      isAddCityModalOpen: false,
      setIsAddCityModalOpen: vi.fn(),
      isHistoryOpen: false,
      selectedItemId: cityItem.id,
      setSelectedItemId: vi.fn(),
      setSelectedCityIds: vi.fn(),
      requireEdit: () => true,
      markUserEdit: vi.fn(),
      setPendingLabel: vi.fn(),
      handleUpdateItems,
      showToast,
      pendingHistoryLabelRef: { current: null },
      onUndoDelete,
    }));

    act(() => {
      result.current.handleDeleteItem(cityItem.id);
    });

    expect(handleUpdateItems).toHaveBeenCalledWith([activityItem]);
    expect(showToast).toHaveBeenCalledWith('Removed city "Albanian Heritage & Riviera Loop"', expect.objectContaining({
      tone: 'remove',
      title: 'Removed',
      action: expect.objectContaining({ label: 'Undo' }),
    }));

    const toastOptions = showToast.mock.calls[0]?.[1] as { action?: { onClick: () => void } } | undefined;
    expect(toastOptions?.action).toBeDefined();
    act(() => {
      toastOptions?.action?.onClick();
    });

    expect(onUndoDelete).toHaveBeenCalledWith(cityItem, { previousItems: trip.items });
  });
});
