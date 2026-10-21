// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  openLoginModal: vi.fn(),
  trackEvent: vi.fn(),
  useDbSync: vi.fn(),
  connectivity: vi.fn(),
  sync: vi.fn(),
  retrySyncNow: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../hooks/useLoginModal', () => ({
  useLoginModal: () => ({ openLoginModal: mocks.openLoginModal, closeLoginModal: vi.fn(), isLoginModalOpen: false }),
}));
vi.mock('../../hooks/useDbSync', () => ({ useDbSync: mocks.useDbSync }));
vi.mock('../../hooks/useConnectivityStatus', () => ({
  useConnectivityStatus: () => ({ snapshot: mocks.connectivity(), setOverride: vi.fn(), clearOverride: vi.fn() }),
}));
vi.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    snapshot: mocks.sync(),
    retrySyncNow: mocks.retrySyncNow,
    syncQueuedTripsNow: vi.fn(),
  }),
}));
vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
  getAnalyticsDebugAttributes: () => ({}),
}));

// The list itself and the site chrome have their own tests; stub them so this
// file is about what the start page explains to the visitor.
vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('header', null, 'site-header'),
}));
vi.mock('../../components/TripManager', () => ({
  TripManager: () => React.createElement('div', { 'data-testid': 'trip-manager' }, 'trip-manager'),
}));
vi.mock('../../components/ConnectivityStatusBanner', () => ({
  ConnectivityStatusBanner: (props: { connectivity: { state: string } }) =>
    React.createElement('div', { 'data-testid': 'connectivity-banner' }, props.connectivity.state),
}));

import { TripsRoute } from '../../routes/TripsRoute';

const ONLINE = { state: 'online', reason: null };
const IDLE_SYNC = { isSyncing: false, pendingCount: 0, failedCount: 0 };

describe('routes/TripsRoute signed-out notice', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectivity.mockReturnValue(ONLINE);
    mocks.sync.mockReturnValue(IDLE_SYNC);
  });

  const renderRoute = () => render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/trips?source=pwa'] },
      React.createElement(TripsRoute, {
        appLanguage: 'en',
        onAppLanguageLoaded: vi.fn(),
        onTripLoaded: vi.fn(),
      })
    )
  );

  it('explains an empty list when the visitor is signed out', async () => {
    // The reported confusion: installing to the iOS home screen creates a fresh
    // storage jar, so the app opens signed out and shows no account trips. A
    // bare empty list gives the visitor nothing to act on.
    mocks.useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderRoute();

    await waitFor(() => {
      expect(screen.getByTestId('trips-signed-out-notice')).toBeTruthy();
    });
    expect(screen.getByTestId('trips-sign-in-button')).toBeTruthy();
  });

  it('stays quiet when the visitor is signed in', async () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderRoute();

    await waitFor(() => {
      expect(screen.getByTestId('trip-manager')).toBeTruthy();
    });
    expect(screen.queryByTestId('trips-signed-out-notice')).toBeNull();
  });

  it('does not accuse a visitor of being signed out while auth is still loading', async () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    renderRoute();

    await waitFor(() => {
      expect(screen.getByTestId('trip-manager')).toBeTruthy();
    });
    expect(screen.queryByTestId('trips-signed-out-notice')).toBeNull();
  });

  it('opens the login modal and returns to /trips afterwards', async () => {
    const user = userEvent.setup();
    mocks.useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderRoute();

    await waitFor(() => {
      expect(screen.getByTestId('trips-signed-out-notice')).toBeTruthy();
    });

    await user.click(screen.getByTestId('trips-sign-in-button'));

    expect(mocks.openLoginModal).toHaveBeenCalledWith({
      nextPath: '/trips',
      source: 'trips_start_page',
    });
  });

  it('always renders the connectivity banner so an offline list explains itself', async () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mocks.connectivity.mockReturnValue({ state: 'offline', reason: 'browser_offline' });
    renderRoute();

    await waitFor(() => {
      expect(screen.getByTestId('connectivity-banner')).toBeTruthy();
    });
    expect(screen.getByTestId('connectivity-banner').textContent).toBe('offline');
  });
});
