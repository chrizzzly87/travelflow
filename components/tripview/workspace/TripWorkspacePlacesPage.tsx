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
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

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
    const [activeHighlight, setActiveHighlight] = React.useState<string | null>(null);

    React.useEffect(() => {
        setActiveCityId(initialCityId);
    }, [initialCityId]);

    const activeCity = cityGuides.find((city) => city.id === activeCityId) ?? cityGuides[0] ?? null;
    const activeCityItem = activeCity ? getTripWorkspaceCityItem(trip, activeCity.id) : null;

    return (
        <div className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'country' | 'cities')}>
                <TabsList variant="line">
                    <TabsTrigger value="country">Country guide</TabsTrigger>
                    <TabsTrigger value="cities">City guide</TabsTrigger>
                </TabsList>
                <TabsContent value="country" className="mt-4 flex flex-col gap-4">
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {THAILAND_COUNTRY_FACTS.map((fact) => (
                            <Card key={fact.label} className="border-border/80 bg-card/95 shadow-sm">
                                <CardHeader className="gap-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <CardDescription>{fact.label}</CardDescription>
                                        {fact.badge ? <Badge variant="outline">{fact.badge}</Badge> : null}
                                    </div>
                                    <CardTitle className="text-lg leading-8">{fact.value}</CardTitle>
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
                                                <Badge variant="outline">Demo sources</Badge>
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
                                        title={`${city.title} highlights`}
                                        description="This map now uses the same shared route engine as Planner, just scoped down to a calmer city preview."
                                        badges={['Real map surface', 'Demo highlight toggles']}
                                        items={activeCityItem ? [activeCityItem] : []}
                                        mapStyle="minimal"
                                        routeMode="simple"
                                        footer={(
                                            <div className="grid gap-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {city.mapHighlights.map((highlight) => (
                                                        <button
                                                            key={highlight}
                                                            type="button"
                                                            onClick={() => setActiveHighlight((current) => current === highlight ? null : highlight)}
                                                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                                                activeHighlight === highlight
                                                                    ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                                    : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                                            }`}
                                                        >
                                                            {highlight}
                                                        </button>
                                                    ))}
                                                </div>
                                                {activeHighlight ? (
                                                    <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                            <MapPinLine size={16} weight="duotone" />
                                                            Selected layer
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                            Demo highlight active: {activeHighlight}. This is where live saved stays, quarter layers, and arrival anchors will plug in next.
                                                        </p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )}
                                    />
                                </div>

                                <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                                    <Card className="border-border/80 bg-card/95 shadow-sm">
                                        <CardHeader>
                                            <CardDescription>Best quarters</CardDescription>
                                            <CardTitle>Where the city feels different</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-3">
                                            {city.neighborhoods.map((neighborhood) => (
                                                <div key={neighborhood.name} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <p className="text-sm font-medium text-foreground">{neighborhood.name}</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{neighborhood.fit}</p>
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                    <Card className="border-border/80 bg-card/95 shadow-sm">
                                        <CardHeader>
                                            <CardDescription>Trip notes and saved stays</CardDescription>
                                            <CardTitle>What to keep visible</CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-3">
                                            {city.savedStays.map((stay) => (
                                                <div key={stay.area} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-medium text-foreground">{stay.area}</p>
                                                        <Badge variant="outline">{stay.vibe}</Badge>
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{stay.reason}</p>
                                                </div>
                                            ))}
                                            {city.notes.map((note) => (
                                                <div key={note} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
                                                    {note}
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
                                            ) : null}
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
