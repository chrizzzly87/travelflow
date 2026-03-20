import React from 'react';

import type { ITrip, ITimelineItem } from '../../types';
import { getHexFromColorClass } from '../../utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type CalendarDay = {
    key: string;
    date: Date;
    dayNumber: number;
    cityTitle: string | null;
    colorHex: string | null;
    isToday: boolean;
};

type CalendarMonth = {
    key: string;
    label: string;
    leadingBlanks: number;
    trailingBlanks: number;
    days: CalendarDay[];
};

interface TripWorkspaceOverviewCalendarProps {
    trip: ITrip;
    cityStops: ITimelineItem[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseTripDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    if ([year, month, day].every((part) => Number.isFinite(part))) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    parsed.setHours(12, 0, 0, 0);
    return parsed;
};

const addDays = (date: Date, days: number): Date => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    nextDate.setHours(12, 0, 0, 0);
    return nextDate;
};

const formatDayRange = (tripStartDate: string, item: ITimelineItem): string => {
    const startDate = addDays(parseTripDate(tripStartDate), Math.floor(item.startDateOffset));
    const endDate = addDays(startDate, Math.max(0, Math.ceil(item.duration) - 1));
    const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

    if (startDate.getMonth() === endDate.getMonth() && startDate.getDate() === endDate.getDate()) {
        return formatter.format(startDate);
    }

    return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
};

const hexToRgba = (hex: string, alpha: number): string => {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
        return `rgba(79, 70, 229, ${alpha})`;
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const buildCalendarMonths = (trip: ITrip, cityStops: ITimelineItem[]): CalendarMonth[] => {
    const startDate = parseTripDate(trip.startDate);
    const maxTripDay = cityStops.reduce((currentMax, item) => (
        Math.max(currentMax, Math.ceil(item.startDateOffset + item.duration))
    ), 0);
    const totalTripDays = Math.max(1, maxTripDay);
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const days: CalendarDay[] = Array.from({ length: totalTripDays }, (_, index) => {
        const date = addDays(startDate, index);
        const city = cityStops.find((item) => (
            index >= Math.floor(item.startDateOffset)
            && index < Math.ceil(item.startDateOffset + item.duration)
        )) ?? null;

        return {
            key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
            date,
            dayNumber: date.getDate(),
            cityTitle: city?.title ?? null,
            colorHex: city?.color ? getHexFromColorClass(city.color) : null,
            isToday: date.getTime() === today.getTime(),
        };
    });

    const months: CalendarMonth[] = [];
    days.forEach((day) => {
        const monthKey = `${day.date.getFullYear()}-${day.date.getMonth()}`;
        const existingMonth = months[months.length - 1];

        if (!existingMonth || existingMonth.key !== monthKey) {
            months.push({
                key: monthKey,
                label: day.date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                leadingBlanks: day.date.getDay(),
                trailingBlanks: 0,
                days: [day],
            });
            return;
        }

        existingMonth.days.push(day);
    });

    months.forEach((month) => {
        const occupiedSlots = month.leadingBlanks + month.days.length;
        const remainder = occupiedSlots % 7;
        month.trailingBlanks = remainder === 0 ? 0 : 7 - remainder;
    });

    return months;
};

export const TripWorkspaceOverviewCalendar: React.FC<TripWorkspaceOverviewCalendarProps> = ({
    trip,
    cityStops,
}) => {
    const months = React.useMemo(() => buildCalendarMonths(trip, cityStops), [cityStops, trip]);
    const todayCity = React.useMemo(
        () => months.flatMap((month) => month.days).find((day) => day.isToday)?.cityTitle ?? null,
        [months],
    );

    return (
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardDescription>Color timeline calendar</CardDescription>
                        <CardTitle>See the route day by day</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Demo route coloring</Badge>
                        {todayCity ? <Badge variant="secondary">Today in {todayCity}</Badge> : null}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {cityStops.map((city) => {
                        const colorHex = getHexFromColorClass(city.color || '');
                        return (
                            <div
                                key={city.id}
                                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground"
                            >
                                <span
                                    aria-hidden="true"
                                    className="size-2.5 rounded-full"
                                    style={{ backgroundColor: colorHex }}
                                />
                                <span className="font-medium text-foreground">{city.title}</span>
                                <span>{formatDayRange(trip.startDate, city)}</span>
                            </div>
                        );
                    })}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {months.map((month) => (
                    <div key={month.key} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{month.label}</p>
                            <p className="text-xs text-muted-foreground">Demo calendar. Live trip overlays come next.</p>
                        </div>
                        <div className="grid grid-cols-7 gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                            {WEEKDAY_LABELS.map((label) => (
                                <div key={label} className="px-1 py-1 text-center">{label}</div>
                            ))}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-2">
                            {Array.from({ length: month.leadingBlanks }, (_, blankIndex) => (
                                <div key={`${month.key}-leading-${blankIndex}`} className="aspect-[0.95] rounded-2xl bg-muted/40" />
                            ))}
                            {month.days.map((day) => {
                                const baseStyle = day.colorHex
                                    ? {
                                        backgroundColor: hexToRgba(day.colorHex, day.isToday ? 0.22 : 0.14),
                                        borderColor: hexToRgba(day.colorHex, day.isToday ? 0.55 : 0.28),
                                    }
                                    : undefined;

                                return (
                                    <div
                                        key={day.key}
                                        aria-label={day.isToday ? `${day.date.toDateString()} Today` : day.date.toDateString()}
                                        className={`flex aspect-[0.95] min-h-[88px] flex-col justify-between rounded-2xl border px-2 py-2 transition-colors ${
                                            day.isToday
                                                ? 'ring-2 ring-accent-500/70 shadow-sm'
                                                : 'border-border/70 bg-card'
                                        }`}
                                        style={baseStyle}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className={`text-sm font-semibold ${day.isToday ? 'text-foreground' : 'text-foreground/90'}`}>
                                                {day.dayNumber}
                                            </span>
                                            {day.isToday ? (
                                                <span className="rounded-full bg-accent-600 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                                                    Today
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                                                {day.cityTitle ?? 'Transit / flex day'}
                                            </p>
                                            {day.colorHex ? (
                                                <span
                                                    aria-hidden="true"
                                                    className="block h-1.5 rounded-full"
                                                    style={{ backgroundColor: day.colorHex }}
                                                />
                                            ) : (
                                                <span aria-hidden="true" className="block h-1.5 rounded-full bg-muted" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {Array.from({ length: month.trailingBlanks }, (_, blankIndex) => (
                                <div key={`${month.key}-trailing-${blankIndex}`} className="aspect-[0.95] rounded-2xl bg-muted/30" />
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
