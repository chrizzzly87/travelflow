// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { RouteNavigationFeedback } from '../../app/routing/RouteNavigationFeedback';
import { NavLink } from '../../app/navigation';

afterEach(cleanup);
function fixture() {
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const root = createRootRoute({ component: () => <><RouteNavigationFeedback /><NavLink to="/" end className={({ isActive }: any) => isActive ? 'active' : ''}>Home</NavLink><NavLink to="/features" className={({ isActive, isPending }: any) => `${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}`}>Features</NavLink><Outlet /></> });
    const home = createRoute({ getParentRoute: () => root, path: '/', component: () => <h1>Current page</h1> });
    const features = createRoute({ getParentRoute: () => root, path: '/features', loader: () => blocked, component: () => <h1>Next page</h1> });
    const router = createRouter({ routeTree: root.addChildren([home, features]), history: createMemoryHistory({ initialEntries: ['/'] }), defaultPendingMs: Infinity });
    return { router, release };
}
describe('native navigation feedback', () => {
    it('highlights the requested destination and exposes pending before a blocked loader completes', async () => {
        const f = fixture();
        await act(async () => { await f.router.load(); render(<RouterProvider router={f.router} />); });
        fireEvent.click(screen.getByRole('link', { name: 'Features' }));
        await waitFor(() => expect(screen.getByRole('link', { name: 'Features' })).toHaveClass('active', 'pending'));
        expect(screen.getByRole('heading', { name: 'Current page' })).toBeVisible();
        expect(screen.getByTestId('route-navigation-progress')).toHaveAttribute('data-pending', 'true');
        expect(screen.getByRole('link', { name: 'Features' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Home' })).not.toHaveClass('active');
        await act(async () => { f.release(); });
        await screen.findByRole('heading', { name: 'Next page' });
        expect(screen.getByRole('link', { name: 'Features' })).not.toHaveClass('pending');
        expect(screen.getByTestId('route-navigation-progress')).not.toHaveAttribute('data-pending');
    });
    it('does not signal a preload and clears a superseded navigation', async () => {
        const f = fixture();
        await act(async () => { await f.router.load(); render(<RouterProvider router={f.router} />); });
        const preload = f.router.preloadRoute({ to: '/features' });
        expect(screen.getByTestId('route-navigation-progress')).not.toHaveAttribute('data-pending');
        expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('active');
        fireEvent.click(screen.getByRole('link', { name: 'Features' }));
        await waitFor(() => expect(screen.getByTestId('route-navigation-progress')).toHaveAttribute('data-pending'));
        act(() => { void f.router.navigate({ to: '/' }); });
        await waitFor(() => expect(screen.getByTestId('route-navigation-progress')).not.toHaveAttribute('data-pending'));
        expect(screen.getByRole('link', { name: 'Home' })).toHaveClass('active');
        expect(screen.getByTestId('route-navigation-progress')).not.toHaveAttribute('data-pending');
        await act(async () => { f.release(); await preload; });
        expect(f.router.state.location.pathname).toBe('/');
    });
    it('keeps modified clicks under native browser ownership', async () => {
        const f = fixture();
        await act(async () => { await f.router.load(); render(<RouterProvider router={f.router} />); });
        fireEvent.click(screen.getByRole('link', { name: 'Features' }), { ctrlKey: true });
        expect(f.router.state.location.pathname).toBe('/');
        expect(screen.getByTestId('route-navigation-progress')).not.toHaveAttribute('data-pending');
        f.release();
    });

});
