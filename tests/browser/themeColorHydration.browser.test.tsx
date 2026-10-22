// @vitest-environment jsdom
import React from 'react';
import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

let root: Root | undefined;
afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    localStorage.clear();
    document.documentElement.className = '';
    vi.unstubAllGlobals();
});

it('claims the pre-paint dark meta and updates its single React-owned element', async () => {
    vi.resetModules();
    localStorage.setItem('tf_theme_preference_v1', 'dark');
    // The synchronous document boot script has already changed the server's
    // light meta before application hydration, as in a real dark first visit.
    document.head.innerHTML = '<meta name="theme-color" content="#242322" data-tf-theme-color="">';
    document.body.innerHTML = '<main>TravelFlow</main>';
    const { ThemeColor } = await import('../../src/document/ThemeColor');
    const { setPreference } = await import('../../contexts/theme/themeStore');
    const recoverable = vi.fn();
    await act(async () => {
        root = hydrateRoot(document, <html><head><ThemeColor /></head><body><main>TravelFlow</main></body></html>, { onRecoverableError: recoverable });
    });
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#242322');
    await act(async () => setPreference('light'));
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff');
    expect(recoverable).not.toHaveBeenCalled();
});
