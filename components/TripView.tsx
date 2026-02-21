import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLanguage, ITrip, ITimelineItem, MapColorMode, RouteStatus, IViewSettings, ShareMode } from '../types';
import { GoogleMapsLoader } from './GoogleMapsLoader';
import {
    Calendar, List,
    ZoomIn, ZoomOut
} from 'lucide-react';
import { BASE_PIXELS_PER_DAY, DEFAULT_CITY_COLOR_PALETTE_ID, DEFAULT_DISTANCE_UNIT, applyCityPaletteToItems, buildRouteCacheKey, buildShareUrl, formatDistance, getActivityColorByTypes, getTimelineBounds, getTravelLegMetricsForItem, getTripDistanceKm, isInternalMapColorModeControlEnabled, normalizeActivityTypes, normalizeCityColors, normalizeMapColorMode, reorderSelectedCities } from '../utils';
import { normalizeTransportMode } from '../shared/transportModes';
import { getExampleMapViewTransitionName, getExampleTitleViewTransitionName } from '../shared/viewTransitionNames';
import {
    dbCreateShareLink,
    dbGetTrip,
    dbListTripShares,
    dbUpsertTrip,
    ensureDbSession,
    type DbTripAccessMetadata,
} from '../services/dbApi';
import { DB_ENABLED } from '../config/db';
import {
    buildPaywalledTripDisplay,
} from '../config/paywall';
import { trackEvent } from '../services/analyticsService';
import { useLoginModal } from '../hooks/useLoginModal';
import { buildPathFromLocationParts } from '../services/authNavigationService';
import { useAuth } from '../hooks/useAuth';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useDeferredMapBootstrap } from './tripview/useDeferredMapBootstrap';
import { useGenerationProgressMessage } from './tripview/useGenerationProgressMessage';
import { useReleaseNoticeReady } from './tripview/useReleaseNoticeReady';
import { useTripExpiryLifecycle } from './tripview/useTripExpiryLifecycle';
import { useTripHeaderAuthAction } from './tripview/useTripHeaderAuthAction';
import { useTripOverlayController } from './tripview/useTripOverlayController';
import { useTripHistoryController } from './tripview/useTripHistoryController';
import { useTripShareLifecycle } from './tripview/useTripShareLifecycle';
import { useTripViewSettingsSync } from './tripview/useTripViewSettingsSync';
import { useTripAdminOverrideState } from './tripview/useTripAdminOverrideState';
import { useTripEditModalState } from './tripview/useTripEditModalState';
import { useTripLayoutControlsState } from './tripview/useTripLayoutControlsState';
import {
    ChangeTone,
    getToneMeta,
    stripHistoryPrefix,
    useTripHistoryPresentation,
} from './tripview/useTripHistoryPresentation';
import { TripTimelineCanvas } from './tripview/TripTimelineCanvas';
import { TripViewHeader } from './tripview/TripViewHeader';
import { TripViewHudOverlays } from './tripview/TripViewHudOverlays';
import { TripViewStatusBanners } from './tripview/TripViewStatusBanners';

interface ToastState {
    tone: ChangeTone;
    title: string;
    message: string;
}

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const ReleaseNoticeDialog = lazyWithRecovery('ReleaseNoticeDialog', () =>
    import('./ReleaseNoticeDialog').then((module) => ({ default: module.ReleaseNoticeDialog }))
);

const PrintLayout = lazyWithRecovery('PrintLayout', () =>
    import('./PrintLayout').then((module) => ({ default: module.PrintLayout }))
);

const DetailsPanel = lazyWithRecovery('DetailsPanel', () =>
    import('./DetailsPanel').then((module) => ({ default: module.DetailsPanel }))
);

const SelectedCitiesPanel = lazyWithRecovery('SelectedCitiesPanel', () =>
    import('./SelectedCitiesPanel').then((module) => ({ default: module.SelectedCitiesPanel }))
);

const TripDetailsDrawer = lazyWithRecovery('TripDetailsDrawer', () =>
    import('./TripDetailsDrawer').then((module) => ({ default: module.TripDetailsDrawer }))
);

const AddActivityModal = lazyWithRecovery('AddActivityModal', () =>
    import('./AddActivityModal').then((module) => ({ default: module.AddActivityModal }))
);

const AddCityModal = lazyWithRecovery('AddCityModal', () =>
    import('./AddCityModal').then((module) => ({ default: module.AddCityModal }))
);

const TripShareModal = lazyWithRecovery('TripShareModal', () =>
    import('./TripShareModal').then((module) => ({ default: module.TripShareModal }))
);

const TripHistoryModal = lazyWithRecovery('TripHistoryModal', () =>
    import('./TripHistoryModal').then((module) => ({ default: module.TripHistoryModal }))
);

let tripInfoModalModulePromise: Promise<{ default: React.ComponentType<any> }> | null = null;

const loadTripInfoModalModule = (): Promise<{ default: React.ComponentType<any> }> => {
    if (!tripInfoModalModulePromise) {
        tripInfoModalModulePromise = import('./TripInfoModal').then((module) => ({ default: module.TripInfoModal }));
    }
    return tripInfoModalModulePromise;
};

