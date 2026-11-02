import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../services/lazyImportRecovery', () => ({ loadLazyComponentWithRecovery: state.load }));

describe('claim recovery preloading', () => {
    it('does not cache a rejected route preload and deduplicates the next successful recovery', async () => {
        vi.resetModules();
        state.load.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ TripClaimConflictDialog: () => null });
        const { preloadTripClaimConflictDialog } = await import('../../components/tripview/tripClaimRecoveryBoundary');
        await expect(preloadTripClaimConflictDialog()).rejects.toThrow('Offline');
        await Promise.all([preloadTripClaimConflictDialog(), preloadTripClaimConflictDialog()]);
        await preloadTripClaimConflictDialog();
        expect(state.load).toHaveBeenCalledTimes(2);
        expect(state.load).toHaveBeenLastCalledWith('TripClaimConflictDialog', expect.any(Function));
    });
});
