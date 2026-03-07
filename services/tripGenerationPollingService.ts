import type { ITrip, TripGenerationJobSummary } from '../types';
import {
    getLatestTripGenerationAttempt,
    TRIP_GENERATION_TIMEOUT_MS,
    getTripGenerationState,
} from './tripGenerationDiagnosticsService';
import { isTripGenerationJobActive } from './tripGenerationJobService';

const toMs = (value?: string | null): number => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const isInFlightState = (state: ReturnType<typeof getTripGenerationState>): boolean => state === 'queued' || state === 'running';
const LOCAL_IN_FLIGHT_STALE_FALLBACK_MS = 90_000;
export const ASYNC_TRIP_STALL_RECOVERY_NUDGE_AFTER_MS = TRIP_GENERATION_TIMEOUT_MS + 20_000;
export const ASYNC_TRIP_STALL_RECOVERY_FAIL_AFTER_MS = TRIP_GENERATION_TIMEOUT_MS + 75_000;

export type AsyncTripGenerationStallRecoveryAction = 'ignore' | 'nudge_worker' | 'mark_failed';

export const shouldPollTripGenerationState = (
    trip: ITrip,
    nowMs: number,
): boolean => {
    const state = getTripGenerationState(trip, nowMs);
    return state === 'running' || state === 'queued';
};

export const shouldApplyPolledTripUpdate = (
    localTrip: ITrip,
    remoteTrip: ITrip,
    nowMs: number,
): boolean => {
    const remoteUpdatedAt = typeof remoteTrip.updatedAt === 'number' ? remoteTrip.updatedAt : 0;
    const localUpdatedAt = typeof localTrip.updatedAt === 'number' ? localTrip.updatedAt : 0;
    if (remoteUpdatedAt > localUpdatedAt) return true;

    const remoteState = getTripGenerationState(remoteTrip, nowMs);
    const localState = getTripGenerationState(localTrip, nowMs);
    if (remoteState === localState) return false;

    const remoteLatestAttempt = getLatestTripGenerationAttempt(remoteTrip);
    const localLatestAttempt = getLatestTripGenerationAttempt(localTrip);
    const remoteAttemptStartedAtMs = toMs(remoteLatestAttempt?.startedAt);
    const localAttemptStartedAtMs = toMs(localLatestAttempt?.startedAt);
    const localInFlightAgeMs = localAttemptStartedAtMs > 0 ? nowMs - localAttemptStartedAtMs : null;
    const localInFlightLikelyStale = (
        isInFlightState(localState)
        && typeof localInFlightAgeMs === 'number'
        && localInFlightAgeMs >= LOCAL_IN_FLIGHT_STALE_FALLBACK_MS
    );

    if (isInFlightState(localState) && !isInFlightState(remoteState)) {
        if (localInFlightLikelyStale) return true;
        // Do not regress queued/running local retries back to stale terminal remote data.
        if (remoteAttemptStartedAtMs < localAttemptStartedAtMs) return false;
        if (remoteUpdatedAt < localUpdatedAt) return false;
    }

    if (!isInFlightState(localState) && isInFlightState(remoteState)) {
        return true;
    }

    return remoteAttemptStartedAtMs >= localAttemptStartedAtMs;
};

export const getAsyncTripGenerationStallRecoveryAction = (input: {
    latestAttemptId: string | null | undefined;
    generationElapsedMs: number | null | undefined;
    jobs: Array<Pick<TripGenerationJobSummary, 'attemptId' | 'state' | 'runAfter' | 'leaseExpiresAt'>>;
    nowMs: number;
}): AsyncTripGenerationStallRecoveryAction => {
    const attemptId = input.latestAttemptId?.trim() || '';
    if (!attemptId) return 'ignore';
    if (typeof input.generationElapsedMs !== 'number' || input.generationElapsedMs < ASYNC_TRIP_STALL_RECOVERY_NUDGE_AFTER_MS) {
        return 'ignore';
    }

    const hasActiveJob = input.jobs.some((job) => (
        job.attemptId === attemptId
        && isTripGenerationJobActive(job, input.nowMs)
    ));
    if (hasActiveJob) return 'ignore';

    return input.generationElapsedMs >= ASYNC_TRIP_STALL_RECOVERY_FAIL_AFTER_MS
        ? 'mark_failed'
        : 'nudge_worker';
};
