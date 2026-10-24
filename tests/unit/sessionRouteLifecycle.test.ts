// @vitest-environment jsdom
import { createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { describe, expect, it, vi } from 'vitest';
import { getRouteSessionIdentity, refreshSessionRoutes } from '../../features/auth/sessionRouteLifecycle';

function fixture(initial = '/pricing') {
    let role = 'admin';
    const rootLoad = vi.fn();
    const publicLoad = vi.fn(() => ({ label: 'Pricing' }));
    type PrivateLoaderData = { role: string };
    // Typed with the loader context it reads so tests can swap in an abortable implementation.
    const privateLoad = vi.fn((_ctx: { abortController: AbortController }): PrivateLoaderData | Promise<PrivateLoaderData> => ({ role }));
    const root = createRootRoute({ beforeLoad: rootLoad });
    const pricing = createRoute({ getParentRoute: () => root, path: '/pricing', loader: publicLoad });
    const admin = createRoute({ getParentRoute: () => root, id: '_admin', staticData: { sessionBound: true } });
    const users = createRoute({ getParentRoute: () => admin, path: '/admin/users', loader: privateLoad });
    const trips = createRoute({ getParentRoute: () => root, id: '_trips' });
    const owned = createRoute({ getParentRoute: () => trips, path: '/trip/$tripId', staticData: { sessionBound: true }, loader: privateLoad });
    const shared = createRoute({ getParentRoute: () => trips, path: '/s/$token', staticData: { sessionBound: true }, loader: privateLoad });
    const example = createRoute({ getParentRoute: () => trips, path: '/example/$templateId', loader: publicLoad });
    const another = createRoute({ getParentRoute: () => root, path: '/new-private-area', staticData: { sessionBound: true }, loader: privateLoad });
    const router = createRouter({ routeTree: root.addChildren([pricing, another, admin.addChildren([users]), trips.addChildren([owned, shared, example])]), history: createMemoryHistory({ initialEntries: [initial] }), defaultPreloadStaleTime: 30000 });
    return { router, privateRoute: users, rootLoad, publicLoad, privateLoad, role: (next: string) => { role = next; } };
}

describe('session-owned native route lifecycle', () => {
    it('excludes loading/token changes but includes account binding and anonymous conversion', () => {
        const base = { session: { user: { id: 'member' } }, access: { userId: 'member', role: 'user', accountStatus: 'active', isAnonymous: true } } as any;
        expect(getRouteSessionIdentity({ ...base, isLoading: true })).toBe(getRouteSessionIdentity({ ...base, isLoading: false }));
        expect(getRouteSessionIdentity({ ...base, access: { ...base.access, isAnonymous: false } })).not.toBe(getRouteSessionIdentity(base));
        expect(getRouteSessionIdentity({ ...base, session: { user: { id: 'another' } } })).not.toBe(getRouteSessionIdentity(base));
    });
    it.each(['/pricing', '/example/sample'])('does not reload public route work on %s', async (path) => {
        const f = fixture(path); await f.router.load();
        await refreshSessionRoutes(f.router);
        expect(f.rootLoad).toHaveBeenCalledTimes(1);
        expect(f.publicLoad).toHaveBeenCalledTimes(1);
    });
    it('retires cached private permissions while leaving the active public page alone', async () => {
        const f = fixture(); await f.router.load();
        await f.router.preloadRoute({ to: '/admin/users' });
        const previousRootCalls = f.rootLoad.mock.calls.length;
        f.role('member'); await refreshSessionRoutes(f.router);
        expect(f.rootLoad).toHaveBeenCalledTimes(previousRootCalls);
        await f.router.preloadRoute({ to: '/admin/users' });
        expect(f.privateLoad).toHaveBeenCalledTimes(2);
        await f.router.navigate({ to: '/admin/users' });
        expect(f.router.state.matches.at(-1)?.loaderData).toEqual({ role: 'member' });
    });
    it('aborts a private preload without reloading the current public page', async () => {
        const f = fixture(); await f.router.load();
        let started!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        const aborted = vi.fn();
        f.privateLoad.mockImplementation(({ abortController }) => new Promise(resolve => {
            started();
            abortController.signal.addEventListener('abort', () => { aborted(); resolve({ role: 'discarded' }); }, { once: true });
        }));
        const preload = f.router.preloadRoute({ to: '/admin/users' });
        await ready;
        const rootCalls = f.rootLoad.mock.calls.length;
        await refreshSessionRoutes(f.router);
        await preload;
        expect(aborted).toHaveBeenCalledTimes(1);
        expect(f.rootLoad).toHaveBeenCalledTimes(rootCalls);
        expect(f.router.state.location.pathname).toBe('/pricing');
    });
    it('refreshes a private navigation already in progress from a public page', async () => {
        const f = fixture(); await f.router.load();
        let started!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        f.privateLoad.mockImplementationOnce(({ abortController }) => new Promise(resolve => {
            started();
            abortController.signal.addEventListener('abort', () => resolve({ role: 'discarded' }), { once: true });
        })).mockImplementation(() => ({ role: 'member' }));
        const navigation = f.router.navigate({ to: '/admin/users' });
        await ready;
        await refreshSessionRoutes(f.router);
        await navigation;
        expect(f.router.state.location.pathname).toBe('/admin/users');
        expect(f.router.state.matches.at(-1)?.loaderData).toEqual({ role: 'member' });
    });
    it.each(['/admin/users', '/trip/owned', '/s/shared', '/new-private-area'])('refreshes session-derived permissions on %s', async (path) => {
        const f = fixture(path); await f.router.load();
        expect(f.router.state.matches.at(-1)?.loaderData).toEqual({ role: 'admin' });
        f.role('member'); await refreshSessionRoutes(f.router);
        expect(f.privateLoad).toHaveBeenCalledTimes(2);
        expect(f.router.state.matches.at(-1)?.loaderData).toEqual({ role: 'member' });
    });
});
