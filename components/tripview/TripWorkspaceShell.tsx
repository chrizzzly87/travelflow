import React from 'react';
import {
    AirplaneInFlight,
    AirplaneTakeoff,
    Buildings,
    CalendarBlank,
    CalendarCheck,
    Compass,
    Copy,
    DownloadSimple,
    GearSix,
    GlobeHemisphereWest,
    House,
    ImagesSquare,
    NotePencil,
    ShareNetwork,
    SidebarSimple,
    SpeakerHigh,
    Sparkle,
    SuitcaseRolling,
    Translate,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import type { ITrip, ITimelineItem, TripWorkspacePage } from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarSeparator,
    useSidebar,
} from '../ui/sidebar';
import { Badge } from '../ui/badge';
import { Button, buttonVariants } from '../ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { TripWorkspaceOverviewCalendar } from './TripWorkspaceOverviewCalendar';
import { TripWorkspaceOverviewMap } from './TripWorkspaceOverviewMap';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TravelerWarningSummary {
    cityName: string;
    notes: string[];
}

interface TripWorkspaceShellProps {
    trip: ITrip;
    tripMeta: TripMetaSummary;
    activePage: TripWorkspacePage;
    onPageChange: (page: TripWorkspacePage) => void;
    plannerPage: React.ReactNode;
    selectedItem: ITimelineItem | null;
    selectedCities: ITimelineItem[];
    travelerWarnings: TravelerWarningSummary[];
    isMobile: boolean;
    onOpenTripInfoModal: () => void;
    onOpenShare: () => void;
    onOpenSettings: () => void;
}

type ThailandCityGuide = {
    id: string;
    title: string;
    role: string;
    idealStay: string;
    arrival: string;
    transit: string;
    neighborhoods: string[];
    highlights: string[];
    notes: string[];
};

type PhraseCategory = 'basics' | 'transport' | 'food' | 'emergency';

interface PhraseCardData {
    id: string;
    phrase: string;
    local: string;
    pronunciation: string;
}

const THAILAND_COUNTRY_FACTS = [
    { label: 'Visa basics', value: 'Demo: short-stay entry snapshot with official links still to be connected.' },
    { label: 'Sockets & voltage', value: 'Type A, B, C and O • 220V • bring a universal adapter.' },
    { label: 'Driving side', value: 'Left-hand traffic. Scooter confidence varies a lot by island.' },
    { label: 'Connectivity', value: 'Good eSIM coverage in cities. Beach islands can still dip at night.' },
    { label: 'Cash & cards', value: 'Cards are common in Bangkok, but local markets and boat piers still prefer cash.' },
    { label: 'Cultural context', value: 'Respect temples, shoulders and knees covered, and keep footwear easy to remove.' },
];

const THAILAND_SAFETY_SCORES = [
    { label: 'LGBTQIA+ comfort', score: 'Generally welcoming in tourist zones', tone: 'secondary' as const },
    { label: 'Solo women at night', score: 'Mixed by neighborhood and transport hour', tone: 'outline' as const },
    { label: 'Petty crime', score: 'Low to medium in crowded hubs', tone: 'outline' as const },
    { label: 'Transport safety', score: 'Watch ferries, scooters, and overnight transfers', tone: 'secondary' as const },
];

const THAILAND_CITY_GUIDES: ThailandCityGuide[] = [
    {
        id: 'bangkok',
        title: 'Bangkok',
        role: 'Arrival base for food, markets, and a soft landing.',
        idealStay: '3 nights',
        arrival: 'Use Airport Rail Link or a pre-booked Grab to avoid tired-airport taxi friction.',
        transit: 'BTS + MRT cover the core. Boat hops are scenic but slower during peak heat.',
        neighborhoods: ['Ari for cafes and slower mornings', 'Sathorn for smart stays', 'Talat Noi for galleries and riverside walks'],
        highlights: ['Night market food crawl', 'Temple cluster at opening time', 'Rooftop sunset with dress-code check'],
        notes: ['Demo map layer: food corridors, calm neighborhoods, and airport transfer anchors.', 'Best first-night zone: Sathorn or Ari for easier recovery.'],
    },
    {
        id: 'chiang-mai',
        title: 'Chiang Mai',
        role: 'Cooler north stop for temples, cafes, and day trips.',
        idealStay: '4 nights',
        arrival: 'Airport transfers are quick. The old city is easiest for first-time orientation.',
        transit: 'Walk the old city, then use Grab or hotel drivers for hillside and craft spots.',
        neighborhoods: ['Old City for first timers', 'Nimman for cafes and design shops', 'Riverside for slower evenings'],
        highlights: ['Cooking class with market visit', 'Early temple loop', 'Doi Suthep or craft-village half day'],
        notes: ['Demo map layer: cafe streets, temple core, and easy evening zones.', 'Burning season and rain periods need live overlays later.'],
    },
    {
        id: 'krabi',
        title: 'Krabi / Railay',
        role: 'Island and limestone phase for the visual wow moment.',
        idealStay: '5 nights',
        arrival: 'Boat timing matters more than distance. Build in transfer slack after afternoon flights.',
        transit: 'Longtail boats define your schedule. Expect weather and tide to change the rhythm.',
        neighborhoods: ['Ao Nang for convenience', 'Railay for iconic scenery', 'Koh Lanta for slower reset days'],
        highlights: ['Sunrise boat to the islands', 'Cliff and beach day split', 'Massage + seafood night on the coast'],
        notes: ['Demo map layer: scenic anchors, quieter beaches, and wet-weather fallback zones.', 'Best quarter for easy planning: Ao Nang. Best quarter for atmosphere: Railay.'],
    },
];

