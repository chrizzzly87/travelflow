// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeActivityItem, makeCityItem } from '../../helpers/tripFixtures';
import { useTripSelectionController } from '../../../components/tripview/useTripSelectionController';

describe('components/tripview/useTripSelectionController', () => {
  it('keeps a deferred details panel collapsed after selecting an item until the user explicitly opens it', () => {
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
        clearSelectionOnClose: true,
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

  it('re-opens hidden details when the same selected item is tapped again', () => {
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
        clearSelectionOnClose: true,
        setPendingLabel,
        handleUpdateItems,
      });
    });

    act(() => {
      result.current.handleTimelineSelect('activity-1');
    });

    expect(result.current.detailsPanelVisible).toBe(false);

    act(() => {
      result.current.handleTimelineSelect('activity-1');
    });

    expect(result.current.detailsPanelVisible).toBe(true);
  });

  it('clears the selection when a clear-on-close details panel closes', () => {
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
        clearSelectionOnClose: true,
        setPendingLabel,
        handleUpdateItems,
      });
    });

    act(() => {
      result.current.handleTimelineSelect('city-1', { isCity: true });
    });

    expect(result.current.hasSelection).toBe(true);

    act(() => {
      result.current.openDetailsPanel();
    });

    expect(result.current.detailsPanelVisible).toBe(true);

    act(() => {
      result.current.closeDetailsPanel();
    });

    expect(result.current.hasSelection).toBe(false);
    expect(result.current.detailsPanelVisible).toBe(false);
    expect(result.current.selectedCitiesInTimeline).toEqual([]);
  });

  it('never surfaces a details panel, and never drops the selection, when the panel is disabled', () => {
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
        detailsPanelEnabled: false,
        clearSelectionOnClose: false,
        setPendingLabel,
        handleUpdateItems,
      });
    });

    act(() => {
      result.current.handleTimelineSelect('city-1', { isCity: true });
    });

    expect(result.current.hasSelection).toBe(true);
    expect(result.current.detailsPanelVisible).toBe(false);

    // Tapping the same item again used to re-open the hidden drawer.
    act(() => {
      result.current.handleTimelineSelect('city-1', { isCity: true });
    });

    expect(result.current.detailsPanelVisible).toBe(false);

    act(() => {
      result.current.openDetailsPanel();
      result.current.toggleDetailsPanel();
    });

    expect(result.current.detailsPanelVisible).toBe(false);

    // Regression: closing dropped the selection, which made the mobile day
    // strip forget which day the traveller was on.
    act(() => {
      result.current.closeDetailsPanel();
    });

    expect(result.current.hasSelection).toBe(true);
    expect(result.current.selectedCitiesInTimeline.map((city) => city.id)).toEqual(['city-1']);
  });
});
