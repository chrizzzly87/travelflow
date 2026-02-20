import { resolvePrefetchTargets } from '../../config/prefetchTargets';
import { stripLocalePrefix } from '../../config/routes';

const warmedPathnames = new Set<string>();

export const getPathnameFromHref = (href: string): string => {
    try {
        return new URL(href, window.location.origin).pathname;
    } catch {
        return href.split(/[?#]/)[0] || href;
    }
};

export const preloadRouteForPath = async (pathname: string): Promise<void> => {
    const normalizedPathname = stripLocalePrefix(pathname || '/');
    if (!normalizedPathname) return;
    if (warmedPathnames.has(normalizedPathname)) return;

    const targets = resolvePrefetchTargets(normalizedPathname);
    if (targets.length === 0) return;

    warmedPathnames.add(normalizedPathname);
    try {
        await Promise.all(targets.map((target) => target.load()));
    } catch {
        warmedPathnames.delete(normalizedPathname);
    }
};