const THAILAND_ACTIVITIES = [
    {
        title: 'Bangkok canals and Talat Noi photo walk',
        description: 'Half-day mix of river movement, street texture, and a strong first look at Bangkok.',
        query: 'Bangkok Talat Noi canal photo walk',
    },
    {
        title: 'Chiang Mai cooking class with market stop',
        description: 'Reliable crowd-pleaser and a good rainy-day anchor for the north leg.',
        query: 'Chiang Mai cooking class market tour',
    },
    {
        title: 'Railay longtail island loop',
        description: 'Big visual payoff. Best kept flexible because sea conditions change quickly.',
        query: 'Railay longtail island hopping tour',
    },
];

const THAILAND_STAYS = [
    { area: 'Bangkok • Sathorn', reason: 'Best for arrival ease, polished stays, and simple transit.' },
    { area: 'Chiang Mai • Nimman', reason: 'Good for cafe culture and short taxi hops.' },
    { area: 'Krabi • Ao Nang', reason: 'Better logistics than Railay when the weather turns.' },
];

const THAILAND_EVENTS = [
    { title: 'Songkran planning window', detail: 'Crowds, water fights, and transport pressure spike fast around mid-April.' },
    { title: 'Sunday walking street', detail: 'Chiang Mai’s easiest evening market anchor for a low-planning night.' },
    { title: 'Beach weather buffer', detail: 'Keep one flexible coastal day for boat cancellations or stormy water.' },
];

const THAILAND_BOOKINGS = [
    { title: 'Bangkok arrival stay', status: 'Confirmed', meta: '3 nights • Sathorn • demo booking record' },
    { title: 'Bangkok → Chiang Mai flight', status: 'Needs review', meta: 'Carry-on only fare • demo reminder to confirm bags' },
    { title: 'Krabi boat transfer', status: 'Missing', meta: 'Demo placeholder for outbound ferry or speedboat timing' },
];

const THAILAND_NOTES = [
    { title: 'Day 1 reset note', body: 'Land, hydrate, keep dinner local, and do not over-pack the first Bangkok evening.' },
    { title: 'Chiang Mai rhythm', body: 'Stack temples in the morning, cafe work block in the afternoon, market after sunset.' },
    { title: 'Island fallback', body: 'If sea conditions are rough, swap the boat day with massage, cafe, or inland viewpoint time.' },
];

const THAILAND_PHOTOS = [
    { title: 'Bangkok rooftop rain haze', caption: 'Demo photo target for evening skyline mood.' },
    { title: 'Lantern-lit Chiang Mai alley', caption: 'Demo album card for slower, warm night texture.' },
    { title: 'Railay limestone at sunrise', caption: 'Demo album anchor for the trip’s signature visual moment.' },
];

const THAILAND_PHRASES: Record<PhraseCategory, PhraseCardData[]> = {
    basics: [
        { id: 'hello', phrase: 'Hello', local: 'Sawasdee krap / ka', pronunciation: 'sa-wat-dee krap / ka' },
        { id: 'thank-you', phrase: 'Thank you', local: 'Khop khun krap / ka', pronunciation: 'kop-kun krap / ka' },
    ],
    transport: [
        { id: 'station', phrase: 'Where is the station?', local: 'Sathanee yoo tee nai?', pronunciation: 'sa-tha-nee yoo tee nai' },
        { id: 'reservation', phrase: 'I have a reservation', local: 'ฉันมีการจองไว้แล้ว', pronunciation: 'chan mee gan jong wai laeo' },
    ],
    food: [
        { id: 'vegetarian', phrase: 'I am vegetarian', local: 'Chan gin jay', pronunciation: 'chan gin jay' },
        { id: 'spicy', phrase: 'Not too spicy, please', local: 'Mai phet mak na', pronunciation: 'mai pet mak na' },
    ],
    emergency: [
        { id: 'help', phrase: 'Please help me', local: 'Chuay duay', pronunciation: 'chuay duay' },
        { id: 'hospital', phrase: 'Where is the hospital?', local: 'Rong phayaban yoo tee nai?', pronunciation: 'rong pa-ya-ban yoo tee nai' },
    ],
};

const buildExternalSearchUrl = (query: string): string => `https://www.google.com/search?q=${encodeURIComponent(query)}`;

const formatStartDate = (value: string): string => new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
}).format(new Date(value));

