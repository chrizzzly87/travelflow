/**
 * Theme store.
 *
 * A module-level store rather than a context with an effect, because the thing
 * being tracked genuinely is external state: the browser preference and the OS
 * colour-scheme media query. One cached snapshot drives React consumers and the
 * document class together; subscriptions are shared across all consumers.
 *
 * The theme is also applied before this module ever loads, by the inline script
 * in src/document/theme-boot.js. Start emits it in server-rendered documents;
 * without it every prerendered page paints
 * light and then snaps. This module must therefore agree with that script about
 * the storage key, the class name and the tone attribute — see THEME_BOOT_KEYS
 * below, which is asserted against the script in the unit tests.
 */
import {
    removeLocalStorageItem,
    writeLocalStorageItem,
} from '../../services/browserStorageService';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type DarkTone = 'warm' | 'slate';

/**
 * Duplicated verbatim in src/document/theme-boot.js. The unit tests
 * read that script and assert these three values still appear in it, so the two
 * cannot drift apart silently.
 */
export const THEME_BOOT_KEYS = {
    storageKey: 'tf_theme_preference_v1',
    darkClass: 'dark',
    toneAttribute: 'data-dark-tone',
} as const;

const THEME_STORAGE_KEY = 'tf_theme_preference_v1';

/**
 * Which dark tone ships. Both are authored in index.css; `warm` is the default
 * because it carries more contrast headroom on every text pair. Switching to
 * 'slate' is the one-line change the two-tone architecture exists for.
 */
export const DEFAULT_DARK_TONE: DarkTone = 'warm';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const isPreference = (value: unknown): value is ThemePreference =>
    value === 'light' || value === 'dark' || value === 'system';

const listeners = new Set<() => void>();

const readStoredPreference = (fallback: ThemePreference = 'system'): ThemePreference => {
    if (typeof window === 'undefined') return fallback;
    try {
        // Keep a blocked read distinct from a missing choice. The key remains
        // registered as essential; writes still use the shared storage policy.
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isPreference(stored) ? stored : 'system';
    } catch {
        return fallback;
    }
};

const prefersDark = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(DARK_QUERY).matches;
};

let preference: ThemePreference = typeof window === 'undefined' ? 'system' : readStoredPreference();
let hasUnpersistedPreference = false;
let detachBrowserListeners: (() => void) | undefined;

export const resolveTheme = (value: ThemePreference, systemPrefersDark: boolean): ResolvedTheme => {
    if (value === 'system') return systemPrefersDark ? 'dark' : 'light';
    return value;
};

export interface ThemeSnapshot {
    preference: ThemePreference;
    resolvedTheme: ResolvedTheme;
}

// React must observe both inputs together: an OS change leaves the preference
// at "system", but must still update every consumer of the resolved theme.
const SERVER_SNAPSHOT: ThemeSnapshot = { preference: 'system', resolvedTheme: 'light' };
let snapshot: ThemeSnapshot = typeof window === 'undefined'
    ? SERVER_SNAPSHOT
    : { preference, resolvedTheme: resolveTheme(preference, prefersDark()) };
const getSnapshot = (): ThemeSnapshot => snapshot;
const getServerSnapshot = (): ThemeSnapshot => SERVER_SNAPSHOT;

/**
 * Custom properties an older cached boot script may still write on <html>.
 *
 * They MUST be removed again once a stylesheet is in charge. An inline style
 * outranks every rule, so leaving the dark values behind pins the page dark
 * forever: the `.dark` class comes off, the stylesheet switches back to the light
 * tokens, and the inline ones keep winning. That is exactly what broke light mode.
 */
const BOOT_SEEDED_PROPERTIES = ['--background', '--foreground', '--card', '--secondary', '--muted', '--border'];

/**
 * The colour the installed app's own chrome takes — on iOS the status-bar strip
 * above the header, on Android the task-switcher bar.
 *
 * These are `--card` in each theme, resolved to hex: the strip sits directly
 * above a `bg-card` header, and any other value reads as a gradient seam across
 * the top of the app. Duplicated verbatim in the inline boot script in
 * src/document/theme-boot.js so the very first frame is already right; the unit test asserts
 * the two still agree.
 */
export const THEME_SURFACE_COLOR: Record<ResolvedTheme, string> = {
    light: '#ffffff',
    dark: '#242322',
};

const applyThemeColorMeta = (theme: ResolvedTheme): void => {
    const meta = document.querySelector('meta[data-tf-theme-color]');
    if (meta) meta.setAttribute('content', THEME_SURFACE_COLOR[theme]);
};

