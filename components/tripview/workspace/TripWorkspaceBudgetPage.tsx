import React from 'react';
import {
    CalendarBlank,
    Compass,
    PiggyBank,
    Receipt,
    ShieldCheck,
    SuitcaseRolling,
    TrendUp,
    Wallet,
} from '@phosphor-icons/react';

import type {
    ITrip,
    TripWorkspaceContextSelection,
    TripWorkspacePage,
} from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    type TripWorkspaceBudgetCategoryId,
    type TripWorkspaceBudgetScenarioId,
    type TripWorkspaceDemoDataset,
} from './tripWorkspaceDemoData';
import {
    filterTripWorkspaceEntriesBySelection,
    resolveTripWorkspaceContextSnapshot,
} from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Switch } from '../../ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceBudgetPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
    onPageChange: (page: TripWorkspacePage) => void;
}

type BudgetFilterId = 'all' | TripWorkspaceBudgetCategoryId;
type BudgetScope = 'trip' | 'country' | 'city';

const CATEGORY_COPY: Record<BudgetFilterId, string> = {
    all: 'All costs',
    stay: 'Stays',
    transport: 'Transport',
    food: 'Food',
    activity: 'Activities',
    buffer: 'Buffers',
};

const formatEuro = (value: number): string => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
}).format(value);

const STATUS_BADGE_VARIANT: Record<'Locked' | 'Flexible' | 'Watch', 'secondary' | 'outline'> = {
    Locked: 'secondary',
    Flexible: 'outline',
    Watch: 'outline',
};

const BudgetQuickAction: React.FC<{
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
            trackEvent('trip_workspace__budget_link--open', {
                trip_id: tripId,
                target_page: page,
            });
            onPageChange(page);
        }}
        {...getAnalyticsDebugAttributes('trip_workspace__budget_link--open', {
            trip_id: tripId,
            target_page: page,
        })}
    >
        {icon}
        {label}
    </Button>
);

