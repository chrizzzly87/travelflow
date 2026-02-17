import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Article, CopySimple, RocketLaunch, Sparkle, WarningCircle } from '@phosphor-icons/react';
import { AppLanguage, ITrip, ITimelineItem, MapColorMode, MapStyle, RouteMode, RouteStatus, IViewSettings, ShareMode } from '../types';
import { Timeline } from './Timeline';
import { VerticalTimeline } from './VerticalTimeline';
import { DetailsPanel } from './DetailsPanel';
import { SelectedCitiesPanel } from './SelectedCitiesPanel';
import { ItineraryMap } from './ItineraryMap';
import { CountryInfo } from './CountryInfo';
import { PrintLayout } from './PrintLayout';
import { GoogleMapsLoader } from './GoogleMapsLoader';
import { AddActivityModal } from './AddActivityModal';
import { AddCityModal } from './AddCityModal';
import { Drawer, DrawerContent } from './ui/drawer';
import {
    Pencil, Share2, Route, Printer, Calendar, List,
    ZoomIn, ZoomOut, Plane, Plus, History, Star, Trash2, Info, ChevronDown, ChevronRight, Loader2
} from 'lucide-react';
import { BASE_PIXELS_PER_DAY, DEFAULT_CITY_COLOR_PALETTE_ID, DEFAULT_DISTANCE_UNIT, applyCityPaletteToItems, applyViewSettingsToSearchParams, buildRouteCacheKey, buildShareUrl, formatDistance, getActivityColorByTypes, getTimelineBounds, getTravelLegMetricsForItem, getTripDistanceKm, isInternalMapColorModeControlEnabled, normalizeActivityTypes, normalizeCityColors, normalizeMapColorMode, reorderSelectedCities } from '../utils';
import { normalizeTransportMode } from '../shared/transportModes';
import { getExampleMapViewTransitionName, getExampleTitleViewTransitionName } from '../shared/viewTransitionNames';
import { HistoryEntry, findHistoryEntryByUrl, getHistoryEntries } from '../services/historyService';
import { DB_ENABLED, dbCreateShareLink, dbGetTrip, dbListTripShares, dbRevokeTripShares, dbSetTripSharingEnabled, dbUpsertTrip, ensureDbSession } from '../services/dbService';
import { getLatestInAppRelease, getWebsiteVisibleItems, groupReleaseItemsByType } from '../services/releaseNotesService';
import { ReleasePill } from './marketing/ReleasePill';
import {
    buildPaywalledTripDisplay,
    getDebugTripExpiredOverride,
    getTripLifecycleState,
    setDebugTripExpiredOverride,
    shouldShowTripPaywall,
    TRIP_EXPIRY_DEBUG_EVENT,
} from '../config/paywall';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { APP_NAME } from '../config/appGlobals';
import { useLoginModal } from '../hooks/useLoginModal';
import { buildPathFromLocationParts } from '../services/authNavigationService';
import { useAuth } from '../hooks/useAuth';

type ChangeTone = 'add' | 'remove' | 'update' | 'neutral' | 'info';

interface ToastState {
    tone: ChangeTone;
    title: string;
    message: string;
}

type TripDebugWindow = Window & typeof globalThis & {
    toggleExpired?: (force?: boolean) => boolean;
};

const stripHistoryPrefix = (label: string) => label.replace(/^(Data|Visual):\s*/i, '').trim();

const resolveChangeTone = (label: string): ChangeTone => {
    const normalized = label.toLowerCase();

    if (/\b(add|added|create|created)\b/.test(normalized)) return 'add';
    if (/\b(remove|removed|delete|deleted)\b/.test(normalized)) return 'remove';
    if (
        /\b(update|updated|change|changed|rename|renamed|reschedule|rescheduled|reorder|reordered|adjust|adjusted|saved)\b/.test(normalized) ||
        normalized.startsWith('visual:')
    ) {
        return 'update';
    }

    return 'info';
};

const getToneMeta = (tone: ChangeTone) => {
    switch (tone) {
        case 'add':
            return {
                label: 'Added',
                iconClass: 'bg-emerald-100 text-emerald-700',
                badgeClass: 'bg-emerald-100 text-emerald-700',
                toastBorderClass: 'border-emerald-200',
                toastTitleClass: 'text-emerald-700',
                Icon: Plus,
            };
        case 'remove':
            return {
                label: 'Removed',
                iconClass: 'bg-red-100 text-red-700',
                badgeClass: 'bg-red-100 text-red-700',
                toastBorderClass: 'border-red-200',
                toastTitleClass: 'text-red-700',
                Icon: Trash2,
            };
        case 'update':
            return {
                label: 'Updated',
                iconClass: 'bg-accent-100 text-accent-700',
                badgeClass: 'bg-accent-100 text-accent-700',
                toastBorderClass: 'border-accent-200',
                toastTitleClass: 'text-accent-700',
                Icon: Pencil,
            };
        case 'neutral':
            return {
                label: 'Notice',
                iconClass: 'bg-amber-100 text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-700',
                toastBorderClass: 'border-amber-200',
                toastTitleClass: 'text-amber-700',
                Icon: Info,
            };
        default:
            return {
                label: 'Saved',
                iconClass: 'bg-slate-100 text-slate-700',
                badgeClass: 'bg-slate-100 text-slate-700',
                toastBorderClass: 'border-slate-200',
                toastTitleClass: 'text-slate-700',
                Icon: Info,
            };
    }
};

const MIN_SIDEBAR_WIDTH = 300;
const MIN_TIMELINE_HEIGHT = 200;
const MIN_BOTTOM_MAP_HEIGHT = 200;
const MIN_MAP_WIDTH = 320;
const MIN_TIMELINE_COLUMN_WIDTH = 420;
const MIN_DETAILS_WIDTH = 360;
const HARD_MIN_DETAILS_WIDTH = 260;
const DEFAULT_DETAILS_WIDTH = 440;
const RESIZER_WIDTH = 4;
const MIN_ZOOM_LEVEL = 0.2;
const MAX_ZOOM_LEVEL = 3;
const HORIZONTAL_TIMELINE_AUTO_FIT_PADDING = 72;
const RELEASE_NOTICE_DISMISSED_KEY = 'tf_release_notice_dismissed_release_id';
const NEGATIVE_OFFSET_EPSILON = 0.001;
const SHARE_LINK_STORAGE_PREFIX = 'tf_share_links:';
const MOBILE_VIEWPORT_MAX_WIDTH = 767;
const TRIP_EXPIRED_DEBUG_EVENT = 'tf:trip-expired-debug';
const VIEW_TRANSITION_DEBUG_EVENT = 'tf:view-transition-debug';
const IS_DEV = import.meta.env.DEV;
const GENERATION_PROGRESS_MESSAGES = [
    'Analyzing your travel preferences...',
    'Scouting top-rated cities and stops...',
    'Calculating optimal travel routes...',
    'Structuring your daily timeline...',
    'Finalizing logistics and details...',
];

interface ViewTransitionDebugDetail {
    phase: string;
    templateId?: string;
    useExampleSharedTransition?: boolean;
    expectedCityLaneCount?: number;
    reason?: string;
}

const getShareLinksStorageKey = (tripId: string) => `${SHARE_LINK_STORAGE_PREFIX}${tripId}`;

const isPlainLeftClick = (event: React.MouseEvent<HTMLAnchorElement>): boolean => (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
);

const readStoredShareLinks = (tripId: string): Partial<Record<ShareMode, string>> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getShareLinksStorageKey(tripId));
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const links: Partial<Record<ShareMode, string>> = {};
        if (typeof parsed.view === 'string' && parsed.view.trim().length > 0) links.view = parsed.view;
        if (typeof parsed.edit === 'string' && parsed.edit.trim().length > 0) links.edit = parsed.edit;
        return links;
    } catch {
        return {};
    }
};

const parseTripStartDate = (value: string): Date => {
    if (!value) return new Date();
    const parts = value.split('-').map(Number);
    if (parts.length === 3 && parts.every(part => Number.isFinite(part))) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatTripDateValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeNegativeOffsetsForTrip = (
    items: ITimelineItem[],
    startDate: string
): { items: ITimelineItem[]; startDate: string; shiftedDays: number } => {
    let minStart = Number.POSITIVE_INFINITY;

    items.forEach(item => {
        if (!Number.isFinite(item.startDateOffset)) return;
        minStart = Math.min(minStart, item.startDateOffset);
    });

    if (!Number.isFinite(minStart) || minStart >= -NEGATIVE_OFFSET_EPSILON) {
        return { items, startDate, shiftedDays: 0 };
    }

    const shiftedDays = Math.ceil(-minStart);
    if (shiftedDays <= 0) {
        return { items, startDate, shiftedDays: 0 };
    }

    const shiftedItems = items.map(item => {
        if (!Number.isFinite(item.startDateOffset)) return item;
        return { ...item, startDateOffset: item.startDateOffset + shiftedDays };
    });

    const nextStartDate = parseTripStartDate(startDate);
    nextStartDate.setDate(nextStartDate.getDate() - shiftedDays);

    return {
        items: shiftedItems,
        startDate: formatTripDateValue(nextStartDate),
        shiftedDays,
    };
};

interface TripViewProps {
    trip: ITrip;
    onUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean }) => void;
    onCommitState?: (updatedTrip: ITrip, view: IViewSettings, options?: { replace?: boolean; label?: string }) => void;
    onOpenManager: () => void;
    onOpenSettings: () => void;
    initialViewSettings?: IViewSettings;
    onViewSettingsChange?: (settings: IViewSettings) => void;
    initialMapFocusQuery?: string;
    appLanguage?: AppLanguage;
    readOnly?: boolean;
    canShare?: boolean;
    shareStatus?: ShareMode;
    shareSnapshotMeta?: {
        hasNewer: boolean;
        latestUrl: string;
    };
    onCopyTrip?: () => void;
    isExamplePreview?: boolean;
    suppressToasts?: boolean;
    suppressReleaseNotice?: boolean;
    exampleTripBanner?: {
        title: string;
        countries: string[];
        onCreateSimilarTrip?: () => void;
    };
}

interface ExampleTransitionLocationState {
    useExampleSharedTransition?: boolean;
}

