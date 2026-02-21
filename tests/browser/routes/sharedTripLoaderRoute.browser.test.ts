import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import type { IViewSettings } from '../../../types';
import { makeTrip } from '../../helpers/tripFixtures';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  route: {
    token: 'share-token',
    pathname: '/s/share-token',
    search: '',
    hash: '',
  },
  auth: {
    access: {
      entitlements: {
        tripExpirationDays: 14,
      },
    },
  },
  useDbSync: vi.fn(),
  ensureDbSession: vi.fn(),
  dbGetSharedTrip: vi.fn(),
  dbGetSharedTripVersion: vi.fn(),
  dbGetTripVersion: vi.fn(),
  dbCanCreateTrip: vi.fn(),
  dbCreateTripVersion: vi.fn(),
  dbUpdateSharedTrip: vi.fn(),
  dbUpsertTrip: vi.fn(),
  appendHistoryEntry: vi.fn(),
  findHistoryEntryByUrl: vi.fn(),
  saveTrip: vi.fn(),
  tripViewProps: [] as any[],
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: mocks.route.token }),
  useLocation: () => ({
    pathname: mocks.route.pathname,
    search: mocks.route.search,
    hash: mocks.route.hash,
  }),
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ access: mocks.auth.access }),
}));

vi.mock('../../../hooks/useDbSync', () => ({
  useDbSync: mocks.useDbSync,
}));

vi.mock('../../../config/db', () => ({
  DB_ENABLED: true,
}));

vi.mock('../../../services/dbApi', () => ({
  ensureDbSession: mocks.ensureDbSession,
  dbGetSharedTrip: mocks.dbGetSharedTrip,
  dbGetSharedTripVersion: mocks.dbGetSharedTripVersion,
  dbGetTripVersion: mocks.dbGetTripVersion,
  dbCanCreateTrip: mocks.dbCanCreateTrip,
  dbCreateTripVersion: mocks.dbCreateTripVersion,
  dbUpdateSharedTrip: mocks.dbUpdateSharedTrip,
  dbUpsertTrip: mocks.dbUpsertTrip,
}));

vi.mock('../../../services/historyService', () => ({
  appendHistoryEntry: mocks.appendHistoryEntry,
  findHistoryEntryByUrl: mocks.findHistoryEntryByUrl,
}));

vi.mock('../../../services/storageService', () => ({
  saveTrip: mocks.saveTrip,
}));

vi.mock('../../../utils', () => ({
  buildShareUrl: (token: string, versionId?: string | null) => (versionId ? `/s/${token}?v=${versionId}` : `/s/${token}`),
  buildTripUrl: (tripId: string, versionId?: string | null) => (versionId ? `/trip/${tripId}?v=${versionId}` : `/trip/${tripId}`),
  generateTripId: () => 'generated-trip-id',
  generateVersionId: () => 'generated-version-id',
  isUuid: (value?: string | null) => Boolean(value && /^[0-9a-f]{8}-[0-9a-f-]+$/i.test(value)),
}));

vi.mock('../../../components/TripView', () => ({
  TripView: (props: any) => {
    mocks.tripViewProps.push(props);
    return null;
  },
}));

import { SharedTripLoaderRoute } from '../../../routes/SharedTripLoaderRoute';

const makeRouteProps = (overrides?: Partial<React.ComponentProps<typeof SharedTripLoaderRoute>>) => ({
  trip: null,
  onTripLoaded: vi.fn(),
  onOpenManager: vi.fn(),
  onOpenSettings: vi.fn(),
  appLanguage: 'en' as const,
  onViewSettingsChange: vi.fn(),
  onLanguageLoaded: vi.fn(),
  ...overrides,
});

const latestTripViewProps = () => mocks.tripViewProps[mocks.tripViewProps.length - 1];

