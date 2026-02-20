import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isSimulatedLoggedIn, toggleSimulatedLogin } from '../../services/simulatedLoginService';

type AppDebugWindow = Window & typeof globalThis & {
    debug?: (command?: AppDebugCommand) => unknown;
    toggleSimulatedLogin?: (force?: boolean) => boolean;
    getSimulatedLoginState?: () => 'simulated_logged_in' | 'anonymous';
};

type AppDebugCommand =
    | boolean
    | {
        open?: boolean;
        tracking?: boolean;
        seo?: boolean;
        a11y?: boolean;
        simulatedLogin?: boolean;
    };

const DEBUG_AUTO_OPEN_STORAGE_KEY = 'tf_debug_auto_open';

const shouldEnableDebuggerOnBoot = (): boolean => {
    if (typeof window === 'undefined') return false;
    try {
        const params = new URLSearchParams(window.location.search);
        const debugParam = params.get('debug');
        if (debugParam === '1' || debugParam === 'true') return true;
        return window.localStorage.getItem(DEBUG_AUTO_OPEN_STORAGE_KEY) === '1';
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

        return () => {
            delete host.toggleSimulatedLogin;
            delete host.getSimulatedLoginState;
        };
    }, [appName, isDev]);

    return shouldLoadDebugger;
};
