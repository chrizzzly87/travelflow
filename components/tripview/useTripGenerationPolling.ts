import { useEffect } from 'react';

import type { ITrip, TripGenerationState } from '../../types';
import { DB_ENABLED } from '../../config/db';
import { dbGetTrip } from '../../services/dbApi';
import {
    shouldApplyPolledTripUpdate,
    shouldPollTripGenerationState,
} from '../../services/tripGenerationPollingService';
import { triggerTripGenerationWorker } from '../../services/tripGenerationJobService';
import {
    TRIP_GENERATION_POLL_INTERVAL_MS,
    TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS,
} from './tripViewModel';

type TripUpdateHandler = (updatedTrip: ITrip, options?: { persist?: boolean; preserveUpdatedAt?: boolean }) => void;

interface UseTripGenerationPollingOptions {
    trip: ITrip;
    generationNowMs: number;
    setGenerationNowMs: (nowMs: number) => void;
    generationState: TripGenerationState;
    latestGenerationAttemptOrchestration: string | null;
    connectivityState: string;
    tripAccessSource: string | undefined;
    /** Read at poll time, so a poll compares against the latest local trip. */
    tripRef: { readonly current: ITrip };
    onUpdateTripRef: { readonly current: TripUpdateHandler };
}

/**
 * Keeps a generating trip up to date. While generation runs it ticks the
 * generation clock every second and polls the saved trip; while a job waits in
 * the async worker queue it nudges the worker. The three effects run in this
 * order, as they did inline in TripView, with the same dependency arrays:
 * the state setter and the refs are stable, so they stay out of them.
 */
export const useTripGenerationPolling = ({
    trip,
    generationNowMs,
    setGenerationNowMs,
    generationState,
    latestGenerationAttemptOrchestration,
    connectivityState,
    tripAccessSource,
    tripRef,
    onUpdateTripRef,
}: UseTripGenerationPollingOptions): void => {
    const shouldPollGenerationState = shouldPollTripGenerationState(trip, generationNowMs);
    useEffect(() => {
        if (!shouldPollGenerationState) return undefined;
        const timer = window.setInterval(() => {
            setGenerationNowMs(Date.now());
        }, 1_000);
        return () => window.clearInterval(timer);
    }, [shouldPollGenerationState, trip.id]);
    useEffect(() => {
        if (!DB_ENABLED) return undefined;
        if (!shouldPollGenerationState) return undefined;
        if (connectivityState === 'offline') return undefined;
        if (tripAccessSource === 'public_read') return undefined;

        let cancelled = false;
        let inFlight = false;
        const poll = async () => {
            if (cancelled || inFlight) return;
            inFlight = true;
            try {
                const remote = await dbGetTrip(trip.id, { includeOwnerProfile: false });
                if (cancelled || !remote?.trip) return;

                const remoteTrip = remote.trip;
                const localTrip = tripRef.current;
                if (shouldApplyPolledTripUpdate(localTrip, remoteTrip, Date.now())) {
                    onUpdateTripRef.current(remoteTrip, { preserveUpdatedAt: true });
                }
            } finally {
                inFlight = false;
            }
        };

        void poll();
        const timer = window.setInterval(() => {
            void poll();
        }, TRIP_GENERATION_POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [
        connectivityState,
        shouldPollGenerationState,
        trip.id,
        tripAccessSource,
    ]);
    useEffect(() => {
        if (!DB_ENABLED) return undefined;
        if (connectivityState === 'offline') return undefined;
        if (tripAccessSource === 'public_read') return undefined;
        if (generationState !== 'queued') return undefined;
        if (latestGenerationAttemptOrchestration !== 'async_worker') return undefined;

        let cancelled = false;
        const kickWorker = () => {
            if (cancelled) return;
            void triggerTripGenerationWorker({
                tripId: trip.id,
                limit: 1,
                source: 'trip_view_generation_poll_nudge',
            });
        };

        kickWorker();
        const timer = window.setInterval(kickWorker, TRIP_GENERATION_QUEUE_NUDGE_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [
        connectivityState,
        generationState,
        latestGenerationAttemptOrchestration,
        trip.id,
        tripAccessSource,
    ]);
};
