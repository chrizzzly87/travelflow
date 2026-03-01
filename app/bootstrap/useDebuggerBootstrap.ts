import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { readLocalStorageItem } from '../../services/browserStorageService';
import { isSimulatedLoggedIn, toggleSimulatedLogin } from '../../services/simulatedLoginService';
import {
    getBrowserConnectivitySnapshot,
    setBrowserConnectivityOverride,
    type BrowserConnectivityOverride,
} from '../../services/networkStatus';
import {
    applyConnectivityOverrideFromSearch,
    clearConnectivityOverride,
    getConnectivitySnapshot,
    setConnectivityOverride,
    type ConnectivityState,
} from '../../services/supabaseHealthMonitor';

type AppDebugWindow = Window & typeof globalThis & {
    debug?: (command?: AppDebugCommand) => unknown;
    toggleSimulatedLogin?: (force?: boolean) => boolean;
    getSimulatedLoginState?: () => 'simulated_logged_in' | 'anonymous';
    toggleBrowserConnectivity?: (mode?: BrowserConnectivityOverride | 'clear') => 'online' | 'offline';
    getBrowserConnectivityState?: () => 'online' | 'offline';
    toggleSupabaseConnectivity?: (mode?: ConnectivityState | 'clear') => ConnectivityState;
    getSupabaseConnectivityState?: () => ConnectivityState;
};

type AppDebugCommand =
    | boolean
    | {
        open?: boolean;
        tracking?: boolean;
        seo?: boolean;
        a11y?: boolean;
        simulatedLogin?: boolean;
        offline?: boolean | 'offline' | 'degraded' | 'online';
        network?: boolean | 'offline' | 'online';
    };

const DEBUG_AUTO_OPEN_STORAGE_KEY = 'tf_debug_auto_open';

const shouldEnableDebuggerOnBoot = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        const params = new URLSearchParams(window.location.search);
        const debugParam = params.get('debug');
        if (debugParam === '1' || debugParam === 'true') return true;
        return readLocalStorageItem(DEBUG_AUTO_OPEN_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
};

export const useDebuggerBootstrap = ({ appName, isDev }: { appName: string; isDev: boolean }): boolean => {
    const location = useLocation();
    const [shouldLoadDebugger, setShouldLoadDebugger] = useState<boolean>(() => shouldEnableDebuggerOnBoot());
    const debugQueueRef = useRef<AppDebugCommand[]>([]);
    const debugStubRef = useRef<((command?: AppDebugCommand) => unknown) | null>(null);

    useEffect(() => {
        if (shouldLoadDebugger) return;
        const params = new URLSearchParams(location.search);
        const debugParam = params.get('debug');
        if (debugParam === '1' || debugParam === 'true') {
            setShouldLoadDebugger(true);
        }
    }, [location.search, shouldLoadDebugger]);

    useEffect(() => {
        applyConnectivityOverrideFromSearch(location.search);
    }, [location.search]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as AppDebugWindow;
        if (shouldLoadDebugger) return;

        const debugStub = (command?: AppDebugCommand) => {
            debugQueueRef.current.push(command ?? true);
            setShouldLoadDebugger(true);
            return undefined;
        };

        debugStubRef.current = debugStub;
        host.debug = debugStub;

        return () => {
            if (host.debug === debugStub) {
                delete host.debug;
            }
        };
    }, [shouldLoadDebugger]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!shouldLoadDebugger) return;

        let rafId: number | null = null;
        const flushQueuedDebugCommands = () => {
            const host = window as AppDebugWindow;
            if (typeof host.debug !== 'function' || host.debug === debugStubRef.current) {
                rafId = window.requestAnimationFrame(flushQueuedDebugCommands);
                return;
            }

            const queued = [...debugQueueRef.current];
            debugQueueRef.current = [];
            queued.forEach((command) => {
                host.debug?.(command);
            });
        };

        flushQueuedDebugCommands();
        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, [shouldLoadDebugger]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as AppDebugWindow;
        host.toggleSimulatedLogin = (force?: boolean) => {
            const next = toggleSimulatedLogin(force);
            if (isDev) {
                console.info(
                    `[${appName}] toggleSimulatedLogin(${typeof force === 'boolean' ? force : 'toggle'}) -> ${next ? 'SIMULATED LOGGED-IN' : 'ANONYMOUS'}`
                );
            }
            return next;
        };
        host.getSimulatedLoginState = () => (isSimulatedLoggedIn() ? 'simulated_logged_in' : 'anonymous');
        host.toggleBrowserConnectivity = (mode?: BrowserConnectivityOverride | 'clear') => {
            const current = getBrowserConnectivitySnapshot(window.navigator);
            const resolvedMode = mode
                ?? (current.override ? 'clear' : 'offline');
            const nextSnapshot = setBrowserConnectivityOverride(resolvedMode);
            const nextState = nextSnapshot.isOnline ? 'online' : 'offline';
            if (isDev) {
                console.info(`[${appName}] toggleBrowserConnectivity(${mode || 'toggle'}) -> ${nextState.toUpperCase()}`);
            }
            return nextState;
        };
        host.getBrowserConnectivityState = () => (getBrowserConnectivitySnapshot(window.navigator).isOnline ? 'online' : 'offline');
        host.toggleSupabaseConnectivity = (mode?: ConnectivityState | 'clear') => {
            let nextState: ConnectivityState;
            if (!mode) {
                const current = getConnectivitySnapshot();
                if (current.isForced) {
                    nextState = clearConnectivityOverride().state;
                } else {
                    nextState = setConnectivityOverride('offline').state;
                }
            } else if (mode === 'clear') {
                nextState = clearConnectivityOverride().state;
            } else {
                nextState = setConnectivityOverride(mode).state;
            }

            if (isDev) {
                console.info(`[${appName}] toggleSupabaseConnectivity(${mode || 'toggle'}) -> ${nextState.toUpperCase()}`);
            }

            return nextState;
        };
        host.getSupabaseConnectivityState = () => getConnectivitySnapshot().state;

        return () => {
            delete host.toggleSimulatedLogin;
            delete host.getSimulatedLoginState;
            delete host.toggleBrowserConnectivity;
            delete host.getBrowserConnectivityState;
            delete host.toggleSupabaseConnectivity;
            delete host.getSupabaseConnectivityState;
        };
    }, [appName, isDev]);

    return shouldLoadDebugger;
};
