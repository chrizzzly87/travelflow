import { useCallback } from 'react';

import type { ITrip, ITimelineItem, IViewSettings, MapColorMode } from '../../types';
import { applyCityPaletteToItems, normalizeActivityTypes } from '../../utils';

interface UseTripItemUpdateHandlersOptions {
    trip: ITrip;
    cityColorPaletteId: string;
    mapColorMode: MapColorMode;
    currentViewSettings: IViewSettings;
    requireEdit: () => boolean;
    markUserEdit: () => void;
    setPendingLabel: (label: string) => void;
    handleUpdateItems: (items: ITimelineItem[], options?: { deferCommit?: boolean; skipPendingLabel?: boolean }) => void;
    clearRouteStatusForItem: (itemId: string) => void;
    safeUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
    scheduleCommit: (updatedTrip?: ITrip, view?: IViewSettings) => void;
}

export const useTripItemUpdateHandlers = ({
    trip,
    cityColorPaletteId,
    mapColorMode,
    currentViewSettings,
    requireEdit,
    markUserEdit,
    setPendingLabel,
    handleUpdateItems,
    clearRouteStatusForItem,
    safeUpdateTrip,
    scheduleCommit,
}: UseTripItemUpdateHandlersOptions) => {
    const handleUpdateItem = useCallback((id: string, updates: Partial<ITimelineItem>) => {
        const item = trip.items.find((candidate) => candidate.id === id);
        let sanitizedUpdates = updates;

        if (
            item &&
            (item.type === 'travel' || item.type === 'travel-empty') &&
            updates.transportMode !== undefined &&
            updates.transportMode !== item.transportMode
        ) {
            sanitizedUpdates = {
                ...updates,
                routeDistanceKm: undefined,
                routeDurationHours: undefined,
            };
            clearRouteStatusForItem(item.id);
        }

        if (item) {
            markUserEdit();

            if (item.type === 'city') {
                if (updates.duration !== undefined || updates.startDateOffset !== undefined) {
                    if (updates.duration !== undefined) {
                        setPendingLabel(`Data: Changed city duration in "${item.title}"`);
                    } else {
                        setPendingLabel(`Data: Rescheduled city "${item.title}"`);
                    }
                } else if (updates.hotels !== undefined) {
                    setPendingLabel(`Data: Updated accommodation in "${item.title}"`);
                } else if (updates.description !== undefined) {
                    setPendingLabel(`Data: Updated notes for "${item.title}"`);
                } else if (updates.title !== undefined) {
                    setPendingLabel(`Data: Renamed city "${item.title}"`);
                } else if (updates.location !== undefined || updates.coordinates !== undefined) {
                    setPendingLabel(`Data: Changed city in "${item.title}"`);
                }
            } else if (item.type === 'travel' || item.type === 'travel-empty') {
                if (updates.transportMode !== undefined) {
                    setPendingLabel('Data: Changed transport type');
                } else if (updates.duration !== undefined || updates.startDateOffset !== undefined) {
                    setPendingLabel('Data: Adjusted transport timing');
                }
            } else if (item.type === 'activity') {
                if (updates.title !== undefined || updates.description !== undefined) {
                    setPendingLabel(`Data: Updated activity "${item.title}"`);
                } else if (updates.activityType !== undefined) {
                    setPendingLabel(`Data: Updated activity types for "${item.title}"`);
                } else if (updates.startDateOffset !== undefined || updates.duration !== undefined) {
                    setPendingLabel(`Data: Rescheduled activity "${item.title}"`);
                }
            }
        }

        const nextItems = trip.items.map((candidate) => (
            candidate.id === id ? { ...candidate, ...sanitizedUpdates } : candidate
        ));
        handleUpdateItems(nextItems);
    }, [
        clearRouteStatusForItem,
        handleUpdateItems,
        markUserEdit,
        setPendingLabel,
        trip.items,
    ]);

    const handleBatchItemUpdate = useCallback((
        changes: Array<{ id: string; updates: Partial<ITimelineItem> }>,
        options?: { label?: string; deferCommit?: boolean; skipPendingLabel?: boolean }
    ) => {
        if (changes.length === 0) return;

        const updatesById = new Map(changes.map((change) => [change.id, change.updates]));
        let hasChanges = false;
        const nextItems = trip.items.map((item) => {
            const updates = updatesById.get(item.id);
            if (!updates) return item;
            hasChanges = true;
            return { ...item, ...updates };
        });

        if (!hasChanges) return;
        if (options?.label) setPendingLabel(options.label);

        handleUpdateItems(
            nextItems,
            options?.deferCommit
                ? { deferCommit: true, skipPendingLabel: options?.skipPendingLabel }
                : undefined
        );
    }, [handleUpdateItems, setPendingLabel, trip.items]);

    const handleCityColorPaletteChange = useCallback((paletteId: string, options: { applyToCities: boolean }) => {
        if (!requireEdit()) return;
        if (!paletteId || paletteId === cityColorPaletteId) return;

        markUserEdit();
        const nextItems = options.applyToCities ? applyCityPaletteToItems(trip.items, paletteId) : trip.items;
        const updatedTrip: ITrip = {
            ...trip,
            cityColorPaletteId: paletteId,
            items: nextItems,
            updatedAt: Date.now(),
        };

        setPendingLabel(
            options.applyToCities
                ? 'Data: Applied city color palette to all cities'
                : 'Data: Changed active city color palette'
        );
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
    }, [
        cityColorPaletteId,
        currentViewSettings,
        markUserEdit,
        requireEdit,
        safeUpdateTrip,
        scheduleCommit,
        setPendingLabel,
        trip,
    ]);

    const handleMapColorModeChange = useCallback((mode: MapColorMode) => {
        if (!requireEdit()) return;
        if (mode !== 'brand' && mode !== 'trip') return;
        if (mapColorMode === mode) return;

        markUserEdit();
        const updatedTrip: ITrip = {
            ...trip,
            mapColorMode: mode,
            updatedAt: Date.now(),
        };

        setPendingLabel(
            mode === 'trip'
                ? 'Data: Set map colors to trip colors'
                : 'Data: Set map colors to brand accent'
        );
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
    }, [
        currentViewSettings,
        mapColorMode,
        markUserEdit,
        requireEdit,
        safeUpdateTrip,
        scheduleCommit,
        setPendingLabel,
        trip,
    ]);

    return {
        handleUpdateItem,
        handleBatchItemUpdate,
        handleCityColorPaletteChange,
        handleMapColorModeChange,
    };
};
