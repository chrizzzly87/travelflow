import React from 'react';
import {
    AirplaneInFlight,
    Compass,
    ClockCountdown,
    MapPinLine,
    Notebook,
    Signpost,
    Sparkle,
    SuitcaseRolling,
    WarningCircle,
} from '@phosphor-icons/react';

import type {
    ITrip,
    ITimelineItem,
    TripWorkspaceContextSelection,
    TripWorkspacePage,
} from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { TripWorkspaceOverviewCalendar } from './TripWorkspaceOverviewCalendar';
import {
    getTripWorkspaceCityItem,
    resolveTripWorkspaceCityStops,
    type TripWorkspaceDemoDataset,
} from './tripWorkspaceDemoData';
import { resolveTripWorkspaceContextSnapshot } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceMapCard } from './TripWorkspaceMapCard';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
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
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
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
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
    selectedCities,
    onPageChange,
    onOpenPlannerItem,
}) => {
    const pageTripMeta = React.useMemo(
        () => tripMeta ?? resolveTripWorkspaceFallbackTripMeta(trip),
        [trip, tripMeta],
    );
    const {
        dataset: pageDataset,
        contextSelection: pageContextSelection,
        onContextSelectionChange: handleContextSelectionChange,
    } = useTripWorkspacePageContext({
        trip,
        dataset,
        contextSelection,
        onContextSelectionChange,
    });
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const countdownLabel = React.useMemo(() => resolveCountdownLabel(trip), [trip]);
    const activeCityItem = React.useMemo(() => (
        selectedCities[0]
        ?? (context.activeCity ? getTripWorkspaceCityItem(trip, context.activeCity.id) : null)
        ?? cityStops[0]
        ?? null
    ), [cityStops, context.activeCity, selectedCities, trip]);
    const missingBooking = React.useMemo(
        () => pageDataset.bookings.find((booking) => booking.status === 'Missing')
            ?? pageDataset.bookings.find((booking) => booking.status === 'Needs review')
            ?? pageDataset.bookings[0]
            ?? null,
        [pageDataset.bookings],
    );
    const recentNotes = React.useMemo(
        () => pageDataset.notes.slice(0, 3),
        [pageDataset.notes],
    );
    const activeSafety = context.activeCountry?.safety.slice(0, 4) ?? [];
    const activeWeatherSignals = context.activeCity?.weather?.signals.slice(0, 3) ?? [];

    const handleQuickAction = React.useCallback((page: TripWorkspacePage, source: string) => {
        trackEvent('trip_workspace__overview_quick_action--open', {
            trip_id: trip.id,
            page,
            source,
        });
        onPageChange(page);
    }, [onPageChange, trip.id]);

    const handleOpenPlanner = React.useCallback(() => {
        if (activeCityItem) {
            onOpenPlannerItem?.(activeCityItem.id);
        }
        handleQuickAction('planner', 'active_context_city');
    }, [activeCityItem, handleQuickAction, onOpenPlannerItem]);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="overview"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                <Card className="overflow-hidden border-border/80 bg-linear-to-br from-accent/10 via-background to-emerald-50 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{countdownLabel}</Badge>
                            <Badge variant="outline">{pageDataset.routeSummary.countryCount} countries</Badge>
                            <Badge variant="outline">{pageDataset.routeSummary.cityCount} cities</Badge>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                            <div>
                                <CardDescription>Trip pulse</CardDescription>
                                <CardTitle className="mt-2 text-3xl leading-tight">
                                    {context.activeCity
                                        ? `${context.activeCity.title} is the current planning lens inside a ${pageDataset.routeSummary.countryCount}-country route.`
                                        : 'Multi-country route at a glance.'}
                                </CardTitle>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                    Overview keeps the route readable before you drop into editing. Border changes, current country rhythm,
                                    booking pressure, and useful next actions all stay in one place.
                                </p>
                                <div className="mt-5 flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        onClick={handleOpenPlanner}
                                        {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                            trip_id: trip.id,
                                            page: 'planner',
                                            source: 'active_context_city',
                                        })}
                                    >
                                        <MapPinLine data-icon="inline-start" weight="duotone" />
                                        Open this stop in planner
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleQuickAction('bookings', 'booking_gap')}
                                        {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                            trip_id: trip.id,
                                            page: 'bookings',
                                            source: 'booking_gap',
                                        })}
                                    >
                                        <SuitcaseRolling data-icon="inline-start" weight="duotone" />
                                        Review booking gap
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => handleQuickAction('phrases', 'country_language')}
                                        {...getAnalyticsDebugAttributes('trip_workspace__overview_quick_action--open', {
                                            trip_id: trip.id,
                                            page: 'phrases',
                                            source: 'country_language',
                                        })}
                                    >
                                        <Sparkle data-icon="inline-start" weight="duotone" />
                                        Practice {context.activeCountry?.languageName ?? 'local'} phrases
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                <div className="rounded-[1.75rem] border border-border/70 bg-background/85 p-4">
                                    <p className="text-sm font-medium text-foreground">Current country</p>
                                    <p className="mt-2 text-2xl font-semibold text-foreground">{context.activeCountry?.name ?? 'Route overview'}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{context.activeCountry?.routeRole ?? pageTripMeta.summaryLine}</p>
                                </div>
                                <div className="rounded-[1.75rem] border border-border/70 bg-background/85 p-4">
                                    <p className="text-sm font-medium text-foreground">Next transition</p>
                                    <p className="mt-2 text-xl font-semibold text-foreground">
                                        {pageDataset.routeSummary.nextBorderCrossing?.label ?? 'Single-country route'}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        {pageDataset.routeSummary.nextBorderCrossing?.detail ?? 'This route stays inside one country, so city handoffs matter more than border prep.'}
                                    </p>
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
                                    <p className="text-sm font-medium text-foreground">Current lens</p>
                                    <p className="text-lg font-semibold text-foreground">{context.activeCity?.title ?? context.activeCountry?.name ?? trip.title}</p>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-border/70 bg-background p-4">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
                                    <WarningCircle size={22} weight="duotone" />
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Booking pressure</p>
                                    <p className="text-sm leading-6 text-muted-foreground">{missingBooking?.title ?? 'No booking blockers in this demo route.'}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="gap-3">
                    <CardDescription>Country progression</CardDescription>
                    <CardTitle>See the route as a sequence of country chapters</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-4">
                    {pageDataset.routeSummary.progression.map((entry, index) => (
                        <div key={entry.code} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium text-foreground">{entry.name}</p>
                                <Badge variant={context.activeCountry?.code === entry.code ? 'secondary' : 'outline'}>Leg {index + 1}</Badge>
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-foreground">{entry.dayCount} days</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.cityCount} city stops shape this country segment.</p>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <TripWorkspaceOverviewCalendar trip={trip} cityStops={cityStops} onOpenPlannerItem={onOpenPlannerItem} />
                <TripWorkspaceMapCard
                    eyebrow="Route map"
                    title={`Follow the route across ${pageDataset.routeSummary.countryCount} countries`}
                    description="Overview keeps the geography simple on purpose: order, spread, and where the major transitions happen."
                    badges={['Shared trip map engine', `${cityStops.length} mapped stops`]}
                    items={cityStops}
                    mapStyle="clean"
                    routeMode="simple"
                    footer={(
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Distance</p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{pageTripMeta.distanceLabel ?? 'Route distance loading'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Border rhythm</p>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                    {pageDataset.routeSummary.borderCrossings.length > 0
                                        ? `${pageDataset.routeSummary.borderCrossings.length} cross-country handoff${pageDataset.routeSummary.borderCrossings.length === 1 ? '' : 's'} to plan around.`
                                        : 'This route stays in one country.'}
                                </p>
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
                        {activeSafety.map((snapshot) => (
                            <div key={snapshot.label} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">{snapshot.label}</p>
                                    <Badge variant={snapshot.tone}>{snapshot.score}</Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{snapshot.detail}</p>
                            </div>
                        ))}
                        {activeWeatherSignals.map((signal) => (
                            <div key={signal.label} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">{signal.label}</p>
                                    <Badge variant={signal.tone}>{signal.value}</Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {context.activeCity?.weather?.routeImpact ?? context.activeCountry?.bestTime ?? 'Route-aware weather detail is not available yet.'}
                                </p>
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
                        {recentNotes.map((note) => (
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
                                    <p className="mt-1 text-sm text-muted-foreground">Open Explore for route-aware shortlist work or jump into the next border packet.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => handleQuickAction('explore', 'research_handoff')}>
                                        <Compass data-icon="inline-start" weight="duotone" />
                                        Explore
                                    </Button>
                                    <Button type="button" variant="ghost" onClick={() => handleQuickAction('documents', 'border_packet')}>
                                        <Signpost data-icon="inline-start" weight="duotone" />
                                        Documents
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
