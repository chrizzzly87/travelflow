// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from '../../app/navigation';

import { parseRouteSearch, stringifyRouteSearch } from '../../app/routing/search';
afterEach(cleanup);
function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const [search, setSearch] = useSearchParams();
    return <>
        <output data-testid="location">{JSON.stringify(location)}</output>
        <output data-testid="params">{JSON.stringify(params)}</output>
        <Link to="/de/blog/hello%20world?tag=a&tag=b#section" state={{ from: '/pricing' }}>Article</Link>
        <NavLink to="/de/blog">Blog</NavLink>
        <button onClick={() => navigate('/trip/taipei%20trip?x=1', { state: { trip: 'persist' } })}>Trip</button>
        <button onClick={() => navigate('/pricing', { replace: true })}>Replace</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => setSearch(previous => { previous.set('page', '2'); return previous; }, { replace: true })}>Search</button>
        <output data-testid="search">{search.getAll('tag').join(',')}</output>
    </>;
}
function setup(initial = '/pricing') {
    const root = createRootRoute({ component: Outlet });
    const routes = ['/pricing', '/trip/$tripId', '/de/blog/$slug'].map(path => createRoute({ getParentRoute: () => root, path, component: Probe }));
    const router = createRouter({ parseSearch: parseRouteSearch, stringifySearch: stringifyRouteSearch, routeTree: root.addChildren(routes), history: createMemoryHistory({ initialEntries: [initial] }) });
    const view = render(<RouterProvider router={router} />);
    return { router, view };
}
describe('TanStack navigation migration contract', () => {
    it('preserves encoded parameters, history state and replace/back behavior', async () => {
        const { router, view } = setup();
        fireEvent.click(await view.findByText('Trip', { selector: 'button' }));
        await waitFor(() => expect(view.getByTestId('params').textContent).toContain('taipei trip'));
        expect(JSON.parse(view.getByTestId('location').textContent!).state).toEqual({ trip: 'persist' });
        expect(router.state.location.searchStr).toBe('?x=1');
        fireEvent.click(view.getByText('Replace'));
        await waitFor(() => expect(router.state.location.pathname).toBe('/pricing'));
        fireEvent.click(view.getByText('Back'));
        await waitFor(() => expect(router.state.location.pathname).toBe('/pricing'));
        expect(router.history.location.state.__TSR_index).toBe(0);
    });
    it('retains repeated query values, fragments and link state across native link clicks', async () => {
        const { router, view } = setup();
        fireEvent.click(await view.findByText('Article'));
        await waitFor(() => expect(view.getByTestId('search').textContent).toBe('a,b'));
        expect(JSON.parse(view.getByTestId('location').textContent!).hash).toBe('#section');
        expect(JSON.parse(view.getByTestId('location').textContent!).state).toEqual({ from: '/pricing' });
        expect(view.getByText('Blog')).toHaveAttribute('aria-current', 'page');
        fireEvent.click(view.getByText('Search'));
        await waitFor(() => expect(router.state.location.searchStr).toContain('page=2'));
        expect(view.getByTestId('search')).toHaveTextContent('a,b');
    });
    it('matches nested native admin routes without a second route interpreter', async () => {
        const root = createRootRoute({ component: Outlet });
        const admin = createRoute({ getParentRoute: () => root, path: '/admin', component: Outlet });
        const users = createRoute({ getParentRoute: () => admin, path: 'users', component: () => <h1>Users</h1> });
        const router = createRouter({ routeTree: root.addChildren([admin.addChildren([users])]), history: createMemoryHistory({ initialEntries: ['/admin/users'] }) });
        const view = render(<RouterProvider router={router} />);
        expect(await view.findByRole('heading', { name: 'Users' })).toBeVisible();
    });
});
