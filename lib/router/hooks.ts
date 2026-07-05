'use client';

import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import {
    Location,
    NavigateFunction,
    NavigateOptions,
    Params,
    RouteParamsContext,
    RouterAdapterContext,
    To,
    resolveTo,
} from './context';
import {
    getRouterLocationSnapshot,
    getServerRouterLocationSnapshot,
    subscribeToRouterLocation,
} from './locationStore';

const missingAdapter = (): never => {
    throw new Error(
        'Router compat hooks need a <NextRouterAdapter> (app) or <MemoryRouter> (tests) ancestor.'
    );
};

export const useRouterAdapter = () => {
    const adapter = useContext(RouterAdapterContext);
    if (!adapter) missingAdapter();
    return adapter!;
};

export function useLocation(): Location {
    const adapter = useRouterAdapter();
    const snapshot = useSyncExternalStore(
        subscribeToRouterLocation,
        getRouterLocationSnapshot,
        getServerRouterLocationSnapshot
    );

    return useMemo<Location>(() => {
        if (adapter.locationOverride) return adapter.locationOverride;
        return {
            pathname: adapter.pathname,
            search: snapshot.search,
            hash: snapshot.hash,
            state: snapshot.state,
            key: snapshot.key,
        };
    }, [adapter.locationOverride, adapter.pathname, snapshot]);
}

export function useNavigate(): NavigateFunction {
    const adapter = useRouterAdapter();
    return useCallback<NavigateFunction>(
        (to: To | number, options?: NavigateOptions) => {
            if (typeof to === 'number') {
                adapter.go(to);
                return;
            }
            adapter.navigate(resolveTo(to), options);
        },
        [adapter]
    );
}

export function useParams<K extends string = string>(): Readonly<Params<K>> {
    const adapter = useRouterAdapter();
    const routeParams = useContext(RouteParamsContext);
    return useMemo(() => {
        const merged: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(adapter.params)) {
            merged[key] = Array.isArray(value) ? value.join('/') : value;
        }
        if (routeParams) Object.assign(merged, routeParams);
        return merged as Readonly<Params<K>>;
    }, [adapter.params, routeParams]);
}

/**
 * Imperative route prefetch (Next router.prefetch under the app, no-op in
 * tests). Replaces the legacy navigationPrefetch warmRouteAssets calls.
 */
export function useRoutePrefetch(): (href: string) => void {
    const adapter = useRouterAdapter();
    return useCallback((href: string) => {
        adapter.prefetch?.(href);
    }, [adapter]);
}

export type SetURLSearchParams = (
    nextInit:
        | URLSearchParams
        | string
        | Record<string, string | string[]>
        | ((prev: URLSearchParams) => URLSearchParams | string | Record<string, string | string[]>),
    navigateOpts?: NavigateOptions
) => void;

const toSearchParams = (
    init: URLSearchParams | string | Record<string, string | string[]>
): URLSearchParams => {
    if (init instanceof URLSearchParams) return init;
    if (typeof init === 'string') return new URLSearchParams(init);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(init)) {
        if (Array.isArray(value)) {
            for (const item of value) params.append(key, item);
        } else {
            params.set(key, value);
        }
    }
    return params;
};

export function useSearchParams(): [URLSearchParams, SetURLSearchParams] {
    const location = useLocation();
    const adapter = useRouterAdapter();

    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const setSearchParams = useCallback<SetURLSearchParams>(
        (nextInit, navigateOpts) => {
            const resolved = typeof nextInit === 'function'
                ? nextInit(new URLSearchParams(adapter.locationOverride?.search ?? getRouterLocationSnapshot().search))
                : nextInit;
            const params = toSearchParams(resolved);
            const query = params.toString();
            const pathname = adapter.locationOverride?.pathname ?? adapter.pathname;
            adapter.navigate(`${pathname}${query ? `?${query}` : ''}`, {
                // Search-param updates (pagination, drawers) keep the scroll
                // position, matching react-router semantics.
                preventScrollReset: true,
                ...navigateOpts,
            });
        },
        [adapter]
    );

    return [searchParams, setSearchParams];
}
