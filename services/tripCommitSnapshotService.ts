import type { ITrip, IViewSettings } from '../types';

const toComparableUpdatedAt = (trip: ITrip): number => (
    typeof trip.updatedAt === 'number' && Number.isFinite(trip.updatedAt)
        ? trip.updatedAt
        : Number.NEGATIVE_INFINITY
);

export const resolveDeferredTripCommitSnapshot = ({
    pendingTrip,
    liveTrip,
    pendingView,
    liveView,
}: {
    pendingTrip: ITrip;
    liveTrip: ITrip | null;
    pendingView?: IViewSettings;
    liveView?: IViewSettings;
}): { trip: ITrip; view: IViewSettings | undefined } => {
    const resolvedTrip = liveTrip && liveTrip.id === pendingTrip.id
        ? (toComparableUpdatedAt(liveTrip) >= toComparableUpdatedAt(pendingTrip) ? liveTrip : pendingTrip)
        : pendingTrip;

    return {
        trip: resolvedTrip,
        // The scheduled snapshot is the authoritative intent for this commit.
        // Falling back to the later live view can reintroduce stale UI state
        // during data commits when route/view hydration races with manual
        // visual changes.
        view: pendingView ?? liveView,
    };
};
