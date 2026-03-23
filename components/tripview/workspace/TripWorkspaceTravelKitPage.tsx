import React from 'react';
import {
    Backpack,
    CalendarBlank,
    CheckCircle,
    GlobeHemisphereWest,
    Lightning,
    MapTrifold,
    PhoneCall,
    SuitcaseRolling,
    Translate,
    WarningCircle,
} from '@phosphor-icons/react';

import type {
    ITrip,
    TripWorkspaceContextSelection,
    TripWorkspacePage,
} from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    type TripWorkspaceDemoDataset,
    type TripWorkspaceTravelKitSectionId,
} from './tripWorkspaceDemoData';
import {
    filterTripWorkspaceEntriesBySelection,
    resolveTripWorkspaceContextSnapshot,
} from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceCurrencyConverter } from './TripWorkspaceCurrencyConverter';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceTravelKitPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
    onPageChange: (page: TripWorkspacePage) => void;
}

const SECTION_COPY: Record<TripWorkspaceTravelKitSectionId, { label: string; detail: string }> = {
    entry: {
        label: 'Entry prep',
        detail: 'Passport, entry, and pre-departure basics.',
    },
    arrival: {
        label: 'Arrival day',
        detail: 'Reduce first-night friction with the small things that actually matter.',
    },
    border: {
        label: 'Borders',
        detail: 'Keep overland and cross-country prep operational instead of scattered.',
    },
    regional: {
        label: 'Regional rhythm',
        detail: 'SIMs, cash, and practical tools that carry across the full route.',
    },
    islands: {
        label: 'Water and coast',
        detail: 'Sea-sensitive days, wet transfers, and coastal friction points.',
    },
};

