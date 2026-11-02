import { useEffect, useState } from 'react';

import type { ITimelineItem } from '../../types';

interface UseTripSelectionOptions {
    tripItems: ITimelineItem[];
}

/**
 * The selected item and the selected cities, pruned when the trip loses the
 * items they point at. The handlers that change the selection live in
 * `useTripSelectionController`, which needs the commit pipeline TripView
 * builds later.
 *
 * TripView calls this where the prune effect used to run, so effect order is
 * unchanged.
 */
export const useTripSelection = ({ tripItems }: UseTripSelectionOptions) => {
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);

    useEffect(() => {
        const cityIdSet = new Set<string>();
        for (const item of tripItems) {
            if (item.type === 'city') {
                cityIdSet.add(item.id);
            }
        }

        if (selectedCityIds.some(id => !cityIdSet.has(id))) {
            setSelectedCityIds(prev => prev.filter(id => cityIdSet.has(id)));
        }

        if (selectedItemId && !tripItems.some(item => item.id === selectedItemId)) {
            setSelectedItemId(null);
        }
    }, [tripItems, selectedCityIds, selectedItemId]);

    return {
        selectedItemId,
        setSelectedItemId,
        selectedCityIds,
        setSelectedCityIds,
    };
};
