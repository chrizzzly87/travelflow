import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequestI18n, preloadLocaleNamespaces } from '../../i18n';
import { bootScripts } from '../../src/documentAssets';

describe('Start server rendering boundaries', () => {
    it('renders public localized pages while excluding account and browser-dependent routes', () => {
        expect(fs.readFileSync('src/routes/areas/public.tsx', 'utf8')).not.toContain('ssr: false');
        for (const area of ['trips', 'create', 'admin', 'account', 'client', 'auth']) expect(fs.readFileSync(`src/routes/areas/${area}.tsx`, 'utf8')).toContain('ssr: false');
    });
    it('keeps translation resources and language isolated across concurrent requests', async () => {
        const en = createRequestI18n();
        const de = createRequestI18n();
        await Promise.all([preloadLocaleNamespaces('en', ['common'], en), preloadLocaleNamespaces('de', ['common'], de)]);
        await Promise.all([en.changeLanguage('en'), de.changeLanguage('de')]);
        expect(en.language).toBe('en');
        expect(de.language).toBe('de');
        expect(en.hasResourceBundle('de', 'common')).toBe(false);
        de.addResourceBundle('de', 'requestProbe', { marker: 'this-request-only' });
        expect(en.hasResourceBundle('de', 'requestProbe')).toBe(false);
        expect(en.getResourceBundle('en', 'common')).not.toEqual(de.getResourceBundle('de', 'common'));
    });
    it('renders essential public content on the server and preserves the early click bridge', () => {
        expect(bootScripts.some(script => script.code.includes('window.__TF_BOOT__ = bridge'))).toBe(true);
        expect(bootScripts.some(script => script.code.includes('tf_theme_preference_v1'))).toBe(true);
    });
});
