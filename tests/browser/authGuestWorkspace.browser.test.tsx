// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from '../helpers/routerHarness';
const mocks = vi.hoisted(() => ({ access: vi.fn(), onAuthChange: null as null | ((event: string, session: any) => void) }));
vi.mock('../../services/supabaseClient', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('../../services/authService', () => ({ getCurrentAccessContext: mocks.access, subscribeToAuthState: (callback: typeof mocks.onAuthChange) => { mocks.onAuthChange = callback; return () => { mocks.onAuthChange = null; }; } }));
vi.mock('../../features/auth/useAccountLanguageSync', () => ({ useAccountLanguageSync: () => {} }));
vi.mock('../../components/bootstrap/MarketingRouteLoadingShell', () => ({ MarketingRouteLoadingShell: () => <p>Resolving account</p> }));
import { AuthProvider, useAuthContext } from '../../contexts/AuthContext';
import { AuthRoutingBoundary } from '../../features/auth/AuthRoutingBoundary';
function Workspace() {
    const [title, setTitle] = useState('Draft itinerary');
    const [open, setOpen] = useState(false);
    return <><input aria-label="Trip title" value={title} onChange={event => setTitle(event.target.value)} /><button onClick={() => setOpen(true)}>Trip details</button>{open && <div role="dialog">Open trip details</div>}</>;
}
function LoadingProbe() { return <output data-testid="loading">{String(useAuthContext().isLoading)}</output>; }
afterEach(cleanup);
it.each(['/trip/encoded-itinerary', '/create-trip/wizard'])('preserves the visited workspace during anonymous session creation on %s', async path => {
    mocks.access.mockReset();
    render(<MemoryRouter initialEntries={[path]}><AuthProvider><LoadingProbe /><AuthRoutingBoundary><Workspace /></AuthRoutingBoundary></AuthProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Trip title' }), { target: { value: 'My edited itinerary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trip details' }));
    const workspace = screen.getByRole('textbox', { name: 'Trip title' });
    let finish!: (access: any) => void;
    mocks.access.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => { mocks.onAuthChange?.('SIGNED_IN', { user: { id: 'new-visitor', is_anonymous: true, app_metadata: { provider: 'anonymous' } } }); });
    await waitFor(() => expect(mocks.access).toHaveBeenCalledOnce());
    expect(screen.getByRole('textbox', { name: 'Trip title' })).toBe(workspace);
    expect(workspace).toHaveValue('My edited itinerary');
    expect(screen.getByRole('dialog')).toHaveTextContent('Open trip details');
    await act(async () => { finish({ userId: 'new-visitor', role: 'user', accountStatus: 'active', isAnonymous: true }); });
    expect(screen.getByRole('textbox', { name: 'Trip title' })).toBe(workspace);
    expect(workspace).toHaveValue('My edited itinerary');
    expect(screen.getByRole('dialog')).toBeVisible();
});
