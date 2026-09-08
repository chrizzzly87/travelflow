import type { TripAgentThread } from '../../services/tripAgentService';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Compact, locale-aware chat timestamp: "now" and narrow relative units while a
 * message is fresh, a weekday and clock time within the week, then a date.
 */
export const formatTripAgentTimestamp = (
    value: string | number | undefined,
    locale: string,
    now: number = Date.now(),
): string => {
    if (value === undefined) return '';
    const timestamp = typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isFinite(timestamp)) return '';
    const elapsed = Math.max(0, now - timestamp);
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' });

    if (elapsed < 45 * 1_000) return relative.format(0, 'minute');
    if (elapsed < HOUR_MS) return relative.format(-Math.round(elapsed / MINUTE_MS), 'minute');
    if (elapsed < DAY_MS) return relative.format(-Math.round(elapsed / HOUR_MS), 'hour');
    if (elapsed < 7 * DAY_MS) {
        return new Intl.DateTimeFormat(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
            .format(new Date(timestamp));
    }
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(timestamp));
};

export type TripAgentThreadSectionKey = 'today' | 'week' | 'older' | 'archived';

export interface TripAgentThreadSection {
    key: TripAgentThreadSectionKey;
    threads: TripAgentThread[];
    hiddenCount: number;
}

const SECTION_LIMITS: Record<TripAgentThreadSectionKey, number> = {
    today: 8,
    week: 6,
    older: 4,
    archived: 3,
};

/**
 * Keeps the history menu short: recent chats stay visible, anything past the
 * per-section limit is reported as a count instead of an endless list.
 */
export const groupTripAgentThreads = (
    threads: TripAgentThread[],
    now: number = Date.now(),
): TripAgentThreadSection[] => {
    const buckets: Record<TripAgentThreadSectionKey, TripAgentThread[]> = {
        today: [], week: [], older: [], archived: [],
    };
    const sorted = [...threads].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    for (const thread of sorted) {
        if (thread.status === 'archived') {
            buckets.archived.push(thread);
            continue;
        }
        const elapsed = now - Date.parse(thread.updatedAt);
        if (!Number.isFinite(elapsed) || elapsed < DAY_MS) buckets.today.push(thread);
        else if (elapsed < 7 * DAY_MS) buckets.week.push(thread);
        else buckets.older.push(thread);
    }

    return (Object.keys(buckets) as TripAgentThreadSectionKey[])
        .filter((key) => buckets[key].length > 0)
        .map((key) => ({
            key,
            threads: buckets[key].slice(0, SECTION_LIMITS[key]),
            hiddenCount: Math.max(0, buckets[key].length - SECTION_LIMITS[key]),
        }));
};
