import type { ITrip } from '../types';
import { getTripById } from './storageService';
import {
    readLocalStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
} from './browserStorageService';

export const E2E_TRIP_CLAIM_SANDBOX_STORAGE_KEY = 'tf_e2e_trip_claim_sandbox_v1';

type E2ETripClaimSandboxOutcome =
    | 'claimed_by_another_user'
    | 'recovered_existing_claim';

interface E2ETripClaimSandboxScenario {
    outcome: E2ETripClaimSandboxOutcome;
    tripId?: string | null;
}

type E2ETripClaimSandboxState = Record<string, E2ETripClaimSandboxScenario>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const readSandboxState = (): E2ETripClaimSandboxState => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = readLocalStorageItem(E2E_TRIP_CLAIM_SANDBOX_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) return {};

        return Object.entries(parsed).reduce<E2ETripClaimSandboxState>((acc, [requestId, scenario]) => {
            if (!isRecord(scenario)) return acc;
            const outcome = typeof scenario.outcome === 'string' ? scenario.outcome.trim() : '';
            if (outcome !== 'claimed_by_another_user' && outcome !== 'recovered_existing_claim') {
                return acc;
            }
            acc[requestId] = {
                outcome,
                tripId: typeof scenario.tripId === 'string' && scenario.tripId.trim().length > 0
                    ? scenario.tripId.trim()
                    : null,
            };
            return acc;
        }, {});
    } catch {
        return {};
    }
};

export const resolveE2ETripClaimSandboxScenario = (requestId: string): {
    outcome: E2ETripClaimSandboxOutcome;
    tripId: string | null;
    trip: ITrip | null;
} | null => {
    const normalizedRequestId = requestId.trim();
    if (!normalizedRequestId) return null;
    const state = readSandboxState();
    const scenario = state[normalizedRequestId];
    if (!scenario) return null;
    const tripId = typeof scenario.tripId === 'string' ? scenario.tripId : null;
    const trip = tripId ? getTripById(tripId) || null : null;
    return {
        outcome: scenario.outcome,
        tripId,
        trip,
    };
};

export const clearE2ETripClaimSandbox = (): void => {
    if (typeof window === 'undefined') return;
    removeLocalStorageItem(E2E_TRIP_CLAIM_SANDBOX_STORAGE_KEY);
};

export const setE2ETripClaimSandboxState = (state: E2ETripClaimSandboxState): void => {
    if (typeof window === 'undefined') return;
    writeLocalStorageItem(E2E_TRIP_CLAIM_SANDBOX_STORAGE_KEY, JSON.stringify(state));
};
