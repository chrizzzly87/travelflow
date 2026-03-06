// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

import type { IViewSettings } from '../../../types';
import { makeTravelItem, makeTrip } from '../../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  dbEnabled: false,
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
  connectivityState: 'online' as 'online' | 'degraded' | 'offline',
  decompressTrip: vi.fn(),
  getTripById: vi.fn(),
  saveTrip: vi.fn(),
  findHistoryEntryByUrl: vi.fn(),
  rememberAuthReturnPath: vi.fn(),
  useDbSync: vi.fn(),
  dbGetTrip: vi.fn(),
  dbGetTripVersion: vi.fn(),
  renderedTripViewProps: null as Record<string, unknown> | null,
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
}));

vi.mock('../../../utils', () => ({
  buildTripUrl: (tripId: string, versionId?: string | null) => (versionId ? `/trip/${tripId}?v=${versionId}` : `/trip/${tripId}`),
  decompressTrip: mocks.decompressTrip,
  isUuid: (value?: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f-]+$/i.test(value)),
}));

vi.mock('../../../components/TripView', () => ({
  TripView: (props: Record<string, unknown>) => {
    mocks.renderedTripViewProps = props;
    return null;
  },
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
    mocks.dbEnabled = false;
    mocks.route.tripId = 'trip-missing';
    mocks.route.pathname = '/trip/trip-missing';
    mocks.route.search = '';
    mocks.route.hash = '';
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
    mocks.connectivityState = 'online';
    mocks.decompressTrip.mockReturnValue(null);
    mocks.getTripById.mockReturnValue(undefined);
    mocks.findHistoryEntryByUrl.mockReturnValue(null);
    mocks.dbGetTripVersion.mockResolvedValue(null);
    mocks.dbGetTrip.mockResolvedValue(null);
    mocks.renderedTripViewProps = null;
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

  it('does not change hook order when the trip prop appears after initial null render', async () => {
    const resolvedTrip = makeTrip({ id: 'trip-late-load', title: 'Late load trip' });
    const props = makeRouteProps();
    const view = render(React.createElement(TripLoaderRoute, props));

    expect(mocks.renderedTripViewProps).toBeNull();
    expect(() => {
      view.rerender(React.createElement(TripLoaderRoute, {
        ...props,
        trip: resolvedTrip,
      }));
    }).not.toThrow();

    await waitFor(() => {
      expect(mocks.renderedTripViewProps?.trip).toEqual(resolvedTrip);
    });
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

  it('normalizes legacy transport modes when loading local trips', async () => {
    mocks.dbEnabled = true;
    mocks.connectivityState = 'offline';
    mocks.route.tripId = 'trip-local-legacy';
    mocks.route.pathname = '/trip/trip-local-legacy';
    const legacyTransportItem = {
      ...makeTravelItem('travel-legacy', 1, 'Rail segment'),
      transportMode: 'rail' as any,
      routeDistanceKm: 420,
      routeDurationHours: 6.5,
    };
    const localTrip = makeTrip({
      id: 'trip-local-legacy',
      title: 'Legacy trip',
      items: [legacyTransportItem],
    });
    mocks.getTripById.mockReturnValue(localTrip);

    const props = makeRouteProps();
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledTimes(1);
    });

    const [loadedTrip] = props.onTripLoaded.mock.calls[0];
    const loadedTravel = loadedTrip.items.find((item: any) => item.id === 'travel-legacy');

    expect(loadedTravel).toBeDefined();
    expect(loadedTravel.transportMode).toBe('train');
    expect(loadedTravel.type).toBe('travel');
    expect(loadedTravel.routeDistanceKm).toBeUndefined();
    expect(loadedTravel.routeDurationHours).toBeUndefined();
    expect(mocks.saveTrip).toHaveBeenCalledWith(expect.objectContaining({
      id: 'trip-local-legacy',
    }), { preserveUpdatedAt: true });
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

  it('keeps local history snapshot view when loading an explicit version url', async () => {
    mocks.dbEnabled = true;
    mocks.route.tripId = 'trip-local-version';
    mocks.route.pathname = '/trip/trip-local-version';
    mocks.route.search = '?v=local-version';
    const localView: IViewSettings = {
      layoutMode: 'horizontal',
      timelineMode: 'calendar',
      timelineView: 'horizontal',
      mapStyle: 'clean',
      routeMode: 'realistic',
      showCityNames: true,
      zoomLevel: 1.3,
      sidebarWidth: 540,
      timelineHeight: 310,
    };
    const localTrip = makeTrip({
      id: 'trip-local-version',
      title: 'Snapshot trip',
      updatedAt: 1000,
      defaultView: {
        ...localView,
        timelineMode: 'timeline',
      },
    });
    const dbTrip = makeTrip({
      id: 'trip-local-version',
      title: 'DB trip',
      updatedAt: 2000,
      defaultView: localTrip.defaultView,
    });

    mocks.findHistoryEntryByUrl.mockReturnValue({
      id: 'entry-1',
      tripId: 'trip-local-version',
      url: '/trip/trip-local-version?v=local-version',
      label: 'Snapshot',
      ts: Date.now(),
      snapshot: {
        trip: localTrip,
        view: localView,
      },
    });
    mocks.dbGetTrip.mockResolvedValue({
      trip: dbTrip,
      view: dbTrip.defaultView,
      access: {
        source: 'owner',
        ownerId: 'user-1',
        ownerEmail: 'owner@example.com',
        ownerUsername: 'owner',
        canAdminWrite: false,
        updatedAtIso: null,
      },
    });

    const props = makeRouteProps();
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(localTrip, localView);
    });
    expect(props.onTripLoaded).toHaveBeenCalledTimes(1);
    expect(mocks.dbGetTrip).not.toHaveBeenCalled();
    expect(mocks.dbGetTripVersion).not.toHaveBeenCalled();
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
        ownerUsername: 'owner',
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

  it('preserves in-session view settings during reconnect refreshes', async () => {
    mocks.dbEnabled = true;
    mocks.route.tripId = 'trip-view-persistence';
    mocks.route.pathname = '/trip/trip-view-persistence';

    const timelineView: IViewSettings = {
      layoutMode: 'horizontal',
      timelineMode: 'timeline',
      timelineView: 'horizontal',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1,
      sidebarWidth: 500,
      timelineHeight: 340,
    };
    const calendarView: IViewSettings = {
      ...timelineView,
      timelineMode: 'calendar',
    };
    const localTrip = makeTrip({
      id: 'trip-view-persistence',
      title: 'Local trip',
      updatedAt: 1000,
      defaultView: timelineView,
    });
    const dbTrip = makeTrip({
      id: 'trip-view-persistence',
      title: 'DB trip',
      updatedAt: 2000,
      defaultView: timelineView,
    });

    mocks.getTripById.mockReturnValue(localTrip);
    mocks.dbGetTrip.mockResolvedValue({
      trip: dbTrip,
      view: dbTrip.defaultView,
      access: {
        source: 'owner',
        ownerId: 'user-1',
        ownerEmail: 'owner@example.com',
        ownerUsername: 'owner',
        canAdminWrite: false,
        updatedAtIso: null,
      },
    });

    mocks.connectivityState = 'offline';
    const props = {
      ...makeRouteProps(),
      trip: localTrip,
    };
    const view = render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.renderedTripViewProps?.initialViewSettings).toEqual(timelineView);
    });

    await act(async () => {
      const callback = mocks.renderedTripViewProps?.onViewSettingsChange as ((settings: IViewSettings) => void) | undefined;
      callback?.(calendarView);
    });

    await waitFor(() => {
      expect(mocks.renderedTripViewProps?.initialViewSettings).toEqual(calendarView);
    });

    mocks.connectivityState = 'online';
    view.rerender(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenLastCalledWith(dbTrip, calendarView);
    });
    expect(mocks.renderedTripViewProps?.initialViewSettings).toEqual(calendarView);
  });

  it('does not forward duplicate view-settings updates', async () => {
    mocks.dbEnabled = true;
    mocks.route.tripId = 'trip-dedupe-view';
    mocks.route.pathname = '/trip/trip-dedupe-view';

    const localTrip = makeTrip({
      id: 'trip-dedupe-view',
      title: 'Dedupe trip',
      updatedAt: 1000,
      defaultView: {
        layoutMode: 'horizontal',
        timelineMode: 'timeline',
        timelineView: 'horizontal',
        mapStyle: 'standard',
        routeMode: 'simple',
        showCityNames: true,
        zoomLevel: 1,
        sidebarWidth: 560,
        timelineHeight: 340,
      },
    });

    mocks.getTripById.mockReturnValue(localTrip);
    mocks.dbGetTrip.mockResolvedValue({
      trip: localTrip,
      view: localTrip.defaultView,
      access: {
        source: 'owner',
        ownerId: 'user-1',
        ownerEmail: 'owner@example.com',
        ownerUsername: 'owner',
        canAdminWrite: false,
        updatedAtIso: null,
      },
    });

    const props = {
      ...makeRouteProps(),
      trip: localTrip,
    };
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.renderedTripViewProps?.onViewSettingsChange).toBeTypeOf('function');
    });

    const callback = mocks.renderedTripViewProps?.onViewSettingsChange as ((settings: IViewSettings) => void) | undefined;
    const nextSettings: IViewSettings = {
      ...(localTrip.defaultView as IViewSettings),
      zoomLevel: 1.25,
    };

    await act(async () => {
      callback?.(nextSettings);
      callback?.({ ...nextSettings });
    });

    expect(props.onViewSettingsChange).toHaveBeenCalledTimes(1);
  });

  it('enforces read-only mode when trip access source is public_read', async () => {
    mocks.dbEnabled = true;
    mocks.route.tripId = 'trip-public-read';
    mocks.route.pathname = '/trip/trip-public-read';

    const dbTrip = makeTrip({
      id: 'trip-public-read',
      title: 'Public read trip',
      items: [],
    });

    mocks.dbGetTrip.mockResolvedValue({
      trip: dbTrip,
      view: null,
      access: {
        source: 'public_read',
        ownerId: 'owner-1',
        ownerEmail: null,
        ownerUsername: null,
        canAdminWrite: false,
        updatedAtIso: null,
      },
    });

    const props = {
      ...makeRouteProps(),
      trip: dbTrip,
    };
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.renderedTripViewProps?.readOnly).toBe(true);
    });

    expect(mocks.renderedTripViewProps?.canShare).toBe(false);
    expect(mocks.saveTrip).not.toHaveBeenCalled();
  });

  it('persists owner-access trips to local storage', async () => {
    mocks.dbEnabled = true;
    mocks.route.tripId = 'trip-owned';
    mocks.route.pathname = '/trip/trip-owned';

    const dbTrip = makeTrip({
      id: 'trip-owned',
      title: 'Owned trip',
      items: [],
    });

    mocks.dbGetTrip.mockResolvedValue({
      trip: dbTrip,
      view: null,
      access: {
        source: 'owner',
        ownerId: 'user-1',
        ownerEmail: 'user@example.com',
        ownerUsername: 'user',
        canAdminWrite: false,
        updatedAtIso: null,
      },
    });

    const props = makeRouteProps();
    render(React.createElement(TripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledTimes(1);
    });

    expect(mocks.saveTrip).toHaveBeenCalledTimes(1);
    expect(mocks.saveTrip).toHaveBeenCalledWith(dbTrip, { preserveUpdatedAt: true });
  });
});
