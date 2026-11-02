/**
 * Shared URL navigation helpers backed exclusively by TanStack Router.
 * Existing URL builders retain flat query/history contracts. Native route files use:
 * TanStack APIs directly; components share these URL-oriented link helpers.
 */
import React, { useCallback, useMemo } from 'react';
import { Link as StartLink, Navigate as StartNavigate, useMatch, useRouter, useRouterState, type RegisteredRouter } from '@tanstack/react-router';
import { stringifyRouteSearch } from './routing/search';
export interface Location { pathname: string; search: string; hash: string; state: any; key: string }
export type NavigateFunction = ReturnType<typeof useNavigate>;

type RouterSnapshot = ReturnType<ReturnType<typeof useRouter>['state']['matches']['at']>;
type ParsedLocation = ReturnType<typeof useRouter>['state']['location'];
type PresentedLocation = Pick<ParsedLocation, 'pathname' | 'searchStr' | 'hash' | 'state'>;
const leafLocations = new WeakMap<object, PresentedLocation>();

/**
 * The URL of the page that is actually on screen. While a navigation is
 * pending, `state.location` already points at the destination although the
 * previous matches stay mounted; and the new matches commit before the router
 * records `resolvedLocation`. The committed leaf match is the one value that
 * always agrees with what renders, so effects never act on another page's URL.
 */
const selectPresentedLocation = (state: ReturnType<typeof useRouter>['state']): PresentedLocation => {
    if (state.status === 'idle') return state.location;
    const leaf = state.matches.at(-1) as RouterSnapshot;
    if (!leaf) return state.location;
    const searchStr = stringifyRouteSearch(leaf.search as Record<string, unknown>);
    for (const candidate of [state.resolvedLocation, state.location]) {
        if (candidate && candidate.pathname === leaf.pathname && candidate.searchStr === searchStr) return candidate;
    }
    let synthesized = leafLocations.get(leaf);
    if (!synthesized) {
        synthesized = { pathname: leaf.pathname, searchStr, hash: '', state: {} as ParsedLocation['state'] };
        leafLocations.set(leaf, synthesized);
    }
    return synthesized;
};

export const useLocation = (): Location => {
    const location = useRouterState({ select: selectPresentedLocation });
    return useMemo(() => ({
        pathname: location.pathname, search: location.searchStr, hash: location.hash ? `#${location.hash}` : '',
        state: (location.state as { usr?: unknown }).usr ?? null,
        key: location.state.__TSR_key || 'default',
    }), [location.pathname, location.searchStr, location.hash, location.state]);
};

type To = string | { pathname?: string; search?: string; hash?: string };
const hrefFor = (to: To, currentPathname = '') =>
    typeof to === 'string' ? to : `${to.pathname || currentPathname}${to.search || ''}${to.hash || ''}`;

export const useNavigate = () => {
    const router = useRouter();
    return useCallback((to: number | To, options: { replace?: boolean; state?: unknown } = {}) => {
        if (typeof to === 'number') { router.history.go(to); return; }
        // `href` lets the router parse path, query and fragment itself, so
        // matching, loaders and preloads see the real search (a `?` inside
        // `to` would be read as part of the pathname). The flat-query codec
        // preserves repeated parameters.
        void router.navigate({ href: hrefFor(to, router.state.location.pathname), replace: options.replace, state: { usr: options.state ?? null } as any });
    }, [router]);
};

export const useParams = <T extends Record<string, string | undefined> = Record<string, string>>() => {
    const native = useRouterState({ select: (state) => state.matches.at(-1)?.params ?? {} });
    return native as T;
};

/**
 * Search params owned by the route that renders the caller. During a pending
 * navigation `state.location` already points at the destination while the
 * leaving page stays mounted, so reading or writing through it would copy this
 * page's query onto the next one (#586). The match keeps its own search, and
 * writes are dropped once the latest location no longer resolves to it.
 */
export const useSearchParams = (initial?: ConstructorParameters<typeof URLSearchParams>[0]) => {
    const router = useRouter();
    const routeId = useMatch({ strict: false, select: match => match.routeId });
    const search = useMatch({ strict: false, select: match => match.search });
    const searchStr = stringifyRouteSearch(search as Record<string, unknown>);
    const params = useMemo(() => new URLSearchParams(searchStr || initial), [searchStr]);
    const setParams = useCallback((next: URLSearchParams | Record<string, string> | string | ((previous: URLSearchParams) => URLSearchParams), options?: { replace?: boolean; state?: unknown }) => {
        const latest = router.latestLocation;
        if (!router.matchRoutes(latest).some(match => match.routeId === routeId)) return;
        const value = typeof next === 'function' ? next(new URLSearchParams(latest.searchStr)) : next;
        const query = new URLSearchParams(value).toString();
        const href = `${latest.pathname}${query ? `?${query}` : ''}${latest.hash ? `#${latest.hash}` : ''}`;
        void router.navigate({ href, replace: options?.replace, state: previous => ({ ...previous, usr: options?.state ?? null }) });
    }, [router, routeId]);
    return [params, setParams] as const;
};

export const Link = React.forwardRef<HTMLAnchorElement, any>(({ to, state, replace, preventScrollReset, reloadDocument, ...props }, ref) => (
    <StartLink<RegisteredRouter, string, string> {...props} ref={ref} href={hrefFor(to)} state={{ usr: state ?? null } as any} replace={replace} resetScroll={!preventScrollReset} reloadDocument={reloadDocument} preload="intent" />
));
Link.displayName = 'MigrationLink';
export const NavLink = React.forwardRef<HTMLAnchorElement, any>(({ to, end, className, style, children, ...props }, ref) => {
    const { pathname, pending } = useRouterState({ select: state => ({
        pathname: state.location.pathname,
        pending: state.status === 'pending',
    }) });
    const target = hrefFor(to).split(/[?#]/)[0];
    const isActive = end ? pathname === target : pathname === target || (target !== '/' && pathname.startsWith(`${target}/`));
    const status = { isActive, isPending: isActive && pending, isTransitioning: isActive && pending };
    // TanStack's Link applies its own (prefix) active state and aria-current;
    // give it the same `end` rule so it agrees with `isActive` (an `end` link
    // must not read as the current page on a child route).
    return <Link {...props} ref={ref} to={to} activeOptions={{ exact: Boolean(end), includeSearch: false }} aria-current={isActive ? 'page' : undefined} className={typeof className === 'function' ? className(status) : className} style={typeof style === 'function' ? style(status) : style}>{typeof children === 'function' ? children(status) : children}</Link>;
});
NavLink.displayName = 'MigrationNavLink';
export const Navigate = ({ to, state, replace }: any) => <StartNavigate<RegisteredRouter, string, string> href={hrefFor(to)} state={{ usr: state ?? null } as any} replace={replace} />;
