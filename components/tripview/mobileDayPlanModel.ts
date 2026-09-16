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

/**
 * How a leg relates to the day it is shown on.
 *
 * `handover` is the common case once a stay carries half-day offsets: the
 * traveller leaves one city and reaches the next inside the same day.
 */
export type MobileDayPlanLegRole = 'handover' | 'departure' | 'arrival';

export interface MobileDayPlanLeg extends MobileDayPlanTransfer {
    role: MobileDayPlanLegRole;
}

/** One stay the traveller is in for part of a day, in travel order. */
export interface MobileDayPlanStay {
    id: string;
    title: string;
    colorHex: string;
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
    /**
     * Every stay the day touches, in travel order — one on an ordinary day,
     * more when the traveller changes city inside it. The strip paints the
     * day's ring from these, so a day spent in three cities cannot lose the
     * one in the middle.
     */
    stays: MobileDayPlanStay[];
    /** Stay the traveller ends the day in. */
    city: ITimelineItem | null;
    cityColorHex: string;
    /** Stay left behind today, set only when a handover happens inside this day. */
    departingCity: ITimelineItem | null;
    departingCityColorHex: string;
    /** True when the traveller changes city within this day. */
    isHandoverDay: boolean;
    /** The stay starts on this day, so the panel leads with the arrival. */
    isArrivalDay: boolean;
    /** The stay ends on this day, which is when the traveller moves on. */
    isDepartureDay: boolean;
    /** Every leg that happens today, in travel order. */
    legs: MobileDayPlanLeg[];
    /** Hotel the stay checks into today, when the trip records one. */
    hotelCheckIn: IHotel | null;
    /** Hotel the stay checks out of today. */
    hotelCheckOut: IHotel | null;
    activities: ITimelineItem[];
    isToday: boolean;
}

const toDayOffset = (offset: number): number => Math.max(0, Math.floor(offset + OFFSET_EPSILON));

/**
 * Day an interval ends on.
 *
 * An interval closing exactly on a day boundary belongs to the day it was lived
 * through, not to the one starting at that instant — a stay running 0 to 3 ends
 * on day 2. `toDayOffset` cannot express this: it rounds a boundary up.
 */
const toIntervalEndDay = (start: number, end: number): number => Math.max(
    toDayOffset(start),
    Math.max(0, Math.ceil(end - OFFSET_EPSILON) - 1),
);

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

interface CityStayWindow {
    city: ITimelineItem;
    start: number;
    end: number;
}

interface CityLegWindow {
    fromCity: ITimelineItem;
    toCity: ITimelineItem;
    travelItem: ITimelineItem | null;
    departureDay: number;
    arrivalDay: number;
}

const buildCityStayWindows = (cities: ITimelineItem[]): CityStayWindow[] => (
    cities.map((city) => ({
        city,
        start: city.startDateOffset,
        end: city.startDateOffset + Math.max(0, city.duration),
    }))
);

/**
 * Resolves the legs between stays to the days they are travelled on.
 *
 * A stay normally ends on a half-day offset and the next begins at the same
 * point, so a leg usually departs and arrives inside one day. Only an
 * overnight leg spans two, and the two cases have to read differently: one is
 * a handover the traveller lives through, the other is a night in transit.
 */
const buildCityLegWindows = (
    items: ITimelineItem[],
    stays: CityStayWindow[],
): CityLegWindow[] => (
    stays.slice(0, -1).map((stay, index) => {
        const nextStay = stays[index + 1];
        const travelItem = findTravelBetweenCities(items, stay.city, nextStay.city);
        const travelStart = travelItem ? travelItem.startDateOffset : stay.end;
        const travelEnd = travelItem
            ? travelItem.startDateOffset + Math.max(0, travelItem.duration)
            : nextStay.start;

        return {
            fromCity: stay.city,
            toCity: nextStay.city,
            travelItem: travelItem ?? null,
            departureDay: toDayOffset(travelStart),
            arrivalDay: toIntervalEndDay(travelStart, travelEnd),
        };
    })
);

