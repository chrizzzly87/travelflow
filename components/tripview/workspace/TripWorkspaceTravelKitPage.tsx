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

import type { ITrip, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    THAILAND_TRAVEL_KIT_CHECKLIST,
    THAILAND_TRAVEL_KIT_EMERGENCY_CARDS,
    THAILAND_TRAVEL_KIT_PACKS,
    THAILAND_TRAVEL_KIT_UTILITIES,
    type TripWorkspaceTravelKitSectionId,
    resolveTripWorkspaceCityStops,
} from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripWorkspaceTravelKitPageProps {
    trip: ITrip;
    onPageChange: (page: TripWorkspacePage) => void;
}

const SECTION_COPY: Record<TripWorkspaceTravelKitSectionId, { label: string; detail: string }> = {
    entry: {
        label: 'Before departure',
        detail: 'Keep the one-time prep clear before the trip starts moving.',
    },
    arrival: {
        label: 'Arrival day',
        detail: 'Reduce first-night friction with the small things that actually matter.',
    },
    islands: {
        label: 'Island leg',
        detail: 'Protect the south Thailand stretch from boat-day chaos and wet-bag energy.',
    },
};

const EUR_OPTIONS = [20, 50, 100, 250] as const;
const EUR_TO_THB_RATE = 39;

