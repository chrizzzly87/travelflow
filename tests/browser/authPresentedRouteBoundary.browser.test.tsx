// @vitest-environment jsdom
import React, { createContext, useContext } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
const Auth = createContext<any>(null);
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => useContext(Auth) }));
vi.mock('../../features/auth/useSessionRouteLifecycle', () => ({ useSessionRouteLifecycle: vi.fn() }));
vi.mock('../../features/auth/useAccountLanguageSync', () => ({ useAccountLanguageSync: vi.fn() }));
vi.mock('../../components/bootstrap/MarketingRouteLoadingShell', () => ({ MarketingRouteLoadingShell: () => <p>Resolving account</p> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
import { AuthRoutingBoundary } from '../../features/auth/AuthRoutingBoundary';
afterEach(cleanup);
function fixture(initial: string, destination: string) {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const root = createRootRoute({ component: () => <AuthRoutingBoundary><Outlet /></AuthRoutingBoundary> });
    const routes = ['/', '/profile', '/example/preview'].map(path => createRoute({ getParentRoute: () => root, path,
        loader: path === destination ? () => gate : undefined,
        component: () => <h1>{path === '/' ? 'Public home' : path === '/profile' ? 'Private workspace' : 'Example ready'}</h1> }));
    const router = createRouter({ routeTree: root.addChildren(routes), history: createMemoryHistory({ initialEntries: [initial] }), defaultPendingMs: Infinity });
    return { router, release };
}
describe('auth follows the presented route during native navigation', () => {
    it('keeps public content while an example loads and the first session is still resolving', async () => {
        const f = fixture('/', '/example/preview');
        const auth = { isLoading: true, isAuthenticated: false, logout: vi.fn() };
        let view!: ReturnType<typeof render>;
        await act(async () => { await f.router.load(); view = render(<Auth.Provider value={auth}><RouterProvider router={f.router} /></Auth.Provider>); });
        let navigation!: Promise<void>;
        act(() => { navigation = f.router.navigate({ to: '/example/$templateId', params: { templateId: 'preview' } }); });
        await waitFor(() => expect(f.router.state.status).toBe('pending'));
        try {
            expect(screen.getByRole('heading', { name: 'Public home' })).toBeVisible();
            expect(screen.queryByText('Resolving account')).toBeNull();
        } finally {
            view.rerender(<Auth.Provider value={{ ...auth, isLoading: false }}><RouterProvider router={f.router} /></Auth.Provider>);
            act(() => { f.release(); });
            await screen.findByRole('heading', { name: 'Example ready' });
            await navigation;
        }
        expect(screen.getByRole('heading', { name: 'Example ready' })).toBeVisible();
    });
    it('still clears a private presentation on account replacement while a public destination loads', async () => {
        const f = fixture('/profile', '/');
        const auth = { isLoading: false, isAuthenticated: true, logout: vi.fn() };
        let view!: ReturnType<typeof render>;
        await act(async () => { await f.router.load(); view = render(<Auth.Provider value={auth}><RouterProvider router={f.router} /></Auth.Provider>); });
        let navigation!: Promise<void>;
        act(() => { navigation = f.router.navigate({ to: '/' }); });
        await waitFor(() => expect(f.router.state.status).toBe('pending'));
        view.rerender(<Auth.Provider value={{ ...auth, isLoading: true }}><RouterProvider router={f.router} /></Auth.Provider>);
        try {
            expect(screen.queryByRole('heading', { name: 'Private workspace' })).toBeNull();
            expect(screen.getByText('Resolving account')).toBeVisible();
        } finally {
            view.rerender(<Auth.Provider value={{ ...auth, isLoading: false }}><RouterProvider router={f.router} /></Auth.Provider>);
            act(() => { f.release(); });
            await screen.findByRole('heading', { name: 'Public home' });
            await navigation;
        }
        expect(screen.getByRole('heading', { name: 'Public home' })).toBeVisible();
    });
});
