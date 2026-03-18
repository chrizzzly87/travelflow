import { ITrip, IViewSettings } from "../types";
import { readLocalStorageItem, writeLocalStorageItem } from "./browserStorageService";
import { buildTripUrl, generateVersionId } from "../utils";

export interface HistoryEntry {
    id: string;
    tripId: string;
    url: string;
    label: string;
    ts: number;
    snapshot?: {
        trip: ITrip;
        view?: IViewSettings;
    };
}

const HISTORY_KEY = 'travelflow_history_v1';
const MAX_HISTORY = 200;

type HistoryStore = Record<string, HistoryEntry[]>;

const loadStore = (): HistoryStore => {
    try {
        const raw = readLocalStorageItem(HISTORY_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as HistoryStore;
    } catch (e) {
        console.error("Failed to load history store", e);
        return {};
    }
};

const saveStore = (store: HistoryStore) => {
    try {
        if (!writeLocalStorageItem(HISTORY_KEY, JSON.stringify(store))) {
            throw new Error('History storage write failed');
        }
    } catch (e) {
        console.error("Failed to save history store", e);
    }
};

export const getHistoryEntries = (tripId: string): HistoryEntry[] => {
    const store = loadStore();
    const list = store[tripId] || [];
    const tripPrefix = `/trip/${encodeURIComponent(tripId)}`;
    return list
        .filter(entry => entry.url.startsWith(tripPrefix) || entry.url.startsWith('/s/'))
        .sort((a, b) => b.ts - a.ts);
};

export const appendHistoryEntry = (
    tripId: string,
    url: string,
    label: string,
    options?: { snapshot?: { trip: ITrip; view?: IViewSettings }; ts?: number }
) => {
    const store = loadStore();
    const list = store[tripId] || [];

    if (list.length > 0 && list[0].url === url) return;

    const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tripId,
        url,
        label,
        ts: options?.ts ?? Date.now(),
        snapshot: options?.snapshot,
    };

    const withoutDuplicate = list.filter(existing => existing.url !== url);
    const merged = [entry, ...withoutDuplicate].sort((a, b) => b.ts - a.ts);
    const next = merged.slice(0, MAX_HISTORY);
    store[tripId] = next;
    saveStore(store);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tf:history', { detail: { tripId, entry } }));
    }

};

export const commitVersionedHistorySnapshot = (options: {
    trip: ITrip;
    view?: IViewSettings;
    label: string;
    navigate: (url: string, options: { replace: boolean }) => void;
    replace?: boolean;
    ts?: number;
    baseUrlOverride?: string;
}): string => {
    const versionId = generateVersionId();
    const url = options.baseUrlOverride
        ? `${options.baseUrlOverride}?v=${versionId}`
        : buildTripUrl(options.trip.id, versionId);

    // Persist the versioned snapshot before route navigation so the loader
    // can immediately resolve the just-created state on the next render pass.
    appendHistoryEntry(options.trip.id, url, options.label, {
        snapshot: {
            trip: options.trip,
            view: options.view,
        },
        ts: options.ts,
    });
    options.navigate(url, { replace: options.replace ?? false });
    return url;
};

export const findHistoryEntryByUrl = (tripId: string, url: string): HistoryEntry | null => {
    const list = getHistoryEntries(tripId);
    return list.find(entry => entry.url === url) || null;
};
