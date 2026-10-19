// @vitest-environment jsdom
import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    session: { user: { id: 'member', email: 'member@example.test', app_metadata: { provider: 'email' } }, access_token: 'test', refresh_token: 'test' },
    profile: vi.fn(async () => null),
    access: { userId: 'member', accountStatus: 'active', role: 'user', isAnonymous: false, entitlements: {} },
}));
vi.mock('../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => ({ pathname: '/profile', search: '', hash: '' }) }));
vi.mock('../../services/supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: mocks.session } }) } } }));
vi.mock('../../services/authService', () => ({ getCurrentAccessContext: async () => mocks.access, subscribeToAuthState: () => () => {} }));
vi.mock('../../services/profileService', () => ({ getCurrentUserProfile: mocks.profile }));
import { AuthProvider, useAuthContext } from '../../contexts/AuthContext';

describe('initial verified session during document hydration', () => {
    it('does not interrupt an unfinished route boundary when session/access/profile resolve', async () => {
        let suspended = false;
        let release!: () => void;
        const waiting = new Promise<void>(resolve => { release = resolve; });
        function PendingPage() {
            const auth = useAuthContext();
            if (suspended) throw waiting;
            return <p>{auth.access?.userId ?? 'public'}</p>;
        }
        function Probe() {
            const auth = useAuthContext();
            return <output data-loading={String(auth.isLoading)} />;
        }
        const tree = <AuthProvider><Probe /><Suspense fallback={<p>Loading</p>}><PendingPage /></Suspense></AuthProvider>;
        const container = document.createElement('div');
        container.innerHTML = renderToString(tree);
        document.body.appendChild(container);
        suspended = true;
        const recoverable = vi.fn();
        let root: Root | undefined;
        try {
            await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: recoverable }); });
            await waitFor(() => expect(mocks.profile).toHaveBeenCalled());
            await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
            await act(async () => { suspended = false; release(); });
            expect(container).toHaveTextContent('member');
            expect(container.querySelector('output')).toHaveAttribute('data-loading', 'false');
            expect(recoverable).not.toHaveBeenCalled();
        } finally {
            suspended = false; release();
            await act(async () => root?.unmount());
            container.remove();
        }
    });
});
