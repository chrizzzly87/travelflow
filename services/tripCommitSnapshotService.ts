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
        view: liveView ?? pendingView,
    };
};
