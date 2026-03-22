import React from 'react';
import { GlobeHemisphereWest, Path, Signpost, Sparkle } from '@phosphor-icons/react';

import type { TripWorkspaceContextSelection, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { cn } from '../../../lib/utils';
import type { TripWorkspaceDemoDataset } from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { ScrollArea, ScrollBar } from '../../ui/scroll-area';
import { Separator } from '../../ui/separator';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceRouteContextBarProps {
    tripId: string;
    page: TripWorkspacePage;
    dataset: TripWorkspaceDemoDataset;
    tripMeta: TripMetaSummary;
    selection: TripWorkspaceContextSelection;
    onSelectionChange: (next: TripWorkspaceContextSelection) => void;
}

const ContextChip: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    analytics: Record<string, unknown>;
}> = ({ active, onClick, children, analytics }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            active
                ? 'border-accent-500 bg-accent-50 text-accent-700'
                : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground',
        )}
        {...getAnalyticsDebugAttributes('trip_workspace__context_select', analytics)}
    >
        {children}
    </button>
);

export const TripWorkspaceRouteContextBar: React.FC<TripWorkspaceRouteContextBarProps> = ({
    tripId,
    page,
    dataset,
    tripMeta,
    selection,
    onSelectionChange,
}) => {
    const activeCountry = dataset.countries.find((country) => country.code === selection.countryCode) ?? dataset.countries[0] ?? null;
    const activeCities = dataset.cities.filter((city) => city.countryCode === activeCountry?.code);
    const activeCity = activeCities.find((city) => city.id === selection.cityGuideId) ?? activeCities[0] ?? dataset.cities[0] ?? null;
    const nextBorderCrossing = dataset.routeSummary.nextBorderCrossing;

    return (
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardContent className="flex flex-col gap-4 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                                <Sparkle className="mr-1 size-3.5" weight="duotone" />
                                Route context
                            </Badge>
                            <Badge variant="outline">{tripMeta.dateRange}</Badge>
                            <Badge variant="outline">{dataset.routeSummary.countryCount} countries</Badge>
                            <Badge variant="outline">{dataset.routeSummary.cityCount} cities</Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                            {tripMeta.summaryLine}. Move between trip, country, and city context without losing the route shape.
                        </p>
                    </div>
                    {nextBorderCrossing ? (
                        <div className="rounded-[1.25rem] border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2 font-medium text-foreground">
                                <Signpost size={16} weight="duotone" />
                                Next transition
                            </div>
                            <p className="mt-1 text-xs leading-5">{nextBorderCrossing.label}</p>
                        </div>
                    ) : (
                        <div className="rounded-[1.25rem] border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2 font-medium text-foreground">
                                <Path size={16} weight="duotone" />
                                Single-country route
                            </div>
                            <p className="mt-1 text-xs leading-5">This trip stays inside one country, so city context becomes the main switch.</p>
                        </div>
                    )}
                </div>

                <Separator />

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        <GlobeHemisphereWest size={14} weight="duotone" />
                        Countries on this route
                    </div>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2 pb-1">
                            {dataset.countries.map((country) => (
                                <ContextChip
                                    key={country.code}
                                    active={selection.countryCode === country.code}
                                    onClick={() => {
                                        const nextCity = dataset.cities.find((city) => city.countryCode === country.code)?.id ?? null;
                                        trackEvent('trip_workspace__context_select', {
                                            trip_id: tripId,
                                            page,
                                            level: 'country',
                                            country_code: country.code,
                                        });
                                        onSelectionChange({
                                            countryCode: country.code,
                                            cityGuideId: nextCity,
                                        });
                                    }}
                                    analytics={{
                                        trip_id: tripId,
                                        page,
                                        level: 'country',
                                        country_code: country.code,
                                    }}
                                >
                                    {country.name}
                                    <span className="ms-1 text-[11px] opacity-70">{country.cityCount} cities</span>
                                </ContextChip>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        <Path size={14} weight="duotone" />
                        Cities in {activeCountry?.name ?? 'this trip'}
                    </div>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex gap-2 pb-1">
                            {activeCities.map((city) => (
                                <ContextChip
                                    key={city.id}
                                    active={selection.cityGuideId === city.id}
                                    onClick={() => {
                                        trackEvent('trip_workspace__context_select', {
                                            trip_id: tripId,
                                            page,
                                            level: 'city',
                                            country_code: city.countryCode,
                                            city_id: city.id,
                                        });
                                        onSelectionChange({
                                            countryCode: city.countryCode ?? selection.countryCode,
                                            cityGuideId: city.id,
                                        });
                                    }}
                                    analytics={{
                                        trip_id: tripId,
                                        page,
                                        level: 'city',
                                        country_code: city.countryCode,
                                        city_id: city.id,
                                    }}
                                >
                                    {city.title}
                                </ContextChip>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                {activeCountry || activeCity ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {activeCountry ? (
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">{activeCountry.name}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCountry.summary}</p>
                            </div>
                        ) : null}
                        {activeCity ? (
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">{activeCity.title}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCity.role}</p>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
};