export const TripWorkspaceTravelKitPage: React.FC<TripWorkspaceTravelKitPageProps> = ({
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
    const [activeSection, setActiveSection] = React.useState<TripWorkspaceTravelKitSectionId>('entry');
    const [checkedIds, setCheckedIds] = React.useState<string[]>(['passport-proof', 'visa-check', 'regional-esim']);
    const [isPhrasePackReady, setIsPhrasePackReady] = React.useState<boolean>(true);
    const [isBookingPackReady, setIsBookingPackReady] = React.useState<boolean>(true);
    const [activePackId, setActivePackId] = React.useState<string>(() => pageDataset.travelKitPacks[0]?.id ?? '');

    const sectionItems = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(
            pageDataset.travelKitChecklist.filter((item) => item.section === activeSection),
            pageContextSelection,
            activeSection === 'regional' ? 'country' : 'city',
        ),
        [activeSection, pageContextSelection, pageDataset.travelKitChecklist],
    );
    const countryUtilities = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(pageDataset.travelKitUtilities, pageContextSelection, 'country'),
        [pageContextSelection, pageDataset.travelKitUtilities],
    );
    const emergencyCards = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(pageDataset.travelKitEmergencyCards, pageContextSelection, 'country'),
        [pageContextSelection, pageDataset.travelKitEmergencyCards],
    );
    const packOptions = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(pageDataset.travelKitPacks, pageContextSelection, 'country'),
        [pageContextSelection, pageDataset.travelKitPacks],
    );
    const completedCount = checkedIds.length;
    const remainingItem = pageDataset.travelKitChecklist.find((item) => !checkedIds.includes(item.id)) ?? null;
    const activePack = packOptions.find((pack) => pack.id === activePackId) ?? packOptions[0] ?? null;

    const handleChecklistToggle = React.useCallback((itemId: string) => {
        setCheckedIds((current) => {
            const next = current.includes(itemId)
                ? current.filter((id) => id !== itemId)
                : [...current, itemId];
            trackEvent('trip_workspace__travel_kit_checklist--toggle', {
                trip_id: trip.id,
                item_id: itemId,
                active: next.includes(itemId),
            });
            return next;
        });
    }, [trip.id]);

    const handleQuickAction = React.useCallback((page: TripWorkspacePage) => {
        trackEvent('trip_workspace__travel_kit_link--open', {
            trip_id: trip.id,
            target_page: page,
        });
        onPageChange(page);
    }, [onPageChange, trip.id]);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="travel-kit"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <Card className="overflow-hidden border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Trip support</Badge>
                        <Badge variant="outline">{context.activeCountry?.name ?? 'Route-wide'}</Badge>
                        <Badge variant="outline">Demo utilities</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
                        <div>
                            <CardDescription>Practical trip support</CardDescription>
                            <CardTitle>Keep the useful little things one click from the route</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Travel kit is now country-aware first, then city-aware where that actually changes how you arrive, pay, stay connected, or cross a border.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Ready now</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{completedCount}/{pageDataset.travelKitChecklist.length}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Current country</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{context.activeCountry?.name ?? 'Route'}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Next focus</p>
                                <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                                    {remainingItem?.label ?? 'Travel kit looks covered'}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => handleQuickAction('planner')} {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_link--open', { trip_id: trip.id, target_page: 'planner' })}>
                        <CalendarBlank data-icon="inline-start" weight="duotone" />
                        Open planner
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleQuickAction('bookings')} {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_link--open', { trip_id: trip.id, target_page: 'bookings' })}>
                        <SuitcaseRolling data-icon="inline-start" weight="duotone" />
                        Open bookings gap
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleQuickAction('phrases')} {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_link--open', { trip_id: trip.id, target_page: 'phrases' })}>
                        <Translate data-icon="inline-start" weight="duotone" />
                        Open phrases
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleQuickAction('places')} {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_link--open', { trip_id: trip.id, target_page: 'places' })}>
                        <GlobeHemisphereWest data-icon="inline-start" weight="duotone" />
                        Open places
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <CardDescription>Interactive checklist</CardDescription>
                            <CardTitle>Turn trip support into an actual route-prep board</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as TripWorkspaceTravelKitSectionId)}>
                                <TabsList className="flex w-full flex-wrap justify-start">
                                    {Object.entries(SECTION_COPY).map(([id, section]) => (
                                        <TabsTrigger key={id} value={id}>{section.label}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">{SECTION_COPY[activeSection].label}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{SECTION_COPY[activeSection].detail}</p>
                            </div>
                            <div className="grid gap-3">
                                {sectionItems.map((item) => {
                                    const isChecked = checkedIds.includes(item.id);
                                    return (
                                        <div key={item.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id={`travel-kit-${item.id}`}
                                                    checked={isChecked}
                                                    onCheckedChange={() => handleChecklistToggle(item.id)}
                                                    aria-label={item.label}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <label htmlFor={`travel-kit-${item.id}`} className="cursor-pointer text-sm font-medium text-foreground">
                                                            {item.label}
                                                        </label>
                                                        <Badge variant={item.scope === 'Trip-specific' ? 'secondary' : 'outline'}>{item.scope}</Badge>
                                                        {isChecked ? <Badge variant="outline"><CheckCircle data-icon="inline-start" weight="duotone" />Ready</Badge> : null}
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Pack presets</CardDescription>
                            <CardTitle>Swap mental load for reusable trip modes</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="flex flex-wrap gap-2">
                                {packOptions.map((pack) => (
                                    <button
                                        key={pack.id}
                                        type="button"
                                        onClick={() => setActivePackId(pack.id)}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                            activePackId === pack.id
                                                ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                        }`}
                                    >
                                        {pack.label}
                                    </button>
                                ))}
                            </div>
                            {activePack ? (
                                <div className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <Backpack size={18} weight="duotone" className="text-accent-700" />
                                        <p className="text-sm font-medium text-foreground">{activePack.label}</p>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{activePack.detail}</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {activePack.includes.map((item) => (
                                            <Badge key={item} variant="outline">{item}</Badge>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                            <CardDescription>Utilities and converter</CardDescription>
                            <CardTitle>Keep arrival-day friction small</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <TripWorkspaceCurrencyConverter
                                countryCode={context.activeCountry?.code ?? null}
                                currencyCode={context.activeCountry?.currencyCode ?? 'THB'}
                                currencyName={context.activeCountry?.currencyName ?? 'Thai baht'}
                                title="Quick arrival cash check"
                                description="Use a real input to estimate what the first-day cash pocket should look like in the current country."
                            />
                            <div className="grid gap-3">
                                {countryUtilities.map((utility) => (
                                    <div key={utility.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-foreground">{utility.label}</p>
                                            <Badge variant="outline">{utility.badge}</Badge>
                                        </div>
                                        <p className="mt-2 text-base font-semibold text-foreground">{utility.value}</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{utility.detail}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="grid gap-3 rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Offline phrase pack</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep translations close when piers, buses, or border posts get patchy.</p>
                                    </div>
                                    <Switch checked={isPhrasePackReady} onCheckedChange={setIsPhrasePackReady} />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Booking screenshot stash</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Use one offline pocket for border proofs, stays, ferries, and transfers.</p>
                                    </div>
                                    <Switch checked={isBookingPackReady} onCheckedChange={setIsBookingPackReady} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Emergency quick sheet</CardDescription>
                            <CardTitle>Put the important references where panic is less likely</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {emergencyCards.map((card) => (
                                <div key={card.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={card.tone}>{card.title}</Badge>
                                        <Badge variant="outline">{card.contact}</Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.detail}</p>
                                </div>
                            ))}
                            <div className="rounded-[1.5rem] border border-dashed border-border bg-background/70 px-4 py-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <WarningCircle size={16} weight="duotone" className="text-accent-700" />
                                    Demo support note
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    These support utilities are still demo content, but they now follow the current country so the workspace feels operational across multiple borders.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Why this page earns a sidebar spot</CardDescription>
                            <CardTitle>Trip support should feel operational, not buried</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <Lightning size={18} weight="duotone" className="text-accent-700" />
                                Power, cash, connectivity, and border prep live better here than inside planner notes.
                            </div>
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <PhoneCall size={18} weight="duotone" className="text-accent-700" />
                                Emergency context belongs near the trip, but not mixed into destination reading.
                            </div>
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <MapTrifold size={18} weight="duotone" className="text-accent-700" />
                                The same structure now scales from Thailand to a multi-country SEA route without becoming overwhelming.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
