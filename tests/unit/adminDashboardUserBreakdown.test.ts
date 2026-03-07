import { describe, expect, it } from 'vitest';
import type { AdminUserRecord } from '../../services/adminService';
import { buildAdminDashboardUserLevelBreakdown } from '../../components/admin/adminDashboardUserBreakdown';

const buildUser = (overrides: Partial<AdminUserRecord>): AdminUserRecord => ({
    user_id: 'user-1',
    email: 'user@example.com',
    system_role: 'user',
    tier_key: 'tier_free',
    entitlements_override: null,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    ...overrides,
});

describe('components/admin/adminDashboardUserBreakdown', () => {
    it('builds the level breakdown with counts, shares, and tooltip totals', () => {
        const rows = [
            buildUser({ user_id: 'admin-1', system_role: 'admin', tier_key: 'tier_premium' }),
            buildUser({ user_id: 'premium-1', tier_key: 'tier_premium' }),
            buildUser({ user_id: 'mid-1', tier_key: 'tier_mid' }),
            buildUser({ user_id: 'free-1', tier_key: 'tier_free' }),
            buildUser({ user_id: 'anon-1', is_anonymous: true, email: null }),
            buildUser({ user_id: 'anon-2', auth_provider: 'anonymous', email: null }),
        ];

        const breakdown = buildAdminDashboardUserLevelBreakdown(rows);
        expect(breakdown.map((entry) => entry.key)).toEqual([
            'admin',
            'tier_premium',
            'tier_mid',
            'tier_free',
        ]);
        expect(breakdown.map((entry) => entry.count)).toEqual([1, 1, 1, 3]);
        expect(breakdown.map((entry) => entry.shareLabel)).toEqual(['16.7%', '16.7%', '16.7%', '50%']);
        expect(breakdown[0]?.tooltip).toContain('of 6 total users');
    });

    it('keeps admin users in the admin bucket', () => {
        const rows = [
            buildUser({
                user_id: 'admin-1',
                system_role: 'admin',
                is_anonymous: true,
                auth_provider: 'anonymous',
                email: null,
            }),
        ];

        const breakdown = buildAdminDashboardUserLevelBreakdown(rows);
        expect(breakdown.find((entry) => entry.key === 'admin')?.count).toBe(1);
        expect(breakdown.find((entry) => entry.key === 'tier_free')?.count).toBe(0);
    });

    it('returns zero-share labels when there are no users', () => {
        const breakdown = buildAdminDashboardUserLevelBreakdown([]);
        expect(breakdown.every((entry) => entry.count === 0)).toBe(true);
        expect(breakdown.every((entry) => entry.shareLabel === '0%')).toBe(true);
    });
});
