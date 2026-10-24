import { describe, expect, it, vi } from 'vitest';
vi.mock('../../services/destinationService', () => { throw new Error('Navigation must not initialize destination normalization'); });
import { buildTripClaimConflictPath, buildTripClaimLoginReturnPath, readTripClaimConflictQuery } from '../../services/tripClaimNavigation';

describe('lightweight claim navigation', () => {
    it('preserves query and fragment while switching conflict and login markers without destination data', () => {
        const conflict = buildTripClaimConflictPath('/de/trip/one?claim=old&view=map#details');
        expect(conflict).toBe('/de/trip/one?view=map&claim_conflict=already_claimed#details');
        expect(readTripClaimConflictQuery('?claim_conflict=already_claimed')).toBe('already_claimed');
        expect(buildTripClaimLoginReturnPath(conflict, 'next')).toBe('/de/trip/one?view=map&claim=next#details');
        expect(buildTripClaimLoginReturnPath(conflict)).toBe('/de/trip/one?view=map#details');
        expect(readTripClaimConflictQuery('?claim_conflict=%20')).toBeNull();
    });
});
