// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { useLocation, useNavigate } from '../../app/navigation';
import { parseRouteSearch, stringifyRouteSearch } from '../../app/routing/search';
import { useRouteSearchWriter, type RouteSearchWriter } from '../../app/routing/useRouteSearchWriter';
import { tripRouteSearchSchema, useTripRouteSearch } from '../../features/trips/tripRouteSearch';
import { createTripRouteSearchSchema } from '../../features/trips/createTripRouteSearch';
import { tripLoaderDeps } from '../../features/trips/routeData';

afterEach(cleanup);

/** The trip and create areas as the app declares them: layout schema, version-only loader deps, staleTime 0. */
function buildRouter({ initial, TripPage, CreatePage, tripLoader, profileLoader }: {
    initial: string;
    TripPage?: () => React.ReactElement | null;
    CreatePage?: () => React.ReactElement | null;
    tripLoader?: () => unknown;
    profileLoader?: () => unknown;
}) {
    const root = createRootRoute({ component: Outlet });
    const trips = createRoute({ getParentRoute: () => root, id: '_trips', validateSearch: tripRouteSearchSchema, component: Outlet });
    const trip = createRoute({
        getParentRoute: () => trips, path: '/trip/$tripId', loaderDeps: tripLoaderDeps,
        loader: tripLoader ?? (() => null), staleTime: 0, preloadStaleTime: 10_000, gcTime: 0,
        component: TripPage ?? (() => null),
    });
    const create = createRoute({ getParentRoute: () => root, id: '_create', validateSearch: createTripRouteSearchSchema, component: Outlet });
    const createPage = createRoute({ getParentRoute: () => create, path: '/{-$locale}/create-trip', component: CreatePage ?? (() => null) });
    const profile = createRoute({ getParentRoute: () => root, path: '/profile', loader: profileLoader, component: () => <h1>Profile</h1> });
    return createRouter({
        parseSearch: parseRouteSearch, stringifySearch: stringifyRouteSearch, defaultPendingMs: Infinity,
        routeTree: root.addChildren([trips.addChildren([trip]), create.addChildren([createPage]), profile]),
        history: createMemoryHistory({ initialEntries: [initial] }),
    });
}

