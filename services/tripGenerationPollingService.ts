import type { ITrip } from '../types';
import { getTripGenerationState } from './tripGenerationDiagnosticsService';

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
    return remoteState !== localState;
};
