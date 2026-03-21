import React from 'react';
import { DownloadSimple, GearSix, MapTrifold, ShareNetwork, SidebarSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import type {
    ITrip,
    ITimelineItem,
    TripWorkspacePage,
    TripWorkspaceSidebarState,
} from '../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { readTripWorkspaceSidebarState, writeTripWorkspaceSidebarState } from './workspace/tripWorkspaceSidebarState';
import {
    TRIP_WORKSPACE_NAV_GROUPS,
    TRIP_WORKSPACE_PRIMARY_PAGES,
    type TripWorkspaceNavGroup,
} from './workspace/tripWorkspaceNavigation';
import { TripWorkspaceFrame } from './workspace/TripWorkspaceFrame';
import { TripWorkspacePageShell } from './workspace/TripWorkspacePageShell';
import { TripWorkspaceOverviewPage } from './workspace/TripWorkspaceOverviewPage';
import { TripWorkspacePlannerPage } from './workspace/TripWorkspacePlannerPage';
import { TripWorkspacePlacesPage } from './workspace/TripWorkspacePlacesPage';
import { TripWorkspaceExplorePage } from './workspace/TripWorkspaceExplorePage';
import { TripWorkspacePhrasesPage } from './workspace/TripWorkspacePhrasesPage';
import { TripWorkspaceBookingsPage } from './workspace/TripWorkspaceBookingsPage';
import { TripWorkspaceTravelKitPage } from './workspace/TripWorkspaceTravelKitPage';
import { TripWorkspaceDocumentsPage } from './workspace/TripWorkspaceDocumentsPage';
import { TripWorkspaceNotesPage } from './workspace/TripWorkspaceNotesPage';
import { TripWorkspacePhotosPage } from './workspace/TripWorkspacePhotosPage';
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
import { buttonVariants } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

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
    onOpenPlannerItem?: (itemId: string) => void;
}

interface TripWorkspaceRenderedPageProps {
    activePage: TripWorkspacePage;
    plannerPage: React.ReactNode;
    trip: ITrip;
    tripMeta: TripMetaSummary;
    selectedItem: ITimelineItem | null;
    selectedCities: ITimelineItem[];
    travelerWarnings: TravelerWarningSummary[];
    onPageChange: (page: TripWorkspacePage) => void;
    onOpenPlannerItem?: (itemId: string) => void;
}

const resolveWorkspacePageLabel = (
    t: ReturnType<typeof useTranslation>['t'],
    page: TripWorkspacePage,
): string => t(`tripView.workspace.pages.${page}.label`);

const resolveWorkspaceGroupLabel = (
    t: ReturnType<typeof useTranslation>['t'],
    groupId: TripWorkspaceNavGroup['id'],
): string => t(`tripView.workspace.groups.${groupId}`);

