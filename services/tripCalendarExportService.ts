import { APP_NAME } from '../config/appGlobals';
import type { ITrip, ITimelineItem } from '../types';
import { addDays, buildTripUrl } from '../utils';
import { normalizeTransportMode } from '../shared/transportModes';
import { buildCalendarIcs, sanitizeCalendarFileName, type CalendarIcsEvent } from './calendarIcsService';

export type TripCalendarExportScope = 'activity' | 'activities' | 'cities' | 'all';

export interface BuildTripCalendarExportInput {
    trip: ITrip;
    scope: TripCalendarExportScope;
    activityId?: string;
    versionId?: string | null;
}

export interface TripCalendarExportBundle {
    scope: TripCalendarExportScope;
    fileName: string;
    tripUrl: string;
    eventCount: number;
    ics: string;
}

const DEFAULT_SITE_URL = 'https://travelflowapp.netlify.app';
const MIN_EVENT_DURATION_MS = 60 * 60 * 1000;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

const TRANSPORT_MODE_LABEL: Record<string, string> = {
    plane: 'Flight',
    train: 'Train',
    bus: 'Bus',
    boat: 'Boat',
    car: 'Car',
    motorcycle: 'Motorcycle',
    bicycle: 'Bicycle',
    walk: 'Walk',
    na: 'Transfer',
};

const trimToOptional = (value?: string | null): string | undefined => {
    const normalized = (value || '').trim();
    return normalized.length > 0 ? normalized : undefined;
};

const normalizeSiteOrigin = (value?: string | null): string | null => {
    const raw = trimToOptional(value);
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.origin.replace(/\/+$/, '');
    } catch {
        return null;
    }
};

const isLocalOrigin = (origin: string): boolean => {
    try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();
        return LOCAL_HOSTNAMES.has(host) || host.endsWith('.local');
    } catch {
        return true;
    }
};

export const resolvePublicSiteOrigin = (): string => {
    const envSiteUrl = normalizeSiteOrigin((import.meta as { env?: Record<string, unknown> }).env?.VITE_SITE_URL as string | undefined);
    if (envSiteUrl && !isLocalOrigin(envSiteUrl)) return envSiteUrl;

    if (typeof window !== 'undefined' && window.location) {
        const browserOrigin = normalizeSiteOrigin(window.location.origin);
        if (browserOrigin && !isLocalOrigin(browserOrigin)) return browserOrigin;
    }

    return DEFAULT_SITE_URL;
};

const parseTripStartDateLocal = (value: string): Date => {
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
        return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
};

const buildDateFromOffset = (baseDate: Date, offset: number): Date => {
    const safeOffset = Number.isFinite(offset) ? offset : 0;
    const dayOffset = Math.floor(safeOffset);
    const fractionalOffset = safeOffset - dayOffset;
    const totalMinutes = Math.round(fractionalOffset * 24 * 60);
    const date = addDays(baseDate, dayOffset);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(totalMinutes);
    return date;
};

const buildItemDateRange = (item: ITimelineItem, baseDate: Date): { start: Date; end: Date } => {
    const start = buildDateFromOffset(baseDate, item.startDateOffset);
    const duration = Number.isFinite(item.duration) && item.duration > 0 ? item.duration : (item.type === 'city' ? 1 : 0.25);
    const end = buildDateFromOffset(baseDate, item.startDateOffset + duration);
    if (end.getTime() <= start.getTime()) {
        return {
            start,
            end: new Date(start.getTime() + MIN_EVENT_DURATION_MS),
        };
    }
    return { start, end };
};

const buildHotelNotes = (city: ITimelineItem): string | undefined => {
    const hotels = Array.isArray(city.hotels) ? city.hotels : [];
    if (hotels.length === 0) return undefined;
    const lines = hotels
        .map((hotel) => {
            const name = trimToOptional(hotel.name) || 'Accommodation';
            const address = trimToOptional(hotel.address);
            return address ? `- ${name} (${address})` : `- ${name}`;
        });
    return lines.length > 0 ? `Accommodations:\n${lines.join('\n')}` : undefined;
};

