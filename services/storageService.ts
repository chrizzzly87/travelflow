import { ITrip } from "../types";

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
    } as ITrip;
};

export const getAllTrips = (): ITrip[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const trips = parsed
            .map(normalizeTrip)
            .filter((trip): trip is ITrip => Boolean(trip));
        // Sort by updatedAt descending
        return trips.sort((a: ITrip, b: ITrip) => b.updatedAt - a.updatedAt);
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
        };
        
        if (existingIndex >= 0) {
            trips[existingIndex] = tripToSave;
        } else {
            trips.unshift(tripToSave);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch (e) {
        console.error("Failed to save trip", e);
    }
};

export const deleteTrip = (id: string): void => {
    try {
        const trips = getAllTrips();
        const filtered = trips.filter(t => t.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
        console.error("Failed to delete trip", e);
    }
};

export const getTripById = (id: string): ITrip | undefined => {
    const trips = getAllTrips();
    return trips.find(t => t.id === id);
};
