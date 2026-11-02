import { describe, expect, it, vi } from 'vitest';
import { createRequestI18n } from '../../i18n';
import { getLocaleHydrationSnapshot, restoreLocaleHydrationSnapshot } from '../../app/routing/localeHydration';

describe('native locale hydration', () => {
    it('restores initial route resources without another namespace/backend request', async () => {
        const server = createRequestI18n();
        server.addResourceBundle('de', 'common', { greeting: 'Hallo' });
        server.addResourceBundle('de', 'createTrip', { title: 'Reise planen' });
        server.addResourceBundle('en', 'common', { fallback: 'Fallback' });
        await server.changeLanguage('de');
        const client = createRequestI18n();
        const backendRead = vi.spyOn(client.services.backendConnector.backend, 'read');
        await restoreLocaleHydrationSnapshot(getLocaleHydrationSnapshot(server), client);
        expect(client.resolvedLanguage).toBe('de');
        expect(client.t('title', { ns: 'createTrip' })).toBe('Reise planen');
        expect(client.t('fallback')).toBe('Fallback');
        expect(backendRead).not.toHaveBeenCalled();
    });
    it('keeps concurrent requests and their serialized resource snapshots independent', async () => {
        const german = createRequestI18n();
        const french = createRequestI18n();
        german.addResourceBundle('de', 'common', { greeting: 'Hallo' });
        german.addResourceBundle('fr', 'admin', { unrelated: 'Excluded' });
        french.addResourceBundle('fr', 'common', { greeting: 'Bonjour' });
        await Promise.all([german.changeLanguage('de'), french.changeLanguage('fr')]);
        const de = getLocaleHydrationSnapshot(german);
        const fr = getLocaleHydrationSnapshot(french);
        german.addResourceBundle('de', 'common', { greeting: 'Changed after snapshot' }, true, true);
        expect(de.resources.de.common).toEqual({ greeting: 'Hallo' });
        expect(de.resources.fr).toBeUndefined();
        expect(fr.resources.fr.common).toEqual({ greeting: 'Bonjour' });
        expect(fr.resources.de).toBeUndefined();
    });
    it('does not replace state when there is no serialized resource contribution', async () => {
        const instance = createRequestI18n();
        const changeLanguage = vi.spyOn(instance, 'changeLanguage');
        await restoreLocaleHydrationSnapshot(undefined, instance);
        expect(changeLanguage).not.toHaveBeenCalled();
    });
});
