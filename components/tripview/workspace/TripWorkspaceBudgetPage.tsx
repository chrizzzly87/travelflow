import React from 'react';
import {
    CalendarBlank,
    Compass,
    GlobeHemisphereWest,
    PiggyBank,
    Receipt,
    ShieldCheck,
    SuitcaseRolling,
    TrendUp,
    Wallet,
} from '@phosphor-icons/react';

import type { ITrip, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    THAILAND_BUDGET_LINE_ITEMS,
    THAILAND_BUDGET_SCENARIOS,
    type TripWorkspaceBudgetCategoryId,
    type TripWorkspaceBudgetScenarioId,
    getTripWorkspaceCityGuide,
    resolveTripWorkspaceCityStops,
} from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Switch } from '../../ui/switch';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TripWorkspaceBudgetPageProps {
    trip: ITrip;
    onPageChange: (page: TripWorkspacePage) => void;
}

type BudgetFilterId = 'all' | TripWorkspaceBudgetCategoryId;

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
    onPageChange,
}) => {
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const totalDays = React.useMemo(
        () => cityStops.reduce((sum, item) => sum + item.duration, 0),
        [cityStops],
    );

    const [scenarioId, setScenarioId] = React.useState<TripWorkspaceBudgetScenarioId>('balanced');
    const [activeFilter, setActiveFilter] = React.useState<BudgetFilterId>('all');
    const [includeReserve, setIncludeReserve] = React.useState<boolean>(true);
    const [protectBoatBuffer, setProtectBoatBuffer] = React.useState<boolean>(true);

    const activeScenario = THAILAND_BUDGET_SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? THAILAND_BUDGET_SCENARIOS[1];

    const activeLineItems = React.useMemo(() => THAILAND_BUDGET_LINE_ITEMS.filter((item) => (
        protectBoatBuffer || item.category !== 'buffer'
    )), [protectBoatBuffer]);

    const filteredItems = React.useMemo(() => activeLineItems.filter((item) => (
        activeFilter === 'all' || item.category === activeFilter
    )), [activeFilter, activeLineItems]);

    const lockedNow = React.useMemo(
        () => activeLineItems.filter((item) => item.status === 'Locked').reduce((sum, item) => sum + item.amount, 0),
        [activeLineItems],
    );
    const flexibleNow = React.useMemo(
        () => activeLineItems.filter((item) => item.status === 'Flexible').reduce((sum, item) => sum + item.amount, 0),
        [activeLineItems],
    );
    const watchNow = React.useMemo(
        () => activeLineItems.filter((item) => item.status === 'Watch').reduce((sum, item) => sum + item.amount, 0),
        [activeLineItems],
    );
    const coastBufferValue = React.useMemo(
        () => THAILAND_BUDGET_LINE_ITEMS.filter((item) => item.category === 'buffer').reduce((sum, item) => sum + item.amount, 0),
        [],
    );
    const workingTotal = activeScenario.totalEstimate
        + (includeReserve ? activeScenario.reserveBuffer : 0)
        - (protectBoatBuffer ? 0 : coastBufferValue);
    const dailyTarget = Math.round(workingTotal / Math.max(totalDays, 1));

    const cityRollup = React.useMemo(() => cityStops.map((stop) => {
        const guide = getTripWorkspaceCityGuide(stop.title);
        const matchingItems = activeLineItems.filter((item) => item.cityId === guide?.id);
        const total = matchingItems.reduce((sum, item) => sum + item.amount, 0);

        return {
            id: stop.id,
            title: stop.title,
            total,
            itemCount: matchingItems.length,
            stance: matchingItems.some((item) => item.status === 'Watch')
                ? 'Still moving'
                : matchingItems.some((item) => item.status === 'Flexible')
                    ? 'Mostly shaped'
                    : 'Pretty settled',
        };
    }).filter((entry) => entry.itemCount > 0), [activeLineItems, cityStops]);

    const watchItems = activeLineItems.filter((item) => item.status === 'Watch');

    return (
        <div className="flex flex-col gap-4">
            <Card className="overflow-hidden border-border/80 bg-linear-to-br from-emerald-50 via-background to-amber-50 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Demo spend layer</Badge>
                        <Badge variant="outline">Trip money</Badge>
                        <Badge variant="outline">Thailand route</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                            <CardDescription>Budget control room</CardDescription>
                            <CardTitle>See where the route is actually expensive, flexible, or quietly risky</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Budget belongs in the workspace because spend pressure changes booking choices, activity pace, and how much weather chaos the route can absorb.
                                This Thailand page stays light on accounting and heavy on the decisions that move the trip.
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
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{totalDays} route days in this demo workspace.</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Locked now</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{formatEuro(lockedNow)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">Already behaving like committed spend.</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Still moving</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{formatEuro(flexibleNow + watchNow)}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">The part of the trip that can still change shape.</p>
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
                                    <CardTitle>Choose how generous this Thailand version of the trip should feel</CardTitle>
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
                                {THAILAND_BUDGET_SCENARIOS.map((scenario) => (
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
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-start gap-3">
                                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                                        <Wallet size={22} weight="duotone" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{activeScenario.label} stance</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeScenario.vibe}</p>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardDescription>Line items</CardDescription>
                                    <CardTitle>Keep the route costs readable without pretending this is an accounting app</CardTitle>
                                </div>
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
                                    className="flex w-full flex-wrap gap-2 lg:w-auto"
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
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Include reserve fund</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep a comfort margin for fare drift, stronger rooms, or one spontaneous good day.</p>
                                        </div>
                                        <Switch
                                            checked={includeReserve}
                                            onCheckedChange={(checked) => {
                                                setIncludeReserve(checked);
                                                trackEvent('trip_workspace__budget_toggle--toggle', {
                                                    trip_id: trip.id,
                                                    toggle: 'reserve',
                                                    active: checked,
                                                });
                                            }}
                                            aria-label="Include reserve fund"
                                            {...getAnalyticsDebugAttributes('trip_workspace__budget_toggle--toggle', {
                                                trip_id: trip.id,
                                                toggle: 'reserve',
                                                active: includeReserve,
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Protect coast buffer</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">Leave one money cushion alive for sea-leg changes instead of pretending Krabi always behaves.</p>
                                        </div>
                                        <Switch
                                            checked={protectBoatBuffer}
                                            onCheckedChange={(checked) => {
                                                setProtectBoatBuffer(checked);
                                                trackEvent('trip_workspace__budget_toggle--toggle', {
                                                    trip_id: trip.id,
                                                    toggle: 'coast_buffer',
                                                    active: checked,
                                                });
                                            }}
                                            aria-label="Protect coast buffer"
                                            {...getAnalyticsDebugAttributes('trip_workspace__budget_toggle--toggle', {
                                                trip_id: trip.id,
                                                toggle: 'coast_buffer',
                                                active: protectBoatBuffer,
                                            })}
                                        />
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
                            <CardDescription>City envelopes</CardDescription>
                            <CardTitle>See which stop is actually carrying the cost pressure</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {cityRollup.map((city) => (
                                <div key={city.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{city.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{city.stance}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-foreground">{formatEuro(city.total)}</p>
                                            <p className="text-xs text-muted-foreground">{city.itemCount} tracked items</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Watchlist</CardDescription>
                            <CardTitle>The money decisions that still change the route shape</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {watchItems.map((item) => (
                                <div key={item.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
                                            <TrendUp size={20} weight="duotone" />
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Why this page belongs in the workspace</CardDescription>
                            <CardTitle>Budget is really a trip-shape tool</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <p>
                                The expensive part of a trip is rarely one luxury hotel. It is usually the combination of transfer friction, weak booking timing,
                                and a few decisions you delay until the route is already moving.
                            </p>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <PiggyBank size={18} weight="duotone" className="text-emerald-700" />
                                    <p className="text-sm font-medium text-foreground">Keep the money signal visible enough to change behavior.</p>
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={18} weight="duotone" className="text-accent-700" />
                                    <p className="text-sm font-medium text-foreground">Use buffers to buy resilience, not just spare cash.</p>
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Receipt size={18} weight="duotone" className="text-amber-700" />
                                    <p className="text-sm font-medium text-foreground">If the trip gets rougher, the budget should tell you where to simplify first.</p>
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <GlobeHemisphereWest size={18} weight="duotone" className="text-sky-700" />
                                    <p className="text-sm font-medium text-foreground">Thailand demo note: the coast leg is intentionally the biggest swing factor.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
