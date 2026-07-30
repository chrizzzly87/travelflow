import type { ITrip, ITimelineItem } from '../../types';

const DAYS_PER_WEEK = 7;
const MAX_RENDERED_SCHEDULE_DAYS = 370;

export interface TripScheduleEntry {
    item: ITimelineItem;
    startsOnDay: boolean;
    continuesFromPreviousDay: boolean;
    continuesIntoNextDay: boolean;
}

export interface TripScheduleDay {
    dayOffset: number;
    dateIso: string | null;
    cities: TripScheduleEntry[];
    entries: TripScheduleEntry[];
}

export interface TripScheduleWeek {
    index: number;
    days: TripScheduleDay[];
}

export interface TripScheduleModel {
    weeks: TripScheduleWeek[];
    totalDays: number;
    isTruncated: boolean;
}

const parseTripStartDate = (value: string): Date | null => {
    const plainDate = value.includes('T') ? value.slice(0, 10) : value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(plainDate);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        return null;
    }
    return parsed;
};

const addUtcDays = (date: Date, amount: number): Date => {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + amount);
    return nextDate;
};

const toDateIso = (date: Date): string => date.toISOString().slice(0, 10);

const getItemStartDay = (item: ITimelineItem): number | null => (
    Number.isFinite(item.startDateOffset) ? Math.floor(item.startDateOffset) : null
);

const getItemEndDayExclusive = (item: ITimelineItem): number | null => {
    const startDay = getItemStartDay(item);
    if (startDay === null) return null;

    const duration = Number.isFinite(item.duration) ? Math.max(0, item.duration) : 0;
    return Math.max(startDay + 1, Math.ceil(item.startDateOffset + duration));
};

const createScheduleEntry = (item: ITimelineItem, dayOffset: number): TripScheduleEntry => {
    const startDay = getItemStartDay(item) ?? dayOffset;
    const endDayExclusive = getItemEndDayExclusive(item) ?? (startDay + 1);
    return {
        item,
        startsOnDay: dayOffset === startDay,
        continuesFromPreviousDay: dayOffset > startDay,
        continuesIntoNextDay: dayOffset < endDayExclusive - 1,
    };
};

const compareScheduleItems = (
    left: { item: ITimelineItem; sourceIndex: number },
    right: { item: ITimelineItem; sourceIndex: number },
): number => {
    const offsetDifference = left.item.startDateOffset - right.item.startDateOffset;
    if (offsetDifference !== 0) return offsetDifference;

    const typeRank = (item: ITimelineItem): number => {
        if (item.type === 'travel' || item.type === 'travel-empty') return 0;
        if (item.type === 'activity') return 1;
        return 2;
    };
    const typeDifference = typeRank(left.item) - typeRank(right.item);
    return typeDifference || left.sourceIndex - right.sourceIndex;
};

export const buildTripScheduleModel = (trip: ITrip): TripScheduleModel => {
    const indexedItems = trip.items
        .map((item, sourceIndex) => ({ item, sourceIndex }))
        .filter(({ item }) => getItemStartDay(item) !== null);

    const rawStartDay = indexedItems.reduce((minimum, { item }) => (
        Math.min(minimum, getItemStartDay(item) ?? 0)
    ), 0);
    const rawEndDayExclusive = indexedItems.reduce((maximum, { item }) => (
        Math.max(maximum, getItemEndDayExclusive(item) ?? 1)
    ), 1);
    const requestedDayCount = Math.max(1, rawEndDayExclusive - rawStartDay);
    const renderedDayCount = Math.min(requestedDayCount, MAX_RENDERED_SCHEDULE_DAYS);
    const renderedEndDayExclusive = rawStartDay + renderedDayCount;
    const parsedStartDate = parseTripStartDate(trip.startDate);
    const days: TripScheduleDay[] = [];

    for (let dayOffset = rawStartDay; dayOffset < renderedEndDayExclusive; dayOffset += 1) {
        const cityItems = indexedItems
            .filter(({ item }) => (
                item.type === 'city'
                && (getItemStartDay(item) ?? dayOffset) <= dayOffset
                && (getItemEndDayExclusive(item) ?? dayOffset + 1) > dayOffset
            ))
            .sort(compareScheduleItems)
            .map(({ item }) => createScheduleEntry(item, dayOffset));

        const entries = indexedItems
            .filter(({ item }) => item.type !== 'city' && getItemStartDay(item) === dayOffset)
            .sort(compareScheduleItems)
            .map(({ item }) => createScheduleEntry(item, dayOffset));

        days.push({
            dayOffset,
            dateIso: parsedStartDate ? toDateIso(addUtcDays(parsedStartDate, dayOffset)) : null,
            cities: cityItems,
            entries,
        });
    }

    const weeks: TripScheduleWeek[] = [];
    for (let dayIndex = 0; dayIndex < days.length; dayIndex += DAYS_PER_WEEK) {
        weeks.push({
            index: weeks.length,
            days: days.slice(dayIndex, dayIndex + DAYS_PER_WEEK),
        });
    }

    return {
        weeks,
        totalDays: requestedDayCount,
        isTruncated: requestedDayCount > renderedDayCount,
    };
};