const parseTripDate = (value: string): Date => {
    const [year, month, day] = value.split('-').map(Number);
    if ([year, month, day].every((part) => Number.isFinite(part))) {
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }

    parsed.setHours(12, 0, 0, 0);
    return parsed;
};

const addDays = (date: Date, days: number): Date => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    nextDate.setHours(12, 0, 0, 0);
    return nextDate;
};

const formatDateFromOffset = (tripStartDate: string, offset: number): string => new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
}).format(addDays(parseTripDate(tripStartDate), Math.floor(offset)));

const resolveTripDayCount = (items: ITimelineItem[]): number => (
    Math.max(1, items.reduce((maxDay, item) => (
        Math.max(maxDay, Math.ceil(item.startDateOffset + item.duration))
    ), 0))
);

const resolveCountdownLabel = (trip: ITrip): string => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tripStart = parseTripDate(trip.startDate);
    const tripEnd = addDays(tripStart, resolveTripDayCount(trip.items) - 1);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilStart = Math.round((tripStart.getTime() - today.getTime()) / msPerDay);

    if (daysUntilStart > 1) return `${daysUntilStart} days`;
    if (daysUntilStart === 1) return '1 day';
    if (today >= tripStart && today <= tripEnd) return 'In progress';
    if (today > tripEnd) return 'Wrapped';
    return 'Starting today';
};

const resolveSortedCities = (items: ITimelineItem[]): ITimelineItem[] => (
    items
        .filter((item) => item.type === 'city')
        .sort((left, right) => left.startDateOffset - right.startDateOffset)
);

const openExternalUrl = (url: string): void => {
    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
};

const tripWorkspacePrimaryPages: Array<{
    page: TripWorkspacePage;
    icon: React.ComponentType<{ size?: number; weight?: "fill" | "regular" | "thin" | "light" | "bold" | "duotone"; className?: string }>;
}> = [
    { page: 'overview', icon: House },
    { page: 'planner', icon: CalendarBlank },
    { page: 'bookings', icon: SuitcaseRolling },
    { page: 'places', icon: GlobeHemisphereWest },
    { page: 'explore', icon: Compass },
    { page: 'phrases', icon: Translate },
    { page: 'notes', icon: NotePencil },
    { page: 'photos', icon: ImagesSquare },
];

const resolveWorkspacePageLabel = (
    t: ReturnType<typeof useTranslation>['t'],
    page: TripWorkspacePage,
): string => t(`tripView.workspace.pages.${page}.label`);

const WorkspacePageShell: React.FC<{
    page: TripWorkspacePage;
    title: string;
    description: string;
    children: React.ReactNode;
}> = ({ page, title, description, children }) => {
    const { t } = useTranslation('common');

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            <div className="border-b border-border/70 bg-background/90 px-4 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{t('tripView.workspace.demoBadge')}</Badge>
                            <Badge variant="secondary">{t(`tripView.workspace.pages.${page}.eyebrow`)}</Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
                    </div>
                    <p className="max-w-xs text-xs leading-5 text-muted-foreground">{t('tripView.workspace.demoHint')}</p>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                {children}
            </div>
        </div>
    );
};

const WorkspaceStatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    hint: string;
}> = ({ icon, label, value, hint }) => (
    <Card className="gap-0 border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
                <CardDescription>{label}</CardDescription>
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-accent/10 text-accent-700">
                    {icon}
                </span>
            </div>
            <CardTitle className="text-2xl">{value}</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">{hint}</p>
        </CardContent>
    </Card>
);