const TripInfoModal = lazyWithRecovery('TripInfoModal', () => loadTripInfoModalModule());

const ItineraryMap = lazyWithRecovery('ItineraryMap', () =>
    import('./ItineraryMap').then((module) => ({ default: module.ItineraryMap }))
);

const MIN_SIDEBAR_WIDTH = 300;
const MIN_TIMELINE_HEIGHT = 200;
const MIN_BOTTOM_MAP_HEIGHT = 200;
const MIN_MAP_WIDTH = 320;
const MIN_TIMELINE_COLUMN_WIDTH = 420;
const MIN_DETAILS_WIDTH = 360;
const HARD_MIN_DETAILS_WIDTH = 260;
const DEFAULT_DETAILS_WIDTH = 440;
const RESIZE_KEYBOARD_STEP = 16;
const RESIZER_WIDTH = 4;
const MIN_ZOOM_LEVEL = 0.2;
const MAX_ZOOM_LEVEL = 3;
const HORIZONTAL_TIMELINE_AUTO_FIT_PADDING = 72;
const NEGATIVE_OFFSET_EPSILON = 0.001;
const MOBILE_VIEWPORT_MAX_WIDTH = 767;
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

const isPlainLeftClick = (event: React.MouseEvent<HTMLAnchorElement>): boolean => (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
);

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

const getPinchDistance = (touches: React.TouchList): number | null => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
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
    onCommitState?: (updatedTrip: ITrip, view: IViewSettings, options?: { replace?: boolean; label?: string; adminOverride?: boolean }) => void;
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
    adminAccess?: DbTripAccessMetadata;
    exampleTripBanner?: {
        title: string;
        countries: string[];
        onCreateSimilarTrip?: () => void;
    };
}

interface ExampleTransitionLocationState {
    useExampleSharedTransition?: boolean;
}

const MapLoadingFallback: React.FC = () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100 text-xs text-gray-500">
        Loading map...
    </div>
);

const MapDeferredFallback: React.FC<{ onLoadNow: () => void }> = ({ onLoadNow }) => (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-gray-100 text-xs text-gray-500">
        <span>Preparing map...</span>
        <button
            type="button"
            onClick={onLoadNow}
            className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
        >
            Load map now
        </button>
    </div>
);

const TRIP_INFO_FALLBACK_ROWS = [0, 1, 2];