const buildActivityOwnerCityMap = (trip: ITrip): Map<string, ITimelineItem> => {
    const cityItems = trip.items
        .filter((item): item is ITimelineItem => item.type === 'city')
        .sort((left, right) => left.startDateOffset - right.startDateOffset);
    const map = new Map<string, ITimelineItem>();
    trip.items
        .filter((item): item is ITimelineItem => item.type === 'activity')
        .forEach((activity) => {
            const ownerCity = cityItems.find((city) => (
                activity.startDateOffset >= city.startDateOffset
                && activity.startDateOffset < city.startDateOffset + Math.max(city.duration, 0)
            )) || [...cityItems].reverse().find((city) => city.startDateOffset <= activity.startDateOffset) || cityItems[0];
            if (ownerCity) {
                map.set(activity.id, ownerCity);
            }
        });
    return map;
};

const buildCalendarEventId = (scope: TripCalendarExportScope, item: ITimelineItem, index: number): string => {
    return sanitizeCalendarFileName(`${scope}-${item.id || item.title || 'event'}-${index + 1}`);
};

const buildActivityEvent = (
    item: ITimelineItem,
    index: number,
    baseDate: Date,
    ownerCity?: ITimelineItem,
): CalendarIcsEvent => {
    const dateRange = buildItemDateRange(item, baseDate);
    const details: string[] = [];
    const ownerCityTitle = trimToOptional(ownerCity?.title || ownerCity?.location);
    const itemLocation = trimToOptional(item.location);

    if (ownerCityTitle) details.push(`City: ${ownerCityTitle}`);
    if (itemLocation) details.push(`Location: ${itemLocation}`);
    if (trimToOptional(item.description)) details.push(item.description!.trim());

    return {
        id: buildCalendarEventId('activities', item, index),
        title: item.title || 'Planned activity',
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        location: itemLocation || ownerCityTitle,
        description: details.join('\n\n') || undefined,
    };
};

const buildCityEvent = (item: ITimelineItem, index: number, baseDate: Date): CalendarIcsEvent => {
    const dateRange = buildItemDateRange(item, baseDate);
    const details: string[] = [];
    const location = trimToOptional(item.location || item.title);
    const hotelNotes = buildHotelNotes(item);

    if (trimToOptional(item.countryName)) {
        details.push(`Country: ${item.countryName!.trim()}`);
    }
    if (hotelNotes) details.push(hotelNotes);
    if (trimToOptional(item.description)) details.push(`Notes:\n${item.description!.trim()}`);

    return {
        id: buildCalendarEventId('cities', item, index),
        title: `Stay in ${item.title || item.location || 'city'}`,
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        location,
        description: details.join('\n\n') || undefined,
    };
};

const resolveTravelCities = (
    travelItem: ITimelineItem,
    cityItems: ITimelineItem[],
): { fromCity?: ITimelineItem; toCity?: ITimelineItem } => {
    const fromCity = [...cityItems]
        .reverse()
        .find((city) => city.startDateOffset <= travelItem.startDateOffset);
    const toCity = cityItems.find((city) => city.startDateOffset >= travelItem.startDateOffset + travelItem.duration)
        || cityItems.find((city) => city.startDateOffset > travelItem.startDateOffset);
    return { fromCity, toCity };
};

const buildTravelEvent = (
    item: ITimelineItem,
    index: number,
    baseDate: Date,
    cityItems: ITimelineItem[],
): CalendarIcsEvent => {
    const dateRange = buildItemDateRange(item, baseDate);
    const normalizedMode = normalizeTransportMode(item.transportMode);
    const modeLabel = TRANSPORT_MODE_LABEL[normalizedMode] || TRANSPORT_MODE_LABEL.na;
    const { fromCity, toCity } = resolveTravelCities(item, cityItems);
    const fromTitle = trimToOptional(fromCity?.title || fromCity?.location);
    const toTitle = trimToOptional(toCity?.title || toCity?.location);
    const details: string[] = [];

    if (fromTitle && toTitle) {
        details.push(`Route: ${fromTitle} → ${toTitle}`);
    } else if (fromTitle || toTitle) {
        details.push(`Route: ${fromTitle || 'Unknown'} → ${toTitle || 'Unknown'}`);
    }

    if (trimToOptional(item.description)) details.push(item.description!.trim());
    if (trimToOptional(item.departureTime)) details.push(`Departure: ${item.departureTime!.trim()}`);

    const titleBase = fromTitle && toTitle
        ? `${modeLabel}: ${fromTitle} → ${toTitle}`
        : (item.title || `${modeLabel} transfer`);

    return {
        id: buildCalendarEventId('all', item, index),
        title: titleBase,
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        location: fromTitle && toTitle ? `${fromTitle} → ${toTitle}` : undefined,
        description: details.join('\n\n') || undefined,
    };
};

