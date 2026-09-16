import type { IHotel, ITimelineItem, ITrip } from '../../types';
import { buildApprovedCityRoute, findTravelBetweenCities, getHexFromColorClass } from '../../utils';
import { getTripRangeOffsets } from '../../shared/tripSpan';
import { normalizeTransportMode } from '../../shared/transportModes';
import { TRANSPORT_MODE_LABEL } from './timelineListViewModel';

const OFFSET_EPSILON = 0.0001;
const MAX_PLANNED_DAYS = 400;
const MINUTES_PER_DAY = 24 * 60;

export interface MobileDayPlanTransfer {
    item: ITimelineItem | null;
    mode: string;
    modeLabel: string;
    fromCityTitle: string;
    toCityTitle: string;
    departureTime: string | null;
    /** Departure time plus the leg duration; null when the departure time is unknown. */
    arrivalTime: string | null;
    /** Calendar days the leg crosses, so an overnight arrival is not read as same-day. */
    arrivalDayShift: number;
    durationHours: number | null;
    durationLabel: string | null;
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
    /** Last day of the stay, which is when the traveller moves on. */
    isDepartureDay: boolean;
    /** Leg that brought the traveller here, present on the arrival day only. */
    arrival: MobileDayPlanTransfer | null;
    /** Leg that leaves today, present on the departure day only. */
    departure: MobileDayPlanTransfer | null;
    /** Hotel the stay checks into today, when the trip records one. */
    hotelCheckIn: IHotel | null;
    /** Hotel the stay checks out of today. */
    hotelCheckOut: IHotel | null;
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

const parseClockMinutes = (value: string | undefined): number | null => {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
};

const formatClock = (totalMinutes: number): string => {
    const normalized = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatTransferDurationLabel = (durationHours: number | null): string | null => {
    if (!durationHours || !Number.isFinite(durationHours) || durationHours <= 0) return null;
    if (durationHours < 1) {
        const minutes = Math.round(durationHours * 60);
        return minutes > 0 ? `${minutes} min` : null;
    }
    if (durationHours >= 24) {
        const days = durationHours / 24;
        return Number.isInteger(days) ? `${days.toFixed(0)} d` : `${days.toFixed(1)} d`;
    }
    return Number.isInteger(durationHours) ? `${durationHours.toFixed(0)} h` : `${durationHours.toFixed(1)} h`;
};

const buildTransfer = (
    travelItem: ITimelineItem | null,
    fromCity: ITimelineItem,
    toCity: ITimelineItem,
): MobileDayPlanTransfer => {
    const mode = normalizeTransportMode(travelItem?.transportMode);
    const rawDurationHours = travelItem ? Math.max(0, travelItem.duration) * 24 : null;
    const durationHours = rawDurationHours !== null && Number.isFinite(rawDurationHours)
        ? Math.round(rawDurationHours * 10) / 10
        : null;

    const departureMinutes = parseClockMinutes(travelItem?.departureTime);
    let arrivalTime: string | null = null;
    let arrivalDayShift = 0;
    if (departureMinutes !== null && durationHours !== null && durationHours > 0) {
        const arrivalMinutes = departureMinutes + Math.round(durationHours * 60);
        arrivalTime = formatClock(arrivalMinutes);
        arrivalDayShift = Math.floor(arrivalMinutes / MINUTES_PER_DAY);
    }

    return {
        item: travelItem,
        mode,
        modeLabel: TRANSPORT_MODE_LABEL[mode] || TRANSPORT_MODE_LABEL.na,
        fromCityTitle: fromCity.title?.trim() || fromCity.location?.trim() || '',
        toCityTitle: toCity.title?.trim() || toCity.location?.trim() || '',
        departureTime: departureMinutes !== null ? formatClock(departureMinutes) : null,
        arrivalTime,
        arrivalDayShift,
        durationHours,
        durationLabel: formatTransferDurationLabel(durationHours),
    };
};

const findStayHotel = (city: ITimelineItem | null): IHotel | null => {
    if (!city?.hotels?.length) return null;
    return city.hotels.find((hotel) => hotel.name?.trim() || hotel.address?.trim()) ?? null;
};

interface CityDayRange {
    startDay: number;
    endDay: number;
}

/**
 * Resolves each stay to a whole-day range that no other stay overlaps.
 *
 * Rounding a fractional offset independently per city lets two stays claim the
 * same calendar day — the day the traveller moves. The earlier stay then wins
 * the day lookup and the later one never reports an arrival at all, so its
 * arrival row and hotel check-in silently disappeared. Anchoring each start to
 * the previous stay's end keeps the sequence contiguous.
 */
const buildCityDayRanges = (cities: ITimelineItem[]): CityDayRange[] => {
    let cursor = 0;
    return cities.map((city, index) => {
        const rawStartDay = toDayOffset(city.startDateOffset);
        const startDay = index === 0 ? rawStartDay : Math.max(rawStartDay, cursor);
        const rawEndDay = Math.ceil(city.startDateOffset + Math.max(0, city.duration) - OFFSET_EPSILON);
        const endDay = Math.max(startDay + 1, rawEndDay);
        cursor = endDay;
        return { startDay, endDay };
    });
};

/**
 * Builds one entry per calendar day of the trip.
 *
 * The timeline list view groups by city, which works when the whole itinerary
 * scrolls past. The mobile planner navigates a single day at a time, so it
 * needs the inverse shape: every day resolved to its stay, the legs that start
 * and end it, and the activities that fall inside it.
 */
export const buildMobileDayPlan = (
    trip: ITrip,
    options: { today?: Date; locale?: string } = {},
): MobileDayPlanDay[] => {
    const tripStart = parseLocalDate(trip.startDate);
    if (!tripStart) return [];

    const locale = options.locale || undefined;
    const cities = buildApprovedCityRoute(trip.items);
    const cityRanges = buildCityDayRanges(cities);
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

        const cityIndex = cityRanges.findIndex(
            ({ startDay, endDay }) => dayOffset >= startDay && dayOffset < endDay,
        );
        const city = cityIndex >= 0 ? cities[cityIndex] : null;
        const previousCity = cityIndex > 0 ? cities[cityIndex - 1] : null;
        const nextCity = cityIndex >= 0 ? cities[cityIndex + 1] ?? null : null;
        const cityRange = cityIndex >= 0 ? cityRanges[cityIndex] : null;
        const isArrivalDay = Boolean(cityRange) && cityRange!.startDay === dayOffset;
        // A departure belongs to the last day of the outgoing stay, not to the
        // arrival day of the next city. Travel items usually carry the boundary
        // offset itself, which would otherwise file the departure under the day
        // the traveller arrives somewhere else.
        const isDepartureDay = Boolean(cityRange) && cityRange!.endDay - 1 === dayOffset;

        const arrival = city && previousCity && isArrivalDay
            ? buildTransfer(findTravelBetweenCities(trip.items, previousCity, city), previousCity, city)
            : null;
        const departure = city && nextCity && isDepartureDay
            ? buildTransfer(findTravelBetweenCities(trip.items, city, nextCity), city, nextCity)
            : null;

        const stayHotel = findStayHotel(city);

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
            isArrivalDay,
            isDepartureDay,
            arrival,
            departure,
            hotelCheckIn: isArrivalDay ? stayHotel : null,
            hotelCheckOut: isDepartureDay ? stayHotel : null,
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
        || day.departure?.item?.id === itemId
        || day.arrival?.item?.id === itemId
        || day.activities.some((activity) => activity.id === itemId)
    ));
};