/**
 * A leg is a handover only when the traveller actually spends part of the day
 * in both cities. A leg that departs on a whole-day boundary reads as a plain
 * arrival, because the day it lands on contains none of the city it left.
 */
const resolveLegRole = (
    leg: CityLegWindow,
    dayOffset: number,
    stayIdsToday: ReadonlySet<string>,
): MobileDayPlanLegRole | null => {
    const departsToday = leg.departureDay === dayOffset;
    const arrivesToday = leg.arrivalDay === dayOffset;
    if (!departsToday && !arrivesToday) return null;

    const spansBothStays = stayIdsToday.has(leg.fromCity.id) && stayIdsToday.has(leg.toCity.id);
    if (departsToday && arrivesToday && spansBothStays) return 'handover';
    if (arrivesToday) return 'arrival';
    return 'departure';
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
    const stays = buildCityStayWindows(cities);
    const legs = buildCityLegWindows(trip.items, stays);
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

        // Stays are matched by overlap rather than by rounding each one to whole
        // days: a half-day offset means two stays legitimately share the day the
        // traveller moves, and rounding them apart hid one of them entirely.
        const overlappingStays = stays.filter((stay) => (
            stay.start < dayOffset + 1 - OFFSET_EPSILON
            && stay.end > dayOffset + OFFSET_EPSILON
        ));
        const arrivingStay = overlappingStays[overlappingStays.length - 1] ?? null;
        const departingStay = overlappingStays.length > 1 ? overlappingStays[0] : null;
        const city = arrivingStay?.city ?? null;

        const stayIdsToday = new Set(overlappingStays.map((stay) => stay.city.id));
        const dayLegs: MobileDayPlanLeg[] = legs.flatMap((leg) => {
            const role = resolveLegRole(leg, dayOffset, stayIdsToday);
            if (!role) return [];
            return [{ ...buildTransfer(leg.travelItem, leg.fromCity, leg.toCity), role }];
        });

        const isArrivalDay = Boolean(arrivingStay) && toDayOffset(arrivingStay!.start) === dayOffset;
        const isDepartureDay = Boolean(arrivingStay)
            && toIntervalEndDay(arrivingStay!.start, arrivingStay!.end) === dayOffset;

        // Check-in belongs to the stay being entered, check-out to the one being
        // left, which on a handover day are two different hotels.
        const checkInStay = isArrivalDay ? arrivingStay : null;
        const checkOutStay = departingStay
            ?? (isDepartureDay ? arrivingStay : null);
        const checkOutEndsToday = checkOutStay
            && toIntervalEndDay(checkOutStay.start, checkOutStay.end) === dayOffset;

        return {
            dayOffset,
            dayNumber: index + 1,
            date,
            weekdayLabel: date.toLocaleDateString(locale, { weekday: 'short' }),
            dayOfMonthLabel: date.toLocaleDateString(locale, { day: 'numeric' }),
            monthLabel: date.toLocaleDateString(locale, { month: 'short' }),
            fullDateLabel: date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
            stays: overlappingStays.map((stay) => ({
                id: stay.city.id,
                title: stay.city.title?.trim() || stay.city.location?.trim() || '',
                colorHex: getHexFromColorClass(stay.city.color || ''),
            })),
            city,
            cityColorHex: city ? getHexFromColorClass(city.color || '') : '',
            departingCity: departingStay?.city ?? null,
            departingCityColorHex: departingStay ? getHexFromColorClass(departingStay.city.color || '') : '',
            isHandoverDay: Boolean(departingStay),
            isArrivalDay,
            isDepartureDay,
            legs: dayLegs,
            hotelCheckIn: findStayHotel(checkInStay?.city ?? null),
            hotelCheckOut: checkOutEndsToday ? findStayHotel(checkOutStay!.city) : null,
            activities: activities.filter((activity) => toDayOffset(activity.startDateOffset) === dayOffset),
            isToday: todayOffset !== null && todayOffset === dayOffset,
        };
    });
};

