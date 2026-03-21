import React from 'react';
import { ArrowSquareOut, CheckCircle, Compass, Sparkle } from '@phosphor-icons/react';

import type { ITrip } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { THAILAND_EXPLORE_LEADS, buildTripWorkspaceCityGuides } from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripWorkspaceExplorePageProps {
    trip: ITrip;
}

const openExternalUrl = (href: string) => {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

export const TripWorkspaceExplorePage: React.FC<TripWorkspaceExplorePageProps> = ({ trip }) => {
    const cityGuides = React.useMemo(() => buildTripWorkspaceCityGuides(trip), [trip]);
    const [activeFilter, setActiveFilter] = React.useState<'all' | 'activity' | 'stay' | 'event'>('all');
    const [activeCityId, setActiveCityId] = React.useState<string>('all');
    const [shortlistedIds, setShortlistedIds] = React.useState<string[]>(['chiang-mai-cooking']);

    const filteredLeads = React.useMemo(() => THAILAND_EXPLORE_LEADS.filter((lead) => {
        if (activeFilter !== 'all' && lead.type !== activeFilter) return false;
        if (activeCityId !== 'all' && lead.cityId !== activeCityId) return false;
        return true;
    }), [activeCityId, activeFilter]);

    return (
        <div className="flex flex-col gap-4">
            <Card className="border-border/80 bg-linear-to-br from-accent/10 via-background to-sky-50 shadow-sm">
                <CardHeader className="gap-3">
                    <CardDescription>Route-aware discovery board</CardDescription>
                    <CardTitle>Start with high-signal options, then shortlist the winners</CardTitle>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        Explore stays, events, and activities without losing the shape of the Thailand route. This stays intentionally lightweight until live discovery services land.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as typeof activeFilter)}>
                        <TabsList className="w-full justify-start overflow-x-auto">
                            <TabsTrigger value="all">All leads</TabsTrigger>
                            <TabsTrigger value="activity">Activities</TabsTrigger>
                            <TabsTrigger value="stay">Stays</TabsTrigger>
                            <TabsTrigger value="event">Events</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveCityId('all')}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                activeCityId === 'all'
                                    ? 'border-accent-500 bg-accent-50 text-accent-700'
                                    : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                            }`}
                        >
                            Entire route
                        </button>
                        {cityGuides.map((city) => (
                            <button
                                key={city.id}
                                type="button"
                                onClick={() => setActiveCityId(city.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    activeCityId === city.id
                                        ? 'border-accent-500 bg-accent-50 text-accent-700'
                                        : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                }`}
                            >
                                {city.title}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardDescription>Discovery leads</CardDescription>
                        <CardTitle>{filteredLeads.length} route-aware options</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {filteredLeads.map((lead) => {
                            const isSaved = shortlistedIds.includes(lead.id);
                            return (
                                <div key={lead.id} className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">{lead.type}</Badge>
                                        <Badge variant="outline">{lead.reason}</Badge>
                                    </div>
                                    <p className="mt-3 text-lg font-semibold text-foreground">{lead.title}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead.description}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant={isSaved ? 'outline' : 'default'}
                                            onClick={() => {
                                                setShortlistedIds((current) => current.includes(lead.id)
                                                    ? current.filter((id) => id !== lead.id)
                                                    : [...current, lead.id]);
                                                trackEvent('trip_workspace__explore_shortlist--toggle', {
                                                    trip_id: trip.id,
                                                    lead_id: lead.id,
                                                    active: !isSaved,
                                                });
                                            }}
                                            {...getAnalyticsDebugAttributes('trip_workspace__explore_shortlist--toggle', {
                                                trip_id: trip.id,
                                                lead_id: lead.id,
                                                active: !isSaved,
                                            })}
                                        >
                                            {isSaved ? <CheckCircle data-icon="inline-start" weight="duotone" /> : <Sparkle data-icon="inline-start" weight="duotone" />}
                                            {isSaved ? 'Shortlisted' : 'Save to shortlist'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => {
                                                trackEvent('trip_workspace__explore_link--open', {
                                                    trip_id: trip.id,
                                                    lead_id: lead.id,
                                                });
                                                openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(lead.query)}`);
                                            }}
                                            {...getAnalyticsDebugAttributes('trip_workspace__explore_link--open', {
                                                trip_id: trip.id,
                                                lead_id: lead.id,
                                            })}
                                        >
                                            <ArrowSquareOut data-icon="inline-start" weight="duotone" />
                                            Research
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Shortlist status</CardDescription>
                            <CardTitle>{shortlistedIds.length} saved route ideas</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {THAILAND_EXPLORE_LEADS.filter((lead) => shortlistedIds.includes(lead.id)).map((lead) => (
                                <div key={lead.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">{lead.title}</p>
                                        <Badge variant="outline">{lead.type}</Badge>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead.reason}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>How this page should evolve</CardDescription>
                            <CardTitle>Discovery playground notes</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <p>These cards stay route-aware by city, booking pressure, and trip rhythm rather than becoming a generic search dump.</p>
                            <p>Next step: replace demo search handoffs with live activity, stay, and event services that can save back into the trip.</p>
                            <Button type="button" variant="outline" className="justify-start">
                                <Compass data-icon="inline-start" weight="duotone" />
                                Demo scope is clearly marked
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
