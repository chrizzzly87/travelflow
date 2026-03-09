export interface NetworkConnectionSnapshot {
    effectiveType: string | null;
    saveData: boolean;
    rtt: number | null;
    downlink: number | null;
}

export type BrowserConnectivityOverride = 'online' | 'offline';

export interface BrowserConnectivitySnapshot {
    override: BrowserConnectivityOverride | null;
    isOnline: boolean;
}

type NetworkConnectionLike = NetworkInformation & {
    effectiveType?: string;
    saveData?: boolean;
    rtt?: number;
    downlink?: number;
};

type NavigatorWithConnection = Navigator & {
    connection?: NetworkConnectionLike;
    mozConnection?: NetworkConnectionLike;
    webkitConnection?: NetworkConnectionLike;
};

export const AUTH_REQUEST_TIMEOUT_DEFAULT_MS = 18000;
export const AUTH_REQUEST_TIMEOUT_SLOW_MS = 35000;
export const AUTH_RESTORE_TIMEOUT_DEFAULT_MS = 10000;
export const AUTH_RESTORE_TIMEOUT_SLOW_MS = 20000;
export const DEFAULT_NETWORK_PROBE_PATH = '/favicon.ico';
export const BROWSER_CONNECTIVITY_OVERRIDE_STORAGE_KEY = 'tf_debug_browser_connectivity_override';
export const BROWSER_CONNECTIVITY_STATUS_EVENT = 'tf:browser-connectivity-status';

export const getNavigatorConnection = (navigatorLike: Navigator | null | undefined): NetworkConnectionLike | null => {
    if (!navigatorLike) return null;
    const typedNavigator = navigatorLike as NavigatorWithConnection;
    return typedNavigator.connection
        || typedNavigator.mozConnection
        || typedNavigator.webkitConnection
        || null;
};

const isBrowser = (): boolean => typeof window !== 'undefined';

const normalizeBrowserConnectivityOverride = (value: unknown): BrowserConnectivityOverride | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'online') return 'online';
    if (normalized === 'offline') return 'offline';
    return null;
};

export const getBrowserConnectivityOverride = (): BrowserConnectivityOverride | null => {
    if (!isBrowser()) return null;
    try {
        return normalizeBrowserConnectivityOverride(window.localStorage.getItem(BROWSER_CONNECTIVITY_OVERRIDE_STORAGE_KEY));
    } catch {
        return null;
    }
};

export const getEffectiveBrowserOnlineState = (
    navigatorLike: Navigator | null | undefined = (typeof navigator !== 'undefined' ? navigator : null)
): boolean => {
    const override = getBrowserConnectivityOverride();
    if (override === 'online') return true;
    if (override === 'offline') return false;
    if (!navigatorLike) return true;
    return navigatorLike.onLine !== false;
};

export const getBrowserConnectivitySnapshot = (
    navigatorLike: Navigator | null | undefined = (typeof navigator !== 'undefined' ? navigator : null)
): BrowserConnectivitySnapshot => ({
    override: getBrowserConnectivityOverride(),
    isOnline: getEffectiveBrowserOnlineState(navigatorLike),
});

const emitBrowserConnectivitySnapshot = () => {
    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent<BrowserConnectivitySnapshot>(BROWSER_CONNECTIVITY_STATUS_EVENT, {
        detail: getBrowserConnectivitySnapshot(window.navigator),
    }));
};

export const setBrowserConnectivityOverride = (
    mode: BrowserConnectivityOverride | 'clear'
): BrowserConnectivitySnapshot => {
    if (isBrowser()) {
        try {
            if (mode === 'clear') {
                window.localStorage.removeItem(BROWSER_CONNECTIVITY_OVERRIDE_STORAGE_KEY);
            } else {
                window.localStorage.setItem(BROWSER_CONNECTIVITY_OVERRIDE_STORAGE_KEY, mode);
            }
        } catch {
            // Ignore storage failures in debug-only path.
        }
        emitBrowserConnectivitySnapshot();
    }
    return getBrowserConnectivitySnapshot();
};

export const clearBrowserConnectivityOverride = (): BrowserConnectivitySnapshot => (
    setBrowserConnectivityOverride('clear')
);

export const subscribeBrowserConnectivityStatus = (
    listener: (snapshot: BrowserConnectivitySnapshot) => void
): (() => void) => {
    if (!isBrowser()) {
        listener(getBrowserConnectivitySnapshot());
        return () => undefined;
    }

    const handler = (event: Event) => {
        const detail = (event as CustomEvent<BrowserConnectivitySnapshot | undefined>).detail;
        listener(detail ?? getBrowserConnectivitySnapshot(window.navigator));
    };

    listener(getBrowserConnectivitySnapshot(window.navigator));
    window.addEventListener(BROWSER_CONNECTIVITY_STATUS_EVENT, handler as EventListener);
    return () => {
        window.removeEventListener(BROWSER_CONNECTIVITY_STATUS_EVENT, handler as EventListener);
    };
};

export const readNetworkConnectionSnapshot = (navigatorLike: Navigator | null | undefined): NetworkConnectionSnapshot | null => {
    const connection = getNavigatorConnection(navigatorLike);
    if (!connection) return null;
    const rawEffectiveType = typeof connection.effectiveType === 'string' ? connection.effectiveType.trim() : '';
    return {
        effectiveType: rawEffectiveType || null,
        saveData: connection.saveData === true,
        rtt: typeof connection.rtt === 'number' && Number.isFinite(connection.rtt) ? connection.rtt : null,
        downlink: typeof connection.downlink === 'number' && Number.isFinite(connection.downlink) ? connection.downlink : null,
    };
};

export const isSlowNetworkConnection = (snapshot: NetworkConnectionSnapshot | null): boolean => {
    if (!snapshot) return false;
    if (snapshot.saveData) return true;
    const type = (snapshot.effectiveType || '').toLowerCase();
    if (type === 'slow-2g' || type === '2g' || type === '3g') return true;
    if (typeof snapshot.rtt === 'number' && snapshot.rtt >= 700) return true;
    if (typeof snapshot.downlink === 'number' && snapshot.downlink > 0 && snapshot.downlink <= 1.2) return true;
    return false;
};

export const getAuthRequestTimeoutMs = (isSlowConnection: boolean): number => (
    isSlowConnection ? AUTH_REQUEST_TIMEOUT_SLOW_MS : AUTH_REQUEST_TIMEOUT_DEFAULT_MS
);

export const getAuthRestoreTimeoutMs = (isSlowConnection: boolean): number => (
    isSlowConnection ? AUTH_RESTORE_TIMEOUT_SLOW_MS : AUTH_RESTORE_TIMEOUT_DEFAULT_MS
);

const getProbeUrl = (probePath: string): string => {
    if (typeof window === 'undefined') return probePath;
    const probeUrl = new URL(probePath, window.location.origin);
    probeUrl.searchParams.set('_tf_net', Date.now().toString());
    return probeUrl.toString();
};

export const probeNetworkReachability = async (
    probePath: string = DEFAULT_NETWORK_PROBE_PATH,
    fetchImpl: typeof fetch = fetch
): Promise<boolean> => {
    if (typeof window === 'undefined') return true;
    try {
        await fetchImpl(getProbeUrl(probePath), {
            method: 'HEAD',
            cache: 'no-store',
        });
        return true;
    } catch {
        return false;
    }
};
