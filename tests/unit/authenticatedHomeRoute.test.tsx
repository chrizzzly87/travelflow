// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
const auth = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => auth }));
import { AuthenticatedHomeRoute } from '../../features/auth/AuthenticatedHomeRoute';
afterEach(cleanup);
describe('verified account home handoff', () => {
    it('retains the landing content until the guarded profile route is ready', async () => {
        let release!: () => void;
        const blocked = new Promise<void>(resolve => { release = resolve; });
        const root = createRootRoute({ component: Outlet });
        const home = createRoute({ getParentRoute: () => root, path: '/', component: () => <AuthenticatedHomeRoute><h1>Travel home</h1></AuthenticatedHomeRoute> });
        const profile = createRoute({ getParentRoute: () => root, path: '/profile', beforeLoad: () => blocked, component: () => <h1>Private trips</h1> });
        const router = createRouter({ routeTree: root.addChildren([home, profile]), history: createMemoryHistory({ initialEntries: ['/'] }), defaultPendingMs: Infinity });
        await act(async () => { await router.load(); render(<RouterProvider router={router} />); });
        expect(screen.getByRole('heading', { name: 'Travel home' })).toBeVisible();
        expect(screen.queryByRole('heading', { name: 'Private trips' })).toBeNull();
        await act(async () => { release(); });
        await screen.findByRole('heading', { name: 'Private trips' });
        expect(screen.queryByRole('heading', { name: 'Travel home' })).toBeNull();
    });
});
