import { useEffect, useMemo, useState } from 'react';
import {
    getBrowserConnectivityOverride,
    getEffectiveBrowserOnlineState,
    DEFAULT_NETWORK_PROBE_PATH,
    getNavigatorConnection,
    isSlowNetworkConnection,
    probeNetworkReachability,
    readNetworkConnectionSnapshot,
    subscribeBrowserConnectivityStatus,
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
    return getEffectiveBrowserOnlineState();
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

    const resolveOnlineStateFromEvent = (eventType: 'online' | 'offline'): boolean => {
        const override = getBrowserConnectivityOverride();
        if (override === 'online') return true;
        if (override === 'offline') return false;
        return eventType === 'online';
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const refreshConnectionSnapshot = () => {
            setConnection(readCurrentConnectionSnapshot());
        };

        const handleOnline = () => {
            setIsOnline(resolveOnlineStateFromEvent('online'));
            refreshConnectionSnapshot();
        };

        const handleOffline = () => {
            setIsOnline(resolveOnlineStateFromEvent('offline'));
            refreshConnectionSnapshot();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        const unsubscribeBrowserConnectivity = subscribeBrowserConnectivityStatus((snapshot) => {
            setIsOnline(snapshot.isOnline);
            refreshConnectionSnapshot();
        });

        const networkConnection = getNavigatorConnection(navigator);
        if (!networkConnection || typeof networkConnection.addEventListener !== 'function') {
            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                unsubscribeBrowserConnectivity();
            };
        }

        const handleConnectionChange = () => {
            refreshConnectionSnapshot();
        };
        networkConnection.addEventListener('change', handleConnectionChange as EventListener);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            unsubscribeBrowserConnectivity();
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
                const override = getBrowserConnectivityOverride();
                setIsOnline(override === 'offline' ? false : true);
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
