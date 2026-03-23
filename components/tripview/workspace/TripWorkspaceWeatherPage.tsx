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
import { TripWorkspaceSection } from './TripWorkspaceSection';
import {
    TripWorkspaceWeatherForecastStrip,
    TripWorkspaceWeatherHeroWidget,
    TripWorkspaceWeatherTrendChart,
} from './TripWorkspaceWeatherWidgets';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ScrollArea, ScrollBar } from '../../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

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
        title: 'How the day feels once you are actually moving',
        description: 'This lens keeps the focus on comfort, energy, and whether the route still feels worth doing at full strength.',
    },
    rain: {
        label: 'Rain risk',
        title: 'Where showers actually change the plan',
        description: 'Use this when you need to understand which city day weakens first if rain lands in the wrong window.',
    },
    sea: {
        label: 'Sea watch',
        title: 'Marine and transfer-sensitive pressure',
        description: 'This matters most on ferries, islands, viewpoints, or scenic legs where weather affects payoff directly.',
    },
    pack: {
        label: 'Pack notes',
        title: 'What to keep reachable without overpacking',
        description: 'Use this for the small items that keep route quality high across country changes and mixed conditions.',
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
        <div className="flex flex-col gap-6">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="weather"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <TripWorkspaceSection
                eyebrow="Weather pulse"
                title={`${activeCity?.title ?? 'Current stop'} weather at a glance`}
                description="Weather belongs in the workspace as a decision layer. It should tell you what changes in the route, not bury you in generic forecast tables."
                actions={<Badge variant="outline">{activeStop?.updateLine ?? 'Seeded route weather'}</Badge>}
            >
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-5">
                        <TripWorkspaceWeatherHeroWidget
                            cityTitle={activeCity?.title ?? 'Current stop'}
                            headline={activeStop?.headline ?? 'Weather detail is not available for this city yet.'}
                            forecast={activeStop?.forecast ?? []}
                            signals={activeStop?.signals ?? []}
                        />
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
                                            className={`min-w-[13rem] rounded-[1.5rem] border px-4 py-3 text-left transition-colors ${
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
                    </div>
                    <div className="space-y-3 rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
                        <div>
                            <p className="text-sm font-medium text-foreground">Active country season</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">{activeCountry?.name ?? 'Route overview'}</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCountry?.bestTime ?? 'Route season summary unavailable.'}</p>
                        </div>
                        <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                            {activeCountry?.seasonCards.slice(0, 3).map((card) => (
                                <p key={card.title}>
                                    <span className="font-medium text-foreground">{card.title}:</span> {card.detail}
                                </p>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <QuickWeatherLink icon={<GlobeHemisphereWest data-icon="inline-start" weight="duotone" />} label="Open places" page="places" tripId={trip.id} onPageChange={onPageChange} />
                            <QuickWeatherLink icon={<Backpack data-icon="inline-start" weight="duotone" />} label="Open travel kit" page="travel-kit" tripId={trip.id} onPageChange={onPageChange} />
                            <QuickWeatherLink icon={<CalendarBlank data-icon="inline-start" weight="duotone" />} label="Open planner" page="planner" tripId={trip.id} onPageChange={onPageChange} />
                        </div>
                    </div>
                </div>
            </TripWorkspaceSection>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <TripWorkspaceSection
                    eyebrow="Forecast"
                    title="Read the next days through the decision that matters"
                    description="The tabs shift the reading lens, while the widgets stay compact and visual enough to scan quickly."
                >
                    <Tabs
                        value={activeLens}
                        onValueChange={(value) => {
                            if (!value) return;
                            setActiveLens(value as TripWorkspaceWeatherLensId);
                            trackEvent('trip_workspace__weather_lens--select', {
                                trip_id: trip.id,
                                lens: value,
                            });
                        }}
                    >
                        <TabsList variant="line" className="w-full flex-wrap gap-5">
                            {Object.entries(LENS_COPY).map(([value, entry]) => (
                                <TabsTrigger
                                    key={value}
                                    value={value}
                                    {...getAnalyticsDebugAttributes('trip_workspace__weather_lens--select', {
                                        trip_id: trip.id,
                                        lens: value,
                                    })}
                                >
                                    {entry.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {Object.entries(LENS_COPY).map(([value]) => (
                            <TabsContent key={value} value={value} className="mt-6">
                                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
                                    <div className="space-y-4">
                                        <TripWorkspaceWeatherForecastStrip forecast={activeStop?.forecast ?? []} />
                                        <TripWorkspaceWeatherTrendChart forecast={activeStop?.forecast ?? []} />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
                                            <p className="text-sm font-medium text-foreground">{activeLensCopy.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeLensCopy.description}</p>
                                            <p className="mt-4 text-sm leading-6 text-foreground">{lensBody}</p>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Wind size={18} weight="duotone" className="text-sky-700" />
                                                    <p className="text-sm font-medium text-foreground">Best activity window</p>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStop?.activityWindow ?? 'No activity window seeded for this city yet.'}</p>
                                            </div>
                                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Waves size={18} weight="duotone" className="text-cyan-700" />
                                                    <p className="text-sm font-medium text-foreground">Sea and transfer notes</p>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStop?.seaNote ?? 'No marine note seeded for this city yet.'}</p>
                                            </div>
                                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Lifebuoy size={18} weight="duotone" className="text-amber-700" />
                                                    <p className="text-sm font-medium text-foreground">Caution</p>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStop?.caution ?? 'No caution note seeded for this city yet.'}</p>
                                            </div>
                                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Backpack size={18} weight="duotone" className="text-emerald-700" />
                                                    <p className="text-sm font-medium text-foreground">Pack notes</p>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStop?.packNotes.join(' • ') ?? 'No pack notes seeded for this city yet.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </TripWorkspaceSection>

                <TripWorkspaceSection
                    eyebrow="Country season layer"
                    title={`${activeCountry?.name ?? 'Country'} weather that matters for this route`}
                    description="This is the high-level season view. It stays compact so the city widgets can do the tactical work."
                >
                    <div className="space-y-3">
                        {activeCountry?.seasonCards.map((card) => (
                            <div key={card.title} className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">{card.title}</p>
                                    <Badge variant={card.tone}>{activeCountry.name}</Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.detail}</p>
                            </div>
                        ))}
                    </div>
                </TripWorkspaceSection>
            </div>

            <TripWorkspaceSection
                eyebrow="Weather map"
                title="Route pressure across the full trip"
                description="The map stays lightweight here. It is only for reading the route rhythm, not for editing it."
            >
                <TripWorkspaceMapCard
                    frameVariant="plain"
                    eyebrow="Route map"
                    title="Follow weather pressure across the route"
                    description="This uses the same trip map workflow as the rest of the workspace, but keeps the focus on timing and route sensitivity."
                    badges={[
                        `${pageDataset.weatherStops.length} weather stops`,
                        activeCountry?.name ?? 'Route-wide',
                        activeCity?.title ?? 'Current city',
                    ]}
                    items={cityStops}
                    mapStyle="clean"
                    routeMode="simple"
                    footer={(
                        <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                            <div className="flex items-center gap-3">
                                <CloudSun size={18} weight="duotone" className="text-sky-700" />
                                <div>
                                    <p className="text-sm font-medium text-foreground">Route impact</p>
                                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                        {activeCity?.weather?.routeImpact ?? 'Weather impact notes are not available for this city yet.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                />
            </TripWorkspaceSection>
        </div>
    );
};