const TripWorkspaceDesktopSidebar: React.FC<{
    trip: ITrip;
    tripMeta: TripMetaSummary;
    activePage: TripWorkspacePage;
    onPageChange: (page: TripWorkspacePage) => void;
    t: ReturnType<typeof useTranslation>['t'];
    onOpenTripInfoModal: () => void;
    onOpenShare: () => void;
    onOpenSettings: () => void;
}> = ({
    trip,
    tripMeta,
    activePage,
    onPageChange,
    t,
    onOpenTripInfoModal,
    onOpenShare,
    onOpenSettings,
}) => {
    const { state, toggleSidebar } = useSidebar();
    const isCollapsed = state === 'collapsed';

    const handleToggleSidebar = React.useCallback(() => {
        trackEvent('trip_workspace__sidebar--toggle', {
            trip_id: trip.id,
            state: isCollapsed ? 'expanded' : 'collapsed',
        });
        toggleSidebar();
    }, [isCollapsed, toggleSidebar, trip.id]);

    return (
        <Sidebar
            className="border-r border-border/70 bg-sidebar/95"
            variant="inset"
            collapsible="icon"
            desktopMode="frame"
            data-testid="trip-workspace-sidebar"
        >
            <SidebarHeader className="gap-4 px-3 py-3">
                <div className="rounded-[1.75rem] border border-sidebar-border/80 bg-linear-to-br from-sidebar-accent/65 via-sidebar to-sidebar-accent/30 p-3 shadow-sm group-data-[collapsible=icon]:p-2.5">
                    <div className="flex items-start gap-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
                        <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background/92 text-accent-700 shadow-sm group-data-[collapsible=icon]:size-10">
                            <MapTrifold size={20} weight="duotone" />
                        </div>
                        <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-sidebar-foreground">{trip.title}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-sidebar-foreground/76">
                                <Badge variant="outline" className="border-sidebar-border/90 bg-background/65 text-sidebar-foreground">
                                    {tripMeta.dateRange}
                                </Badge>
                                <Badge variant="outline" className="border-sidebar-border/90 bg-background/65 text-sidebar-foreground">
                                    {tripMeta.totalDaysLabel} days
                                </Badge>
                                <Badge variant="outline" className="border-sidebar-border/90 bg-background/65 text-sidebar-foreground">
                                    {tripMeta.cityCount} cities
                                </Badge>
                            </div>
                        </div>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                                    className={`${buttonVariants({ variant: 'ghost', size: 'icon' })} size-8 shrink-0 rounded-xl border border-sidebar-border/80 bg-background/80 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-9`}
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
                </div>
            </SidebarHeader>
            <SidebarSeparator />
            <SidebarContent className="px-2 py-3">
                {TRIP_WORKSPACE_NAV_GROUPS.map((group) => (
                    <SidebarGroup key={group.id}>
                        <SidebarGroupLabel>{resolveWorkspaceGroupLabel(t, group.id)}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {group.pages.map(({ page, icon: Icon, priority }) => (
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
                                            className={priority === 'secondary' ? 'text-muted-foreground' : undefined}
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

const TripWorkspaceRenderedPage: React.FC<TripWorkspaceRenderedPageProps> = ({
    activePage,
    plannerPage,
    trip,
    tripMeta,
    selectedItem,
    selectedCities,
    travelerWarnings,
    onPageChange,
    onOpenPlannerItem,
}) => {
    const { t } = useTranslation('common');

    switch (activePage) {
        case 'planner':
            return <TripWorkspacePlannerPage plannerPage={plannerPage} />;
        case 'places':
            return (
                <TripWorkspacePageShell
                    page="places"
                    title={t('tripView.workspace.pages.places.title')}
                    description={t('tripView.workspace.pages.places.description')}
                >
                    <TripWorkspacePlacesPage
                        trip={trip}
                        selectedItem={selectedItem}
                        travelerWarnings={travelerWarnings}
                    />
                </TripWorkspacePageShell>
            );
        case 'explore':
            return (
                <TripWorkspacePageShell
                    page="explore"
                    title={t('tripView.workspace.pages.explore.title')}
                    description={t('tripView.workspace.pages.explore.description')}
                >
                    <TripWorkspaceExplorePage trip={trip} />
                </TripWorkspacePageShell>
            );
        case 'phrases':
            return (
                <TripWorkspacePageShell
                    page="phrases"
                    title={t('tripView.workspace.pages.phrases.title')}
                    description={t('tripView.workspace.pages.phrases.description')}
                >
                    <TripWorkspacePhrasesPage trip={trip} />
                </TripWorkspacePageShell>
            );
        case 'bookings':
            return (
                <TripWorkspacePageShell
                    page="bookings"
                    title={t('tripView.workspace.pages.bookings.title')}
                    description={t('tripView.workspace.pages.bookings.description')}
                >
                    <TripWorkspaceBookingsPage trip={trip} />
                </TripWorkspacePageShell>
            );
        case 'travel-kit':
            return (
                <TripWorkspacePageShell
                    page="travel-kit"
                    title={t('tripView.workspace.pages.travel-kit.title')}
                    description={t('tripView.workspace.pages.travel-kit.description')}
                >
                    <TripWorkspaceTravelKitPage trip={trip} onPageChange={onPageChange} />
                </TripWorkspacePageShell>
            );
        case 'documents':
            return (
                <TripWorkspacePageShell
                    page="documents"
                    title={t('tripView.workspace.pages.documents.title')}
                    description={t('tripView.workspace.pages.documents.description')}
                >
                    <TripWorkspaceDocumentsPage trip={trip} onPageChange={onPageChange} />
                </TripWorkspacePageShell>
            );
        case 'notes':
            return (
                <TripWorkspacePageShell
                    page="notes"
                    title={t('tripView.workspace.pages.notes.title')}
                    description={t('tripView.workspace.pages.notes.description')}
                >
                    <TripWorkspaceNotesPage />
                </TripWorkspacePageShell>
            );
        case 'photos':
            return (
                <TripWorkspacePageShell
                    page="photos"
                    title={t('tripView.workspace.pages.photos.title')}
                    description={t('tripView.workspace.pages.photos.description')}
                >
                    <TripWorkspacePhotosPage />
                </TripWorkspacePageShell>
            );
        case 'overview':
        default:
            return (
                <TripWorkspacePageShell
                    page="overview"
                    title={t('tripView.workspace.pages.overview.title')}
                    description={t('tripView.workspace.pages.overview.description')}
                >
                    <TripWorkspaceOverviewPage
                        trip={trip}
                        tripMeta={tripMeta}
                        selectedCities={selectedCities}
                        onPageChange={onPageChange}
                        onOpenPlannerItem={onOpenPlannerItem}
                    />
                </TripWorkspacePageShell>
            );
    }
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
                {TRIP_WORKSPACE_PRIMARY_PAGES.map(({ page, icon: Icon }) => {
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
    onOpenPlannerItem,
}) => {
    const { t } = useTranslation('common');
    const [sidebarState, setSidebarState] = React.useState<TripWorkspaceSidebarState>(() => (
        isMobile ? 'expanded' : readTripWorkspaceSidebarState()
    ));
    const previousIsMobileRef = React.useRef(isMobile);

    React.useEffect(() => {
        if (isMobile) {
            setSidebarState('expanded');
            previousIsMobileRef.current = true;
            return;
        }
        if (previousIsMobileRef.current) {
            setSidebarState(readTripWorkspaceSidebarState());
        }
        previousIsMobileRef.current = false;
    }, [isMobile]);

    React.useEffect(() => {
        if (isMobile) return;
        writeTripWorkspaceSidebarState(sidebarState);
    }, [isMobile, sidebarState]);

    return (
        <TripWorkspaceFrame>
            <SidebarProvider
                className="relative h-full min-h-0 flex-1 overflow-hidden bg-transparent"
                open={sidebarState === 'expanded'}
                onOpenChange={(open) => setSidebarState(open ? 'expanded' : 'collapsed')}
                style={{
                    '--sidebar-width': '17.5rem',
                    '--sidebar-width-icon': '4.25rem',
                } as React.CSSProperties}
            >
                {!isMobile ? (
                    <TripWorkspaceDesktopSidebar
                        trip={trip}
                        tripMeta={tripMeta}
                        activePage={activePage}
                        onPageChange={onPageChange}
                        t={t}
                        onOpenTripInfoModal={onOpenTripInfoModal}
                        onOpenShare={onOpenShare}
                        onOpenSettings={onOpenSettings}
                    />
                ) : null}
                <SidebarInset className="min-h-0 overflow-hidden bg-transparent md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none">
                    <TripWorkspaceRenderedPage
                        activePage={activePage}
                        plannerPage={plannerPage}
                        trip={trip}
                        tripMeta={tripMeta}
                        selectedItem={selectedItem}
                        selectedCities={selectedCities}
                        travelerWarnings={travelerWarnings}
                        onPageChange={onPageChange}
                        onOpenPlannerItem={onOpenPlannerItem}
                    />
                    {isMobile ? (
                        <TripWorkspaceMobileNav tripId={trip.id} activePage={activePage} onPageChange={onPageChange} />
                    ) : null}
                </SidebarInset>
            </SidebarProvider>
        </TripWorkspaceFrame>
    );
};
