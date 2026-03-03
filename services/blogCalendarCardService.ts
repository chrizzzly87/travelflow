import { buildCalendarIcs, sanitizeCalendarFileName, toIcsUtcStamp } from './calendarIcsService';

export interface BlogCalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
}

export interface BlogCalendarCardConfig {
    title: string;
    description?: string;
    filename?: string;
    timezone?: string;
    events: BlogCalendarEvent[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
    return typeof value === 'object' && value !== null;
};

const toNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const toOptionalString = (value: unknown): string | undefined => {
    const parsed = toNonEmptyString(value);
    return parsed ?? undefined;
};

const parseIsoDate = (value: unknown): Date | null => {
    const raw = toNonEmptyString(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const parseEvent = (value: unknown, fallbackIndex: number): BlogCalendarEvent | null => {
    if (!isRecord(value)) return null;

    const title = toNonEmptyString(value.title);
    const startDate = parseIsoDate(value.start);
    const endDate = parseIsoDate(value.end);
    if (!title || !startDate || !endDate) return null;
    if (endDate.getTime() <= startDate.getTime()) return null;

    const explicitId = toOptionalString(value.id);
    const id = sanitizeCalendarFileName(explicitId || `${title}-${fallbackIndex + 1}`);

    return {
        id,
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        location: toOptionalString(value.location),
        description: toOptionalString(value.description),
    };
};

export const parseBlogCalendarCardConfig = (rawJson: string): BlogCalendarCardConfig | null => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return null;
    }

    if (!isRecord(parsed)) return null;
    const title = toNonEmptyString(parsed.title);
    if (!title) return null;

    const rawEvents = Array.isArray(parsed.events) ? parsed.events : [];
    const events = rawEvents
        .map((event, index) => parseEvent(event, index))
        .filter((event): event is BlogCalendarEvent => Boolean(event));

    if (events.length === 0) return null;

    return {
        title,
        description: toOptionalString(parsed.description),
        filename: sanitizeCalendarFileName(toOptionalString(parsed.filename)),
        timezone: toOptionalString(parsed.timezone),
        events,
    };
};

export const buildBlogCalendarIcs = (config: BlogCalendarCardConfig): string => {
    return buildCalendarIcs({
        calendarLabel: 'Blog Calendar',
        events: config.events,
    });
};

const toGoogleDateRange = (startIso: string, endIso: string): string => {
    return `${toIcsUtcStamp(startIso)}/${toIcsUtcStamp(endIso)}`;
};

export const buildGoogleCalendarEventUrl = (event: BlogCalendarEvent, timezone?: string): string => {
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: toGoogleDateRange(event.start, event.end),
    });

    if (event.description) params.set('details', event.description);
    if (event.location) params.set('location', event.location);
    if (timezone) params.set('ctz', timezone);

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildOutlookCalendarEventUrl = (event: BlogCalendarEvent): string => {
    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: event.title,
        startdt: event.start,
        enddt: event.end,
    });

    if (event.description) params.set('body', event.description);
    if (event.location) params.set('location', event.location);

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};
