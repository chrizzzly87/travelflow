/**
 * The one relative-time format for every admin screen: "just now", "4 minutes
 * ago", "3 hours ago", "yesterday", "2 weeks ago", "5 months ago", "last year"
 * (and the future forms, "in 2 weeks"). Always pair it with
 * `formatAdminAbsoluteTime` in a `data-tooltip` so the exact time is a hover
 * away. Pure, so screens test it directly.
 */
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absoluteDateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

const parseTimestamp = (value: unknown): number | null => {
    if (typeof value !== 'string' || !value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export const formatAdminRelativeTime = (value: unknown, nowMs = Date.now(), fallback = '—'): string => {
    const timestamp = parseTimestamp(value);
    if (timestamp === null) return fallback;
    const diffMs = timestamp - nowMs;
    const absDiffMs = Math.abs(diffMs);
    if (absDiffMs < MINUTE_MS) return 'just now';
    if (absDiffMs < HOUR_MS) return relativeTimeFormatter.format(Math.round(diffMs / MINUTE_MS), 'minute');
    if (absDiffMs < DAY_MS) return relativeTimeFormatter.format(Math.round(diffMs / HOUR_MS), 'hour');
    if (absDiffMs < WEEK_MS) return relativeTimeFormatter.format(Math.round(diffMs / DAY_MS), 'day');
    if (absDiffMs < MONTH_MS) return relativeTimeFormatter.format(Math.round(diffMs / WEEK_MS), 'week');
    if (absDiffMs < YEAR_MS) return relativeTimeFormatter.format(Math.round(diffMs / MONTH_MS), 'month');
    return relativeTimeFormatter.format(Math.round(diffMs / YEAR_MS), 'year');
};

/**
 * Day-granular variant for dates where the hour does not matter (legal terms'
 * effective dates): "today", "in 5 days", "3 months ago", "last year". An
 * unparseable string falls back to itself unless a fallback is given.
 */
export const formatAdminRelativeDay = (value: unknown, nowMs = Date.now(), fallback?: string): string => {
    const timestamp = parseTimestamp(value);
    if (timestamp === null) return fallback ?? (typeof value === 'string' && value ? value : '—');
    const days = Math.round((timestamp - nowMs) / DAY_MS);
    if (Math.abs(days) < 1) return 'today';
    if (Math.abs(days) < 31) return relativeTimeFormatter.format(days, 'day');
    if (Math.abs(days) < 365) return relativeTimeFormatter.format(Math.round(days / 30), 'month');
    return relativeTimeFormatter.format(Math.round(days / 365), 'year');
};

/** The full date and time, for the `data-tooltip` beside a relative time. */
export const formatAdminAbsoluteTime = (value: unknown, fallback = '—'): string => {
    const timestamp = parseTimestamp(value);
    return timestamp === null ? fallback : absoluteDateTimeFormatter.format(new Date(timestamp));
};

const chartDayFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

/**
 * "Oct 12" for a chart axis. An ISO day ("2026-10-12") is read as a local date,
 * so it never shifts to the previous day west of UTC.
 */
export const formatAdminChartDay = (value: unknown): string => {
    if (typeof value !== 'string' || !value) return '';
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!day) return value;
    return chartDayFormatter.format(new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
};
