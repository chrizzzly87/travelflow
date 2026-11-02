import { offlineShellMaskPath } from '../../app/routing/publicPrerender';
import { getRouteLocale } from '../../app/routing/routeLocale';
import { buildSiteOgMetadata } from '../../netlify/edge-lib/site-og-metadata';

export function buildRouteDocument(href: string, storedLocale?: string | null) {
    const url = new URL(href, 'https://travelflowapp.netlify.app');
    return {
        pathname: url.pathname,
        locale: getRouteLocale(url.pathname, storedLocale),
        metadata: buildSiteOgMetadata(url),
    };
}

type RouteDocument = ReturnType<typeof buildRouteDocument>;

/** Only masked SPA hydration needs the initial URL snapshot. Warm loads own a fresh beforeLoad result. */
export function resolveRouteDocument(context: { hydrationDocument: RouteDocument; routeDocument?: RouteDocument }) {
    return context.routeDocument?.pathname === offlineShellMaskPath
        ? context.hydrationDocument
        : context.routeDocument ?? context.hydrationDocument;
}
