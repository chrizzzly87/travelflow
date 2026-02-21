import { useCallback, useEffect } from 'react';

interface UseTripHistoryDebugToolsParams {
    isDev: boolean;
}

export const useTripHistoryDebugTools = ({ isDev }: UseTripHistoryDebugToolsParams) => {
    const debugHistory = useCallback((message: string, data?: unknown) => {
        if (!isDev) return;
        if (typeof window === 'undefined') return;
        const enabled = (window as any).__TF_DEBUG_HISTORY;
        if (!enabled) return;
        if (data !== undefined) {
            console.log(`[History] ${message}`, data);
        } else {
            console.log(`[History] ${message}`);
        }
    }, [isDev]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if ((window as any).__TF_DEBUG_HISTORY === undefined) {
            (window as any).__TF_DEBUG_HISTORY = isDev;
        }
        (window as any).tfSetHistoryDebug = (enabled: boolean) => {
            (window as any).__TF_DEBUG_HISTORY = enabled;
            if (isDev) {
                console.log(`[History] debug ${enabled ? 'enabled' : 'disabled'}`);
            }
        };
        (window as any).__tfOnCommit = (window as any).__tfOnCommit || null;
    }, [isDev]);

    return {
        debugHistory,
    };
};