describe('router-owned search writes', () => {
    it('replaces the query through the router, keeping path, hash, history state and the mounted page', async () => {
        const tripLoader = vi.fn(() => null);
        const mounts = vi.fn();
        let write!: RouteSearchWriter;
        function TripPage() {
            write = useRouteSearchWriter();
            const { search } = useLocation();
            const { layout, v } = useTripRouteSearch();
            React.useEffect(() => { mounts(); }, []);
            return <output data-testid="seen">{`${search}|${layout ?? '-'}|${v ?? '-'}`}</output>;
        }
        const router = buildRouter({ initial: '/trip/t1?v=ver-1&keep=me#notes', TripPage, tripLoader });
        router.history.replace('/trip/t1?v=ver-1&keep=me#notes', { usr: { from: 'library' } } as never);
        const view = render(<RouterProvider router={router} />);
        await waitFor(() => expect(view.getByTestId('seen')).toHaveTextContent('?v=ver-1&keep=me|-|ver-1'));
        const historyLength = router.history.length;
        const loaderCalls = tripLoader.mock.calls.length;

        await act(async () => { expect(write(previous => ({ ...previous, layout: 'vertical' }))).toBe(true); });

        await waitFor(() => expect(view.getByTestId('seen')).toHaveTextContent('?v=ver-1&keep=me&layout=vertical|vertical|ver-1'));
        expect(router.state.location.href).toBe('/trip/t1?v=ver-1&keep=me&layout=vertical#notes');
        expect(router.history.length).toBe(historyLength);
        expect((router.state.location.state as { usr?: unknown }).usr).toEqual({ from: 'library' });
        // Only `v` is a loader dependency: a view-setting write neither refetches nor remounts.
        expect(tripLoader).toHaveBeenCalledTimes(loaderCalls);
        expect(mounts).toHaveBeenCalledTimes(1);
    });

    it('skips a write that changes nothing, which would otherwise reload a staleTime 0 loader', async () => {
        const tripLoader = vi.fn(() => null);
        let write!: RouteSearchWriter;
        function TripPage() { write = useRouteSearchWriter(); return <p>Trip</p>; }
        const router = buildRouter({ initial: '/trip/t1?layout=vertical', TripPage, tripLoader });
        const view = render(<RouterProvider router={router} />);
        await view.findByText('Trip');
        const navigate = vi.spyOn(router, 'navigate');
        const loaderCalls = tripLoader.mock.calls.length;
        await act(async () => { write(previous => ({ ...previous, layout: 'vertical', mode: undefined })); });
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
        expect(navigate).not.toHaveBeenCalled();
        expect(tripLoader).toHaveBeenCalledTimes(loaderCalls);
    });

    it('keeps an optional locale segment when writing on a create page', async () => {
        let write!: RouteSearchWriter;
        function CreatePage() { write = useRouteSearchWriter(); return <p>Create</p>; }
        const router = buildRouter({ initial: '/de/create-trip?source=landing', CreatePage });
        const view = render(<RouterProvider router={router} />);
        await view.findByText('Create');
        await act(async () => { write(previous => ({ ...previous, prefill: 'eyJ4IjoxfQ' })); });
        await waitFor(() => expect(router.state.location.href).toBe('/de/create-trip?source=landing&prefill=eyJ4IjoxfQ'));
        await act(async () => { write(previous => ({ ...previous, prefill: undefined })); });
        await waitFor(() => expect(router.state.location.href).toBe('/de/create-trip?source=landing'));
    });

    it('drops writes from a page that is being left, so its query never lands on the next route (#586)', async () => {
        let releaseProfile!: () => void;
        const profileLoaded = new Promise<void>(resolve => { releaseProfile = resolve; });
        let write!: RouteSearchWriter;
        function TripPage() {
            write = useRouteSearchWriter();
            const navigate = useNavigate();
            return <button onClick={() => navigate('/profile')}>Profile</button>;
        }
        const router = buildRouter({ initial: '/trip/t1?v=ver-1', TripPage, profileLoader: () => profileLoaded });
        const view = render(<RouterProvider router={router} />);
        fireEvent.click(await view.findByText('Profile'));
        await waitFor(() => expect(router.latestLocation.pathname).toBe('/profile'));
        // The trip page is still mounted while the profile loads.
        expect(view.getByText('Profile')).toBeInTheDocument();
        let written = true;
        await act(async () => { written = write(previous => ({ ...previous, layout: 'vertical', mode: 'print' })); });
        expect(written).toBe(false);
        await act(async () => { releaseProfile(); await profileLoaded; });
        expect(await view.findByRole('heading', { name: 'Profile' })).toBeVisible();
        expect(router.state.location.href).toBe('/profile');
    });

    it('drops writes from the previous version while the next version loads', async () => {
        let releaseVersion!: () => void;
        const versionLoaded = new Promise<void>(resolve => { releaseVersion = resolve; });
        let write!: RouteSearchWriter;
        function TripPage() {
            write = useRouteSearchWriter();
            const navigate = useNavigate();
            return <button onClick={() => navigate('/trip/t1?v=ver-2')}>Next version</button>;
        }
        const router = buildRouter({ initial: '/trip/t1?v=ver-1', TripPage, tripLoader: () => (router.latestLocation.searchStr.includes('ver-2') ? versionLoaded : null) });
        const view = render(<RouterProvider router={router} />);
        fireEvent.click(await view.findByText('Next version'));
        await waitFor(() => expect(router.latestLocation.searchStr).toBe('?v=ver-2'));
        let written = true;
        await act(async () => { written = write(previous => ({ ...previous, v: 'ver-1', layout: 'vertical' })); });
        expect(written).toBe(false);
        await act(async () => { releaseVersion(); await versionLoaded; });
        await waitFor(() => expect(router.state.status).toBe('idle'));
        expect(router.state.location.href).toBe('/trip/t1?v=ver-2');
    });
});
