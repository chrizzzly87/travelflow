import { describe, expect, it } from 'vitest';
import { publicPrerenderPaths, offlineShellMaskPath } from '../../app/routing/publicPrerender';
import { getRouter } from '../../src/router';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../config/locales';
import { extractLocaleFromPath, stripLocalePrefix, isToolRoute } from '../../config/routes';

describe('public document build boundary', () => {
    it('keeps the neutral shell outside optional-locale and workspace matches', () => {
        expect(getRouter().matchRoutes(offlineShellMaskPath).map(match => match.routeId)).toEqual(['__root__', offlineShellMaskPath]);
    });
    it('covers the seven public entry points for every active locale without aliases or private documents', () => {
        expect(new Set(publicPrerenderPaths).size).toBe(SUPPORTED_LOCALES.length * 7);
        for (const locale of SUPPORTED_LOCALES) {
            const paths = publicPrerenderPaths.filter(route => (extractLocaleFromPath(route) ?? DEFAULT_LOCALE) === locale);
            expect(paths).toHaveLength(7);
            expect(paths.map(stripLocalePrefix)).toEqual(['/', '/features', '/pricing', '/faq', '/blog', '/updates', '/inspirations']);
        }
        for (const route of publicPrerenderPaths) {
            expect(isToolRoute(route)).toBe(false);
            expect(route).not.toMatch(/\/(?:admin|profile|trip|s|example|create-trip|login|auth|api)(?:\/|$)/);
            expect(route).not.toMatch(/^\/en(?:\/|$)/);
            if (route !== '/') expect(route).not.toMatch(/\/$/);
        }
    });
});
