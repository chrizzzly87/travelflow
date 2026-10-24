import { preloadTripClaimConflictDialog } from '../../components/tripview/tripClaimRecoveryBoundary';
import { readTripClaimConflictQuery, TRIP_CLAIM_CONFLICT_ALREADY_CLAIMED } from '../../services/tripClaimNavigation';

/** Prepare recovery with native navigation so the first shown dialog has real links. */
export async function prepareTripClaimRecovery(search: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (readTripClaimConflictQuery(search) !== TRIP_CLAIM_CONFLICT_ALREADY_CLAIMED) return;
    await preloadTripClaimConflictDialog();
    signal.throwIfAborted();
}
