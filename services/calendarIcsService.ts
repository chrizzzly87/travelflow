import { APP_NAME } from '../config/appGlobals';

export interface CalendarIcsEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
    url?: string;
}

interface CalendarIcsSourceMeta {
    appName?: string;
    sourceUrl?: string;
}

interface BuildCalendarIcsOptions {
    calendarLabel: string;
    events: CalendarIcsEvent[];
    source?: CalendarIcsSourceMeta;
    method?: 'PUBLISH' | 'REQUEST';
}

const trimToOptional = (value?: string): string | undefined => {
    const normalized = (value || '').trim();
    return normalized.length > 0 ? normalized : undefined;
};

export const sanitizeCalendarFileName = (value: string | undefined): string => {
    const base = (value || 'calendar-events')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/(^-|-$)/g, '');
    return base || 'calendar-events';
};

export const toIcsUtcStamp = (isoString: string): string => {
    const date = new Date(isoString);
    return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
};

export const escapeIcsText = (value: string): string => {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
};

const resolveDescriptionWithSource = (
    description: string | undefined,
    source: CalendarIcsSourceMeta | undefined,
): string | undefined => {
    const lines: string[] = [];
    const descriptionValue = trimToOptional(description);
    if (descriptionValue) lines.push(descriptionValue);

    const appName = trimToOptional(source?.appName) || APP_NAME;
    lines.push(`Planned with ${appName}.`);

    const sourceUrl = trimToOptional(source?.sourceUrl);
    if (sourceUrl) {
        lines.push(`Open trip: ${sourceUrl}`);
    }

    return lines.join('\n');
};

const buildCalendarIcsEvent = (
    event: CalendarIcsEvent,
    index: number,
    source: CalendarIcsSourceMeta | undefined,
): string => {
    const uid = `${event.id}-${index + 1}@travelflow.app`;
    const nowStamp = toIcsUtcStamp(new Date().toISOString());
    const lines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${toIcsUtcStamp(event.start)}`,
        `DTEND:${toIcsUtcStamp(event.end)}`,
        `SUMMARY:${escapeIcsText(event.title)}`,
    ];

    if (event.location) {
        lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }

    const descriptionWithSource = resolveDescriptionWithSource(event.description, source);
    if (descriptionWithSource) {
        lines.push(`DESCRIPTION:${escapeIcsText(descriptionWithSource)}`);
    }

    const effectiveUrl = trimToOptional(event.url) || trimToOptional(source?.sourceUrl);
    if (effectiveUrl) {
        lines.push(`URL:${escapeIcsText(effectiveUrl)}`);
    }

    lines.push('END:VEVENT');
    return lines.join('\r\n');
};

export const buildCalendarIcs = ({
    calendarLabel,
    events,
    source,
    method = 'PUBLISH',
}: BuildCalendarIcsOptions): string => {
    const appName = trimToOptional(source?.appName) || APP_NAME;
    const sourceUrl = trimToOptional(source?.sourceUrl);
    const prodIdLabel = trimToOptional(calendarLabel) || 'Calendar';
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:-//${appName}//${prodIdLabel}//EN`,
        'CALSCALE:GREGORIAN',
        `METHOD:${method}`,
        ...events.map((event, index) => buildCalendarIcsEvent(event, index, source)),
    ];

    if (sourceUrl) {
        lines.push(`URL:${escapeIcsText(sourceUrl)}`);
    }

    lines.push('END:VCALENDAR', '');
    return lines.join('\r\n');
};
