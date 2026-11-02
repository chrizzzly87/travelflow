// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from '../helpers/routerHarness';
const mocks = vi.hoisted(() => ({ access: vi.fn(), signOut: vi.fn(), profile: vi.fn(async () => null), onAuthChange: null as null | ((event: string, session: any) => void) }));
const session = { user: { id: 'real-user', email: 'person@example.test', app_metadata: { provider: 'email' } }, access_token: 'test-access', refresh_token: 'test-refresh' };
vi.mock('../../services/supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session } }) } } }));
vi.mock('../../services/authService', () => ({ getCurrentAccessContext: mocks.access, subscribeToAuthState: (callback: typeof mocks.onAuthChange) => { mocks.onAuthChange = callback; return () => { mocks.onAuthChange = null; }; }, signOut: mocks.signOut }));
vi.mock('../../services/profileService', () => ({ getCurrentUserProfile: mocks.profile }));
import { AuthProvider, useAuthContext } from '../../contexts/AuthContext';
function Probe() {
    const auth = useAuthContext();
    return <><output>{auth.access?.userId ?? 'signed-out'}</output><output data-testid="auth-loading">{String(auth.isLoading)}</output><button onClick={() => { void auth.refreshAccess(); }}>Refresh</button><button onClick={() => { void auth.logout(); }}>Logout</button></>;
}
afterEach(cleanup);
describe('auth access requests across session changes', () => {
    it('clears access immediately and discards an old response while remote sign-out is still pending', async () => {
        const access = { userId: 'real-user', role: 'admin', accountStatus: 'active', isAnonymous: false, tierKey: 'tier_free', entitlements: {} };
        mocks.access.mockResolvedValue(access);
        let finishSignOut!: () => void;
        mocks.signOut.mockImplementation(() => new Promise<void>(resolve => { finishSignOut = resolve; }));
        render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
        expect(await screen.findByText('real-user')).toBeVisible();
        let finishOldRequest!: (value: typeof access) => void;
        mocks.access.mockImplementationOnce(() => new Promise(resolve => { finishOldRequest = resolve; }));
        fireEvent.click(screen.getByText('Refresh'));
        await waitFor(() => expect(finishOldRequest).toBeTypeOf('function'));
        fireEvent.click(screen.getByText('Logout'));
        expect(await screen.findByText('signed-out')).toBeVisible();
        await act(async () => { finishOldRequest(access); });
        expect(screen.queryByText('real-user')).toBeNull();
        await act(async () => { finishSignOut(); });
    });
    it('discards access when sign-out arrives during the initial account request', async () => {
        let finishInitialRequest!: (value: any) => void;
        mocks.access.mockImplementationOnce(() => new Promise(resolve => { finishInitialRequest = resolve; }));
        render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
        await waitFor(() => expect(finishInitialRequest).toBeTypeOf('function'));
        expect(mocks.onAuthChange).toBeTypeOf('function');
        await act(async () => { mocks.onAuthChange?.('SIGNED_OUT', null); });
        await act(async () => { finishInitialRequest({ userId: 'old-user', isAnonymous: false }); });
        expect(await screen.findByText('signed-out')).toBeVisible();
        expect(screen.queryByText('old-user')).toBeNull();
    });
    it('does not start profile work from an account response after unmount', async () => {
        let finishInitialRequest!: (value: any) => void;
        mocks.profile.mockClear();
        mocks.access.mockImplementationOnce(() => new Promise(resolve => { finishInitialRequest = resolve; }));
        const view = render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
        await waitFor(() => expect(finishInitialRequest).toBeTypeOf('function'));
        view.unmount();
        await act(async () => { finishInitialRequest({ userId: 'unmounted-user', isAnonymous: false }); });
        expect(mocks.profile).not.toHaveBeenCalled();
        expect(mocks.onAuthChange).toBeNull();
    });

    it('clears the previous account immediately while the next account loads', async () => {
        mocks.access.mockResolvedValueOnce({ userId: 'admin-a', role: 'admin', isAnonymous: false });
        render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
        expect(await screen.findByText('admin-a')).toBeVisible();
        let finishNextRequest!: (value: any) => void;
        mocks.access.mockImplementationOnce(() => new Promise(resolve => { finishNextRequest = resolve; }));
        await act(async () => { mocks.onAuthChange?.('SIGNED_IN', { ...session, user: { ...session.user, id: 'member-b' } }); });
        expect(screen.queryByText('admin-a')).toBeNull();
        expect(screen.getByText('signed-out')).toBeVisible();
        await act(async () => { finishNextRequest({ userId: 'member-b', role: 'user', isAnonymous: false }); });
        expect(await screen.findByText('member-b')).toBeVisible();
    });

    it.each(['resolve', 'reject'])('does not let the initial request %s settle a newer account bootstrap', async (completion) => {
        let resolveInitial!: (value: any) => void;
        let rejectInitial!: (reason: Error) => void;
        let resolveNext!: (value: any) => void;
        mocks.access.mockImplementationOnce(() => new Promise((resolve, reject) => { resolveInitial = resolve; rejectInitial = reject; }));
        render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
        await waitFor(() => expect(resolveInitial).toBeTypeOf('function'));
        mocks.access.mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
        await act(async () => { mocks.onAuthChange?.('SIGNED_IN', { ...session, user: { ...session.user, id: 'member-b' } }); });
        await waitFor(() => expect(resolveNext).toBeTypeOf('function'));
        await act(async () => {
            if (completion === 'resolve') resolveInitial({ userId: 'real-user', isAnonymous: false });
            else rejectInitial(new Error('old account request failed'));
        });
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('true');
        expect(screen.queryByText('real-user')).toBeNull();
        await act(async () => { resolveNext({ userId: 'member-b', role: 'user', accountStatus: 'active', isAnonymous: false }); });
        expect(await screen.findByText('member-b')).toBeVisible();
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

    it('still blocks account data while a member is replaced by an anonymous identity', async () => {
        mocks.access.mockResolvedValue({ userId: 'real-user', role: 'user', accountStatus: 'active', isAnonymous: false });
        render(<MemoryRouter><AuthProvider><Probe /></AuthProvider></MemoryRouter>);
        expect(await screen.findByText('real-user')).toBeVisible();
        let finish!: (value: any) => void;
        mocks.access.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        await act(async () => { mocks.onAuthChange?.('SIGNED_IN', { user: { id: 'visitor', is_anonymous: true, app_metadata: { provider: 'anonymous' } } }); });
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('true');
        expect(screen.queryByText('real-user')).toBeNull();
        expect(screen.getByText('signed-out')).toBeVisible();
        await act(async () => { finish({ userId: 'visitor', role: 'user', accountStatus: 'active', isAnonymous: true }); });
        expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
    });

});
