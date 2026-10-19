import { parseRouteSearch, stringifyRouteSearch } from '../app/routing/search';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import i18n, { createRequestI18n } from '../i18n';
import { getLocaleHydrationSnapshot, restoreLocaleHydrationSnapshot } from '../app/routing/localeHydration';
import { configurePageTransitions } from '../app/routing/pageTransitions';
import { MarketingRouteLoadingShell } from '../components/bootstrap/MarketingRouteLoadingShell';
export function getRouter() {
    const requestI18n = typeof window === 'undefined' ? createRequestI18n() : i18n;
    const router = createRouter({
        routeTree,
        trailingSlash: 'never',
        parseSearch: parseRouteSearch,
        stringifySearch: stringifyRouteSearch,
        context: { i18n: requestI18n },
        dehydrate: () => ({ i18n: getLocaleHydrationSnapshot(requestI18n) }),
        hydrate: state => restoreLocaleHydrationSnapshot(state?.i18n, requestI18n),
        scrollRestoration: true,
        defaultPreload: 'intent',
        defaultPreloadStaleTime: 0,
        // Keep the current presentation while native loaders resolve. The shared
        // shell reports progress; first-load selective SSR still uses its fallback.
        defaultPendingMs: Infinity,
        defaultPendingMinMs: 0,
        defaultPendingComponent: MarketingRouteLoadingShell,
    });
    configurePageTransitions(router);
    return router;
}
export type AppRouter = ReturnType<typeof getRouter>;
declare module '@tanstack/react-router' { interface Register { router: AppRouter } }
