import { beforeEach, describe, expect, it, vi } from 'vitest';
const { preload } = vi.hoisted(() => ({ preload: vi.fn<() => Promise<void>>() }));
vi.mock('../../components/tripview/tripClaimRecoveryBoundary', () => ({ preloadTripClaimConflictDialog: preload }));
import { prepareTripClaimRecovery } from '../../features/trips/prepareTripClaimRecovery';

beforeEach(() => { preload.mockReset(); });

describe('native trip claim preparation', () => {
    it('leaves ordinary trip navigation independent of optional recovery code', async () => {
        const signal = new AbortController().signal;
        await prepareTripClaimRecovery('?claim=request-1&v=old#details', signal);
        await prepareTripClaimRecovery('?claim_conflict=unknown', signal);
        expect(preload).not.toHaveBeenCalled();
    });

    it('waits for complete recovery code and honors a superseding navigation', async () => {
        let release!: () => void;
        preload.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
        const controller = new AbortController();
        let settled = false;
        const navigation = prepareTripClaimRecovery('?claim_conflict=already_claimed', controller.signal).finally(() => { settled = true; });
        expect(preload).toHaveBeenCalledOnce();
        await Promise.resolve();
        expect(settled).toBe(false);
        controller.abort();
        const rejection = expect(navigation).rejects.toMatchObject({ name: 'AbortError' });
        release();
        await rejection;
    });

    it('propagates import failures to the native route error boundary and permits another attempt', async () => {
        preload.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce();
        const signal = new AbortController().signal;
        await expect(prepareTripClaimRecovery('?claim_conflict=already_claimed', signal)).rejects.toThrow('unavailable');
        await expect(prepareTripClaimRecovery('?claim_conflict=already_claimed', signal)).resolves.toBeUndefined();
    });
});
