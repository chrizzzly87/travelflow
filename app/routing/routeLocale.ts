import { DEFAULT_LOCALE, normalizeLocale } from '../../config/locales';
import { extractLocaleFromPath, getNamespacesForMarketingPath, getNamespacesForToolPath, isToolRoute, stripLocalePrefix } from '../../config/routes';

export const getRouteLocale = (pathname: string, storedLocale?: string | null) =>
    extractLocaleFromPath(pathname) ?? (isToolRoute(pathname) ? normalizeLocale(storedLocale) : DEFAULT_LOCALE);

/** Load only route requirements; auth dialogs and account capabilities own their namespaces. */
export function getRouteNamespaces(pathname: string): string[] {
    const path = stripLocalePrefix(pathname);
    const namespaces = isToolRoute(pathname) ? getNamespacesForToolPath(pathname) : getNamespacesForMarketingPath(pathname);
    return [...new Set(['common', ...namespaces, ...(/^\/(?:login|auth)(\/|$)/.test(path) ? ['auth'] : [])])];
}
