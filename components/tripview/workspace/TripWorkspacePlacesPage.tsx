import React from 'react';
import { ArrowSquareOut, MapPinLine } from '@phosphor-icons/react';

import type { ITrip, ITimelineItem, TripWorkspaceContextSelection } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    getTripWorkspaceCityGuide,
    getTripWorkspaceCityItem,
    resolveTripWorkspaceCityStops,
    type TripWorkspaceDemoDataset,
} from './tripWorkspaceDemoData';
import { resolveTripWorkspaceContextSnapshot } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceMapCard } from './TripWorkspaceMapCard';
import {
    buildTripWorkspacePlacesFitBoundsCoordinates,
    buildTripWorkspacePlacesMapGeometry,
} from './tripWorkspacePlacesMapGeometry';
import { TripWorkspacePlacesMapNativeOverlay } from './TripWorkspacePlacesMapNativeOverlay';
import { TripWorkspacePlacesMapOverlay } from './TripWorkspacePlacesMapOverlay';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { TripWorkspaceSection } from './TripWorkspaceSection';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ScrollArea, ScrollBar } from '../../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TravelerWarningSummary {
    cityName: string;
    notes: string[];
}

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspacePlacesPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
    selectedItem: ITimelineItem | null;
    travelerWarnings: TravelerWarningSummary[];
}

