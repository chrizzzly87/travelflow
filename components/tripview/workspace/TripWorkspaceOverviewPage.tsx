import React from 'react';
import {
    AirplaneInFlight,
    Compass,
    ClockCountdown,
    MapPinLine,
    Notebook,
    Sparkle,
    SuitcaseRolling,
    WarningCircle,
} from '@phosphor-icons/react';

import type { ITrip, ITimelineItem, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { TripWorkspaceOverviewCalendar } from './TripWorkspaceOverviewCalendar';
import { THAILAND_BOOKINGS, THAILAND_NOTES, THAILAND_SAFETY_SNAPSHOTS, resolveTripWorkspaceCityStops } from './tripWorkspaceDemoData';
import { TripWorkspaceMapCard } from './TripWorkspaceMapCard';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceOverviewPageProps {
    trip: ITrip;
    tripMeta: TripMetaSummary;
    selectedCities: ITimelineItem[];
    onPageChange: (page: TripWorkspacePage) => void;
    onOpenPlannerItem?: (itemId: string) => void;
}

const parseTripDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    if ([year, month, day].every((part) => Number.isFinite(part))) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    const parsed = new Date(value);
    parsed.setHours(12, 0, 0, 0);
    return parsed;
};

const resolveCurrentCity = (trip: ITrip, cityStops: ITimelineItem[]): ITimelineItem | null => {
    const tripStartDate = parseTripDate(trip.startDate);
    const todayAtNoon = new Date();
    todayAtNoon.setHours(12, 0, 0, 0);
    const dayOffset = Math.round((todayAtNoon.getTime() - tripStartDate.getTime()) / (1000 * 60 * 60 * 24));

    return cityStops.find((item) => (
        dayOffset >= Math.floor(item.startDateOffset)
        && dayOffset < Math.ceil(item.startDateOffset + item.duration)
    )) ?? cityStops[0] ?? null;
};

