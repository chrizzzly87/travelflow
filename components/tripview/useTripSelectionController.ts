import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';

import type { ITimelineItem } from '../../types';
import { reorderSelectedCities } from '../../utils';

interface UseTripSelectionControllerOptions {
    tripItems: ITimelineItem[];
    displayTripItems: ITimelineItem[];
    selectedItemId: string | null;
    setSelectedItemId: Dispatch<SetStateAction<string | null>>;
    selectedCityIds: string[];
    setSelectedCityIds: Dispatch<SetStateAction<string[]>>;
    isHistoryOpen: boolean;
    isTripInfoOpen: boolean;
    setPendingLabel: (label: string) => void;
    handleUpdateItems: (items: ITimelineItem[]) => void;
}

export const useTripSelectionController = ({
    tripItems,
    displayTripItems,
    selectedItemId,
    setSelectedItemId,
    selectedCityIds,
    setSelectedCityIds,
    isHistoryOpen,
    isTripInfoOpen,
    setPendingLabel,
    handleUpdateItems,
}: UseTripSelectionControllerOptions) => {
    const selectedCitiesInTimeline = useMemo(() => {
        if (selectedCityIds.length === 0) return [];

        const selectedSet = new Set(selectedCityIds);
        return displayTripItems
            .filter((item) => item.type === 'city' && selectedSet.has(item.id))
            .sort((a, b) => a.startDateOffset - b.startDateOffset);
    }, [displayTripItems, selectedCityIds]);

    const showSelectedCitiesPanel = selectedCitiesInTimeline.length > 1;
    const detailsPanelVisible = showSelectedCitiesPanel || !!selectedItemId;

    const clearSelection = useCallback(() => {
        setSelectedItemId(null);
        setSelectedCityIds([]);
    }, [setSelectedCityIds, setSelectedItemId]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (isHistoryOpen || isTripInfoOpen) return;
            if (!selectedItemId && selectedCityIds.length === 0) return;
            clearSelection();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [
        clearSelection,
        isHistoryOpen,
        isTripInfoOpen,
        selectedCityIds,
        selectedItemId,
    ]);

    const handleTimelineSelect = useCallback((id: string | null, options?: { multi?: boolean; isCity?: boolean }) => {
        if (!id) {
            clearSelection();
            return;
        }

        const selectedItem = tripItems.find((item) => item.id === id);
        if (!selectedItem) {
            setSelectedItemId(id);
            setSelectedCityIds([]);
            return;
        }

        if (selectedItem.type !== 'city') {
            setSelectedItemId(id);
            setSelectedCityIds([]);
            return;
        }

        if (!options?.multi) {
            setSelectedItemId(id);
            setSelectedCityIds([id]);
            return;
        }

        setSelectedCityIds((previous) => {
            const baseSelection = previous.length > 0
                ? previous
                : (selectedItemId && tripItems.some((item) => item.id === selectedItemId && item.type === 'city')
                    ? [selectedItemId]
                    : []);
            const exists = baseSelection.includes(id);
            const nextSelection = exists
                ? baseSelection.filter((cityId) => cityId !== id)
                : [...baseSelection, id];

            if (nextSelection.length > 1) setSelectedItemId(null);
            else if (nextSelection.length === 1) setSelectedItemId(nextSelection[0]);
            else setSelectedItemId(null);

            return nextSelection;
        });
    }, [
        clearSelection,
        selectedItemId,
        setSelectedCityIds,
        setSelectedItemId,
        tripItems,
    ]);

    const applySelectedCityOrder = useCallback((orderedCityIds: string[]) => {
        if (selectedCityIds.length < 2) return;

        const selectedSet = new Set(selectedCityIds);
        const normalizedOrder = orderedCityIds.filter((id) => selectedSet.has(id));
        if (normalizedOrder.length !== selectedSet.size) return;

        const reorderedItems = reorderSelectedCities(tripItems, selectedCityIds, normalizedOrder);
        if (reorderedItems === tripItems) return;

        setPendingLabel('Data: Reordered selected cities');
        handleUpdateItems(reorderedItems);
        setSelectedItemId(null);
        setSelectedCityIds(normalizedOrder);
    }, [
        handleUpdateItems,
        selectedCityIds,
        setPendingLabel,
        setSelectedCityIds,
        setSelectedItemId,
        tripItems,
    ]);

    const handleReverseSelectedCities = useCallback(() => {
        if (selectedCitiesInTimeline.length < 2) return;
        const reversedOrder = [...selectedCitiesInTimeline].map((city) => city.id).reverse();
        applySelectedCityOrder(reversedOrder);
    }, [applySelectedCityOrder, selectedCitiesInTimeline]);

    return {
        selectedCitiesInTimeline,
        showSelectedCitiesPanel,
        detailsPanelVisible,
        clearSelection,
        handleTimelineSelect,
        applySelectedCityOrder,
        handleReverseSelectedCities,
    };
};
