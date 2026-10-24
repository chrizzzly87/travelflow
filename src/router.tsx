import { parseRouteSearch, stringifyRouteSearch } from '../app/routing/search';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import i18n, { createRequestI18n } from '../i18n';
import { getLocaleHydrationSnapshot, restoreLocaleHydrationSnapshot } from '../app/routing/localeHydration';
import { configurePageTransitions } from '../app/routing/pageTransitions';
import { MarketingRouteLoadingShell } from '../components/bootstrap/MarketingRouteLoadingShell';
import { RouteErrorPage } from '../components/bootstrap/RouteErrorPage';
export function getRouter() {
    const requestI18n = typeof window === 'undefined' ? createRequestI18n() : i18n;
    const context = { i18n: requestI18n, hydrationI18n: requestI18n };
    const router = createRouter({
        routeTree,
        trailingSlash: 'never',
        parseSearch: parseRouteSearch,
        stringifySearch: stringifyRouteSearch,
        context,
        dehydrate: () => ({ i18n: getLocaleHydrationSnapshot(requestI18n) }),
        hydrate: async state => {
            await restoreLocaleHydrationSnapshot(state?.i18n, requestI18n);
            // A selective-SSR fallback can hydrate after browser preferences
            // change. Keep its delivered language immutable until it commits.
            context.hydrationI18n = requestI18n.cloneInstance({ lng: state?.i18n?.language ?? requestI18n.language });
        },
        scrollRestoration: true,
        defaultPreload: 'intent',
        // Without an external data cache, a zero preload stale time discards
        // every hover preload and runs the loader again on click.
        defaultPreloadStaleTime: 30_000,
        // Keep the current presentation while native loaders resolve. The shared
        // shell reports progress; first-load selective SSR still uses its fallback.
        defaultPendingMs: Infinity,
        defaultPendingMinMs: 0,
        defaultPendingComponent: MarketingRouteLoadingShell,
        defaultErrorComponent: RouteErrorPage,
    });
    configurePageTransitions(router);
    return router;
}
export type AppRouter = ReturnType<typeof getRouter>;
declare module '@tanstack/react-router' { interface Register { router: AppRouter } }