export const TripView: React.FC<TripViewProps> = ({
    trip,
    onUpdateTrip,
    onCommitState,
    onOpenManager,
    onOpenSettings,
    initialViewSettings,
    onViewSettingsChange,
    initialMapFocusQuery,
    appLanguage = 'en',
    readOnly = false,
    canShare = true,
    shareStatus,
    shareSnapshotMeta,
    onCopyTrip,
    isExamplePreview = false,
    suppressToasts = false,
    suppressReleaseNotice = false,
    exampleTripBanner,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { openLoginModal } = useLoginModal();
    const { isAuthenticated, isAnonymous, logout } = useAuth();
    const isTripDetailRoute = location.pathname.startsWith('/trip/');
    const locationState = location.state as ExampleTransitionLocationState | null;
    const useExampleSharedTransition = trip.isExample && (locationState?.useExampleSharedTransition ?? true);
    const mapViewTransitionName = getExampleMapViewTransitionName(useExampleSharedTransition);
    const titleViewTransitionName = getExampleTitleViewTransitionName(useExampleSharedTransition);
    const tripRef = useRef(trip);
    tripRef.current = trip;
    const latestInAppRelease = useMemo(() => getLatestInAppRelease(), []);
    const [dismissedReleaseId, setDismissedReleaseId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            return window.localStorage.getItem(RELEASE_NOTICE_DISMISSED_KEY);
        } catch (e) {
            return null;
        }
    });
    const latestReleaseItems = useMemo(() => {
        if (!latestInAppRelease) return [];
        return getWebsiteVisibleItems(latestInAppRelease).slice(0, 3);
    }, [latestInAppRelease]);
    const latestReleaseGroups = useMemo(() => groupReleaseItemsByType(latestReleaseItems), [latestReleaseItems]);
    const showReleaseNotice = !suppressReleaseNotice && !!latestInAppRelease && dismissedReleaseId !== latestInAppRelease.id;
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [expiredPreviewOverride, setExpiredPreviewOverride] = useState<boolean | null>(() => getDebugTripExpiredOverride(trip.id));
    const tripExpiresAtMs = useMemo(() => {
        if (!trip.tripExpiresAt) return null;
        const parsed = Date.parse(trip.tripExpiresAt);
        return Number.isFinite(parsed) ? parsed : null;
    }, [trip.tripExpiresAt]);
    const lifecycleState = useMemo(
        () => getTripLifecycleState(trip, { nowMs, expiredOverride: expiredPreviewOverride }),
        [trip, nowMs, expiredPreviewOverride]
    );
    const isTripExpired = lifecycleState === 'expired';
    const isTripLockedByExpiry = useMemo(
        () => shouldShowTripPaywall(trip, { lifecycleState }),
        [trip, lifecycleState]
    );
    const canEdit = !readOnly && !isTripLockedByExpiry;
    const displayTrip = useMemo(
        () => (isTripLockedByExpiry ? buildPaywalledTripDisplay(trip) : trip),
        [isTripLockedByExpiry, trip]
    );
    const expectedCityLaneCount = useMemo(
        () => displayTrip.items.filter((item) => item.type === 'city').length,
        [displayTrip.items]
    );
    const expirationLabel = useMemo(() => {
        if (!tripExpiresAtMs) return null;
        const date = new Date(tripExpiresAtMs);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }, [tripExpiresAtMs]);
    const expirationRelativeLabel = useMemo(() => {
        if (!tripExpiresAtMs) return null;
        const diffMs = tripExpiresAtMs - nowMs;
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        if (diffDays > 1) return `Expires in ${diffDays} days`;
        if (diffDays === 1) return 'Expires tomorrow';
        if (diffDays === 0) return 'Expires today';
        return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
    }, [tripExpiresAtMs, nowMs]);

    const handlePaywallLoginClick = useCallback((
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => {
        trackEvent(analyticsEvent, { trip_id: trip.id });
        if (!isPlainLeftClick(event)) return;

        event.preventDefault();
        openLoginModal({
            source,
            nextPath: buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            }),
            reloadOnSuccess: true,
        });
    }, [location.hash, location.pathname, location.search, openLoginModal, trip.id]);

    const [isHeaderAuthSubmitting, setIsHeaderAuthSubmitting] = useState(false);
    const canUseAuthenticatedSession = isAuthenticated && !isAnonymous;

    const handleHeaderAuthAction = useCallback(async () => {
        if (isHeaderAuthSubmitting) return;

        if (canUseAuthenticatedSession) {
            setIsHeaderAuthSubmitting(true);
            trackEvent('trip_view__auth--logout', { trip_id: trip.id });
            try {
                await logout();
            } finally {
                setIsHeaderAuthSubmitting(false);
            }
            return;
        }

        trackEvent('trip_view__auth--login', { trip_id: trip.id });
        openLoginModal({
            source: 'trip_view_header',
            nextPath: buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            }),
            reloadOnSuccess: true,
        });
    }, [
        canUseAuthenticatedSession,
        isHeaderAuthSubmitting,
        location.hash,
        location.pathname,
        location.search,
        logout,
        openLoginModal,
        trip.id,
    ]);

    useEffect(() => {
        if (typeof window === 'undefined' || !trip.isExample) return;
        window.dispatchEvent(new CustomEvent<ViewTransitionDebugDetail>(VIEW_TRANSITION_DEBUG_EVENT, {
            detail: {
                phase: 'trip-view-mounted',
                templateId: trip.exampleTemplateId,
                useExampleSharedTransition,
                expectedCityLaneCount,
                reason: mapViewTransitionName ? undefined : 'shared-map-anchor-disabled',
            },
        }));
    }, [
        expectedCityLaneCount,
        mapViewTransitionName,
        trip.exampleTemplateId,
        trip.isExample,
        useExampleSharedTransition,
    ]);

    // View State
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
    const cityColorPaletteId = trip.cityColorPaletteId || DEFAULT_CITY_COLOR_PALETTE_ID;
    const mapColorMode = normalizeMapColorMode(trip.mapColorMode);
    const allowMapColorModeControls = useMemo(
        () => canEdit && isInternalMapColorModeControlEnabled(),
        [canEdit, location.search]
    );
    const [viewMode, setViewMode] = useState<'planner' | 'print'>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('mode') === 'print' ? 'print' : 'planner';
        }
        return 'planner';
    });

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isTripInfoOpen, setIsTripInfoOpen] = useState(false);
    const [isTripInfoHistoryExpanded, setIsTripInfoHistoryExpanded] = useState(false);
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
    const [toastState, setToastState] = useState<ToastState | null>(null);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [isMobileMapExpanded, setIsMobileMapExpanded] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH;
    });
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingHistoryLabelRef = useRef<string | null>(null);
    const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingCommitRef = useRef<{ trip: ITrip; view: IViewSettings } | null>(null);
    const suppressCommitRef = useRef(false);
    const skipViewDiffRef = useRef(false);
    const appliedViewKeyRef = useRef<string | null>(null);
    const lastNavActionRef = useRef<'undo' | 'redo' | null>(null);
    const lastNavFromLabelRef = useRef<string | null>(null);
    const prevViewRef = useRef<IViewSettings | null>(null);
    const currentUrlRef = useRef<string>('');
    const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
       if (initialViewSettings?.mapStyle) return initialViewSettings.mapStyle;
       if (typeof window !== 'undefined') return (localStorage.getItem('tf_map_style') as MapStyle) || 'standard';
       return 'standard';
    });
    const [routeMode, setRouteMode] = useState<RouteMode>(() => {
       if (initialViewSettings?.routeMode) return initialViewSettings.routeMode;
       if (typeof window !== 'undefined') return (localStorage.getItem('tf_route_mode') as RouteMode) || 'simple';
       return 'simple';
    });
    const [showCityNames, setShowCityNames] = useState<boolean>(() => {
       if (initialViewSettings?.showCityNames !== undefined) return initialViewSettings.showCityNames;
       if (typeof window !== 'undefined') {
           const stored = localStorage.getItem('tf_city_names');
           if (stored !== null) return stored === 'true';
       }
       return true;
    });
    // Layout State
    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>(() => {
        if (initialViewSettings) return initialViewSettings.layoutMode;
        if (typeof window !== 'undefined') return (localStorage.getItem('tf_layout_mode') as 'vertical' | 'horizontal') || 'horizontal';
        return 'horizontal';
    });

    const [timelineView, setTimelineView] = useState<'horizontal' | 'vertical'>(() => {
        if (initialViewSettings) return initialViewSettings.timelineView;
        if (typeof window !== 'undefined') return (localStorage.getItem('tf_timeline_view') as 'horizontal' | 'vertical') || 'horizontal';
        return 'horizontal';
    });

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (initialViewSettings && initialViewSettings.sidebarWidth) return initialViewSettings.sidebarWidth;
        if (typeof window !== 'undefined') return parseInt(localStorage.getItem('tf_sidebar_width') || '550', 10);
        return 550;
    });

    const [timelineHeight, setTimelineHeight] = useState(() => {
        if (initialViewSettings && initialViewSettings.timelineHeight) return initialViewSettings.timelineHeight;
        if (typeof window !== 'undefined') return parseInt(localStorage.getItem('tf_timeline_height') || '400', 10);
        return 400;
    });
    const verticalLayoutTimelineRef = useRef<HTMLDivElement | null>(null);

    const [detailsWidth, setDetailsWidth] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = parseInt(localStorage.getItem('tf_details_width') || `${DEFAULT_DETAILS_WIDTH}`, 10);
            if (Number.isFinite(stored)) return stored;
        }
        return DEFAULT_DETAILS_WIDTH;
    });
    const isResizingRef = useRef<'sidebar' | 'details' | 'timeline-h' | null>(null);
    const detailsResizeStartXRef = useRef(0);
    const detailsResizeStartWidthRef = useRef(detailsWidth);

    // Zoom
    const [zoomLevel, setZoomLevel] = useState(() => {
        if (typeof initialViewSettings?.zoomLevel === 'number') return initialViewSettings.zoomLevel;
        if (typeof window !== 'undefined') {
            const stored = parseFloat(localStorage.getItem('tf_zoom_level') || '');
            if (Number.isFinite(stored)) return stored;
        }
        return 1.0;
    });
    const clampZoomLevel = useCallback((value: number) => {
        if (!Number.isFinite(value)) return 1;
        return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, value));
    }, []);
    const horizontalTimelineDayCount = useMemo(() => {
        const bounds = getTimelineBounds(trip.items);
        return Math.max(1, bounds.dayCount);
    }, [trip.items]);
    const previousLayoutModeRef = useRef(layoutMode);
    const pixelsPerDay = BASE_PIXELS_PER_DAY * zoomLevel;
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef<number | null>(null);

    const showToast = useCallback((message: string, options?: { tone?: ChangeTone; title?: string }) => {
        if (suppressToasts) return;
        setToastState({
            tone: options?.tone || 'info',
            title: options?.title || 'Saved',
            message,
        });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastState(null), 2200);
    }, [suppressToasts]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let raw: string | null = null;
        try {
            raw = window.sessionStorage.getItem('tf_trip_copy_notice');
        } catch (e) {
            raw = null;
        }
        if (!raw) return;
        try {
            const payload = JSON.parse(raw);
            if (payload?.tripId !== trip.id) return;
            window.sessionStorage.removeItem('tf_trip_copy_notice');
            const sourceTitle = typeof payload.sourceTitle === 'string' && payload.sourceTitle.trim().length > 0
                ? payload.sourceTitle.trim()
                : null;
            const message = sourceTitle ? `Copied "${sourceTitle}"` : 'Trip copied successfully';
            showToast(message, { tone: 'add', title: 'Copied' });
        } catch (e) {
            try {
                window.sessionStorage.removeItem('tf_trip_copy_notice');
            } catch (err) {
                // ignore
            }
        }
    }, [trip.id, showToast]);

    const requireEdit = useCallback(() => {
        if (isTripLockedByExpiry) {
            showToast('Trip expired. Activate with an account to edit again.', { tone: 'neutral', title: 'Expired trip' });
            return false;
        }
        if (canEdit) return true;
        showToast('View-only link. Copy the trip to edit.', { tone: 'neutral', title: 'View only' });
        return false;
    }, [canEdit, isTripLockedByExpiry, showToast]);

    const safeUpdateTrip = useCallback((updatedTrip: ITrip, options?: { persist?: boolean }) => {
        if (!requireEdit()) return;
        onUpdateTrip(updatedTrip, options);
    }, [onUpdateTrip, requireEdit]);

    const showSavedToastForLabel = useCallback((label: string) => {
        const tone = resolveChangeTone(label);
        const { label: actionLabel } = getToneMeta(tone);
        showToast(stripHistoryPrefix(label), { tone, title: `Saved · ${actionLabel}` });
    }, [showToast]);

    const refreshHistory = useCallback(() => {
        if (isExamplePreview) {
            setHistoryEntries([]);
            return;
        }
        setHistoryEntries(getHistoryEntries(trip.id));
    }, [isExamplePreview, trip.id]);

    const baseUrl = useMemo(() => {
        if (location.pathname.startsWith('/trip/')) {
            return `/trip/${encodeURIComponent(trip.id)}`;
        }
        if (location.pathname.startsWith('/s/')) {
            return location.pathname;
        }
        return location.pathname;
    }, [location.pathname, trip.id]);

    const resolvedHistoryEntries = useMemo(() => {
        const base = baseUrl;
        const filtered = historyEntries.filter(entry => entry.url !== base);
        const latestEntry: HistoryEntry = {
            id: 'latest',
            tripId: trip.id,
            url: base,
            label: 'Data: Latest version',
            ts: typeof trip.updatedAt === 'number' ? trip.updatedAt : Date.now(),
        };
        return [latestEntry, ...filtered];
    }, [historyEntries, baseUrl, trip.id, trip.updatedAt]);

    useEffect(() => {
        refreshHistory();
    }, [refreshHistory]);

    const getHistoryIndex = useCallback((url: string) => {
        const idx = resolvedHistoryEntries.findIndex(entry => entry.url === url);
        return idx >= 0 ? idx : null;
    }, [resolvedHistoryEntries]);

    const getHistoryEntryForAction = useCallback((action: 'undo' | 'redo') => {
        if (resolvedHistoryEntries.length === 0) return null;
        const currentIndex = getHistoryIndex(currentUrlRef.current);
        const baseIndex = currentIndex ?? 0;
        const nextIndex = action === 'undo' ? baseIndex + 1 : baseIndex - 1;
        if (nextIndex < 0 || nextIndex >= resolvedHistoryEntries.length) return null;
        return resolvedHistoryEntries[nextIndex];
    }, [resolvedHistoryEntries, getHistoryIndex]);

    const navigateHistory = useCallback((action: 'undo' | 'redo') => {
        const target = getHistoryEntryForAction(action);
        if (!target) {
            showToast(action === 'undo' ? 'No earlier history' : 'No later history', {
                tone: 'neutral',
                title: action === 'undo' ? 'Undo' : 'Redo',
            });
            return;
        }
        suppressCommitRef.current = true;
        lastNavActionRef.current = action;
        lastNavFromLabelRef.current = null;
        navigate(target.url, { replace: true });
        showToast(stripHistoryPrefix(target.label), { tone: 'neutral', title: action === 'undo' ? 'Undo' : 'Redo' });
    }, [getHistoryEntryForAction, navigate, showToast]);

    const setPendingLabel = useCallback((label: string) => {
        pendingHistoryLabelRef.current = label;
    }, []);

    const markUserEdit = useCallback(() => {
        suppressCommitRef.current = false;
        lastNavActionRef.current = null;
        lastNavFromLabelRef.current = null;
    }, []);

    const debugHistory = useCallback((message: string, data?: any) => {
        if (!IS_DEV) return;
        if (typeof window === 'undefined') return;
        const enabled = (window as any).__TF_DEBUG_HISTORY;
        if (!enabled) return;
        if (data !== undefined) {
            console.log(`[History] ${message}`, data);
        } else {
            console.log(`[History] ${message}`);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if ((window as any).__TF_DEBUG_HISTORY === undefined) {
            (window as any).__TF_DEBUG_HISTORY = IS_DEV;
        }
        (window as any).tfSetHistoryDebug = (enabled: boolean) => {
            (window as any).__TF_DEBUG_HISTORY = enabled;
            if (IS_DEV) {
                console.log(`[History] debug ${enabled ? 'enabled' : 'disabled'}`);
            }
        };
        (window as any).__tfOnCommit = (window as any).__tfOnCommit || null;
    }, []);

    // Header State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState('');

    // Modals State
    const [addActivityState, setAddActivityState] = useState<{ isOpen: boolean, dayOffset: number, location: string }>({ isOpen: false, dayOffset: 0, location: '' });
    const [isAddCityModalOpen, setIsAddCityModalOpen] = useState(false);

    const [isShareOpen, setIsShareOpen] = useState(false);
    const [shareMode, setShareMode] = useState<ShareMode>('view');
    const [shareUrlsByMode, setShareUrlsByMode] = useState<Partial<Record<ShareMode, string>>>(() => readStoredShareLinks(trip.id));
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);
    const lastSyncedSharingLockRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.removeItem('tf_country_info_expanded');
        } catch {
            // ignore storage issues
        }
    }, []);

    // Persistence
    useEffect(() => { localStorage.setItem('tf_map_style', mapStyle); }, [mapStyle]);
    useEffect(() => { localStorage.setItem('tf_route_mode', routeMode); }, [routeMode]);
    useEffect(() => { localStorage.setItem('tf_layout_mode', layoutMode); }, [layoutMode]);
    useEffect(() => { localStorage.setItem('tf_timeline_view', timelineView); }, [timelineView]);
    useEffect(() => { localStorage.setItem('tf_city_names', String(showCityNames)); }, [showCityNames]);
    useEffect(() => { localStorage.setItem('tf_zoom_level', zoomLevel.toFixed(2)); }, [zoomLevel]);

    // Update URL with View State
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const settings: IViewSettings = {
                layoutMode,
                timelineView,
                mapStyle,
                routeMode,
                showCityNames,
                zoomLevel,
                sidebarWidth,
                timelineHeight
            };
            
            // Call parent handler if provided
            if (onViewSettingsChange) {
                onViewSettingsChange(settings);
            }

            // Also update local URL for immediate feedback (can be redundant if parent updates, but good for standalone)
            // Actually, if parent updates URL, we might double update?
            // If parent updates URL via navigate(), it might re-render us.
            // Let's rely on parent if provided, otherwise fallback to local history replace.
            if (!onViewSettingsChange) {
                const url = new URL(window.location.href);
                applyViewSettingsToSearchParams(url.searchParams, settings);
                if (viewMode === 'print') url.searchParams.set('mode', 'print');
                else url.searchParams.delete('mode');
                window.history.replaceState({}, '', url.toString());
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [layoutMode, zoomLevel, viewMode, mapStyle, routeMode, timelineView, sidebarWidth, timelineHeight, showCityNames, onViewSettingsChange]);

    const currentViewSettings: IViewSettings = useMemo(() => ({
        layoutMode,
        timelineView,
        mapStyle,
        routeMode,
        showCityNames,
        zoomLevel,
        sidebarWidth,
        timelineHeight
    }), [layoutMode, timelineView, mapStyle, routeMode, showCityNames, zoomLevel, sidebarWidth, timelineHeight]);

    useEffect(() => {
        if (!initialViewSettings) return;
        const key = JSON.stringify(initialViewSettings);
        const currentKey = JSON.stringify(currentViewSettings);
        if (key === currentKey) {
            appliedViewKeyRef.current = key;
            return;
        }
        if (appliedViewKeyRef.current === key) return;

        appliedViewKeyRef.current = key;
        suppressCommitRef.current = true;
        skipViewDiffRef.current = true;

        if (initialViewSettings.mapStyle) setMapStyle(initialViewSettings.mapStyle);
        if (initialViewSettings.routeMode) setRouteMode(initialViewSettings.routeMode);
        if (initialViewSettings.layoutMode) setLayoutMode(initialViewSettings.layoutMode);
        if (initialViewSettings.timelineView) setTimelineView(initialViewSettings.timelineView);
        if (typeof initialViewSettings.zoomLevel === 'number') setZoomLevel(initialViewSettings.zoomLevel);
        if (typeof initialViewSettings.sidebarWidth === 'number') setSidebarWidth(initialViewSettings.sidebarWidth);
        if (typeof initialViewSettings.timelineHeight === 'number') setTimelineHeight(initialViewSettings.timelineHeight);
        const desiredShowCityNames = initialViewSettings.showCityNames ?? true;
        setShowCityNames(desiredShowCityNames);

        prevViewRef.current = initialViewSettings;
    }, [initialViewSettings, currentViewSettings]);

    useEffect(() => {
        setShareUrlsByMode(readStoredShareLinks(trip.id));
    }, [trip.id]);

    useEffect(() => {
        setIsMobileMapExpanded(false);
        setIsTripInfoOpen(false);
        setIsTripInfoHistoryExpanded(false);
    }, [trip.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(getShareLinksStorageKey(trip.id), JSON.stringify(shareUrlsByMode));
        } catch (e) {
            // ignore storage issues
        }
    }, [trip.id, shareUrlsByMode]);

    useEffect(() => {
        lastSyncedSharingLockRef.current = null;
    }, [trip.id]);

    useEffect(() => {
        if (!canShare) return;
        if (!DB_ENABLED) {
            if (isTripLockedByExpiry) {
                setIsShareOpen(false);
                setShareUrlsByMode({});
                if (typeof window !== 'undefined') {
                    try {
                        window.localStorage.removeItem(getShareLinksStorageKey(trip.id));
                    } catch {
                        // ignore storage issues
                    }
                }
            }
            return;
        }

        if (lastSyncedSharingLockRef.current === isTripLockedByExpiry) return;
        lastSyncedSharingLockRef.current = isTripLockedByExpiry;

        let canceled = false;
        void (async () => {
            await ensureDbSession();
            if (canceled) return;

            await dbSetTripSharingEnabled(trip.id, !isTripLockedByExpiry);
            if (canceled) return;

            if (isTripLockedByExpiry) {
                setIsShareOpen(false);
                setShareUrlsByMode({});
                if (typeof window !== 'undefined') {
                    try {
                        window.localStorage.removeItem(getShareLinksStorageKey(trip.id));
                    } catch {
                        // ignore storage issues
                    }
                }
                await dbRevokeTripShares(trip.id);
            }
        })();

        return () => {
            canceled = true;
        };
    }, [canShare, isTripLockedByExpiry, trip.id]);

    const currentUrl = location.pathname + location.search;

    useEffect(() => {
        currentUrlRef.current = currentUrl;
    }, [currentUrl]);

    useEffect(() => {
        setExpiredPreviewOverride(getDebugTripExpiredOverride(trip.id));
    }, [trip.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const syncOverride = (event: Event) => {
            const detail = (event as CustomEvent<{ tripId?: string }>).detail;
            if (detail?.tripId && detail.tripId !== trip.id) return;
            setExpiredPreviewOverride(getDebugTripExpiredOverride(trip.id));
        };
        window.addEventListener(TRIP_EXPIRY_DEBUG_EVENT, syncOverride as EventListener);
        return () => window.removeEventListener(TRIP_EXPIRY_DEBUG_EVENT, syncOverride as EventListener);
    }, [trip.id]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const host = window as TripDebugWindow;

        if (!isTripDetailRoute) {
            if (host.toggleExpired) {
                delete host.toggleExpired;
            }
            window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
                detail: { available: false, expired: false },
            }));
            return;
        }

        const toggleExpired = (force?: boolean) => {
            let nextExpired = false;
            setExpiredPreviewOverride((prev) => {
                const baseExpired = typeof prev === 'boolean' ? prev : isTripExpired;
                nextExpired = typeof force === 'boolean' ? force : !baseExpired;
                setDebugTripExpiredOverride(trip.id, nextExpired);
                return nextExpired;
            });
            window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
                detail: { available: true, expired: nextExpired },
            }));
            if (IS_DEV) {
                console.info(
                    `[${APP_NAME}] toggleExpired(${typeof force === 'boolean' ? force : 'toggle'}) -> ${nextExpired ? 'expired preview ON' : 'expired preview OFF'} for trip ${trip.id}`
                );
            }
            return nextExpired;
        };

        host.toggleExpired = toggleExpired;
        window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
            detail: {
                available: true,
                expired: typeof expiredPreviewOverride === 'boolean' ? expiredPreviewOverride : isTripExpired,
            },
        }));

        return () => {
            if (host.toggleExpired === toggleExpired) {
                delete host.toggleExpired;
            }
            window.dispatchEvent(new CustomEvent(TRIP_EXPIRED_DEBUG_EVENT, {
                detail: { available: false, expired: false },
            }));
        };
    }, [trip.id, isTripExpired, isTripDetailRoute, expiredPreviewOverride]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => {
            setIsMobileViewport(window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!tripExpiresAtMs) return;
        const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
        return () => window.clearInterval(interval);
    }, [tripExpiresAtMs]);

    useEffect(() => {
        if (isMobileViewport) return;
        setIsMobileMapExpanded(false);
        setIsTripInfoOpen(false);
        setIsTripInfoHistoryExpanded(false);
    }, [isMobileViewport]);

    useEffect(() => {
        const cityIdSet = new Set(trip.items.filter(item => item.type === 'city').map(item => item.id));

        if (selectedCityIds.some(id => !cityIdSet.has(id))) {
            setSelectedCityIds(prev => prev.filter(id => cityIdSet.has(id)));
        }

        if (selectedItemId && !trip.items.some(item => item.id === selectedItemId)) {
            setSelectedItemId(null);
        }
    }, [trip.items, selectedCityIds, selectedItemId]);

    const tripMeta = useMemo(() => {
        const cityItems = trip.items
            .filter(i => i.type === 'city')
            .sort((a, b) => a.startDateOffset - b.startDateOffset);
        const cityCount = cityItems.length;
        const maxEnd = cityItems.reduce((max, c) => Math.max(max, c.startDateOffset + c.duration), 0);
        const totalDaysRaw = Math.round(maxEnd * 2) / 2;
        const totalDays = Number.isFinite(totalDaysRaw) ? totalDaysRaw : 0;

        const startDate = new Date(trip.startDate);
        const endOffsetDays = Math.max(0, Math.ceil(maxEnd) - 1);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + endOffsetDays);

        const formatDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const dateRange = startDate.toDateString() === endDate.toDateString()
            ? formatDate(startDate)
            : `${formatDate(startDate)} – ${formatDate(endDate)}`;

        const daysLabel = totalDays % 1 === 0 ? totalDays.toFixed(0) : totalDays.toFixed(1);
        const citiesLabel = cityCount === 1 ? '1 city' : `${cityCount} cities`;
        const totalDistanceKm = getTripDistanceKm(trip.items);
        const distanceLabel = totalDistanceKm > 0
            ? formatDistance(totalDistanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 0 })
            : null;
        const distancePart = distanceLabel ? ` • ${distanceLabel}` : '';
        return {
            dateRange,
            totalDays,
            totalDaysLabel: daysLabel,
            cityCount,
            distanceLabel,
            summaryLine: `${dateRange} • ${daysLabel} days • ${citiesLabel}${distancePart}`,
        };
    }, [trip.items, trip.startDate]);
    const tripSummary = tripMeta.summaryLine;
    const isLoadingPreview = useMemo(
        () => displayTrip.items.some((item) => item.loading),
        [displayTrip.items]
    );
    const loadingDestinationSummary = useMemo(() => {
        const locations = displayTrip.items
            .filter((item) => item.type === 'city' && typeof item.location === 'string')
            .map((item) => item.location?.trim() ?? '')
            .filter((location) => location.length > 0);
        const uniqueLocations = Array.from(new Set(locations));
        if (uniqueLocations.length > 0) {
            return uniqueLocations.join(', ');
        }
        return displayTrip.title.replace(/^Planning\s+/i, '').replace(/\.\.\.$/, '').trim() || 'Destination';
    }, [displayTrip.items, displayTrip.title]);
    const [generationProgressMessage, setGenerationProgressMessage] = useState(GENERATION_PROGRESS_MESSAGES[0]);
    const showGenerationOverlay = isTripDetailRoute && isLoadingPreview;

    useEffect(() => {
        if (!showGenerationOverlay) {
            setGenerationProgressMessage(GENERATION_PROGRESS_MESSAGES[0]);
            return;
        }
        let index = 0;
        setGenerationProgressMessage(GENERATION_PROGRESS_MESSAGES[0]);
        const timer = window.setInterval(() => {
            index = (index + 1) % GENERATION_PROGRESS_MESSAGES.length;
            setGenerationProgressMessage(GENERATION_PROGRESS_MESSAGES[index]);
        }, 2200);
        return () => window.clearInterval(timer);
    }, [showGenerationOverlay]);

    const forkMeta = useMemo(() => {
        if (trip.forkedFromShareToken) {
            return {
                label: 'Copied from shared trip',
                url: buildShareUrl(trip.forkedFromShareToken, trip.forkedFromShareVersionId ?? null),
            };
        }
        if (trip.forkedFromTripId) {
            return {
                label: 'Copied from another trip',
                url: null,
            };
        }
        return null;
    }, [trip.forkedFromShareToken, trip.forkedFromShareVersionId, trip.forkedFromTripId]);

    const copyToClipboard = useCallback(async (value: string) => {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }
        const input = document.createElement('input');
        input.value = value;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    }, []);

    const dismissReleaseNotice = useCallback(() => {
        if (!latestInAppRelease) return;
        setDismissedReleaseId(latestInAppRelease.id);
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(RELEASE_NOTICE_DISMISSED_KEY, latestInAppRelease.id);
        } catch (e) {
            // ignore storage issues
        }
    }, [latestInAppRelease]);

    const activeShareUrl = shareUrlsByMode[shareMode] ?? null;

    const handleShare = useCallback(async () => {
        if (!canShare) return;
        if (isTripLockedByExpiry) {
            showToast('Sharing is unavailable while this trip is expired.', { tone: 'neutral', title: 'Share disabled' });
            return;
        }
        if (!DB_ENABLED) {
            const url = window.location.href;
            try {
                await copyToClipboard(url);
                showToast('Link copied to clipboard', { tone: 'info', title: 'Share link' });
            } catch (e) {
                showToast('Could not copy link', { tone: 'remove', title: 'Share link' });
                console.error('Copy failed', e);
            }
            return;
        }
        setIsShareOpen(true);
        void (async () => {
            const shares = await dbListTripShares(trip.id);
            if (shares.length === 0) return;
            const mapped: Partial<Record<ShareMode, string>> = {};
            shares.forEach((share) => {
                if (!share.isActive) return;
                if (mapped[share.mode]) return;
                mapped[share.mode] = new URL(buildShareUrl(share.token), window.location.origin).toString();
            });
            if (Object.keys(mapped).length > 0) {
                setShareUrlsByMode(prev => ({ ...prev, ...mapped }));
            }
        })();
    }, [canShare, copyToClipboard, isTripLockedByExpiry, showToast, trip.id]);

    const handleCopyShareLink = useCallback(async () => {
        if (!activeShareUrl) return;
        try {
            await copyToClipboard(activeShareUrl);
            showToast('Link copied to clipboard', { tone: 'info', title: 'Share link' });
        } catch (e) {
            showToast('Could not copy link', { tone: 'remove', title: 'Share link' });
            console.error('Copy failed', e);
        }
    }, [activeShareUrl, copyToClipboard, showToast]);

    const handleGenerateShare = useCallback(async () => {
        if (!DB_ENABLED) return;
        if (isTripLockedByExpiry) {
            showToast('Sharing is unavailable while this trip is expired.', { tone: 'neutral', title: 'Share disabled' });
            return;
        }
        setIsGeneratingShare(true);
        try {
            const sessionId = await ensureDbSession();
            if (!sessionId) {
                showToast('Anonymous auth is disabled. Enable it in Supabase.', { tone: 'remove', title: 'Share link' });
                return;
            }
            const upserted = await dbUpsertTrip(trip, currentViewSettings);
            const existing = await dbGetTrip(trip.id);
            if (!upserted || !existing?.trip) {
                showToast('Could not save trip before sharing.', { tone: 'remove', title: 'Share link' });
                return;
            }
            const result = await dbCreateShareLink(trip.id, shareMode);
            if (!result?.token) {
                showToast(result?.error || 'Could not create share link', { tone: 'remove', title: 'Share link' });
                return;
            }
            const url = new URL(buildShareUrl(result.token), window.location.origin).toString();
            setShareUrlsByMode(prev => ({ ...prev, [shareMode]: url }));
            await copyToClipboard(url);
            showToast('Link copied to clipboard', { tone: 'info', title: 'Share link' });
        } catch (e) {
            showToast('Could not create share link', { tone: 'remove', title: 'Share link' });
            console.error('Share failed', e);
        } finally {
            setIsGeneratingShare(false);
        }
    }, [copyToClipboard, showToast, trip.id, shareMode, trip, currentViewSettings, isTripLockedByExpiry]);

    const formatHistoryTime = useCallback((ts: number) => {
        const diffMs = Date.now() - ts;
        const absMs = Math.abs(diffMs);
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        const sec = Math.round(absMs / 1000);
        if (sec < 60) return rtf.format(-sec, 'second');
        const min = Math.round(sec / 60);
        if (min < 60) return rtf.format(-min, 'minute');
        const hrs = Math.round(min / 60);
        if (hrs < 24) return rtf.format(-hrs, 'hour');
        const days = Math.round(hrs / 24);
        if (days < 7) return rtf.format(-days, 'day');
        return new Date(ts).toLocaleString();
    }, []);

    const displayHistoryEntries = useMemo(() => {
        if (isExamplePreview) return [];
        if (showAllHistory) return resolvedHistoryEntries;
        const seen = new Set<string>();
        return resolvedHistoryEntries.filter(entry => {
            if (seen.has(entry.label)) return false;
            seen.add(entry.label);
            return true;
        });
    }, [isExamplePreview, resolvedHistoryEntries, showAllHistory]);

    useEffect(() => {
        if (isHistoryOpen) refreshHistory();
    }, [isHistoryOpen, refreshHistory]);

    useEffect(() => {
        if (isExamplePreview) return;
        const handleHistoryUpdate = (event: Event) => {
            const detail = (event as CustomEvent).detail as { tripId?: string };
            if (!detail || detail.tripId !== trip.id) return;
            refreshHistory();
        };
        if (typeof window === 'undefined') return;
        window.addEventListener('tf:history', handleHistoryUpdate);
        return () => window.removeEventListener('tf:history', handleHistoryUpdate);
    }, [isExamplePreview, trip.id, refreshHistory]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (isHistoryOpen) {
                setIsHistoryOpen(false);
                return;
            }
            if (isTripInfoOpen) {
                setIsTripInfoOpen(false);
                return;
            }
            if (isMobileMapExpanded) {
                setIsMobileMapExpanded(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHistoryOpen, isTripInfoOpen, isMobileMapExpanded]);

    useEffect(() => {
        if (isExamplePreview) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isEditable = !!target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                (target as HTMLElement).isContentEditable
            );
            if (isEditable) return;

            const isMeta = e.metaKey || e.ctrlKey;
            if (!isMeta) return;

            if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                navigateHistory('undo');
            } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
                e.preventDefault();
                navigateHistory('redo');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [trip.id, navigateHistory, isExamplePreview]);

    useEffect(() => {
        if (isExamplePreview) return;
        const handlePopState = () => {
            const nextPath = window.location.pathname;
            const nextUrl = nextPath + window.location.search;
            const expectedTripPrefix = `/trip/${encodeURIComponent(trip.id)}`;
            const isTripRoute = nextPath.startsWith('/trip/');
            const isShareRoute = nextPath.startsWith('/s/');
            if ((!isTripRoute && !isShareRoute) || (isTripRoute && !nextPath.startsWith(expectedTripPrefix))) {
                navigate(currentUrlRef.current || '/', { replace: true });
                showToast('Reached start of history', { tone: 'neutral', title: 'Undo' });
                return;
            }
            suppressCommitRef.current = true;
            const entry = findHistoryEntryByUrl(trip.id, nextUrl);
            const prevIdx = getHistoryIndex(currentUrlRef.current);
            const nextIdx = getHistoryIndex(nextUrl);
            const inferredAction = (prevIdx !== null && nextIdx !== null)
                ? (nextIdx > prevIdx ? 'undo' : 'redo')
                : null;
            if (entry) {
                showToast(stripHistoryPrefix(entry.label), {
                    tone: 'neutral',
                    title: inferredAction === 'redo' ? 'Redo' : 'Undo',
                });
            }
            lastNavActionRef.current = null;
            lastNavFromLabelRef.current = null;
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [trip.id, showToast, navigate, getHistoryIndex, isExamplePreview]);

    const scheduleCommit = useCallback((nextTrip?: ITrip, nextView?: IViewSettings) => {
        if (!onCommitState) return;
        if (!canEdit) return;
        if (isExamplePreview) return;
        if (suppressCommitRef.current) {
            suppressCommitRef.current = false;
            debugHistory('Suppressed commit due to popstate');
            return;
        }
        const tripToCommit = nextTrip || trip;
        const viewToCommit = nextView || currentViewSettings;
        pendingCommitRef.current = { trip: tripToCommit, view: viewToCommit };
        debugHistory('Scheduled commit', { label: pendingHistoryLabelRef.current || 'Data: Updated trip' });

        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        const pendingLabel = pendingHistoryLabelRef.current || 'Data: Updated trip';
        const commitDelay = /^Data:\s+(Added|Removed)\b/i.test(pendingLabel) ? 150 : 700;
        commitTimerRef.current = setTimeout(() => {
            const payload = pendingCommitRef.current || { trip: tripToCommit, view: viewToCommit };
            const label = pendingHistoryLabelRef.current || 'Data: Updated trip';
            debugHistory('Committing', { label });
            onCommitState(payload.trip, payload.view, { replace: false, label });
            pendingHistoryLabelRef.current = null;
            refreshHistory();
            showSavedToastForLabel(label);
            if (typeof window !== 'undefined') {
                (window as any).__tfLastCommit = { label, ts: Date.now() };
                const hook = (window as any).__tfOnCommit;
                if (typeof hook === 'function') hook({ label, ts: Date.now() });
            }
        }, commitDelay);
    }, [onCommitState, trip, currentViewSettings, refreshHistory, showSavedToastForLabel, debugHistory, canEdit, isExamplePreview]);

    useEffect(() => {
        const prev = prevViewRef.current;
        if (!prev) {
            prevViewRef.current = currentViewSettings;
            return;
        }
        if (skipViewDiffRef.current) {
            skipViewDiffRef.current = false;
            prevViewRef.current = currentViewSettings;
            return;
        }

        const changes: string[] = [];
        if (prev.mapStyle !== mapStyle) changes.push(`Map view: ${prev.mapStyle} → ${mapStyle}`);
        if (prev.routeMode !== routeMode) changes.push(`Route view: ${prev.routeMode} → ${routeMode}`);
        if (prev.showCityNames !== showCityNames) changes.push(`City names: ${prev.showCityNames ? 'on' : 'off'} → ${showCityNames ? 'on' : 'off'}`);
        if (prev.layoutMode !== layoutMode) changes.push(`Map layout: ${prev.layoutMode} → ${layoutMode}`);
        if (prev.timelineView !== timelineView) changes.push(`Timeline layout: ${prev.timelineView} → ${timelineView}`);
        if (prev.zoomLevel !== zoomLevel) changes.push(zoomLevel > prev.zoomLevel ? 'Zoomed in' : 'Zoomed out');

        if (changes.length === 1) {
            setPendingLabel(`Visual: ${changes[0]}`);
            scheduleCommit(undefined, currentViewSettings);
        } else if (changes.length > 1) {
            setPendingLabel(`Visual: ${changes.join(' · ')}`);
            scheduleCommit(undefined, currentViewSettings);
        }

        prevViewRef.current = currentViewSettings;
    }, [currentViewSettings, layoutMode, mapStyle, routeMode, showCityNames, timelineView, zoomLevel, setPendingLabel, scheduleCommit]);

    const handleToggleFavorite = useCallback(() => {
        if (!requireEdit()) return;
        markUserEdit();
        const nextFavorite = !trip.isFavorite;
        const updatedTrip: ITrip = {
            ...trip,
            isFavorite: nextFavorite,
            updatedAt: Date.now(),
        };

        setPendingLabel(nextFavorite ? 'Data: Added to favorites' : 'Data: Removed from favorites');
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
        showToast(nextFavorite ? 'Trip added to favorites' : 'Trip removed from favorites', {
            tone: nextFavorite ? 'add' : 'remove',
            title: nextFavorite ? 'Added' : 'Removed',
        });
    }, [trip, safeUpdateTrip, scheduleCommit, currentViewSettings, setPendingLabel, showToast, requireEdit, markUserEdit]);

    const selectedCitiesInTimeline = useMemo(() => {
        if (selectedCityIds.length === 0) return [];
        const selectedSet = new Set(selectedCityIds);
        return displayTrip.items
            .filter(item => item.type === 'city' && selectedSet.has(item.id))
            .sort((a, b) => a.startDateOffset - b.startDateOffset);
    }, [displayTrip.items, selectedCityIds]);

    const showSelectedCitiesPanel = selectedCitiesInTimeline.length > 1;
    const detailsPanelVisible = showSelectedCitiesPanel || !!selectedItemId;

    const clearSelection = useCallback(() => {
        setSelectedItemId(null);
        setSelectedCityIds([]);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (isHistoryOpen) return;
            if (isTripInfoOpen) return;
            if (!selectedItemId && selectedCityIds.length === 0) return;
            clearSelection();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clearSelection, selectedItemId, selectedCityIds, isHistoryOpen, isTripInfoOpen]);

    const handleTimelineSelect = useCallback((id: string | null, options?: { multi?: boolean; isCity?: boolean }) => {
        if (!id) {
            clearSelection();
            return;
        }

        const selectedItem = trip.items.find(item => item.id === id);
        if (!selectedItem) {
            setSelectedItemId(id);
            setSelectedCityIds([]);
            return;
        }

        if (selectedItem.type !== 'city') {
            setSelectedItemId(id);
            setSelectedCityIds([]);
            return;
        }

        if (!options?.multi) {
            setSelectedItemId(id);
            setSelectedCityIds([id]);
            return;
        }

        setSelectedCityIds(prev => {
            const baseSelection = prev.length > 0
                ? prev
                : (selectedItemId && trip.items.some(item => item.id === selectedItemId && item.type === 'city')
                    ? [selectedItemId]
                    : []);
            const exists = baseSelection.includes(id);
            const next = exists
                ? baseSelection.filter(cityId => cityId !== id)
                : [...baseSelection, id];

            if (next.length > 1) setSelectedItemId(null);
            else if (next.length === 1) setSelectedItemId(next[0]);
            else setSelectedItemId(null);

            return next;
        });
    }, [clearSelection, trip.items, selectedItemId]);


    // Handlers
    const handleUpdateItems = (items: ITimelineItem[], options?: { deferCommit?: boolean; skipPendingLabel?: boolean }) => {
        markUserEdit();
        const normalizedOffsets = options?.deferCommit
            ? { items, startDate: trip.startDate, shiftedDays: 0 }
            : normalizeNegativeOffsetsForTrip(items, trip.startDate);
        const normalizedItems = normalizeCityColors(normalizedOffsets.items);
        const nextTripStartDate = normalizedOffsets.startDate;

        if (options?.deferCommit) {
            if (!options.skipPendingLabel && !pendingHistoryLabelRef.current) {
                pendingHistoryLabelRef.current = 'Data: Adjusted timeline items';
            }
            const updatedTrip = { ...trip, items: normalizedItems, updatedAt: Date.now() };
            safeUpdateTrip(updatedTrip, { persist: false });
            return;
        }

        const prevItems = trip.items;
        const prevById = new Map(prevItems.map(i => [i.id, i]));
        const nextById = new Map(normalizedItems.map(i => [i.id, i]));

        const added = normalizedItems.filter(i => !prevById.has(i.id));
        const removed = prevItems.filter(i => !nextById.has(i.id));

        if (added.length === 1) {
            const a = added[0];
            if (a.type === 'city') setPendingLabel(`Data: Added city ${a.title}`);
            else if (a.type === 'activity') setPendingLabel(`Data: Added activity ${a.title}`);
            else setPendingLabel('Data: Added transport');
        } else if (removed.length === 1) {
            const r = removed[0];
            if (r.type === 'city') setPendingLabel(`Data: Removed city ${r.title}`);
            else if (r.type === 'activity') setPendingLabel(`Data: Removed activity ${r.title}`);
            else setPendingLabel('Data: Removed transport');
        } else {
            for (const next of normalizedItems) {
                const prev = prevById.get(next.id);
                if (!prev) continue;
                if (next.type === 'city') {
                    const durationChanged = prev.duration !== next.duration;
                    const startChanged = prev.startDateOffset !== next.startDateOffset;
                    if (durationChanged || startChanged) {
                        if (durationChanged) {
                            setPendingLabel(`Data: Changed city duration in ${next.title}`);
                        } else {
                            setPendingLabel(`Data: Rescheduled city ${next.title}`);
                        }
                        break;
                    }
                    if (JSON.stringify(prev.hotels || []) !== JSON.stringify(next.hotels || [])) {
                        setPendingLabel(`Data: Updated accommodation in ${next.title}`);
                        break;
                    }
                    if ((prev.description || '') !== (next.description || '')) {
                        setPendingLabel(`Data: Updated notes for ${next.title}`);
                        break;
                    }
                }
                if (next.type === 'travel' || next.type === 'travel-empty') {
                    if ((prev.transportMode || '') !== (next.transportMode || '')) {
                        setPendingLabel('Data: Changed transport type');
                        break;
                    }
                }
                if (next.type === 'activity') {
                    if (prev.title !== next.title || (prev.description || '') !== (next.description || '')) {
                        setPendingLabel(`Data: Updated activity ${next.title}`);
                        break;
                    }
                    if (JSON.stringify(normalizeActivityTypes(prev.activityType)) !== JSON.stringify(normalizeActivityTypes(next.activityType))) {
                        setPendingLabel(`Data: Updated activity types for ${next.title}`);
                        break;
                    }
                    if (prev.startDateOffset !== next.startDateOffset || prev.duration !== next.duration) {
                        setPendingLabel(`Data: Rescheduled activity ${next.title}`);
                        break;
                    }
                }
            }
        }

        const updatedTrip = { ...trip, startDate: nextTripStartDate, items: normalizedItems, updatedAt: Date.now() };
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
    };

    const applySelectedCityOrder = useCallback((orderedCityIds: string[]) => {
        if (selectedCityIds.length < 2) return;

        const selectedSet = new Set(selectedCityIds);
        const normalizedOrder = orderedCityIds.filter(id => selectedSet.has(id));
        if (normalizedOrder.length !== selectedSet.size) return;

        const reorderedItems = reorderSelectedCities(trip.items, selectedCityIds, normalizedOrder);
        if (reorderedItems === trip.items) return;

        setPendingLabel('Data: Reordered selected cities');
        handleUpdateItems(reorderedItems);
        setSelectedItemId(null);
        setSelectedCityIds(normalizedOrder);
    }, [selectedCityIds, trip.items, setPendingLabel, handleUpdateItems]);

    const handleReverseSelectedCities = useCallback(() => {
        if (selectedCitiesInTimeline.length < 2) return;
        const reversedOrder = [...selectedCitiesInTimeline].map(city => city.id).reverse();
        applySelectedCityOrder(reversedOrder);
    }, [selectedCitiesInTimeline, applySelectedCityOrder]);

    const handleUpdateItem = (id: string, updates: Partial<ITimelineItem>) => {
        const item = trip.items.find(i => i.id === id);
        let sanitizedUpdates = updates;
        if (
            item &&
            (item.type === 'travel' || item.type === 'travel-empty') &&
            updates.transportMode !== undefined &&
            updates.transportMode !== item.transportMode
        ) {
            sanitizedUpdates = { ...updates, routeDistanceKm: undefined, routeDurationHours: undefined };
            setRouteStatusById(prev => {
                if (!prev[item.id]) return prev;
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
        }
        if (item) {
            markUserEdit();
            if (item.type === 'city') {
                if (updates.duration !== undefined || updates.startDateOffset !== undefined) {
                    if (updates.duration !== undefined) {
                        setPendingLabel(`Data: Changed city duration in ${item.title}`);
                    } else {
                        setPendingLabel(`Data: Rescheduled city ${item.title}`);
                    }
                } else if (updates.hotels !== undefined) {
                    setPendingLabel(`Data: Updated accommodation in ${item.title}`);
                } else if (updates.description !== undefined) {
                    setPendingLabel(`Data: Updated notes for ${item.title}`);
                } else if (updates.title !== undefined) {
                    setPendingLabel(`Data: Renamed city ${item.title}`);
                } else if (updates.location !== undefined || updates.coordinates !== undefined) {
                    setPendingLabel(`Data: Changed city in ${item.title}`);
                }
            } else if (item.type === 'travel' || item.type === 'travel-empty') {
                if (updates.transportMode !== undefined) {
                    setPendingLabel('Data: Changed transport type');
                } else if (updates.duration !== undefined || updates.startDateOffset !== undefined) {
                    setPendingLabel('Data: Adjusted transport timing');
                }
            } else if (item.type === 'activity') {
                if (updates.title !== undefined || updates.description !== undefined) {
                    setPendingLabel(`Data: Updated activity ${item.title}`);
                } else if (updates.activityType !== undefined) {
                    setPendingLabel(`Data: Updated activity types for ${item.title}`);
                } else if (updates.startDateOffset !== undefined || updates.duration !== undefined) {
                    setPendingLabel(`Data: Rescheduled activity ${item.title}`);
                }
            }
        }
        const newItems = trip.items.map(i => i.id === id ? { ...i, ...sanitizedUpdates } : i);
        handleUpdateItems(newItems);
    };

    const handleBatchItemUpdate = useCallback((
        changes: Array<{ id: string; updates: Partial<ITimelineItem> }>,
        options?: { label?: string; deferCommit?: boolean; skipPendingLabel?: boolean }
    ) => {
        if (changes.length === 0) return;

        const updatesById = new Map(changes.map(change => [change.id, change.updates]));
        let hasChanges = false;
        const newItems = trip.items.map(item => {
            const updates = updatesById.get(item.id);
            if (!updates) return item;
            hasChanges = true;
            return { ...item, ...updates };
        });

        if (!hasChanges) return;
        if (options?.label) setPendingLabel(options.label);
        handleUpdateItems(
            newItems,
            options?.deferCommit
                ? { deferCommit: true, skipPendingLabel: options?.skipPendingLabel }
                : undefined
        );
    }, [trip.items, handleUpdateItems, setPendingLabel]);

    const handleCityColorPaletteChange = useCallback((paletteId: string, options: { applyToCities: boolean }) => {
        if (!requireEdit()) return;
        if (!paletteId || paletteId === cityColorPaletteId) return;

        markUserEdit();
        const nextItems = options.applyToCities ? applyCityPaletteToItems(trip.items, paletteId) : trip.items;
        const updatedTrip: ITrip = {
            ...trip,
            cityColorPaletteId: paletteId,
            items: nextItems,
            updatedAt: Date.now(),
        };

        setPendingLabel(
            options.applyToCities
                ? 'Data: Applied city color palette to all cities'
                : 'Data: Changed active city color palette'
        );
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
    }, [
        requireEdit,
        cityColorPaletteId,
        markUserEdit,
        trip,
        setPendingLabel,
        safeUpdateTrip,
        scheduleCommit,
        currentViewSettings,
    ]);

    const handleMapColorModeChange = useCallback((mode: MapColorMode) => {
        if (!requireEdit()) return;
        if (mode !== 'brand' && mode !== 'trip') return;
        if (mapColorMode === mode) return;

        markUserEdit();
        const updatedTrip: ITrip = {
            ...trip,
            mapColorMode: mode,
            updatedAt: Date.now(),
        };
        setPendingLabel(mode === 'trip'
            ? 'Data: Set map colors to trip colors'
            : 'Data: Set map colors to brand accent');
        safeUpdateTrip(updatedTrip, { persist: true });
        scheduleCommit(updatedTrip, currentViewSettings);
    }, [
        requireEdit,
        mapColorMode,
        markUserEdit,
        trip,
        setPendingLabel,
        safeUpdateTrip,
        scheduleCommit,
        currentViewSettings,
    ]);

    const [routeStatusById, setRouteStatusById] = useState<Record<string, RouteStatus>>({});

    const handleRouteMetrics = useCallback((travelItemId: string, metrics: { routeDistanceKm?: number; routeDurationHours?: number; mode?: string; routeKey?: string }) => {
        const currentTrip = tripRef.current;
        const item = currentTrip.items.find(i => i.id === travelItemId);
        if (!item) return;
        const normalizedItemMode = normalizeTransportMode(item.transportMode);
        if (metrics.mode && normalizedItemMode !== normalizeTransportMode(metrics.mode)) return;

        if (metrics.routeKey) {
            const leg = getTravelLegMetricsForItem(currentTrip.items, travelItemId);
            if (!leg?.fromCity.coordinates || !leg?.toCity.coordinates) return;
            const expectedKey = buildRouteCacheKey(
                leg.fromCity.coordinates,
                leg.toCity.coordinates,
                normalizedItemMode
            );
            if (expectedKey !== metrics.routeKey) return;
        }

        const updates: Partial<ITimelineItem> = {};
        if (Number.isFinite(metrics.routeDistanceKm)) {
            const next = metrics.routeDistanceKm as number;
            if (!Number.isFinite(item.routeDistanceKm) || Math.abs((item.routeDistanceKm as number) - next) > 0.01) {
                updates.routeDistanceKm = next;
            }
        }
        if (Number.isFinite(metrics.routeDurationHours)) {
            const next = metrics.routeDurationHours as number;
            if (!Number.isFinite(item.routeDurationHours) || Math.abs((item.routeDurationHours as number) - next) > 0.01) {
                updates.routeDurationHours = next;
            }
        }

        if (Object.keys(updates).length === 0) return;

        const newItems = currentTrip.items.map(i => i.id === travelItemId ? { ...i, ...updates } : i);
        const updatedTrip = { ...currentTrip, items: newItems, updatedAt: Date.now() };
        tripRef.current = updatedTrip;
        if (pendingCommitRef.current?.trip?.id === updatedTrip.id) {
            pendingCommitRef.current = { ...pendingCommitRef.current, trip: updatedTrip };
        }
        onUpdateTrip(updatedTrip);
    }, [onUpdateTrip]);

    const handleRouteStatus = useCallback((travelItemId: string, status: RouteStatus, meta?: { mode?: string; routeKey?: string }) => {
        const currentTrip = tripRef.current;
        const item = currentTrip.items.find(i => i.id === travelItemId);
        if (!item) return;
        const normalizedItemMode = normalizeTransportMode(item.transportMode);
        if (meta?.mode && normalizedItemMode !== normalizeTransportMode(meta.mode)) return;

        if (meta?.routeKey) {
            const leg = getTravelLegMetricsForItem(currentTrip.items, travelItemId);
            if (!leg?.fromCity.coordinates || !leg?.toCity.coordinates) return;
            const expectedKey = buildRouteCacheKey(
                leg.fromCity.coordinates,
                leg.toCity.coordinates,
                normalizedItemMode
            );
            if (expectedKey !== meta.routeKey) return;
        }

        setRouteStatusById(prev => {
            if (prev[travelItemId] === status) return prev;
            return { ...prev, [travelItemId]: status };
        });
    }, []);

    const handleForceFill = (id: string) => {
        const cities = trip.items
            .filter(i => i.type === 'city')
            .sort((a, b) => a.startDateOffset - b.startDateOffset);

        const targetIndex = cities.findIndex(i => i.id === id);
        if (targetIndex === -1) return;

        const targetCity = cities[targetIndex];
        setPendingLabel(`Data: Changed city duration (fill space) in ${targetCity.title}`);
        const prevCity = targetIndex > 0 ? cities[targetIndex - 1] : null;
        const nextCity = targetIndex < cities.length - 1 ? cities[targetIndex + 1] : null;

        const prevEnd = prevCity ? prevCity.startDateOffset + prevCity.duration : 0;
        const newStart = prevCity ? prevEnd : 0;
        let newDuration = targetCity.duration;

        if (nextCity) {
            const availableDuration = nextCity.startDateOffset - newStart;
            newDuration = Math.max(0.5, availableDuration);
        }

        const newItems = trip.items.map(item => {
            if (item.id === id) {
                return { ...item, startDateOffset: newStart, duration: Math.max(0.5, newDuration) };
            }
            return item;
        });

        handleUpdateItems(newItems);
    };

    const selectedCityForceFill = React.useMemo<{ mode: 'stretch' | 'shrink'; label: string } | null>(() => {
        if (!selectedItemId) return null;
        const cities = trip.items
            .filter(i => i.type === 'city')
            .sort((a, b) => a.startDateOffset - b.startDateOffset);

        const targetIndex = cities.findIndex(i => i.id === selectedItemId);
        if (targetIndex === -1) return null;

        const targetCity = cities[targetIndex];
        const prevCity = targetIndex > 0 ? cities[targetIndex - 1] : null;
        const nextCity = targetIndex < cities.length - 1 ? cities[targetIndex + 1] : null;

        const prevEnd = prevCity ? prevCity.startDateOffset + prevCity.duration : 0;
        const nextStart = nextCity ? nextCity.startDateOffset : null;
        const currentStart = targetCity.startDateOffset;
        const currentEnd = targetCity.startDateOffset + targetCity.duration;

        const gapBefore = currentStart > prevEnd + 0.05;
        const overlapBefore = currentStart < prevEnd - 0.05;
        const gapAfter = nextStart !== null ? currentEnd < nextStart - 0.05 : false;
        const overlapAfter = nextStart !== null ? currentEnd > nextStart + 0.05 : false;

        if (!(gapBefore || gapAfter || overlapBefore || overlapAfter)) return null;

        const mode = (overlapBefore && overlapAfter) ? 'shrink' : 'stretch';
        const label = (overlapBefore && overlapAfter) ? 'Occupy available space' : 'Stretch to fill space';
        return { mode, label };
    }, [trip.items, selectedItemId]);

    const handleDeleteItem = (id: string, strategy: 'item-only' | 'shift-gap' | 'pull-back' = 'item-only') => {
        markUserEdit();
        const item = trip.items.find(i => i.id === id);
        if (item) {
            if (item.type === 'city') {
                pendingHistoryLabelRef.current = `Data: Removed city ${item.title}`;
            } else if (item.type === 'activity') {
                pendingHistoryLabelRef.current = `Data: Removed activity ${item.title}`;
            } else {
                pendingHistoryLabelRef.current = `Data: Removed transport ${item.title}`;
            }
        }
        const newItems = trip.items.filter(i => i.id !== id);
        // Note: Complex strategies omitted for simplicity as they require logic function imports like deleteItemWithStrategy
        // If critical, we should import that helper. For now, basic delete.
        handleUpdateItems(newItems);
        if (item) {
            const label = stripHistoryPrefix(pendingHistoryLabelRef.current || 'Removed item');
            showToast(label, { tone: 'remove', title: 'Removed' });
        }
        setSelectedItemId(null);
        setSelectedCityIds(prev => prev.filter(cityId => cityId !== id));
    };

    useEffect(() => {
        const handleDeleteKey = (e: KeyboardEvent) => {
            if (isHistoryOpen || addActivityState.isOpen || isAddCityModalOpen) return;
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;

            const target = e.target as HTMLElement | null;
            const isEditable = !!target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            );
            if (isEditable) return;
            if (!selectedItemId) return;

            const selectedItem = trip.items.find(item => item.id === selectedItemId);
            if (!selectedItem) return;
            if (selectedItem.type !== 'city' && selectedItem.type !== 'activity') return;
            if (!requireEdit()) return;

            e.preventDefault();
            handleDeleteItem(selectedItem.id);
        };

        window.addEventListener('keydown', handleDeleteKey);
        return () => window.removeEventListener('keydown', handleDeleteKey);
    }, [selectedItemId, trip.items, isHistoryOpen, addActivityState.isOpen, isAddCityModalOpen, handleDeleteItem, requireEdit]);

    // Modal Handlers
    const handleOpenAddActivity = (dayOffset: number) => {
         if (!requireEdit()) return;
         // Find city at this time
         const city = trip.items.find(i => i.type === 'city' && dayOffset >= i.startDateOffset && dayOffset < i.startDateOffset + i.duration);
         setAddActivityState({ isOpen: true, dayOffset, location: city?.title || trip.title });
    };

    const handleAddActivityItem = (itemProps: Partial<ITimelineItem>) => {
        if (!requireEdit()) return;
        markUserEdit();
        const normalizedTypes = normalizeActivityTypes(itemProps.activityType);
        const newItem: ITimelineItem = {
            id: crypto.randomUUID(),
            type: 'activity',
            title: itemProps.title || 'New Activity',
            startDateOffset: itemProps.startDateOffset || addActivityState.dayOffset,
            duration: itemProps.duration || (1 / 24), // 1 hour default
            description: itemProps.description || '',
            location: itemProps.location || addActivityState.location,
            ...itemProps,
            activityType: normalizedTypes,
            color: itemProps.color || getActivityColorByTypes(normalizedTypes),
        } as ITimelineItem;
        suppressCommitRef.current = false;
        setPendingLabel(`Data: Added activity ${newItem.title}`);
        handleUpdateItems([...trip.items, newItem]);
        showToast(`Activity "${newItem.title}" added`, { tone: 'add', title: 'Added' });
    };

    const handleAddCityItem = (itemProps: Partial<ITimelineItem>) => {
        if (!requireEdit()) return;
        markUserEdit();
        // Logic to insert city? Or simple append?
        // App.tsx usually had logic to find gap.
        // For now, append at end of default logic:
        const lastItem = trip.items.reduce((max, item) => Math.max(max, item.startDateOffset + item.duration), 0);
        const newItem: ITimelineItem = {
            id: crypto.randomUUID(),
            type: 'city',
            title: itemProps.title || 'New City',
            startDateOffset: lastItem,
            duration: itemProps.duration || 2,
            color: itemProps.color || 'bg-emerald-100 border-emerald-200 text-emerald-700',
            loading: false,
            ...itemProps
        } as ITimelineItem;
        suppressCommitRef.current = false;
        setPendingLabel(`Data: Added city ${newItem.title}`);
        handleUpdateItems([...trip.items, newItem]);
        setSelectedItemId(newItem.id);
        setSelectedCityIds([newItem.id]);
        showToast(`City "${newItem.title}" added`, { tone: 'add', title: 'Added' });
        setIsAddCityModalOpen(false);
    };

    const clampDetailsWidth = useCallback((rawWidth: number) => {
        if (typeof window === 'undefined') return Math.max(MIN_DETAILS_WIDTH, rawWidth);

        if (layoutMode === 'horizontal') {
            const maxWidth = window.innerWidth - sidebarWidth - MIN_MAP_WIDTH - (RESIZER_WIDTH * 2);
            const boundedMax = Math.max(HARD_MIN_DETAILS_WIDTH, maxWidth);
            const boundedMin = Math.min(MIN_DETAILS_WIDTH, boundedMax);
            return Math.max(boundedMin, Math.min(boundedMax, rawWidth));
        }

        const maxWidth = window.innerWidth - MIN_TIMELINE_COLUMN_WIDTH;
        const boundedMax = Math.max(HARD_MIN_DETAILS_WIDTH, maxWidth);
        const boundedMin = Math.min(MIN_DETAILS_WIDTH, boundedMax);
        return Math.max(boundedMin, Math.min(boundedMax, rawWidth));
    }, [layoutMode, sidebarWidth]);

    useEffect(() => {
        setDetailsWidth(prev => clampDetailsWidth(prev));
    }, [clampDetailsWidth]);

    useEffect(() => {
        const handleResize = () => setDetailsWidth(prev => clampDetailsWidth(prev));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampDetailsWidth]);

    const autoFitHorizontalTimelineForVerticalLayout = useCallback(() => {
        if (layoutMode !== 'vertical' || timelineView !== 'horizontal') return false;

        const measuredWidth = verticalLayoutTimelineRef.current?.clientWidth ?? 0;
        if (measuredWidth <= 0) return false;

        const usableTimelineWidth = Math.max(160, measuredWidth - HORIZONTAL_TIMELINE_AUTO_FIT_PADDING);
        const targetPixelsPerDay = usableTimelineWidth / horizontalTimelineDayCount;
        const targetZoom = clampZoomLevel(targetPixelsPerDay / BASE_PIXELS_PER_DAY);

        if (!Number.isFinite(targetZoom)) return false;
        setZoomLevel(prev => (Math.abs(prev - targetZoom) < 0.01 ? prev : targetZoom));
        return true;
    }, [layoutMode, timelineView, horizontalTimelineDayCount, clampZoomLevel]);

    useEffect(() => {
        const previousLayoutMode = previousLayoutModeRef.current;
        if (previousLayoutMode === 'horizontal' && layoutMode === 'vertical' && timelineView === 'horizontal') {
            const runAutoFit = () => {
                if (!autoFitHorizontalTimelineForVerticalLayout()) {
                    requestAnimationFrame(() => {
                        autoFitHorizontalTimelineForVerticalLayout();
                    });
                }
            };
            requestAnimationFrame(runAutoFit);
        }
        previousLayoutModeRef.current = layoutMode;
    }, [layoutMode, timelineView, autoFitHorizontalTimelineForVerticalLayout]);

    // Resizing Logic
    const startResizing = useCallback((type: 'sidebar' | 'details' | 'timeline-h', startClientX?: number) => {
        isResizingRef.current = type;
        if (type === 'details') {
            detailsResizeStartWidthRef.current = detailsWidth;
            detailsResizeStartXRef.current = startClientX || 0;
        }
        document.body.style.cursor = type === 'timeline-h' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';
    }, [detailsWidth]);

    const stopResizing = useCallback(() => {
        if (isResizingRef.current === 'sidebar') localStorage.setItem('tf_sidebar_width', sidebarWidth.toString());
        if (isResizingRef.current === 'details') localStorage.setItem('tf_details_width', Math.round(detailsWidth).toString());
        if (isResizingRef.current === 'timeline-h') localStorage.setItem('tf_timeline_height', timelineHeight.toString());
        isResizingRef.current = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, [sidebarWidth, detailsWidth, timelineHeight]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizingRef.current) return;
        if (isResizingRef.current === 'sidebar') {
            const reservedForDetails = detailsPanelVisible ? detailsWidth : 0;
            const maxSidebar = window.innerWidth - reservedForDetails - MIN_MAP_WIDTH - (RESIZER_WIDTH * 2);
            const boundedMax = Math.max(MIN_SIDEBAR_WIDTH, maxSidebar);
            setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(boundedMax, e.clientX)));
        } else if (isResizingRef.current === 'details') {
            const deltaX = e.clientX - detailsResizeStartXRef.current;
            const nextWidth = detailsResizeStartWidthRef.current + deltaX;
            setDetailsWidth(clampDetailsWidth(nextWidth));
        } else if (isResizingRef.current === 'timeline-h') {
            const maxH = window.innerHeight - MIN_BOTTOM_MAP_HEIGHT;
            setTimelineHeight(Math.max(MIN_TIMELINE_HEIGHT, Math.min(maxH, window.innerHeight - e.clientY)));
        }
    }, [detailsPanelVisible, detailsWidth, clampDetailsWidth]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [handleMouseMove, stopResizing]);

    const isMobile = isMobileViewport;
    const effectiveLayoutMode: 'vertical' | 'horizontal' = isMobile ? 'vertical' : layoutMode;
    const canManageTripMetadata = canEdit && !shareStatus && !isExamplePreview;
    const infoHistoryEntries = useMemo(() => {
        return showAllHistory ? displayHistoryEntries : displayHistoryEntries.slice(0, 8);
    }, [displayHistoryEntries, showAllHistory]);

    const handleStartTitleEdit = useCallback(() => {
        if (!canManageTripMetadata) return;
        if (!requireEdit()) return;
        setEditTitleValue(trip.title);
        setIsEditingTitle(true);
    }, [canManageTripMetadata, requireEdit, trip.title]);

    const handleCommitTitleEdit = useCallback(() => {
        if (!canManageTripMetadata) {
            setIsEditingTitle(false);
            return;
        }
        const nextTitle = editTitleValue.trim();
        setIsEditingTitle(false);

        if (!nextTitle || nextTitle === trip.title) return;
        if (!requireEdit()) return;

        markUserEdit();
        const updatedTrip = { ...trip, title: nextTitle, updatedAt: Date.now() };
        setPendingLabel('Data: Renamed trip');
        safeUpdateTrip(updatedTrip);
        scheduleCommit(updatedTrip, currentViewSettings);
    }, [canManageTripMetadata, editTitleValue, trip, requireEdit, markUserEdit, setPendingLabel, safeUpdateTrip, scheduleCommit, currentViewSettings]);

    const getPinchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    };

    const handleTimelineTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (!isMobile || event.touches.length !== 2) return;
        const distance = getPinchDistance(event.touches);
        if (!distance) return;
        pinchStartDistanceRef.current = distance;
        pinchStartZoomRef.current = zoomLevel;
    }, [isMobile, zoomLevel]);

    const handleTimelineTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (!isMobile || event.touches.length !== 2) return;

        const startDistance = pinchStartDistanceRef.current;
        const startZoom = pinchStartZoomRef.current;
        if (!startDistance || !startZoom) return;

        const distance = getPinchDistance(event.touches);
        if (!distance) return;

        event.preventDefault();
        const nextZoom = clampZoomLevel(startZoom * (distance / startDistance));
        setZoomLevel(prev => (Math.abs(prev - nextZoom) < 0.01 ? prev : nextZoom));
    }, [clampZoomLevel, isMobile]);

    const handleTimelineTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (event.touches.length >= 2) return;
        pinchStartDistanceRef.current = null;
        pinchStartZoomRef.current = null;
    }, []);

    const activeToastMeta = toastState ? getToneMeta(toastState.tone) : null;

    if (viewMode === 'print') {
        return (
            <GoogleMapsLoader language={appLanguage}>
                <PrintLayout
                    trip={displayTrip}
                    isPaywalled={isTripLockedByExpiry}
                    onClose={() => setViewMode('planner')}
                    onUpdateTrip={handleUpdateItems}
                />
            </GoogleMapsLoader>
        );
    }

    return (
        <GoogleMapsLoader language={appLanguage}>
            <div className="relative h-screen w-screen flex flex-col bg-gray-50 overflow-hidden text-gray-900 font-sans selection:bg-accent-100 selection:text-accent-900">
                
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-30 shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <Link
                            to="/"
                            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                            title="Go to Homepage"
                            aria-label="Go to Homepage"
                        >
                            <div className="w-8 h-8 bg-accent-600 rounded-lg flex items-center justify-center shadow-accent-200 shadow-lg transform rotate-3">
                                <Plane className="text-white transform -rotate-3" size={18} fill="currentColor" />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:block">Travel<span className="text-accent-600">Flow</span></span>
                        </Link>
                        <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block" />
                        <div className="flex items-start gap-2 min-w-0">
                            <div className="flex flex-col leading-tight min-w-0">
                                {!isMobile && isEditingTitle ? (
                                    <input
                                        value={editTitleValue}
                                        onChange={e => setEditTitleValue(e.target.value)}
                                        onBlur={handleCommitTitleEdit}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                handleCommitTitleEdit();
                                            }
                                        }}
                                        autoFocus
                                        className="font-bold text-lg text-gray-900 bg-transparent border-b-2 border-accent-500 outline-none pb-0.5"
                                    />
                                ) : (
                                    <div
                                        className={`flex items-center gap-2 ${!isMobile && canManageTripMetadata ? 'group cursor-pointer' : ''}`}
                                        onClick={!isMobile && canManageTripMetadata ? handleStartTitleEdit : undefined}
                                    >
                                        <h1
                                            className="font-bold text-lg text-gray-900 truncate max-w-[56vw] sm:max-w-md"
                                            style={titleViewTransitionName ? ({ viewTransitionName: titleViewTransitionName } as React.CSSProperties) : undefined}
                                        >
                                            {trip.title}
                                        </h1>
                                        {!isMobile && canManageTripMetadata && (
                                            <Pencil size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </div>
                                )}
                                {!isMobile && <div className="text-xs font-semibold text-accent-600 mt-0.5">{tripSummary}</div>}
                            </div>
                            {!isMobile && canManageTripMetadata && (
                                <button
                                    type="button"
                                    onClick={handleToggleFavorite}
                                    disabled={!canEdit}
                                    className={`mt-0.5 p-1.5 rounded-lg transition-colors ${canEdit ? 'hover:bg-amber-50' : 'opacity-50 cursor-not-allowed'}`}
                                    title={trip.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                    aria-label={trip.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                >
                                    <Star
                                        size={17}
                                        className={trip.isFavorite ? 'text-amber-500 fill-amber-400' : 'text-gray-300 hover:text-amber-500'}
                                    />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                void handleHeaderAuthAction();
                            }}
                            disabled={isHeaderAuthSubmitting}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={canUseAuthenticatedSession ? 'Logout' : 'Login'}
                        >
                            {canUseAuthenticatedSession ? 'Logout' : 'Login'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsTripInfoOpen(true)}
                            className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                            aria-label="Trip information"
                        >
                            <Info size={18} />
                        </button>
                        {!isMobile && (
                            <>
                                <div className="bg-gray-100 p-1 rounded-lg flex items-center mr-1">
                                    <button onClick={() => setViewMode('print')} className="p-1.5 text-gray-500 hover:text-gray-700 rounded-md" aria-label="Print view">
                                        <Printer size={18} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        trackEvent('app__trip_history--open', { source: 'desktop_header' });
                                        setIsHistoryOpen(true);
                                    }}
                                    className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                                    aria-label="History"
                                    {...getAnalyticsDebugAttributes('app__trip_history--open', { source: 'desktop_header' })}
                                >
                                    <History size={18} />
                                </button>
                            </>
                        )}
                        {!isMobile && (
                            <button
                                onClick={onOpenManager}
                                className="flex items-center gap-2 rounded-lg font-medium p-2 text-gray-500 hover:bg-gray-100 text-sm"
                                aria-label="My plans"
                            >
                                <Route size={18} />
                                <span className="hidden lg:inline">My Plans</span>
                            </button>
                        )}
                        {canShare && (
                            <button
                                onClick={handleShare}
                                disabled={isTripLockedByExpiry}
                                title={isTripLockedByExpiry ? 'Sharing is disabled for expired trips' : undefined}
                                className={`rounded-lg shadow-sm flex items-center gap-2 text-sm font-medium ${isMobile ? 'p-2' : 'px-4 py-2'} ${
                                    isTripLockedByExpiry
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-accent-600 text-white hover:bg-accent-700'
                                }`}
                            >
                                <Share2 size={16} />
                                <span className={isMobile ? 'sr-only' : 'hidden sm:inline'}>Share</span>
                            </button>
                        )}
                        {isMobile && (
                            <button
                                type="button"
                                onClick={() => {
                                    trackEvent('app__trip_history--open', { source: 'mobile_header' });
                                    setIsHistoryOpen(true);
                                }}
                                className="p-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"
                                aria-label="History"
                                {...getAnalyticsDebugAttributes('app__trip_history--open', { source: 'mobile_header' })}
                            >
                                <History size={18} />
                            </button>
                        )}
                        {isMobile && (
                            <button
                                onClick={onOpenManager}
                                className="flex items-center gap-2 rounded-lg font-medium p-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                aria-label="My plans"
                            >
                                <Route size={18} />
                                <span className="sr-only">My Plans</span>
                            </button>
                        )}
                    </div>
                </header>

                {shareStatus && (
                    <div className="px-4 sm:px-6 py-2 border-b border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-center justify-between">
                        <span>
                            {shareStatus === 'view' ? 'View-only shared trip' : 'Shared trip · Editing enabled'}
                        </span>
                        {shareStatus === 'view' && onCopyTrip && (
                            <button
                                type="button"
                                onClick={onCopyTrip}
                                className="px-3 py-1 rounded-md bg-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-300"
                            >
                                Copy trip
                            </button>
                        )}
                    </div>
                )}

                {shareSnapshotMeta && (
                    <div className="px-4 sm:px-6 py-2 border-b border-accent-200 bg-accent-50 text-accent-900 text-xs flex items-center justify-between gap-3">
                        <span>
                            {shareSnapshotMeta.hasNewer
                                ? 'You are viewing an older snapshot. This trip has newer updates.'
                                : 'You are viewing a snapshot version of this shared trip.'}
                        </span>
                        {shareSnapshotMeta.hasNewer && (
                            <button
                                type="button"
                                onClick={() => navigate(shareSnapshotMeta.latestUrl)}
                                className="px-3 py-1 rounded-md bg-accent-100 text-accent-900 text-xs font-semibold hover:bg-accent-200"
                            >
                                Open latest
                            </button>
                        )}
                    </div>
                )}

                {(tripExpiresAtMs || isTripLockedByExpiry) && !trip.isExample && (
                    <div
                        className={`px-4 sm:px-6 py-2 border-b text-xs flex items-center justify-between gap-3 ${
                            isTripLockedByExpiry
                                ? 'border-rose-200 bg-rose-50 text-rose-900'
                                : 'border-sky-200 bg-sky-50 text-sky-900'
                        }`}
                    >
                        <span>
                            {isTripLockedByExpiry
                                ? `Trip preview paused${expirationLabel ? ` since ${expirationLabel}` : ''}. Reactivate to unlock full planning mode.`
                                : `${expirationRelativeLabel || 'Trip access is time-limited'}${expirationLabel ? ` · Ends ${expirationLabel}` : ''}.`}
                        </span>
                        {isTripLockedByExpiry && (
                            <Link
                                to="/login"
                                onClick={(event) => handlePaywallLoginClick(event, 'trip_paywall__strip--activate', 'trip_paywall_strip')}
                                className="px-3 py-1 rounded-md bg-rose-100 text-rose-900 text-xs font-semibold hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                            >
                                Reactivate trip
                            </Link>
                        )}
                    </div>
                )}

                {exampleTripBanner && (
                    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[1450] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[420px]">
                        <div className="rounded-2xl border border-accent-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-white/85">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-700">Example trip playground</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">Explore freely. Copy when you want to keep and edit.</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                This itinerary is for illustration only and never saves changes.
                                {exampleTripBanner.countries.length > 0 && (
                                    <span> Country focus: {exampleTripBanner.countries.join(', ')}.</span>
                                )}
                            </p>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                                {exampleTripBanner.onCreateSimilarTrip && (
                                    <button
                                        type="button"
                                        onClick={exampleTripBanner.onCreateSimilarTrip}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-200 bg-white px-3 text-xs font-semibold text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                    >
                                        <Sparkle size={14} weight="duotone" />
                                        Create similar trip
                                    </button>
                                )}
                                {onCopyTrip && (
                                    <button
                                        type="button"
                                        onClick={onCopyTrip}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-xs font-semibold text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                    >
                                        <CopySimple size={14} weight="duotone" />
                                        Copy trip
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 relative overflow-hidden flex flex-col">
                    {isMobileMapExpanded && (
                        <button
                            type="button"
                            className="fixed inset-0 z-[1430] bg-black/25"
                            aria-label="Close expanded map"
                            onClick={() => setIsMobileMapExpanded(false)}
                        />
                    )}
                    <div className={`w-full h-full ${isTripLockedByExpiry ? 'pointer-events-none select-none' : ''}`}>
                        {isMobile ? (
                            <div className="w-full h-full flex flex-col">
                                <div
                                    className="flex-1 min-h-0 w-full bg-white border-b border-gray-200 relative overflow-hidden"
                                    onTouchStart={handleTimelineTouchStart}
                                    onTouchMove={handleTimelineTouchMove}
                                    onTouchEnd={handleTimelineTouchEnd}
                                    onTouchCancel={handleTimelineTouchEnd}
                                >
                                    {timelineView === 'vertical' ? (
                                        <VerticalTimeline
                                            trip={displayTrip}
                                            onUpdateItems={handleUpdateItems}
                                            onSelect={handleTimelineSelect}
                                            selectedItemId={selectedItemId}
                                            selectedCityIds={selectedCityIds}
                                            readOnly={!canEdit}
                                            onAddCity={() => { if (!requireEdit()) return; setIsAddCityModalOpen(true); }}
                                            onAddActivity={handleOpenAddActivity}
                                            onForceFill={handleForceFill}
                                            onSwapSelectedCities={handleReverseSelectedCities}
                                            pixelsPerDay={pixelsPerDay}
                                            enableExampleSharedTransition={useExampleSharedTransition}
                                        />
                                    ) : (
                                        <Timeline
                                            trip={displayTrip}
                                            onUpdateItems={handleUpdateItems}
                                            onSelect={handleTimelineSelect}
                                            selectedItemId={selectedItemId}
                                            selectedCityIds={selectedCityIds}
                                            readOnly={!canEdit}
                                            onAddCity={() => { if (!requireEdit()) return; setIsAddCityModalOpen(true); }}
                                            onAddActivity={handleOpenAddActivity}
                                            onForceFill={handleForceFill}
                                            onSwapSelectedCities={handleReverseSelectedCities}
                                            routeStatusById={routeStatusById}
                                            pixelsPerDay={pixelsPerDay}
                                            enableExampleSharedTransition={useExampleSharedTransition}
                                        />
                                    )}
                                    <div className="absolute top-3 right-3 z-40 flex gap-2">
                                        <div className="flex flex-row gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1">
                                            <button onClick={() => setZoomLevel(z => clampZoomLevel(z - 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Zoom out timeline"><ZoomOut size={16} /></button>
                                            <button onClick={() => setZoomLevel(z => clampZoomLevel(z + 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Zoom in timeline"><ZoomIn size={16} /></button>
                                        </div>
                                        <div className="flex flex-row gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1 h-fit my-auto">
                                            <button onClick={() => setTimelineView(v => v === 'horizontal' ? 'vertical' : 'horizontal')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Toggle timeline view">
                                                {timelineView === 'horizontal' ? <List size={16} /> : <Calendar size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className={`${isMobileMapExpanded ? 'fixed inset-x-0 bottom-0 h-[70vh] z-[1450] border-t border-gray-200 shadow-2xl bg-white' : 'relative h-[34vh] min-h-[220px] bg-gray-100'}`}>
                                    <ItineraryMap
                                        items={displayTrip.items}
                                        selectedItemId={selectedItemId}
                                        layoutMode="vertical"
                                        showLayoutControls={false}
                                        activeStyle={mapStyle}
                                        onStyleChange={setMapStyle}
                                        routeMode={routeMode}
                                        onRouteModeChange={isTripLockedByExpiry ? undefined : setRouteMode}
                                        showCityNames={isTripLockedByExpiry ? false : showCityNames}
                                        onShowCityNamesChange={isTripLockedByExpiry ? undefined : setShowCityNames}
                                        mapColorMode={mapColorMode}
                                        onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                                        isExpanded={isMobileMapExpanded}
                                        onToggleExpanded={() => setIsMobileMapExpanded(v => !v)}
                                        focusLocationQuery={initialMapFocusQuery}
                                        onRouteMetrics={handleRouteMetrics}
                                        onRouteStatus={handleRouteStatus}
                                        fitToRouteKey={trip.id}
                                        isPaywalled={isTripLockedByExpiry}
                                        viewTransitionName={mapViewTransitionName}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className={`w-full h-full flex ${effectiveLayoutMode === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
                                {effectiveLayoutMode === 'horizontal' ? (
                                    <>
                                        <div style={{ width: sidebarWidth }} className="h-full flex flex-col items-center bg-white border-r border-gray-200 z-20 shrink-0 relative">
                                            <div className="w-full flex-1 overflow-hidden relative flex flex-col min-w-0">
                                                <div className="flex-1 w-full overflow-hidden relative min-w-0">
                                                    {timelineView === 'vertical' ? (
                                                        <VerticalTimeline
                                                            trip={displayTrip}
                                                            onUpdateItems={handleUpdateItems}
                                                            onSelect={handleTimelineSelect}
                                                            selectedItemId={selectedItemId}
                                                            selectedCityIds={selectedCityIds}
                                                            readOnly={!canEdit}
                                                            onAddCity={() => { if (!requireEdit()) return; setIsAddCityModalOpen(true); }}
                                                            onAddActivity={handleOpenAddActivity}
                                                            onForceFill={handleForceFill}
                                                            onSwapSelectedCities={handleReverseSelectedCities}
                                                            pixelsPerDay={pixelsPerDay}
                                                            enableExampleSharedTransition={useExampleSharedTransition}
                                                        />
                                                    ) : (
                                                        <Timeline
                                                            trip={displayTrip}
                                                            onUpdateItems={handleUpdateItems}
                                                            onSelect={handleTimelineSelect}
                                                            selectedItemId={selectedItemId}
                                                            selectedCityIds={selectedCityIds}
                                                            readOnly={!canEdit}
                                                            onAddCity={() => { if (!requireEdit()) return; setIsAddCityModalOpen(true); }}
                                                            onAddActivity={handleOpenAddActivity}
                                                            onForceFill={handleForceFill}
                                                            onSwapSelectedCities={handleReverseSelectedCities}
                                                            routeStatusById={routeStatusById}
                                                            pixelsPerDay={pixelsPerDay}
                                                            enableExampleSharedTransition={useExampleSharedTransition}
                                                        />
                                                    )}
                                                    <div className="absolute top-4 right-4 z-40 flex gap-2">
                                                        <div className="flex flex-row gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1">
                                                            <button onClick={() => setZoomLevel(z => clampZoomLevel(z - 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Zoom out timeline"><ZoomOut size={16} /></button>
                                                            <button onClick={() => setZoomLevel(z => clampZoomLevel(z + 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Zoom in timeline"><ZoomIn size={16} /></button>
                                                        </div>
                                                        <div className="flex flex-row gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1 h-fit my-auto">
                                                            <button onClick={() => setTimelineView(v => v === 'horizontal' ? 'vertical' : 'horizontal')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Toggle timeline view">
                                                                {timelineView === 'horizontal' ? <List size={16} /> : <Calendar size={16} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-1 bg-gray-100 hover:bg-accent-500 cursor-col-resize transition-colors z-30 flex items-center justify-center group" onMouseDown={() => startResizing('sidebar')}>
                                            <div className="h-8 w-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        {detailsPanelVisible && (
                                            <div style={{ width: detailsWidth }} className="h-full bg-white border-r border-gray-200 z-20 shrink-0 relative overflow-hidden">
                                                {showSelectedCitiesPanel ? (
                                                    <SelectedCitiesPanel
                                                        selectedCities={selectedCitiesInTimeline}
                                                        onClose={clearSelection}
                                                        onApplyOrder={applySelectedCityOrder}
                                                        onReverse={handleReverseSelectedCities}
                                                        timelineView={timelineView}
                                                        readOnly={!canEdit}
                                                    />
                                                ) : (
                                                    <DetailsPanel
                                                        item={displayTrip.items.find(i => i.id === selectedItemId) || null}
                                                        isOpen={!!selectedItemId}
                                                        onClose={clearSelection}
                                                        onUpdate={handleUpdateItem}
                                                        onBatchUpdate={handleBatchItemUpdate}
                                                        onDelete={handleDeleteItem}
                                                        tripStartDate={trip.startDate}
                                                        tripItems={displayTrip.items}
                                                        routeMode={routeMode}
                                                        routeStatus={selectedItemId ? routeStatusById[selectedItemId] : undefined}
                                                        onForceFill={handleForceFill}
                                                        forceFillMode={selectedCityForceFill?.mode}
                                                        forceFillLabel={selectedCityForceFill?.label}
                                                        variant="sidebar"
                                                        readOnly={!canEdit}
                                                        cityColorPaletteId={cityColorPaletteId}
                                                        onCityColorPaletteChange={canEdit ? handleCityColorPaletteChange : undefined}
                                                    />
                                                )}
                                                <div
                                                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-30 flex items-center justify-center group hover:bg-accent-50/60 transition-colors"
                                                    onMouseDown={(e) => startResizing('details', e.clientX)}
                                                    title="Resize details panel"
                                                >
                                                    <div className="h-10 w-0.5 rounded-full bg-gray-200 group-hover:bg-accent-400 transition-colors" />
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex-1 h-full relative bg-gray-100 min-w-0">
                                            <ItineraryMap
                                                items={displayTrip.items}
                                                selectedItemId={selectedItemId}
                                                layoutMode={layoutMode}
                                                onLayoutChange={setLayoutMode}
                                                activeStyle={mapStyle}
                                                onStyleChange={setMapStyle}
                                                routeMode={routeMode}
                                                onRouteModeChange={isTripLockedByExpiry ? undefined : setRouteMode}
                                                showCityNames={isTripLockedByExpiry ? false : showCityNames}
                                                onShowCityNamesChange={isTripLockedByExpiry ? undefined : setShowCityNames}
                                                mapColorMode={mapColorMode}
                                                onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                                                focusLocationQuery={initialMapFocusQuery}
                                                onRouteMetrics={handleRouteMetrics}
                                                onRouteStatus={handleRouteStatus}
                                                fitToRouteKey={trip.id}
                                                isPaywalled={isTripLockedByExpiry}
                                                viewTransitionName={mapViewTransitionName}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex-1 relative bg-gray-100 min-h-0 w-full">
                                            <ItineraryMap
                                                items={displayTrip.items}
                                                selectedItemId={selectedItemId}
                                                layoutMode={layoutMode}
                                                onLayoutChange={setLayoutMode}
                                                activeStyle={mapStyle}
                                                onStyleChange={setMapStyle}
                                                routeMode={routeMode}
                                                onRouteModeChange={isTripLockedByExpiry ? undefined : setRouteMode}
                                                showCityNames={isTripLockedByExpiry ? false : showCityNames}
                                                onShowCityNamesChange={isTripLockedByExpiry ? undefined : setShowCityNames}
                                                mapColorMode={mapColorMode}
                                                onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                                                focusLocationQuery={initialMapFocusQuery}
                                                onRouteMetrics={handleRouteMetrics}
                                                onRouteStatus={handleRouteStatus}
                                                fitToRouteKey={trip.id}
                                                isPaywalled={isTripLockedByExpiry}
                                                viewTransitionName={mapViewTransitionName}
                                            />
                                        </div>
                                        <div className="h-1 bg-gray-100 hover:bg-accent-500 cursor-row-resize transition-colors z-30 flex justify-center items-center group w-full" onMouseDown={() => startResizing('timeline-h')}>
                                            <div className="w-12 h-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div style={{ height: timelineHeight }} className="w-full bg-white border-t border-gray-200 z-20 shrink-0 relative flex flex-row">
                                            <div ref={verticalLayoutTimelineRef} className="flex-1 h-full relative border-r border-gray-100 min-w-0">
                                                <div className="w-full h-full relative min-w-0">
                                                    {timelineView === 'vertical' ? (
                                                        <VerticalTimeline
                                                            trip={displayTrip}
                                                            onUpdateItems={handleUpdateItems}
                                                            onSelect={handleTimelineSelect}
                                                            selectedItemId={selectedItemId}
                                                            selectedCityIds={selectedCityIds}
                                                            readOnly={!canEdit}
                                                            onAddCity={() => { if (!requireEdit()) return; setIsAddCityModalOpen(true); }}
                                                            onAddActivity={handleOpenAddActivity}
                                                            onForceFill={handleForceFill}
                                                            onSwapSelectedCities={handleReverseSelectedCities}
                                                            pixelsPerDay={pixelsPerDay}
                                                            enableExampleSharedTransition={useExampleSharedTransition}
                                                        />
                                                    ) : (
                                                        <Timeline
                                                            trip={displayTrip}
                                                            onUpdateItems={handleUpdateItems}
                                                            onSelect={handleTimelineSelect}
                                                            selectedItemId={selectedItemId}
                                                            selectedCityIds={selectedCityIds}
                                                            readOnly={!canEdit}
                                                            onAddCity={() => { if (!requireEdit()) return; setIsAddCityModalOpen(true); }}
                                                            onAddActivity={handleOpenAddActivity}
                                                            onForceFill={handleForceFill}
                                                            onSwapSelectedCities={handleReverseSelectedCities}
                                                            routeStatusById={routeStatusById}
                                                            pixelsPerDay={pixelsPerDay}
                                                            enableExampleSharedTransition={useExampleSharedTransition}
                                                        />
                                                    )}
                                                    <div className="absolute top-4 right-4 z-40 flex gap-2">
                                                        <div className="flex flex-row gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1">
                                                            <button onClick={() => setZoomLevel(z => clampZoomLevel(z - 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Zoom out timeline"><ZoomOut size={16} /></button>
                                                            <button onClick={() => setZoomLevel(z => clampZoomLevel(z + 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Zoom in timeline"><ZoomIn size={16} /></button>
                                                        </div>
                                                        <div className="flex flex-row gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm p-1 h-fit my-auto">
                                                            <button onClick={() => setTimelineView(v => v === 'horizontal' ? 'vertical' : 'horizontal')} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Toggle timeline view">
                                                                {timelineView === 'horizontal' ? <List size={16} /> : <Calendar size={16} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {detailsPanelVisible && (
                                                <div style={{ width: detailsWidth }} className="h-full bg-white border-l border-gray-200 overflow-hidden relative">
                                                    {showSelectedCitiesPanel ? (
                                                        <SelectedCitiesPanel
                                                            selectedCities={selectedCitiesInTimeline}
                                                            onClose={clearSelection}
                                                            onApplyOrder={applySelectedCityOrder}
                                                            onReverse={handleReverseSelectedCities}
                                                            timelineView={timelineView}
                                                            readOnly={!canEdit}
                                                        />
                                                    ) : (
                                                        <DetailsPanel
                                                            item={displayTrip.items.find(i => i.id === selectedItemId) || null}
                                                            isOpen={!!selectedItemId}
                                                            onClose={clearSelection}
                                                            onUpdate={handleUpdateItem}
                                                            onBatchUpdate={handleBatchItemUpdate}
                                                            onDelete={handleDeleteItem}
                                                            tripStartDate={trip.startDate}
                                                            tripItems={displayTrip.items}
                                                            routeMode={routeMode}
                                                            routeStatus={selectedItemId ? routeStatusById[selectedItemId] : undefined}
                                                            onForceFill={handleForceFill}
                                                            forceFillMode={selectedCityForceFill?.mode}
                                                            forceFillLabel={selectedCityForceFill?.label}
                                                            variant="sidebar"
                                                            readOnly={!canEdit}
                                                            cityColorPaletteId={cityColorPaletteId}
                                                            onCityColorPaletteChange={canEdit ? handleCityColorPaletteChange : undefined}
                                                        />
                                                    )}
                                                    <div
                                                        className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-30 flex items-center justify-center group hover:bg-accent-50/60 transition-colors"
                                                        onMouseDown={(e) => startResizing('details', e.clientX)}
                                                        title="Resize details panel"
                                                    >
                                                        <div className="h-10 w-0.5 rounded-full bg-gray-200 group-hover:bg-accent-400 transition-colors" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {isMobile && (
                        <Drawer
                            open={detailsPanelVisible}
                            onOpenChange={(open) => {
                                if (!open) clearSelection();
                            }}
                            shouldScaleBackground={false}
                            modal={true}
                            dismissible={true}
                        >
                            <DrawerContent className="h-[82vh] p-0" accessibleTitle="Trip details" accessibleDescription="View and edit selected city, travel segment, or activity details.">
                                {showSelectedCitiesPanel ? (
                                    <SelectedCitiesPanel
                                        selectedCities={selectedCitiesInTimeline}
                                        onClose={clearSelection}
                                        onApplyOrder={applySelectedCityOrder}
                                        onReverse={handleReverseSelectedCities}
                                        timelineView={timelineView}
                                        readOnly={!canEdit}
                                    />
                                ) : (
                                    <DetailsPanel
                                        item={displayTrip.items.find(i => i.id === selectedItemId) || null}
                                        isOpen={!!selectedItemId}
                                        onClose={clearSelection}
                                        onUpdate={handleUpdateItem}
                                        onBatchUpdate={handleBatchItemUpdate}
                                        onDelete={handleDeleteItem}
                                        tripStartDate={trip.startDate}
                                        tripItems={displayTrip.items}
                                        routeMode={routeMode}
                                        routeStatus={selectedItemId ? routeStatusById[selectedItemId] : undefined}
                                        onForceFill={handleForceFill}
                                        forceFillMode={selectedCityForceFill?.mode}
                                        forceFillLabel={selectedCityForceFill?.label}
                                        variant="sidebar"
                                        readOnly={!canEdit}
                                        cityColorPaletteId={cityColorPaletteId}
                                        onCityColorPaletteChange={canEdit ? handleCityColorPaletteChange : undefined}
                                    />
                                )}
                            </DrawerContent>
                        </Drawer>
                    )}

                     {/* Modals */}
                     <AddActivityModal 
                         isOpen={addActivityState.isOpen}
                         onClose={() => setAddActivityState({ ...addActivityState, isOpen: false })}
                         dayOffset={addActivityState.dayOffset}
                         location={addActivityState.location}
                         onAdd={handleAddActivityItem}
                         trip={trip}
                         notes="" // TODO
                     />
                     
                     <AddCityModal
                        isOpen={isAddCityModalOpen}
                        onClose={() => setIsAddCityModalOpen(false)}
                        onAdd={(name, lat, lng) => handleAddCityItem({ title: name, coordinates: { lat, lng } })}
                     />

                     {isTripInfoOpen && (
                        <div className="fixed inset-0 z-[1520] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setIsTripInfoOpen(false)}>
                            <div
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="trip-info-title"
                                className="bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[84vh] sm:max-h-[88vh]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 id="trip-info-title" className="text-lg font-bold text-gray-900">Trip information</h3>
                                        <p className="text-xs text-gray-500">Plan details, destination info, and history.</p>
                                    </div>
                                    <button onClick={() => setIsTripInfoOpen(false)} className="px-2 py-1 rounded text-xs font-semibold text-gray-500 hover:bg-gray-100">
                                        Close
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <section className="border border-gray-200 rounded-xl p-3 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                {isEditingTitle ? (
                                                    <input
                                                        value={editTitleValue}
                                                        onChange={(e) => setEditTitleValue(e.target.value)}
                                                        onBlur={handleCommitTitleEdit}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleCommitTitleEdit();
                                                        }}
                                                        autoFocus
                                                        className="w-full font-bold text-lg text-gray-900 bg-transparent border-b-2 border-accent-500 outline-none pb-0.5"
                                                    />
                                                ) : (
                                                    <h4 className="text-lg font-bold text-gray-900 break-words">{trip.title}</h4>
                                                )}
                                            </div>
                                            {canManageTripMetadata && (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={handleStartTitleEdit}
                                                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Edit title"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleToggleFavorite}
                                                        disabled={!canEdit}
                                                        className={`p-2 rounded-lg transition-colors ${canEdit ? 'hover:bg-amber-50' : 'opacity-50 cursor-not-allowed'}`}
                                                        title={trip.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                                        aria-label={trip.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                                    >
                                                        <Star
                                                            size={16}
                                                            className={trip.isFavorite ? 'text-amber-500 fill-amber-400' : 'text-gray-300 hover:text-amber-500'}
                                                        />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {!canManageTripMetadata && (
                                            <p className="text-xs text-gray-500">
                                                {isExamplePreview
                                                    ? 'Example trips cannot be renamed or favorited. Copy this trip first to make it your own.'
                                                    : 'Edit and favorite actions are unavailable for shared trips.'}
                                            </p>
                                        )}
                                    </section>

                                    <section className="border border-gray-200 rounded-xl p-3">
                                        <h4 className="text-sm font-semibold text-gray-800 mb-2">Trip meta</h4>
                                        <dl className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                                <dt className="text-gray-500">Duration</dt>
                                                <dd className="mt-1 font-semibold text-gray-900">{tripMeta.dateRange}</dd>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                                <dt className="text-gray-500">Total days</dt>
                                                <dd className="mt-1 font-semibold text-gray-900">{tripMeta.totalDaysLabel} days</dd>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                                <dt className="text-gray-500">Cities</dt>
                                                <dd className="mt-1 font-semibold text-gray-900">{tripMeta.cityCount}</dd>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                                <dt className="text-gray-500">Total distance</dt>
                                                <dd className="mt-1 font-semibold text-gray-900">{tripMeta.distanceLabel || '—'}</dd>
                                            </div>
                                        </dl>
                                    </section>

                                    {displayTrip.aiMeta && (
                                        <section className="border border-gray-200 rounded-xl p-3">
                                            <h4 className="text-sm font-semibold text-gray-800 mb-2">AI generation</h4>
                                            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                                <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                                    <dt className="text-gray-500">Provider</dt>
                                                    <dd className="mt-1 font-semibold text-gray-900">{displayTrip.aiMeta.provider}</dd>
                                                </div>
                                                <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
                                                    <dt className="text-gray-500">Model</dt>
                                                    <dd className="mt-1 font-semibold text-gray-900 break-all">{displayTrip.aiMeta.model}</dd>
                                                </div>
                                                <div className="rounded-lg bg-gray-50 border border-gray-100 p-2 sm:col-span-2">
                                                    <dt className="text-gray-500">Generated at</dt>
                                                    <dd className="mt-1 font-semibold text-gray-900">
                                                        {displayTrip.aiMeta.generatedAt
                                                            ? new Date(displayTrip.aiMeta.generatedAt).toLocaleString()
                                                            : '—'}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </section>
                                    )}

                                    {forkMeta && (
                                        <section className="rounded-xl border border-accent-100 bg-gradient-to-br from-accent-50 to-white p-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Trip source</p>
                                            <p className="mt-1 text-sm font-semibold text-gray-900">{forkMeta.label}</p>
                                            <p className="mt-1 text-xs text-gray-600">
                                                {forkMeta.url
                                                    ? 'This itinerary was copied from a shared trip snapshot.'
                                                    : 'This itinerary was copied from another trip in your workspace.'}
                                            </p>
                                            {forkMeta.url && (
                                                <a href={forkMeta.url} className="inline-flex mt-2 text-xs font-semibold text-accent-700 hover:underline">
                                                    View source
                                                </a>
                                            )}
                                        </section>
                                    )}

                                    <section className="border border-gray-200 rounded-xl p-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsTripInfoHistoryExpanded(v => !v)}
                                            className="w-full flex items-center justify-between text-sm font-semibold text-gray-800"
                                        >
                                            <span>History</span>
                                            {isTripInfoHistoryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                        {isTripInfoHistoryExpanded && (
                                            <div className="mt-3 space-y-3">
                                                {isExamplePreview ? (
                                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                                        Example trips do not save history snapshots. Copy this trip first to keep edits and track changes.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => navigateHistory('undo')}
                                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                                            >
                                                                Undo
                                                            </button>
                                                            <button
                                                                onClick={() => navigateHistory('redo')}
                                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                                            >
                                                                Redo
                                                            </button>
                                                            <button
                                                                onClick={() => setShowAllHistory(v => !v)}
                                                                className="ml-auto px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                                            >
                                                                {showAllHistory ? 'Show Recent' : 'Show All'}
                                                            </button>
                                                        </div>
                                                        <div className="rounded-lg border border-gray-100 overflow-hidden">
                                                            {infoHistoryEntries.length === 0 ? (
                                                                <div className="p-4 text-xs text-gray-500">No history entries yet.</div>
                                                            ) : (
                                                                <ul className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                                                                    {infoHistoryEntries.map(entry => {
                                                                        const isCurrent = entry.url === currentUrl;
                                                                        const details = stripHistoryPrefix(entry.label);
                                                                        return (
                                                                            <li key={entry.id} className={`p-3 flex items-start gap-2 ${isCurrent ? 'bg-accent-50/70' : 'bg-white'}`}>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="text-[11px] text-gray-500">{formatHistoryTime(entry.ts)}</div>
                                                                                    <div className="text-xs font-semibold text-gray-900 leading-snug">{details}</div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setIsTripInfoOpen(false);
                                                                                        suppressCommitRef.current = true;
                                                                                        navigate(entry.url);
                                                                                    }}
                                                                                    className="px-2 py-1 rounded-md border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                                                                >
                                                                                    Go
                                                                                </button>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsTripInfoOpen(false);
                                                                setIsHistoryOpen(true);
                                                            }}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            Open full history
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </section>

                                    <section className="border border-gray-200 rounded-xl p-3">
                                        {displayTrip.countryInfo ? (
                                            <CountryInfo info={displayTrip.countryInfo} />
                                        ) : isTripLockedByExpiry ? (
                                            <div className="text-xs text-gray-500">Destination details are hidden until this trip is activated.</div>
                                        ) : (
                                            <div className="text-xs text-gray-500">No destination info available for this trip yet.</div>
                                        )}
                                    </section>
                                </div>
                            </div>
                        </div>
                     )}

                     {showReleaseNotice && latestInAppRelease && (
                        <div className="fixed inset-0 z-[1650] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="release-update-title">
                            <button
                                type="button"
                                className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
                                aria-label="Close release update"
                                onClick={dismissReleaseNotice}
                            />
                            <div className="relative w-full max-w-lg rounded-3xl border border-accent-100 bg-white shadow-2xl">
                                <div className="rounded-t-3xl border-b border-slate-100 bg-gradient-to-r from-accent-50 to-accent-100 px-6 py-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">
                                        Latest release · {latestInAppRelease.version}
                                    </p>
                                    <h2 id="release-update-title" className="mt-2 text-xl font-black text-slate-900">
                                        {latestInAppRelease.title}
                                    </h2>
                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {new Date(latestInAppRelease.publishedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="px-6 py-5">
                                    {latestInAppRelease.summary && (
                                        <div className="text-sm leading-6 text-slate-700">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => <p {...props} className="m-0" />,
                                                    a: ({ node, ...props }) => (
                                                        <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800" />
                                                    ),
                                                    code: ({ node, ...props }) => (
                                                        <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-800" />
                                                    ),
                                                }}
                                            >
                                                {latestInAppRelease.summary}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                    {latestReleaseGroups.length > 0 && (
                                        <div className="mt-3 space-y-3">
                                            {latestReleaseGroups.map((group, groupIndex) => (
                                                <div key={`${latestInAppRelease.id}-notice-group-${group.typeKey}-${group.typeLabel}-${groupIndex}`}>
                                                    <ReleasePill item={group.items[0]} />
                                                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700 marker:text-slate-400">
                                                        {group.items.map((item, itemIndex) => (
                                                            <li key={`${latestInAppRelease.id}-notice-item-${group.typeKey}-${group.typeLabel}-${itemIndex}`}>
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkGfm]}
                                                                    components={{
                                                                        p: ({ node, ...props }) => <p {...props} className="m-0" />,
                                                                        a: ({ node, ...props }) => (
                                                                            <a {...props} className="text-accent-700 underline decoration-accent-300 underline-offset-2 hover:text-accent-800" />
                                                                        ),
                                                                        code: ({ node, ...props }) => (
                                                                            <code {...props} className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-800" />
                                                                        ),
                                                                    }}
                                                                >
                                                                    {item.text}
                                                                </ReactMarkdown>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
                                    <Link
                                        to="/updates"
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                                    >
                                        View full changelog
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={dismissReleaseNotice}
                                        className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                     )}

                     {isShareOpen && (
                        <div className="fixed inset-0 z-[1600] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setIsShareOpen(false)}>
                            <div className="bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Share trip</h3>
                                        <p className="text-xs text-gray-500">Choose view-only or collaboration editing.</p>
                                    </div>
                                    <button onClick={() => setIsShareOpen(false)} className="px-2 py-1 rounded text-xs font-semibold text-gray-500 hover:bg-gray-100">
                                        Close
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                                        <input
                                            type="radio"
                                            name="share-mode"
                                            className="mt-1"
                                            checked={shareMode === 'view'}
                                            onChange={() => setShareMode('view')}
                                        />
                                        <span>
                                            <span className="font-semibold text-gray-900">View only</span>
                                            <span className="block text-xs text-gray-500">People can see the trip but can’t edit.</span>
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                                        <input
                                            type="radio"
                                            name="share-mode"
                                            className="mt-1"
                                            checked={shareMode === 'edit'}
                                            onChange={() => setShareMode('edit')}
                                        />
                                        <span>
                                            <span className="font-semibold text-gray-900">Allow editing</span>
                                            <span className="block text-xs text-gray-500">Anyone with the link can make changes.</span>
                                        </span>
                                    </label>
                                    {activeShareUrl && (
                                        <div className="mt-2">
                                            <div className="text-xs font-semibold text-gray-600 mb-1">Share link</div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={activeShareUrl}
                                                    readOnly
                                                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleCopyShareLink}
                                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => setIsShareOpen(false)}
                                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleGenerateShare}
                                        disabled={isGeneratingShare}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${isGeneratingShare ? 'bg-accent-300' : 'bg-accent-600 hover:bg-accent-700'}`}
                                    >
                                        {isGeneratingShare ? 'Creating…' : (activeShareUrl ? 'Create new link' : 'Generate link')}
                                    </button>
                                </div>
                            </div>
                        </div>
                     )}

                    {/* History Panel */}
                    {isHistoryOpen && (
                        <div className="fixed inset-0 z-[1500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsHistoryOpen(false)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">Change History</h3>
                                        <p className="text-xs text-gray-500">
                                            {isExamplePreview
                                                ? 'Example trips are editable for exploration, but changes are not saved.'
                                                : 'Undo/redo works with browser history and Cmd+Z / Cmd+Y.'}
                                        </p>
                                    </div>
                                    <button onClick={() => setIsHistoryOpen(false)} className="px-2 py-1 rounded text-xs font-semibold text-gray-500 hover:bg-gray-100">
                                        Close
                                    </button>
                                </div>
                                {isExamplePreview ? (
                                    <div className="p-5 text-sm text-slate-600">
                                        This example trip is a playground. History snapshots are intentionally disabled so no local or database state is created while exploring.
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    navigateHistory('undo');
                                                }}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                            >
                                                Undo
                                            </button>
                                            <button
                                                onClick={() => {
                                                    navigateHistory('redo');
                                                }}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                            >
                                                Redo
                                            </button>
                                            <button
                                                onClick={() => setShowAllHistory(v => !v)}
                                                className="ml-auto px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                                            >
                                                {showAllHistory ? 'Show Recent' : 'Show All'}
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto">
                                            {displayHistoryEntries.length === 0 ? (
                                                <div className="p-6 text-sm text-gray-500">No history entries yet.</div>
                                            ) : (
                                                <ul className="divide-y divide-gray-100">
                                                    {displayHistoryEntries.map(entry => {
                                                        const isCurrent = entry.url === currentUrl;
                                                        const tone = resolveChangeTone(entry.label);
                                                        const details = stripHistoryPrefix(entry.label);
                                                        const meta = getToneMeta(tone);
                                                        const Icon = meta.Icon;
                                                        return (
                                                            <li key={entry.id} className={`p-4 flex items-start gap-3 ${isCurrent ? 'bg-accent-50/70' : 'hover:bg-gray-50/80'}`}>
                                                                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${meta.iconClass}`}>
                                                                    <Icon size={15} />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.badgeClass}`}>{meta.label}</span>
                                                                        <span className="text-xs text-gray-500">{formatHistoryTime(entry.ts)}</span>
                                                                        {isCurrent && <span className="text-[10px] font-semibold text-accent-600 bg-accent-100 px-2 py-0.5 rounded-full">Current</span>}
                                                                    </div>
                                                                    <div className="mt-1 text-sm font-semibold text-gray-900 leading-snug">{details}</div>
                                                                </div>
                                                                <div className="shrink-0">
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsHistoryOpen(false);
                                                                            lastNavActionRef.current = null;
                                                                            suppressCommitRef.current = true;
                                                                            navigate(entry.url);
                                                                            showToast(details, { tone, title: 'Opened from history' });
                                                                        }}
                                                                        className="px-2 py-1 rounded-md border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                                                    >
                                                                        Go
                                                                    </button>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {shareStatus === 'view' && onCopyTrip && (
                        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[1400]">
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/95 backdrop-blur px-4 py-3 shadow-lg text-amber-900 text-sm">
                                <div className="font-semibold">View-only trip</div>
                                <div className="text-xs text-amber-800 mt-1">
                                    You can change visual settings, but edits to the itinerary are disabled.
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <span className="text-[11px] text-amber-700">Copy to edit your own version.</span>
                                    <button
                                        type="button"
                                        onClick={onCopyTrip}
                                        className="px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-300"
                                    >
                                        Copy trip
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isTripLockedByExpiry && (
                        <div className="fixed inset-0 z-[1490] flex items-end sm:items-center justify-center p-3 sm:p-4 pointer-events-none">
                            <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-gradient-to-br from-accent-200/60 via-rose-100/70 to-amber-100/80 p-[1px] shadow-2xl">
                                <div className="relative overflow-hidden rounded-[15px] border border-white/70 bg-white/95 px-5 py-5 backdrop-blur">
                                    <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent-200/40 blur-2xl" />
                                    <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-rose-100/70 blur-2xl" />

                                    <div className="relative flex items-start gap-3.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-700">Trip preview paused</p>
                                            <div className="mt-1 text-lg font-semibold leading-tight text-slate-900">
                                                Keep this plan alive and unlock every detail
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                                Continue where you left off with a free TravelFlow account.
                                                You will regain full editing, destination names, and map routing instantly.
                                            </p>
                                        </div>
                                        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent-200 bg-accent-50 text-accent-700">
                                            <WarningCircle size={20} weight="duotone" />
                                        </span>
                                    </div>
                                    <div className="relative mt-4 flex flex-wrap justify-end gap-2">
                                        <Link
                                            to="/faq"
                                            onClick={() => trackEvent('trip_paywall__overlay--faq', { trip_id: trip.id })}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-accent-200 bg-white px-3 text-xs font-semibold text-accent-700 hover:bg-accent-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                        >
                                            <Article size={14} weight="duotone" />
                                            Visit FAQ
                                        </Link>
                                        <Link
                                            to="/login"
                                            onClick={(event) => handlePaywallLoginClick(event, 'trip_paywall__overlay--activate', 'trip_paywall_overlay')}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent-600 px-3 text-xs font-semibold text-white hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                                        >
                                            <RocketLaunch size={14} weight="duotone" />
                                            Reactivate trip
                                        </Link>
                                    </div>

                                    <div className="relative mt-4 border-t border-slate-200 pt-3">
                                        <p className="text-[11px] leading-relaxed text-slate-500">
                                            {expirationLabel ? `Expired on ${expirationLabel}. ` : ''}
                                            Preview mode stays visible, while advanced planning controls unlock after activation.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {showGenerationOverlay && (
                        <div className="pointer-events-none absolute inset-0 z-[1800] flex items-center justify-center p-4 sm:p-6">
                            <div className="w-full max-w-xl rounded-2xl border border-accent-100 bg-white/95 shadow-xl backdrop-blur-sm px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center shrink-0">
                                        <Loader2 size={18} className="animate-spin" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-accent-900 truncate">Planning your trip</div>
                                        <div className="text-xs text-gray-600 truncate">{generationProgressMessage}</div>
                                    </div>
                                </div>
                                <div className="mt-3 text-xs text-gray-500">
                                    {loadingDestinationSummary} • {tripMeta.dateRange} • {tripMeta.totalDaysLabel} days
                                </div>
                                <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full w-1/2 bg-gradient-to-r from-accent-500 to-accent-600 animate-pulse rounded-full" />
                                </div>
                            </div>
                        </div>
                    )}

                     {/* Toast */}
                     {!suppressToasts && toastState && activeToastMeta && (
                        <div className={`fixed bottom-6 right-6 z-[1600] w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border bg-white/95 shadow-2xl backdrop-blur px-4 py-3 ${activeToastMeta.toastBorderClass}`}>
                            <div className="flex items-start gap-3">
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${activeToastMeta.iconClass}`}>
                                    <activeToastMeta.Icon size={16} />
                                </div>
                                <div className="min-w-0">
                                    <div className={`text-[11px] uppercase tracking-[0.08em] font-semibold ${activeToastMeta.toastTitleClass}`}>{toastState.title}</div>
                                    <div className="text-sm font-semibold text-gray-900 leading-snug">{toastState.message}</div>
                                </div>
                                <button
                                    onClick={() => setToastState(null)}
                                    className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                                    aria-label="Dismiss notification"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                     )}

                </main>
            </div>
        </GoogleMapsLoader>
    );
};
