import { useEffect, useState } from 'react';
import {
  getSyncRunSnapshot,
  retrySyncNow,
  startTripSyncManager,
  subscribeSyncStatus,
  syncQueuedTripsNow,
  type SyncRunSnapshot,
} from '../services/tripSyncManager';

interface UseSyncStatusResult {
  snapshot: SyncRunSnapshot;
  retrySyncNow: () => Promise<SyncRunSnapshot>;
  syncQueuedTripsNow: () => Promise<SyncRunSnapshot>;
}

export const useSyncStatus = (): UseSyncStatusResult => {
  const [snapshot, setSnapshot] = useState<SyncRunSnapshot>(() => getSyncRunSnapshot());

  useEffect(() => {
    startTripSyncManager();
    return subscribeSyncStatus((next) => {
      setSnapshot(next);
    });
  }, []);

  return {
    snapshot,
    retrySyncNow,
    syncQueuedTripsNow,
  };
};
