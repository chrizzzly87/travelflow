'use client';

import React, { forwardRef, useContext, useEffect, useMemo } from 'react';
import {
    NavigateOptions,
    RouteBaseContext,
    RouteParamsContext,
    To,
    resolveTo,
} from './context';
import { useLocation, useNavigate, useRouterAdapter } from './hooks';
import { stripLocalePrefix } from '../../config/routes';

// ---------------------------------------------------------------------------
// Link / NavLink
// ---------------------------------------------------------------------------

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    to: To;
    replace?: boolean;
    state?: unknown;
    preventScrollReset?: boolean;
    prefetch?: boolean;
}

const isModifiedEvent = (event: React.MouseEvent): boolean =>
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

const isExternalHref = (href: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/');

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
    { to, replace, state, preventScrollReset, prefetch = true, onClick, onMouseEnter, onFocus, onTouchStart, target, children, ...rest },
    ref
) {
    const adapter = useRouterAdapter();
    const href = resolveTo(to);

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (isModifiedEvent(event)) return;
        if (target && target !== '_self') return;
        if (isExternalHref(href)) return;
        event.preventDefault();
        adapter.navigate(href, { replace, state, preventScrollReset });
    };

    const warmPrefetch = () => {
        if (!prefetch || isExternalHref(href)) return;
        adapter.prefetch?.(href);
    };

    return (
        <a
            {...rest}
            ref={ref}
            href={href}
            target={target}
            onClick={handleClick}
            onMouseEnter={(event) => {
                onMouseEnter?.(event);
                warmPrefetch();
            }}
            onFocus={(event) => {
                onFocus?.(event);
                warmPrefetch();
            }}
            onTouchStart={(event) => {
                onTouchStart?.(event);
                warmPrefetch();
            }}
        >
            {children}
        </a>
    );
});

export interface NavLinkRenderArgs {
    isActive: boolean;
    isPending: boolean;
}

export interface NavLinkProps extends Omit<LinkProps, 'className' | 'style' | 'children'> {
    end?: boolean;
    caseSensitive?: boolean;
    className?: string | ((args: NavLinkRenderArgs) => string | undefined);
    style?: React.CSSProperties | ((args: NavLinkRenderArgs) => React.CSSProperties | undefined);
    children?: React.ReactNode | ((args: NavLinkRenderArgs) => React.ReactNode);
}

const normalizePathname = (pathname: string): string => {
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed === '' ? '/' : trimmed;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
    { end = false, caseSensitive = false, className, style, children, 'aria-current': ariaCurrentProp, ...rest },
    ref
) {
    const { pathname } = useLocation();
    const toPathname = normalizePathname(resolveTo(rest.to).split(/[?#]/)[0] || '/');
    const currentPathname = normalizePathname(pathname);

    const [comparePath, compareTo] = caseSensitive
        ? [currentPathname, toPathname]
        : [currentPathname.toLowerCase(), toPathname.toLowerCase()];

    const isActive = end || compareTo === '/'
        ? comparePath === compareTo
        : comparePath === compareTo || comparePath.startsWith(`${compareTo}/`);

    const renderArgs: NavLinkRenderArgs = { isActive, isPending: false };

    return (
        <Link
            {...rest}
            ref={ref}
            aria-current={ariaCurrentProp ?? (isActive ? 'page' : undefined)}
            className={typeof className === 'function' ? className(renderArgs) : className}
            style={typeof style === 'function' ? style(renderArgs) : style}
        >
            {typeof children === 'function' ? children(renderArgs) : children}
        </Link>
    );
});

// ---------------------------------------------------------------------------
// Navigate
// ---------------------------------------------------------------------------

export interface NavigateProps extends NavigateOptions {
    to: To;
}

export const Navigate: React.FC<NavigateProps> = ({ to, replace, state, preventScrollReset }) => {
    const navigate = useNavigate();
    const href = resolveTo(to);

    useEffect(() => {
        navigate(href, { replace, state, preventScrollReset });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [href, replace]);

    return null;
};

// ---------------------------------------------------------------------------
// Routes / Route — minimal path matcher covering this codebase's patterns:
// static segments, :params, trailing "*", `index` routes, relative paths
// resolved against RouteBaseContext, locale-prefix stripping.
// ---------------------------------------------------------------------------

export interface RouteProps {
    path?: string;
    index?: boolean;
    element?: React.ReactNode;
}

export const Route: React.FC<RouteProps> = () => {
    throw new Error('<Route> must be rendered directly inside <Routes>.');
};

interface RouteMatch {
    params: Record<string, string | undefined>;
    element: React.ReactNode;
}

const matchPattern = (pattern: string, pathname: string): Record<string, string | undefined> | null => {
    const patternSegments = pattern.split('/').filter(Boolean);
    const pathSegments = pathname.split('/').filter(Boolean);
    const params: Record<string, string | undefined> = {};

    for (let i = 0; i < patternSegments.length; i += 1) {
        const patternSegment = patternSegments[i];
        if (patternSegment === '*') {
            params['*'] = pathSegments.slice(i).map(decodeURIComponent).join('/');
            return params;
        }
        const pathSegment = pathSegments[i];
        if (pathSegment === undefined) return null;
        if (patternSegment.startsWith(':')) {
            params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
        } else if (patternSegment.toLowerCase() !== pathSegment.toLowerCase()) {
            return null;
        }
    }

    return pathSegments.length === patternSegments.length ? params : null;
};

export const Routes: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { pathname } = useLocation();
    const base = useContext(RouteBaseContext);

    const match = useMemo<RouteMatch | null>(() => {
        const strippedPathname = stripLocalePrefix(pathname);
        const normalizedBase = normalizePathname(base);
        let remainder = strippedPathname;
        if (normalizedBase !== '/' && (
            strippedPathname === normalizedBase || strippedPathname.startsWith(`${normalizedBase}/`)
        )) {
            remainder = strippedPathname.slice(normalizedBase.length) || '/';
        }

        const routeElements: Array<{ path?: string; index?: boolean; element?: React.ReactNode }> = [];
        React.Children.forEach(children, (child) => {
            if (React.isValidElement<RouteProps>(child) && child.type === Route) {
                routeElements.push(child.props);
            }
        });

        for (const route of routeElements) {
            if (route.index) {
                if (remainder === '/' || remainder === '') {
                    return { params: {}, element: route.element };
                }
                continue;
            }
            if (route.path === undefined) continue;
            const pattern = route.path.startsWith('/') ? route.path : `/${route.path}`;
            const params = matchPattern(pattern, remainder);
            if (params) return { params, element: route.element };
        }
        return null;
    }, [base, children, pathname]);

    if (!match) return null;

    return (
        <RouteParamsContext.Provider value={match.params}>
            {match.element}
        </RouteParamsContext.Provider>
    );
};

/** Mounts children with a base path for relative <Route> resolution. */
export const RouteBase: React.FC<{ base: string; children: React.ReactNode }> = ({ base, children }) => (
    <RouteBaseContext.Provider value={base}>{children}</RouteBaseContext.Provider>
);
