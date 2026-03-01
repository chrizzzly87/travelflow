import type { ITrip, ITimelineItem } from '../../types';
import { buildApprovedCityRoute, findTravelBetweenCities, getHexFromColorClass } from '../../utils';
import { normalizeTransportMode } from '../../shared/transportModes';

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_EPSILON = 0.0001;

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

export interface TimelineListActivity {
    item: ITimelineItem;
    dayOffset: number;
    isToday: boolean;
}

export interface TimelineListTransfer {
    itemId: string | null;
    mode: string;
    modeLabel: string;
    durationHours: number | null;
    title: string;
    description?: string;
}

export interface TimelineListSection {
    city: ITimelineItem;
    colorHex: string;
    arrivalTitle: string;
    arrivalDescription?: string;
    incomingTransfer: TimelineListTransfer | null;
    activities: TimelineListActivity[];
    hasToday: boolean;
    todayMarkerId: string | null;
}

export interface TimelineListModel {
    sections: TimelineListSection[];
    todayMarkerId: string | null;
}

const toDayOffset = (offset: number): number => Math.max(0, Math.floor(offset + OFFSET_EPSILON));

const getDayDiff = (startDate: string, now: Date): number | null => {
    if (!startDate) return null;
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;

    const startAtNoon = new Date(start);
    startAtNoon.setHours(12, 0, 0, 0);
    const nowAtNoon = new Date(now);
    nowAtNoon.setHours(12, 0, 0, 0);

    return Math.round((nowAtNoon.getTime() - startAtNoon.getTime()) / DAY_MS);
};

const buildIncomingTransfer = (
    previousCity: ITimelineItem | null,
    travelItem: ITimelineItem | null,
): TimelineListTransfer | null => {
    if (!previousCity) return null;

    const normalizedMode = normalizeTransportMode(travelItem?.transportMode);
    const modeLabel = TRANSPORT_MODE_LABEL[normalizedMode] || TRANSPORT_MODE_LABEL.na;
    const durationHours = travelItem
        ? Math.round(Math.max(0, travelItem.duration) * 24 * 10) / 10
        : null;

    return {
        itemId: travelItem?.id ?? null,
        mode: normalizedMode,
        modeLabel,
        durationHours: durationHours && Number.isFinite(durationHours) ? durationHours : null,
        title: travelItem?.title?.trim() || `${modeLabel} transfer`,
        description: travelItem?.description?.trim() || undefined,
    };
};

const buildArrivalContext = (
    city: ITimelineItem,
    previousCity: ITimelineItem | null,
    transfer: TimelineListTransfer | null,
    departureTime?: string,
): { title: string; description?: string } => {
    if (!previousCity) {
        return {
            title: 'Trip start',
            description: city.description?.trim() || undefined,
        };
    }

    const modeLabel = transfer?.modeLabel || TRANSPORT_MODE_LABEL.na;
    const titleParts = [`From ${previousCity.title || previousCity.location || 'previous stop'}`, `via ${modeLabel}`];
    if (departureTime) {
        titleParts.push(`around ${departureTime}`);
    }

    const descriptionParts = [transfer?.title?.trim(), transfer?.description?.trim()]
        .filter((value): value is string => Boolean(value));

    return {
        title: titleParts.join(' '),
        description: descriptionParts.length > 0 ? descriptionParts.join(' · ') : undefined,
    };
};

export const buildTimelineListModel = (
    trip: ITrip,
    options: { today?: Date } = {},
): TimelineListModel => {
    const todayOffset = getDayDiff(trip.startDate, options.today ?? new Date());
    const cities = buildApprovedCityRoute(trip.items);
    const activities = trip.items
        .filter((item): item is ITimelineItem => item.type === 'activity')
        .sort((left, right) => {
            if (left.startDateOffset !== right.startDateOffset) return left.startDateOffset - right.startDateOffset;
            if (left.duration !== right.duration) return left.duration - right.duration;
            return left.title.localeCompare(right.title);
        });

    let firstTodayMarkerId: string | null = null;
    const sections: TimelineListSection[] = cities.map((city, index) => {
        const previousCity = index > 0 ? cities[index - 1] : null;
        const travelItem = previousCity ? findTravelBetweenCities(trip.items, previousCity, city) : null;
        const incomingTransfer = buildIncomingTransfer(previousCity, travelItem);
        const cityStart = city.startDateOffset;
        const cityEnd = city.startDateOffset + Math.max(0, city.duration);
        const cityStartDay = toDayOffset(cityStart);
        const cityEndDay = Math.max(cityStartDay + 1, Math.ceil(cityEnd - OFFSET_EPSILON));

        const sectionActivities = activities
            .filter((activity) => activity.startDateOffset >= (cityStart - OFFSET_EPSILON) && activity.startDateOffset < (cityEnd - OFFSET_EPSILON))
            .map((activity) => {
                const dayOffset = toDayOffset(activity.startDateOffset);
                const isToday = todayOffset !== null && dayOffset === todayOffset;
                return {
                    item: activity,
                    dayOffset,
                    isToday,
                };
            });

        const todayActivity = sectionActivities.find((activity) => activity.isToday) || null;
        const hasTodayInCityWindow = todayOffset !== null && todayOffset >= cityStartDay && todayOffset < cityEndDay;
        const hasToday = Boolean(todayActivity) || hasTodayInCityWindow;
        const todayMarkerId = todayActivity
            ? `activity-${todayActivity.item.id}`
            : hasToday
                ? `city-${city.id}`
                : null;

        if (!firstTodayMarkerId && todayMarkerId) {
            firstTodayMarkerId = todayMarkerId;
        }

        const arrivalContext = buildArrivalContext(city, previousCity, incomingTransfer, travelItem?.departureTime);
        return {
            city,
            colorHex: getHexFromColorClass(city.color || ''),
            arrivalTitle: arrivalContext.title,
            arrivalDescription: arrivalContext.description,
            incomingTransfer,
            activities: sectionActivities,
            hasToday,
            todayMarkerId,
        };
    });

    return {
        sections,
        todayMarkerId: firstTodayMarkerId,
    };
};
