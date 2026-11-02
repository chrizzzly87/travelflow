// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITrip } from '../../types';
const mocks = vi.hoisted(() => ({
    navigate: vi.fn(), limit: vi.fn(), saved: vi.fn(), existing: vi.fn(),
    commit: vi.fn(), history: vi.fn(), toast: vi.fn(), track: vi.fn(), state: 'online',
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ access: { entitlements: { tripExpirationDays: 14 } } }) }));
vi.mock('../../app/navigation', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../hooks/useConnectivityStatus', () => ({ useConnectivityStatus: () => ({ snapshot: { state: mocks.state } }) }));
vi.mock('../../config/db', () => ({ DB_ENABLED: true }));
vi.mock('../../services/dbApi', () => ({ dbCanCreateTrip: mocks.limit }));
vi.mock('../../services/storageService', () => ({ getTripById: mocks.existing, saveTrip: mocks.saved }));
vi.mock('../../services/analyticsService', () => ({ trackEvent: mocks.track }));
vi.mock('../../components/ui/appToast', () => ({ showAppToast: mocks.toast }));
vi.mock('../../features/trips/useTripPersistence', () => ({ useTripPersistence: () => ({ commitOwnedTripResilient: mocks.commit }) }));
vi.mock('../../features/trips/tripSessionModel', () => ({ createLocalHistoryEntry: mocks.history }));
import { useTripCreation } from '../../features/trips/useTripCreation';
const generated = { id: 'created-trip', title: 'Generated', items: [{ id: 'city', type: 'city' }] } as unknown as ITrip;
beforeEach(() => {
    vi.clearAllMocks();
    mocks.state = 'online';
    mocks.existing.mockReturnValue(undefined);
    mocks.limit.mockResolvedValue({ allowCreate: true });
    mocks.commit.mockResolvedValue('queued');
});
const generate = async (callback: (trip: ITrip) => void) => {
    await act(async () => { callback(generated); await Promise.resolve(); await Promise.resolve(); });
};
describe('route-scoped trip creation', () => {
    it('persists and navigates locally while offline without waiting for a quota request', async () => {
        mocks.state = 'offline';
        const { result } = renderHook(() => useTripCreation());
        await generate(result.current);
        expect(mocks.limit).not.toHaveBeenCalled();
        expect(mocks.saved).toHaveBeenCalledWith(expect.objectContaining({ id: generated.id, status: 'active', sourceKind: 'created' }));
        expect(mocks.history).toHaveBeenCalledWith(mocks.navigate, expect.objectContaining({ id: generated.id }), undefined, 'Data: Created trip', undefined, expect.any(Number));
        expect(mocks.commit).toHaveBeenCalled();
    });
    it('keeps an existing generated trip identity, creation time and favorite state on incremental updates', async () => {
        mocks.existing.mockReturnValue({ ...generated, createdAt: 1234, isFavorite: true });
        const { result } = renderHook(() => useTripCreation());
        await generate(result.current);
        expect(mocks.limit).not.toHaveBeenCalled();
        expect(mocks.saved).toHaveBeenCalledWith(expect.objectContaining({ createdAt: 1234, isFavorite: true }));
        expect(mocks.history).toHaveBeenCalledWith(mocks.navigate, expect.anything(), undefined, 'Data: Updated generated trip', { replace: true }, expect.any(Number));
        expect(mocks.track).not.toHaveBeenCalled();
    });
    it('honors a denied quota before saving or navigating to a new trip', async () => {
        mocks.limit.mockResolvedValue({ allowCreate: false, activeTripCount: 3, maxTripCount: 3 });
        const { result } = renderHook(() => useTripCreation());
        await generate(result.current);
        expect(mocks.saved).not.toHaveBeenCalled();
        expect(mocks.history).not.toHaveBeenCalled();
        expect(mocks.commit).not.toHaveBeenCalled();
        expect(mocks.navigate).toHaveBeenCalledWith('/pricing');
    });
});
