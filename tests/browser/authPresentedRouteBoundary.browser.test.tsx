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
import { hydrate } from '@tanstack/react-router/ssr/client';
import { renderToString } from 'react-dom/server';
import { AuthRoutingBoundary } from '../../features/auth/AuthRoutingBoundary';
afterEach(() => { cleanup(); delete (window as any).$_TSR; });
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
    it('leaves native pending boundaries intact when hydrating a masked offline tool entry', async () => {
        const root = createRootRoute({ component: () => <AuthRoutingBoundary><Outlet /></AuthRoutingBoundary> });
        const tool = createRoute({ getParentRoute: () => root, path: '/create-trip', ssr: false,
            pendingComponent: () => <p>Native route pending</p>, component: () => <h1>Create trip</h1> });
        const router = createRouter({ routeTree: root.addChildren([tool]), history: createMemoryHistory({ initialEntries: ['/create-trip'] }) });
        (window as any).$_TSR = { buffer: [], router: { matches: [
            { i: router.matchRoutes('/create-trip')[0]!.id.replaceAll('/', '#'), s: 'success', ssr: true, u: 0 },
        ] } };
        await hydrate(router);
        expect(router.state.matches.at(-1)?.status).toBe('pending');
        const html = renderToString(<Auth.Provider value={{ isLoading: true, isAuthenticated: false, logout: vi.fn() }}><RouterProvider router={router} /></Auth.Provider>);
        expect(html).toContain('Native route pending');
        expect(html).not.toContain('Resolving account');
        expect(html).toContain('<!--$-->');
    });
    it('preserves the native presentation when the route resolves before initial account discovery', async () => {
        const f = fixture('/example/preview', '/');
        const auth = { isLoading: true, isAuthenticated: false, logout: vi.fn() };
        await act(async () => { await f.router.load(); render(<Auth.Provider value={auth}><RouterProvider router={f.router} /></Auth.Provider>); });
        expect(screen.getByRole('heading', { name: 'Example ready' })).toBeVisible();
        expect(screen.queryByText('Resolving account')).toBeNull();
    });
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
