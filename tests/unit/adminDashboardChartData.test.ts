import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminTripRecord, AdminUserRecord } from '../../services/adminService';
import {
    buildTripStatusStackedChartData,
    buildUserLevelCumulativeStackedChartData,
    buildUsersVsTripsStackedChartData,
    filterDashboardTripsByRange,
} from '../../components/admin/adminDashboardChartData';
import type { AdminDashboardUserLevelBreakdownItem } from '../../components/admin/adminDashboardUserBreakdown';

const buildTrip = (overrides: Partial<AdminTripRecord>): AdminTripRecord => ({
    trip_id: 'trip-1',
    owner_id: 'user-1',
    owner_email: 'user@example.com',
    title: 'Trip',
    status: 'active',
    generation_state: null,
    trip_expires_at: null,
    archived_at: null,
    source_kind: null,
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-01T10:00:00.000Z',
    ...overrides,
});

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

describe('components/admin/adminDashboardChartData', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('filters dashboard trips by created_at so updated legacy trips do not leak into range', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
        const filtered = filterDashboardTripsByRange([
            buildTrip({
                trip_id: 'legacy-trip',
                created_at: '2025-12-01T09:00:00.000Z',
                updated_at: '2026-03-30T09:00:00.000Z',
            }),
            buildTrip({
                trip_id: 'recent-trip',
                created_at: '2026-03-20T09:00:00.000Z',
                updated_at: '2026-03-20T09:00:00.000Z',
            }),
        ], '30d');
        expect(filtered.map((trip) => trip.trip_id)).toEqual(['recent-trip']);
    });

    it('builds stacked trip-status trend rows by creation day', () => {
        const data = buildTripStatusStackedChartData([
            buildTrip({ trip_id: 'a', status: 'active', created_at: '2026-03-02T12:00:00.000Z' }),
            buildTrip({ trip_id: 'b', status: 'expired', created_at: '2026-03-02T18:00:00.000Z' }),
            buildTrip({ trip_id: 'c', status: 'archived', created_at: '2026-03-03T08:00:00.000Z' }),
        ], 30);
        expect(data).toEqual([
            { date: '02.03', 'Active trips': 1, 'Expired trips': 1, 'Archived trips': 0 },
            { date: '03.03', 'Active trips': 0, 'Expired trips': 0, 'Archived trips': 1 },
        ]);
    });

    it('builds stacked users-vs-trips trend rows by day', () => {
        const data = buildUsersVsTripsStackedChartData(
            [
                buildUser({ user_id: 'u1', created_at: '2026-03-02T08:00:00.000Z' }),
                buildUser({ user_id: 'u2', created_at: '2026-03-02T09:00:00.000Z' }),
                buildUser({ user_id: 'u3', created_at: '2026-03-03T09:00:00.000Z' }),
            ],
            [
                buildTrip({ trip_id: 't1', created_at: '2026-03-02T11:00:00.000Z' }),
                buildTrip({ trip_id: 't2', created_at: '2026-03-04T11:00:00.000Z' }),
            ],
            30
        );
        expect(data).toEqual([
            { date: '02.03', 'New users': 2, 'New trips': 1 },
            { date: '03.03', 'New users': 1, 'New trips': 0 },
            { date: '04.03', 'New users': 0, 'New trips': 1 },
        ]);
    });

    it('builds cumulative user-level totals over time (not per-day new counts)', () => {
        const breakdown: AdminDashboardUserLevelBreakdownItem[] = [
            { key: 'admin', label: 'Admin', count: 2, shareOfTotal: 0.2, shareLabel: '20%', tooltip: 'Admin: 2 of 10 total users (20%)' },
            { key: 'tier_premium', label: 'Globetrotter', count: 2, shareOfTotal: 0.2, shareLabel: '20%', tooltip: 'Globetrotter: 2 of 10 total users (20%)' },
            { key: 'tier_mid', label: 'Explorer', count: 3, shareOfTotal: 0.3, shareLabel: '30%', tooltip: 'Explorer: 3 of 10 total users (30%)' },
            { key: 'tier_free', label: 'Backpacker', count: 3, shareOfTotal: 0.3, shareLabel: '30%', tooltip: 'Backpacker: 3 of 10 total users (30%)' },
        ];
        const allUsers = [
            buildUser({ user_id: 'base-admin', system_role: 'admin', created_at: '2026-02-20T10:00:00.000Z' }),
            buildUser({ user_id: 'base-mid', tier_key: 'tier_mid', created_at: '2026-02-22T10:00:00.000Z' }),
            buildUser({ user_id: 'r1', tier_key: 'tier_free', created_at: '2026-03-01T10:00:00.000Z' }),
            buildUser({ user_id: 'r2', tier_key: 'tier_mid', created_at: '2026-03-02T10:00:00.000Z' }),
            buildUser({ user_id: 'r3', tier_key: 'tier_premium', created_at: '2026-03-02T11:00:00.000Z' }),
            buildUser({ user_id: 'r4', system_role: 'admin', created_at: '2026-03-03T10:00:00.000Z' }),
        ];
        const visibleRangeUsers = allUsers.filter((user) => user.created_at >= '2026-03-01');
        const data = buildUserLevelCumulativeStackedChartData(allUsers, visibleRangeUsers, breakdown, 'all');
        expect(data).toEqual([
            { date: '01.03', Admin: 1, Globetrotter: 0, Explorer: 1, Backpacker: 1 },
            { date: '02.03', Admin: 1, Globetrotter: 1, Explorer: 2, Backpacker: 1 },
            { date: '03.03', Admin: 2, Globetrotter: 1, Explorer: 2, Backpacker: 1 },
        ]);
    });

    it('fills fixed-range days so cumulative totals remain visible even on no-signup days', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-07T12:00:00.000Z'));
        const breakdown: AdminDashboardUserLevelBreakdownItem[] = [
            { key: 'admin', label: 'Admin', count: 1, shareOfTotal: 0.5, shareLabel: '50%', tooltip: 'Admin: 1 of 2 total users (50%)' },
            { key: 'tier_premium', label: 'Globetrotter', count: 0, shareOfTotal: 0, shareLabel: '0%', tooltip: 'Globetrotter: 0 of 2 total users (0%)' },
            { key: 'tier_mid', label: 'Explorer', count: 0, shareOfTotal: 0, shareLabel: '0%', tooltip: 'Explorer: 0 of 2 total users (0%)' },
            { key: 'tier_free', label: 'Backpacker', count: 1, shareOfTotal: 0.5, shareLabel: '50%', tooltip: 'Backpacker: 1 of 2 total users (50%)' },
        ];
        const allUsers = [
            buildUser({ user_id: 'base-admin', system_role: 'admin', created_at: '2026-02-20T10:00:00.000Z' }),
            buildUser({ user_id: 'range-free', tier_key: 'tier_free', created_at: '2026-03-05T10:00:00.000Z' }),
        ];
        const visibleRangeUsers = allUsers.filter((user) => user.created_at >= '2026-03-01');
        const data = buildUserLevelCumulativeStackedChartData(allUsers, visibleRangeUsers, breakdown, '7d');
        expect(data).toHaveLength(7);
        expect(data[0]).toMatchObject({ date: '01.03', Admin: 1, Backpacker: 0 });
        expect(data[4]).toMatchObject({ date: '05.03', Admin: 1, Backpacker: 1 });
        expect(data[6]).toMatchObject({ date: '07.03', Admin: 1, Backpacker: 1 });
    });
});
