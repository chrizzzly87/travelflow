import { parseRouteSearch, stringifyRouteSearch } from '../app/routing/search';
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import i18n, { createRequestI18n } from '../i18n';
import { MarketingRouteLoadingShell } from '../components/bootstrap/MarketingRouteLoadingShell';
export function getRouter() {
    return createRouter({ routeTree, parseSearch: parseRouteSearch, stringifySearch: stringifyRouteSearch, context: { i18n: typeof window === 'undefined' ? createRequestI18n() : i18n }, scrollRestoration: true, defaultPreload: 'intent', defaultPreloadStaleTime: 0, defaultPendingMs: 100, defaultPendingMinMs: 0, defaultPendingComponent: MarketingRouteLoadingShell });
}
export type AppRouter = ReturnType<typeof getRouter>;
declare module '@tanstack/react-router' { interface Register { router: AppRouter } }
