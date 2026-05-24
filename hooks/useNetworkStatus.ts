import { useEffect, useMemo, useReducer } from 'react';
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

interface NetworkStatusState {
    isOnline: boolean;
    connection: NetworkConnectionSnapshot | null;
    isProbePending: boolean;
}

type NetworkStatusAction =
    | { type: 'connectivityChanged'; isOnline: boolean; connection: NetworkConnectionSnapshot | null }
    | { type: 'connectionChanged'; connection: NetworkConnectionSnapshot | null }
    | { type: 'probeStarted' }
    | { type: 'probeFinished' }
    | { type: 'probeRecovered'; isOnline: boolean; connection: NetworkConnectionSnapshot | null };

const createInitialNetworkStatusState = (): NetworkStatusState => ({
    isOnline: readInitialOnlineState(),
    connection: readCurrentConnectionSnapshot(),
    isProbePending: false,
});

const networkStatusReducer = (
    state: NetworkStatusState,
    action: NetworkStatusAction
): NetworkStatusState => {
    switch (action.type) {
        case 'connectivityChanged':
            return {
                ...state,
                isOnline: action.isOnline,
                connection: action.connection,
            };
        case 'connectionChanged':
            return {
                ...state,
                connection: action.connection,
            };
        case 'probeStarted':
            return state.isProbePending ? state : {
                ...state,
                isProbePending: true,
            };
        case 'probeFinished':
            return state.isProbePending ? {
                ...state,
                isProbePending: false,
            } : state;
        case 'probeRecovered':
            return {
                ...state,
                isOnline: action.isOnline,
                connection: action.connection,
                isProbePending: false,
            };
        default:
            return state;
    }
};

export const useNetworkStatus = (options: UseNetworkStatusOptions = {}): UseNetworkStatusResult => {
    const {
        probeWhileOffline = true,
        probeIntervalMs = DEFAULT_NETWORK_PROBE_INTERVAL_MS,
        probePath = DEFAULT_NETWORK_PROBE_PATH,
    } = options;
    const [state, dispatch] = useReducer(
        networkStatusReducer,
        undefined,
        createInitialNetworkStatusState
    );

    const resolveOnlineStateFromEvent = (eventType: 'online' | 'offline'): boolean => {
        const override = getBrowserConnectivityOverride();
        if (override === 'online') return true;
        if (override === 'offline') return false;
        return eventType === 'online';
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleOnline = () => {
            dispatch({
                type: 'connectivityChanged',
                isOnline: resolveOnlineStateFromEvent('online'),
                connection: readCurrentConnectionSnapshot(),
            });
        };

        const handleOffline = () => {
            dispatch({
                type: 'connectivityChanged',
                isOnline: resolveOnlineStateFromEvent('offline'),
                connection: readCurrentConnectionSnapshot(),
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        const unsubscribeBrowserConnectivity = subscribeBrowserConnectivityStatus((snapshot) => {
            dispatch({
                type: 'connectivityChanged',
                isOnline: snapshot.isOnline,
                connection: readCurrentConnectionSnapshot(),
            });
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
            dispatch({
                type: 'connectionChanged',
                connection: readCurrentConnectionSnapshot(),
            });
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
        if (!probeWhileOffline || state.isOnline) {
            dispatch({ type: 'probeFinished' });
            return;
        }

        let cancelled = false;
        let isProbeInFlight = false;

        const runProbe = async () => {
            if (cancelled || isProbeInFlight) return;
            isProbeInFlight = true;
            dispatch({ type: 'probeStarted' });
            const isReachable = await probeNetworkReachability(probePath);
            if (cancelled) return;
            isProbeInFlight = false;
            if (isReachable) {
                const override = getBrowserConnectivityOverride();
                dispatch({
                    type: 'probeRecovered',
                    isOnline: override === 'offline' ? false : true,
                    connection: readCurrentConnectionSnapshot(),
                });
            } else {
                dispatch({ type: 'probeFinished' });
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
    }, [probeIntervalMs, probePath, probeWhileOffline, state.isOnline]);

    const isSlowConnection = useMemo(
        () => isSlowNetworkConnection(state.connection),
        [state.connection]
    );

    return {
        isOnline: state.isOnline,
        isSlowConnection,
        connection: state.connection,
        isProbePending: state.isProbePending,
    };
};
