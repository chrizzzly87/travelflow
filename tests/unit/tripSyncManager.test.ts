// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  connectivityState: 'offline' as 'online' | 'degraded' | 'offline',
  dbEnsureSession: vi.fn(),
  dbGetTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
  dbCreateTripVersion: vi.fn(),
  syncTripsFromDb: vi.fn(),
  markConnectivityFailure: vi.fn(),
  markConnectivitySuccess: vi.fn(),
}));

vi.mock('../../services/dbApi', () => ({
  ensureDbSession: mockState.dbEnsureSession,
  dbGetTrip: mockState.dbGetTrip,
  dbUpsertTrip: mockState.dbUpsertTrip,
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
    mockState.dbUpsertTrip.mockResolvedValue('trip-1');
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

    expect(mockState.dbUpsertTrip).toHaveBeenCalledTimes(1);
    expect(mockState.dbUpsertTrip).toHaveBeenCalledWith(failedTrip, undefined);

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

    expect(mockState.dbUpsertTrip).not.toHaveBeenCalled();
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

    expect(mockState.dbUpsertTrip).toHaveBeenCalledTimes(1);
    expect(mockState.dbUpsertTrip).toHaveBeenCalledWith(clientTrip, undefined);
    expect(getQueueSnapshot().pendingCount).toBe(0);

    const backups = getConflictBackups();
    expect(backups.length).toBe(1);
    expect(backups[0].tripId).toBe(clientTrip.id);
    expect(backups[0].serverTripSnapshot.title).toBe('Server title');
    expect(backups[0].queuedTripSnapshot.title).toBe('Client title');
  });
});
