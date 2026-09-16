import type { ITimelineItem, ITrip } from '../../types';
import { buildApprovedCityRoute, findTravelBetweenCities, getHexFromColorClass } from '../../utils';
import { getTripRangeOffsets } from '../../shared/tripSpan';
import { normalizeTransportMode } from '../../shared/transportModes';

const OFFSET_EPSILON = 0.0001;
const MAX_PLANNED_DAYS = 400;

export interface MobileDayPlanTransfer {
    item: ITimelineItem | null;
    mode: string;
    fromCityTitle: string;
    toCityTitle: string;
    departureTime?: string;
    durationHours: number | null;
}

export interface MobileDayPlanDay {
    /** Whole-day offset from `trip.startDate`. */
    dayOffset: number;
    /** Sequential label shown on the pill, 1-indexed. */
    dayNumber: number;
    date: Date;
    weekdayLabel: string;
    dayOfMonthLabel: string;
    monthLabel: string;
    fullDateLabel: string;
    city: ITimelineItem | null;
    cityColorHex: string;
    /** The stay starts on this day, so the panel leads with the arrival. */
    isArrivalDay: boolean;
    /** Transfer that departs on this day, if any. */
    transfer: MobileDayPlanTransfer | null;
    activities: ITimelineItem[];
    isToday: boolean;
}

const toDayOffset = (offset: number): number => Math.max(0, Math.floor(offset + OFFSET_EPSILON));

const parseLocalDate = (dateValue: string): Date | null => {
    const [year, month, day] = String(dateValue || '').split('-').map(Number);
    if (
        Number.isInteger(year)
        && Number.isInteger(month)
        && Number.isInteger(day)
        && month >= 1 && month <= 12
        && day >= 1 && day <= 31
    ) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(12, 0, 0, 0);
    return parsed;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const getTodayOffset = (tripStart: Date | null, today: Date): number | null => {
    if (!tripStart) return null;
    const nowAtNoon = new Date(today);
    nowAtNoon.setHours(12, 0, 0, 0);
    return Math.round((nowAtNoon.getTime() - tripStart.getTime()) / (24 * 60 * 60 * 1000));
};

/**
 * Builds one entry per calendar day of the trip.
 *
 * The timeline list view groups by city, which works when the whole itinerary
 * scrolls past. The mobile planner navigates a single day at a time, so it
 * needs the inverse shape: every day resolved to its stay, its departure and
 * the activities that fall inside it.
 */
export const buildMobileDayPlan = (
    trip: ITrip,
    options: { today?: Date; locale?: string } = {},
): MobileDayPlanDay[] => {
    const tripStart = parseLocalDate(trip.startDate);
    if (!tripStart) return [];

    const locale = options.locale || undefined;
    const cities = buildApprovedCityRoute(trip.items);
    const range = getTripRangeOffsets(trip);
    const firstDay = toDayOffset(range.startOffset);
    const lastDay = Math.max(firstDay, Math.ceil(range.endOffset - OFFSET_EPSILON) - 1);
    const dayCount = Math.min(MAX_PLANNED_DAYS, Math.max(1, lastDay - firstDay + 1));
    const todayOffset = getTodayOffset(tripStart, options.today ?? new Date());

    const activities = trip.items
        .filter((item) => item.type === 'activity')
        .sort((left, right) => {
            if (left.startDateOffset !== right.startDateOffset) return left.startDateOffset - right.startDateOffset;
            if (left.duration !== right.duration) return left.duration - right.duration;
            return left.title.localeCompare(right.title);
        });

    return Array.from({ length: dayCount }, (_, index) => {
        const dayOffset = firstDay + index;
        const date = addDays(tripStart, dayOffset);

        const cityIndex = cities.findIndex((city) => {
            const start = toDayOffset(city.startDateOffset);
            const end = Math.max(start + 1, Math.ceil(city.startDateOffset + Math.max(0, city.duration) - OFFSET_EPSILON));
            return dayOffset >= start && dayOffset < end;
        });
        const city = cityIndex >= 0 ? cities[cityIndex] : null;
        const nextCity = cityIndex >= 0 ? cities[cityIndex + 1] ?? null : null;

        // A transfer belongs to the last day of the outgoing stay, not to the
        // arrival day of the next city. Travel items usually carry the boundary
        // offset itself, which would otherwise file the departure under the day
        // the traveller arrives somewhere else.
        let transfer: MobileDayPlanTransfer | null = null;
        if (city && nextCity) {
            const cityStartDay = toDayOffset(city.startDateOffset);
            const cityEndDay = Math.max(
                cityStartDay + 1,
                Math.ceil(city.startDateOffset + Math.max(0, city.duration) - OFFSET_EPSILON),
            );
            if (cityEndDay - 1 === dayOffset) {
                const travelItem = findTravelBetweenCities(trip.items, city, nextCity);
                const rawDuration = travelItem ? Math.max(0, travelItem.duration) * 24 : null;
                transfer = {
                    item: travelItem ?? null,
                    mode: normalizeTransportMode(travelItem?.transportMode),
                    fromCityTitle: city.title || city.location || '',
                    toCityTitle: nextCity.title || nextCity.location || '',
                    departureTime: travelItem?.departureTime,
                    durationHours: rawDuration && Number.isFinite(rawDuration)
                        ? Math.round(rawDuration * 10) / 10
                        : null,
                };
            }
        }

        return {
            dayOffset,
            dayNumber: index + 1,
            date,
            weekdayLabel: date.toLocaleDateString(locale, { weekday: 'short' }),
            dayOfMonthLabel: date.toLocaleDateString(locale, { day: 'numeric' }),
            monthLabel: date.toLocaleDateString(locale, { month: 'short' }),
            fullDateLabel: date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
            city,
            cityColorHex: city ? getHexFromColorClass(city.color || '') : '',
            isArrivalDay: Boolean(city) && toDayOffset(city!.startDateOffset) === dayOffset,
            transfer,
            activities: activities.filter((activity) => toDayOffset(activity.startDateOffset) === dayOffset),
            isToday: todayOffset !== null && todayOffset === dayOffset,
        };
    });
};

export const findMobileDayPlanIndexForItem = (
    days: MobileDayPlanDay[],
    itemId: string | null,
): number => {
    if (!itemId) return -1;
    return days.findIndex((day) => (
        day.city?.id === itemId
        || day.transfer?.item?.id === itemId
        || day.activities.some((activity) => activity.id === itemId)
    ));
};
