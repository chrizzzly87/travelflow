import React from 'react';
import {
    Backpack,
    CalendarBlank,
    CloudSun,
    GlobeHemisphereWest,
    Lifebuoy,
    SuitcaseRolling,
    Waves,
    Wind,
} from '@phosphor-icons/react';

import type { ITrip, TripWorkspaceContextSelection, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    resolveTripWorkspaceCityStops,
    type TripWorkspaceDemoDataset,
    type TripWorkspaceWeatherLensId,
} from './tripWorkspaceDemoData';
import { resolveTripWorkspaceContextSnapshot } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceMapCard } from './TripWorkspaceMapCard';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { ScrollArea, ScrollBar } from '../../ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceWeatherPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
    onPageChange: (page: TripWorkspacePage) => void;
}

const LENS_COPY: Record<TripWorkspaceWeatherLensId, { label: string; title: string; description: string }> = {
    feel: {
        label: 'Travel feel',
        title: 'How the day actually feels once you are moving',
        description: 'This keeps focus on pace, comfort, and route quality rather than generic forecast noise.',
    },
    rain: {
        label: 'Rain risk',
        title: 'Where showers change the plan instead of just the mood',
        description: 'Use this when you need to understand which part of the city or route becomes weaker if rain lands badly.',
    },
    sea: {
        label: 'Sea watch',
        title: 'Marine or transfer-sensitive pressure',
        description: 'This lens matters most on island, ferry, or scenic-viewpoint days.',
    },
    pack: {
        label: 'Pack notes',
        title: 'What to keep reachable without overpacking',
        description: 'Use this for the small items that reduce friction across country changes and weather swings.',
    },
};

const QuickWeatherLink: React.FC<{
    icon: React.ReactNode;
    label: string;
    page: TripWorkspacePage;
    tripId: string;
    onPageChange: (page: TripWorkspacePage) => void;
}> = ({ icon, label, page, tripId, onPageChange }) => (
    <Button
        type="button"
        variant="outline"
        onClick={() => {
            trackEvent('trip_workspace__weather_link--open', {
                trip_id: tripId,
                target_page: page,
            });
            onPageChange(page);
        }}
        {...getAnalyticsDebugAttributes('trip_workspace__weather_link--open', {
            trip_id: tripId,
            target_page: page,
        })}
    >
        {icon}
        {label}
    </Button>
);

