import { useCallback, useState } from 'react';
import type { ITrip, IViewSettings } from '../../types';
import { useNavigate } from '../../app/navigation';
import { useConnectivityStatus } from '../../hooks/useConnectivityStatus';
import { DB_ENABLED } from '../../config/db';
import { ensureDbSession, dbUpsertTripWithStatus, dbCreateTripVersion, dbAdminOverrideTripCommit } from '../../services/dbApi';
import { enqueueTripCommitAndSync } from '../../services/tripSyncManager';
import { buildTripCommitFingerprint, createTripCommitDeduplicationState, markTripCommitFingerprintCompleted, markTripCommitFingerprintFailed, markTripCommitFingerprintStarted, shouldSkipTripCommitFingerprint } from '../../services/tripCommitDeduplicationService';
import { createLocalHistoryEntry } from './tripSessionModel';
type TripCommitOutcome = 'remote' | 'queued' | 'permission_denied';
export const useTripPersistence = (tripId?: string) => {
    const navigate = useNavigate();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const [session, setSession] = useState(() => ({ tripId, deduplication: createTripCommitDeduplicationState() }));
    if (session.tripId !== tripId) {
        setSession({ tripId, deduplication: createTripCommitDeduplicationState() });
    }
    // An older request must finish against its own session, not mark the newly
    // selected trip as saved after navigation.
    const deduplication = session.deduplication;

    const enqueueTripCommitFallback = useCallback((updatedTrip: ITrip, view: IViewSettings | undefined, label: string) => {
        enqueueTripCommitAndSync({
            tripId: updatedTrip.id,
            tripSnapshot: updatedTrip,
            viewSnapshot: view ?? null,
            label,
        });
    }, []);

    const commitOwnedTripResilient = useCallback(async (
        updatedTrip: ITrip,
        view: IViewSettings | undefined,
        label: string,
    ): Promise<TripCommitOutcome> => {
        const canAttemptRemote = DB_ENABLED && connectivitySnapshot.state === 'online';
        if (!canAttemptRemote) {
            enqueueTripCommitFallback(updatedTrip, view, label);
            return 'queued';
        }

        try {
            const sessionId = await ensureDbSession();
            if (!sessionId) {
                enqueueTripCommitFallback(updatedTrip, view, label);
                return 'queued';
            }

            const upsertResult = await dbUpsertTripWithStatus(updatedTrip, view);
            if (!upsertResult.tripId) {
                if (upsertResult.isPermissionError) {
                    return 'permission_denied';
                }
                enqueueTripCommitFallback(updatedTrip, view, label);
                return 'queued';
            }
            const versionId = await dbCreateTripVersion(updatedTrip, view, label);
            if (!versionId) {
                enqueueTripCommitFallback(updatedTrip, view, label);
                return 'queued';
            }
            return 'remote';
        } catch {
            // A rejected transport request is recoverable in the same way as a
            // disconnected browser. Keep the already saved local edit queued.
            enqueueTripCommitFallback(updatedTrip, view, label);
            return 'queued';
        }
    }, [connectivitySnapshot.state, enqueueTripCommitFallback]);

    const handleCommitState = useCallback((updatedTrip: ITrip, view: IViewSettings | undefined, options?: { replace?: boolean; label?: string; adminOverride?: boolean }) => {
        const label = options?.label || 'Updated trip';
        const commitTs = Date.now();
        const commitFingerprint = buildTripCommitFingerprint({
            trip: updatedTrip,
            view,
            label,
            adminOverride: options?.adminOverride === true,
        });

        if (shouldSkipTripCommitFingerprint(deduplication, commitFingerprint)) {
            return;
        }

        markTripCommitFingerprintStarted(deduplication, commitFingerprint);

        if (!DB_ENABLED) {
            createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);
            markTripCommitFingerprintCompleted(deduplication, commitFingerprint);
            return;
        }

        createLocalHistoryEntry(navigate, updatedTrip, view, label, options, commitTs);

        const commit = async () => {
            if (options?.adminOverride) {
                const sessionId = await ensureDbSession();
                if (!sessionId) {
                    markTripCommitFingerprintFailed(deduplication, commitFingerprint);
                    return;
                }
                const overrideCommit = await dbAdminOverrideTripCommit(updatedTrip, view, label);
                if (!overrideCommit?.tripId || !overrideCommit.versionId) {
                    markTripCommitFingerprintFailed(deduplication, commitFingerprint);
                    return;
                }
                markTripCommitFingerprintCompleted(deduplication, commitFingerprint);
                return;
            }
            const outcome = await commitOwnedTripResilient(updatedTrip, view, label);
            if (outcome === 'remote' || outcome === 'queued') {
                markTripCommitFingerprintCompleted(deduplication, commitFingerprint);
                return;
            }
            markTripCommitFingerprintFailed(deduplication, commitFingerprint);
        };

        void commit().catch(() => {
            // Admin overrides are never queued as regular user writes. A failed
            // privileged request must still release deduplication for a retry.
            markTripCommitFingerprintFailed(deduplication, commitFingerprint);
        });
    }, [commitOwnedTripResilient, deduplication, navigate]);

    return { commitOwnedTripResilient, handleCommitState };
};
