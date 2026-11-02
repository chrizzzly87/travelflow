// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
const auth = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../pages/MarketingHomePage', () => ({ MarketingHomePage: () => <h1>Travel home</h1> }));
import { Route as HomeRoute } from '../../src/routes/public/home';
afterEach(cleanup);
describe('public homepage for signed-in members', () => {
    it('never redirects the public landing page to a private route', async () => {
        const loadProfile = vi.fn();
        const root = createRootRoute({ component: Outlet });
        const home = createRoute({ getParentRoute: () => root, path: '/', component: HomeRoute.options.component });
        const profile = createRoute({ getParentRoute: () => root, path: '/profile', beforeLoad: loadProfile, component: () => <h1>Private trips</h1> });
        const router = createRouter({ routeTree: root.addChildren([home, profile]), history: createMemoryHistory({ initialEntries: ['/'] }), defaultPendingMs: Infinity });
        await act(async () => { await router.load(); render(<RouterProvider router={router} />); });
        expect(screen.getByRole('heading', { name: 'Travel home' })).toBeVisible();
        expect(screen.queryByRole('heading', { name: 'Private trips' })).toBeNull();
        expect(router.state.location.pathname).toBe('/');
        expect(loadProfile).not.toHaveBeenCalled();
    });
});
