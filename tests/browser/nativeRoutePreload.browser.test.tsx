// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link } from '../../app/navigation';
import { parseRouteSearch, stringifyRouteSearch } from '../../app/routing/search';
import { RouteLoadingDebug } from '../../components/onPageDebugger/RouteLoadingDebug';

afterEach(cleanup);

describe('native route loading and history', () => {
    it('preloads the matching route on intent without navigating or loading unrelated workspaces', async () => {
        const pricingLoader = vi.fn(async () => ({ plan: 'Explorer' }));
        const tripLoader = vi.fn(async () => ({}));
        const root = createRootRoute({ component: () => <><Outlet /><RouteLoadingDebug /></> });
        const home = createRoute({ getParentRoute: () => root, path: '/', component: () => <Link to="/pricing">Pricing</Link> });
        const pricing = createRoute({ getParentRoute: () => root, path: '/pricing', loader: pricingLoader, component: () => <h1>Pricing plans</h1> });
        const trip = createRoute({ getParentRoute: () => root, path: '/trip/$tripId', loader: tripLoader, component: () => <h1>Trip</h1> });
        const router = createRouter({ parseSearch: parseRouteSearch, stringifySearch: stringifyRouteSearch, routeTree: root.addChildren([home, pricing, trip]), history: createMemoryHistory({ initialEntries: ['/'] }), defaultPreloadDelay: 0 });
        render(<RouterProvider router={router} />);
        const link = await screen.findByRole('link', { name: 'Pricing' });
        expect(pricingLoader).not.toHaveBeenCalled();
        fireEvent.focus(link);
        await waitFor(() => expect(pricingLoader).toHaveBeenCalledTimes(1));
        expect(router.state.location.pathname).toBe('/');
        expect(screen.getByRole('region', { name: 'Native route loading' })).not.toHaveTextContent('/pricing: success');
        expect(tripLoader).not.toHaveBeenCalled();
        fireEvent.click(link);
        expect(await screen.findByRole('heading', { name: 'Pricing plans' })).toBeVisible();
        expect(screen.getByRole('region', { name: 'Native route loading' })).toHaveTextContent('/pricing: success');
        expect(pricingLoader).toHaveBeenCalledTimes(1);
        expect(tripLoader).not.toHaveBeenCalled();
    });

    it('restores the matched route and repeated query values on browser back and forward', async () => {
        const root = createRootRoute({ component: Outlet });
        const list = createRoute({ getParentRoute: () => root, path: '/blog', component: () => <h1>Articles</h1> });
        const detail = createRoute({ getParentRoute: () => root, path: '/blog/$slug', component: () => <h1>Article</h1> });
        const history = createMemoryHistory({ initialEntries: ['/blog?tag=food&tag=city'] });
        const router = createRouter({ parseSearch: parseRouteSearch, stringifySearch: stringifyRouteSearch, routeTree: root.addChildren([list, detail]), history });
        render(<RouterProvider router={router} />);
        expect(await screen.findByRole('heading', { name: 'Articles' })).toBeVisible();
        await router.navigate({ to: '/blog/$slug', params: { slug: 'japan' } });
        expect(await screen.findByRole('heading', { name: 'Article' })).toBeVisible();
        history.back();
        expect(await screen.findByRole('heading', { name: 'Articles' })).toBeVisible();
        expect(router.state.location.searchStr).toBe('?tag=food&tag=city');
        history.forward();
        expect(await screen.findByRole('heading', { name: 'Article' })).toBeVisible();
        expect(router.state.matches.at(-1)?.params).toMatchObject({ slug: 'japan' });
    });
});
