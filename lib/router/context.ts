import { createContext } from 'react';

export type Params<Key extends string = string> = {
    readonly [key in Key]: string | undefined;
};

export interface Location<State = unknown> {
    pathname: string;
    search: string;
    hash: string;
    state: State;
    key: string;
}

export interface NavigateOptions {
    replace?: boolean;
    state?: unknown;
    preventScrollReset?: boolean;
}

export type To = string | Partial<Pick<Location, 'pathname' | 'search' | 'hash'>>;

export interface NavigateFunction {
    (to: To, options?: NavigateOptions): void;
    (delta: number): void;
}

export interface RouterAdapter {
    pathname: string;
    params: Record<string, string | string[] | undefined>;
    navigate: (href: string, options?: NavigateOptions) => void;
    go: (delta: number) => void;
    prefetch?: (href: string) => void;
    /** Test-only full-location override (MemoryRouter). */
    locationOverride?: Location | null;
}

export const RouterAdapterContext = createContext<RouterAdapter | null>(null);

/** Params contributed by a matched compat <Route> (overrides adapter params). */
export const RouteParamsContext = createContext<Record<string, string | undefined> | null>(null);

/**
 * Base path that relative <Route> paths resolve against, e.g. "/admin" for the
 * admin workspace mounted under the /admin/* catch-all.
 */
export const RouteBaseContext = createContext<string>('/');

export const resolveTo = (to: To): string => {
    if (typeof to === 'string') return to;
    const pathname = to.pathname ?? '';
    const search = to.search ? (to.search.startsWith('?') ? to.search : `?${to.search}`) : '';
    const hash = to.hash ? (to.hash.startsWith('#') ? to.hash : `#${to.hash}`) : '';
    return `${pathname}${search}${hash}`;
};
