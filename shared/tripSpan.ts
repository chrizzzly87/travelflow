import type { ITrip, ITimelineItem } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TripRangeOffsets {
    startOffset: number;
    endOffset: number;
}

export interface TripSpanSummary {
    startDate: Date;
    endDate: Date;
    days: number;
    nights: number;
    startOffset: number;
    endOffset: number;
    compactLabel: string;
    longLabel: string;
}

const parseLocalDate = (value: string): Date | null => {
    if (!value) return null;
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
        const [year, month, day] = parts;
        return new Date(year, month - 1, day);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const toNoon = (date: Date): Date => {
    const next = new Date(date);
    next.setHours(12, 0, 0, 0);
    return next;
};

const getCalendarDayDiff = (start: Date, end: Date): number => (
    Math.round((toNoon(end).getTime() - toNoon(start).getTime()) / DAY_MS)
);

const formatCompactTripSpan = (days: number, nights: number): string => `${days}D/${nights}N`;

const formatLongTripSpan = (days: number, nights: number): string => (
    `${days} ${days === 1 ? 'day' : 'days'} / ${nights} ${nights === 1 ? 'night' : 'nights'}`
);

const createTripSpanSummary = (
    startDate: Date,
    endDate: Date,
    startOffset: number,
    endOffset: number,
): TripSpanSummary => {
    const nights = Math.max(0, getCalendarDayDiff(startDate, endDate));
    const days = Math.max(1, nights + 1);

    return {
        startDate,
        endDate,
        days,
        nights,
        startOffset,
        endOffset,
        compactLabel: formatCompactTripSpan(days, nights),
        longLabel: formatLongTripSpan(days, nights),
    };
};

const getSourceItemsForTripRange = (trip: ITrip): ITimelineItem[] => {
    const cityItems = trip.items.filter((item) => item.type === 'city');
    return cityItems.length > 0 ? cityItems : trip.items;
};

export const getTripRangeOffsets = (trip: ITrip): TripRangeOffsets => {
    const sourceItems = getSourceItemsForTripRange(trip);

    if (sourceItems.length === 0) {
        return { startOffset: 0, endOffset: 0 };
    }

    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;

    sourceItems.forEach((item) => {
        if (!Number.isFinite(item.startDateOffset) || !Number.isFinite(item.duration)) return;
        minStart = Math.min(minStart, item.startDateOffset);
        maxEnd = Math.max(maxEnd, item.startDateOffset + Math.max(item.duration, 0));
    });

    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd < minStart) {
        return { startOffset: 0, endOffset: 0 };
    }

    return {
        startOffset: minStart,
        endOffset: maxEnd,
    };
};

export const getTripSpanFromOffsets = (
    startDateValue: string,
    range: TripRangeOffsets,
): TripSpanSummary => {
    const baseStartDate = parseLocalDate(startDateValue) || new Date();
    const startOffset = Number.isFinite(range.startOffset) ? range.startOffset : 0;
    const endOffset = Number.isFinite(range.endOffset) ? range.endOffset : startOffset;
    const touchedStartDate = addDays(baseStartDate, Math.floor(startOffset));
    const touchedEndDate = addDays(baseStartDate, Math.max(Math.floor(startOffset), Math.ceil(endOffset)));

    return createTripSpanSummary(touchedStartDate, touchedEndDate, startOffset, endOffset);
};

export const getTripSpan = (trip: ITrip): TripSpanSummary => (
    getTripSpanFromOffsets(trip.startDate, getTripRangeOffsets(trip))
);

export const getExactTripDateSpan = (startDateValue: string, endDateValue: string): TripSpanSummary | null => {
    const startDate = parseLocalDate(startDateValue);
    const endDate = parseLocalDate(endDateValue);
    if (!startDate || !endDate) return null;
    if (endDate.getTime() < startDate.getTime()) return null;

    const nights = getCalendarDayDiff(startDate, endDate);
    const days = Math.max(1, nights + 1);

    return {
        startDate,
        endDate,
        days,
        nights,
        startOffset: 0,
        endOffset: nights,
        compactLabel: formatCompactTripSpan(days, nights),
        longLabel: formatLongTripSpan(days, nights),
    };
};

export const getEstimatedTripNightsFromTotalDays = (totalDays: number): number => {
    if (!Number.isFinite(totalDays)) return 0;
    return Math.max(0, Math.round(totalDays) - 1);
};
