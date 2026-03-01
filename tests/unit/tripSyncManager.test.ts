// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  connectivityState: 'offline' as 'online' | 'degraded' | 'offline',
  dbEnsureSession: vi.fn(),
  dbGetTrip: vi.fn(),
  dbUpsertTripWithStatus: vi.fn(),
  dbCreateTripVersion: vi.fn(),
  syncTripsFromDb: vi.fn(),
  markConnectivityFailure: vi.fn(),
  markConnectivitySuccess: vi.fn(),
}));

vi.mock('../../services/dbApi', () => ({
  ensureDbSession: mockState.dbEnsureSession,
  dbGetTrip: mockState.dbGetTrip,
  dbUpsertTripWithStatus: mockState.dbUpsertTripWithStatus,
  dbCreateTripVersion: mockState.dbCreateTripVersion,
}));

vi.mock('../../services/dbService', () => ({
  syncTripsFromDb: mockState.syncTripsFromDb,
}));

vi.mock('../../services/supabaseHealthMonitor', () => ({
  getConnectivitySnapshot: () => ({
    state: mockState.connectivityState,
    reason: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    consecutiveFailures: 0,
    isForced: false,
    forcedState: null,
  }),
  subscribeConnectivityStatus: (listener: (snapshot: any) => void) => {
    listener({
      state: mockState.connectivityState,
      reason: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      isForced: false,
      forcedState: null,
    });
    return () => {};
  },
  markConnectivityFailure: mockState.markConnectivityFailure,
  markConnectivitySuccess: mockState.markConnectivitySuccess,
}));

import { makeTrip } from '../helpers/tripFixtures';
import {
  clearOfflineQueue,
  enqueueTripCommit,
  getConflictBackups,
  getQueueSnapshot,
  updateQueuedTripCommit,
} from '../../services/offlineChangeQueue';
import { retrySyncNow, syncQueuedTripsNow } from '../../services/tripSyncManager';

