// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTrip } from '../../helpers/tripFixtures';
import type { IViewSettings } from '../../../types';
const mocks = vi.hoisted(() => ({
    location: { pathname: '/trip/trip-a', search: '', hash: '', state: null },
    params: { tripId: 'trip-a', token: 'token' }, navigate: vi.fn(), props: null as any,
    limit: vi.fn(), upsert: vi.fn(), version: vi.fn(), sharedUpdate: vi.fn(), save: vi.fn(), history: vi.fn(), shared: vi.fn(), view: vi.fn(), confirm: vi.fn(), track: vi.fn(),
}));
vi.mock('@/app/navigation', () => ({ useParams: () => mocks.params, useLocation: () => mocks.location, useNavigate: () => mocks.navigate }));
// The presenter reads its route's validated search; derive it from the mocked location.
vi.mock('../../../features/trips/tripRouteSearch', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../features/trips/tripRouteSearch')>();
    return { ...actual, useTripRouteSearch: () => actual.parseTripRouteSearch(Object.fromEntries(new URLSearchParams(mocks.location.search))) };
});
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ access: { tierKey: 'tier_free', entitlements: { tripExpirationDays: 14 } } }) }));
vi.mock('../../../hooks/useDbSync', () => ({ useDbSync: vi.fn() }));
vi.mock('../../../components/AppDialogProvider', () => ({ useAppDialog: () => ({ confirm: mocks.confirm }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../config/db', () => ({ DB_ENABLED: true }));
vi.mock('../../../services/storageService', () => ({ saveTrip: mocks.save }));
vi.mock('../../../services/analyticsService', () => ({ trackEvent: mocks.track }));
vi.mock('../../../services/dbApi', () => ({ dbCanCreateTrip: mocks.limit, dbUpsertTrip: mocks.upsert, dbCreateTripVersion: mocks.version, dbUpdateSharedTrip: mocks.sharedUpdate, dbGetSharedTrip: mocks.shared, dbUpdateTripShareViewSettings: mocks.view }));
vi.mock('../../../services/historyService', () => ({ createTripHistorySnapshotEntry: mocks.history }));
vi.mock('../../../components/TripView', () => ({ TripView: (props: any) => { mocks.props = props; return React.createElement("div", null, props.trip.title); } }));
const view = { mapStyle: 'standard', layoutMode: 'horizontal', timelineView: 'horizontal', zoomLevel: 1 } as IViewSettings;
const makeProps = () => ({ trip: null, onTripLoaded: vi.fn(), onUpdateTrip: vi.fn(), onCommitState: vi.fn(), onAdoptAgentTripVersion: vi.fn(), onOpenManager: vi.fn(), onOpenSettings: vi.fn(), appLanguage: 'en' as const, onViewSettingsChange: vi.fn(), onLanguageLoaded: vi.fn() });
beforeEach(() => {
    vi.clearAllMocks(); mocks.props = null; mocks.location.search = ''; mocks.location.pathname = '/trip/trip-a';
    mocks.limit.mockResolvedValue({ allowCreate: true }); mocks.confirm.mockResolvedValue(true); mocks.upsert.mockResolvedValue('trip-a'); mocks.version.mockResolvedValue('version'); mocks.sharedUpdate.mockResolvedValue('version'); mocks.history.mockReturnValue({ url: '/trip/cloned?v=local' }); mocks.view.mockResolvedValue(undefined);
});

import { TripLoaderRoute } from '../../../routes/TripLoaderRoute';
const data = (source = 'owner') => ({ trip: makeTrip({ id: 'trip-a', title: 'Resolved trip', defaultView: view }), view, access: { source } as any });
describe('owned trip presenter under native resolution', () => {
    it('renders resolved data immediately and preserves caller edits', async () => {
        const props = makeProps(); const resolved = data(); const root = render(React.createElement(TripLoaderRoute, { ...props, data: resolved }));
        await waitFor(() => expect(mocks.props?.trip.title).toBe('Resolved trip'));
        root.rerender(React.createElement(TripLoaderRoute, { ...props, data: resolved, trip: { ...resolved.trip, title: 'Edited locally' } }));
        expect(mocks.props.trip.title).toBe('Edited locally'); expect(mocks.props.onCommitState).toBe(props.onCommitState);
    });
    it('preserves an explicit view during reconnect and resets it on version navigation', async () => {
        const props = makeProps(); const root = render(React.createElement(TripLoaderRoute, { ...props, data: data() }));
        await waitFor(() => expect(mocks.props).not.toBeNull());
        const chosen = { ...view, mapStyle: 'satellite' } as IViewSettings;
        act(() => mocks.props.onViewSettingsChange(chosen));
        root.rerender(React.createElement(TripLoaderRoute, { ...props, data: { ...data(), view: { ...view, mapStyle: 'clean' } } }));
        expect(mocks.props.initialViewSettings.mapStyle).toBe('satellite');
        mocks.location.search = '?v=next'; root.rerender(React.createElement(TripLoaderRoute, { ...props, data: data() }));
        expect(mocks.props.initialViewSettings.mapStyle).toBe('standard');
    });
    it('deduplicates equivalent view changes and synchronizes owner share settings', async () => {
        const props = makeProps(); render(React.createElement(TripLoaderRoute, { ...props, data: data() }));
        await waitFor(() => expect(mocks.props).not.toBeNull()); const next = { ...view, zoomLevel: 2 };
        act(() => mocks.props.onViewSettingsChange(next)); act(() => mocks.props.onViewSettingsChange({ ...next }));
        expect(props.onViewSettingsChange).toHaveBeenCalledOnce(); expect(mocks.view).toHaveBeenCalledOnce();
    });
    it.each(['public_read', 'admin_fallback'])('does not write owner share settings for %s access', async source => {
        render(React.createElement(TripLoaderRoute, { ...makeProps(), data: data(source) })); await waitFor(() => expect(mocks.props).not.toBeNull());
        act(() => mocks.props.onViewSettingsChange({ ...view, zoomLevel: 2 })); expect(mocks.view).not.toHaveBeenCalled(); expect(mocks.props.canShare).toBe(false); expect(mocks.props.readOnly).toBe(source === 'public_read');
    });
    it('keeps the prompt-derived initial map focus while generation is pending', async () => {
        const resolved = data(); resolved.trip = makeTrip({ id: 'trip-a', title: 'Generating', items: [{ id: 'tokyo', type: 'city', title: 'Tokyo', location: 'Tokyo', startDateOffset: 0, duration: 2, color: '#000000' }], aiMeta: { generation: { state: 'queued', inputSnapshot: { payload: { initialMapCountryFocus: 'Japan' } } } } as any });
        render(React.createElement(TripLoaderRoute, { ...makeProps(), data: resolved })); await waitFor(() => expect(mocks.props).not.toBeNull());
        expect(mocks.props.initialMapFocusQuery).toBe('Japan');
    });
});
