import { dbCreateTripVersion, dbGetTrip, dbUpsertTrip, ensureDbSession } from './dbApi';
import {
  enqueueTripCommit,
  getConflictBackups,
  getQueueSnapshot,
  removeQueuedTripCommit,
  storeConflictBackup,
  subscribeOfflineQueue,
  updateQueuedTripCommit,
  type OfflineTripQueueEntry,
} from './offlineChangeQueue';
import {
  getConnectivitySnapshot,
  markConnectivityFailure,
  markConnectivitySuccess,
  subscribeConnectivityStatus,
  type ConnectivityState,
} from './supabaseHealthMonitor';
import { syncTripsFromDb } from './dbService';
import { saveTrip } from './storageService';

export const TRIP_SYNC_STATUS_EVENT = 'tf:trip-sync-status';
export const TRIP_SYNC_TOAST_EVENT = 'tf:trip-sync-toast';

const MAX_REPLAY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 300;
const INTER_ITEM_DELAY_MS = 200;

export interface SyncRunSnapshot {
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  processingEntryId: string | null;
  processingTripId: string | null;
  processedCount: number;
  successCount: number;
  failedDuringRun: number;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  lastTrigger: 'bootstrap' | 'reconnect' | 'manual' | 'queue_update' | null;
  hasConflictBackups: boolean;
}

export interface SyncToastEventDetail {
  type: 'sync_started' | 'sync_completed' | 'sync_partial_failure';
  pendingCount: number;
  failedCount: number;
}

type SyncListener = (snapshot: SyncRunSnapshot) => void;

const listeners = new Set<SyncListener>();

let syncSnapshot: SyncRunSnapshot = {
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  processingEntryId: null,
  processingTripId: null,
  processedCount: 0,
  successCount: 0,
  failedDuringRun: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  lastTrigger: null,
  hasConflictBackups: false,
};

let managerStarted = false;
let lastConnectivityState: ConnectivityState = getConnectivitySnapshot().state;
let syncPromise: Promise<SyncRunSnapshot> | null = null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const emitSnapshot = (snapshot: SyncRunSnapshot) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SyncRunSnapshot>(TRIP_SYNC_STATUS_EVENT, {
    detail: snapshot,
  }));
};

const emitToastEvent = (detail: SyncToastEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SyncToastEventDetail>(TRIP_SYNC_TOAST_EVENT, {
    detail,
  }));
};

const setSyncSnapshot = (updater: (previous: SyncRunSnapshot) => SyncRunSnapshot): SyncRunSnapshot => {
  syncSnapshot = updater(syncSnapshot);
  listeners.forEach((listener) => listener(syncSnapshot));
  emitSnapshot(syncSnapshot);
  return syncSnapshot;
};

const refreshCounts = (): SyncRunSnapshot => {
  const queue = getQueueSnapshot();
  return setSyncSnapshot((previous) => ({
    ...previous,
    pendingCount: queue.pendingCount,
    failedCount: queue.failedCount,
    hasConflictBackups: getConflictBackups().length > 0,
  }));
};

const resolveErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const typed = error as { message?: unknown; code?: unknown; status?: unknown };
    const message = typeof typed.message === 'string' ? typed.message : '';
    const code = typeof typed.code === 'string' ? typed.code : '';
    const status = typeof typed.status === 'number' ? String(typed.status) : '';
    const parts = [code, status, message].filter(Boolean);
    if (parts.length > 0) return parts.join(' | ');
  }
  return 'Unknown sync error';
};

const isServerTripNewerThanQueued = (serverUpdatedAt: number | undefined, queuedUpdatedAt: number | undefined): boolean => {
  const serverTs = typeof serverUpdatedAt === 'number' && Number.isFinite(serverUpdatedAt)
    ? serverUpdatedAt
    : null;
  const queuedTs = typeof queuedUpdatedAt === 'number' && Number.isFinite(queuedUpdatedAt)
    ? queuedUpdatedAt
    : null;
  return serverTs !== null && queuedTs !== null && serverTs > queuedTs;
};

const replaySingleEntryOnce = async (entry: OfflineTripQueueEntry): Promise<void> => {
  const connectivityState = getConnectivitySnapshot().state;
  if (connectivityState !== 'online') {
    throw new Error(`Connectivity is ${connectivityState}`);
  }

  const sessionId = await ensureDbSession();
  if (!sessionId) {
    throw new Error('No Supabase session available');
  }

  const serverTrip = await dbGetTrip(entry.tripId);
  if (serverTrip?.trip && isServerTripNewerThanQueued(serverTrip.trip.updatedAt, entry.tripSnapshot.updatedAt)) {
    storeConflictBackup({
      queueEntryId: entry.id,
      tripId: entry.tripId,
      serverTripSnapshot: serverTrip.trip,
      queuedTripSnapshot: entry.tripSnapshot,
    });
  }

  const upserted = await dbUpsertTrip(entry.tripSnapshot, entry.viewSnapshot ?? undefined);
  if (!upserted) {
    throw new Error('Trip upsert failed during replay');
  }

  const versionId = await dbCreateTripVersion(
    entry.tripSnapshot,
    entry.viewSnapshot ?? undefined,
    entry.label || 'Offline replay',
  );

  if (!versionId) {
    throw new Error('Trip version creation failed during replay');
  }

  saveTrip(entry.tripSnapshot, { preserveUpdatedAt: true });
};

