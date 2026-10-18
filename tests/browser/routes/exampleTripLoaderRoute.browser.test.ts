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

import { ExampleTripLoaderRoute } from '../../../routes/ExampleTripLoaderRoute';
const data = () => ({ trip: makeTrip({ id: 'trip-a', title: 'Japan preview', isExample: true, exampleTemplateId: 'japan-spring' }), view, access: null, templateId: 'japan-spring', templateTitle: 'Spring in Japan', countries: ['Japan'] });
describe('example trip presenter under native resolution', () => {
    it('renders a resolved preview without constructing a second trip or an owned record', async () => {
        render(React.createElement(ExampleTripLoaderRoute, { ...makeProps(), data: data() })); await waitFor(() => expect(mocks.props).not.toBeNull());
        expect(mocks.props.trip.title).toBe('Japan preview'); expect(mocks.props.isExamplePreview).toBe(true); expect(mocks.props.canShare).toBe(false); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.track).toHaveBeenCalledWith('example_trip__open', { template: 'japan-spring', country_count: 1 });
    });
    it('copies the preview into a new owned record with example provenance', async () => {
        render(React.createElement(ExampleTripLoaderRoute, { ...makeProps(), data: data() })); await waitFor(() => expect(mocks.props).not.toBeNull()); await act(async () => mocks.props.onCopyTrip());
        expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ isExample: false, sourceKind: 'duplicate_trip', sourceTemplateId: 'japan-spring', forkedFromExampleTemplateId: 'japan-spring', isFavorite: false })); expect(mocks.upsert).toHaveBeenCalledOnce(); expect(mocks.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/trip\//));
    });
    it('starts a similar trip with the template countries and existing analytics contract', async () => {
        render(React.createElement(ExampleTripLoaderRoute, { ...makeProps(), data: data() })); await waitFor(() => expect(mocks.props).not.toBeNull()); act(() => mocks.props.exampleTripBanner.onCreateSimilarTrip());
        expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining('/create-trip?')); expect(mocks.track).toHaveBeenCalledWith('example_trip__banner--create_similar', { template: 'japan-spring', country_count: 1 });
    });
    it('checks quota and offers the same upgrade interaction before copying', async () => {
        mocks.limit.mockResolvedValue({ allowCreate: false, activeTripCount: 3, maxTripCount: 3 });
        render(React.createElement(ExampleTripLoaderRoute, { ...makeProps(), data: data() })); await waitFor(() => expect(mocks.props).not.toBeNull()); await act(async () => mocks.props.onCopyTrip());
        expect(mocks.confirm).toHaveBeenCalledOnce(); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining('/checkout?'));
    });
});
