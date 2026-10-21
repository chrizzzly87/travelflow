/**
 * Theme store.
 *
 * A module-level store rather than a context with an effect, because the thing
 * being tracked genuinely is external state: the document element's class list
 * and the OS colour-scheme media query. `useSyncExternalStore` is the right
 * primitive for that, and it keeps the applied theme correct during the first
 * render instead of one paint later.
 *
 * The theme is also applied before this module ever loads, by the inline script
 * in index.html. That script is not optional: marketing routes are prerendered
 * by scripts/prerender-routes.mjs, so without it every prerendered page paints
 * light and then snaps. This module must therefore agree with that script about
 * the storage key, the class name and the tone attribute — see THEME_BOOT_KEYS
 * below, which is asserted against the script in the unit tests.
 */
import {
    readLocalStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
} from '../../services/browserStorageService';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type DarkTone = 'warm' | 'slate';

/**
 * Duplicated verbatim in the inline boot script in index.html. The unit tests
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

const readStoredPreference = (): ThemePreference => {
    const stored = readLocalStorageItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
};

const prefersDark = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(DARK_QUERY).matches;
};

let preference: ThemePreference = typeof window === 'undefined' ? 'system' : readStoredPreference();

export const resolveTheme = (value: ThemePreference, systemPrefersDark: boolean): ResolvedTheme => {
    if (value === 'system') return systemPrefersDark ? 'dark' : 'light';
    return value;
};

/**
 * Snapshot is a primitive string, not an object, so useSyncExternalStore never
 * sees a new identity for unchanged state and cannot loop.
 */
const getSnapshot = (): ThemePreference => preference;
const getServerSnapshot = (): ThemePreference => 'system';

/**
 * Custom properties the boot script writes inline on <html> so the boot-shell CSS
 * is correct on the very first frame, before index.css has loaded.
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
 * index.html so the very first frame is already right; the unit test asserts
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
    applyTheme(resolveTheme(preference, prefersDark()));
};

export const setPreference = (next: ThemePreference): void => {
    if (!isPreference(next) || next === preference) return;
    preference = next;

    // 'system' is the absence of a choice, so it is stored as the absence of a
    // key. That keeps a user who never touched the toggle indistinguishable
    // from one who explicitly chose to follow their device, which is what the
    // boot script assumes when it finds nothing.
    if (next === 'system') {
        removeLocalStorageItem(THEME_STORAGE_KEY);
    } else {
        writeLocalStorageItem(THEME_STORAGE_KEY, next);
    }

    syncDocument();
    notify();
};

export const getPreference = (): ThemePreference => preference;

export const getResolvedTheme = (): ResolvedTheme => resolveTheme(preference, prefersDark());

/**
 * Used by the window shade, which commits a resolved theme directly rather than
 * a preference — pulling the shade down means "dark now", not "follow my OS".
 */
export const setResolvedTheme = (theme: ResolvedTheme): void => {
    setPreference(theme);
};

export const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);

    // The OS preference only matters while the user is on 'system'; subscribing
    // unconditionally is still simpler than attaching and detaching as the
    // preference changes, and the handler is a no-op otherwise.
    let detachMedia: (() => void) | undefined;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        const media = window.matchMedia(DARK_QUERY);
        const onChange = (): void => {
            if (preference !== 'system') return;
            syncDocument();
            notify();
        };
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', onChange);
            detachMedia = () => media.removeEventListener('change', onChange);
        } else if (typeof media.addListener === 'function') {
            // Safari < 14.
            media.addListener(onChange);
            detachMedia = () => media.removeListener(onChange);
        }
    }

    return () => {
        listeners.delete(listener);
        detachMedia?.();
    };
};

// A previously-cached index.html may still seed those properties inline. Clear
// them as soon as this module loads so a stale shell cannot pin the theme.
if (typeof document !== 'undefined') {
    syncDocument();
}

export const themeStore = {
    subscribe,
    getSnapshot,
    getServerSnapshot,
};

/** Test seam: reset module state between cases. */
export const __resetThemeStoreForTests = (): void => {
    listeners.clear();
    preference = typeof window === 'undefined' ? 'system' : readStoredPreference();
};
