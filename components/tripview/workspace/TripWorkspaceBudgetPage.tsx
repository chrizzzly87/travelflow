import React from 'react';
import {
    CalendarBlank,
    Compass,
    PiggyBank,
    Receipt,
    ShieldCheck,
    SuitcaseRolling,
    TrendUp,
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
import { TripWorkspaceCurrencyConverter } from './TripWorkspaceCurrencyConverter';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { TripWorkspaceSection } from './TripWorkspaceSection';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

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

const SCENARIO_CATEGORY_MULTIPLIERS: Record<TripWorkspaceBudgetScenarioId, Record<TripWorkspaceBudgetCategoryId, number>> = {
    lean: {
        stay: 0.88,
        transport: 0.92,
        food: 0.82,
        activity: 0.78,
        buffer: 1,
    },
    balanced: {
        stay: 1,
        transport: 1,
        food: 1,
        activity: 1,
        buffer: 1,
    },
    comfort: {
        stay: 1.24,
        transport: 1.08,
        food: 1.18,
        activity: 1.28,
        buffer: 1,
    },
};

const STATUS_BADGE_VARIANT: Record<'Locked' | 'Flexible' | 'Watch', 'secondary' | 'outline'> = {
    Locked: 'secondary',
    Flexible: 'outline',
    Watch: 'outline',
};

const formatEuro = (value: number): string => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
}).format(value);

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
    const scenarioAdjustedItems = React.useMemo(() => scopedItems.map((item) => ({
        ...item,
        amount: Math.round(item.amount * SCENARIO_CATEGORY_MULTIPLIERS[scenarioId][item.category]),
    })), [scenarioId, scopedItems]);
    const activeLineItems = React.useMemo(() => scenarioAdjustedItems.filter((item) => (
        protectBuffers || item.category !== 'buffer'
    )), [protectBuffers, scenarioAdjustedItems]);
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
        <div className="flex flex-col gap-6">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="budget"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <TripWorkspaceSection
                eyebrow="Budget overview"
                title="Follow the route budget without turning it into a spreadsheet"
                description="Start with the total pace, then use country and city tabs to find the one leg that is actually changing the shape of the trip."
                actions={<Badge variant="outline">{activeScenario.label}</Badge>}
            >
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Working total</p>
                                <p data-testid="budget-working-total-value" className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{formatEuro(workingTotal)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{includeReserve ? 'Reserve included' : 'Reserve hidden for a tighter view'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Daily pace</p>
                                <p data-testid="budget-daily-target-value" className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{formatEuro(dailyTarget)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{pageTripMeta.totalDaysLabel} route days in this demo</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Still moving</p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{formatEuro(totals.flexible + totals.watch)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">This is the part of the budget that can still change route quality.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <BudgetQuickAction icon={<SuitcaseRolling data-icon="inline-start" weight="duotone" />} label="Open bookings" page="bookings" tripId={trip.id} onPageChange={onPageChange} />
                            <BudgetQuickAction icon={<Compass data-icon="inline-start" weight="duotone" />} label="Open explore" page="explore" tripId={trip.id} onPageChange={onPageChange} />
                            <BudgetQuickAction icon={<CalendarBlank data-icon="inline-start" weight="duotone" />} label="Open planner" page="planner" tripId={trip.id} onPageChange={onPageChange} />
                        </div>
                    </div>
                    <div className="space-y-3 rounded-[1.75rem] border border-border/70 bg-muted/20 p-4">
                        <div>
                            <p className="text-sm font-medium text-foreground">Active scope</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">
                                {activeScope === 'trip'
                                    ? 'Full route'
                                    : activeScope === 'country'
                                        ? (context.activeCountry?.name ?? 'Country')
                                        : (context.activeCity?.title ?? 'City')}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {activeScenario.vibe}
                            </p>
                        </div>
                        <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                            <p><span className="font-medium text-foreground">Locked now:</span> {formatEuro(totals.locked)}</p>
                            <p><span className="font-medium text-foreground">Watch items:</span> {watchItems.length} budget lines still need attention.</p>
                            <p><span className="font-medium text-foreground">Transport hinges:</span> {borderCosts.length} line items are carrying timing or border pressure.</p>
                        </div>
                    </div>
                </div>
            </TripWorkspaceSection>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <TripWorkspaceSection
                    eyebrow="Budget filters"
                    title="Tune stance, scope, and category"
                    description="Tabs keep the route readable while you change the generosity of the trip, the active level of detail, and the cost category in focus."
                >
                    <div className="space-y-5">
                        <Tabs value={scenarioId} onValueChange={(value) => {
                            if (!value) return;
                            setScenarioId(value as TripWorkspaceBudgetScenarioId);
                            trackEvent('trip_workspace__budget_scenario--select', {
                                trip_id: trip.id,
                                scenario_id: value,
                            });
                        }}>
                            <TabsList variant="line" className="w-full flex-wrap gap-5">
                                {pageDataset.budgetScenarios.map((scenario) => (
                                    <TabsTrigger
                                        key={scenario.id}
                                        value={scenario.id}
                                        {...getAnalyticsDebugAttributes('trip_workspace__budget_scenario--select', {
                                            trip_id: trip.id,
                                            scenario_id: scenario.id,
                                        })}
                                    >
                                        {scenario.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <Tabs value={activeScope} onValueChange={(value) => {
                            if (!value) return;
                            setActiveScope(value as BudgetScope);
                        }}>
                            <TabsList variant="line" className="w-full flex-wrap gap-5">
                                <TabsTrigger value="trip">Trip</TabsTrigger>
                                <TabsTrigger value="country">{context.activeCountry?.name ?? 'Country'}</TabsTrigger>
                                <TabsTrigger value="city">{context.activeCity?.title ?? 'City'}</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Tabs value={activeFilter} onValueChange={(value) => {
                            if (!value) return;
                            setActiveFilter(value as BudgetFilterId);
                            trackEvent('trip_workspace__budget_filter--select', {
                                trip_id: trip.id,
                                category: value,
                            });
                        }}>
                            <TabsList className="flex w-full flex-wrap justify-start">
                                {Object.entries(CATEGORY_COPY).map(([value, label]) => (
                                    <TabsTrigger
                                        key={value}
                                        value={value}
                                        {...getAnalyticsDebugAttributes('trip_workspace__budget_filter--select', {
                                            trip_id: trip.id,
                                            category: value,
                                        })}
                                    >
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Include reserve fund</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep a comfort margin for route drift, border surprises, or one strong spontaneous day.</p>
                                </div>
                                <Switch checked={includeReserve} onCheckedChange={setIncludeReserve} aria-label="Include reserve fund" />
                            </div>
                            <div className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-4">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Protect buffers</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep weather, ferry, and border buffers visible instead of hiding them too early.</p>
                                </div>
                                <Switch checked={protectBuffers} onCheckedChange={setProtectBuffers} aria-label="Protect route buffers" />
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border/70 px-4 py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                <span>Budget line</span>
                                <span>Amount</span>
                            </div>
                            <div className="divide-y divide-border/70">
                                {filteredItems.map((item) => (
                                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                                <Badge variant={STATUS_BADGE_VARIANT[item.status]}>{item.status}</Badge>
                                                <Badge variant="outline">{CATEGORY_COPY[item.category]}</Badge>
                                            </div>
                                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{item.detail}</p>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">{formatEuro(item.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TripWorkspaceSection>

                <div className="flex flex-col gap-6">
                    <TripWorkspaceSection
                        eyebrow="Currency"
                        title={`${context.activeCountry?.currencyName ?? 'Currency'} at route pace`}
                        description={context.activeCountry?.cashRhythm ?? 'Use the converter to keep arrival-day cash decisions concrete.'}
                    >
                        <TripWorkspaceCurrencyConverter
                            countryCode={context.activeCountry?.code ?? null}
                            currencyCode={context.activeCountry?.currencyCode ?? 'THB'}
                            currencyName={context.activeCountry?.currencyName ?? 'Thai baht'}
                        />
                    </TripWorkspaceSection>

                    <TripWorkspaceSection
                        eyebrow="Rollups"
                        title="Follow cost pressure through the route"
                        description="Trip totals are useful first. Country and city rollups are where the route starts telling you what needs to be adjusted."
                    >
                        <div className="space-y-5">
                            <div>
                                <p className="text-sm font-medium text-foreground">Country rollups</p>
                                <div className="mt-3 divide-y divide-border/70 rounded-[1.5rem] border border-border/70">
                                    {countryRollups.map((country) => (
                                        <button
                                            key={country.code}
                                            type="button"
                                            onClick={() => {
                                                const nextCityId = pageDataset.cities.find((city) => city.countryCode === country.code)?.id ?? pageContextSelection.cityGuideId;
                                                handleContextSelectionChange({ countryCode: country.code, cityGuideId: nextCityId ?? null });
                                                setActiveScope('country');
                                            }}
                                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{country.name}</p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {pageDataset.routeSummary.progression.find((entry) => entry.code === country.code)?.dayCount ?? 0} route days.
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-foreground">{formatEuro(country.total)}</p>
                                                {context.activeCountry?.code === country.code ? <Badge variant="secondary" className="mt-2">Active</Badge> : null}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-foreground">{context.activeCountry?.name ?? 'Country'} by city</p>
                                <div className="mt-3 divide-y divide-border/70 rounded-[1.5rem] border border-border/70">
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
                                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                                        >
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{city.title}</p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {city.id === context.activeCity?.id ? 'Active city budget view.' : 'Open this city envelope.'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-foreground">{formatEuro(city.total)}</p>
                                                {city.id === context.activeCity?.id ? <Badge variant="secondary" className="mt-2">Active</Badge> : null}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </TripWorkspaceSection>

                    <TripWorkspaceSection
                        eyebrow="Watchlist"
                        title="The costs that still change the route"
                        description="This keeps the meaningful budget signals close without burying them under every single line item."
                    >
                        <div className="space-y-3">
                            {watchItems.slice(0, 3).map((item) => (
                                <div key={item.id} className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <TrendUp size={18} weight="duotone" className="text-amber-700" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Receipt size={18} weight="duotone" className="text-accent-700" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Cash rhythm</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{context.activeCountry?.cashRhythm ?? 'Cash rhythm is not available for this country yet.'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={18} weight="duotone" className="text-emerald-700" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Buffer logic</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep buffers alive to absorb border, ferry, and weather surprises instead of treating them like leftover money.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <PiggyBank size={18} weight="duotone" className="text-sky-700" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Transport hinges</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                            {borderCosts.length > 0
                                                ? `${borderCosts.length} transport line items currently carry route-hinge pressure in this view.`
                                                : 'No transport hinge costs are visible in this scope yet.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TripWorkspaceSection>
                </div>
            </div>
        </div>
    );
};