const replaySingleEntryWithRetries = async (entry: OfflineTripQueueEntry): Promise<{ success: boolean; attemptsUsed: number; lastError: string | null }> => {
  let attemptCount = entry.attemptCount;
  let lastError: string | null = null;

  while (attemptCount < MAX_REPLAY_ATTEMPTS) {
    try {
      await replaySingleEntryOnce(entry);
      markConnectivitySuccess('sync_replay_success');
      removeQueuedTripCommit(entry.id);
      return {
        success: true,
        attemptsUsed: attemptCount + 1,
        lastError: null,
      };
    } catch (error) {
      attemptCount += 1;
      lastError = resolveErrorMessage(error);
      markConnectivityFailure(error, {
        source: 'trip_sync',
        operation: 'replay_entry',
        tripId: entry.tripId,
      });

      updateQueuedTripCommit(entry.id, {
        attemptCount,
        lastError,
      });

      if (attemptCount >= MAX_REPLAY_ATTEMPTS) {
        return {
          success: false,
          attemptsUsed: attemptCount,
          lastError,
        };
      }

      const retryDelay = BASE_RETRY_DELAY_MS * (2 ** (attemptCount - 1));
      await delay(retryDelay);
    }
  }

  return {
    success: false,
    attemptsUsed: attemptCount,
    lastError,
  };
};

const runSyncInternal = async (
  trigger: SyncRunSnapshot['lastTrigger'],
  options?: { onlyFailed?: boolean },
): Promise<SyncRunSnapshot> => {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const queueSnapshot = getQueueSnapshot();
    const entries = options?.onlyFailed
      ? queueSnapshot.entries.filter((entry) => Boolean(entry.lastError) || entry.attemptCount > 0)
      : queueSnapshot.entries;

    if (entries.length === 0) {
      const refreshed = refreshCounts();
      return setSyncSnapshot((previous) => ({
        ...refreshed,
        ...previous,
        isSyncing: false,
        processingEntryId: null,
        processingTripId: null,
        processedCount: 0,
        successCount: 0,
        failedDuringRun: 0,
        lastError: null,
        lastTrigger: trigger,
      }));
    }

    emitToastEvent({
      type: 'sync_started',
      pendingCount: entries.length,
      failedCount: queueSnapshot.failedCount,
    });

    const runStartedAt = Date.now();
    let successCount = 0;
    let failedDuringRun = 0;
    let lastError: string | null = null;

    setSyncSnapshot((previous) => ({
      ...previous,
      isSyncing: true,
      processedCount: 0,
      successCount: 0,
      failedDuringRun: 0,
      lastRunAt: runStartedAt,
      lastTrigger: trigger,
      lastError: null,
    }));

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      setSyncSnapshot((previous) => ({
        ...previous,
        processingEntryId: entry.id,
        processingTripId: entry.tripId,
      }));

      const replayResult = await replaySingleEntryWithRetries(entry);
      if (replayResult.success) {
        successCount += 1;
      } else {
        failedDuringRun += 1;
        lastError = replayResult.lastError;
      }

      setSyncSnapshot((previous) => ({
        ...previous,
        processedCount: index + 1,
        successCount,
        failedDuringRun,
        lastError,
      }));

      if (index < entries.length - 1) {
        await delay(INTER_ITEM_DELAY_MS);
      }
    }

    const finalQueueSnapshot = getQueueSnapshot();

    if (finalQueueSnapshot.pendingCount === 0 && getConnectivitySnapshot().state === 'online') {
      await syncTripsFromDb();
    }

    const finishedAt = Date.now();
    const finalSnapshot = setSyncSnapshot((previous) => ({
      ...previous,
      isSyncing: false,
      processingEntryId: null,
      processingTripId: null,
      pendingCount: finalQueueSnapshot.pendingCount,
      failedCount: finalQueueSnapshot.failedCount,
      hasConflictBackups: getConflictBackups().length > 0,
      successCount,
      failedDuringRun,
      lastSuccessAt: successCount > 0 ? finishedAt : previous.lastSuccessAt,
      lastFailureAt: failedDuringRun > 0 ? finishedAt : previous.lastFailureAt,
      lastError,
      lastTrigger: trigger,
    }));

    emitToastEvent({
      type: failedDuringRun > 0 ? 'sync_partial_failure' : 'sync_completed',
      pendingCount: finalSnapshot.pendingCount,
      failedCount: finalSnapshot.failedCount,
    });

    return finalSnapshot;
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
};

const scheduleQueueSync = () => {
  if (syncSnapshot.isSyncing) return;
  if (getConnectivitySnapshot().state !== 'online') return;
  if (getQueueSnapshot().pendingCount === 0) return;
  void runSyncInternal('queue_update');
};

export const startTripSyncManager = (): void => {
  if (managerStarted) return;
  managerStarted = true;

  refreshCounts();

  subscribeConnectivityStatus((connectivity) => {
    const previous = lastConnectivityState;
    lastConnectivityState = connectivity.state;

    if (connectivity.state === 'online' && previous !== 'online') {
      void runSyncInternal('reconnect');
      return;
    }

    if (connectivity.state === 'online') {
      scheduleQueueSync();
    }
  });

  subscribeOfflineQueue(() => {
    refreshCounts();
    scheduleQueueSync();
  });

  scheduleQueueSync();
};

export const getSyncRunSnapshot = (): SyncRunSnapshot => syncSnapshot;

export const subscribeSyncStatus = (listener: SyncListener): (() => void) => {
  listeners.add(listener);
  listener(syncSnapshot);
  return () => {
    listeners.delete(listener);
  };
};

export const retrySyncNow = async (): Promise<SyncRunSnapshot> => {
  startTripSyncManager();
  return runSyncInternal('manual', { onlyFailed: true });
};

export const syncQueuedTripsNow = async (): Promise<SyncRunSnapshot> => {
  startTripSyncManager();
  return runSyncInternal('manual');
};

export const enqueueTripCommitAndSync = (input: Parameters<typeof enqueueTripCommit>[0]) => {
  const snapshot = enqueueTripCommit(input);
  scheduleQueueSync();
  return snapshot;
};

startTripSyncManager();
