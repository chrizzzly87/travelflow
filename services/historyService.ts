import { ITrip, IViewSettings } from "../types";
import { buildTripUrl, generateVersionId } from "./appRuntimeUtils";
import { readLocalStorageItem, writeLocalStorageItem } from "./browserStorageService";

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
const HISTORY_WRITE_FALLBACK_ORIGIN = 'https://travelflow.invalid';

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

const cloneStore = (store: HistoryStore): HistoryStore => (
    Object.fromEntries(
        Object.entries(store).map(([tripId, entries]) => [
            tripId,
            entries.map((entry) => ({
                ...entry,
                snapshot: entry.snapshot
                    ? {
                        trip: entry.snapshot.trip,
                        view: entry.snapshot.view,
                    }
                    : undefined,
            })),
        ]),
    )
);

const tryWriteStore = (store: HistoryStore): boolean => (
    writeLocalStorageItem(HISTORY_KEY, JSON.stringify(store))
);

const saveStore = (
    store: HistoryStore,
    options?: { protectedEntry?: Pick<HistoryEntry, 'tripId' | 'url'> },
): boolean => {
    if (tryWriteStore(store)) {
        return true;
    }

    const protectedEntry = options?.protectedEntry;
    const isProtectedEntry = (entry: HistoryEntry): boolean => (
        protectedEntry?.tripId === entry.tripId && protectedEntry?.url === entry.url
    );

    const prunedStore = cloneStore(store);
    const prunableSnapshotEntries = Object.values(prunedStore)
        .flat()
        .filter((entry) => entry.snapshot && !isProtectedEntry(entry))
        .sort((a, b) => a.ts - b.ts);

    for (const entry of prunableSnapshotEntries) {
        delete entry.snapshot;
        if (tryWriteStore(prunedStore)) {
            return true;
        }
    }

    const prunableEntries = Object.entries(prunedStore)
        .flatMap(([tripId, entries]) => entries.map((entry) => ({ tripId, entry })))
        .filter(({ entry }) => !isProtectedEntry(entry))
        .sort((a, b) => a.entry.ts - b.entry.ts);

    for (const { tripId, entry } of prunableEntries) {
        prunedStore[tripId] = (prunedStore[tripId] || []).filter((candidate) => candidate.id !== entry.id);
        if (prunedStore[tripId]?.length === 0) {
            delete prunedStore[tripId];
        }
        if (tryWriteStore(prunedStore)) {
            return true;
        }
    }

    console.error("Failed to save history store", new Error('History storage write failed'));
    return false;
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

    if (list.length > 0 && list[0].url === url) return true;

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
    const persisted = saveStore(store, {
        protectedEntry: {
            tripId,
            url,
        },
    });

    if (persisted && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tf:history', { detail: { tripId, entry } }));
    }
    return persisted;
};

const buildHistoryBaseUrl = (tripId: string, baseUrlOverride?: string): string => {
    if (!baseUrlOverride) {
        return buildTripUrl(tripId);
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : HISTORY_WRITE_FALLBACK_ORIGIN;
    const nextUrl = new URL(baseUrlOverride, origin);
    nextUrl.searchParams.delete('v');
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
};

export const createTripHistorySnapshotEntry = ({
    tripId,
    trip,
    view,
    label,
    ts,
    baseUrlOverride,
}: {
    tripId: string;
    trip: ITrip;
    view?: IViewSettings;
    label: string;
    ts?: number;
    baseUrlOverride?: string;
}): { url: string; persisted: boolean } => {
    const versionId = generateVersionId();
    const url = baseUrlOverride
        ? (() => {
            const origin = typeof window !== 'undefined' ? window.location.origin : HISTORY_WRITE_FALLBACK_ORIGIN;
            const nextUrl = new URL(baseUrlOverride, origin);
            nextUrl.searchParams.set('v', versionId);
            return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        })()
        : buildTripUrl(tripId, versionId);

    const persisted = appendHistoryEntry(tripId, url, label, {
        snapshot: { trip, view },
        ts,
    });
    return {
        url: persisted ? url : buildHistoryBaseUrl(tripId, baseUrlOverride),
        persisted,
    };
};

export const findHistoryEntryByUrl = (tripId: string, url: string): HistoryEntry | null => {
    const list = getHistoryEntries(tripId);
    return list.find(entry => entry.url === url) || null;
};