export const TripWorkspaceBudgetPage: React.FC<TripWorkspaceBudgetPageProps> = ({
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
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const [scenarioId, setScenarioId] = React.useState<TripWorkspaceBudgetScenarioId>('balanced');
    const [activeFilter, setActiveFilter] = React.useState<BudgetFilterId>('all');
    const [activeScope, setActiveScope] = React.useState<BudgetScope>('trip');
    const [includeReserve, setIncludeReserve] = React.useState<boolean>(true);
    const [protectBuffers, setProtectBuffers] = React.useState<boolean>(true);

    const activeScenario = pageDataset.budgetScenarios.find((scenario) => scenario.id === scenarioId) ?? pageDataset.budgetScenarios[1];
    const scopedItems = React.useMemo(() => {
        const scopeMode = activeScope === 'trip' ? 'trip' : activeScope === 'country' ? 'country' : 'city';
        return filterTripWorkspaceEntriesBySelection(pageDataset.budgetLineItems, pageContextSelection, scopeMode);
    }, [activeScope, pageContextSelection, pageDataset.budgetLineItems]);

    const activeLineItems = React.useMemo(() => scopedItems.filter((item) => (
        protectBuffers || item.category !== 'buffer'
    )), [protectBuffers, scopedItems]);

    const filteredItems = React.useMemo(() => activeLineItems.filter((item) => (
        activeFilter === 'all' || item.category === activeFilter
    )), [activeFilter, activeLineItems]);

    const totals = React.useMemo(() => ({
        locked: activeLineItems.filter((item) => item.status === 'Locked').reduce((sum, item) => sum + item.amount, 0),
        flexible: activeLineItems.filter((item) => item.status === 'Flexible').reduce((sum, item) => sum + item.amount, 0),
        watch: activeLineItems.filter((item) => item.status === 'Watch').reduce((sum, item) => sum + item.amount, 0),
    }), [activeLineItems]);

    const workingTotal = totals.locked + totals.flexible + totals.watch + (includeReserve ? activeScenario.reserveBuffer : 0);
    const dailyTarget = Math.round(workingTotal / Math.max(Number.parseInt(pageTripMeta.totalDaysLabel, 10) || 1, 1));

    const countryRollups = React.useMemo(() => (
        pageDataset.countries.map((country) => {
            const total = pageDataset.budgetLineItems
                .filter((item) => item.countryCode === country.code)
                .reduce((sum, item) => sum + item.amount, 0);
            return { code: country.code, name: country.name, total };
        }).filter((entry) => entry.total > 0)
    ), [pageDataset.budgetLineItems, pageDataset.countries]);

    const cityRollups = React.useMemo(() => (
        context.countryCities.map((city) => {
            const total = pageDataset.budgetLineItems
                .filter((item) => item.cityId === city.id)
                .reduce((sum, item) => sum + item.amount, 0);
            return { id: city.id, title: city.title, total };
        }).filter((entry) => entry.total > 0)
    ), [context.countryCities, pageDataset.budgetLineItems]);

    const watchItems = activeLineItems.filter((item) => item.status === 'Watch');
    const borderCosts = activeLineItems.filter((item) => item.category === 'transport');

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="budget"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <Card className="overflow-hidden border-border/80 bg-linear-to-br from-emerald-50 via-background to-amber-50 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Route budget</Badge>
                        <Badge variant="outline">{activeScenario.label}</Badge>
                        <Badge variant="outline">{activeScope} view</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                            <CardDescription>Budget control room</CardDescription>
                            <CardTitle>See trip total, country rollups, and city pressure without turning this into accounting software</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Budget now mirrors the route hierarchy. Start at trip level, then drill into the active country and city when a border crossing,
                                stay decision, or buffer starts changing the shape of the trip.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <BudgetQuickAction icon={<SuitcaseRolling data-icon="inline-start" weight="duotone" />} label="Open bookings" page="bookings" tripId={trip.id} onPageChange={onPageChange} />
                                <BudgetQuickAction icon={<Compass data-icon="inline-start" weight="duotone" />} label="Open explore" page="explore" tripId={trip.id} onPageChange={onPageChange} />
                                <BudgetQuickAction icon={<CalendarBlank data-icon="inline-start" weight="duotone" />} label="Open planner" page="planner" tripId={trip.id} onPageChange={onPageChange} />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Working total</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{formatEuro(workingTotal)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{includeReserve ? 'Reserve included' : 'Reserve hidden for now'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Daily pace</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{formatEuro(dailyTarget)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pageTripMeta.totalDaysLabel} route days in this demo workspace.</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Locked now</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{formatEuro(totals.locked)}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Still moving</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{formatEuro(totals.flexible + totals.watch)}</p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardDescription>Budget stance</CardDescription>
                                    <CardTitle>Choose how generous this version of the route should feel</CardTitle>
                                </div>
                                <Badge variant="outline">{activeScenario.label}</Badge>
                            </div>
                            <ToggleGroup
                                type="single"
                                value={scenarioId}
                                onValueChange={(value) => {
                                    if (!value) return;
                                    setScenarioId(value as TripWorkspaceBudgetScenarioId);
                                    trackEvent('trip_workspace__budget_scenario--select', {
                                        trip_id: trip.id,
                                        scenario_id: value,
                                    });
                                }}
                                variant="outline"
                                className="flex w-full flex-wrap gap-2"
                            >
                                {pageDataset.budgetScenarios.map((scenario) => (
                                    <ToggleGroupItem
                                        key={scenario.id}
                                        value={scenario.id}
                                        className="rounded-full"
                                        {...getAnalyticsDebugAttributes('trip_workspace__budget_scenario--select', {
                                            trip_id: trip.id,
                                            scenario_id: scenario.id,
                                        })}
                                    >
                                        {scenario.label}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>

                            <ToggleGroup
                                type="single"
                                value={activeScope}
                                onValueChange={(value) => {
                                    if (!value) return;
                                    setActiveScope(value as BudgetScope);
                                }}
                                variant="outline"
                                className="flex w-full flex-wrap gap-2"
                            >
                                <ToggleGroupItem value="trip" className="rounded-full">Trip</ToggleGroupItem>
                                <ToggleGroupItem value="country" className="rounded-full">{context.activeCountry?.name ?? 'Country'}</ToggleGroupItem>
                                <ToggleGroupItem value="city" className="rounded-full">{context.activeCity?.title ?? 'City'}</ToggleGroupItem>
                            </ToggleGroup>

                            <ToggleGroup
                                type="single"
                                value={activeFilter}
                                onValueChange={(value) => {
                                    if (!value) return;
                                    setActiveFilter(value as BudgetFilterId);
                                    trackEvent('trip_workspace__budget_filter--select', {
                                        trip_id: trip.id,
                                        category: value,
                                    });
                                }}
                                variant="outline"
                                className="flex w-full flex-wrap gap-2"
                            >
                                {Object.entries(CATEGORY_COPY).map(([value, label]) => (
                                    <ToggleGroupItem
                                        key={value}
                                        value={value}
                                        className="rounded-full"
                                        {...getAnalyticsDebugAttributes('trip_workspace__budget_filter--select', {
                                            trip_id: trip.id,
                                            category: value,
                                        })}
                                    >
                                        {label}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Include reserve fund</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep a comfort margin for fare drift, border surprises, or one spontaneous good day.</p>
                                        </div>
                                        <Switch checked={includeReserve} onCheckedChange={setIncludeReserve} aria-label="Include reserve fund" />
                                    </div>
                                </div>
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Protect buffers</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep route buffers alive for weather, ferries, border timing, and transport swings.</p>
                                        </div>
                                        <Switch checked={protectBuffers} onCheckedChange={setProtectBuffers} aria-label="Protect route buffers" />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {filteredItems.map((item) => (
                                <div key={item.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                                <Badge variant={STATUS_BADGE_VARIANT[item.status]}>{item.status}</Badge>
                                                <Badge variant="outline">{CATEGORY_COPY[item.category]}</Badge>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-foreground">{formatEuro(item.amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Country rollups</CardDescription>
                            <CardTitle>See which country chapter is actually carrying the cost pressure</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {countryRollups.map((country) => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => {
                                        const nextCityId = pageDataset.cities.find((city) => city.countryCode === country.code)?.id ?? pageContextSelection.cityGuideId;
                                        handleContextSelectionChange({ countryCode: country.code, cityGuideId: nextCityId ?? null });
                                        setActiveScope('country');
                                    }}
                                    className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4 text-left transition-colors hover:border-accent-300 hover:bg-accent/5"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{country.name}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                {pageDataset.routeSummary.progression.find((entry) => entry.code === country.code)?.dayCount ?? 0} route days in this country.
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-foreground">{formatEuro(country.total)}</p>
                                            {context.activeCountry?.code === country.code ? <Badge variant="secondary">Active</Badge> : null}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>City envelopes</CardDescription>
                            <CardTitle>{context.activeCountry?.name ?? 'Country'} by city</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {cityRollups.map((city) => (
                                <button
                                    key={city.id}
                                    type="button"
                                    onClick={() => {
                                        handleContextSelectionChange({
                                            countryCode: context.activeCountry?.code ?? pageContextSelection.countryCode,
                                            cityGuideId: city.id,
                                        });
                                        setActiveScope('city');
                                    }}
                                    className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4 text-left transition-colors hover:border-accent-300 hover:bg-accent/5"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{city.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                {city.id === context.activeCity?.id ? 'Currently active city budget view.' : 'Tap to drill into this city envelope.'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-foreground">{formatEuro(city.total)}</p>
                                            {city.id === context.activeCity?.id ? <Badge variant="secondary">Active</Badge> : null}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Border and watchlist signals</CardDescription>
                            <CardTitle>The money decisions that still change the route shape</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            {watchItems.slice(0, 3).map((item) => (
                                <div key={item.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <TrendUp size={18} weight="duotone" className="text-amber-700" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                                            <p className="mt-1">{item.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Receipt size={18} weight="duotone" className="text-accent-700" />
                                    <p className="text-sm font-medium text-foreground">Cash rhythm</p>
                                </div>
                                <p className="mt-2">{context.activeCountry?.cashRhythm ?? 'Cash rhythm is not available for this country yet.'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={18} weight="duotone" className="text-emerald-700" />
                                    <p className="text-sm font-medium text-foreground">Buffer logic</p>
                                </div>
                                <p className="mt-2">Keep buffers alive to absorb route surprises rather than treating them like leftover money.</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <PiggyBank size={18} weight="duotone" className="text-sky-700" />
                                    <p className="text-sm font-medium text-foreground">Transport hinges</p>
                                </div>
                                <p className="mt-2">
                                    {borderCosts.length > 0
                                        ? `${borderCosts.length} transport line items currently carry route-hinge pressure in this view.`
                                        : 'No transport hinge costs are visible in this scope yet.'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
