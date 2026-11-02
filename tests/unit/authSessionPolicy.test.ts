import { describe, expect, it } from 'vitest';
import { shouldRevokeInactiveAccount } from '../../features/auth/sessionPolicy';

describe('session-bound inactive account eviction', () => {
    const input = { isLoading: false, session: { user: { id: 'member' } }, access: { userId: 'member', accountStatus: 'disabled', isAnonymous: false } } as any;
    it('revokes the bound disabled session without requiring an authenticated flag', () => {
        expect(shouldRevokeInactiveAccount(input)).toBe(true);
    });
    it('does not act on a stale account response, anonymous session or pending bootstrap', () => {
        expect(shouldRevokeInactiveAccount({ ...input, isLoading: true })).toBe(false);
        expect(shouldRevokeInactiveAccount({ ...input, session: { user: { id: 'another' } } })).toBe(false);
        expect(shouldRevokeInactiveAccount({ ...input, access: { ...input.access, isAnonymous: true } })).toBe(false);
        expect(shouldRevokeInactiveAccount({ ...input, access: { ...input.access, accountStatus: 'active' } })).toBe(false);
    });
});
