// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { hydrate } from '@tanstack/react-router/ssr/client';
import { buildSiteOgMetadata } from '../../netlify/edge-lib/site-og-metadata';
import { offlineShellMaskPath } from '../../app/routing/publicPrerender';
import { resolveRouteDocument } from '../../src/document/routeDocument';

const mocks = vi.hoisted(() => ({
    instance: { resolvedLanguage: 'en', language: 'en', on: vi.fn(), off: vi.fn(), changeLanguage: vi.fn(async (_language: string) => {}) },
    tripMetadata: vi.fn(async () => null as null | Record<string, string>),
}));
vi.mock('../../i18n', () => ({ default: mocks.instance, preloadLocaleNamespaces: vi.fn(async () => {}) }));
vi.mock('../../src/server/tripMetadata', () => ({ getTripDocumentMetadata: mocks.tripMetadata }));
vi.mock('../../app/shell/ApplicationShell', () => ({ default: () => null }));
vi.mock('../../src/documentAssets', () => ({ bootScripts: [] }));
vi.mock('../../src/document/ContactFormRegistration', () => ({ ContactFormRegistration: () => null }));
import { Route } from '../../src/routes/__root';

beforeEach(() => {
    mocks.instance.resolvedLanguage = 'en';
    mocks.instance.language = 'en';
    mocks.instance.changeLanguage.mockImplementation(async language => {
        mocks.instance.resolvedLanguage = language;
        mocks.instance.language = language;
    });
});

afterEach(() => { delete (window as any).$_TSR; localStorage.clear(); mocks.tripMetadata.mockReset(); });

async function maskTransport() {
    const location = { pathname: offlineShellMaskPath, href: offlineShellMaskPath, searchStr: '' };
    const context = { i18n: mocks.instance, ...(Route.options.context as any)?.({ location }) };
    return (Route.options.beforeLoad as any)({ context, location, abortController: new AbortController() });
}

async function hydrateRoute(pathname: string) {
    const root = createRootRoute({ ...Route.options, component: () => null } as any);
    const leaf = createRoute({ getParentRoute: () => root, path: '/{-$locale}/create-trip', component: () => null });
    const router = createRouter({ routeTree: root.addChildren([leaf]), history: createMemoryHistory({ initialEntries: [pathname] }), context: { i18n: mocks.instance } });
    (window as any).$_TSR = { buffer: [], router: { manifest: undefined, matches: [{ i: router.matchRoutes(pathname)[0]!.id.replaceAll('/', '#'), s: 'success', ssr: true, u: 0, b: await maskTransport() }] } };
    await hydrate(router);
    // Match the installed React 18 hydration contract: first the transported
    // neutral head, then the root's native recovery load updates its attributes.
    expect(router.state.matches[0]?.links).toContainEqual({ rel: 'canonical', href: `https://travelflowapp.netlify.app${offlineShellMaskPath}` });
    await router.invalidate({ filter: match => match.routeId === '__root__' });
    return router.state.matches[0];
}

describe('native masked document head ownership', () => {
    it.each(['/create-trip', '/fa/create-trip'])('reconstructs actual route metadata and locale while hydrating %s from the neutral mask', async pathname => {
        const match = await hydrateRoute(pathname);
        const expected = buildSiteOgMetadata(new URL(pathname, 'https://travelflowapp.netlify.app'));
        expect(match?.meta).toContainEqual({ title: expected.pageTitle });
        expect(match?.meta).toContainEqual({ name: 'content-language', content: pathname.startsWith('/fa/') ? 'fa' : 'en' });
        expect(match?.links).toContainEqual({ rel: 'canonical', href: expected.canonicalUrl });
        expect(resolveRouteDocument(match!.context as any).locale).toBe(pathname.startsWith('/fa/') ? 'fa' : 'en');
        expect(match?.meta).toContainEqual({ property: 'og:title', content: expected.ogTitle });
        expect(match?.meta).toContainEqual({ name: 'description', content: expected.description });
    });

    it('refreshes the reused root on native warm navigation and intent preload', async () => {
        const root = createRootRoute({ ...Route.options, component: () => null } as any);
        const leaf = createRoute({ getParentRoute: () => root, path: '/{-$locale}/create-trip', component: () => null });
        const router = createRouter({ routeTree: root.addChildren([leaf]), history: createMemoryHistory({ initialEntries: ['/create-trip'] }), context: { i18n: mocks.instance } });
        await router.load();
        await router.preloadRoute({ to: '/{-$locale}/create-trip', params: { locale: 'fa' } });
        expect(router.state.location.pathname).toBe('/create-trip');
        expect(mocks.instance.resolvedLanguage).toBe('en');
        for (const [pathname, locale] of [['/de/create-trip', 'de'], ['/fa/create-trip', 'fa'], ['/create-trip', 'en']]) {
            await router.navigate({ to: pathname });
            const match = router.state.matches[0];
            const expected = buildSiteOgMetadata(new URL(pathname, 'https://travelflowapp.netlify.app'));
            expect(match?.meta).toContainEqual({ title: expected.pageTitle });
            expect(match?.meta).toContainEqual({ name: 'content-language', content: locale });
            expect(match?.links).toContainEqual({ rel: 'canonical', href: expected.canonicalUrl });
            expect(resolveRouteDocument(match!.context as any).locale).toBe(locale);
            expect(mocks.instance.resolvedLanguage).toBe(locale);
        }
    });

    it('retains authorized public trip metadata, then clears it for a non-trip route', async () => {
        const trip = { pageTitle: 'Public trip | TravelFlow', description: 'Public summary' };
        mocks.tripMetadata.mockResolvedValueOnce(trip);
        const location = { pathname: '/trip/public-trip', href: '/trip/public-trip', searchStr: '' };
        const context = { i18n: mocks.instance, ...(Route.options.context as any)({ location }) };
        const tripContext = await (Route.options.beforeLoad as any)({ context, location, abortController: new AbortController() });
        const head = await (Route.options.head as any)({ match: { context: { ...context, ...tripContext }, pathname: '/' } });
        expect(head.meta).toContainEqual({ title: trip.pageTitle });
        expect(head.meta).toContainEqual({ property: 'og:description', content: trip.description });
        expect(await maskTransport()).toMatchObject({ tripMetadata: null, routeDocument: { pathname: offlineShellMaskPath } });
    });
});
