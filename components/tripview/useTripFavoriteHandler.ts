import { useCallback } from 'react';

import type { ITrip, IViewSettings } from '../../types';

interface UseTripFavoriteHandlerOptions {
    trip: ITrip;
    currentViewSettings: IViewSettings;
    requireEdit: () => boolean;
    markUserEdit: () => void;
    setPendingLabel: (label: string) => void;
    safeUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
    scheduleCommit: (updatedTrip?: ITrip, view?: IViewSettings) => void;
    showToast: (message: string, options?: { tone?: 'add' | 'remove' | 'neutral' | 'info'; title?: string }) => void;
}

export const useTripFavoriteHandler = ({
    trip,
    currentViewSettings,
    requireEdit,
    markUserEdit,
    setPendingLabel,
    safeUpdateTrip,
    scheduleCommit,
    showToast,
}: UseTripFavoriteHandlerOptions) => {
    const handleToggleFavorite = useCallback(() => {
        if (!requireEdit()) return;

        markUserEdit();
        const nextFavorite = !trip.isFavorite;
        const updatedTrip: ITrip = {
            ...trip,
            isFavorite: nextFavorite,
            updatedAt: Date.now(),
        };

        setPendingLabel(nextFavorite ? 'Data: Added to favorites' : 'Data: Removed from favorites');
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
        showToast(nextFavorite ? 'Trip added to favorites' : 'Trip removed from favorites', {
            tone: nextFavorite ? 'add' : 'remove',
            title: nextFavorite ? 'Added' : 'Removed',
        });
    }, [
        currentViewSettings,
        markUserEdit,
        requireEdit,
        safeUpdateTrip,
        scheduleCommit,
        setPendingLabel,
        showToast,
        trip,
    ]);

    return {
        handleToggleFavorite,
    };
};
