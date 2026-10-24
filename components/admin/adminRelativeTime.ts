/**
 * The one relative-time format for admin screens: "just now", "4 minutes ago",
 * "yesterday", "in 3 days", then a medium date after a month. Always pair it
 * with `formatAdminAbsoluteTime` in a `data-tooltip` so the exact time is a
 * hover away. Pure, so screens test it directly.
 */
const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const absoluteDateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const mediumDateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

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
    if (absDiffMs < 30 * DAY_MS) return relativeTimeFormatter.format(Math.round(diffMs / DAY_MS), 'day');
    return mediumDateFormatter.format(new Date(timestamp));
};

/** The full date and time, for the `data-tooltip` beside a relative time. */
export const formatAdminAbsoluteTime = (value: unknown, fallback = '—'): string => {
    const timestamp = parseTimestamp(value);
    return timestamp === null ? fallback : absoluteDateTimeFormatter.format(new Date(timestamp));
};
