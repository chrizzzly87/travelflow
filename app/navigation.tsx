/**
 * Shared URL navigation helpers backed exclusively by TanStack Router.
 * Existing URL builders retain flat query/history contracts. Native route files use:
 * TanStack APIs directly; components share these URL-oriented link helpers.
 */
import React, { useCallback, useMemo } from 'react';
import { Link as StartLink, Navigate as StartNavigate, useMatch, useRouter, useRouterState } from '@tanstack/react-router';
import { stringifyRouteSearch } from './routing/search';
export interface Location { pathname: string; search: string; hash: string; state: any; key: string }
export type NavigateFunction = ReturnType<typeof useNavigate>;

export const useLocation = (): Location => {
    const location = useRouterState({ select: state => state.location });
    return useMemo(() => ({
        pathname: location.pathname, search: location.searchStr, hash: location.hash ? `#${location.hash}` : '',
        state: (location.state as { usr?: unknown }).usr ?? null,
        key: location.state.__TSR_key || 'default',
    }), [location.pathname, location.searchStr, location.hash, location.state]);
};

export const useNavigate = () => {
    const router = useRouter();
    return useCallback((to: number | string | { pathname?: string; search?: string; hash?: string }, options: { replace?: boolean; state?: unknown } = {}) => {
        if (typeof to === 'number') { router.history.go(to); return; }
        const href = typeof to === 'string' ? to : `${to.pathname || router.state.location.pathname}${to.search || ''}${to.hash || ''}`;
        const state = { usr: options.state ?? null };
        // Native navigation owns matching, loaders, scroll and cancellation.
        // The shared flat-query parser preserves repeated URL parameters.
        void router.navigate({ to: href, replace: options.replace, state: previous => ({ ...previous, ...state }) });
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

const hrefFor = (to: string | { pathname?: string; search?: string; hash?: string }) =>
    typeof to === 'string' ? to : `${to.pathname || ''}${to.search || ''}${to.hash || ''}`;

export const Link = React.forwardRef<HTMLAnchorElement, any>(({ to, state, replace, preventScrollReset, reloadDocument, ...props }, ref) => (
    <StartLink {...props} ref={ref} to={hrefFor(to)} state={{ usr: state ?? null } as any} replace={replace} resetScroll={!preventScrollReset} reloadDocument={reloadDocument} preload="intent" />
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
    return <Link {...props} ref={ref} to={to} aria-current={isActive ? 'page' : undefined} className={typeof className === 'function' ? className(status) : className} style={typeof style === 'function' ? style(status) : style}>{typeof children === 'function' ? children(status) : children}</Link>;
});
NavLink.displayName = 'MigrationNavLink';
export const Navigate = ({ to, state, replace }: any) => <StartNavigate to={to} state={{ usr: state ?? null } as any} replace={replace} />;
