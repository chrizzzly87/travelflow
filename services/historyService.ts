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
        trip?: ITrip;
        view?: IViewSettings;
    };
}

const HISTORY_KEY = 'travelflow_history_v1';
const MAX_HISTORY = 200;
const HISTORY_WRITE_FALLBACK_ORIGIN = 'https://travelflow.invalid';

type HistoryStore = Record<string, HistoryEntry[]>;

const isVisualHistoryEntry = (entry: Pick<HistoryEntry, 'label'>): boolean => (
    /^Visual:\s*/i.test(entry.label)
);

const normalizeHistoryStore = (value: unknown): { store: HistoryStore; didMutate: boolean } => {
    if (!value || typeof value !== 'object') {
        return { store: {}, didMutate: false };
    }

    let didMutate = false;
    const normalizedStore: HistoryStore = {};

    Object.entries(value as Record<string, unknown>).forEach(([tripId, entries]) => {
        if (!Array.isArray(entries)) {
            didMutate = true;
            return;
        }

        const normalizedEntries: HistoryEntry[] = [];
        entries.forEach((entryValue) => {
            if (!entryValue || typeof entryValue !== 'object') {
                didMutate = true;
                return;
            }

            const entryRecord = entryValue as Record<string, unknown>;
            const url = typeof entryRecord.url === 'string' ? entryRecord.url : null;
            const label = typeof entryRecord.label === 'string' ? entryRecord.label : null;
            const ts = typeof entryRecord.ts === 'number' && Number.isFinite(entryRecord.ts)
                ? entryRecord.ts
                : Date.now();
            if (!url || !label) {
                didMutate = true;
                return;
            }

            const snapshotRecord = entryRecord.snapshot && typeof entryRecord.snapshot === 'object'
                ? entryRecord.snapshot as Record<string, unknown>
                : null;
            const nextSnapshot = snapshotRecord
                ? {
                    trip: snapshotRecord.trip as ITrip | undefined,
                    view: snapshotRecord.view as IViewSettings | undefined,
                }
                : undefined;

            const compactedSnapshot = (
                nextSnapshot
                && nextSnapshot.trip
                && nextSnapshot.view
                && isVisualHistoryEntry({ label })
            )
                ? { view: nextSnapshot.view }
                : nextSnapshot;

            if (compactedSnapshot !== nextSnapshot) {
                didMutate = true;
            }

            normalizedEntries.push({
                id: typeof entryRecord.id === 'string'
                    ? entryRecord.id
                    : `${ts}-${Math.random().toString(36).slice(2, 8)}`,
                tripId: typeof entryRecord.tripId === 'string' ? entryRecord.tripId : tripId,
                url,
                label,
                ts,
                snapshot: compactedSnapshot,
            });
        });

        const dedupedEntries = normalizedEntries
            .sort((left, right) => right.ts - left.ts)
            .reduce<HistoryEntry[]>((accumulator, entry) => {
                if (accumulator.some((existing) => existing.url === entry.url)) {
                    didMutate = true;
                    return accumulator;
                }
                accumulator.push(entry);
                return accumulator;
            }, [])
            .slice(0, MAX_HISTORY);

        if (dedupedEntries.length !== normalizedEntries.length) {
            didMutate = true;
        }

        if (dedupedEntries.length > 0) {
            normalizedStore[tripId] = dedupedEntries;
        } else if (entries.length > 0) {
            didMutate = true;
        }
    });

    return { store: normalizedStore, didMutate };
};

const loadStore = (): HistoryStore => {
    try {
        const raw = readLocalStorageItem(HISTORY_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        const { store, didMutate } = normalizeHistoryStore(parsed);
        if (didMutate) {
            tryWriteStore(store);
        }
        return store;
    } catch (e) {
        console.error("Failed to load history store", e);
        return {};
    }
};

const tryWriteStore = (store: HistoryStore): boolean => (
    writeLocalStorageItem(HISTORY_KEY, JSON.stringify(store))
);

const cloneStore = (store: HistoryStore): HistoryStore => (
    Object.fromEntries(
        Object.entries(store).map(([tripId, entries]) => [tripId, [...entries]])
    )
);

const dropOldestHistoryEntry = (store: HistoryStore): boolean => {
    let targetTripId: string | null = null;
    let targetIndex = -1;
    let oldestTs = Number.POSITIVE_INFINITY;

    Object.entries(store).forEach(([tripId, entries]) => {
        entries.forEach((entry, index) => {
            if (entry.ts < oldestTs) {
                oldestTs = entry.ts;
                targetTripId = tripId;
                targetIndex = index;
            }
        });
    });

    if (!targetTripId || targetIndex < 0) return false;

    const nextEntries = [...store[targetTripId]];
    nextEntries.splice(targetIndex, 1);
    if (nextEntries.length === 0) {
        delete store[targetTripId];
    } else {
        store[targetTripId] = nextEntries;
    }
    return true;
};

const saveStoreWithPruning = (store: HistoryStore): boolean => {
    if (tryWriteStore(store)) return true;

    const prunedStore = cloneStore(store);
    while (dropOldestHistoryEntry(prunedStore)) {
        if (tryWriteStore(prunedStore)) return true;
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
): boolean => {
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
    const didPersist = saveStoreWithPruning(store);
    if (!didPersist) return false;

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tf:history', { detail: { tripId, entry } }));
    }

    return true;
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