const openExternalUrl = (href: string) => {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

export const TripWorkspacePlacesPage: React.FC<TripWorkspacePlacesPageProps> = ({
    trip,
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
    selectedItem,
    travelerWarnings,
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
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const [activeCountryLens, setActiveCountryLens] = React.useState<'practical' | 'safety' | 'season'>('practical');
    const [activeCityLens, setActiveCityLens] = React.useState<'arrival' | 'districts' | 'highlights'>('arrival');
    const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null);
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const activeCity = context.activeCity;
    const activeCountry = context.activeCountry;
    const activeCityItem = React.useMemo(
        () => (activeCity ? getTripWorkspaceCityItem(trip, activeCity.id) : null),
        [activeCity, trip],
    );
    const countryStops = React.useMemo(
        () => cityStops.filter((item) => {
            if (!activeCountry) return true;
            return getTripWorkspaceCityGuide(item.title)?.countryCode === activeCountry.code;
        }),
        [activeCountry, cityStops],
    );
    const activeCityCenter = activeCityItem?.coordinates ?? countryStops[0]?.coordinates ?? null;

    React.useEffect(() => {
        setActiveLayerId(null);
    }, [activeCity?.id]);

    const activeLayer = activeCity?.mapLayers.find((layer) => layer.id === activeLayerId) ?? null;
    const visibleNeighborhoods = activeCity?.neighborhoods.filter((neighborhood) => (
        !activeLayer || activeLayer.neighborhoodNames.includes(neighborhood.name)
    )) ?? [];
    const visibleStays = activeCity?.savedStays.filter((stay) => (
        !activeLayer || activeLayer.stayAreas.includes(stay.area)
    )) ?? [];
    const activeMapGeometry = React.useMemo(
        () => buildTripWorkspacePlacesMapGeometry({
            origin: activeCityCenter,
            visibleNeighborhoods,
            visibleStays,
            activeLayer,
        }),
        [activeCityCenter, activeLayer, visibleNeighborhoods, visibleStays],
    );
    const fitBoundsCoordinates = React.useMemo(
        () => buildTripWorkspacePlacesFitBoundsCoordinates(activeMapGeometry),
        [activeMapGeometry],
    );
    const activeWarnings = travelerWarnings.find((warning) => warning.cityName === activeCity?.title)?.notes ?? [];

    return (
        <div className="flex flex-col gap-6">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="places"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <TripWorkspaceSection
                eyebrow="Destination guide"
                title={`${activeCountry?.name ?? 'Destination'} and ${activeCity?.title ?? 'city'} in one working view`}
                description="Places should read like a route-aware guidebook. Country rules stay close, but the local city layer still decides where you sleep, how you arrive, and which district actually fits the trip."
                actions={<Badge variant="outline">{activeCountry?.freshness ?? 'Demo route data'}</Badge>}
            >
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-4">
                        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                            {activeCountry?.summary ?? 'Country context unavailable.'}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <p className="text-sm font-medium text-foreground">Country role in this route</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCountry?.routeRole ?? pageTripMeta.summaryLine}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <p className="text-sm font-medium text-foreground">City snapshot</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity?.role ?? 'City context unavailable.'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3 rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
                        <div>
                            <p className="text-sm font-medium text-foreground">Trip-specific city notes</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {activeCity?.tripInsights[0] ?? 'This route is still using demo guidance for city-specific choices.'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">General destination layer</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {activeCity?.generalInsights[0] ?? activeCountry?.facts[0]?.value ?? 'Country-wide practical rules remain visible here.'}
                            </p>
                        </div>
                        {selectedItem ? (
                            <div>
                                <p className="text-sm font-medium text-foreground">Planner handoff</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    You last touched <span className="font-medium text-foreground">{selectedItem.title}</span> in Planner, so this guide keeps the same stop in focus.
                                </p>
                            </div>
                        ) : null}
                    </div>
                </div>
            </TripWorkspaceSection>

            <TripWorkspaceSection
                eyebrow="Country guide"
                title="Keep the practical and regulatory layer readable"
                description="The country layer should answer the things you need to know fast, while leaving plenty of room for the more tactical city guide below."
            >
                <Tabs value={activeCountryLens} onValueChange={(value) => setActiveCountryLens(value as typeof activeCountryLens)}>
                    <TabsList variant="line" className="w-full flex-wrap gap-5">
                        <TabsTrigger value="practical">Practical</TabsTrigger>
                        <TabsTrigger value="safety">Safety</TabsTrigger>
                        <TabsTrigger value="season">Season</TabsTrigger>
                    </TabsList>

                    <TabsContent value="practical" className="mt-6">
                        <div className="grid gap-x-8 gap-y-6 xl:grid-cols-2">
                            {activeCountry?.facts.map((fact) => (
                                <div key={fact.label} className="min-w-0 border-b border-border/70 pb-5 last:border-b-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-foreground">{fact.label}</p>
                                        {fact.badge ? <Badge variant="outline">{fact.badge}</Badge> : null}
                                    </div>
                                    <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground">{fact.value}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {fact.freshness ? <Badge variant="secondary">{fact.freshness}</Badge> : null}
                                        {fact.sourceLine ? <Badge variant="outline">{fact.sourceLine}</Badge> : null}
                                    </div>
                                    {fact.link ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="mt-3 px-0"
                                            onClick={() => {
                                                trackEvent('trip_workspace__places_link--open', {
                                                    trip_id: trip.id,
                                                    target: fact.link?.href,
                                                    section: fact.label,
                                                });
                                                openExternalUrl(fact.link.href);
                                            }}
                                            {...getAnalyticsDebugAttributes('trip_workspace__places_link--open', {
                                                trip_id: trip.id,
                                                target: fact.link.href,
                                                section: fact.label,
                                            })}
                                        >
                                            {fact.link.label}
                                            <ArrowSquareOut data-icon="inline-end" weight="duotone" />
                                        </Button>
                                    ) : null}
                                </div>
                            ))}
                        </div>

                        <Accordion type="multiple" className="mt-6 grid gap-3">
                            <AccordionItem value="country-links" className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4">
                                <AccordionTrigger>Official links and support numbers</AccordionTrigger>
                                <AccordionContent className="grid gap-4 pb-4">
                                    <div className="flex flex-wrap gap-2">
                                        {activeCountry?.officialLinks.map((link) => (
                                            <Button key={link.href} type="button" variant="outline" onClick={() => openExternalUrl(link.href)}>
                                                {link.label}
                                                <ArrowSquareOut data-icon="inline-end" weight="duotone" />
                                            </Button>
                                        ))}
                                    </div>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {activeCountry?.emergencyNumbers.map((entry) => (
                                            <div key={entry.label} className="rounded-[1.25rem] border border-border/70 bg-background px-4 py-3">
                                                <p className="text-sm font-medium text-foreground">{entry.label}</p>
                                                <p className="mt-1 text-lg font-semibold text-foreground">{entry.value}</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>

                    <TabsContent value="safety" className="mt-6">
                        <div className="grid gap-3 lg:grid-cols-2">
                            {activeCountry?.safety.map((snapshot) => (
                                <div key={snapshot.label} className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">{snapshot.label}</p>
                                        <Badge variant={snapshot.tone}>{snapshot.score}</Badge>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{snapshot.detail}</p>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="season" className="mt-6">
                        <div className="space-y-4">
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <p className="text-sm font-medium text-foreground">Best time for this route</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCountry?.bestTime}</p>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-3">
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
                        </div>
                    </TabsContent>
                </Tabs>
            </TripWorkspaceSection>

            <TripWorkspaceSection
                eyebrow="City guide"
                title={`${activeCity?.title ?? 'City'} should feel tactical, not generic`}
                description="The city layer is where the route gets specific: arrival friction, district choice, highlights, and what changes for this exact stop."
            >
                <Tabs value={activeCityLens} onValueChange={(value) => setActiveCityLens(value as typeof activeCityLens)}>
                    <TabsList variant="line" className="w-full flex-wrap gap-5">
                        <TabsTrigger value="arrival">Arrival</TabsTrigger>
                        <TabsTrigger value="districts">Districts</TabsTrigger>
                        <TabsTrigger value="highlights">Highlights</TabsTrigger>
                    </TabsList>

                    <TabsContent value="arrival" className="mt-6">
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                            <div className="space-y-4">
                                <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                    <p className="text-sm font-medium text-foreground">Arrival and transit</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity?.arrival}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity?.transit}</p>
                                </div>
                                <div className="grid gap-3 lg:grid-cols-2">
                                    <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                        <p className="text-sm font-medium text-foreground">Ideal stay</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity?.idealStay}</p>
                                    </div>
                                    <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                        <p className="text-sm font-medium text-foreground">Best for</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {activeCity?.bestFor?.map((entry) => (
                                                <Badge key={entry} variant="outline">{entry}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
                                {activeWarnings.length > 0 ? (
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Traveler warnings</p>
                                        <div className="mt-2 grid gap-2">
                                            {activeWarnings.map((warning) => (
                                                <p key={warning} className="text-sm leading-6 text-muted-foreground">{warning}</p>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                <div>
                                    <p className="text-sm font-medium text-foreground">Trip-specific note</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity?.tripInsights[0] ?? 'Trip-specific notes are not available for this city yet.'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">General city context</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity?.generalInsights[0] ?? 'General city context is not available for this city yet.'}</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="districts" className="mt-6">
                        <div className="space-y-4">
                            <ScrollArea className="w-full whitespace-nowrap rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    className="w-max gap-2 pb-2"
                                    aria-label="City map layers"
                                    value={activeLayerId ?? '__all__'}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setActiveLayerId(value === '__all__' ? null : value);
                                    }}
                                >
                                    <ToggleGroupItem value="__all__">All areas</ToggleGroupItem>
                                    {activeCity?.mapLayers.map((layer) => (
                                        <ToggleGroupItem key={layer.id} value={layer.id}>
                                            {layer.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>

                            <div className="grid gap-3 lg:grid-cols-2">
                                {visibleNeighborhoods.map((neighborhood) => (
                                    <div key={neighborhood.name} className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                        <p className="text-sm font-medium text-foreground">{neighborhood.name}</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{neighborhood.fit}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="grid gap-3 lg:grid-cols-2">
                                {visibleStays.map((stay) => (
                                    <div key={stay.area} className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                        <p className="text-sm font-medium text-foreground">{stay.area}</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{stay.vibe}</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{stay.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="highlights" className="mt-6">
                        <Accordion type="multiple" className="grid gap-3">
                            <AccordionItem value="city-highlights" className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4">
                                <AccordionTrigger>Highlights and day trips</AccordionTrigger>
                                <AccordionContent className="grid gap-3 pb-4">
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {activeCity?.highlights.map((highlight) => (
                                            <div key={highlight} className="rounded-[1.25rem] border border-border/70 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
                                                {highlight}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {activeCity?.dayTrips?.map((tripItem) => (
                                            <div key={tripItem.title} className="rounded-[1.25rem] border border-border/70 bg-background px-4 py-3">
                                                <p className="text-sm font-medium text-foreground">{tripItem.title}</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{tripItem.detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="city-events" className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4">
                                <AccordionTrigger>Upcoming events and notes</AccordionTrigger>
                                <AccordionContent className="grid gap-3 pb-4">
                                    {activeCity?.events.map((event) => (
                                        <div key={event.title} className="rounded-[1.25rem] border border-border/70 bg-background px-4 py-3">
                                            <p className="text-sm font-medium text-foreground">{event.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.detail}</p>
                                        </div>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>
                </Tabs>
            </TripWorkspaceSection>

            <TripWorkspaceSection
                eyebrow="City map"
                title={`${activeCity?.title ?? 'City'} layers, stays, and arrival focus`}
                description="The map keeps neighborhoods, stay areas, and route handoff visible without turning the planner into the only place where city context exists."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{activeCountry?.name ?? 'Country'}</Badge>
                        <Badge variant="outline">{activeLayer?.label ?? 'All areas'}</Badge>
                    </div>
                }
            >
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <TripWorkspaceMapCard
                        frameVariant="plain"
                        eyebrow="Map"
                        title="Districts on map"
                        description={activeLayer?.detail ?? 'Choose a layer to spotlight the city without drowning the basemap in labels.'}
                        items={activeCityItem ? [activeCityItem] : countryStops}
                        mapStyle="standard"
                        routeMode="simple"
                        showCityNames={false}
                        fitBoundsCoordinates={fitBoundsCoordinates}
                        mapNativeOverlay={activeCity ? (
                            <TripWorkspacePlacesMapNativeOverlay
                                city={activeCity}
                                cityCenter={activeCityCenter}
                                activeLayer={activeLayer}
                                visibleNeighborhoods={visibleNeighborhoods}
                                visibleStays={visibleStays}
                            />
                        ) : null}
                        mapOverlay={activeCity ? (
                            <TripWorkspacePlacesMapOverlay
                                city={activeCity}
                                activeLayer={activeLayer}
                                visibleNeighborhoods={visibleNeighborhoods}
                                visibleStays={visibleStays}
                            />
                        ) : null}
                    />

                    <div className="space-y-4">
                        <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                            <p className="text-sm font-medium text-foreground">Official links</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {activeCity?.officialLinks.map((link) => (
                                    <Button key={link.href} type="button" variant="outline" size="sm" onClick={() => openExternalUrl(link.href)}>
                                        {link.label}
                                        <ArrowSquareOut data-icon="inline-end" weight="duotone" />
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                            <p className="text-sm font-medium text-foreground">Saved stay areas</p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{visibleStays.length} area anchors are visible in the active layer.</p>
                        </div>
                        <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                            <div className="flex items-center gap-2">
                                <MapPinLine size={16} weight="duotone" className="text-accent-700" />
                                <p className="text-sm font-medium text-foreground">Route handoff</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {activeCityItem
                                    ? `${activeCityItem.title} stays linked to the actual itinerary stop, so the guide and planner talk about the same place.`
                                    : 'This map is still using demo route coverage because the active city is not directly anchored to an itinerary stop.'}
                            </p>
                        </div>
                    </div>
                </div>
            </TripWorkspaceSection>
        </div>
    );
};
