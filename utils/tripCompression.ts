import LZString from 'lz-string';
import type { ISharedState, ITrip, IViewSettings } from '../types';
import { normalizeTrip } from '../services/storageService';

// URL State Management
export const compressTripToUrl = (trip: ITrip): string => {
    const json = JSON.stringify(trip);
    return LZString.compressToEncodedURIComponent(json);
};

export const decompressTripFromUrl = (hash: string): ITrip | null => {
    try {
        const json = LZString.decompressFromEncodedURIComponent(hash);
        if (!json) return null;
        // Validate + normalize the payload shape; malformed payloads (missing
        // id/title, items not an array, malformed items) resolve to null so
        // callers can fail gracefully instead of crashing the trip view.
        return normalizeTrip(JSON.parse(json));
    } catch (e) {
        console.error("Failed to decompress trip", e);
        return null;
    }
};

// --- COMPRESSION ---
export const compressTrip = (trip: ITrip, view?: IViewSettings): string => {
    try {
        const state: ISharedState = { trip, view };
        const json = JSON.stringify(state);
        return LZString.compressToEncodedURIComponent(json);
    } catch (e) {
        console.error("Compression failed", e);
        return "";
    }
};

export const decompressTrip = (encoded: string): ISharedState | null => {
    try {
        const json = LZString.decompressFromEncodedURIComponent(encoded);
        if (!json) return null;
        const trimmedJson = json.trim();
        if (!trimmedJson.startsWith('{') && !trimmedJson.startsWith('[')) {
            return null;
        }

        const parsed = JSON.parse(trimmedJson);
        if (!parsed || typeof parsed !== 'object') return null;

        // Backward compatibility: If parsed object has 'id' and 'items', it's just a trip
        if (parsed.id && Array.isArray(parsed.items)) {
            const trip = normalizeTrip(parsed);
            return trip ? { trip } : null;
        }

        // ISharedState structure: validate + normalize the embedded trip so
        // malformed share payloads (e.g. missing or non-array `items`) return
        // null instead of crashing consumers downstream.
        if (parsed.trip) {
            const trip = normalizeTrip(parsed.trip);
            if (!trip) return null;
            const view = parsed.view && typeof parsed.view === 'object'
                ? parsed.view as IViewSettings
                : undefined;
            return { trip, view };
        }

        return null;
    } catch (e) {
        return null; // Invalid data
    }
};
