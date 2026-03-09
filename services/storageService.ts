import { ITrip } from "../types";
import { readLocalStorageItem, writeLocalStorageItem } from "./browserStorageService";

const STORAGE_KEY = 'travelflow_trips_v1';

const normalizeTrip = (trip: unknown): ITrip | null => {
    if (!trip || typeof trip !== 'object') return null;
    const candidate = trip as Partial<ITrip>;

    if (typeof candidate.id !== 'string') return null;
    if (typeof candidate.title !== 'string') return null;
    if (!Array.isArray(candidate.items)) return null;

    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now();
    const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : createdAt;

    return {
        ...candidate,
        createdAt,
        updatedAt,
        isFavorite: Boolean(candidate.isFavorite),
        isPinned: Boolean(candidate.isPinned),
        pinnedAt: typeof candidate.pinnedAt === 'number' && Number.isFinite(candidate.pinnedAt)
            ? candidate.pinnedAt
            : undefined,
        showOnPublicProfile: candidate.showOnPublicProfile !== false,
        status: candidate.status === 'archived' ? 'archived' : candidate.status === 'expired' ? 'expired' : 'active',
        tripExpiresAt: typeof candidate.tripExpiresAt === 'string' ? candidate.tripExpiresAt : null,
    } as ITrip;
};

const sortTripsByUpdatedAtDesc = (trips: ITrip[]): ITrip[] =>
    [...trips].sort((a: ITrip, b: ITrip) => b.updatedAt - a.updatedAt);

const tryWriteTrips = (trips: ITrip[]): boolean => writeLocalStorageItem(STORAGE_KEY, JSON.stringify(trips));

const writeTripsWithPruning = (
    trips: ITrip[],
): {
    success: boolean;
    persistedCount: number;
    originalCount: number;
} => {
    const normalized = sortTripsByUpdatedAtDesc(trips);
    const originalCount = normalized.length;
    if (tryWriteTrips(normalized)) {
        return {
            success: true,
            persistedCount: originalCount,
            originalCount,
        };
    }

    if (normalized.length <= 1) {
        return {
            success: false,
            persistedCount: 0,
            originalCount,
        };
    }

    // If localStorage quota is exceeded, keep as many most-recent trips as fit.
    let low = 1;
    let high = normalized.length - 1;
    let bestFitCount = 0;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = normalized.slice(0, mid);
        if (tryWriteTrips(candidate)) {
            bestFitCount = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    if (bestFitCount > 0) {
        return {
            success: true,
            persistedCount: bestFitCount,
            originalCount,
        };
    }

    return {
        success: false,
        persistedCount: 0,
        originalCount,
    };
};

export const getAllTrips = (): ITrip[] => {
    try {
        const raw = readLocalStorageItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const trips = parsed
            .map(normalizeTrip)
            .filter((trip): trip is ITrip => Boolean(trip));
        return sortTripsByUpdatedAtDesc(trips);
    } catch (e) {
        console.error("Failed to load trips from storage", e);
        return [];
    }
};

export const saveTrip = (trip: ITrip, options?: { preserveUpdatedAt?: boolean }): void => {
    try {
        const trips = getAllTrips();
        const existingIndex = trips.findIndex(t => t.id === trip.id);
        const updatedAt = options?.preserveUpdatedAt
            ? (typeof trip.updatedAt === 'number' ? trip.updatedAt : Date.now())
            : Date.now();
        
        const tripToSave: ITrip = {
            ...trip,
            createdAt: typeof trip.createdAt === 'number' ? trip.createdAt : Date.now(),
            updatedAt,
            isFavorite: Boolean(trip.isFavorite),
            isPinned: Boolean(trip.isPinned),
            pinnedAt: typeof trip.pinnedAt === 'number' && Number.isFinite(trip.pinnedAt)
                ? trip.pinnedAt
                : undefined,
            showOnPublicProfile: trip.showOnPublicProfile !== false,
        };
        
        if (existingIndex >= 0) {
            trips[existingIndex] = tripToSave;
        } else {
            trips.unshift(tripToSave);
        }

        const writeResult = writeTripsWithPruning(trips);
        if (!writeResult.success) {
            throw new Error('Trip storage write failed');
        }
        if (writeResult.persistedCount < writeResult.originalCount) {
            console.warn(
                `Trip storage quota reached; persisted ${writeResult.persistedCount}/${writeResult.originalCount} most-recent trips.`,
            );
        }
        window.dispatchEvent(new CustomEvent('tf:trips-updated'));
    } catch (e) {
        console.error("Failed to save trip", e);
    }
};

export const deleteTrip = (id: string): void => {
    try {
        const trips = getAllTrips();
        const filtered = trips.filter(t => t.id !== id);
        const writeResult = writeTripsWithPruning(filtered);
        if (!writeResult.success) {
            throw new Error('Trip storage write failed');
        }
        window.dispatchEvent(new CustomEvent('tf:trips-updated'));
    } catch (e) {
        console.error("Failed to delete trip", e);
    }
};

export const getTripById = (id: string): ITrip | undefined => {
    const trips = getAllTrips();
    return trips.find(t => t.id === id);
};

export const setAllTrips = (trips: ITrip[]): void => {
    try {
        const normalized = trips
            .map(normalizeTrip)
            .filter((trip): trip is ITrip => Boolean(trip));
        const writeResult = writeTripsWithPruning(normalized);
        if (!writeResult.success) {
            throw new Error('Trip storage write failed');
        }
        if (writeResult.persistedCount < writeResult.originalCount) {
            console.warn(
                `Trip storage quota reached; persisted ${writeResult.persistedCount}/${writeResult.originalCount} most-recent trips.`,
            );
        }
        window.dispatchEvent(new CustomEvent('tf:trips-updated'));
    } catch (e) {
        console.error("Failed to replace trips in storage", e);
    }
};
