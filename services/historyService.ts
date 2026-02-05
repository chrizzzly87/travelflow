import { DB_ENABLED, saveHistoryEntryToDb } from './dbService';

export interface HistoryEntry {
    id: string;
    tripId: string;
    url: string;
    label: string;
    ts: number;
}

const HISTORY_KEY = 'travelflow_history_v1';
const MAX_HISTORY = 200;

type HistoryStore = Record<string, HistoryEntry[]>;

const loadStore = (): HistoryStore => {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as HistoryStore;
    } catch (e) {
        console.error("Failed to load history store", e);
        return {};
    }
};

const saveStore = (store: HistoryStore) => {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
    } catch (e) {
        console.error("Failed to save history store", e);
    }
};

export const getHistoryEntries = (tripId: string): HistoryEntry[] => {
    const store = loadStore();
    return store[tripId] || [];
};

export const appendHistoryEntry = (tripId: string, url: string, label: string) => {
    const store = loadStore();
    const list = store[tripId] || [];

    if (list.length > 0 && list[0].url === url) return;

    const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tripId,
        url,
        label,
        ts: Date.now()
    };

    const next = [entry, ...list].slice(0, MAX_HISTORY);
    store[tripId] = next;
    saveStore(store);

    if (DB_ENABLED) {
        saveHistoryEntryToDb(entry);
    }
};

export const findHistoryEntryByUrl = (tripId: string, url: string): HistoryEntry | null => {
    const list = getHistoryEntries(tripId);
    return list.find(entry => entry.url === url) || null;
};
