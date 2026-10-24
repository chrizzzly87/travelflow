import { useSyncExternalStore } from 'react';
import { themeStore, THEME_SURFACE_COLOR } from '../../contexts/theme/themeStore';

/** The pre-paint script seeds this value; React owns subsequent metadata changes. */
export function ThemeColor() {
    const { resolvedTheme } = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot, themeStore.getDocumentSnapshot);
    return <meta name="theme-color" content={THEME_SURFACE_COLOR[resolvedTheme]} data-tf-theme-color="" />;
}
