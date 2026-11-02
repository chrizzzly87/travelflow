import { readLocalStorageItem, writeLocalStorageItem } from './browserStorageService';

/**
 * Remembers, per trip on this device, whether the map shows the trip's ideas.
 *
 * Off unless switched on: an imported list can hold a hundred pins, and a map
 * that opens covered in them buries the plan.
 */

const STORAGE_KEY = 'tf_trip_idea_layer_v1';
/** Keeps one browser from remembering every trip it ever opened. */
const MAX_TRIPS = 40;

const readTripIds = (): string[] => {
    try {
        const parsed = JSON.parse(readLocalStorageItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
};

export const readTripIdeaLayerVisible = (tripId: string): boolean => readTripIds().includes(tripId);

export const writeTripIdeaLayerVisible = (tripId: string, visible: boolean): boolean => {
    const others = readTripIds().filter((id) => id !== tripId);
    // Most recent first, so the cap drops the trip switched on longest ago.
    const next = visible ? [tripId, ...others].slice(0, MAX_TRIPS) : others;
    return writeLocalStorageItem(STORAGE_KEY, JSON.stringify(next));
};
