// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { RouteErrorPage, isStaleChunkError } from '../../components/bootstrap/RouteErrorPage';

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/analyticsService', () => ({ trackEvent: mocks.trackEvent, getAnalyticsDebugAttributes: () => ({}) }));
afterEach(() => { cleanup(); mocks.trackEvent.mockReset(); });

const renderFailingRoute = (pathname: string, error: Error) => {
    let fail = true;
    const root = createRootRoute({ component: Outlet });
    const page = createRoute({ getParentRoute: () => root, path: '/$', component: () => { if (fail) throw error; return <h1>Recovered</h1>; } });
    const router = createRouter({ routeTree: root.addChildren([page]), defaultErrorComponent: RouteErrorPage, history: createMemoryHistory({ initialEntries: [pathname] }) });
    render(<RouterProvider router={router} />);
    return { recover: () => { fail = false; } };
};

describe('RouteErrorPage', () => {
    it('shows authored copy instead of the raw error and retries in place', async () => {
        const { recover } = renderFailingRoute('/de/blog/x', new Error('secret token abc123 at fetch https://internal'));
        expect(await screen.findByRole('heading', { name: 'routeError.title' })).toBeVisible();
        expect(document.body.textContent).not.toContain('secret token');
        expect(screen.getByRole('link', { name: 'routeError.home' })).toHaveAttribute('href', '/de');
        expect(mocks.trackEvent).toHaveBeenCalledWith('route_error__view', { kind: 'render', name: 'Error' });
        recover();
        fireEvent.click(screen.getByRole('button', { name: 'routeError.retry' }));
        expect(await screen.findByRole('heading', { name: 'Recovered' })).toBeVisible();
    });

    it('recognises chunks that a new deploy removed', () => {
        expect(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true);
        expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
        expect(isStaleChunkError(new Error('boom'))).toBe(false);
    });
});
