export interface TripGenerationCompletionWatch {
    tripId: string;
    source: string;
    startedAt: number;
    updatedAt: number;
}

type TripGenerationCompletionWatchListener = () => void;

const generationWatches = new Map<string, TripGenerationCompletionWatch>();
const listeners = new Set<TripGenerationCompletionWatchListener>();

const emitWatchUpdate = (): void => {
    listeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // Keep watcher pipeline resilient to subscriber failures.
        }
    });
};

export const registerTripGenerationCompletionWatch = (
    tripId: string,
    source: string,
    nowMs = Date.now(),
): TripGenerationCompletionWatch | null => {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) return null;

    const existing = generationWatches.get(normalizedTripId);
    const watch: TripGenerationCompletionWatch = existing
        ? {
            ...existing,
            source: source || existing.source || 'unknown',
            updatedAt: nowMs,
        }
        : {
            tripId: normalizedTripId,
            source: source || 'unknown',
            startedAt: nowMs,
            updatedAt: nowMs,
        };

    generationWatches.set(normalizedTripId, watch);
    emitWatchUpdate();
    return watch;
};

export const removeTripGenerationCompletionWatch = (tripId: string): boolean => {
    const normalizedTripId = tripId.trim();
    if (!normalizedTripId) return false;
    const didDelete = generationWatches.delete(normalizedTripId);
    if (didDelete) emitWatchUpdate();
    return didDelete;
};

export const listTripGenerationCompletionWatches = (): TripGenerationCompletionWatch[] => (
    Array.from(generationWatches.values())
);

export const subscribeTripGenerationCompletionWatches = (
    listener: TripGenerationCompletionWatchListener,
): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const clearTripGenerationCompletionWatchesForTests = (): void => {
    generationWatches.clear();
    listeners.clear();
};
