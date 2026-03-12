// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeActivityItem, makeCityItem } from '../../helpers/tripFixtures';
import { useTripSelectionController } from '../../../components/tripview/useTripSelectionController';

describe('components/tripview/useTripSelectionController', () => {
  it('keeps the mobile details drawer collapsed after selecting an item until the user explicitly opens it', () => {
    const setPendingLabel = vi.fn();
    const handleUpdateItems = vi.fn();
    const tripItems = [
      makeCityItem({ id: 'city-1', title: 'Bangkok', startDateOffset: 0, duration: 2 }),
      makeActivityItem('activity-1', 'Bangkok', 0),
    ];

    const { result } = renderHook(() => {
      const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
      const [selectedCityIds, setSelectedCityIds] = React.useState<string[]>([]);

      return useTripSelectionController({
        tripItems,
        displayTripItems: tripItems,
        selectedItemId,
        setSelectedItemId,
        selectedCityIds,
        setSelectedCityIds,
        isHistoryOpen: false,
        isTripInfoOpen: false,
        autoOpenOnSelect: false,
        setPendingLabel,
        handleUpdateItems,
      });
    });

    act(() => {
      result.current.handleTimelineSelect('city-1', { isCity: true });
    });

    expect(result.current.hasSelection).toBe(true);
    expect(result.current.detailsPanelVisible).toBe(false);

    act(() => {
      result.current.openDetailsPanel();
    });

    expect(result.current.detailsPanelVisible).toBe(true);
  });
});
