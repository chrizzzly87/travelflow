// @vitest-environment jsdom
import React from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { renderWithRouter as render } from '../helpers/renderWithRouter';
import { TripManagerProvider } from '../../contexts/TripManagerContext';
import { MemoryRouter } from '../helpers/routerHarness';
import i18n, { preloadLocaleNamespaces } from '../../i18n';
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, isAdmin: false, isLoading: true }) }));
vi.mock('../../hooks/useLoginModal', () => ({ useLoginModal: () => ({ openLoginModal: vi.fn() }) }));
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';
afterEach(cleanup);
beforeAll(async () => { await preloadLocaleNamespaces('en', ['common', 'pages']); await i18n.changeLanguage('en'); });
describe('native marketing pending boundary', () => {
    it('keeps real navigation links available without fabricated controls or auth spinners', async () => {
        const view = await render(<MemoryRouter><TripManagerProvider openTripManager={() => {}} prewarmTripManager={() => {}}><MarketingRouteLoadingShell /></TripManagerProvider></MemoryRouter>);
        const header = await screen.findByRole('banner');
        expect(within(header).getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/features');
        await userEvent.click(within(header).getByRole('button', { name: 'Account' }));
        const login = new URL(screen.getByRole('menuitem', { name: 'Login' }).getAttribute('href')!, 'https://example.test');
        expect(login.pathname).toBe('/login');
        expect(login.searchParams.get('next')).toBe('/');
        expect(screen.getByTestId('route-loading-shell')).toHaveAttribute('aria-busy', 'true');
        expect(view.container.querySelector('.tf-bone, .tf-boot-nav-skeleton, [aria-busy="true"] a')).toBeNull();
    });
});
