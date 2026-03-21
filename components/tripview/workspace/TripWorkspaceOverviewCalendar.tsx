import React from 'react';
import { ArrowRight, CalendarDots } from '@phosphor-icons/react';

import type { ITrip, ITimelineItem } from '../../../types';
import { getHexFromColorClass } from '../../../utils';
import { buildRenderedTimelineDaySlots, buildRenderedTimelineMonths } from '../timelineRenderedSlots';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

interface TripWorkspaceOverviewCalendarProps {
    trip: ITrip;
    cityStops: ITimelineItem[];
    onOpenPlannerItem?: (itemId: string) => void;
}

interface OverviewCalendarMonth {
    key: string;
    label: string;
    leadingBlankKeys: string[];
    trailingBlankKeys: string[];
    days: ReturnType<typeof buildCalendarDays>;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const getCompactCityLabel = (title: string): string => {
    const [firstWord] = title.split(/\s+/);
    if (!firstWord) return title;
    return firstWord.length > 9 ? `${firstWord.slice(0, 8)}…` : firstWord;
};

const parseTripDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    if ([year, month, day].every((part) => Number.isFinite(part))) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    const parsed = new Date(value);
    parsed.setHours(12, 0, 0, 0);
    return parsed;
};

const buildTripDayRange = (cityStops: ITimelineItem[]) => {
    const lastOffset = cityStops.reduce((max, item) => (
        Math.max(max, Math.ceil(item.startDateOffset + item.duration))
    ), 1);

    return {
        startOffset: 0,
        dayCount: Math.max(1, lastOffset),
    };
};

const buildCalendarDays = (trip: ITrip, cityStops: ITimelineItem[]) => {
    const tripDayRange = buildTripDayRange(cityStops);
    const tripStartDate = parseTripDate(trip.startDate);
    const todayAtNoon = new Date();
    todayAtNoon.setHours(12, 0, 0, 0);
    const todayOffset = Math.round((todayAtNoon.getTime() - tripStartDate.getTime()) / MS_PER_DAY);
    const renderedSlots = buildRenderedTimelineDaySlots({
        tripLength: tripDayRange.dayCount,
        visualStartOffset: tripDayRange.startOffset,
        pixelsPerDay: 1,
        fillerSize: 0,
        todayIndex: todayOffset >= 0 && todayOffset < tripDayRange.dayCount ? todayOffset : null,
        baseStartDate: tripStartDate,
    });

    return renderedSlots.map((slot) => {
        const city = cityStops.find((item) => (
            slot.dayOffset >= Math.floor(item.startDateOffset)
            && slot.dayOffset < Math.ceil(item.startDateOffset + item.duration)
        )) ?? null;
        const color = city?.color ? getHexFromColorClass(city.color) : null;
        return {
            key: `${slot.date.getFullYear()}-${slot.date.getMonth()}-${slot.date.getDate()}`,
            slot,
            city,
            color,
        };
    });
};

const buildCalendarMonths = (days: ReturnType<typeof buildCalendarDays>): OverviewCalendarMonth[] => {
    const monthGroups = buildRenderedTimelineMonths(days.map((day) => day.slot));
    return monthGroups.map((group) => {
        const monthDays = days.filter((day) => day.slot.monthName === group.name);
        const leadingBlanks = monthDays[0]?.slot.date.getDay() ?? 0;
        const occupied = leadingBlanks + monthDays.length;
        const trailingBlanks = occupied % 7 === 0 ? 0 : 7 - (occupied % 7);

        return {
            key: `${group.name}-${group.startIndex}`,
            label: `${group.name} ${monthDays[0]?.slot.date.getFullYear() ?? ''}`.trim(),
            leadingBlankKeys: Array.from({ length: leadingBlanks }, (_, blankOffset) => (
                `${group.name}-${group.startIndex}-leading-${blankOffset + 1}`
            )),
            trailingBlankKeys: Array.from({ length: trailingBlanks }, (_, blankOffset) => (
                `${group.name}-${group.startIndex}-trailing-${blankOffset + 1}`
            )),
            days: monthDays,
        };
    });
};

