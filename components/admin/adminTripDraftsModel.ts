import type { AdminDateRange } from './adminShellUtils';

const RANGE_DAYS: Record<AdminDateRange, number | null> = { '7d': 7, '30d': 30, '90d': 90, all: null };

/** Start of the selected range as an ISO timestamp, or null for all time. */
export const resolveTripDraftRangeStart = (range: AdminDateRange, now: number = Date.now()): string | null => {
    const days = RANGE_DAYS[range];
    return days === null ? null : new Date(now - days * 86_400_000).toISOString();
};
