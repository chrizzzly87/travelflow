import { useCallback, useSyncExternalStore } from 'react';

import {
    getResolvedTheme,
    setPreference,
    themeStore,
    type ResolvedTheme,
    type ThemePreference,
} from './themeStore';

export interface UseThemeResult {
    /** What the user asked for, including 'system'. */
    preference: ThemePreference;
    /** What is actually on screen right now. */
    resolvedTheme: ResolvedTheme;
    setPreference: (next: ThemePreference) => void;
    /** Light <-> dark. Leaves 'system' behind, which is what a toggle means. */
    toggle: () => void;
}

export const useTheme = (): UseThemeResult => {
    const { preference, resolvedTheme } = useSyncExternalStore(
        themeStore.subscribe,
        themeStore.getSnapshot,
        themeStore.getServerSnapshot,
    );

    const toggle = useCallback(() => {
        setPreference(getResolvedTheme() === 'dark' ? 'light' : 'dark');
    }, []);

    return { preference, resolvedTheme, setPreference, toggle };
};
