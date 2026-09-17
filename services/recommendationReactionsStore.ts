/**
 * Remembers which ideas a traveller kept or skipped, per trip, on this device.
 *
 * The trip document is the real home for this, but it can only be written when
 * the trip is editable and the traveller is signed in. A shared link, an
 * example trip or a signed-out session cannot persist anything, and losing
 * every decision on refresh makes the deck useless. This store is the fallback
 * that always works; the trip is still written through whenever it can be, and
 * the two are merged on read.
 */

import type { ITripRecommendationState } from '../types';
import type { SavedRecommendation } from '../shared/recommendations';

const STORAGE_KEY = 'tf_trip_recommendations_v1';
/** Keeps one browser from accumulating decisions for every trip ever opened. */
const MAX_TRIPS = 40;

interface StoredShape {
    version: 1;
    trips: Record<string, { saved: SavedRecommendation[]; dismissedIds: string[]; updatedAt: string }>;
}

const EMPTY: ITripRecommendationState = { saved: [], dismissedIds: [] };

const readAll = (): StoredShape => {
    if (typeof window === 'undefined') return { version: 1, trips: {} };
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { version: 1, trips: {} };
        const parsed = JSON.parse(raw) as StoredShape;
        if (!parsed || typeof parsed !== 'object' || !parsed.trips) return { version: 1, trips: {} };
        return { version: 1, trips: parsed.trips };
    } catch {
        // Private mode, cleared storage, or a shape we no longer understand.
        return { version: 1, trips: {} };
    }
};

export const readStoredRecommendationState = (tripId: string): ITripRecommendationState => {
    const entry = readAll().trips[tripId];
    if (!entry) return EMPTY;
    return {
        saved: Array.isArray(entry.saved) ? entry.saved : [],
        dismissedIds: Array.isArray(entry.dismissedIds) ? entry.dismissedIds : [],
    };
};

export const writeStoredRecommendationState = (
    tripId: string,
    state: ITripRecommendationState,
): void => {
    if (typeof window === 'undefined') return;
    try {
        const all = readAll();
        all.trips[tripId] = {
            saved: state.saved,
            dismissedIds: state.dismissedIds,
            updatedAt: new Date().toISOString(),
        };

        // The trip just written is kept unconditionally: two writes inside the
        // same millisecond tie on `updatedAt`, and a tie must never be the
        // reason the trip in front of the traveller is the one evicted.
        const others = Object.entries(all.trips)
            .filter(([id]) => id !== tripId)
            .sort(([, left], [, right]) => (right.updatedAt || '').localeCompare(left.updatedAt || ''))
            .slice(0, MAX_TRIPS - 1);
        const entries = [[tripId, all.trips[tripId]] as const, ...others];
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: 1, trips: Object.fromEntries(entries) } satisfies StoredShape),
        );
    } catch {
        // Storage can be unavailable or full; the deck still works for this session.
    }
};

/**
 * Combines what the trip knows with what this device knows.
 *
 * A decision is never un-made by a merge: saves union by id, and a dismissal
 * from either side stands. The trip wins on the content of a saved entry, since
 * it is the copy other devices will see.
 */
export const mergeRecommendationState = (
    fromTrip: ITripRecommendationState | undefined,
    fromDevice: ITripRecommendationState,
): ITripRecommendationState => {
    const tripSaved = fromTrip?.saved ?? [];
    const byId = new Map<string, SavedRecommendation>();
    fromDevice.saved.forEach((entry) => byId.set(entry.recommendationId, entry));
    tripSaved.forEach((entry) => byId.set(entry.recommendationId, entry));

    const dismissed = new Set<string>([
        ...(fromTrip?.dismissedIds ?? []),
        ...fromDevice.dismissedIds,
    ]);
    // A kept idea is not also a skipped one; the keep is the later intent.
    byId.forEach((_entry, id) => dismissed.delete(id));

    return {
        saved: Array.from(byId.values()),
        dismissedIds: Array.from(dismissed),
    };
};