/** How a strip node joins the node before or after it. */
export type MobileDayStripLink = 'none' | 'stay' | 'transfer';

export type MobileDayStripNode =
    | {
        kind: 'day';
        key: string;
        dayIndex: number;
        day: MobileDayPlanDay;
        linkBefore: MobileDayStripLink;
        linkAfter: MobileDayStripLink;
    }
    | {
        kind: 'transfer';
        key: string;
        /** Index of the day the leg departs on, which is what the strip selects. */
        dayIndex: number;
        transfer: MobileDayPlanTransfer;
        cityColorHex: string;
    };

/**
 * Interleaves the days with the legs between stays.
 *
 * The strip reads as one continuous route: days of the same stay are joined by
 * a line in the stay's colour, and a change of city is a separate, smaller node
 * carrying the leg's schedule.
 */
export const buildMobileDayStripNodes = (days: MobileDayPlanDay[]): MobileDayStripNode[] => {
    const nodes: MobileDayStripNode[] = [];

    days.forEach((day, index) => {
        const previousDay = index > 0 ? days[index - 1] : null;
        const nextDay = index < days.length - 1 ? days[index + 1] : null;
        const sharesStayWithPrevious = Boolean(previousDay?.city && day.city && previousDay.city.id === day.city.id);
        const sharesStayWithNext = Boolean(nextDay?.city && day.city && nextDay.city.id === day.city.id);
        const hasOutgoingLeg = Boolean(day.departure) && Boolean(nextDay);

        nodes.push({
            kind: 'day',
            key: `day-${day.dayOffset}`,
            dayIndex: index,
            day,
            linkBefore: index === 0
                ? 'none'
                : (sharesStayWithPrevious ? 'stay' : 'transfer'),
            linkAfter: !nextDay
                ? 'none'
                : (hasOutgoingLeg ? 'transfer' : (sharesStayWithNext ? 'stay' : 'transfer')),
        });

        if (hasOutgoingLeg && day.departure) {
            nodes.push({
                kind: 'transfer',
                key: `transfer-${day.dayOffset}`,
                dayIndex: index,
                transfer: day.departure,
                cityColorHex: day.cityColorHex,
            });
        }
    });

    return nodes;
};