export const TripWorkspaceTravelKitPage: React.FC<TripWorkspaceTravelKitPageProps> = ({
    trip,
    onPageChange,
}) => {
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const [activeSection, setActiveSection] = React.useState<TripWorkspaceTravelKitSectionId>('entry');
    const [checkedIds, setCheckedIds] = React.useState<string[]>(['passport-proof', 'esim-download']);
    const [selectedAmount, setSelectedAmount] = React.useState<number>(100);
    const [isPhrasePackReady, setIsPhrasePackReady] = React.useState<boolean>(true);
    const [isBookingPackReady, setIsBookingPackReady] = React.useState<boolean>(true);
    const [activePackId, setActivePackId] = React.useState<string>('island-pack');

    const sectionItems = React.useMemo(
        () => THAILAND_TRAVEL_KIT_CHECKLIST.filter((item) => item.section === activeSection),
        [activeSection],
    );
    const completedCount = checkedIds.length;
    const remainingItem = THAILAND_TRAVEL_KIT_CHECKLIST.find((item) => !checkedIds.includes(item.id)) ?? null;
    const currentCity = cityStops[0]?.title ?? 'Bangkok';
    const convertedAmount = new Intl.NumberFormat('en-US').format(selectedAmount * EUR_TO_THB_RATE);
    const activePack = THAILAND_TRAVEL_KIT_PACKS.find((pack) => pack.id === activePackId) ?? THAILAND_TRAVEL_KIT_PACKS[0];

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
            <Card className="overflow-hidden border-border/80 bg-linear-to-br from-accent/10 via-background to-emerald-50 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Demo support layer</Badge>
                        <Badge variant="outline">Trip support</Badge>
                        <Badge variant="outline">Thailand route</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
                        <div>
                            <CardDescription>Practical trip support</CardDescription>
                            <CardTitle>Keep the useful little things one click from the route</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                This page holds the prep that gets lost inside notes and modals: entry basics,
                                cash rhythm, emergency numbers, quick packing logic, and offline-ready trip support for Thailand.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Ready now</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{completedCount}/{THAILAND_TRAVEL_KIT_CHECKLIST.length}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Current city</p>
                                <p className="mt-2 text-lg font-semibold text-foreground">{currentCity}</p>
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
                            <CardTitle>Turn trip support into a usable pre-flight board</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as TripWorkspaceTravelKitSectionId)}>
                                <TabsList className="w-full justify-start overflow-x-auto">
                                    {Object.entries(SECTION_COPY).map(([id, section]) => (
                                        <TabsTrigger key={id} value={id}>{section.label}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">{SECTION_COPY[activeSection].label}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {SECTION_COPY[activeSection].detail}
                                </p>
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
                                                    {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_checklist--toggle', {
                                                        trip_id: trip.id,
                                                        item_id: item.id,
                                                        active: !isChecked,
                                                    })}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <label htmlFor={`travel-kit-${item.id}`} className="cursor-pointer text-sm font-medium text-foreground">
                                                            {item.label}
                                                        </label>
                                                        <Badge variant={item.scope === 'Trip-specific' ? 'secondary' : 'outline'}>
                                                            {item.scope}
                                                        </Badge>
                                                        {isChecked ? (
                                                            <Badge variant="outline">
                                                                <CheckCircle className="mr-1 size-3.5" weight="duotone" />
                                                                Ready
                                                            </Badge>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                        {item.detail}
                                                    </p>
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
                            <CardTitle>Swap mental load for a few reusable trip modes</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="flex flex-wrap gap-2">
                                {THAILAND_TRAVEL_KIT_PACKS.map((pack) => (
                                    <button
                                        key={pack.id}
                                        type="button"
                                        onClick={() => {
                                            setActivePackId(pack.id);
                                            trackEvent('trip_workspace__travel_kit_pack--select', {
                                                trip_id: trip.id,
                                                pack_id: pack.id,
                                            });
                                        }}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                            activePackId === pack.id
                                                ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                        }`}
                                        {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_pack--select', {
                                            trip_id: trip.id,
                                            pack_id: pack.id,
                                        })}
                                    >
                                        {pack.label}
                                    </button>
                                ))}
                            </div>
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
                            <div className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                <p className="text-sm font-medium text-foreground">Quick EUR → THB pocket check</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {EUR_OPTIONS.map((amount) => (
                                        <button
                                            key={amount}
                                            type="button"
                                            onClick={() => {
                                                setSelectedAmount(amount);
                                                trackEvent('trip_workspace__travel_kit_converter--select', {
                                                    trip_id: trip.id,
                                                    amount_eur: amount,
                                                });
                                            }}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                                selectedAmount === amount
                                                    ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                    : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                            }`}
                                            {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_converter--select', {
                                                trip_id: trip.id,
                                                amount_eur: amount,
                                            })}
                                        >
                                            {amount} EUR
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{convertedAmount} THB</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    Demo conversion to keep first-day cash decisions tangible while live currency feeds are still pending.
                                </p>
                            </div>
                            <div className="grid gap-3">
                                {THAILAND_TRAVEL_KIT_UTILITIES.map((utility) => (
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
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep translations close even when boat piers and transfers get patchy.</p>
                                    </div>
                                    <Switch
                                        checked={isPhrasePackReady}
                                        onCheckedChange={(checked) => {
                                            setIsPhrasePackReady(checked);
                                            trackEvent('trip_workspace__travel_kit_toggle--toggle', {
                                                trip_id: trip.id,
                                                toggle_id: 'phrase_pack',
                                                active: checked,
                                            });
                                        }}
                                        {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_toggle--toggle', {
                                            trip_id: trip.id,
                                            toggle_id: 'phrase_pack',
                                            active: !isPhrasePackReady,
                                        })}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Booking screenshot stash</p>
                                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Use one offline pocket for ferry, hotel, and airport confirmation shots.</p>
                                    </div>
                                    <Switch
                                        checked={isBookingPackReady}
                                        onCheckedChange={(checked) => {
                                            setIsBookingPackReady(checked);
                                            trackEvent('trip_workspace__travel_kit_toggle--toggle', {
                                                trip_id: trip.id,
                                                toggle_id: 'booking_pack',
                                                active: checked,
                                            });
                                        }}
                                        {...getAnalyticsDebugAttributes('trip_workspace__travel_kit_toggle--toggle', {
                                            trip_id: trip.id,
                                            toggle_id: 'booking_pack',
                                            active: !isBookingPackReady,
                                        })}
                                    />
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
                            {THAILAND_TRAVEL_KIT_EMERGENCY_CARDS.map((card) => (
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
                                    These references are intentionally lightweight placeholders until live emergency and embassy data services are wired in.
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
                                Power, cash, and offline prep live better here than inside planner notes.
                            </div>
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <PhoneCall size={18} weight="duotone" className="text-accent-700" />
                                Emergency context belongs near the trip, but not mixed into destination reading.
                            </div>
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <MapTrifold size={18} weight="duotone" className="text-accent-700" />
                                It also creates a clean home for future utilities like documents, insurance, and disruption watchlists.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
