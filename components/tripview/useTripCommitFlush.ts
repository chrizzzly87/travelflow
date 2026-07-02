import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

import { enqueueTripCommit } from '../../services/offlineChangeQueue';
import type { PendingTripCommitState } from './useTripLiveUpdate';

export type PendingCommitFlushReason = 'unmount' | 'pagehide';

interface UseTripCommitFlushOptions {
    commitTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    pendingCommitRef: MutableRefObject<PendingTripCommitState | null>;
    pendingHistoryLabelRef: MutableRefObject<string | null>;
    /**
     * Runs the regular commit path (`onCommitState`) for a flushed payload.
     * Used when the page keeps running (SPA unmount/navigation).
     */
    commitNow: (payload: PendingTripCommitState, label: string) => void;
}

/**
 * Guarantees a debounced trip commit scheduled by `scheduleCommit` cannot be
 * lost when the component unmounts or the page is torn down mid-debounce.
 *
 * - `unmount` (SPA navigation, page stays alive): the pending payload is
 *   committed immediately through the normal `onCommitState` path, which owns
 *   history entries and resilient offline fallback.
 * - `pagehide` / `visibilitychange -> hidden` (tab close, navigation away,
 *   mobile backgrounding): async work started here can be silently killed by
 *   the browser, so the payload is persisted synchronously to the offline
 *   change queue (localStorage). `tripSyncManager` replays it right away if
 *   the page survives (bfcache restore, tab switch) or on the next load if it
 *   does not — including the version-history entry with the original label.
 */
export const useTripCommitFlush = ({
    commitTimerRef,
    pendingCommitRef,
    pendingHistoryLabelRef,
    commitNow,
}: UseTripCommitFlushOptions) => {
    const flushPendingCommit = useCallback((reason: PendingCommitFlushReason) => {
        const payload = pendingCommitRef.current;
        if (!payload) return;

        if (commitTimerRef.current) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
        pendingCommitRef.current = null;
        const label = pendingHistoryLabelRef.current || 'Data: Updated trip';
        pendingHistoryLabelRef.current = null;

        if (reason === 'pagehide') {
            // Synchronous localStorage write survives page teardown; a fetch
            // issued from a pagehide handler is not guaranteed to complete.
            enqueueTripCommit({
                tripId: payload.trip.id,
                tripSnapshot: payload.trip,
                viewSnapshot: payload.view ?? null,
                label,
            });
            return;
        }

        commitNow(payload, label);
    }, [commitNow, commitTimerRef, pendingCommitRef, pendingHistoryLabelRef]);

    // Latch the newest flush implementation so the listener effect can stay
    // mounted for the component's whole lifetime. Re-running the effect on
    // every `commitNow` identity change would flush pending commits early via
    // its cleanup, breaking debounce semantics mid-session.
    const flushRef = useRef(flushPendingCommit);
    useEffect(() => {
        flushRef.current = flushPendingCommit;
    }, [flushPendingCommit]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handlePageHide = () => flushRef.current('pagehide');
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flushRef.current('pagehide');
        };

        window.addEventListener('pagehide', handlePageHide);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', handlePageHide);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            flushRef.current('unmount');
        };
    }, []);

    return { flushPendingCommit };
};
