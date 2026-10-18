// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITrip } from '../../types';
const mocks = vi.hoisted(() => ({ params: { tripId: 'same-id' } as Record<string, string>, save: vi.fn(), navigate: vi.fn(), data: undefined as any, search: '' }));
vi.mock('@tanstack/react-router', () => ({ useParams: () => mocks.params, useMatches: () => mocks.data, useRouter: () => ({ invalidate: vi.fn() }), Outlet: () => <TripContent /> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
vi.mock('../../app/navigation', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ search: mocks.search }) }));
vi.mock('../../services/installPromptService', () => ({ shouldOpenTripsAsRoute: () => false }));
vi.mock('../../hooks/useConnectivityStatus', () => ({ useConnectivityStatus: () => ({ snapshot: { state: 'online' } }) }));
vi.mock('../../services/storageService', () => ({ saveTrip: mocks.save }));
vi.mock('../../features/trips/useTripPersistence', () => ({ useTripPersistence: () => ({ handleCommitState: vi.fn() }) }));
vi.mock('../../features/trips/useViewPreferences', () => ({ useViewPreferences: () => vi.fn() }));
vi.mock('../../components/TripManager', () => ({ TripManager: (props: { currentTripId?: string; onUpdateTrip?: (trip: ITrip) => void }) => <button onClick={() => props.onUpdateTrip?.({ id: 'same-id', title: 'Changed in library', items: [] } as unknown as ITrip)}>Update {props.currentTripId ?? 'no active trip'}</button> }));
import TripWorkspaceLayout, { useTripSession } from '../../features/trips/TripWorkspaceLayout';
import { TripLibraryProvider } from '../../app/shell/TripLibraryProvider';
function TripContent() {
    const session = useTripSession();
    return <>
        <span data-testid="trip-title">{session.trip?.title ?? 'No trip'}</span>
        <button onClick={() => session.onTripLoaded({ id: 'same-id', title: 'Owned trip', items: [] } as unknown as ITrip)}>Load trip</button>
        <button onClick={session.onOpenManager}>Open library</button>
    </>;
}
beforeEach(() => { mocks.params = { tripId: 'same-id' }; mocks.data = undefined; mocks.search = ''; vi.clearAllMocks(); });
describe('route-owned trip workspace', () => {
    it('caches visited current owner data without caching historical or read-only reads', () => {
        const trip = { id: 'same-id', title: 'Cloud trip', items: [] } as unknown as ITrip;
        mocks.data = { trip, access: { source: 'owner' } };
        const view = render(<TripLibraryProvider><TripWorkspaceLayout /></TripLibraryProvider>);
        expect(screen.getByTestId('trip-title')).toHaveTextContent('Cloud trip');
        expect(mocks.save).toHaveBeenCalledWith(trip, { preserveUpdatedAt: true });
        mocks.save.mockClear(); mocks.search = '?v=historical'; mocks.data = { trip: { ...trip, title: 'Historical' }, access: { source: 'owner' } };
        view.rerender(<TripLibraryProvider><TripWorkspaceLayout /></TripLibraryProvider>);
        expect(screen.getByTestId('trip-title')).toHaveTextContent('Historical'); expect(mocks.save).not.toHaveBeenCalled();
        mocks.search = ''; mocks.data = { trip, access: { source: 'public_read' } };
        view.rerender(<TripLibraryProvider><TripWorkspaceLayout /></TripLibraryProvider>);
        expect(mocks.save).not.toHaveBeenCalled();
    });
    it('connects the active trip to library updates without letting the library own session state', async () => {
        render(<TripLibraryProvider><TripWorkspaceLayout /></TripLibraryProvider>);
        fireEvent.click(screen.getByText('Load trip'));
        fireEvent.click(screen.getByText('Open library'));
        fireEvent.click(await screen.findByRole('button', { name: 'Update same-id' }));
        expect(screen.getByTestId('trip-title')).toHaveTextContent('Changed in library');
    });
    it('resets state between owned and shared routes even when their identifiers match', async () => {
        const { rerender } = render(<TripLibraryProvider><TripWorkspaceLayout /></TripLibraryProvider>);
        fireEvent.click(screen.getByText('Load trip'));
        expect(screen.getByTestId('trip-title')).toHaveTextContent('Owned trip');
        mocks.params = { token: 'same-id' };
        rerender(<TripLibraryProvider><TripWorkspaceLayout /></TripLibraryProvider>);
        expect(screen.getByTestId('trip-title')).toHaveTextContent('No trip');
        fireEvent.click(screen.getByText('Open library'));
        expect(await screen.findByRole('button', { name: 'Update no active trip' })).toBeInTheDocument();
    });
});
