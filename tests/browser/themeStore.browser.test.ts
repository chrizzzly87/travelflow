// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useTheme } from '../../contexts/theme/useTheme';

import {
    DEFAULT_DARK_TONE,
    THEME_BOOT_KEYS,
    applyTheme,
    getPreference,
    getResolvedTheme,
    resolveTheme,
    setPreference,
    __resetThemeStoreForTests,
    themeStore,
} from '../../contexts/theme/themeStore';

const setSystemPrefersDark = (matches: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('prefers-color-scheme: dark') ? matches : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
    }));
};

describe('contexts/theme/themeStore', () => {
    beforeEach(() => {
        cleanup();
        window.localStorage.clear();
        document.documentElement.className = '';
        document.documentElement.removeAttribute(THEME_BOOT_KEYS.toneAttribute);
        document.documentElement.style.cssText = '';
        setSystemPrefersDark(false);
        __resetThemeStoreForTests();
    });

    it('resolves "system" from the OS preference and an explicit choice from itself', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
        // An explicit choice must win over the OS in both directions.
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });

    it('stores an explicit choice but records "system" as the absence of a key', () => {
        setPreference('dark');
        expect(window.localStorage.getItem('tf_theme_preference_v1')).toBe('dark');

        // Someone who returns to "follow my device" should be indistinguishable
        // from someone who never touched the toggle — the boot script reads a
        // missing key as exactly that.
        setPreference('system');
        expect(window.localStorage.getItem('tf_theme_preference_v1')).toBeNull();
        expect(getPreference()).toBe('system');
    });

    it('applies the class and the tone, and clears any boot-seeded inline properties', () => {
        const root = document.documentElement;
        // A cached index.html may still write these inline. An inline style
        // outranks every rule, so leaving them behind pins the theme: the class
        // comes off, the stylesheet switches back, and the inline values keep
        // winning. This is the regression that broke light mode outright.
        root.style.setProperty('--background', 'oklch(0.210 0.003 68)');
        root.style.setProperty('--foreground', 'oklch(0.953 0.009 85)');

        applyTheme('dark');
        expect(root.classList.contains('dark')).toBe(true);
        expect(root.getAttribute(THEME_BOOT_KEYS.toneAttribute)).toBe(DEFAULT_DARK_TONE);
        expect(root.style.getPropertyValue('--background')).toBe('');
        expect(root.style.getPropertyValue('--foreground')).toBe('');

        applyTheme('light');
        expect(root.classList.contains('dark')).toBe(false);
        expect(root.style.colorScheme).toBe('light');
    });

    it('follows the OS while on "system" and stops once a choice is made', () => {
        setSystemPrefersDark(true);
        __resetThemeStoreForTests();
        expect(getResolvedTheme()).toBe('dark');

        setPreference('light');
        expect(getResolvedTheme()).toBe('light');
    });

    it('switches every colour at once instead of letting transitions lag behind the flip', async () => {
        // Elements with transition-colors used to animate on their own for a
        // moment after a toggle, leaving the page half dark and half light.
        applyTheme('light');
        applyTheme('dark');
        expect(document.head.querySelector('style[data-tf-theme-flip]')).not.toBeNull();

        await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.head.querySelector('style[data-tf-theme-flip]')).toBeNull();

        // Re-applying the same theme is not a flip and must not touch transitions.
        applyTheme('dark');
        expect(document.head.querySelector('style[data-tf-theme-flip]')).toBeNull();
    });

    it('updates React consumers when the system theme changes without a preference change', () => {
        let dark = false;
        const listeners = new Set<() => void>();
        vi.stubGlobal('matchMedia', () => ({
            get matches() { return dark; },
            addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
            removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        }));
        __resetThemeStoreForTests();
        const { result } = renderHook(() => useTheme());
        expect(result.current.resolvedTheme).toBe('light');
        act(() => { dark = true; listeners.forEach(listener => listener()); });
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(result.current.resolvedTheme).toBe('dark');
    });

    it('synchronizes another tab choice and removal through the subscribed snapshot', () => {
        const { result } = renderHook(() => useTheme());
        act(() => {
            window.localStorage.setItem(THEME_BOOT_KEYS.storageKey, 'dark');
            window.dispatchEvent(new StorageEvent('storage', { key: THEME_BOOT_KEYS.storageKey, newValue: 'dark', storageArea: window.localStorage }));
        });
        expect(result.current.preference).toBe('dark');
        expect(result.current.resolvedTheme).toBe('dark');
        act(() => {
            window.localStorage.removeItem(THEME_BOOT_KEYS.storageKey);
            window.dispatchEvent(new StorageEvent('storage', { key: THEME_BOOT_KEYS.storageKey, newValue: null, storageArea: window.localStorage }));
        });
        expect(result.current.preference).toBe('system');
        expect(result.current.resolvedTheme).toBe('light');
    });


    it('reconciles a choice made while the bundle was loading before the first subscription', () => {
        window.localStorage.setItem(THEME_BOOT_KEYS.storageKey, 'dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.resolvedTheme).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('keeps a memory-only early toggle when persistence is blocked and a lazy consumer mounts', () => {
        const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        setPreference('dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.preference).toBe('dark');
        expect(result.current.resolvedTheme).toBe('dark');
        write.mockRestore();
    });

    it('retains the previous choice when storage becomes unreadable between subscriptions', () => {
        setPreference('dark');
        const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        const { result } = renderHook(() => useTheme());
        expect(result.current.resolvedTheme).toBe('dark');
        read.mockRestore();
    });

    it('shares one browser subscription and returns stable snapshots until the theme changes', () => {
        const attach = vi.fn();
        const detach = vi.fn();
        vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: attach, removeEventListener: detach }));
        const first = renderHook(() => useTheme());
        const second = renderHook(() => useTheme());
        expect(attach).toHaveBeenCalledTimes(1);
        expect(themeStore.getSnapshot()).toBe(themeStore.getSnapshot());
        expect(themeStore.getServerSnapshot()).toBe(themeStore.getServerSnapshot());
        first.unmount();
        expect(detach).not.toHaveBeenCalled();
        second.unmount();
        expect(detach).toHaveBeenCalledTimes(1);
    });

});