describe('routes/SharedTripLoaderRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tripViewProps.length = 0;
    mocks.route.token = 'share-token';
    mocks.route.pathname = '/s/share-token';
    mocks.route.search = '';
    mocks.route.hash = '';
    mocks.ensureDbSession.mockResolvedValue('session-1');
    mocks.dbGetSharedTrip.mockResolvedValue(null);
    mocks.dbGetSharedTripVersion.mockResolvedValue(null);
    mocks.dbGetTripVersion.mockResolvedValue(null);
    mocks.findHistoryEntryByUrl.mockReturnValue(null);
    mocks.dbCanCreateTrip.mockResolvedValue({ allowCreate: true, activeTripCount: 1, maxTripCount: 5 });
  });

  it('navigates to share-unavailable when no shared trip exists', async () => {
    const props = makeRouteProps();

    render(React.createElement(SharedTripLoaderRoute, props));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/share-unavailable', { replace: true });
    });
    expect(props.onTripLoaded).not.toHaveBeenCalled();
  });

  it('loads shared version snapshots when a valid version id exists', async () => {
    const versionId = '123e4567-e89b-12d3-a456-426614174000';
    mocks.route.search = `?v=${versionId}`;

    const baseView: IViewSettings = {
      layoutMode: 'horizontal',
      timelineView: 'horizontal',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1,
      sidebarWidth: 480,
      timelineHeight: 320,
    };
    const baseTrip = makeTrip({ id: 'shared-trip', status: 'active', defaultView: baseView });
    const versionView: IViewSettings = {
      ...baseView,
      mapStyle: 'dark',
      routeMode: 'realistic',
    };
    const versionTrip = makeTrip({ id: 'shared-trip', title: 'Version snapshot', defaultView: versionView });

    mocks.dbGetSharedTrip.mockResolvedValue({
      trip: baseTrip,
      view: baseView,
      mode: 'view',
      allowCopy: true,
      latestVersionId: 'latest-version-id',
    });
    mocks.dbGetSharedTripVersion.mockResolvedValue({
      trip: versionTrip,
      view: versionView,
      mode: 'view',
      allowCopy: true,
      latestVersionId: 'latest-version-id',
      versionId,
    });

    const props = makeRouteProps({ trip: versionTrip });

    render(React.createElement(SharedTripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(versionTrip, versionView);
    });

    await waitFor(() => {
      expect(latestTripViewProps()?.shareSnapshotMeta?.hasNewer).toBe(true);
      expect(latestTripViewProps()?.shareStatus).toBe('view');
      expect(latestTripViewProps()?.readOnly).toBe(true);
    });
  });

  it('falls back to local history snapshots for non-uuid version ids', async () => {
    mocks.route.search = '?v=legacy-snapshot';

    const baseView: IViewSettings = {
      layoutMode: 'horizontal',
      timelineView: 'horizontal',
      mapStyle: 'standard',
      routeMode: 'simple',
      showCityNames: true,
      zoomLevel: 1,
      sidebarWidth: 480,
      timelineHeight: 320,
    };
    const sharedTrip = makeTrip({ id: 'shared-trip', defaultView: baseView });
    const historyView: IViewSettings = {
      ...baseView,
      timelineView: 'vertical',
    };
    const historyTrip = makeTrip({ id: 'shared-trip', title: 'History snapshot', defaultView: historyView });

    mocks.dbGetSharedTrip.mockResolvedValue({
      trip: sharedTrip,
      view: baseView,
      mode: 'view',
      allowCopy: true,
      latestVersionId: 'latest-version-id',
    });
    mocks.findHistoryEntryByUrl.mockReturnValue({
      snapshot: {
        trip: historyTrip,
        view: historyView,
      },
    });

    const props = makeRouteProps({ trip: historyTrip });

    render(React.createElement(SharedTripLoaderRoute, props));

    await waitFor(() => {
      expect(props.onTripLoaded).toHaveBeenCalledWith(historyTrip, historyView);
    });
    expect(mocks.dbGetSharedTripVersion).not.toHaveBeenCalled();
    expect(latestTripViewProps()?.shareSnapshotMeta?.hasNewer).toBe(true);
  });
});
