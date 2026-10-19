import { parseRouteSearch, stringifyRouteSearch } from '../app/routing/search';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import i18n, { createRequestI18n } from '../i18n';
import { getLocaleHydrationSnapshot, restoreLocaleHydrationSnapshot } from '../app/routing/localeHydration';
import { MarketingRouteLoadingShell } from '../components/bootstrap/MarketingRouteLoadingShell';
export function getRouter() {
    const requestI18n = typeof window === 'undefined' ? createRequestI18n() : i18n;
    return createRouter({
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
        defaultPendingMs: 500,
        defaultPendingMinMs: 0,
        defaultPendingComponent: MarketingRouteLoadingShell,
    });
}
export type AppRouter = ReturnType<typeof getRouter>;
declare module '@tanstack/react-router' { interface Register { router: AppRouter } }
