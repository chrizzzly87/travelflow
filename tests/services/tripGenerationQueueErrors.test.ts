import { describe, expect, it } from 'vitest';
import {
    QueuedTripGenerationAlreadyClaimedError,
    QueuedTripGenerationError,
    isQueuedTripGenerationAlreadyClaimedError,
    isQueuedTripGenerationClaimedByAnotherUserError,
} from '../../services/tripGenerationQueueErrors';

describe('lightweight queue outcome classification', () => {
    it('retains request, trip and cause without confusing same-owner recovery with another owner', () => {
        const cause = new Error('internal');
        const own = new QueuedTripGenerationAlreadyClaimedError('claimed', { tripId: 'trip-1', requestId: 'request-1', cause });
        expect(own).toBeInstanceOf(QueuedTripGenerationError);
        expect(own.causeError).toBe(cause);
        expect(own.tripId).toBe('trip-1');
        expect(own.requestId).toBe('request-1');
        expect(isQueuedTripGenerationAlreadyClaimedError(own)).toBe(true);
        expect(isQueuedTripGenerationClaimedByAnotherUserError(own)).toBe(false);
        const another = new QueuedTripGenerationAlreadyClaimedError('claimed', { claimedByAnotherUser: true });
        expect(isQueuedTripGenerationClaimedByAnotherUserError(another)).toBe(true);
    });

    it('does not classify generic failures or name-shaped objects as successful claim outcomes', () => {
        for (const error of [null, new Error('already claimed'), new QueuedTripGenerationError('failed'), { name: 'QueuedTripGenerationAlreadyClaimedError', claimedByAnotherUser: true }]) {
            expect(isQueuedTripGenerationAlreadyClaimedError(error)).toBe(false);
            expect(isQueuedTripGenerationClaimedByAnotherUserError(error)).toBe(false);
        }
    });
});
