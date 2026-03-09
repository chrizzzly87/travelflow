import type { ITrip, IViewSettings } from '../types';
import { readLocalStorageItem, writeLocalStorageItem } from './browserStorageService';

export const OFFLINE_QUEUE_STORAGE_KEY = 'travelflow_offline_sync_queue_v1';
export const OFFLINE_CONFLICT_BACKUPS_STORAGE_KEY = 'travelflow_sync_conflict_backups_v1';
export const OFFLINE_QUEUE_EVENT = 'tf:offline-queue-updated';

const MAX_QUEUE_ENTRIES = 80;
const MAX_CONFLICT_BACKUPS = 40;

export interface OfflineTripQueueEntry {
  id: string;
  tripId: string;
  tripSnapshot: ITrip;
  viewSnapshot: IViewSettings | null;
  label: string;
  queuedAt: number;
  attemptCount: number;
  lastError: string | null;
}

export interface OfflineConflictBackupEntry {
  id: string;
  queueEntryId: string;
  tripId: string;
  serverTripSnapshot: ITrip;
  queuedTripSnapshot: ITrip;
  capturedAt: number;
}

export interface OfflineQueueSnapshot {
  entries: OfflineTripQueueEntry[];
  pendingCount: number;
  failedCount: number;
}

type QueueListener = (snapshot: OfflineQueueSnapshot) => void;

const listeners = new Set<QueueListener>();

const now = () => Date.now();

const buildEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `queue_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
};

const isQueueEntry = (value: unknown): value is OfflineTripQueueEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<OfflineTripQueueEntry>;
  return typeof entry.id === 'string'
    && typeof entry.tripId === 'string'
    && Boolean(entry.tripSnapshot)
    && typeof entry.label === 'string'
    && typeof entry.queuedAt === 'number'
    && typeof entry.attemptCount === 'number'
    && (typeof entry.lastError === 'string' || entry.lastError === null);
};

const isConflictBackupEntry = (value: unknown): value is OfflineConflictBackupEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<OfflineConflictBackupEntry>;
  return typeof entry.id === 'string'
    && typeof entry.queueEntryId === 'string'
    && typeof entry.tripId === 'string'
    && Boolean(entry.serverTripSnapshot)
    && Boolean(entry.queuedTripSnapshot)
    && typeof entry.capturedAt === 'number';
};

const readQueue = (): OfflineTripQueueEntry[] => {
  try {
    const raw = readLocalStorageItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueueEntry).sort((a, b) => a.queuedAt - b.queuedAt);
  } catch {
    return [];
  }
};

const writeQueue = (entries: OfflineTripQueueEntry[]): OfflineTripQueueEntry[] => {
  const normalized = [...entries]
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .slice(-MAX_QUEUE_ENTRIES);
  writeLocalStorageItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

const readConflictBackups = (): OfflineConflictBackupEntry[] => {
  try {
    const raw = readLocalStorageItem(OFFLINE_CONFLICT_BACKUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConflictBackupEntry).sort((a, b) => b.capturedAt - a.capturedAt);
  } catch {
    return [];
  }
};

const writeConflictBackups = (entries: OfflineConflictBackupEntry[]): OfflineConflictBackupEntry[] => {
  const normalized = [...entries]
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, MAX_CONFLICT_BACKUPS);
  writeLocalStorageItem(OFFLINE_CONFLICT_BACKUPS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
};

const emitQueueSnapshot = (snapshot: OfflineQueueSnapshot) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OfflineQueueSnapshot>(OFFLINE_QUEUE_EVENT, {
    detail: snapshot,
  }));
};

const notifyQueueListeners = (entries: OfflineTripQueueEntry[]): OfflineQueueSnapshot => {
  const snapshot: OfflineQueueSnapshot = {
    entries,
    pendingCount: entries.length,
    failedCount: entries.filter((entry) => Boolean(entry.lastError)).length,
  };
  listeners.forEach((listener) => listener(snapshot));
  emitQueueSnapshot(snapshot);
  return snapshot;
};

export const getQueueSnapshot = (): OfflineQueueSnapshot => {
  const entries = readQueue();
  return {
    entries,
    pendingCount: entries.length,
    failedCount: entries.filter((entry) => Boolean(entry.lastError)).length,
  };
};

export const subscribeOfflineQueue = (listener: QueueListener): (() => void) => {
  listeners.add(listener);
  listener(getQueueSnapshot());
  return () => {
    listeners.delete(listener);
  };
};

export const enqueueTripCommit = (input: {
  tripId: string;
  tripSnapshot: ITrip;
  viewSnapshot?: IViewSettings | null;
  label: string;
  queuedAt?: number;
}): OfflineQueueSnapshot => {
  const existing = readQueue();
  const filtered = existing.filter((entry) => entry.tripId !== input.tripId);

  const nextEntry: OfflineTripQueueEntry = {
    id: buildEntryId(),
    tripId: input.tripId,
    tripSnapshot: input.tripSnapshot,
    viewSnapshot: input.viewSnapshot ?? null,
    label: input.label,
    queuedAt: input.queuedAt ?? now(),
    attemptCount: 0,
    lastError: null,
  };

  const persisted = writeQueue([...filtered, nextEntry]);
  return notifyQueueListeners(persisted);
};

export const removeQueuedTripCommit = (entryId: string): OfflineQueueSnapshot => {
  const existing = readQueue();
  const persisted = writeQueue(existing.filter((entry) => entry.id !== entryId));
  return notifyQueueListeners(persisted);
};

export const updateQueuedTripCommit = (
  entryId: string,
  patch: Partial<Pick<OfflineTripQueueEntry, 'attemptCount' | 'lastError' | 'tripSnapshot' | 'viewSnapshot' | 'label' | 'queuedAt'>>,
): OfflineQueueSnapshot => {
  const existing = readQueue();
  const persisted = writeQueue(existing.map((entry) => {
    if (entry.id !== entryId) return entry;
    return {
      ...entry,
      ...patch,
    };
  }));
  return notifyQueueListeners(persisted);
};

export const clearOfflineQueue = (): OfflineQueueSnapshot => {
  const persisted = writeQueue([]);
  return notifyQueueListeners(persisted);
};

export const storeConflictBackup = (input: {
  queueEntryId: string;
  tripId: string;
  serverTripSnapshot: ITrip;
  queuedTripSnapshot: ITrip;
}): OfflineConflictBackupEntry[] => {
  const existing = readConflictBackups();
  const nextEntry: OfflineConflictBackupEntry = {
    id: buildEntryId(),
    queueEntryId: input.queueEntryId,
    tripId: input.tripId,
    serverTripSnapshot: input.serverTripSnapshot,
    queuedTripSnapshot: input.queuedTripSnapshot,
    capturedAt: now(),
  };
  return writeConflictBackups([nextEntry, ...existing]);
};

export const getConflictBackups = (): OfflineConflictBackupEntry[] => {
  return readConflictBackups();
};

export const getLatestConflictBackupForTrip = (tripId: string): OfflineConflictBackupEntry | null => {
  const backups = readConflictBackups();
  return backups.find((entry) => entry.tripId === tripId) ?? null;
};