export const TripWorkspaceOverviewCalendar: React.FC<TripWorkspaceOverviewCalendarProps> = ({
    trip,
    cityStops,
    onOpenPlannerItem,
}) => {
    const days = React.useMemo(() => buildCalendarDays(trip, cityStops), [cityStops, trip]);
    const months = React.useMemo(() => buildCalendarMonths(days), [days]);
    const todayEntry = React.useMemo(() => days.find((day) => day.slot.isToday) ?? null, [days]);

    return (
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader className="gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardDescription>Route calendar</CardDescription>
                        <CardTitle>See the route day by day</CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Trip rhythm</Badge>
                        {todayEntry?.city ? <Badge variant="secondary">Today in {todayEntry.city.title}</Badge> : null}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {cityStops.map((city) => (
                        <button
                            key={city.id}
                            type="button"
                            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent-300 hover:bg-accent/5 hover:text-foreground"
                            onClick={() => onOpenPlannerItem?.(city.id)}
                        >
                            <span
                                aria-hidden="true"
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: getHexFromColorClass(city.color || '') }}
                            />
                            <span className="font-medium text-foreground">{city.title}</span>
                            <span>Day {Math.floor(city.startDateOffset) + 1}</span>
                        </button>
                    ))}
                </div>
                <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/90 p-3">
                    <div className="flex items-center gap-[3px]">
                        {cityStops.map((city) => (
                            <button
                                key={`${city.id}-lane`}
                                type="button"
                                onClick={() => onOpenPlannerItem?.(city.id)}
                                className="group flex min-w-0 flex-1 flex-col gap-2 text-left"
                                style={{ flexGrow: Math.max(1, Math.round(city.duration)) }}
                            >
                                <div
                                    className="h-2.5 rounded-full transition-transform group-hover:scale-y-110"
                                    style={{ backgroundColor: getHexFromColorClass(city.color || '') }}
                                />
                                <div className="min-w-0 px-1">
                                    <p className="truncate text-[11px] font-semibold text-foreground">{city.title}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4">
                {months.map((month) => (
                    <div key={month.key} className="rounded-[1.75rem] border border-border/70 bg-background/85 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{month.label}</p>
                            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarDots size={14} weight="duotone" />
                                Planner-linked route days
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                            {DAY_LABELS.map((label) => (
                                <div key={label} className="px-1 py-1 text-center">{label}</div>
                            ))}
                        </div>
                        <div className="mt-2 grid grid-cols-7 gap-2">
                            {month.leadingBlankKeys.map((blankKey) => (
                                <div key={blankKey} className="aspect-[0.92] rounded-2xl bg-muted/40" />
                            ))}
                            {month.days.map((day) => {
                                const tone = day.color ? { borderColor: `${day.color}55`, backgroundColor: `${day.color}18` } : undefined;
                                return (
                                    <button
                                        key={day.key}
                                        type="button"
                                        onClick={() => day.city && onOpenPlannerItem?.(day.city.id)}
                                        className={`flex aspect-[0.92] min-h-[98px] flex-col justify-between rounded-[1.4rem] border px-2.5 py-2.5 text-left transition-transform hover:-translate-y-0.5 ${
                                            day.slot.isToday ? 'ring-2 ring-accent-500/60 shadow-sm' : 'border-border/70 bg-card'
                                        }`}
                                        style={tone}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-sm font-semibold text-foreground">{day.slot.dayNum}</span>
                                            {day.slot.isToday ? (
                                                <span className="rounded-full bg-accent-600 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
                                                    Today
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {day.city ? (
                                                <span
                                                    className="inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground"
                                                    style={{ backgroundColor: `${day.color ?? '#94a3b8'}18` }}
                                                >
                                                    {getCompactCityLabel(day.city.title)}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] leading-4 text-muted-foreground">Transit / reset</span>
                                            )}
                                            {day.city ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground">
                                                    Open in planner
                                                    <ArrowRight size={12} />
                                                </span>
                                            ) : (
                                                <span aria-hidden="true" className="block h-1.5 rounded-full bg-muted" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                            {month.trailingBlankKeys.map((blankKey) => (
                                <div key={blankKey} className="aspect-[0.92] rounded-2xl bg-muted/30" />
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
