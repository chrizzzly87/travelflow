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
    const preference = useSyncExternalStore(
        themeStore.subscribe,
        themeStore.getSnapshot,
        themeStore.getServerSnapshot,
    );

    // Derived at render rather than stored: the store already re-renders us when
    // either the preference or the OS query changes, so a second copy of this
    // value could only ever be stale.
    const resolvedTheme = getResolvedTheme();

    const toggle = useCallback(() => {
        setPreference(getResolvedTheme() === 'dark' ? 'light' : 'dark');
    }, []);

    return { preference, resolvedTheme, setPreference, toggle };
};