const TripWorkspaceDesktopSidebar: React.FC<{
    trip: ITrip;
    tripMeta: TripMetaSummary;
    activePage: TripWorkspacePage;
    onPageChange: (page: TripWorkspacePage) => void;
    sidebarSections: Array<{
        label: string;
        pages: Array<{
            page: TripWorkspacePage;
            icon: React.ComponentType<{ size?: number; weight?: "fill" | "regular" | "thin" | "light" | "bold" | "duotone"; className?: string }>;
        }>;
    }>;
    t: ReturnType<typeof useTranslation>['t'];
    onOpenTripInfoModal: () => void;
    onOpenShare: () => void;
    onOpenSettings: () => void;
}> = ({
    trip,
    tripMeta,
    activePage,
    onPageChange,
    sidebarSections,
    t,
    onOpenTripInfoModal,
    onOpenShare,
    onOpenSettings,
}) => {
    const { state, toggleSidebar } = useSidebar();
    const isCollapsed = state === 'collapsed';

    const handleToggleSidebar = React.useCallback(() => {
        const nextState = isCollapsed ? 'expanded' : 'collapsed';
        trackEvent('trip_workspace__sidebar--toggle', {
            trip_id: trip.id,
            state: nextState,
        });
        toggleSidebar();
    }, [isCollapsed, toggleSidebar, trip.id]);

    return (
        <Sidebar
            className="border-r border-border/70 bg-sidebar/95"
            variant="inset"
            collapsible="icon"
            data-testid="trip-workspace-sidebar"
        >
            <SidebarHeader className="gap-4 px-3 py-3">
                <div className="flex items-start justify-between gap-2 group-data-[collapsible=icon]:justify-center">
                    <div className="min-w-0 flex-1 rounded-3xl border border-sidebar-border bg-linear-to-br from-sidebar-accent via-sidebar to-sidebar-accent/40 p-4 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2.5">
                        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
                            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-background/80 text-accent-700 shadow-sm group-data-[collapsible=icon]:size-9">
                                <AirplaneTakeoff size={22} weight="duotone" />
                            </span>
                            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                                <p className="truncate text-sm font-semibold text-sidebar-foreground">{trip.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-sidebar-foreground/70">{tripMeta.summaryLine}</p>
                            </div>
                        </div>
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                className={`${buttonVariants({ variant: 'ghost', size: 'icon' })} size-8 shrink-0 rounded-xl border border-sidebar-border/80 bg-background/80 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-3 group-data-[collapsible=icon]:end-3`}
                                onClick={handleToggleSidebar}
                                {...getAnalyticsDebugAttributes('trip_workspace__sidebar--toggle', {
                                    trip_id: trip.id,
                                    state: isCollapsed ? 'expanded' : 'collapsed',
                                })}
                            >
                                <SidebarSimple size={18} weight="duotone" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </SidebarHeader>
            <SidebarSeparator />
            <SidebarContent className="px-2 py-3">
                {sidebarSections.map((section) => (
                    <SidebarGroup key={section.label}>
                        <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {section.pages.map(({ page, icon: Icon }) => (
                                    <SidebarMenuItem key={page}>
                                        <SidebarMenuButton
                                            type="button"
                                            isActive={activePage === page}
                                            onClick={() => {
                                                trackEvent('trip_workspace__page--open', {
                                                    trip_id: trip.id,
                                                    page,
                                                    surface: 'desktop_sidebar',
                                                });
                                                onPageChange(page);
                                            }}
                                            tooltip={resolveWorkspacePageLabel(t, page)}
                                            {...getAnalyticsDebugAttributes('trip_workspace__page--open', {
                                                trip_id: trip.id,
                                                page,
                                                surface: 'desktop_sidebar',
                                            })}
                                        >
                                            <Icon size={18} weight="duotone" />
                                            <span>{resolveWorkspacePageLabel(t, page)}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter className="px-2 py-3">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            type="button"
                            tooltip={t('tripView.workspace.footer.share')}
                            onClick={() => {
                                trackEvent('trip_workspace__footer_action--open', {
                                    trip_id: trip.id,
                                    action: 'share',
                                });
                                onOpenShare();
                            }}
                            {...getAnalyticsDebugAttributes('trip_workspace__footer_action--open', {
                                trip_id: trip.id,
                                action: 'share',
                            })}
                        >
                            <ShareNetwork size={18} weight="duotone" />
                            <span>{t('tripView.workspace.footer.share')}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            type="button"
                            tooltip={t('tripView.workspace.footer.export')}
                            onClick={() => {
                                trackEvent('trip_workspace__footer_action--open', {
                                    trip_id: trip.id,
                                    action: 'export',
                                });
                                onOpenTripInfoModal();
                            }}
                            {...getAnalyticsDebugAttributes('trip_workspace__footer_action--open', {
                                trip_id: trip.id,
                                action: 'export',
                            })}
                        >
                            <DownloadSimple size={18} weight="duotone" />
                            <span>{t('tripView.workspace.footer.export')}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            type="button"
                            tooltip={t('tripView.workspace.footer.settings')}
                            onClick={() => {
                                trackEvent('trip_workspace__footer_action--open', {
                                    trip_id: trip.id,
                                    action: 'settings',
                                });
                                onOpenSettings();
                            }}
                            {...getAnalyticsDebugAttributes('trip_workspace__footer_action--open', {
                                trip_id: trip.id,
                                action: 'settings',
                            })}
                        >
                            <GearSix size={18} weight="duotone" />
                            <span>{t('tripView.workspace.footer.settings')}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
};

const OverviewPage: React.FC<{
    trip: ITrip;
    tripMeta: TripMetaSummary;
    selectedCities: ITimelineItem[];
}> = ({ trip, tripMeta, selectedCities }) => {
    const cityStops = resolveSortedCities(trip.items);
    const nextCity = selectedCities[0] ?? cityStops[1] ?? cityStops[0] ?? null;
    const nextCityLabel = nextCity ? `${nextCity.title} • ${formatDateFromOffset(trip.startDate, nextCity.startDateOffset)}` : 'Thailand sample';
    const countdownLabel = resolveCountdownLabel(trip);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
                <WorkspaceStatCard
                    icon={<CalendarCheck size={18} weight="duotone" />}
                    label="Countdown"
                    value={countdownLabel}
                    hint="Demo countdown based on the Thailand workspace concept."
                />
                <WorkspaceStatCard
                    icon={<AirplaneInFlight size={18} weight="duotone" />}
                    label="Date range"
                    value={tripMeta.dateRange}
                    hint={`${tripMeta.totalDaysLabel} days planned across ${tripMeta.cityCount} major stops.`}
                />
                <WorkspaceStatCard
                    icon={<Buildings size={18} weight="duotone" />}
                    label="Next city"
                    value={nextCityLabel}
                    hint="Bangkok, Chiang Mai, and Krabi are seeded as the sample trip rhythm."
                />
                <WorkspaceStatCard
                    icon={<SuitcaseRolling size={18} weight="duotone" />}
                    label="Next booking"
                    value="Ao Nang stay"
                    hint="Demo booking queue: hotel is confirmed, boat transfer still missing."
                />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <TripWorkspaceOverviewCalendar trip={trip} cityStops={cityStops} />
                <TripWorkspaceOverviewMap cityStops={cityStops} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardDescription>Trip pulse</CardDescription>
                        <CardTitle>{trip.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-border/80 bg-accent/5 p-4">
                            <p className="text-sm font-medium text-foreground">Quick tasks</p>
                            <ul className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
                                <li>Lock Chiang Mai domestic flight once baggage rules are final.</li>
                                <li>Choose between Railay and Ao Nang for the coast base.</li>
                                <li>Save temple dress-code notes and ferry slack into the plan.</li>
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background p-4">
                            <p className="text-sm font-medium text-foreground">Weather and risk snapshot</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="secondary">Bangkok 31°C / humid</Badge>
                                <Badge variant="outline">Chiang Mai haze watch</Badge>
                                <Badge variant="outline">Krabi boat weather buffer</Badge>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                                Demo overview cards keep the important travel context visible before you dive into editing.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardDescription>Recent notes</CardDescription>
                        <CardTitle>Today’s travel brain dump</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {THAILAND_NOTES.map((note) => (
                            <div key={note.title} className="rounded-2xl border border-border/80 bg-background p-4">
                                <p className="text-sm font-medium text-foreground">{note.title}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{note.body}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const PlacesPage: React.FC<{
    selectedItem: ITimelineItem | null;
    travelerWarnings: TravelerWarningSummary[];
}> = ({ selectedItem, travelerWarnings }) => {
    const [activeTab, setActiveTab] = React.useState<'country' | 'cities'>('country');
    const [activeCity, setActiveCity] = React.useState<string>('bangkok');
    const activeGuide = THAILAND_CITY_GUIDES.find((city) => city.id === activeCity) ?? THAILAND_CITY_GUIDES[0];

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
                            <Card key={fact.label} className="gap-0 border-border/80 bg-card/95 shadow-sm">
                                <CardHeader>
                                    <CardDescription>{fact.label}</CardDescription>
                                    <CardTitle className="text-lg">{fact.value}</CardTitle>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Safety lens</CardDescription>
                            <CardTitle>Human-readable scores, not a black-box number</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                {THAILAND_SAFETY_SCORES.map((score) => (
                                    <Badge key={score.label} variant={score.tone}>
                                        {score.label}: {score.score}
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Traveler-fit context stays visible next to official-link placeholders and practical rules.
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="cities" className="mt-4 flex flex-col gap-4">
                    <Tabs value={activeCity} onValueChange={setActiveCity}>
                        <TabsList className="w-full justify-start overflow-x-auto" variant="default">
                            {THAILAND_CITY_GUIDES.map((city) => (
                                <TabsTrigger key={city.id} value={city.id}>
                                    {city.title}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {THAILAND_CITY_GUIDES.map((city) => (
                            <TabsContent key={city.id} value={city.id} className="mt-4">
                                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                                    <Card className="border-border/80 bg-card/95 shadow-sm">
                                        <CardHeader>
                                            <CardDescription>{city.role}</CardDescription>
                                            <CardTitle>{city.title}</CardTitle>
                                            <CardAction>
                                                <Badge variant="secondary">Ideal stay: {city.idealStay}</Badge>
                                            </CardAction>
                                        </CardHeader>
                                        <CardContent className="grid gap-4 lg:grid-cols-2">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">Arrival basics</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{city.arrival}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">Transit feel</p>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{city.transit}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">Best quarters</p>
                                                <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
                                                    {city.neighborhoods.map((entry) => <li key={entry}>{entry}</li>)}
                                                </ul>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">Highlights</p>
                                                <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
                                                    {city.highlights.map((entry) => <li key={entry}>{entry}</li>)}
                                                </ul>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="flex flex-col gap-4">
                                        <Card className="border-border/80 bg-card/95 shadow-sm">
                                            <CardHeader>
                                                <CardDescription>Custom map placeholder</CardDescription>
                                                <CardTitle>Neighborhood and highlight map</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="rounded-3xl border border-dashed border-border bg-linear-to-br from-accent/10 via-background to-emerald-50 p-5">
                                                    <p className="text-sm font-medium text-foreground">Demo layer</p>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                        This panel will become the live city map with saved stays, best quarters, arrival anchors, and custom route highlights.
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="border-border/80 bg-card/95 shadow-sm">
                                            <CardHeader>
                                                <CardDescription>Field notes</CardDescription>
                                                <CardTitle>{selectedItem?.title || city.title} context</CardTitle>
                                            </CardHeader>
                                            <CardContent className="flex flex-col gap-3">
                                                {city.notes.map((entry) => (
                                                    <p key={entry} className="rounded-2xl border border-border/80 bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
                                                        {entry}
                                                    </p>
                                                ))}
                                                {travelerWarnings.length > 0 && (
                                                    <div className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                                                        <p className="text-sm font-medium text-foreground">Traveler warnings already detected in the trip</p>
                                                        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
                                                            {travelerWarnings.map((warning) => (
                                                                <li key={warning.cityName}>
                                                                    {warning.cityName}: {warning.notes.join(' • ')}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    );
};

const ExplorePage: React.FC<{
    tripId: string;
}> = ({ tripId }) => (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader>
                <CardDescription>Activities and handoff links</CardDescription>
                <CardTitle>Start from good options, then save the winners</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {THAILAND_ACTIVITIES.map((activity) => (
                    <Card key={activity.title} className="gap-0 border-border/80 bg-background shadow-none">
                        <CardHeader>
                            <CardDescription>{activity.description}</CardDescription>
                            <CardTitle className="text-lg">{activity.title}</CardTitle>
                        </CardHeader>
                        <CardFooter className="gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    trackEvent('trip_workspace__demo_link--open', {
                                        trip_id: tripId,
                                        target: activity.title,
                                        page: 'explore',
                                    });
                                    openExternalUrl(buildExternalSearchUrl(activity.query));
                                }}
                                {...getAnalyticsDebugAttributes('trip_workspace__demo_link--open', {
                                    trip_id: tripId,
                                    target: activity.title,
                                    page: 'explore',
                                })}
                            >
                                <Compass data-icon="inline-start" weight="duotone" />
                                Research
                            </Button>
                            <Badge variant="outline">Demo lead</Badge>
                        </CardFooter>
                    </Card>
                ))}
            </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardDescription>Accommodation areas</CardDescription>
                    <CardTitle>Where to stay by city role</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {THAILAND_STAYS.map((stay) => (
                        <div key={stay.area} className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                            <p className="text-sm font-medium text-foreground">{stay.area}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{stay.reason}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardDescription>Upcoming moments</CardDescription>
                    <CardTitle>Events and timing pressure</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {THAILAND_EVENTS.map((event) => (
                        <div key={event.title} className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                            <p className="text-sm font-medium text-foreground">{event.title}</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.detail}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    </div>
);

const PhrasesPage: React.FC<{
    tripId: string;
}> = ({ tripId }) => {
    const [activeCategory, setActiveCategory] = React.useState<PhraseCategory>('basics');
    const [savedPhraseIds, setSavedPhraseIds] = React.useState<string[]>(['hello']);
    const activePhrases = THAILAND_PHRASES[activeCategory];

    const handleCopyPhrase = React.useCallback((phrase: PhraseCardData) => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
        void navigator.clipboard.writeText(`${phrase.phrase} — ${phrase.local}`);
        trackEvent('trip_workspace__phrase--copy', {
            trip_id: tripId,
            phrase_id: phrase.id,
        });
    }, [tripId]);

    const handleSpeakPhrase = React.useCallback((phrase: PhraseCardData) => {
        if (typeof window === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') return;
        const utterance = new window.SpeechSynthesisUtterance(phrase.local);
        window.speechSynthesis?.cancel();
        window.speechSynthesis?.speak(utterance);
        trackEvent('trip_workspace__phrase--speak', {
            trip_id: tripId,
            phrase_id: phrase.id,
        });
    }, [tripId]);

    const handleSavePhrase = React.useCallback((phrase: PhraseCardData) => {
        setSavedPhraseIds((current) => current.includes(phrase.id) ? current : [...current, phrase.id]);
        trackEvent('trip_workspace__phrase--save', {
            trip_id: tripId,
            phrase_id: phrase.id,
        });
    }, [tripId]);

    return (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardDescription>Japanese for Tokyo is replaced here with Thai for this demo trip.</CardDescription>
                    <CardTitle>Thai phrases for a Thailand route</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as PhraseCategory)}>
                        <TabsList className="w-full justify-start overflow-x-auto">
                            <TabsTrigger value="basics">Basics</TabsTrigger>
                            <TabsTrigger value="transport">Transport</TabsTrigger>
                            <TabsTrigger value="food">Food</TabsTrigger>
                            <TabsTrigger value="emergency">Emergency</TabsTrigger>
                        </TabsList>
                        {Object.entries(THAILAND_PHRASES).map(([category, phrases]) => (
                            <TabsContent key={category} value={category} className="mt-4 flex flex-col gap-3">
                                {phrases.map((phrase) => (
                                    <Card key={phrase.id} className="gap-0 border-border/80 bg-background shadow-none">
                                        <CardHeader>
                                            <CardDescription>{phrase.pronunciation}</CardDescription>
                                            <CardTitle className="text-lg">{phrase.phrase}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-base font-medium text-foreground">{phrase.local}</p>
                                        </CardContent>
                                        <CardFooter className="flex flex-wrap gap-2">
                                            <Button type="button" variant="outline" onClick={() => handleSavePhrase(phrase)}>
                                                <Sparkle data-icon="inline-start" weight="duotone" />
                                                {savedPhraseIds.includes(phrase.id) ? 'Saved to flashcards' : 'Save to flashcards'}
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={() => handleCopyPhrase(phrase)}>
                                                <Copy data-icon="inline-start" weight="duotone" />
                                                Copy
                                            </Button>
                                            <Button type="button" variant="ghost" onClick={() => handleSpeakPhrase(phrase)}>
                                                <SpeakerHigh data-icon="inline-start" weight="duotone" />
                                                Speak
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardDescription>Flashcard progress</CardDescription>
                        <CardTitle>Daily language support</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <div className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                            <p className="text-sm font-medium text-foreground">Flashcards due today</p>
                            <p className="mt-1 text-2xl font-semibold text-foreground">12</p>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                            <p className="text-sm font-medium text-foreground">Saved phrases</p>
                            <p className="mt-1 text-2xl font-semibold text-foreground">{savedPhraseIds.length + 33}</p>
                        </div>
                        <div className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                            <p className="text-sm font-medium text-foreground">Offline pack</p>
                            <p className="mt-1 text-base font-medium text-foreground">Downloaded</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader>
                        <CardDescription>Use cases</CardDescription>
                        <CardTitle>What this page should eventually do</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
                        <p>Phrase cards, pronunciation, quick copy, and flashcard saves are live examples here.</p>
                        <p>Translation quality, offline sync, and city-specific phrase packs are still demo-only for now.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const BookingsPage: React.FC = () => (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader>
                <CardDescription>Logistics board</CardDescription>
                <CardTitle>Reservation progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {THAILAND_BOOKINGS.map((booking) => (
                    <div key={booking.title} className="rounded-2xl border border-border/80 bg-background px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{booking.title}</p>
                            <Badge variant={booking.status === 'Confirmed' ? 'secondary' : 'outline'}>{booking.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.meta}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/95 shadow-sm">
            <CardHeader>
                <CardDescription>Missing pieces</CardDescription>
                <CardTitle>What still needs a decision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
                <p>Choose whether the coast leg should optimize for scenery or simpler logistics.</p>
                <p>Confirm baggage rules on the domestic flight before locking the accommodation area.</p>
                <p>Connect these demo cards to real booking records and deadlines in the next phase.</p>
            </CardContent>
        </Card>
    </div>
);

const NotesPage: React.FC = () => (
    <div className="grid gap-4 xl:grid-cols-3">
        {THAILAND_NOTES.map((note) => (
            <Card key={note.title} className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardDescription>Diary stub</CardDescription>
                    <CardTitle>{note.title}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{note.body}</p>
                </CardContent>
            </Card>
        ))}
    </div>
);

const PhotosPage: React.FC = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {THAILAND_PHOTOS.map((photo, index) => (
            <Card key={photo.title} className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardDescription>Album stub {index + 1}</CardDescription>
                    <CardTitle>{photo.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    <div className="aspect-[4/3] rounded-3xl bg-linear-to-br from-accent/15 via-amber-50 to-emerald-50" />
                    <p className="text-sm leading-6 text-muted-foreground">{photo.caption}</p>
                </CardContent>
            </Card>
        ))}
    </div>
);

const PlannerPageShell: React.FC<{ plannerPage: React.ReactNode }> = ({ plannerPage }) => {
    const { t } = useTranslation('common');

    return (
        <div className="flex h-full min-h-0 flex-col bg-transparent">
            <div className="border-b border-border/70 bg-background/90 px-4 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{t('tripView.workspace.pages.planner.eyebrow')}</Badge>
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                            {t('tripView.workspace.pages.planner.title')}
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                            {t('tripView.workspace.pages.planner.description')}
                        </p>
                    </div>
                    <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                        {t('tripView.workspace.pages.planner.hint')}
                    </p>
                </div>
            </div>
            <div className="min-h-0 flex-1">{plannerPage}</div>
        </div>
    );
};

export const TripWorkspaceMobileNav: React.FC<{
    tripId: string;
    activePage: TripWorkspacePage;
    onPageChange: (page: TripWorkspacePage) => void;
}> = ({ tripId, activePage, onPageChange }) => {
    const { t } = useTranslation('common');

    return (
        <nav
            aria-label={t('tripView.workspace.mobileNavLabel')}
            className="border-t border-border/70 bg-background/95 px-3 py-2 backdrop-blur md:hidden"
        >
            <div className="flex gap-2 overflow-x-auto pb-1">
                {tripWorkspacePrimaryPages.map(({ page, icon: Icon }) => {
                    const isActive = activePage === page;
                    return (
                        <button
                            key={page}
                            type="button"
                            onClick={() => {
                                trackEvent('trip_workspace__page--open', {
                                    trip_id: tripId,
                                    page,
                                    surface: 'mobile_toolbar',
                                });
                                onPageChange(page);
                            }}
                            className={`flex min-w-[88px] shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition-colors ${
                                isActive
                                    ? 'bg-accent-600 text-white'
                                    : 'bg-transparent text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                            }`}
                            {...getAnalyticsDebugAttributes('trip_workspace__page--open', {
                                trip_id: tripId,
                                page,
                                surface: 'mobile_toolbar',
                            })}
                        >
                            <Icon size={18} weight="duotone" />
                            <span>{resolveWorkspacePageLabel(t, page)}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export const TripWorkspaceShell: React.FC<TripWorkspaceShellProps> = ({
    trip,
    tripMeta,
    activePage,
    onPageChange,
    plannerPage,
    selectedItem,
    selectedCities,
    travelerWarnings,
    isMobile,
    onOpenTripInfoModal,
    onOpenShare,
    onOpenSettings,
}) => {
    const { t } = useTranslation('common');
    const sidebarSections = [
        {
            label: t('tripView.workspace.groups.trip'),
            pages: tripWorkspacePrimaryPages.slice(0, 3),
        },
        {
            label: t('tripView.workspace.groups.destination'),
            pages: tripWorkspacePrimaryPages.slice(3, 6),
        },
        {
            label: t('tripView.workspace.groups.memories'),
            pages: tripWorkspacePrimaryPages.slice(6),
        },
    ];

    const renderPage = () => {
        switch (activePage) {
            case 'planner':
                return <PlannerPageShell plannerPage={plannerPage} />;
            case 'places':
                return (
                    <WorkspacePageShell
                        page="places"
                        title={t('tripView.workspace.pages.places.title')}
                        description={t('tripView.workspace.pages.places.description')}
                    >
                        <PlacesPage selectedItem={selectedItem} travelerWarnings={travelerWarnings} />
                    </WorkspacePageShell>
                );
            case 'explore':
                return (
                    <WorkspacePageShell
                        page="explore"
                        title={t('tripView.workspace.pages.explore.title')}
                        description={t('tripView.workspace.pages.explore.description')}
                    >
                        <ExplorePage tripId={trip.id} />
                    </WorkspacePageShell>
                );
            case 'phrases':
                return (
                    <WorkspacePageShell
                        page="phrases"
                        title={t('tripView.workspace.pages.phrases.title')}
                        description={t('tripView.workspace.pages.phrases.description')}
                    >
                        <PhrasesPage tripId={trip.id} />
                    </WorkspacePageShell>
                );
            case 'bookings':
                return (
                    <WorkspacePageShell
                        page="bookings"
                        title={t('tripView.workspace.pages.bookings.title')}
                        description={t('tripView.workspace.pages.bookings.description')}
                    >
                        <BookingsPage />
                    </WorkspacePageShell>
                );
            case 'notes':
                return (
                    <WorkspacePageShell
                        page="notes"
                        title={t('tripView.workspace.pages.notes.title')}
                        description={t('tripView.workspace.pages.notes.description')}
                    >
                        <NotesPage />
                    </WorkspacePageShell>
                );
            case 'photos':
                return (
                    <WorkspacePageShell
                        page="photos"
                        title={t('tripView.workspace.pages.photos.title')}
                        description={t('tripView.workspace.pages.photos.description')}
                    >
                        <PhotosPage />
                    </WorkspacePageShell>
                );
            case 'overview':
            default:
                return (
                    <WorkspacePageShell
                        page="overview"
                        title={t('tripView.workspace.pages.overview.title')}
                        description={t('tripView.workspace.pages.overview.description')}
                    >
                        <OverviewPage trip={trip} tripMeta={tripMeta} selectedCities={selectedCities} />
                    </WorkspacePageShell>
                );
        }
    };

    const insetClassName = isMobile
        ? 'min-h-0 overflow-hidden bg-transparent'
        : 'min-h-0 overflow-hidden bg-transparent md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:shadow-none';

    return (
        <SidebarProvider className="min-h-0 flex-1 bg-transparent" defaultOpen>
            {!isMobile && (
                <TripWorkspaceDesktopSidebar
                    trip={trip}
                    tripMeta={tripMeta}
                    activePage={activePage}
                    onPageChange={onPageChange}
                    sidebarSections={sidebarSections}
                    t={t}
                    onOpenTripInfoModal={onOpenTripInfoModal}
                    onOpenShare={onOpenShare}
                    onOpenSettings={onOpenSettings}
                />
            )}
            <SidebarInset className={insetClassName}>
                {renderPage()}
                {isMobile && (
                    <TripWorkspaceMobileNav tripId={trip.id} activePage={activePage} onPageChange={onPageChange} />
                )}
            </SidebarInset>
        </SidebarProvider>
    );
};