export const TripWorkspaceWeatherPage: React.FC<TripWorkspaceWeatherPageProps> = ({
    trip,
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
    onPageChange,
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
    const [activeLens, setActiveLens] = React.useState<TripWorkspaceWeatherLensId>('feel');
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const activeCountry = context.activeCountry;
    const activeCity = context.activeCity;
    const activeStop = React.useMemo(
        () => pageDataset.weatherStops.find((stop) => stop.id === activeCity?.id) ?? pageDataset.weatherStops[0] ?? null,
        [activeCity?.id, pageDataset.weatherStops],
    );
    const activeLensCopy = LENS_COPY[activeLens];

    const lensBody = React.useMemo(() => {
        if (!activeStop) return 'Weather detail is not available for this city yet.';
        switch (activeLens) {
            case 'rain':
                return activeStop.caution;
            case 'sea':
                return activeStop.seaNote;
            case 'pack':
                return activeStop.packNotes.join(' • ');
            case 'feel':
            default:
                return activeStop.travelFeel;
        }
    }, [activeLens, activeStop]);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="weather"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <Card className="overflow-hidden border-border/80 bg-linear-to-br from-sky-50 via-background to-cyan-50 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Decision weather</Badge>
                        <Badge variant="outline">{activeCountry?.name ?? 'Route'}</Badge>
                        <Badge variant="outline">{activeStop?.updateLine ?? 'Seeded route weather'}</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                            <CardDescription>Weather pulse</CardDescription>
                            <CardTitle>{activeCity?.title ?? 'This stop'} is the active route-weather lens</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Weather here is framed around planning consequences, not raw forecast density. Keep the route-wide pressure visible,
                                then drill into the selected country and city only when it changes what you pack, book, or move.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <QuickWeatherLink icon={<GlobeHemisphereWest data-icon="inline-start" weight="duotone" />} label="Open places" page="places" tripId={trip.id} onPageChange={onPageChange} />
                                <QuickWeatherLink icon={<Backpack data-icon="inline-start" weight="duotone" />} label="Open travel kit" page="travel-kit" tripId={trip.id} onPageChange={onPageChange} />
                                <QuickWeatherLink icon={<CalendarBlank data-icon="inline-start" weight="duotone" />} label="Open planner" page="planner" tripId={trip.id} onPageChange={onPageChange} />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {(activeStop?.signals ?? []).map((signal) => (
                                <div key={signal.label} className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{signal.label}</p>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{signal.value}</p>
                                    <Badge variant={signal.tone} className="mt-3">{activeCity?.title ?? activeCountry?.name}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="gap-3">
                    <CardDescription>Trip-wide weather pressure</CardDescription>
                    <CardTitle>Read the route as a sequence of weather decisions</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-3 pb-2">
                            {pageDataset.weatherStops.map((stop) => {
                                const isActive = stop.id === activeStop?.id;
                                return (
                                    <button
                                        key={stop.id}
                                        type="button"
                                        onClick={() => handleContextSelectionChange({
                                            countryCode: stop.countryCode ?? pageContextSelection.countryCode,
                                            cityGuideId: stop.id,
                                        })}
                                        className={`min-w-[12rem] rounded-[1.5rem] border px-4 py-3 text-left transition-colors ${
                                            isActive
                                                ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                        }`}
                                    >
                                        <p className="text-sm font-medium">{stop.title}</p>
                                        <p className="mt-2 text-xs leading-5">{stop.headline}</p>
                                    </button>
                                );
                            })}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardDescription>Country season layer</CardDescription>
                                    <CardTitle>{activeCountry?.name ?? 'Country'} weather that matters for this route</CardTitle>
                                </div>
                                <Badge variant="outline">{activeCountry?.bestTime ?? 'Route season summary'}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-3">
                            {activeCountry?.seasonCards.map((card) => (
                                <div key={card.title} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">{card.title}</p>
                                        <Badge variant={card.tone}>{activeCountry.name}</Badge>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.detail}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardDescription>Condition lens</CardDescription>
                                    <CardTitle>Read the selected city through the decision that matters right now</CardTitle>
                                </div>
                                <ToggleGroup
                                    type="single"
                                    value={activeLens}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setActiveLens(value as TripWorkspaceWeatherLensId);
                                        trackEvent('trip_workspace__weather_lens--select', {
                                            trip_id: trip.id,
                                            lens: value,
                                        });
                                    }}
                                    variant="outline"
                                    className="flex w-full flex-wrap gap-2 lg:w-auto"
                                >
                                    {Object.entries(LENS_COPY).map(([value, entry]) => (
                                        <ToggleGroupItem
                                            key={value}
                                            value={value}
                                            className="rounded-full"
                                            {...getAnalyticsDebugAttributes('trip_workspace__weather_lens--select', {
                                                trip_id: trip.id,
                                                lens: value,
                                            })}
                                        >
                                            {entry.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <p className="text-sm font-medium text-foreground">{activeLensCopy.title}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeLensCopy.description}</p>
                                <p className="mt-4 text-sm leading-6 text-foreground">{lensBody}</p>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            {(activeStop?.forecast ?? []).map((day) => (
                                <div key={day.label} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{day.label}</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{day.tempC}</p>
                                        </div>
                                        <Badge variant="outline">{day.rainChance} rain</Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{day.condition}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <TripWorkspaceMapCard
                        eyebrow="Weather map"
                        title="Follow weather pressure across the route"
                        description="This lighter map uses the same trip map workflow as the rest of the workspace, but keeps the focus on route timing rather than full editing."
                        badges={[
                            `${pageDataset.weatherStops.length} weather stops`,
                            activeCountry?.name ?? 'Route-wide',
                            activeCity?.title ?? 'Current city',
                        ]}
                        items={cityStops}
                        mapStyle="clean"
                        routeMode="simple"
                        footer={(
                            <div className="grid gap-3">
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <p className="text-sm font-medium text-foreground">Route impact</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        {activeCity?.weather?.routeImpact ?? 'Weather impact notes are not available for this city yet.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    />

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Active city weather notes</CardDescription>
                            <CardTitle>What this changes in the plan</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Wind size={18} weight="duotone" className="text-sky-700" />
                                    <p className="text-sm font-medium text-foreground">Best activity window</p>
                                </div>
                                <p className="mt-2">{activeStop?.activityWindow ?? 'No activity window seeded for this city yet.'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Waves size={18} weight="duotone" className="text-cyan-700" />
                                    <p className="text-sm font-medium text-foreground">Sea and transfer notes</p>
                                </div>
                                <p className="mt-2">{activeStop?.seaNote ?? 'No marine note seeded for this city yet.'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Lifebuoy size={18} weight="duotone" className="text-amber-700" />
                                    <p className="text-sm font-medium text-foreground">Caution</p>
                                </div>
                                <p className="mt-2">{activeStop?.caution ?? 'No caution note seeded for this city yet.'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Backpack size={18} weight="duotone" className="text-emerald-700" />
                                    <p className="text-sm font-medium text-foreground">Pack notes</p>
                                </div>
                                <p className="mt-2">{activeStop?.packNotes.join(' • ') ?? 'No pack notes seeded for this city yet.'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
