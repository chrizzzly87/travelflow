// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { makeTrip } from '../helpers/tripFixtures';
import {
  clearOfflineQueue,
  enqueueTripCommit,
  getConflictBackups,
  getLatestConflictBackupForTrip,
  getQueueSnapshot,
  removeQueuedTripCommit,
  storeConflictBackup,
  updateQueuedTripCommit,
} from '../../services/offlineChangeQueue';

describe('services/offlineChangeQueue', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearOfflineQueue();
  });

  it('coalesces entries by trip id (latest snapshot wins)', () => {
    const firstTrip = makeTrip({ id: 'trip-1', title: 'First', updatedAt: 1_000 });
    const secondTrip = makeTrip({ id: 'trip-1', title: 'Second', updatedAt: 2_000 });

    enqueueTripCommit({
      tripId: firstTrip.id,
      tripSnapshot: firstTrip,
      label: 'Data: Updated trip',
    });
    enqueueTripCommit({
      tripId: secondTrip.id,
      tripSnapshot: secondTrip,
      label: 'Data: Updated trip',
    });

    const snapshot = getQueueSnapshot();
    expect(snapshot.pendingCount).toBe(1);
    expect(snapshot.entries[0].tripSnapshot.title).toBe('Second');
    expect(snapshot.entries[0].attemptCount).toBe(0);
    expect(snapshot.entries[0].lastError).toBeNull();
  });

  it('updates and removes queued entries', () => {
    const trip = makeTrip({ id: 'trip-2', title: 'Queued trip' });

    enqueueTripCommit({
      tripId: trip.id,
      tripSnapshot: trip,
      label: 'Data: Updated trip',
    });

    const queued = getQueueSnapshot().entries[0];
    updateQueuedTripCommit(queued.id, {
      attemptCount: 2,
      lastError: 'network timeout',
    });

    const afterUpdate = getQueueSnapshot();
    expect(afterUpdate.failedCount).toBe(1);
    expect(afterUpdate.entries[0].attemptCount).toBe(2);

    removeQueuedTripCommit(queued.id);
    expect(getQueueSnapshot().pendingCount).toBe(0);
  });

  it('stores server conflict backups and resolves latest per trip', () => {
    const queuedTrip = makeTrip({ id: 'trip-conflict', title: 'Queued title', updatedAt: 1_000 });
    const serverTrip = makeTrip({ id: 'trip-conflict', title: 'Server title', updatedAt: 2_000 });

    storeConflictBackup({
      queueEntryId: 'entry-1',
      tripId: queuedTrip.id,
      queuedTripSnapshot: queuedTrip,
      serverTripSnapshot: serverTrip,
    });

    const backups = getConflictBackups();
    expect(backups.length).toBe(1);
    expect(backups[0].tripId).toBe('trip-conflict');
    expect(backups[0].serverTripSnapshot.title).toBe('Server title');

    const latest = getLatestConflictBackupForTrip('trip-conflict');
    expect(latest?.serverTripSnapshot.title).toBe('Server title');
  });
});
