import { useCallback, useMemo } from 'react';

import type { ITimelineItem } from '../../types';

interface UseTripCityForceFillOptions {
    tripItems: ITimelineItem[];
    selectedItemId: string | null;
    setPendingLabel: (label: string) => void;
    handleUpdateItems: (items: ITimelineItem[]) => void;
}

export const useTripCityForceFill = ({
    tripItems,
    selectedItemId,
    setPendingLabel,
    handleUpdateItems,
}: UseTripCityForceFillOptions) => {
    const handleForceFill = useCallback((id: string) => {
        const cities = tripItems
            .filter((item) => item.type === 'city')
            .sort((a, b) => a.startDateOffset - b.startDateOffset);

        const targetIndex = cities.findIndex((item) => item.id === id);
        if (targetIndex === -1) return;

        const targetCity = cities[targetIndex];
        setPendingLabel(`Data: Changed city duration (fill space) in ${targetCity.title}`);

        const previousCity = targetIndex > 0 ? cities[targetIndex - 1] : null;
        const nextCity = targetIndex < cities.length - 1 ? cities[targetIndex + 1] : null;

        const previousEnd = previousCity ? previousCity.startDateOffset + previousCity.duration : 0;
        const nextStart = previousCity ? previousEnd : 0;
        let nextDuration = targetCity.duration;

        if (nextCity) {
            const availableDuration = nextCity.startDateOffset - nextStart;
            nextDuration = Math.max(0.5, availableDuration);
        }

        const nextItems = tripItems.map((item) => (
            item.id === id
                ? { ...item, startDateOffset: nextStart, duration: Math.max(0.5, nextDuration) }
                : item
        ));

        handleUpdateItems(nextItems);
    }, [handleUpdateItems, setPendingLabel, tripItems]);

    const selectedCityForceFill = useMemo<{ mode: 'stretch' | 'shrink'; label: string } | null>(() => {
        if (!selectedItemId) return null;

        const cities = tripItems
            .filter((item) => item.type === 'city')
            .sort((a, b) => a.startDateOffset - b.startDateOffset);
        const targetIndex = cities.findIndex((item) => item.id === selectedItemId);
        if (targetIndex === -1) return null;

        const targetCity = cities[targetIndex];
        const previousCity = targetIndex > 0 ? cities[targetIndex - 1] : null;
        const nextCity = targetIndex < cities.length - 1 ? cities[targetIndex + 1] : null;

        const previousEnd = previousCity ? previousCity.startDateOffset + previousCity.duration : 0;
        const nextStart = nextCity ? nextCity.startDateOffset : null;
        const currentStart = targetCity.startDateOffset;
        const currentEnd = targetCity.startDateOffset + targetCity.duration;

        const gapBefore = currentStart > previousEnd + 0.05;
        const overlapBefore = currentStart < previousEnd - 0.05;
        const gapAfter = nextStart !== null ? currentEnd < nextStart - 0.05 : false;
        const overlapAfter = nextStart !== null ? currentEnd > nextStart + 0.05 : false;

        if (!(gapBefore || gapAfter || overlapBefore || overlapAfter)) return null;

        const mode = (overlapBefore && overlapAfter) ? 'shrink' : 'stretch';
        const label = (overlapBefore && overlapAfter) ? 'Occupy available space' : 'Stretch to fill space';
        return { mode, label };
    }, [tripItems, selectedItemId]);

    return {
        handleForceFill,
        selectedCityForceFill,
    };
};
