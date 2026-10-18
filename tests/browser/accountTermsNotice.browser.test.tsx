// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from '../helpers/routerHarness';
const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: true, isLoading: false, session: { user: { id: 'user-a' } }, access: null as any, logout: vi.fn() }, track: vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'de', resolvedLanguage: 'de' } }) }));
vi.mock('../../services/analyticsService', () => ({ trackEvent: mocks.track, getAnalyticsDebugAttributes: () => ({}) }));
vi.mock('../../features/auth/useAccountLanguageSync', () => ({ useAccountLanguageSync: () => {} }));
import AccountTermsNotice from '../../features/auth/AccountTermsNotice';
import { AuthRoutingBoundary } from '../../features/auth/AuthRoutingBoundary';
function LocationProbe() { const location = useLocation(); return <output>{location.pathname}{location.search}{location.hash}</output>; }
const active = { userId: 'user-a', isAnonymous: false, accountStatus: 'active', role: 'user', termsNoticeRequired: true, termsCurrentVersion: '2026-10' };
afterEach(cleanup);
beforeEach(() => { mocks.auth.isAuthenticated = true; mocks.auth.access = { ...active }; mocks.auth.logout.mockReset(); });
describe('encapsulated account legal notices', () => {
    it('dismisses only the current account/version and shows a newer version', async () => {
        const tree = () => <MemoryRouter initialEntries={['/de/features']}><AccountTermsNotice /></MemoryRouter>;
        const view = render(tree());
        fireEvent.click(await screen.findByText('termsPage.globalDismissAction'));
        expect(screen.queryByText('termsPage.globalInformTitle')).toBeNull();
        mocks.auth.access = { ...active, termsCurrentVersion: '2026-11' };
        view.rerender(tree());
        expect(await screen.findByText('termsPage.globalInformTitle')).toBeVisible();
    });
    it('reviews an informational update using native localized navigation', async () => {
        render(<MemoryRouter initialEntries={['/de/features']}><AccountTermsNotice /><LocationProbe /></MemoryRouter>);
        fireEvent.click(await screen.findByText('termsPage.globalReviewAction'));
        expect(await screen.findByText('/de/terms?notice=updated')).toBeVisible();
    });
    it('requires acceptance without a dismiss action on public pages and keeps the return URL', async () => {
        mocks.auth.access = { ...active, termsAcceptanceRequired: true };
        render(<MemoryRouter initialEntries={['/de/features?source=nav#details']}><AccountTermsNotice /><LocationProbe /></MemoryRouter>);
        fireEvent.click(await screen.findByText('termsPage.globalReviewAction'));
        expect(screen.queryByText('termsPage.globalDismissAction')).toBeNull();
        expect(await screen.findByText('/de/terms?accept=required&next=%2Fde%2Ffeatures%3Fsource%3Dnav%23details')).toBeVisible();
    });
    it('revokes disabled accounts even on login so login cannot bounce into a protected route', async () => {
        mocks.auth.access = { ...active, accountStatus: 'disabled' };
        mocks.auth.isAuthenticated = false; // Actual AuthContext contract for disabled accounts.
        mocks.auth.logout.mockResolvedValue(undefined);
        render(<MemoryRouter initialEntries={['/de/login']}><AuthRoutingBoundary><p>Account child</p></AuthRoutingBoundary><LocationProbe /></MemoryRouter>);
        await waitFor(() => expect(mocks.auth.logout).toHaveBeenCalledOnce());
        expect(await screen.findByText('/de/login')).toBeVisible();
        expect(screen.queryByText('Account child')).toBeNull();
    });
});