describe('services/tripSyncManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearOfflineQueue();
    mockState.connectivityState = 'offline';
    vi.clearAllMocks();

    mockState.dbEnsureSession.mockResolvedValue('session-1');
    mockState.dbGetTrip.mockResolvedValue(null);
    mockState.dbUpsertTripWithStatus.mockResolvedValue({
      tripId: 'trip-1',
      error: null,
      isPermissionError: false,
    });
    mockState.dbCreateTripVersion.mockResolvedValue('version-1');
  });

  it('retries only failed queue entries on manual retry', async () => {
    const failedTrip = makeTrip({ id: 'trip-failed', title: 'Failed entry' });
    const freshTrip = makeTrip({ id: 'trip-fresh', title: 'Fresh entry' });

    enqueueTripCommit({
      tripId: failedTrip.id,
      tripSnapshot: failedTrip,
      label: 'Data: Failed edit',
    });
    enqueueTripCommit({
      tripId: freshTrip.id,
      tripSnapshot: freshTrip,
      label: 'Data: Fresh edit',
    });

    const failedEntry = getQueueSnapshot().entries.find((entry) => entry.tripId === 'trip-failed');
    expect(failedEntry).toBeTruthy();
    updateQueuedTripCommit(failedEntry!.id, {
      attemptCount: 1,
      lastError: 'network timeout',
    });

    mockState.connectivityState = 'online';
    await retrySyncNow();

    expect(mockState.dbUpsertTripWithStatus).toHaveBeenCalledTimes(1);
    expect(mockState.dbUpsertTripWithStatus).toHaveBeenCalledWith(failedTrip, undefined);

    const queue = getQueueSnapshot();
    expect(queue.entries.some((entry) => entry.tripId === 'trip-fresh')).toBe(true);
  });

  it('does not process fresh entries during manual retry when there are no failures', async () => {
    const freshTrip = makeTrip({ id: 'trip-fresh-only', title: 'Fresh only' });
    enqueueTripCommit({
      tripId: freshTrip.id,
      tripSnapshot: freshTrip,
      label: 'Data: Fresh edit',
    });

    mockState.connectivityState = 'online';
    await retrySyncNow();

    expect(mockState.dbUpsertTripWithStatus).not.toHaveBeenCalled();
    expect(getQueueSnapshot().pendingCount).toBe(1);
  });

  it('captures server backup and still applies queued client snapshot during sync', async () => {
    const clientTrip = makeTrip({ id: 'trip-conflict', title: 'Client title', updatedAt: 1_000 });
    const serverTrip = makeTrip({ id: 'trip-conflict', title: 'Server title', updatedAt: 2_000 });

    enqueueTripCommit({
      tripId: clientTrip.id,
      tripSnapshot: clientTrip,
      label: 'Data: Offline edit',
      queuedAt: 100,
    });

    mockState.connectivityState = 'online';
    mockState.dbGetTrip.mockResolvedValue({
      trip: serverTrip,
      view: serverTrip.defaultView,
      access: null,
    });

    await syncQueuedTripsNow();

    expect(mockState.dbUpsertTripWithStatus).toHaveBeenCalledTimes(1);
    expect(mockState.dbUpsertTripWithStatus).toHaveBeenCalledWith(clientTrip, undefined);
    expect(getQueueSnapshot().pendingCount).toBe(0);

    const backups = getConflictBackups();
    expect(backups.length).toBe(1);
    expect(backups[0].tripId).toBe(clientTrip.id);
    expect(backups[0].serverTripSnapshot.title).toBe('Server title');
    expect(backups[0].queuedTripSnapshot.title).toBe('Client title');
  });

  it('retries failed entries that previously reached max attempts when retried manually', async () => {
    const failedTrip = makeTrip({ id: 'trip-max-attempts', title: 'Needs retry' });
    enqueueTripCommit({
      tripId: failedTrip.id,
      tripSnapshot: failedTrip,
      label: 'Data: Offline edit',
    });

    const queuedEntry = getQueueSnapshot().entries[0];
    updateQueuedTripCommit(queuedEntry.id, {
      attemptCount: 3,
      lastError: 'temporary failure',
    });

    mockState.connectivityState = 'online';
    await retrySyncNow();

    expect(mockState.dbUpsertTripWithStatus).toHaveBeenCalledTimes(1);
    expect(mockState.dbCreateTripVersion).toHaveBeenCalledTimes(1);
    expect(getQueueSnapshot().pendingCount).toBe(0);
  });

  it('does not treat replay upsert failures as connectivity outages', async () => {
    const failedTrip = makeTrip({ id: 'trip-no-connectivity-failure', title: 'Permission-like failure' });
    enqueueTripCommit({
      tripId: failedTrip.id,
      tripSnapshot: failedTrip,
      label: 'Data: Offline edit',
    });

    mockState.connectivityState = 'online';
    mockState.dbUpsertTripWithStatus.mockResolvedValue({
      tripId: null,
      error: null,
      isPermissionError: false,
    });

    await syncQueuedTripsNow();

    expect(mockState.markConnectivityFailure).not.toHaveBeenCalled();
    expect(getQueueSnapshot().pendingCount).toBe(1);
  });

  it('drops queued entries immediately when replay is denied by permission checks', async () => {
    const deniedTrip = makeTrip({ id: 'trip-permission-denied', title: 'Denied' });
    enqueueTripCommit({
      tripId: deniedTrip.id,
      tripSnapshot: deniedTrip,
      label: 'Data: Offline edit',
    });

    mockState.connectivityState = 'online';
    mockState.dbUpsertTripWithStatus.mockResolvedValue({
      tripId: null,
      error: {
        code: 'P0001',
        message: 'Not allowed',
      },
      isPermissionError: true,
    });

    await syncQueuedTripsNow();

    expect(mockState.markConnectivityFailure).not.toHaveBeenCalled();
    expect(getQueueSnapshot().pendingCount).toBe(0);
  });
});
