import { ITrip } from "../types";

const STORAGE_KEY = 'travelflow_trips_v1';

export const getAllTrips = (): ITrip[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const trips = JSON.parse(raw);
        // Sort by updatedAt descending
        return trips.sort((a: ITrip, b: ITrip) => b.updatedAt - a.updatedAt);
    } catch (e) {
        console.error("Failed to load trips from storage", e);
        return [];
    }
};

export const saveTrip = (trip: ITrip): void => {
    try {
        const trips = getAllTrips();
        const existingIndex = trips.findIndex(t => t.id === trip.id);
        
        const tripToSave = { ...trip, updatedAt: Date.now() };
        
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