import { useCallback, type MutableRefObject } from 'react';

import type { ITrip, IViewSettings } from '../../types';

export interface PendingTripCommitState {
    trip: ITrip;
    view: IViewSettings;
    skipToast?: boolean;
}

interface SyncLiveTripStateOptions {
    tripRef: MutableRefObject<ITrip>;
    pendingCommitRef: MutableRefObject<PendingTripCommitState | null>;
    updatedTrip: ITrip;
}

interface UseTripLiveUpdateOptions {
    tripRef: MutableRefObject<ITrip>;
    pendingCommitRef: MutableRefObject<PendingTripCommitState | null>;
    requireEdit: () => boolean;
    onUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean; preserveUpdatedAt?: boolean }) => void;
}

export const syncLiveTripState = ({
    tripRef,
    pendingCommitRef,
    updatedTrip,
}: SyncLiveTripStateOptions): void => {
    tripRef.current = updatedTrip;

    if (pendingCommitRef.current?.trip?.id === updatedTrip.id) {
        pendingCommitRef.current = {
            ...pendingCommitRef.current,
            trip: updatedTrip,
        };
    }
};

export const useTripLiveUpdate = ({
    tripRef,
    pendingCommitRef,
    requireEdit,
    onUpdateTrip,
}: UseTripLiveUpdateOptions) => {
    const safeUpdateTrip = useCallback((
        updatedTrip: ITrip,
        options?: { persist?: boolean; preserveUpdatedAt?: boolean },
    ) => {
        if (!requireEdit()) return;

        syncLiveTripState({
            tripRef,
            pendingCommitRef,
            updatedTrip,
        });
        onUpdateTrip(updatedTrip, options);
    }, [onUpdateTrip, pendingCommitRef, requireEdit, tripRef]);

    return {
        safeUpdateTrip,
    };
};