const TripInfoModalLoadingFallback: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useFocusTrap({
        isActive: true,
        containerRef: dialogRef,
        initialFocusRef: closeButtonRef,
    });

    return (
        <>
            <button
                type="button"
                className="fixed inset-0 z-[1520] bg-black/40 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="trip-info-loading-title"
                className="fixed inset-0 z-[1521] pointer-events-none flex items-end sm:items-center justify-center p-3 sm:p-4"
            >
                <div ref={dialogRef} className="pointer-events-auto bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[84vh] sm:max-h-[88vh]">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 id="trip-info-loading-title" className="text-lg font-bold text-gray-900">Trip information</h3>
                            <p className="text-xs text-gray-500">Plan details, destination info, and history.</p>
                        </div>
                        <button ref={closeButtonRef} type="button" onClick={onClose} className="px-2 py-1 rounded text-xs font-semibold text-gray-500 hover:bg-gray-100">
                            Close
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="rounded-xl border border-gray-200 p-3 space-y-2 animate-pulse">
                            <div className="h-5 w-44 rounded bg-gray-200" />
                            <div className="h-3 w-64 rounded bg-gray-100" />
                        </div>
                        <div className="rounded-xl border border-gray-200 p-3 space-y-3 animate-pulse">
                            <div className="h-4 w-28 rounded bg-gray-200" />
                            <div className="grid grid-cols-2 gap-2">
                                {TRIP_INFO_FALLBACK_ROWS.map((row) => (
                                    <div key={`trip-info-fallback-${row}`} className="h-14 rounded-lg bg-gray-100 border border-gray-100" />
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-3 space-y-2 animate-pulse">
                            <div className="h-4 w-20 rounded bg-gray-200" />
                            <div className="h-10 rounded bg-gray-100 border border-gray-100" />
                            <div className="h-10 rounded bg-gray-100 border border-gray-100" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

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
    adminAccess,
    exampleTripBanner,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { openLoginModal } = useLoginModal();
    const { isAuthenticated, isAnonymous, isAdmin, logout } = useAuth();
    const isTripDetailRoute = location.pathname.startsWith('/trip/');
    const locationState = location.state as ExampleTransitionLocationState | null;
    const useExampleSharedTransition = trip.isExample && (locationState?.useExampleSharedTransition ?? true);
    const mapViewTransitionName = getExampleMapViewTransitionName(useExampleSharedTransition);
    const titleViewTransitionName = getExampleTitleViewTransitionName(useExampleSharedTransition);
    const tripRef = useRef(trip);
    tripRef.current = trip;
    const isReleaseNoticeReady = useReleaseNoticeReady({ suppressReleaseNotice });
    const {
        tripExpiresAtMs,
        lifecycleState,
        isTripLockedByExpiry,
        expirationLabel,
        expirationRelativeLabel,
    } = useTripExpiryLifecycle({
        trip,
        isTripDetailRoute,
    });
    const isAdminFallbackView = adminAccess?.source === 'admin_fallback';
    const { adminOverrideEnabled, setAdminOverrideEnabled } = useTripAdminOverrideState();
    const isTripLockedByArchive = (trip.status || 'active') === 'archived';
    const isPaywallLocked = isTripLockedByExpiry && !isAdminFallbackView;
    const effectiveReadOnly = readOnly || (isAdminFallbackView && !adminOverrideEnabled);
    const canEdit = !effectiveReadOnly && !isTripLockedByExpiry && !isTripLockedByArchive;
    const displayTrip = useMemo(
        () => (isPaywallLocked ? buildPaywalledTripDisplay(trip) : trip),
        [isPaywallLocked, trip]
    );
    const hasLoadingItems = useMemo(
        () => displayTrip.items.some((item) => item.loading),
        [displayTrip.items]
    );
    const expectedCityLaneCount = displayTrip.items.filter((item) => item.type === 'city').length;
    const canEnableAdminOverride = isAdminFallbackView && Boolean(adminAccess?.canAdminWrite);
    const ownerUsersUrl = useMemo(() => {
        if (!isAdminFallbackView || !adminAccess?.ownerId) return null;
        return `/admin/trips?user=${encodeURIComponent(adminAccess.ownerId)}&drawer=user`;
    }, [adminAccess?.ownerId, isAdminFallbackView]);

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

    const {
        canUseAuthenticatedSession,
        isHeaderAuthSubmitting,
        handleHeaderAuthAction,
    } = useTripHeaderAuthAction({
        tripId: trip.id,
        isAuthenticated,
        isAnonymous,
        logout,
        openLoginModal,
        locationPathname: location.pathname,
        locationSearch: location.search,
        locationHash: location.hash,
    });
    const prewarmTripInfoModal = useCallback(() => {
        void loadTripInfoModalModule().catch(() => undefined);
    }, []);

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

    const [toastState, setToastState] = useState<ToastState | null>(null);
    const [isMobileViewport, setIsMobileViewport] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH;
    });
    const currentUrl = location.pathname + location.search;
    const {
        isHistoryOpen,
        setIsHistoryOpen,
        isTripInfoOpen,
        isTripInfoHistoryExpanded,
        setIsTripInfoHistoryExpanded,
        isMobileMapExpanded,
        setIsMobileMapExpanded,
        openTripInfoModal,
        closeTripInfoModal,
    } = useTripOverlayController({
        tripId: trip.id,
        isMobileViewport,
        prewarmTripInfoModal,
    });
    const editTitleInputRef = useRef<HTMLInputElement | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingHistoryLabelRef = useRef<string | null>(null);
    const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingCommitRef = useRef<{ trip: ITrip; view: IViewSettings } | null>(null);
    const suppressCommitRef = useRef(false);
    const skipViewDiffRef = useRef(false);
    const appliedViewKeyRef = useRef<string | null>(null);
    const prevViewRef = useRef<IViewSettings | null>(null);
    const {
        layoutMode,
        setLayoutMode,
        timelineView,
        setTimelineView,
        mapStyle,
        setMapStyle,
        routeMode,
        setRouteMode,
        showCityNames,
        setShowCityNames,
        zoomLevel,
        setZoomLevel,
        sidebarWidth,
        setSidebarWidth,
        timelineHeight,
        setTimelineHeight,
        detailsWidth,
        setDetailsWidth,
    } = useTripLayoutControlsState({
        initialViewSettings,
        defaultDetailsWidth: DEFAULT_DETAILS_WIDTH,
    });
    const verticalLayoutTimelineRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef<'sidebar' | 'details' | 'timeline-h' | null>(null);
    const detailsResizeStartXRef = useRef(0);
    const detailsResizeStartWidthRef = useRef(detailsWidth);
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
        if (isTripLockedByArchive) {
            showToast('Archived trips stay read-only. Unarchive in Admin Trips first.', { tone: 'neutral', title: 'Archived trip' });
            return false;
        }
        if (isTripLockedByExpiry) {
            if (isAdminFallbackView) {
                showToast('Expired trips stay read-only in admin override mode.', { tone: 'neutral', title: 'Expired trip' });
                return false;
            }
            showToast('Trip expired. Activate with an account to edit again.', { tone: 'neutral', title: 'Expired trip' });
            return false;
        }
        if (canEdit) return true;
        if (isAdminFallbackView && !adminOverrideEnabled) {
            showToast('Admin read-only mode is active. Enable override to edit.', { tone: 'neutral', title: 'Read only' });
            return false;
        }
        showToast('View-only link. Copy the trip to edit.', { tone: 'neutral', title: 'View only' });
        return false;
    }, [adminOverrideEnabled, canEdit, isAdminFallbackView, isTripLockedByArchive, isTripLockedByExpiry, showToast]);

    const safeUpdateTrip = useCallback((updatedTrip: ITrip, options?: { persist?: boolean }) => {
        if (!requireEdit()) return;
        onUpdateTrip(updatedTrip, options);
    }, [onUpdateTrip, requireEdit]);

    const showSavedToastForLabel = useCallback((label: string) => {
        const tone = resolveChangeTone(label);
        const { label: actionLabel } = getToneMeta(tone);
        showToast(stripHistoryPrefix(label), { tone, title: `Saved · ${actionLabel}` });
    }, [showToast]);
    const {
        showAllHistory,
        setShowAllHistory,
        refreshHistory,
        navigateHistory,
        formatHistoryTime,
        displayHistoryEntries,
    } = useTripHistoryController({
        tripId: trip.id,
        tripUpdatedAt: typeof trip.updatedAt === 'number' ? trip.updatedAt : undefined,
        locationPathname: location.pathname,
        currentUrl,
        isExamplePreview,
        navigate,
        suppressCommitRef,
        stripHistoryPrefix,
        showToast,
    });

    const setPendingLabel = useCallback((label: string) => {
        pendingHistoryLabelRef.current = label;
    }, []);

    const markUserEdit = useCallback(() => {
        suppressCommitRef.current = false;
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

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState('');
    const {
        addActivityState,
        setAddActivityState,
        isAddCityModalOpen,
        setIsAddCityModalOpen,
    } = useTripEditModalState();

    const {
        isShareOpen,
        setIsShareOpen,
        shareMode,
        setShareMode,
        shareUrlsByMode,
        setShareUrlsByMode,
        isGeneratingShare,
        setIsGeneratingShare,
    } = useTripShareLifecycle({
        tripId: trip.id,
        canShare,
        isTripLockedByExpiry,
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.removeItem('tf_country_info_expanded');
        } catch {
            // ignore storage issues
        }
    }, []);

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

    useTripViewSettingsSync({
        layoutMode,
        timelineView,
        mapStyle,
        routeMode,
        showCityNames,
        zoomLevel,
        sidebarWidth,
        timelineHeight,
        viewMode,
        onViewSettingsChange,
        initialViewSettings,
        currentViewSettings,
        setMapStyle,
        setRouteMode,
        setLayoutMode,
        setTimelineView,
        setZoomLevel,
        setSidebarWidth,
        setTimelineHeight,
        setShowCityNames,
        suppressCommitRef,
        skipViewDiffRef,
        appliedViewKeyRef,
        prevViewRef,
    });

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
    const isLoadingPreview = hasLoadingItems;
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
    const showGenerationOverlay = isTripDetailRoute
        && isLoadingPreview
        && !isAdminFallbackView
        && !isTripLockedByExpiry
        && !isTripLockedByArchive
        && (trip.status || 'active') === 'active';
    const generationProgressMessage = useGenerationProgressMessage({
        isActive: showGenerationOverlay,
        messages: GENERATION_PROGRESS_MESSAGES,
    });
    const shouldEnableReleaseNotice = isReleaseNoticeReady
        && !suppressReleaseNotice
        && !isAdmin
        && !isAdminFallbackView
        && !showGenerationOverlay;

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

    const {
        historyModalItems,
        openHistoryPanel,
        tripInfoHistoryItems,
    } = useTripHistoryPresentation({
        currentUrl,
        displayHistoryEntries,
        refreshHistory,
        setIsHistoryOpen,
        showAllHistory,
        trackOpenHistory: (source) => trackEvent('app__trip_history--open', { source }),
    });

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
            onCommitState(payload.trip, payload.view, {
                replace: false,
                label,
                adminOverride: isAdminFallbackView && adminOverrideEnabled,
            });
            pendingHistoryLabelRef.current = null;
            refreshHistory();
            showSavedToastForLabel(label);
            if (typeof window !== 'undefined') {
                (window as any).__tfLastCommit = { label, ts: Date.now() };
                const hook = (window as any).__tfOnCommit;
                if (typeof hook === 'function') hook({ label, ts: Date.now() });
            }
        }, commitDelay);
    }, [
        adminOverrideEnabled,
        canEdit,
        currentViewSettings,
        debugHistory,
        isAdminFallbackView,
        isExamplePreview,
        onCommitState,
        refreshHistory,
        showSavedToastForLabel,
        trip,
    ]);

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
    const handleOpenAddCity = useCallback(() => {
        if (!requireEdit()) return;
        setIsAddCityModalOpen(true);
    }, [requireEdit]);

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

    const handleSidebarResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const reservedForDetails = detailsPanelVisible ? detailsWidth : 0;
        const maxSidebar = window.innerWidth - reservedForDetails - MIN_MAP_WIDTH - (RESIZER_WIDTH * 2);
        const boundedMax = Math.max(MIN_SIDEBAR_WIDTH, maxSidebar);
        setSidebarWidth((prev) => Math.max(MIN_SIDEBAR_WIDTH, Math.min(boundedMax, prev + (direction * RESIZE_KEYBOARD_STEP))));
    }, [detailsPanelVisible, detailsWidth]);

    const handleDetailsResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setDetailsWidth((prev) => clampDetailsWidth(prev + (direction * RESIZE_KEYBOARD_STEP)));
    }, [clampDetailsWidth]);

    const handleTimelineResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        const maxTimelineHeight = window.innerHeight - MIN_BOTTOM_MAP_HEIGHT;
        setTimelineHeight((prev) =>
            Math.max(MIN_TIMELINE_HEIGHT, Math.min(maxTimelineHeight, prev + (direction * RESIZE_KEYBOARD_STEP)))
        );
    }, []);

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
    const {
        mapViewportRef,
        isMapBootstrapEnabled,
        enableMapBootstrap,
    } = useDeferredMapBootstrap({
        viewMode,
        effectiveLayoutMode,
        isMobile,
        isMobileMapExpanded,
    });
    const canManageTripMetadata = canEdit && !shareStatus && !isExamplePreview;

    const timelineCanvas = (
        <TripTimelineCanvas
            timelineView={timelineView}
            trip={displayTrip}
            onUpdateItems={handleUpdateItems}
            onSelect={handleTimelineSelect}
            selectedItemId={selectedItemId}
            selectedCityIds={selectedCityIds}
            readOnly={!canEdit}
            onAddCity={handleOpenAddCity}
            onAddActivity={handleOpenAddActivity}
            onForceFill={handleForceFill}
            onSwapSelectedCities={handleReverseSelectedCities}
            routeStatusById={routeStatusById}
            pixelsPerDay={pixelsPerDay}
            enableExampleSharedTransition={useExampleSharedTransition}
        />
    );

    const handleStartTitleEdit = useCallback(() => {
        if (!canManageTripMetadata) return;
        if (!requireEdit()) return;
        setEditTitleValue(trip.title);
        setIsEditingTitle(true);
    }, [canManageTripMetadata, requireEdit, trip.title]);

    useEffect(() => {
        if (!isEditingTitle || isMobile || typeof window === 'undefined') return;
        const rafId = window.requestAnimationFrame(() => {
            editTitleInputRef.current?.focus();
        });
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [isEditingTitle, isMobile]);

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

    const selectedDetailItem = useMemo(
        () => displayTrip.items.find((item) => item.id === selectedItemId) ?? null,
        [displayTrip.items, selectedItemId]
    );
    const selectedRouteStatus = useMemo(
        () => (selectedItemId ? routeStatusById[selectedItemId] : undefined),
        [routeStatusById, selectedItemId]
    );
    const detailsPanelContent = showSelectedCitiesPanel ? (
        <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-gray-500">Loading selection panel...</div>}>
            <SelectedCitiesPanel
                selectedCities={selectedCitiesInTimeline}
                onClose={clearSelection}
                onApplyOrder={applySelectedCityOrder}
                onReverse={handleReverseSelectedCities}
                timelineView={timelineView}
                readOnly={!canEdit}
            />
        </Suspense>
    ) : (
        <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-gray-500">Loading details...</div>}>
            <DetailsPanel
                item={selectedDetailItem}
                isOpen={!!selectedItemId}
                onClose={clearSelection}
                onUpdate={handleUpdateItem}
                onBatchUpdate={handleBatchItemUpdate}
                onDelete={handleDeleteItem}
                tripStartDate={trip.startDate}
                tripItems={displayTrip.items}
                routeMode={routeMode}
                routeStatus={selectedRouteStatus}
                onForceFill={handleForceFill}
                forceFillMode={selectedCityForceFill?.mode}
                forceFillLabel={selectedCityForceFill?.label}
                variant="sidebar"
                readOnly={!canEdit}
                cityColorPaletteId={cityColorPaletteId}
                onCityColorPaletteChange={canEdit ? handleCityColorPaletteChange : undefined}
            />
        </Suspense>
    );

    const activeToastMeta = toastState ? getToneMeta(toastState.tone) : null;

    if (viewMode === 'print') {
        return (
            <GoogleMapsLoader language={appLanguage}>
                <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center text-sm text-gray-500">Preparing print layout...</div>}>
                    <PrintLayout
                        trip={displayTrip}
                        isPaywalled={isPaywallLocked}
                        onClose={() => setViewMode('planner')}
                        onUpdateTrip={handleUpdateItems}
                    />
                </Suspense>
            </GoogleMapsLoader>
        );
    }

    return (
        <GoogleMapsLoader language={appLanguage} enabled={isMapBootstrapEnabled}>
            <div className="relative h-screen w-screen flex flex-col bg-gray-50 overflow-hidden text-gray-900 font-sans selection:bg-accent-100 selection:text-accent-900">
                
                <TripViewHeader
                    isMobile={isMobile}
                    tripTitle={trip.title}
                    tripSummary={tripSummary}
                    titleViewTransitionName={titleViewTransitionName}
                    isEditingTitle={isEditingTitle}
                    editTitleValue={editTitleValue}
                    onEditTitleValueChange={setEditTitleValue}
                    onCommitTitleEdit={handleCommitTitleEdit}
                    onStartTitleEdit={handleStartTitleEdit}
                    editTitleInputRef={editTitleInputRef}
                    canManageTripMetadata={canManageTripMetadata}
                    canEdit={canEdit}
                    isFavorite={trip.isFavorite}
                    onToggleFavorite={handleToggleFavorite}
                    onHeaderAuthAction={() => {
                        void handleHeaderAuthAction();
                    }}
                    isHeaderAuthSubmitting={isHeaderAuthSubmitting}
                    canUseAuthenticatedSession={canUseAuthenticatedSession}
                    onOpenTripInfo={openTripInfoModal}
                    onPrewarmTripInfo={prewarmTripInfoModal}
                    onSetPrintMode={() => setViewMode('print')}
                    onOpenHistoryPanel={openHistoryPanel}
                    onOpenManager={onOpenManager}
                    canShare={canShare}
                    onShare={() => {
                        void handleShare();
                    }}
                    isTripLockedByExpiry={isTripLockedByExpiry}
                />

                <TripViewStatusBanners
                    shareStatus={shareStatus}
                    onCopyTrip={onCopyTrip}
                    isAdminFallbackView={isAdminFallbackView}
                    adminOverrideEnabled={adminOverrideEnabled}
                    canEnableAdminOverride={canEnableAdminOverride}
                    ownerUsersUrl={ownerUsersUrl}
                    ownerEmail={adminAccess?.ownerEmail}
                    ownerId={adminAccess?.ownerId}
                    isTripLockedByArchive={isTripLockedByArchive}
                    isTripLockedByExpiry={isTripLockedByExpiry}
                    hasLoadingItems={hasLoadingItems}
                    onOpenOwnerDrawer={() => {
                        if (!ownerUsersUrl) return;
                        navigate(ownerUsersUrl);
                    }}
                    onAdminOverrideEnabledChange={setAdminOverrideEnabled}
                    shareSnapshotMeta={shareSnapshotMeta}
                    onOpenLatestSnapshot={() => {
                        if (!shareSnapshotMeta?.latestUrl) return;
                        navigate(shareSnapshotMeta.latestUrl);
                    }}
                    tripExpiresAtMs={tripExpiresAtMs}
                    isExampleTrip={trip.isExample}
                    isPaywallLocked={isPaywallLocked}
                    expirationLabel={expirationLabel}
                    expirationRelativeLabel={expirationRelativeLabel}
                    onPaywallLoginClick={handlePaywallLoginClick}
                    tripId={trip.id}
                    exampleTripBanner={exampleTripBanner}
                />

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
                    <div className={`w-full h-full ${isPaywallLocked ? 'pointer-events-none select-none' : ''}`}>
                        {isMobile ? (
                            <div className="w-full h-full flex flex-col">
                                <div
                                    className="flex-1 min-h-0 w-full bg-white border-b border-gray-200 relative overflow-hidden"
                                    onTouchStart={handleTimelineTouchStart}
                                    onTouchMove={handleTimelineTouchMove}
                                    onTouchEnd={handleTimelineTouchEnd}
                                    onTouchCancel={handleTimelineTouchEnd}
                                >
                                    {timelineCanvas}
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
                                <div
                                    ref={mapViewportRef}
                                    className={`${isMobileMapExpanded ? 'fixed inset-x-0 bottom-0 h-[70vh] z-[1450] border-t border-gray-200 shadow-2xl bg-white' : 'relative h-[34vh] min-h-[220px] bg-gray-100'}`}
                                >
                                    {isMapBootstrapEnabled ? (
                                        <Suspense fallback={<MapLoadingFallback />}>
                                            <ItineraryMap
                                                items={displayTrip.items}
                                                selectedItemId={selectedItemId}
                                                layoutMode="vertical"
                                                showLayoutControls={false}
                                                activeStyle={mapStyle}
                                                onStyleChange={setMapStyle}
                                                routeMode={routeMode}
                                                onRouteModeChange={isPaywallLocked ? undefined : setRouteMode}
                                                showCityNames={isPaywallLocked ? false : showCityNames}
                                                onShowCityNamesChange={isPaywallLocked ? undefined : setShowCityNames}
                                                mapColorMode={mapColorMode}
                                                onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                                                isExpanded={isMobileMapExpanded}
                                                onToggleExpanded={() => setIsMobileMapExpanded(v => !v)}
                                                focusLocationQuery={initialMapFocusQuery}
                                                onRouteMetrics={handleRouteMetrics}
                                                onRouteStatus={handleRouteStatus}
                                                fitToRouteKey={trip.id}
                                                isPaywalled={isPaywallLocked}
                                                viewTransitionName={mapViewTransitionName}
                                            />
                                        </Suspense>
                                    ) : (
                                        <MapDeferredFallback onLoadNow={enableMapBootstrap} />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className={`w-full h-full flex ${effectiveLayoutMode === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
                                {effectiveLayoutMode === 'horizontal' ? (
                                    <>
                                        <div style={{ width: sidebarWidth }} className="h-full flex flex-col items-center bg-white border-r border-gray-200 z-20 shrink-0 relative">
                                            <div className="w-full flex-1 overflow-hidden relative flex flex-col min-w-0">
                                                <div className="flex-1 w-full overflow-hidden relative min-w-0">
                                                    {timelineCanvas}
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

                                        <button
                                            type="button"
                                            className="w-1 bg-gray-100 hover:bg-accent-500 cursor-col-resize transition-colors z-30 flex items-center justify-center group appearance-none border-0 p-0"
                                            onMouseDown={() => startResizing('sidebar')}
                                            onKeyDown={handleSidebarResizeKeyDown}
                                            aria-label="Resize timeline and map panels"
                                        >
                                            <div className="h-8 w-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>

                                        {detailsPanelVisible && (
                                            <div style={{ width: detailsWidth }} className="h-full bg-white border-r border-gray-200 z-20 shrink-0 relative overflow-hidden">
                                                {detailsPanelContent}
                                                <button
                                                    type="button"
                                                    className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-30 flex items-center justify-center group hover:bg-accent-50/60 transition-colors appearance-none border-0 bg-transparent p-0"
                                                    onMouseDown={(e) => startResizing('details', e.clientX)}
                                                    onKeyDown={handleDetailsResizeKeyDown}
                                                    title="Resize details panel"
                                                    aria-label="Resize details panel"
                                                >
                                                    <div className="h-10 w-0.5 rounded-full bg-gray-200 group-hover:bg-accent-400 transition-colors" />
                                                </button>
                                            </div>
                                        )}

                                        <div ref={mapViewportRef} className="flex-1 h-full relative bg-gray-100 min-w-0">
                                            {isMapBootstrapEnabled ? (
                                                <Suspense fallback={<MapLoadingFallback />}>
                                                    <ItineraryMap
                                                        items={displayTrip.items}
                                                        selectedItemId={selectedItemId}
                                                        layoutMode={layoutMode}
                                                        onLayoutChange={setLayoutMode}
                                                        activeStyle={mapStyle}
                                                        onStyleChange={setMapStyle}
                                                        routeMode={routeMode}
                                                        onRouteModeChange={isPaywallLocked ? undefined : setRouteMode}
                                                        showCityNames={isPaywallLocked ? false : showCityNames}
                                                        onShowCityNamesChange={isPaywallLocked ? undefined : setShowCityNames}
                                                        mapColorMode={mapColorMode}
                                                        onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                                                        focusLocationQuery={initialMapFocusQuery}
                                                        onRouteMetrics={handleRouteMetrics}
                                                        onRouteStatus={handleRouteStatus}
                                                        fitToRouteKey={trip.id}
                                                        isPaywalled={isPaywallLocked}
                                                        viewTransitionName={mapViewTransitionName}
                                                    />
                                                </Suspense>
                                            ) : (
                                                <MapDeferredFallback onLoadNow={enableMapBootstrap} />
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div ref={mapViewportRef} className="flex-1 relative bg-gray-100 min-h-0 w-full">
                                            {isMapBootstrapEnabled ? (
                                                <Suspense fallback={<MapLoadingFallback />}>
                                                    <ItineraryMap
                                                        items={displayTrip.items}
                                                        selectedItemId={selectedItemId}
                                                        layoutMode={layoutMode}
                                                        onLayoutChange={setLayoutMode}
                                                        activeStyle={mapStyle}
                                                        onStyleChange={setMapStyle}
                                                        routeMode={routeMode}
                                                        onRouteModeChange={isPaywallLocked ? undefined : setRouteMode}
                                                        showCityNames={isPaywallLocked ? false : showCityNames}
                                                        onShowCityNamesChange={isPaywallLocked ? undefined : setShowCityNames}
                                                        mapColorMode={mapColorMode}
                                                        onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                                                        focusLocationQuery={initialMapFocusQuery}
                                                        onRouteMetrics={handleRouteMetrics}
                                                        onRouteStatus={handleRouteStatus}
                                                        fitToRouteKey={trip.id}
                                                        isPaywalled={isPaywallLocked}
                                                        viewTransitionName={mapViewTransitionName}
                                                    />
                                                </Suspense>
                                            ) : (
                                                <MapDeferredFallback onLoadNow={enableMapBootstrap} />
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="h-1 bg-gray-100 hover:bg-accent-500 cursor-row-resize transition-colors z-30 flex justify-center items-center group w-full appearance-none border-0 p-0"
                                            onMouseDown={() => startResizing('timeline-h')}
                                            onKeyDown={handleTimelineResizeKeyDown}
                                            aria-label="Resize timeline panel"
                                        >
                                            <div className="w-12 h-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                        <div style={{ height: timelineHeight }} className="w-full bg-white border-t border-gray-200 z-20 shrink-0 relative flex flex-row">
                                            <div ref={verticalLayoutTimelineRef} className="flex-1 h-full relative border-r border-gray-100 min-w-0">
                                                <div className="w-full h-full relative min-w-0">
                                                    {timelineCanvas}
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
                                                    {detailsPanelContent}
                                                    <button
                                                        type="button"
                                                        className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-30 flex items-center justify-center group hover:bg-accent-50/60 transition-colors appearance-none border-0 bg-transparent p-0"
                                                        onMouseDown={(e) => startResizing('details', e.clientX)}
                                                        onKeyDown={handleDetailsResizeKeyDown}
                                                        title="Resize details panel"
                                                        aria-label="Resize details panel"
                                                    >
                                                        <div className="h-10 w-0.5 rounded-full bg-gray-200 group-hover:bg-accent-400 transition-colors" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {isMobile && detailsPanelVisible && (
                        <Suspense fallback={null}>
                            <TripDetailsDrawer
                                open={detailsPanelVisible}
                                onOpenChange={(open) => {
                                    if (!open) clearSelection();
                                }}
                            >
                                {detailsPanelContent}
                            </TripDetailsDrawer>
                        </Suspense>
                    )}

                     {/* Modals */}
                     {addActivityState.isOpen && (
                        <Suspense fallback={null}>
                            <AddActivityModal
                                isOpen={addActivityState.isOpen}
                                onClose={() => setAddActivityState({ ...addActivityState, isOpen: false })}
                                dayOffset={addActivityState.dayOffset}
                                location={addActivityState.location}
                                onAdd={handleAddActivityItem}
                                trip={trip}
                                notes="" // TODO
                            />
                        </Suspense>
                     )}

                     {isAddCityModalOpen && (
                        <Suspense fallback={null}>
                            <AddCityModal
                                isOpen={isAddCityModalOpen}
                                onClose={() => setIsAddCityModalOpen(false)}
                                onAdd={(name, lat, lng) => handleAddCityItem({ title: name, coordinates: { lat, lng } })}
                            />
                        </Suspense>
                     )}

                    {isTripInfoOpen && (
                        <Suspense fallback={<TripInfoModalLoadingFallback onClose={closeTripInfoModal} />}>
                            <TripInfoModal
                                isOpen={isTripInfoOpen}
                                onClose={closeTripInfoModal}
                                tripTitle={trip.title}
                                isEditingTitle={isEditingTitle}
                                editTitleValue={editTitleValue}
                                onEditTitleValueChange={setEditTitleValue}
                                onCommitTitleEdit={handleCommitTitleEdit}
                                onStartTitleEdit={handleStartTitleEdit}
                                canManageTripMetadata={canManageTripMetadata}
                                canEdit={canEdit}
                                isFavorite={trip.isFavorite}
                                onToggleFavorite={handleToggleFavorite}
                                isExamplePreview={isExamplePreview}
                                tripMeta={tripMeta}
                                aiMeta={displayTrip.aiMeta}
                                forkMeta={forkMeta}
                                isTripInfoHistoryExpanded={isTripInfoHistoryExpanded}
                                onToggleTripInfoHistoryExpanded={() => setIsTripInfoHistoryExpanded(v => !v)}
                                showAllHistory={showAllHistory}
                                onToggleShowAllHistory={() => setShowAllHistory(v => !v)}
                                onHistoryUndo={() => navigateHistory('undo')}
                                onHistoryRedo={() => navigateHistory('redo')}
                                infoHistoryItems={tripInfoHistoryItems}
                                onGoToHistoryEntry={(url) => {
                                    closeTripInfoModal();
                                    suppressCommitRef.current = true;
                                    navigate(url);
                                }}
                                onOpenFullHistory={() => {
                                    closeTripInfoModal();
                                    openHistoryPanel('trip_info');
                                }}
                                formatHistoryTime={formatHistoryTime}
                                countryInfo={displayTrip.countryInfo}
                                isPaywallLocked={isPaywallLocked}
                            />
                        </Suspense>
                     )}

                    {shouldEnableReleaseNotice && (
                        <Suspense fallback={null}>
                            <ReleaseNoticeDialog enabled={shouldEnableReleaseNotice} />
                        </Suspense>
                    )}

                    {isShareOpen && (
                        <Suspense fallback={null}>
                            <TripShareModal
                                isOpen={isShareOpen}
                                shareMode={shareMode}
                                onShareModeChange={setShareMode}
                                activeShareUrl={activeShareUrl}
                                onClose={() => setIsShareOpen(false)}
                                onCopyShareLink={handleCopyShareLink}
                                onGenerateShare={handleGenerateShare}
                                isGeneratingShare={isGeneratingShare}
                            />
                        </Suspense>
                    )}

                    {/* History Panel */}
                    {isHistoryOpen && (
                        <Suspense fallback={null}>
                            <TripHistoryModal
                                isOpen={isHistoryOpen}
                                isExamplePreview={isExamplePreview}
                                showAllHistory={showAllHistory}
                                items={historyModalItems}
                                onClose={() => setIsHistoryOpen(false)}
                                onUndo={() => navigateHistory('undo')}
                                onRedo={() => navigateHistory('redo')}
                                onToggleShowAllHistory={() => setShowAllHistory(v => !v)}
                                onGo={(item) => {
                                    setIsHistoryOpen(false);
                                    suppressCommitRef.current = true;
                                    navigate(item.url);
                                    showToast(item.details, { tone: item.tone, title: 'Opened from history' });
                                }}
                                formatHistoryTime={formatHistoryTime}
                            />
                        </Suspense>
                    )}

                    <TripViewHudOverlays
                        shareStatus={shareStatus}
                        onCopyTrip={onCopyTrip}
                        isPaywallLocked={isPaywallLocked}
                        expirationLabel={expirationLabel}
                        tripId={trip.id}
                        onPaywallLoginClick={handlePaywallLoginClick}
                        showGenerationOverlay={showGenerationOverlay}
                        generationProgressMessage={generationProgressMessage}
                        loadingDestinationSummary={loadingDestinationSummary}
                        tripDateRange={tripMeta.dateRange}
                        tripTotalDaysLabel={tripMeta.totalDaysLabel}
                        suppressToasts={suppressToasts}
                        toastState={toastState}
                        activeToastMeta={activeToastMeta}
                        onDismissToast={() => setToastState(null)}
                    />

                </main>
            </div>
        </GoogleMapsLoader>
    );
};
