import React from 'react';
import { ArrowSquareOut, MapPinLine } from '@phosphor-icons/react';

import type { ITrip, ITimelineItem } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    THAILAND_COUNTRY_FACTS,
    THAILAND_SAFETY_SNAPSHOTS,
    buildTripWorkspaceCityGuides,
    getTripWorkspaceCityGuide,
    getTripWorkspaceCityItem,
} from './tripWorkspaceDemoData';
import { TripWorkspaceMapCard } from './TripWorkspaceMapCard';
import { TripWorkspacePlacesMapOverlay } from './TripWorkspacePlacesMapOverlay';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TravelerWarningSummary {
    cityName: string;
    notes: string[];
}

interface TripWorkspacePlacesPageProps {
    trip: ITrip;
    selectedItem: ITimelineItem | null;
    travelerWarnings: TravelerWarningSummary[];
}

const openExternalUrl = (href: string) => {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

export const TripWorkspacePlacesPage: React.FC<TripWorkspacePlacesPageProps> = ({
    trip,
    selectedItem,
    travelerWarnings,
}) => {
    const cityGuides = React.useMemo(() => buildTripWorkspaceCityGuides(trip), [trip]);
    const initialCityId = React.useMemo(
        () => getTripWorkspaceCityGuide(selectedItem?.title ?? '')?.id ?? cityGuides[0]?.id ?? 'bangkok',
        [cityGuides, selectedItem?.title],
    );
    const [activeTab, setActiveTab] = React.useState<'country' | 'cities'>('country');
    const [activeCityId, setActiveCityId] = React.useState(initialCityId);
    const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null);

    React.useEffect(() => {
        setActiveCityId(initialCityId);
    }, [initialCityId]);

    React.useEffect(() => {
        setActiveLayerId(null);
    }, [activeCityId]);

    const activeCity = cityGuides.find((city) => city.id === activeCityId) ?? cityGuides[0] ?? null;
    const activeCityItem = activeCity ? getTripWorkspaceCityItem(trip, activeCity.id) : null;
    const activeLayer = activeCity?.mapLayers.find((layer) => layer.id === activeLayerId) ?? null;
    const visibleNeighborhoods = activeCity?.neighborhoods.filter((neighborhood) => (
        !activeLayer || activeLayer.neighborhoodNames.includes(neighborhood.name)
    )) ?? [];
    const visibleStays = activeCity?.savedStays.filter((stay) => (
        !activeLayer || activeLayer.stayAreas.includes(stay.area)
    )) ?? [];

    return (
        <div className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'country' | 'cities')}>
                <TabsList variant="line">
                    <TabsTrigger value="country">Country guide</TabsTrigger>
                    <TabsTrigger value="cities">City guide</TabsTrigger>
                </TabsList>
                <TabsContent value="country" className="mt-4 flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">General destination</Badge>
                                <Badge variant="outline">Updated weekly</Badge>
                                <Badge variant="outline">Official links</Badge>
                                <Badge variant="outline">Demo sources</Badge>
                            </div>
                            <CardDescription>Country prep split</CardDescription>
                            <CardTitle>Keep practical rules separate from city-specific choices</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">General destination layer</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Visa rules, sockets, driving side, and etiquette belong here because they stay relevant across the whole Thailand route.
                                </p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Trip-specific reminders</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Payment gaps, boat-transfer connectivity, and night-arrival friction should stay visible because this specific itinerary leans on them.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {THAILAND_COUNTRY_FACTS.map((fact) => (
                            <Card key={fact.label} className="border-border/80 bg-card/95 shadow-sm">
                                <CardHeader className="gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <CardDescription>{fact.label}</CardDescription>
                                        {fact.badge ? <Badge variant="outline">{fact.badge}</Badge> : null}
                                    </div>
                                    <CardTitle className="text-lg leading-8">{fact.value}</CardTitle>
                                    <div className="flex flex-wrap gap-2">
                                        {fact.freshness ? <Badge variant="secondary">{fact.freshness}</Badge> : null}
                                        {fact.sourceLine ? <Badge variant="outline">{fact.sourceLine}</Badge> : null}
                                    </div>
                                </CardHeader>
                                {fact.link ? (
                                    <CardContent className="pt-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="px-0"
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
                                            <ArrowSquareOut size={14} weight="duotone" />
                                        </Button>
                                    </CardContent>
                                ) : null}
                            </Card>
                        ))}
                    </div>
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Safety lens</CardDescription>
                            <CardTitle>Human-readable scores with context</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-2">
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
                </TabsContent>
                <TabsContent value="cities" className="mt-4 flex flex-col gap-4">
                    <Tabs value={activeCityId} onValueChange={setActiveCityId}>
                        <TabsList className="w-full justify-start overflow-x-auto" variant="default">
                            {cityGuides.map((city) => (
                                <TabsTrigger key={city.id} value={city.id}>
                                    {city.title}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {cityGuides.map((city) => (
                            <TabsContent key={city.id} value={city.id} className="mt-4">
                                <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                                    <Card className="border-border/80 bg-card/95 shadow-sm">
                                        <CardHeader className="gap-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary">Trip-specific + general</Badge>
                                                <Badge variant="outline">{city.freshness}</Badge>
                                                <Badge variant="outline">{city.sourceLine}</Badge>
                                            </div>
                                            <CardDescription>{city.role}</CardDescription>
                                            <CardTitle>{city.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-4 lg:grid-cols-2">
                                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                <p className="text-sm font-medium text-foreground">Ideal stay</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{city.idealStay}</p>
                                            </div>
                                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                <p className="text-sm font-medium text-foreground">Arrival basics</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{city.arrival}</p>
                                            </div>
                                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                <p className="text-sm font-medium text-foreground">Transit feel</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{city.transit}</p>
                                            </div>
                                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                <p className="text-sm font-medium text-foreground">Official links</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {city.officialLinks.map((link) => (
                                                        <Button
                                                            key={link.href}
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                trackEvent('trip_workspace__places_link--open', {
                                                                    trip_id: trip.id,
                                                                    target: link.href,
                                                                    section: city.id,
                                                                });
                                                                openExternalUrl(link.href);
                                                            }}
                                                            {...getAnalyticsDebugAttributes('trip_workspace__places_link--open', {
                                                                trip_id: trip.id,
                                                                target: link.href,
                                                                section: city.id,
                                                            })}
                                                        >
                                                            {link.label}
                                                            <ArrowSquareOut size={14} weight="duotone" />
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <TripWorkspaceMapCard
                                        eyebrow="City map"
                                        title={`${city.title} map layers`}
                                        description="This city preview uses the shared Trip map and now pulls neighborhood zones, stay anchors, and route-focus paths directly onto the surface."
                                        badges={['Shared map surface', 'Live demo overlays']}
                                        items={activeCityItem ? [activeCityItem] : []}
                                        mapStyle="minimal"
                                        routeMode="simple"
                                        mapOverlay={(
                                            <TripWorkspacePlacesMapOverlay
                                                city={city}
                                                activeLayer={activeLayer}
                                                visibleNeighborhoods={visibleNeighborhoods}
                                                visibleStays={visibleStays}
                                            />
                                        )}
                                        footer={(
                                            <div className="grid gap-3">
                                                <ToggleGroup
                                                    type="single"
                                                    value={activeLayerId ?? 'all'}
                                                    onValueChange={(value) => {
                                                        if (!value) return;
                                                        const nextLayerId = value === 'all' ? null : value;
                                                        trackEvent('trip_workspace__places_layer--toggle', {
                                                            trip_id: trip.id,
                                                            city_id: city.id,
                                                            layer_id: nextLayerId ?? 'all',
                                                            state: nextLayerId ? 'focused' : 'all',
                                                        });
                                                        setActiveLayerId(nextLayerId);
                                                    }}
                                                    variant="outline"
                                                    className="flex w-full flex-wrap gap-2"
                                                >
                                                    <ToggleGroupItem
                                                        value="all"
                                                        className="rounded-full"
                                                        {...getAnalyticsDebugAttributes('trip_workspace__places_layer--toggle', {
                                                            trip_id: trip.id,
                                                            city_id: city.id,
                                                            layer_id: 'all',
                                                            state: activeLayer ? 'all' : 'active',
                                                        })}
                                                    >
                                                        All areas
                                                    </ToggleGroupItem>
                                                    {city.mapLayers.map((layer) => (
                                                        <ToggleGroupItem
                                                            key={layer.id}
                                                            value={layer.id}
                                                            className="rounded-full"
                                                            {...getAnalyticsDebugAttributes('trip_workspace__places_layer--toggle', {
                                                                trip_id: trip.id,
                                                                city_id: city.id,
                                                                layer_id: layer.id,
                                                                state: activeLayer?.id === layer.id ? 'active' : 'inactive',
                                                            })}
                                                        >
                                                            {layer.label}
                                                        </ToggleGroupItem>
                                                    ))}
                                                </ToggleGroup>
                                                {activeLayer ? (
                                                    <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                                <MapPinLine size={16} weight="duotone" />
                                                                Selected layer
                                                            </div>
                                                            <Badge variant="secondary">{activeLayer.scope}</Badge>
                                                            <Badge variant="outline">{activeLayer.freshness}</Badge>
                                                            <Badge variant="outline">{activeLayer.sourceLine}</Badge>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                            {activeLayer.detail}
                                                        </p>
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <Badge variant="secondary">{visibleNeighborhoods.length} map zones</Badge>
                                                            <Badge variant="outline">
                                                                {visibleStays.length} stay {visibleStays.length === 1 ? 'anchor' : 'anchors'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-[1.5rem] border border-dashed border-border bg-background/70 px-4 py-3">
                                                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                            <MapPinLine size={16} weight="duotone" />
                                                            Layered city preview
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                            The map now surfaces every neighborhood anchor by default. Pick a layer to spotlight the route logic behind a calmer base, a food corridor, or a transfer hinge.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    />
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                                    <Card className="border-border/80 bg-card/95 shadow-sm">
                                        <CardHeader>
                                            <CardDescription>Best quarters</CardDescription>
                                            <CardTitle>{activeLayer ? `Neighborhoods for ${activeLayer.label.toLowerCase()}` : 'Where the city feels different'}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-3">
                                            {visibleNeighborhoods.map((neighborhood) => (
                                                <div key={neighborhood.name} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <p className="text-sm font-medium text-foreground">{neighborhood.name}</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{neighborhood.fit}</p>
                                                </div>
                                            ))}
                                            {visibleNeighborhoods.length === 0 ? (
                                                <div className="rounded-[1.5rem] border border-dashed border-border bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
                                                    This layer doesn’t narrow neighborhood picks yet. It mainly acts as a planning reminder for the map legend.
                                                </div>
                                            ) : null}
                                        </CardContent>
                                    </Card>
                                    <Card className="border-border/80 bg-card/95 shadow-sm">
                                        <CardHeader>
                                            <CardDescription>Trip notes and saved stays</CardDescription>
                                            <CardTitle>Keep the trip layer separate from the general city guide</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-3">
                                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="secondary">Layer highlights</Badge>
                                                    {activeLayer ? <Badge variant="outline">{activeLayer.label}</Badge> : null}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {city.highlights.map((highlight) => (
                                                        <Badge key={highlight} variant="outline">{highlight}</Badge>
                                                    ))}
                                                </div>
                                                {city.events[0] ? (
                                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                                        Route moment: {city.events[0].detail}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {visibleStays.map((stay) => (
                                                <div key={stay.area} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-medium text-foreground">{stay.area}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Badge variant="secondary">Trip stay</Badge>
                                                            <Badge variant="outline">{stay.vibe}</Badge>
                                                        </div>
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{stay.reason}</p>
                                                </div>
                                            ))}
                                            {city.tripInsights.map((note) => (
                                                <div key={note} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="secondary">Trip-specific</Badge>
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
                                                </div>
                                            ))}
                                            {city.generalInsights.map((note) => (
                                                <div key={note} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline">General destination</Badge>
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
                                                </div>
                                            ))}
                                            {travelerWarnings.length > 0 ? (
                                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <p className="text-sm font-medium text-foreground">Traveler warnings already in this trip</p>
                                                    <ul className="mt-2 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
                                                        {travelerWarnings.map((warning) => (
                                                            <li key={warning.cityName}>
                                                                {warning.cityName}: {warning.notes.join(' • ')}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <div className="rounded-[1.5rem] border border-dashed border-border bg-background/70 px-4 py-3">
                                                    <p className="text-sm font-medium text-foreground">No saved traveler warnings yet</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                        When planner notes call out late transfers, risky arrivals, or neighborhood cautions, they should stay visible here.
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    );
};
