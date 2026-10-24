/** Real TanStack contexts/history for component tests, with a small JSX route fixture DSL. */
import React, { createContext, useContext, useState } from 'react';
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { useLocation } from '../../app/navigation';
import { parseRouteSearch, stringifyRouteSearch } from '../../app/routing/search';
export { Link, NavLink, Navigate, useLocation, useNavigate, useParams, useSearchParams } from '../../app/navigation';
export type { NavigateFunction, Location } from '../../app/navigation';
const FixtureContext = createContext<React.ReactNode>(null);
const Fixture = () => <>{useContext(FixtureContext)}</>;
interface FixtureRoute { path?: string; index?: boolean; element?: React.ReactNode; children?: React.ReactNode }
export const Route = (_props: FixtureRoute) => null;
const collect = (children: React.ReactNode): FixtureRoute[] => React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<FixtureRoute>(child)) return [];
    return child.type === Route ? [child.props] : collect(child.props.children);
});
const matchPath = (pattern: string, path: string) => {
    const expression = pattern.split('/').map(part => part === '*' ? '.*' : part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/');
    return new RegExp(`^${expression}/?$`, 'i').test(path);
};
export function Routes({ children }: { children: React.ReactNode }) {
    const { pathname } = useLocation();
    const selected = collect(children).find(route => route.path !== '*' && matchPath(route.path || '/', pathname)) ?? collect(children).find(route => route.path === '*');
    return <>{selected?.element ?? null}</>;
}
export function MemoryRouter({ children, initialEntries = ['/'], initialIndex }: { children?: React.ReactNode; initialEntries?: Array<string | { pathname?: string; search?: string; hash?: string; state?: unknown }>; initialIndex?: number }) {
    const [router] = useState(() => {
        const entries = initialEntries.map(entry => typeof entry === 'string' ? entry : `${entry.pathname || '/'}${entry.search || ''}${entry.hash || ''}`);
        const history = createMemoryHistory({ initialEntries: entries, initialIndex });
        const currentEntry = initialEntries[initialIndex ?? initialEntries.length - 1];
        if (typeof currentEntry === 'object') history.replace(history.location.href, { usr: currentEntry.state ?? null });
        const root = createRootRoute({ component: Fixture });
        const paths = new Set(['/trip/$tripId', '/example/$templateId', '/s/$token', '/u/$username', '/u/$username/stamps', '/{-$locale}/blog/$slug', '/{-$locale}/inspirations/country/$countryName', '/{-$locale}/inspirations/country/$countrySlug/$destinationSlug', ...collect(children).map(route => route.path?.replace(/:([\w]+)/g, '$$$1').replace(/\*/g, '$')).filter(Boolean) as string[], '/$']);
        const leaves = [...paths].map(path => createRoute({ getParentRoute: () => root, path, component: () => null }));
        return createRouter({ routeTree: root.addChildren(leaves), history, parseSearch: parseRouteSearch, stringifySearch: stringifyRouteSearch, scrollRestoration: false });
    });
    return <FixtureContext.Provider value={children}><RouterProvider router={router} /></FixtureContext.Provider>;
}
