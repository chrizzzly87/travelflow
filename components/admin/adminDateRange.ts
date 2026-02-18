import type { AdminDateRange } from './AdminShell';

const DAY_MS = 24 * 60 * 60 * 1000;

const getDateRangeStart = (dateRange: AdminDateRange): number | null => {
    const now = Date.now();
    if (dateRange === 'all') return null;
    if (dateRange === '7d') return now - (7 * DAY_MS);
    if (dateRange === '30d') return now - (30 * DAY_MS);
    return now - (90 * DAY_MS);
};

export const isIsoDateInRange = (
    isoDate: string | null | undefined,
    dateRange: AdminDateRange
): boolean => {
    const rangeStart = getDateRangeStart(dateRange);
    if (rangeStart === null) return true;
    if (!isoDate) return false;
    const timestamp = Date.parse(isoDate);
    if (!Number.isFinite(timestamp)) return false;
    return timestamp >= rangeStart;
};