// Elements with `transition-colors` would otherwise animate their own colours
// for ~150ms after the flip while everything else switches at once, leaving a
// visibly half-dark, half-light page. Suppress transitions for that one frame.
const suppressTransitionsForThemeFlip = (): void => {
    const style = document.createElement('style');
    style.setAttribute('data-tf-theme-flip', '');
    style.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(style);
    // Two frames: the first style recalc applies the new colours with
    // transitions off; only after it has painted is the override removed.
    window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => style.remove());
    });
};

export const applyTheme = (theme: ResolvedTheme, tone: DarkTone = DEFAULT_DARK_TONE): void => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isFlip = root.classList.contains(THEME_BOOT_KEYS.darkClass) !== (theme === 'dark');
    if (isFlip && document.body && typeof window.requestAnimationFrame === 'function') {
        suppressTransitionsForThemeFlip();
    }
    root.classList.toggle(THEME_BOOT_KEYS.darkClass, theme === 'dark');
    root.setAttribute(THEME_BOOT_KEYS.toneAttribute, tone);
    root.style.colorScheme = theme;
    applyThemeColorMeta(theme);

    // Hand control back to the stylesheet. Safe to do unconditionally: by the
    // time this runs index.css has loaded and defines both themes properly.
    for (const property of BOOT_SEEDED_PROPERTIES) root.style.removeProperty(property);
};

const notify = (): void => {
    for (const listener of listeners) listener();
};

const syncDocument = (): void => {
    const resolvedTheme = resolveTheme(preference, prefersDark());
    const changed = snapshot.preference !== preference || snapshot.resolvedTheme !== resolvedTheme;
    if (changed) snapshot = { preference, resolvedTheme };
    applyTheme(resolvedTheme);
    if (changed) notify();
};

export const setPreference = (next: ThemePreference): void => {
    if (!isPreference(next)) return;
    if (next === preference) {
        syncDocument();
        return;
    }
    preference = next;
    // A denied write must not erase the user's in-memory choice when another
    // theme consumer subscribes later (for example a lazy profile menu).
    hasUnpersistedPreference = !(next === 'system'
        ? removeLocalStorageItem(THEME_STORAGE_KEY)
        : writeLocalStorageItem(THEME_STORAGE_KEY, next));
    syncDocument();
};

export const getPreference = (): ThemePreference => preference;
export const getResolvedTheme = (): ResolvedTheme => resolveTheme(preference, prefersDark());
export const setResolvedTheme = (theme: ResolvedTheme): void => { setPreference(theme); };

const attachBrowserListeners = (): (() => void) => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : undefined;
    const onMediaChange = (): void => {
        if (preference === 'system') syncDocument();
    };
    const onStorage = (event: StorageEvent): void => {
        if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
        try {
            if (event.storageArea && event.storageArea !== window.localStorage) return;
        } catch { return; }
        if (event.newValue !== null && !isPreference(event.newValue)) return;
        preference = event.newValue === null ? 'system' : event.newValue;
        hasUnpersistedPreference = false;
        syncDocument();
    };
    if (media?.addEventListener) media.addEventListener('change', onMediaChange);
    else media?.addListener?.(onMediaChange);
    window.addEventListener('storage', onStorage);
    return () => {
        if (media?.removeEventListener) media.removeEventListener('change', onMediaChange);
        else media?.removeListener?.(onMediaChange);
        window.removeEventListener('storage', onStorage);
    };
};

export const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    if (!detachBrowserListeners && typeof window !== 'undefined') {
        detachBrowserListeners = attachBrowserListeners();
        // The OS or another tab may have changed while the application bundle
        // was downloading. Reconcile after attaching, so no change is missed.
        if (!hasUnpersistedPreference) preference = readStoredPreference(preference);
        syncDocument();
    }
    return () => {
        listeners.delete(listener);
        if (!listeners.size) {
            detachBrowserListeners?.();
            detachBrowserListeners = undefined;
        }
    };
};

// The boot script already applied this choice before first paint. Synchronizing
// the same snapshot clears old cached inline tokens without a light-mode reset.
if (typeof document !== 'undefined') syncDocument();

export const themeStore = {
    subscribe,
    getSnapshot,
    getServerSnapshot,
};

/** Test seam: reset module state between cases. */
export const __resetThemeStoreForTests = (): void => {
    detachBrowserListeners?.();
    detachBrowserListeners = undefined;
    listeners.clear();
    hasUnpersistedPreference = false;
    preference = typeof window === 'undefined' ? 'system' : readStoredPreference();
    snapshot = typeof window === 'undefined' ? SERVER_SNAPSHOT : { preference, resolvedTheme: resolveTheme(preference, prefersDark()) };
};
