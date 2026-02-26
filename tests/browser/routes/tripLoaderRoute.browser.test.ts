// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import type { IViewSettings } from '../../../types';
import { makeTrip } from '../../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  route: {
    tripId: 'trip-missing',
    pathname: '/trip/trip-missing',
    search: '',
    hash: '',
  },
  auth: {
    isAuthenticated: false,
    isLoading: false,
  },
  dbEnabled: false,
  connectivityState: 'online' as 'online' | 'degraded' | 'offline',
  decompressTrip: vi.fn(),
  getTripById: vi.fn(),
  saveTrip: vi.fn(),
  findHistoryEntryByUrl: vi.fn(),
  rememberAuthReturnPath: vi.fn(),
  useDbSync: vi.fn(),
  useConnectivityStatus: vi.fn(),
  dbGetTrip: vi.fn(),
  dbGetTripVersion: vi.fn(),
  ensureDbSession: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ tripId: mocks.route.tripId }),
  useLocation: () => ({
    pathname: mocks.route.pathname,
    search: mocks.route.search,
    hash: mocks.route.hash,
  }),
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../../hooks/useDbSync', () => ({
  useDbSync: mocks.useDbSync,
}));

vi.mock('../../../hooks/useConnectivityStatus', () => ({
  useConnectivityStatus: () => ({
    snapshot: {
      state: mocks.connectivityState,
      reason: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      isForced: false,
      forcedState: null,
    },
  }),
}));

vi.mock('../../../config/db', () => ({
  get DB_ENABLED() {
    return mocks.dbEnabled;
  },
}));

vi.mock('../../../services/storageService', () => ({
  getTripById: mocks.getTripById,
  saveTrip: mocks.saveTrip,
}));

vi.mock('../../../services/historyService', () => ({
  findHistoryEntryByUrl: mocks.findHistoryEntryByUrl,
}));

vi.mock('../../../services/authNavigationService', () => ({
  buildPathFromLocationParts: ({ pathname, search, hash }: { pathname: string; search: string; hash: string }) => `${pathname}${search}${hash}`,
  rememberAuthReturnPath: mocks.rememberAuthReturnPath,
}));

vi.mock('../../../services/dbApi', () => ({
  dbGetTrip: mocks.dbGetTrip,
  dbGetTripVersion: mocks.dbGetTripVersion,
  ensureDbSession: mocks.ensureDbSession,
}));

vi.mock('../../../utils', () => ({
  buildTripUrl: (tripId: string, versionId?: string | null) => (versionId ? `/trip/${tripId}?v=${versionId}` : `/trip/${tripId}`),
  decompressTrip: mocks.decompressTrip,
  isUuid: (value?: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f-]+$/i.test(value)),
}));

vi.mock('../../../components/TripView', () => ({
  TripView: () => null,
}));

import { TripLoaderRoute } from '../../../routes/TripLoaderRoute';

const makeRouteProps = () => ({
  trip: null,
  onTripLoaded: vi.fn(),
  onUpdateTrip: vi.fn(),
  onCommitState: vi.fn(),
  onOpenManager: vi.fn(),
  onOpenSettings: vi.fn(),
  appLanguage: 'en' as const,
  onViewSettingsChange: vi.fn(),
  onLanguageLoaded: vi.fn(),
});

describe('routes/TripLoaderRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.tripId = 'trip-missing';
    mocks.route.pathname = '/trip/trip-missing';
    mocks.route.search = '';
    mocks.route.hash = '';
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
    mocks.dbEnabled = false;
    mocks.connectivityState = 'online';
    mocks.decompressTrip.mockReturnValue(null);
    mocks.getTripById.mockReturnValue(undefined);
    mocks.findHistoryEntryByUrl.mockReturnValue(null);
    mocks.dbGetTripVersion.mockResolvedValue(null);
    mocks.dbGetTrip.mockResolvedValue(null);
    mocks.ensureDbSession.mockResolvedValue(null);
  });

  it('navigates to create-trip when trip cannot be loaded and db is disabled', async () => {
    const props = makeRouteProps();

    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/create-trip', { replace: true });
    });
    expect(mocks.rememberAuthReturnPath).not.toHaveBeenCalled();
  });

  it('loads decompressed shared state and preserves local favorite metadata', async () => {
    mocks.route.tripId = 'compressed-state';
    mocks.route.pathname = '/trip/compressed-state';
    const sharedView: IViewSettings = {
      layoutMode: 'vertical',
      timelineView: 'vertical',
      mapStyle: 'clean',
      routeMode: 'realistic',
      showCityNames: true,
      zoomLevel: 1.5,
      sidebarWidth: 520,
      timelineHeight: 300,
    };
    const sharedTrip = makeTrip({
      id: 'trip-shared',
      title: 'Shared trip',
      isFavorite: false,
      defaultView: sharedView,
    });
    const localTrip = makeTrip({
      id: 'trip-shared',
      isFavorite: true,
    });

    mocks.decompressTrip.mockReturnValue({
      trip: sharedTrip,
      view: sharedView,
    });
    mocks.getTripById.mockReturnValue(localTrip);

    const props = makeRouteProps();

    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledTimes(1);
    });

    const [loadedTrip, loadedView] = props.onTripLoaded.mock.calls[0];
    expect(loadedTrip.id).toBe('trip-shared');
    expect(loadedTrip.isFavorite).toBe(true);
    expect(loadedView).toEqual(sharedView);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('loads local trip immediately when connectivity is offline', async () => {
    mocks.dbEnabled = true;
    mocks.connectivityState = 'offline';
    mocks.route.tripId = 'trip-local-offline';
    mocks.route.pathname = '/trip/trip-local-offline';
    const localTrip = makeTrip({ id: 'trip-local-offline', title: 'Local offline trip' });
    mocks.getTripById.mockReturnValue(localTrip);

    const props = makeRouteProps();
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(localTrip, localTrip.defaultView);
    });
    expect(mocks.dbGetTrip).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalledWith('/share-unavailable?reason=offline', { replace: true });
  });

  it('redirects to offline fallback when trip is missing and connectivity is offline', async () => {
    mocks.dbEnabled = true;
    mocks.connectivityState = 'offline';
    mocks.route.tripId = 'trip-missing-offline';
    mocks.route.pathname = '/trip/trip-missing-offline';
    mocks.getTripById.mockReturnValue(undefined);

    const props = makeRouteProps();
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/share-unavailable?reason=offline', { replace: true });
    });
    expect(props.onTripLoaded).not.toHaveBeenCalled();
  });

  it('refreshes from DB after reconnect when newer data is available', async () => {
    mocks.dbEnabled = true;
    mocks.route.tripId = 'trip-reconnect';
    mocks.route.pathname = '/trip/trip-reconnect';
    const localTrip = makeTrip({ id: 'trip-reconnect', title: 'Local copy', updatedAt: 1000 });
    const dbTrip = makeTrip({ id: 'trip-reconnect', title: 'DB copy', updatedAt: 2000 });
    mocks.getTripById.mockReturnValue(localTrip);
    mocks.dbGetTrip.mockResolvedValue({
      trip: dbTrip,
      view: dbTrip.defaultView,
      access: {
        source: 'owner',
        ownerId: 'user-1',
        ownerEmail: 'owner@example.com',
        canAdminWrite: false,
        updatedAtIso: null,
      },
    });

    mocks.connectivityState = 'offline';
    const props = makeRouteProps();
    const view = render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(localTrip, localTrip.defaultView);
    });

    mocks.connectivityState = 'online';
    view.rerender(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(dbTrip, dbTrip.defaultView);
    });
  });
});
