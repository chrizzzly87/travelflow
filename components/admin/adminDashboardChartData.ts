import type { AdminDateRange } from './AdminShell';
import { isIsoDateInRange } from './adminDateRange';
import type { AdminTripRecord, AdminUserRecord } from '../../services/adminService';
import type { AdminDashboardUserLevelBreakdownItem } from './adminDashboardUserBreakdown';
import { resolveAdminDashboardUserLevelKey } from './adminDashboardUserBreakdown';

type RowWithDate = { date: string };

const DEFAULT_MAX_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIP_STATUS_STACKED_CATEGORIES = ['Active trips', 'Expired trips', 'Archived trips'] as const;
export const ACTIVITY_STACKED_CATEGORIES = ['New users', 'New trips'] as const;

const tripStatusCategoryByStatus: Record<AdminTripRecord['status'], (typeof TRIP_STATUS_STACKED_CATEGORIES)[number]> = {
    active: 'Active trips',
    expired: 'Expired trips',
    archived: 'Archived trips',
};

const toDayKey = (isoDate: string | null | undefined): string | null => {
    if (!isoDate) return null;
    const timestamp = Date.parse(isoDate);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp).toISOString().slice(0, 10);
};

const toDayLabel = (dayKey: string): string => `${dayKey.slice(8, 10)}.${dayKey.slice(5, 7)}`;

const sortAndSliceRecent = <TRow extends RowWithDate>(rows: TRow[], maxDays: number): TRow[] => (
    [...rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-Math.max(1, maxDays))
);

export const filterDashboardUsersByRange = (
    users: AdminUserRecord[],
    dateRange: AdminDateRange
): AdminUserRecord[] => users.filter((user) => isIsoDateInRange(user.created_at, dateRange));

export const filterDashboardTripsByRange = (
    trips: AdminTripRecord[],
    dateRange: AdminDateRange
): AdminTripRecord[] => trips.filter((trip) => isIsoDateInRange(trip.created_at, dateRange));

export const buildUserLevelCumulativeStackedChartData = (
    allUsers: AdminUserRecord[],
    visibleRangeUsers: AdminUserRecord[],
    userLevelBreakdown: AdminDashboardUserLevelBreakdownItem[],
    dateRange: AdminDateRange
): Array<{ date: string } & Record<string, number>> => {
    const labels = userLevelBreakdown.map((item) => item.label);
    if (labels.length === 0) return [];

    const labelByKey = new Map(userLevelBreakdown.map((item) => [item.key, item.label]));
    const dynamicDayKeys = Array.from(new Set(visibleRangeUsers
        .map((user) => toDayKey(user.created_at))
        .filter((dayKey): dayKey is string => typeof dayKey === 'string'))).sort((a, b) => a.localeCompare(b));
    const staticRangeDayCount = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : null;
    const dayKeys = staticRangeDayCount
        ? Array.from({ length: staticRangeDayCount }, (_, index) => {
            const offsetDays = staticRangeDayCount - index - 1;
            return new Date(Date.now() - (offsetDays * DAY_MS)).toISOString().slice(0, 10);
        })
        : dynamicDayKeys;
    if (dayKeys.length === 0) return [];

    const firstDay = dayKeys[0];
    const baselineTotals: Record<string, number> = Object.fromEntries(labels.map((label) => [label, 0]));

    allUsers.forEach((user) => {
        const dayKey = toDayKey(user.created_at);
        if (!dayKey || dayKey >= firstDay) return;
        const label = labelByKey.get(resolveAdminDashboardUserLevelKey(user));
        if (!label) return;
        baselineTotals[label] += 1;
    });

    const dailyIncrements = new Map<string, Record<string, number>>();
    visibleRangeUsers.forEach((user) => {
        const dayKey = toDayKey(user.created_at);
        if (!dayKey) return;
        const label = labelByKey.get(resolveAdminDashboardUserLevelKey(user));
        if (!label) return;
        const existing = dailyIncrements.get(dayKey) || Object.fromEntries(labels.map((name) => [name, 0]));
        existing[label] += 1;
        dailyIncrements.set(dayKey, existing);
    });

    const runningTotals: Record<string, number> = { ...baselineTotals };
    const result = dayKeys.map((dayKey) => {
        const increments = dailyIncrements.get(dayKey);
        if (increments) {
            labels.forEach((label) => {
                runningTotals[label] += increments[label] || 0;
            });
        }
        return {
            date: dayKey,
            ...runningTotals,
        };
    });

    return sortAndSliceRecent(result, dayKeys.length).map((row) => ({
        ...row,
        date: toDayLabel(row.date),
    }));
};

export const buildTripStatusStackedChartData = (
    trips: AdminTripRecord[],
    maxDays = DEFAULT_MAX_DAYS
): Array<{ date: string } & Record<(typeof TRIP_STATUS_STACKED_CATEGORIES)[number], number>> => {
    const buckets = new Map<string, { date: string } & Record<(typeof TRIP_STATUS_STACKED_CATEGORIES)[number], number>>();
    trips.forEach((trip) => {
        const dayKey = toDayKey(trip.created_at);
        if (!dayKey) return;
        const existing = buckets.get(dayKey) || {
            date: dayKey,
            'Active trips': 0,
            'Expired trips': 0,
            'Archived trips': 0,
        };
        existing[tripStatusCategoryByStatus[trip.status]] += 1;
        buckets.set(dayKey, existing);
    });
    return sortAndSliceRecent(Array.from(buckets.values()), maxDays).map((row) => ({
        ...row,
        date: toDayLabel(row.date),
    }));
};

export const buildUsersVsTripsStackedChartData = (
    users: AdminUserRecord[],
    trips: AdminTripRecord[],
    maxDays = DEFAULT_MAX_DAYS
): Array<{ date: string } & Record<(typeof ACTIVITY_STACKED_CATEGORIES)[number], number>> => {
    const buckets = new Map<string, { date: string } & Record<(typeof ACTIVITY_STACKED_CATEGORIES)[number], number>>();

    users.forEach((user) => {
        const dayKey = toDayKey(user.created_at);
        if (!dayKey) return;
        const existing = buckets.get(dayKey) || {
            date: dayKey,
            'New users': 0,
            'New trips': 0,
        };
        existing['New users'] += 1;
        buckets.set(dayKey, existing);
    });

    trips.forEach((trip) => {
        const dayKey = toDayKey(trip.created_at);
        if (!dayKey) return;
        const existing = buckets.get(dayKey) || {
            date: dayKey,
            'New users': 0,
            'New trips': 0,
        };
        existing['New trips'] += 1;
        buckets.set(dayKey, existing);
    });

    return sortAndSliceRecent(Array.from(buckets.values()), maxDays).map((row) => ({
        ...row,
        date: toDayLabel(row.date),
    }));
};
