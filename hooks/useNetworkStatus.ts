import { useEffect, useMemo, useState } from 'react';
import {
    DEFAULT_NETWORK_PROBE_PATH,
    getNavigatorConnection,
    isSlowNetworkConnection,
    probeNetworkReachability,
    readNetworkConnectionSnapshot,
    type NetworkConnectionSnapshot,
} from '../services/networkStatus';

export interface UseNetworkStatusOptions {
    probeWhileOffline?: boolean;
    probeIntervalMs?: number;
    probePath?: string;
}

export interface UseNetworkStatusResult {
    isOnline: boolean;
    isSlowConnection: boolean;
    connection: NetworkConnectionSnapshot | null;
    isProbePending: boolean;
}

export const DEFAULT_NETWORK_PROBE_INTERVAL_MS = 15000;

const readInitialOnlineState = (): boolean => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
};

const readCurrentConnectionSnapshot = (): NetworkConnectionSnapshot | null => {
    if (typeof navigator === 'undefined') return null;
    return readNetworkConnectionSnapshot(navigator);
};

export const useNetworkStatus = (options: UseNetworkStatusOptions = {}): UseNetworkStatusResult => {
    const {
        probeWhileOffline = true,
        probeIntervalMs = DEFAULT_NETWORK_PROBE_INTERVAL_MS,
        probePath = DEFAULT_NETWORK_PROBE_PATH,
    } = options;
    const [isOnline, setIsOnline] = useState(readInitialOnlineState);
    const [connection, setConnection] = useState<NetworkConnectionSnapshot | null>(readCurrentConnectionSnapshot);
    const [isProbePending, setIsProbePending] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const refreshConnectionSnapshot = () => {
            setConnection(readCurrentConnectionSnapshot());
        };

        const handleOnline = () => {
            setIsOnline(true);
            refreshConnectionSnapshot();
        };

        const handleOffline = () => {
            setIsOnline(false);
            refreshConnectionSnapshot();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const networkConnection = getNavigatorConnection(navigator);
        if (!networkConnection || typeof networkConnection.addEventListener !== 'function') {
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }

        const handleConnectionChange = () => {
            refreshConnectionSnapshot();
        };
        networkConnection.addEventListener('change', handleConnectionChange as EventListener);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (typeof networkConnection.removeEventListener === 'function') {
                networkConnection.removeEventListener('change', handleConnectionChange as EventListener);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!probeWhileOffline || isOnline) {
            setIsProbePending(false);
            return;
        }

        let cancelled = false;
        let isProbeInFlight = false;

        const runProbe = async () => {
            if (cancelled || isProbeInFlight) return;
            isProbeInFlight = true;
            setIsProbePending(true);
            const isReachable = await probeNetworkReachability(probePath);
            if (cancelled) return;
            setIsProbePending(false);
            isProbeInFlight = false;
            if (isReachable) {
                setIsOnline(true);
                setConnection(readCurrentConnectionSnapshot());
            }
        };

        void runProbe();
        const timer = window.setInterval(() => {
            void runProbe();
        }, probeIntervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [isOnline, probeIntervalMs, probePath, probeWhileOffline]);

    const isSlowConnection = useMemo(
        () => isSlowNetworkConnection(connection),
        [connection]
    );

    return {
        isOnline,
        isSlowConnection,
        connection,
        isProbePending,
    };
};
