/**
 * Shared URL navigation helpers backed exclusively by TanStack Router.
 * Existing URL builders retain flat query/history contracts. Native route files use:
 * TanStack APIs directly; components share these URL-oriented link helpers.
 */
import React, { useCallback, useMemo } from 'react';
import { Link as StartLink, Navigate as StartNavigate, useRouter, useRouterState } from '@tanstack/react-router';
export interface Location { pathname: string; search: string; hash: string; state: any; key: string }
export type NavigateFunction = ReturnType<typeof useNavigate>;

export const useLocation = () => useRouterState({ select: ({ location }) => ({
    pathname: location.pathname, search: location.searchStr, hash: location.hash ? `#${location.hash}` : '',
    state: (location.state as { usr?: unknown }).usr ?? null,
    key: location.state.__TSR_key || 'default',
}) });

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

export const useSearchParams = (initial?: ConstructorParameters<typeof URLSearchParams>[0]) => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useMemo(() => new URLSearchParams(location.search || initial), [location.search]);
    const setParams = useCallback((next: URLSearchParams | Record<string, string> | string | ((previous: URLSearchParams) => URLSearchParams), options?: { replace?: boolean; state?: unknown }) => {
        const value = typeof next === 'function' ? next(new URLSearchParams(location.search)) : next;
        const search = new URLSearchParams(value).toString();
        navigate(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`, options);
    }, [location.pathname, location.search, location.hash, navigate]);
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
