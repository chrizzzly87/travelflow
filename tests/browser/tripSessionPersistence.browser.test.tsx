// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITrip, IViewSettings } from '../../types';

const mocks = vi.hoisted(() => ({
    auth: { isAuthenticated: true, access: { userId: 'user-a', isAnonymous: false } as { userId: string; isAnonymous: boolean } | null },
    connectivity: { state: 'online' },
    navigate: vi.fn(), ensureSession: vi.fn(), upsert: vi.fn(), version: vi.fn(),
    override: vi.fn(), queue: vi.fn(), settings: vi.fn(), history: vi.fn(),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../hooks/useConnectivityStatus', () => ({ useConnectivityStatus: () => ({ snapshot: mocks.connectivity }) }));
vi.mock('../../app/navigation', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../config/db', () => ({ DB_ENABLED: true }));
vi.mock('../../services/dbApi', () => ({
    ensureDbSession: mocks.ensureSession, dbUpsertTripWithStatus: mocks.upsert,
    dbCreateTripVersion: mocks.version, dbAdminOverrideTripCommit: mocks.override,
    dbUpsertUserSettings: mocks.settings,
}));
vi.mock('../../services/tripSyncManager', () => ({ enqueueTripCommitAndSync: mocks.queue }));
vi.mock('../../features/trips/tripSessionModel', async (importOriginal) => ({
    ...await importOriginal<typeof import('../../features/trips/tripSessionModel')>(),
    createLocalHistoryEntry: mocks.history,
}));
import { useTripPersistence } from '../../features/trips/useTripPersistence';
import { useViewPreferences } from '../../features/trips/useViewPreferences';

const trip = { id: 'trip-a', title: 'Trip', items: [] } as unknown as ITrip;
const view = { mapStyle: 'standard', routeMode: 'simple', layoutMode: 'horizontal', timelineMode: 'calendar', timelineView: 'week', showCityNames: true, zoomLevel: 1, sidebarWidth: 560, timelineHeight: 340 } as unknown as IViewSettings;
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = true;
    mocks.auth.access = { userId: 'user-a', isAnonymous: false };
    mocks.connectivity.state = 'online';
    mocks.ensureSession.mockResolvedValue('user-a');
    mocks.upsert.mockResolvedValue({ tripId: 'trip-a' });
    mocks.version.mockResolvedValue('version-a');
    mocks.override.mockResolvedValue({ tripId: 'trip-a', versionId: 'version-a' });
    mocks.settings.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('trip session persistence', () => {
    it('retains an edit in the offline queue when a remote request rejects', async () => {
        mocks.upsert.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const { result } = renderHook(() => useTripPersistence('trip-a'));
        await expect(result.current.commitOwnedTripResilient(trip, view, 'Updated')).resolves.toBe('queued');
        expect(mocks.queue).toHaveBeenCalledWith({ tripId: 'trip-a', tripSnapshot: trip, viewSnapshot: view, label: 'Updated' });
    });

    it('does not replay a denied write through the offline queue', async () => {
        mocks.upsert.mockResolvedValueOnce({ tripId: null, isPermissionError: true });
        const { result } = renderHook(() => useTripPersistence('trip-a'));
        await expect(result.current.commitOwnedTripResilient(trip, view, 'Updated')).resolves.toBe('permission_denied');
        expect(mocks.queue).not.toHaveBeenCalled();
    });

    it('allows retry after a privileged commit rejects without queuing that override', async () => {
        mocks.override.mockRejectedValueOnce(new Error('Unavailable'));
        const { result } = renderHook(() => useTripPersistence('trip-a'));
        result.current.handleCommitState(trip, view, { adminOverride: true });
        await settle();
        result.current.handleCommitState(trip, view, { adminOverride: true });
        await settle();
        expect(mocks.override).toHaveBeenCalledTimes(2);
        expect(mocks.queue).not.toHaveBeenCalled();
    });
});

describe('account-owned view preferences', () => {
    beforeEach(() => vi.useFakeTimers());

    it('cancels a pending save when the account logs out', async () => {
        const { result, rerender } = renderHook(() => useViewPreferences());
        act(() => result.current(view));
        mocks.auth.isAuthenticated = false;
        mocks.auth.access = null;
        rerender();
        await act(async () => vi.advanceTimersByTimeAsync(800));
        expect(mocks.settings).not.toHaveBeenCalled();
    });

    it('deduplicates within an account and persists the same settings for a new account', async () => {
        const { result, rerender } = renderHook(() => useViewPreferences());
        act(() => result.current(view));
        await act(async () => vi.advanceTimersByTimeAsync(800));
        act(() => result.current(view));
        await act(async () => vi.advanceTimersByTimeAsync(800));
        expect(mocks.settings).toHaveBeenCalledTimes(1);
        mocks.auth.access = { userId: 'user-b', isAnonymous: false };
        rerender();
        act(() => result.current(view));
        await act(async () => vi.advanceTimersByTimeAsync(800));
        expect(mocks.settings).toHaveBeenCalledTimes(2);
    });

    it('permits retry of unchanged preferences after a failed request', async () => {
        mocks.settings.mockRejectedValueOnce(new Error('Offline'));
        const { result } = renderHook(() => useViewPreferences());
        act(() => result.current(view));
        await act(async () => vi.advanceTimersByTimeAsync(800));
        act(() => result.current(view));
        await act(async () => vi.advanceTimersByTimeAsync(800));
        expect(mocks.settings).toHaveBeenCalledTimes(2);
    });
});