const resolveCountdownLabel = (trip: ITrip): string => {
    const tripStartDate = parseTripDate(trip.startDate);
    const todayAtNoon = new Date();
    todayAtNoon.setHours(12, 0, 0, 0);
    const dayDiff = Math.round((tripStartDate.getTime() - todayAtNoon.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff > 1) return `${dayDiff} days to go`;
    if (dayDiff === 1) return 'Starts tomorrow';
    if (dayDiff === 0) return 'Starts today';
    return 'In progress';
};

export const TripWorkspaceOverviewPage: React.FC<TripWorkspaceOverviewPageProps> = ({
    trip,
    tripMeta,
    selectedCities,
    onPageChange,
    onOpenPlannerItem,
}) => {
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const currentCity = React.useMemo(
        () => selectedCities[0] ?? resolveCurrentCity(trip, cityStops),
        [cityStops, selectedCities, trip],
    );
    const countdownLabel = React.useMemo(() => resolveCountdownLabel(trip), [trip]);
    const missingBooking = THAILAND_BOOKINGS.find((booking) => booking.status === 'Missing') ?? THAILAND_BOOKINGS[0];

    const handleQuickAction = React.useCallback((page: TripWorkspacePage, source: string) => {
        trackEvent('trip_workspace__overview_quick_action--open', {
            trip_id: trip.id,
            page,
            source,
        });
        onPageChange(page);
    }, [onPageChange, trip.id]);

    const handleOpenPlanner = React.useCallback(() => {
        if (currentCity) {
            onOpenPlannerItem?.(currentCity.id);
        }
        handleQuickAction('planner', 'current_city');
    }, [currentCity, handleQuickAction, onOpenPlannerItem]);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <Card className="overflow-hidden border-border/80 bg-linear-to-br from-accent/10 via-background to-emerald-50 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{countdownLabel}</Badge>
                            <Badge variant="outline">{tripMeta.summaryLine}</Badge>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                            <div>
                                <CardDescription>Trip pulse</CardDescription>
                                <CardTitle className="mt-2 text-3xl leading-tight">
                                    {currentCity ? `${currentCity.title} is the current route anchor.` : 'Thailand route at a glance.'}
                                </CardTitle>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                    Use Overview to spot the next decision fast, then jump into Planner, Bookings, or Phrases without losing the big picture.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        onClick={handleOpenPlanner}
                                        {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                            trip_id: trip.id,
                                            page: 'planner',
                                            source: 'current_city',
                                        })}
                                    >
                                        <MapPinLine data-icon="inline-start" weight="duotone" />
                                        Open today in planner
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleQuickAction('bookings', 'missing_booking')}
                                        {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                            trip_id: trip.id,
                                            page: 'bookings',
                                            source: 'missing_booking',
                                        })}
                                    >
                                        <SuitcaseRolling data-icon="inline-start" weight="duotone" />
                                        Review booking gap
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => handleQuickAction('phrases', 'region_phrases')}
                                        {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                            trip_id: trip.id,
                                            page: 'phrases',
                                            source: 'region_phrases',
                                        })}
                                    >
                                        <Sparkle data-icon="inline-start" weight="duotone" />
                                        Practice phrases
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                <div className="rounded-[1.75rem] border border-border/70 bg-background/85 p-4">
                                    <p className="text-sm font-medium text-foreground">Date range</p>
                                    <p className="mt-2 text-2xl font-semibold text-foreground">{tripMeta.dateRange}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">{tripMeta.totalDaysLabel} days planned across {tripMeta.cityCount} city phases.</p>
                                </div>
                                <div className="rounded-[1.75rem] border border-border/70 bg-background/85 p-4">
                                    <p className="text-sm font-medium text-foreground">Next booking pressure</p>
                                    <p className="mt-2 text-xl font-semibold text-foreground">{missingBooking.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{missingBooking.meta}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader className="gap-3">
                        <CardDescription>Route pulse</CardDescription>
                        <CardTitle>What matters next</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <div className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-accent/10 text-accent-700">
                                    <ClockCountdown size={22} weight="duotone" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Countdown</p>
                                    <p className="text-lg font-semibold text-foreground">{countdownLabel}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                                    <AirplaneInFlight size={22} weight="duotone" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Current city</p>
                                    <p className="text-lg font-semibold text-foreground">{currentCity?.title ?? 'Thailand route'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
                                    <WarningCircle size={22} weight="duotone" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Risk snapshot</p>
                                    <p className="text-sm leading-6 text-muted-foreground">Sea-leg flexibility and late-night transfer quality are the biggest trip-shape risks.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <TripWorkspaceOverviewCalendar trip={trip} cityStops={cityStops} onOpenPlannerItem={onOpenPlannerItem} />
                <TripWorkspaceMapCard
                    eyebrow="Route map"
                    title="Follow the route across Thailand"
                    description="Overview keeps the geography simple on purpose: order, spread, and broad travel shape."
                    badges={['Shared trip map engine', `${cityStops.length} mapped stops`]}
                    items={cityStops}
                    mapStyle="clean"
                    routeMode="simple"
                    footer={(
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Distance</p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{tripMeta.distanceLabel ?? 'Route distance loading'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Planner handoff</p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">Jump into Planner when you need routing, selection, and detailed stop edits.</p>
                            </div>
                        </div>
                    )}
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader className="gap-3">
                        <CardDescription>Weather and safety pulse</CardDescription>
                        <CardTitle>Important context stays visible</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {THAILAND_SAFETY_SNAPSHOTS.map((snapshot) => (
                            <div key={snapshot.label} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">{snapshot.label}</p>
                                    <Badge variant={snapshot.tone}>{snapshot.score}</Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{snapshot.detail}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader className="gap-3">
                        <CardDescription>Recent notes and jumps</CardDescription>
                        <CardTitle>Keep the travel brain dump useful</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {THAILAND_NOTES.map((note) => (
                            <button
                                key={note.id}
                                type="button"
                                className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-left transition-colors hover:border-accent-300 hover:bg-accent/5"
                                onClick={() => handleQuickAction('notes', note.id)}
                                {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                    trip_id: trip.id,
                                    page: 'notes',
                                    source: note.id,
                                })}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">{note.title}</p>
                                    <Notebook size={16} weight="duotone" className="text-muted-foreground" />
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.body}</p>
                            </button>
                        ))}
                        <div className="rounded-[1.5rem] border border-dashed border-border bg-background/70 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Need deeper research?</p>
                                    <p className="mt-1 text-sm text-muted-foreground">Open Explore for route-aware shortlist work.</p>
                                </div>
                                <Button type="button" variant="outline" onClick={() => handleQuickAction('explore', 'research_handoff')}>
                                    <Compass data-icon="inline-start" weight="duotone" />
                                    Explore
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
