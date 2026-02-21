import { useCallback, type MutableRefObject } from 'react';
import { ITrip, ITimelineItem, IViewSettings } from '../../types';
import { normalizeActivityTypes, normalizeCityColors } from '../../utils';

interface UpdateItemsOptions {
    deferCommit?: boolean;
    skipPendingLabel?: boolean;
}

interface UseTripUpdateItemsHandlerParams {
    trip: ITrip;
    currentViewSettings: IViewSettings;
    markUserEdit: () => void;
    safeUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
    setPendingLabel: (label: string) => void;
    pendingHistoryLabelRef: MutableRefObject<string | null>;
    scheduleCommit: (nextTrip?: ITrip, nextView?: IViewSettings) => void;
    normalizeOffsetsForTrip: (
        items: ITimelineItem[],
        startDate: string
    ) => { items: ITimelineItem[]; startDate: string; shiftedDays: number };
}

export const useTripUpdateItemsHandler = ({
    trip,
    currentViewSettings,
    markUserEdit,
    safeUpdateTrip,
    setPendingLabel,
    pendingHistoryLabelRef,
    scheduleCommit,
    normalizeOffsetsForTrip,
}: UseTripUpdateItemsHandlerParams) => useCallback((
    items: ITimelineItem[],
    options?: UpdateItemsOptions
) => {
    markUserEdit();
    const normalizedOffsets = options?.deferCommit
        ? { items, startDate: trip.startDate, shiftedDays: 0 }
        : normalizeOffsetsForTrip(items, trip.startDate);
    const normalizedItems = normalizeCityColors(normalizedOffsets.items);
    const nextTripStartDate = normalizedOffsets.startDate;

    if (options?.deferCommit) {
        if (!options.skipPendingLabel && !pendingHistoryLabelRef.current) {
            pendingHistoryLabelRef.current = 'Data: Adjusted timeline items';
        }
        const updatedTrip = { ...trip, items: normalizedItems, updatedAt: Date.now() };
        safeUpdateTrip(updatedTrip, { persist: false });
        return;
    }

    const prevItems = trip.items;
    const prevById = new Map(prevItems.map((item) => [item.id, item]));
    const nextById = new Map(normalizedItems.map((item) => [item.id, item]));

    const added = normalizedItems.filter((item) => !prevById.has(item.id));
    const removed = prevItems.filter((item) => !nextById.has(item.id));

    if (added.length === 1) {
        const addedItem = added[0];
        if (addedItem.type === 'city') setPendingLabel(`Data: Added city ${addedItem.title}`);
        else if (addedItem.type === 'activity') setPendingLabel(`Data: Added activity ${addedItem.title}`);
        else setPendingLabel('Data: Added transport');
    } else if (removed.length === 1) {
        const removedItem = removed[0];
        if (removedItem.type === 'city') setPendingLabel(`Data: Removed city ${removedItem.title}`);
        else if (removedItem.type === 'activity') setPendingLabel(`Data: Removed activity ${removedItem.title}`);
        else setPendingLabel('Data: Removed transport');
    } else {
        for (const nextItem of normalizedItems) {
            const prevItem = prevById.get(nextItem.id);
            if (!prevItem) continue;

            if (nextItem.type === 'city') {
                const durationChanged = prevItem.duration !== nextItem.duration;
                const startChanged = prevItem.startDateOffset !== nextItem.startDateOffset;
                if (durationChanged || startChanged) {
                    if (durationChanged) {
                        setPendingLabel(`Data: Changed city duration in ${nextItem.title}`);
                    } else {
                        setPendingLabel(`Data: Rescheduled city ${nextItem.title}`);
                    }
                    break;
                }
                if (JSON.stringify(prevItem.hotels || []) !== JSON.stringify(nextItem.hotels || [])) {
                    setPendingLabel(`Data: Updated accommodation in ${nextItem.title}`);
                    break;
                }
                if ((prevItem.description || '') !== (nextItem.description || '')) {
                    setPendingLabel(`Data: Updated notes for ${nextItem.title}`);
                    break;
                }
            }

            if (nextItem.type === 'travel' || nextItem.type === 'travel-empty') {
                if ((prevItem.transportMode || '') !== (nextItem.transportMode || '')) {
                    setPendingLabel('Data: Changed transport type');
                    break;
                }
            }

            if (nextItem.type === 'activity') {
                if (prevItem.title !== nextItem.title || (prevItem.description || '') !== (nextItem.description || '')) {
                    setPendingLabel(`Data: Updated activity ${nextItem.title}`);
                    break;
                }
                if (JSON.stringify(normalizeActivityTypes(prevItem.activityType)) !== JSON.stringify(normalizeActivityTypes(nextItem.activityType))) {
                    setPendingLabel(`Data: Updated activity types for ${nextItem.title}`);
                    break;
                }
                if (prevItem.startDateOffset !== nextItem.startDateOffset || prevItem.duration !== nextItem.duration) {
                    setPendingLabel(`Data: Rescheduled activity ${nextItem.title}`);
                    break;
                }
            }
        }
    }

    const updatedTrip = { ...trip, startDate: nextTripStartDate, items: normalizedItems, updatedAt: Date.now() };
    safeUpdateTrip(updatedTrip, { persist: true });
    scheduleCommit(updatedTrip, currentViewSettings);
}, [
    currentViewSettings,
    markUserEdit,
    normalizeOffsetsForTrip,
    pendingHistoryLabelRef,
    safeUpdateTrip,
    scheduleCommit,
    setPendingLabel,
    trip,
]);
