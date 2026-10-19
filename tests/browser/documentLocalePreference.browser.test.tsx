// @vitest-environment jsdom
import React from 'react';
import { createInstance } from 'i18next';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ preload: vi.fn() }));
vi.mock('../../i18n', () => ({ preloadLocaleNamespaces: mocks.preload }));
import { useDocumentLocale } from '../../src/document/useDocumentLocale';
function DocumentLocale({ instance }: { instance: ReturnType<typeof createInstance> }) { useDocumentLocale(instance); return null; }
async function instance() {
    const value = createInstance();
    await value.init({ lng: 'en', fallbackLng: 'en', resources: { en: { common: { hello: 'Hello' } }, de: { common: { hello: 'Hallo' } }, fr: { common: { hello: 'Bonjour' } } } });
    return value;
}
beforeEach(() => { window.history.replaceState({}, '', '/create-trip/wizard'); localStorage.clear(); mocks.preload.mockReset(); });
afterEach(cleanup);
describe('document-owned browser locale preference', () => {
    it('keeps the saved choice intact while hydrating the delivered language, then restores it', async () => {
        const value = await instance();
        localStorage.setItem('tf_app_language', 'de');
        let finish!: () => void;
        mocks.preload.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
        render(<DocumentLocale instance={value} />);
        expect(document.documentElement.lang).toBe('en');
        expect(localStorage.getItem('tf_app_language')).toBe('de');
        await act(async () => { finish(); });
        await waitFor(() => expect(document.documentElement.lang).toBe('de'));
        expect(value.resolvedLanguage).toBe('de');
        expect(localStorage.getItem('tf_app_language')).toBe('de');
    });
    it('does not overwrite a newer language choice with a late saved-preference load', async () => {
        const value = await instance();
        localStorage.setItem('tf_app_language', 'de');
        let finish!: () => void;
        mocks.preload.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
        render(<DocumentLocale instance={value} />);
        await act(async () => { await value.changeLanguage('fr'); finish(); });
        expect(document.documentElement.lang).toBe('fr');
        expect(value.resolvedLanguage).toBe('fr');
        expect(localStorage.getItem('tf_app_language')).toBe('fr');
    });
    it('leaves an explicit route language authoritative', async () => {
        const value = await instance();
        await value.changeLanguage('de');
        localStorage.setItem('tf_app_language', 'fr');
        window.history.replaceState({}, '', '/de/create-trip/wizard');
        render(<DocumentLocale instance={value} />);
        expect(mocks.preload).not.toHaveBeenCalled();
        expect(document.documentElement.lang).toBe('de');
        expect(localStorage.getItem('tf_app_language')).toBe('de');
    });
    it('cancels a pending preference after the document unmounts', async () => {
        const value = await instance();
        localStorage.setItem('tf_app_language', 'de');
        let finish!: () => void;
        mocks.preload.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
        const view = render(<DocumentLocale instance={value} />);
        view.unmount();
        await act(async () => { finish(); });
        expect(value.resolvedLanguage).toBe('en');
        expect(localStorage.getItem('tf_app_language')).toBe('de');
    });
});