export const doesMobileDayPlanDayContainItem = (
    day: MobileDayPlanDay,
    itemId: string | null,
): boolean => {
    if (!itemId) return false;
    return day.city?.id === itemId
        || day.departingCity?.id === itemId
        || day.legs.some((leg) => leg.item?.id === itemId)
        || day.activities.some((activity) => activity.id === itemId);
};

export const findMobileDayPlanIndexForItem = (
    days: MobileDayPlanDay[],
    itemId: string | null,
): number => {
    if (!itemId) return -1;
    return days.findIndex((day) => doesMobileDayPlanDayContainItem(day, itemId));
};

/** How a strip node joins the node before or after it. */
export interface MobileDayStripLink {
    kind: 'none' | 'stay' | 'transfer';
    /** Colour of the stay the line continues, set only for a `stay` link. */
    colorHex: string | null;
}

const NO_LINK: MobileDayStripLink = { kind: 'none', colorHex: null };
const TRANSFER_LINK: MobileDayStripLink = { kind: 'transfer', colorHex: null };

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
        /** Index of the day the leg lands in, which is what the strip selects. */
        dayIndex: number;
        transfer: MobileDayPlanTransfer;
    };

/** Legs that get a node of their own before a day: the ones that land in it. */
const findArrivingLegs = (day: MobileDayPlanDay): MobileDayPlanLeg[] => (
    day.legs.filter((leg) => leg.role === 'handover' || leg.role === 'arrival')
);

/**
 * How two neighbouring days join.
 *
 * Days that share a stay are joined by a line in that stay's colour, so a stay
 * reads as one run even when the day it starts on also belongs to the city
 * before it. Everything else is a transfer, drawn in the neutral colour that
 * carries the leg's own node.
 */
const resolveDayLink = (
    from: MobileDayPlanDay | null,
    to: MobileDayPlanDay | null,
): MobileDayStripLink => {
    if (!from || !to) return NO_LINK;
    const shared = from.stays.find((stay) => to.stays.some((other) => other.id === stay.id));
    if (!shared) return TRANSFER_LINK;
    return { kind: 'stay', colorHex: shared.colorHex || null };
};

/**
 * Interleaves the days with the legs travelled between them.
 *
 * Every leg carries its own node, placed immediately before the day it lands
 * in: the transport is what the traveller taps to change it, and burying it on
 * a day bubble made it too small to find. A day that holds a move still shows
 * both of its stays on its own ring, because the traveller spends part of the
 * day in each.
 */
export const buildMobileDayStripNodes = (days: MobileDayPlanDay[]): MobileDayStripNode[] => {
    const nodes: MobileDayStripNode[] = [];

    days.forEach((day, index) => {
        const previousDay = index > 0 ? days[index - 1] : null;
        const nextDay = index < days.length - 1 ? days[index + 1] : null;
        const arrivingLegs = findArrivingLegs(day);
        const nextArrivingLegs = nextDay ? findArrivingLegs(nextDay) : [];

        arrivingLegs.forEach((leg, legIndex) => {
            nodes.push({
                kind: 'transfer',
                key: `transfer-${day.dayOffset}-${legIndex}`,
                dayIndex: index,
                transfer: leg,
            });
        });

        nodes.push({
            kind: 'day',
            key: `day-${day.dayOffset}`,
            dayIndex: index,
            day,
            // A leg's node sits between the two days, so both sides of it read
            // as a transfer rather than as a stay running through it.
            linkBefore: arrivingLegs.length > 0 ? TRANSFER_LINK : resolveDayLink(previousDay, day),
            linkAfter: nextArrivingLegs.length > 0 ? TRANSFER_LINK : resolveDayLink(day, nextDay),
        });
    });

    return nodes;
};