const sortByStartOffset = (items: ITimelineItem[]): ITimelineItem[] => {
    return [...items].sort((left, right) => {
        if (left.startDateOffset !== right.startDateOffset) return left.startDateOffset - right.startDateOffset;
        return left.title.localeCompare(right.title);
    });
};

export const buildTripCalendarExport = ({
    trip,
    scope,
    activityId,
    versionId,
}: BuildTripCalendarExportInput): TripCalendarExportBundle | null => {
    const baseDate = parseTripStartDateLocal(trip.startDate);
    const siteOrigin = resolvePublicSiteOrigin();
    const tripUrl = new URL(buildTripUrl(trip.id, versionId), siteOrigin).toString();
    const cityItems = sortByStartOffset(trip.items.filter((item): item is ITimelineItem => item.type === 'city'));
    const activityItems = sortByStartOffset(trip.items.filter((item): item is ITimelineItem => item.type === 'activity'));
    const travelItems = sortByStartOffset(trip.items.filter((item): item is ITimelineItem => item.type === 'travel'));
    const activityOwnerCityMap = buildActivityOwnerCityMap(trip);

    let events: CalendarIcsEvent[] = [];
    let fileNameSuffix = scope;

    if (scope === 'activity') {
        if (!activityId) return null;
        const selectedActivity = activityItems.find((item) => item.id === activityId);
        if (!selectedActivity) return null;
        const ownerCity = activityOwnerCityMap.get(selectedActivity.id);
        events = [buildActivityEvent(selectedActivity, 0, baseDate, ownerCity)];
        fileNameSuffix = sanitizeCalendarFileName(selectedActivity.title || 'activity');
    } else if (scope === 'activities') {
        events = activityItems.map((item, index) => buildActivityEvent(item, index, baseDate, activityOwnerCityMap.get(item.id)));
    } else if (scope === 'cities') {
        events = cityItems.map((item, index) => buildCityEvent(item, index, baseDate));
    } else {
        const cityEvents = cityItems.map((item, index) => buildCityEvent(item, index, baseDate));
        const activityEvents = activityItems.map((item, index) => buildActivityEvent(item, index, baseDate, activityOwnerCityMap.get(item.id)));
        const travelEvents = travelItems.map((item, index) => buildTravelEvent(item, index, baseDate, cityItems));
        events = [...cityEvents, ...activityEvents, ...travelEvents].sort((left, right) => (
            new Date(left.start).getTime() - new Date(right.start).getTime()
        ));
    }

    if (events.length === 0) return null;

    const safeTripTitle = sanitizeCalendarFileName(trip.title || 'trip');
    const safeSuffix = sanitizeCalendarFileName(fileNameSuffix);
    const fileName = sanitizeCalendarFileName(`${safeTripTitle}-${safeSuffix}`);
    const ics = buildCalendarIcs({
        calendarLabel: 'Trip Itinerary',
        events,
        source: {
            appName: APP_NAME,
            sourceUrl: tripUrl,
        },
    });

    return {
        scope,
        fileName,
        tripUrl,
        eventCount: events.length,
        ics,
    };
};

export const downloadTripCalendarExport = (bundle: TripCalendarExportBundle): boolean => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const blob = new Blob([bundle.ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${bundle.fileName}.ics`;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        return true;
    } finally {
        URL.revokeObjectURL(url);
    }
};
