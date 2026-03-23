import React from 'react';
import { GlobeHemisphereWest, Path, Signpost, Sparkle } from '@phosphor-icons/react';

import type { TripWorkspaceContextSelection, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import type { TripWorkspaceDemoDataset } from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { ScrollArea, ScrollBar } from '../../ui/scroll-area';
import { Separator } from '../../ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

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
    const countryValue = activeCountry?.code ?? '';
    const cityValue = activeCity?.id ?? '';

    return (
        <section className="space-y-5 border-b border-border/60 pb-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
                <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                            <Sparkle className="mr-1 size-3.5" weight="duotone" />
                            Route context
                        </Badge>
                        <Badge variant="outline">{tripMeta.dateRange}</Badge>
                        <Badge variant="outline">{dataset.routeSummary.countryCount} countries</Badge>
                        <Badge variant="outline">{dataset.routeSummary.cityCount} cities</Badge>
                    </div>
                    <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                        {tripMeta.summaryLine}. Move between trip, country, and city context without losing the route shape.
                    </p>
                </div>
                <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                        {nextBorderCrossing ? <Signpost size={16} weight="duotone" /> : <Path size={16} weight="duotone" />}
                        {nextBorderCrossing ? 'Next transition' : 'Single-country route'}
                    </div>
                    <p className="mt-2 text-sm leading-6">
                        {nextBorderCrossing
                            ? nextBorderCrossing.label
                            : 'This trip stays inside one country, so city context becomes the main switch.'}
                    </p>
                </div>
            </div>

            <Separator />

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        <GlobeHemisphereWest size={14} weight="duotone" />
                        Countries on this route
                    </div>
                    <Tabs value={countryValue} className="mt-3">
                        <ScrollArea className="w-full whitespace-nowrap">
                            <TabsList variant="line" className="w-max gap-5">
                                {dataset.countries.map((country) => (
                                    <TabsTrigger
                                        key={country.code}
                                        value={country.code}
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
                                        {...getAnalyticsDebugAttributes('trip_workspace__context_select', {
                                            trip_id: tripId,
                                            page,
                                            level: 'country',
                                            country_code: country.code,
                                        })}
                                    >
                                        {country.name}
                                        <span className="ms-2 text-xs text-muted-foreground">{country.cityCount} cities</span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </Tabs>
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        <Path size={14} weight="duotone" />
                        Cities in {activeCountry?.name ?? 'this trip'}
                    </div>
                    <Tabs value={cityValue} className="mt-3">
                        <ScrollArea className="w-full whitespace-nowrap">
                            <TabsList variant="line" className="w-max gap-5">
                                {activeCities.map((city) => (
                                    <TabsTrigger
                                        key={city.id}
                                        value={city.id}
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
                                        {...getAnalyticsDebugAttributes('trip_workspace__context_select', {
                                            trip_id: tripId,
                                            page,
                                            level: 'city',
                                            country_code: city.countryCode,
                                            city_id: city.id,
                                        })}
                                    >
                                        {city.title}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </Tabs>
                </div>
            </div>

            {(activeCountry || activeCity) ? (
                <div className="grid gap-5 border-t border-border/60 pt-5 md:grid-cols-2">
                    {activeCountry ? (
                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Country snapshot</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{activeCountry.name}</p>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{activeCountry.summary}</p>
                        </div>
                    ) : null}
                    {activeCity ? (
                        <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">City snapshot</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{activeCity.title}</p>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{activeCity.role}</p>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
};
