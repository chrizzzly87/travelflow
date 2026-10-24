// @vitest-environment jsdom
import React from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithRouter as render } from '../helpers/renderWithRouter';
import { TripManagerProvider } from '../../contexts/TripManagerContext';
import { createRootRouteWithContext, createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import i18n, { preloadLocaleNamespaces } from '../../i18n';
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, isAdmin: false, isLoading: true }) }));
const openLoginModal = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useLoginModal', () => ({ useLoginModal: () => ({ openLoginModal }) }));
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';
afterEach(cleanup);
beforeAll(async () => { await preloadLocaleNamespaces('en', ['common', 'pages']); await i18n.changeLanguage('en'); });
describe('native marketing pending boundary', () => {
    it('keeps real navigation links available without fabricated controls or auth spinners', async () => {
        const root = createRootRouteWithContext<{ i18n: typeof i18n }>()({ component: () => <TripManagerProvider openTripManager={() => {}} prewarmTripManager={() => {}}><MarketingRouteLoadingShell /></TripManagerProvider> });
        const router = createRouter({ routeTree: root, context: { i18n }, history: createMemoryHistory({ initialEntries: ['/'] }) });
        const view = await render(<RouterProvider router={router} />);
        const header = await screen.findByRole('banner');
        expect(within(header).getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/features');
        await userEvent.click(within(header).getByRole('button', { name: 'Account' }));
        expect(openLoginModal).toHaveBeenCalledWith(expect.objectContaining({ nextPath: '/profile', reloadOnSuccess: false }));
        expect(screen.queryByRole('menu')).toBeNull();
        expect(screen.getByTestId('route-loading-shell')).toHaveAttribute('aria-busy', 'true');
        expect(view.container.querySelector('.tf-bone, .tf-boot-nav-skeleton, [aria-busy="true"] a')).toBeNull();
        expect(screen.getByTestId('route-loading-shell').children).toHaveLength(0);
    });
});
