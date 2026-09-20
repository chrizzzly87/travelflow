// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    DEFAULT_DARK_TONE,
    THEME_BOOT_KEYS,
    applyTheme,
    getPreference,
    getResolvedTheme,
    resolveTheme,
    setPreference,
    __resetThemeStoreForTests,
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
});
