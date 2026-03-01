import { useEffect, useState } from 'react';
import {
  clearConnectivityOverride,
  getConnectivitySnapshot,
  setConnectivityOverride,
  startSupabaseHealthMonitor,
  subscribeConnectivityStatus,
  type ConnectivitySnapshot,
  type ConnectivityState,
} from '../services/supabaseHealthMonitor';

interface UseConnectivityStatusResult {
  snapshot: ConnectivitySnapshot;
  setOverride: (mode: ConnectivityState) => ConnectivitySnapshot;
  clearOverride: () => ConnectivitySnapshot;
}

export const useConnectivityStatus = (): UseConnectivityStatusResult => {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(() => getConnectivitySnapshot());

  useEffect(() => {
    startSupabaseHealthMonitor();
    return subscribeConnectivityStatus((next) => {
      setSnapshot(next);
    });
  }, []);

  return {
    snapshot,
    setOverride: setConnectivityOverride,
    clearOverride: clearConnectivityOverride,
  };
};
