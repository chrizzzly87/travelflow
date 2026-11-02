// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
    auth: { isAuthenticated: false, isAnonymous: true, isLoading: false },
    location: { pathname: '/', search: '', hash: '' }, navigate: vi.fn(),
}));
vi.mock('@/app/navigation', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => mocks.location }));
vi.mock('../../services/analyticsService', () => ({ trackEvent: vi.fn() }));
vi.mock('../../components/auth/AuthModal', () => ({ AuthModal: ({ nextPath, reloadOnSuccess }: any) => <div role="dialog" data-return={nextPath} data-reload={String(reloadOnSuccess)}>Login</div> }));
import { LoginModalProvider, useLoginModalContext } from '../../contexts/LoginModalContext';
function OpenLogin({ nextPath }: { nextPath?: string }) {
    const { openLoginModal } = useLoginModalContext();
    return <button onClick={() => openLoginModal({ nextPath, source: 'test' })}>Open login</button>;
}
afterEach(cleanup);
beforeEach(() => {
    window.localStorage.clear(); vi.clearAllMocks();
    mocks.auth = { isAuthenticated: false, isAnonymous: true, isLoading: false };
    mocks.location = { pathname: '/', search: '', hash: '' };
});
describe('login destination ownership', () => {
    it('opens general sign-in for profile and resumes it natively after verified success', async () => {
        const ui = <LoginModalProvider><OpenLogin /></LoginModalProvider>;
        const { rerender } = render(ui);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Open login' }));
        expect(await screen.findByRole('dialog')).toHaveAttribute('data-return', '/profile');
        expect(screen.getByRole('dialog')).toHaveAttribute('data-reload', 'false');
        expect(mocks.navigate).not.toHaveBeenCalled();
        mocks.auth = { isAuthenticated: true, isAnonymous: false, isLoading: false };
        rerender(<LoginModalProvider><OpenLogin /></LoginModalProvider>);
        await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/profile', { replace: true }));
    });

    it('preserves the complete current trip URL and explicit creation intent', async () => {
        mocks.location = { pathname: '/trip/draft', search: '?claim=pending', hash: '#map' };
        const { rerender } = render(<LoginModalProvider><OpenLogin /></LoginModalProvider>);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Open login' }));
        expect(await screen.findByRole('dialog')).toHaveAttribute('data-return', '/trip/draft?claim=pending#map');
        rerender(<LoginModalProvider><OpenLogin nextPath="/create-trip/wizard?prefill=ready" /></LoginModalProvider>);
        await userEvent.setup().click(screen.getByRole('button', { name: 'Open login' }));
        expect(screen.getByRole('dialog')).toHaveAttribute('data-return', '/create-trip/wizard?prefill=ready');
    });
});
