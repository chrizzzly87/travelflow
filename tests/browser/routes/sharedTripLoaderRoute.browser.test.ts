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

import { SharedTripLoaderRoute } from '../../../routes/SharedTripLoaderRoute';
const data = (mode: 'view' | 'edit' = 'view', allowCopy = true) => ({ trip: makeTrip({ id: 'trip-a', title: 'Shared trip' }), view, access: null, shareMode: mode, allowCopy, sourceShareVersionId: 'source-version', snapshotState: { hasNewer: true, latestUrl: '/s/token' } });
describe('shared trip presenter under native resolution', () => {
    it('renders current token permissions and snapshot metadata immediately', async () => {
        render(React.createElement(SharedTripLoaderRoute, { ...makeProps(), data: data('view', false) })); await waitFor(() => expect(mocks.props).not.toBeNull());
        expect(mocks.props.readOnly).toBe(true); expect(mocks.props.canShare).toBe(false); expect(mocks.props.onCopyTrip).toBeUndefined(); expect(mocks.props.shareSnapshotMeta.hasNewer).toBe(true);
        await act(async () => mocks.props.onCommitState(makeTrip(), view)); expect(mocks.sharedUpdate).not.toHaveBeenCalled();
    });
    it('commits editable shares through the token and records local history', async () => {
        render(React.createElement(SharedTripLoaderRoute, { ...makeProps(), data: data('edit') })); await waitFor(() => expect(mocks.props).not.toBeNull()); const edited = makeTrip({ title: 'Edited shared trip' });
        await act(async () => mocks.props.onCommitState(edited, view, { label: 'Changed city' }));
        expect(mocks.sharedUpdate).toHaveBeenCalledWith('token', edited, view, 'Changed city'); expect(mocks.history).toHaveBeenCalledWith(expect.objectContaining({ trip: edited, baseUrlOverride: '/s/token' }));
    });
    it('copies provenance without granting ownership to the source trip', async () => {
        render(React.createElement(SharedTripLoaderRoute, { ...makeProps(), data: data() })); await waitFor(() => expect(mocks.props).not.toBeNull()); await act(async () => mocks.props.onCopyTrip());
        expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ sourceKind: 'duplicate_shared', forkedFromTripId: 'trip-a', forkedFromShareToken: 'token', forkedFromShareVersionId: 'source-version', isFavorite: false })); expect(mocks.upsert).toHaveBeenCalledOnce();
    });
    it('shows the existing upgrade dialog before creating a copy past quota', async () => {
        mocks.limit.mockResolvedValue({ allowCreate: false, activeTripCount: 3, maxTripCount: 3 });
        render(React.createElement(SharedTripLoaderRoute, { ...makeProps(), data: data() })); await waitFor(() => expect(mocks.props).not.toBeNull()); await act(async () => mocks.props.onCopyTrip());
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining('/checkout?')); expect(mocks.save).not.toHaveBeenCalled();
    });
});
