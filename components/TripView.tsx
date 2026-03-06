import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLanguage, ITrip, ITimelineItem, IViewSettings, ShareMode, TripGenerationAttemptSummary, TripGenerationState } from '../types';
import { getDefaultCreateTripModel } from '../config/aiModelCatalog';
import { DB_ENABLED } from '../config/db';
import { GoogleMapsLoader } from './GoogleMapsLoader';
import { BASE_PIXELS_PER_DAY, DEFAULT_CITY_COLOR_PALETTE_ID, DEFAULT_DISTANCE_UNIT, buildShareUrl, formatDistance, getTimelineBounds, getTripDistanceKm, isInternalMapColorModeControlEnabled, normalizeMapColorMode } from '../utils';
import { getExampleMapViewTransitionName, getExampleTitleViewTransitionName } from '../shared/viewTransitionNames';
import { dbGetTrip, type DbTripAccessMetadata } from '../services/dbApi';
import {
    buildTripCalendarExport,
    downloadTripCalendarExport,
    type TripCalendarExportScope,
} from '../services/tripCalendarExportService';
import {
    buildDirectReactivatedTrip,
    buildPaywalledTripDisplay,
    resolveTripPaywallActivationMode,
    type TripPaywallActivationMode,
} from '../config/paywall';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { removeLocalStorageItem } from '../services/browserStorageService';
import { useLoginModal } from '../hooks/useLoginModal';
import {
    buildLoginPathWithNext,
    buildPathFromLocationParts,
    rememberAuthReturnPath,
    setPendingAuthRedirect,
} from '../services/authNavigationService';
import { useAuth } from '../hooks/useAuth';
import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { getLatestConflictBackupForTrip } from '../services/offlineChangeQueue';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useDeferredMapBootstrap } from './tripview/useDeferredMapBootstrap';
import { useTripCopyNoticeToast } from './tripview/useTripCopyNoticeToast';
import { useGenerationProgressMessage } from './tripview/useGenerationProgressMessage';
import { useReleaseNoticeReady } from './tripview/useReleaseNoticeReady';
import { useTripExpiryLifecycle } from './tripview/useTripExpiryLifecycle';
import { useTripHeaderAuthAction } from './tripview/useTripHeaderAuthAction';
import { useTripHistoryDebugTools } from './tripview/useTripHistoryDebugTools';
import { useTripOverlayController } from './tripview/useTripOverlayController';
import { useTripHistoryController } from './tripview/useTripHistoryController';
import { useTripShareLifecycle } from './tripview/useTripShareLifecycle';
import { useTripViewSettingsSync } from './tripview/useTripViewSettingsSync';
import { useTripAdminOverrideState } from './tripview/useTripAdminOverrideState';
import { useTripEditModalState } from './tripview/useTripEditModalState';
import { useTripLayoutControlsState } from './tripview/useTripLayoutControlsState';
import { useTripCityForceFill } from './tripview/useTripCityForceFill';
import { useTripFavoriteHandler } from './tripview/useTripFavoriteHandler';
import { resolveTripToastUndoAction } from './tripview/tripToastUndoAction';
import { useTripItemMutationHandlers } from './tripview/useTripItemMutationHandlers';
import { useTripItemUpdateHandlers } from './tripview/useTripItemUpdateHandlers';
import { useTripRouteStatusState } from './tripview/useTripRouteStatusState';
import { useTripResizeControls } from './tripview/useTripResizeControls';
import { useTripShareActions } from './tripview/useTripShareActions';
import { useTripSelectionController } from './tripview/useTripSelectionController';
import { useTripTitleEditHandlers } from './tripview/useTripTitleEditHandlers';
import { useTripTitleEditorState } from './tripview/useTripTitleEditorState';
import { useTripUpdateItemsHandler } from './tripview/useTripUpdateItemsHandler';
import { useTripViewModeState } from './tripview/useTripViewModeState';
import { useTimelinePinchZoom } from './tripview/useTimelinePinchZoom';
import { buildVisualHistoryLabel, resolveVisualDiff, type ZoomChangeSource } from './tripview/viewChangeDiff';
import { readFloatingMapPreviewState, writeFloatingMapPreviewState } from './tripview/floatingMapPreviewState';
import { TRIP_SYNC_TOAST_EVENT, type SyncToastEventDetail } from '../services/tripSyncManager';
import {
    ChangeTone,
    getToneMeta,
    resolveChangeTone,
    stripHistoryPrefix,
    useTripHistoryPresentation,
} from './tripview/useTripHistoryPresentation';
import { TripTimelineCanvas } from './tripview/TripTimelineCanvas';
import { TripViewHeader } from './tripview/TripViewHeader';
import { TripViewHudOverlays } from './tripview/TripViewHudOverlays';
import { TripViewPlannerWorkspace } from './tripview/TripViewPlannerWorkspace';
import { TripViewStatusBanners } from './tripview/TripViewStatusBanners';
import { showAppToast } from './ui/appToast';
import {
    TRIP_GENERATION_TIMEOUT_MS,
    getTripGenerationElapsedMs,
    getLatestTripGenerationAttempt,
    getTripGenerationState,
    markTripGenerationFailed,
} from '../services/tripGenerationDiagnosticsService';
import { retryTripGenerationWithDefaultModel } from '../services/tripGenerationRetryService';
import { abortActiveTripGenerationRequest } from '../services/aiService';
import { buildBenchmarkScenarioImportUrl } from '../services/tripGenerationBenchmarkBridge';
import { beginTripGenerationTabFeedback, type TripGenerationTabFeedbackSession } from '../services/tripGenerationTabFeedbackService';
import { shouldApplyPolledTripUpdate, shouldPollTripGenerationState } from '../services/tripGenerationPollingService';
import { processQueuedTripGenerationAfterAuth } from '../services/tripGenerationQueueService';
import { registerTripGenerationCompletionWatch } from '../services/tripGenerationCompletionWatchService';
import { triggerTripGenerationWorker } from '../services/tripGenerationJobService';

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
const VERTICAL_TIMELINE_AUTO_FIT_PADDING = 56;
const TIMELINE_ZOOM_LEVEL_PRESETS = [
    0.2,
    0.25,
    0.3,
    0.4,
    0.5,
    0.6,
    0.75,
    0.9,
    1,
    1.1,
    1.25,
    1.5,
    1.75,
    2,
    2.25,
    2.5,
    2.75,
    3,
];
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
const TRIP_GENERATION_POLL_INTERVAL_MS = 4_000;
const TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE: Record<
    TripCalendarExportScope,
    'trip_view__calendar_export--activity' | 'trip_view__calendar_export--activities' | 'trip_view__calendar_export--cities' | 'trip_view__calendar_export--all'
> = {
    activity: 'trip_view__calendar_export--activity',
    activities: 'trip_view__calendar_export--activities',
    cities: 'trip_view__calendar_export--cities',
    all: 'trip_view__calendar_export--all',
};

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

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void | Promise<void>) => unknown;
};

const runWithOptionalViewTransition = (update: () => void): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        update();
        return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        update();
        return;
    }
    const transitionDocument = document as ViewTransitionDocument;
    if (typeof transitionDocument.startViewTransition !== 'function') {
        update();
        return;
    }
    transitionDocument.startViewTransition(() => {
        update();
    });
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

interface TripMetaSummary {
    dateRange: string;
    totalDays: number;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

const buildTripMetaSummary = (trip: ITrip): TripMetaSummary => {
    const cityItems = trip.items
        .filter((item) => item.type === 'city')
        .sort((a, b) => a.startDateOffset - b.startDateOffset);
    const cityCount = cityItems.length;
    const maxEnd = cityItems.reduce((max, city) => Math.max(max, city.startDateOffset + city.duration), 0);
    const totalDaysRaw = Math.round(maxEnd * 2) / 2;
    const totalDays = Number.isFinite(totalDaysRaw) ? totalDaysRaw : 0;

    const startDate = new Date(trip.startDate);
    const endOffsetDays = Math.max(0, Math.ceil(maxEnd) - 1);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + endOffsetDays);

    const formatDate = (value: Date) => value.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const dateRange = startDate.toDateString() === endDate.toDateString()
        ? formatDate(startDate)
        : `${formatDate(startDate)} – ${formatDate(endDate)}`;

    const totalDaysLabel = totalDays % 1 === 0 ? totalDays.toFixed(0) : totalDays.toFixed(1);
    const citiesLabel = cityCount === 1 ? '1 city' : `${cityCount} cities`;
    const totalDistanceKm = getTripDistanceKm(trip.items);
    const distanceLabel = totalDistanceKm > 0
        ? formatDistance(totalDistanceKm, DEFAULT_DISTANCE_UNIT, { maximumFractionDigits: 0 })
        : null;
    const distancePart = distanceLabel ? ` • ${distanceLabel}` : '';

    return {
        dateRange,
        totalDays,
        totalDaysLabel,
        cityCount,
        distanceLabel,
        summaryLine: `${dateRange} • ${totalDaysLabel} days • ${citiesLabel}${distancePart}`,
    };
};

interface TripViewProps {
    trip: ITrip;
    onUpdateTrip: (updatedTrip: ITrip, options?: { persist?: boolean; preserveUpdatedAt?: boolean }) => void;
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
    tripAccess?: DbTripAccessMetadata;
    exampleTripBanner?: {
        title: string;
        countries: string[];
        onCreateSimilarTrip?: () => void;
    };
}

interface CommitScheduleOptions {
    skipToast?: boolean;
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

interface TripViewModalLayerProps {
    isMobile: boolean;
    detailsPanelVisible: boolean;
    detailsPanelContent: React.ReactNode;
    onCloseDetailsDrawer: () => void;
    addActivityState: { isOpen: boolean; dayOffset: number; location: string };
    onCloseAddActivity: () => void;
    onAddActivity: (...args: any[]) => void;
    trip: ITrip;
    isAddCityModalOpen: boolean;
    onCloseAddCityModal: () => void;
    onAddCity: (name: string, lat: number, lng: number) => void;
    isTripInfoOpen: boolean;
    onCloseTripInfo: () => void;
    tripTitle: string;
    isEditingTitle: boolean;
    editTitleValue: string;
    onEditTitleValueChange: (value: string) => void;
    onCommitTitleEdit: () => void;
    onStartTitleEdit: () => void;
    canManageTripMetadata: boolean;
    canEdit: boolean;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    isExamplePreview: boolean;
    tripMeta: any;
    ownerSummary: string | null;
    ownerHint: string | null;
    adminMeta: {
        ownerUserId: string | null;
        ownerUsername: string | null;
        ownerEmail: string | null;
        accessSource: string | null;
    } | null;
    aiMeta: ITrip['aiMeta'];
    generationState: TripGenerationState;
    latestGenerationAttempt: TripGenerationAttemptSummary | null;
    canRetryGeneration: boolean;
    isRetryingGeneration: boolean;
    retryModelId: string | null;
    onRetryModelIdChange: (modelId: string) => void;
    onRetryGeneration: (source: 'trip_info' | 'trip_strip', modelId?: string | null) => void;
    onOpenBenchmarkWithSnapshot: () => void;
    canOpenBenchmarkWithSnapshot: boolean;
    tripInfoRetryAnalyticsAttributes: Record<string, string>;
    forkMeta: { label: string; url: string | null } | null;
    isTripInfoHistoryExpanded: boolean;
    onToggleTripInfoHistoryExpanded: () => void;
    showAllHistory: boolean;
    onToggleShowAllHistory: () => void;
    onHistoryUndo: () => void;
    onHistoryRedo: () => void;
    infoHistoryItems: any[];
    onGoToHistoryEntry: (url: string) => void;
    onOpenFullHistory: () => void;
    formatHistoryTime: (value: number) => string;
    countryInfo: ITrip['countryInfo'];
    isPaywallLocked: boolean;
    onExportActivitiesCalendar: () => void;
    onExportCitiesCalendar: () => void;
    onExportAllCalendar: () => void;
    shouldEnableReleaseNotice: boolean;
    isShareOpen: boolean;
    shareMode: ShareMode;
    onShareModeChange: (mode: ShareMode) => void;
    activeShareUrl: string | null;
    onCloseShare: () => void;
    onCopyShareLink: () => void;
    onGenerateShare: () => void;
    isGeneratingShare: boolean;
    isHistoryOpen: boolean;
    historyModalItems: any[];
    pendingSyncCount: number;
    failedSyncCount: number;
    onCloseHistory: () => void;
    onHistoryGo: (item: any) => void;
    shareStatus?: ShareMode;
    onCopyTrip?: () => void;
    expirationLabel: string | null;
    tripId: string;
    paywallActivationMode: TripPaywallActivationMode;
    onPaywallActivateClick: (
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => void;
    showGenerationOverlay: boolean;
    generationProgressMessage: string;
    loadingDestinationSummary: string;
    tripDateRange: string;
    tripTotalDaysLabel: string;
}

const TripViewModalLayer: React.FC<TripViewModalLayerProps> = ({
    isMobile,
    detailsPanelVisible,
    detailsPanelContent,
    onCloseDetailsDrawer,
    addActivityState,
    onCloseAddActivity,
    onAddActivity,
    trip,
    isAddCityModalOpen,
    onCloseAddCityModal,
    onAddCity,
    isTripInfoOpen,
    onCloseTripInfo,
    tripTitle,
    isEditingTitle,
    editTitleValue,
    onEditTitleValueChange,
    onCommitTitleEdit,
    onStartTitleEdit,
    canManageTripMetadata,
    canEdit,
    isFavorite,
    onToggleFavorite,
    isExamplePreview,
    tripMeta,
    ownerSummary,
    ownerHint,
    adminMeta,
    aiMeta,
    generationState,
    latestGenerationAttempt,
    canRetryGeneration,
    isRetryingGeneration,
    retryModelId,
    onRetryModelIdChange,
    onRetryGeneration,
    onOpenBenchmarkWithSnapshot,
    canOpenBenchmarkWithSnapshot,
    tripInfoRetryAnalyticsAttributes,
    forkMeta,
    isTripInfoHistoryExpanded,
    onToggleTripInfoHistoryExpanded,
    showAllHistory,
    onToggleShowAllHistory,
    onHistoryUndo,
    onHistoryRedo,
    infoHistoryItems,
    onGoToHistoryEntry,
    onOpenFullHistory,
    formatHistoryTime,
    countryInfo,
    isPaywallLocked,
    onExportActivitiesCalendar,
    onExportCitiesCalendar,
    onExportAllCalendar,
    shouldEnableReleaseNotice,
    isShareOpen,
    shareMode,
    onShareModeChange,
    activeShareUrl,
    onCloseShare,
    onCopyShareLink,
    onGenerateShare,
    isGeneratingShare,
    isHistoryOpen,
    historyModalItems,
    pendingSyncCount,
    failedSyncCount,
    onCloseHistory,
    onHistoryGo,
    shareStatus,
    onCopyTrip,
    expirationLabel,
    tripId,
    paywallActivationMode,
    onPaywallActivateClick,
    showGenerationOverlay,
    generationProgressMessage,
    loadingDestinationSummary,
    tripDateRange,
    tripTotalDaysLabel,
}) => (
    <>
        {isMobile && detailsPanelVisible && (
            <Suspense fallback={null}>
                <TripDetailsDrawer open={detailsPanelVisible} onOpenChange={(open) => { if (!open) onCloseDetailsDrawer(); }}>
                    {detailsPanelContent}
                </TripDetailsDrawer>
            </Suspense>
        )}
        {addActivityState.isOpen && (
            <Suspense fallback={null}>
                <AddActivityModal
                    isOpen={addActivityState.isOpen}
                    onClose={onCloseAddActivity}
                    dayOffset={addActivityState.dayOffset}
                    location={addActivityState.location}
                    onAdd={onAddActivity}
                    trip={trip}
                    notes=""
                />
            </Suspense>
        )}
        {isAddCityModalOpen && (
            <Suspense fallback={null}>
                <AddCityModal isOpen={isAddCityModalOpen} onClose={onCloseAddCityModal} onAdd={onAddCity} />
            </Suspense>
        )}
        {isTripInfoOpen && (
            <Suspense fallback={<TripInfoModalLoadingFallback onClose={onCloseTripInfo} />}>
                <TripInfoModal
                    isOpen={isTripInfoOpen}
                    onClose={onCloseTripInfo}
                    tripTitle={tripTitle}
                    isEditingTitle={isEditingTitle}
                    editTitleValue={editTitleValue}
                    onEditTitleValueChange={onEditTitleValueChange}
                    onCommitTitleEdit={onCommitTitleEdit}
                    onStartTitleEdit={onStartTitleEdit}
                    canManageTripMetadata={canManageTripMetadata}
                    canEdit={canEdit}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    isExamplePreview={isExamplePreview}
                    tripMeta={tripMeta}
                    ownerSummary={ownerSummary}
                    ownerHint={ownerHint}
                    adminMeta={adminMeta}
                    aiMeta={aiMeta}
                    generationState={generationState}
                    latestGenerationAttempt={latestGenerationAttempt}
                    canRetryGeneration={canRetryGeneration}
                    isRetryingGeneration={isRetryingGeneration}
                    retryModelId={retryModelId}
                    onRetryModelIdChange={onRetryModelIdChange}
                    onRetryGeneration={(modelId) => onRetryGeneration('trip_info', modelId)}
                    onOpenBenchmarkWithSnapshot={onOpenBenchmarkWithSnapshot}
                    canOpenBenchmarkWithSnapshot={canOpenBenchmarkWithSnapshot}
                    retryAnalyticsAttributes={tripInfoRetryAnalyticsAttributes}
                    forkMeta={forkMeta}
                    isTripInfoHistoryExpanded={isTripInfoHistoryExpanded}
                    onToggleTripInfoHistoryExpanded={onToggleTripInfoHistoryExpanded}
                    showAllHistory={showAllHistory}
                    onToggleShowAllHistory={onToggleShowAllHistory}
                    onHistoryUndo={onHistoryUndo}
                    onHistoryRedo={onHistoryRedo}
                    infoHistoryItems={infoHistoryItems}
                    onGoToHistoryEntry={onGoToHistoryEntry}
                    onOpenFullHistory={onOpenFullHistory}
                    formatHistoryTime={formatHistoryTime}
                    countryInfo={countryInfo}
                    isPaywallLocked={isPaywallLocked}
                    onExportActivitiesCalendar={onExportActivitiesCalendar}
                    onExportCitiesCalendar={onExportCitiesCalendar}
                    onExportAllCalendar={onExportAllCalendar}
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
                    onShareModeChange={onShareModeChange}
                    activeShareUrl={activeShareUrl}
                    onClose={onCloseShare}
                    onCopyShareLink={onCopyShareLink}
                    onGenerateShare={onGenerateShare}
                    isGeneratingShare={isGeneratingShare}
                />
            </Suspense>
        )}
        {isHistoryOpen && (
            <Suspense fallback={null}>
                <TripHistoryModal
                    isOpen={isHistoryOpen}
                    isExamplePreview={isExamplePreview}
                    showAllHistory={showAllHistory}
                    items={historyModalItems}
                    pendingSyncCount={pendingSyncCount}
                    failedSyncCount={failedSyncCount}
                    onClose={onCloseHistory}
                    onUndo={onHistoryUndo}
                    onRedo={onHistoryRedo}
                    onToggleShowAllHistory={onToggleShowAllHistory}
                    onGo={onHistoryGo}
                    formatHistoryTime={formatHistoryTime}
                />
            </Suspense>
        )}
        <TripViewHudOverlays
            shareStatus={shareStatus}
            onCopyTrip={onCopyTrip}
            isPaywallLocked={isPaywallLocked}
            expirationLabel={expirationLabel}
            tripId={tripId}
            paywallActivationMode={paywallActivationMode}
            onPaywallActivateClick={onPaywallActivateClick}
            showGenerationOverlay={showGenerationOverlay}
            generationProgressMessage={generationProgressMessage}
            loadingDestinationSummary={loadingDestinationSummary}
            tripDateRange={tripDateRange}
            tripTotalDaysLabel={tripTotalDaysLabel}
        />
    </>
);

interface RenderDetailsPanelContentOptions {
    showSelectedCitiesPanel: boolean;
    selectedCitiesInTimeline: ITimelineItem[];
    onCloseSelection: () => void;
    onApplySelectedCityOrder: (orderedCityIds: string[]) => void;
    onReverseSelectedCities: () => void;
    timelineView: 'horizontal' | 'vertical';
    canEdit: boolean;
    selectedDetailItem: ITimelineItem | null;
    selectedItemId: string | null;
    onUpdateItem: (id: string, updates: Partial<ITimelineItem>, options?: { skipPendingLabel?: boolean }) => void;
    onBatchUpdateItem: (...args: any[]) => void;
    onDeleteItem: (id: string, strategy?: 'item-only' | 'shift-gap' | 'pull-back') => void;
    tripStartDate: string;
    displayItems: ITimelineItem[];
    routeMode: any;
    selectedRouteStatus: any;
    onForceFill: (id: string) => void;
    selectedCityForceFillMode?: 'stretch' | 'shrink';
    selectedCityForceFillLabel?: string;
    cityColorPaletteId: string;
    onCityColorPaletteChange?: (paletteId: string, options: { applyToCities: boolean }) => void;
    onExportActivityCalendar?: (itemId: string) => void;
}

const renderDetailsPanelContent = ({
    showSelectedCitiesPanel,
    selectedCitiesInTimeline,
    onCloseSelection,
    onApplySelectedCityOrder,
    onReverseSelectedCities,
    timelineView,
    canEdit,
    selectedDetailItem,
    selectedItemId,
    onUpdateItem,
    onBatchUpdateItem,
    onDeleteItem,
    tripStartDate,
    displayItems,
    routeMode,
    selectedRouteStatus,
    onForceFill,
    selectedCityForceFillMode,
    selectedCityForceFillLabel,
    cityColorPaletteId,
    onCityColorPaletteChange,
    onExportActivityCalendar,
}: RenderDetailsPanelContentOptions): React.ReactNode => (
    showSelectedCitiesPanel ? (
        <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-gray-500">Loading selection panel...</div>}>
            <SelectedCitiesPanel
                selectedCities={selectedCitiesInTimeline}
                onClose={onCloseSelection}
                onApplyOrder={onApplySelectedCityOrder}
                onReverse={onReverseSelectedCities}
                timelineView={timelineView}
                readOnly={!canEdit}
            />
        </Suspense>
    ) : (
        <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-gray-500">Loading details...</div>}>
            <DetailsPanel
                item={selectedDetailItem}
                isOpen={!!selectedItemId}
                onClose={onCloseSelection}
                onUpdate={onUpdateItem}
                onBatchUpdate={onBatchUpdateItem}
                onDelete={onDeleteItem}
                tripStartDate={tripStartDate}
                tripItems={displayItems}
                routeMode={routeMode}
                routeStatus={selectedRouteStatus}
                onForceFill={onForceFill}
                forceFillMode={selectedCityForceFillMode}
                forceFillLabel={selectedCityForceFillLabel}
                variant="sidebar"
                readOnly={!canEdit}
                cityColorPaletteId={cityColorPaletteId}
                onCityColorPaletteChange={onCityColorPaletteChange}
                onExportActivityCalendar={onExportActivityCalendar}
            />
        </Suspense>
    )
);

const useTripViewRender = ({
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
    tripAccess,
    exampleTripBanner,
}: TripViewProps): React.ReactElement => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, i18n } = useTranslation('common');
    const { openLoginModal } = useLoginModal();
    const { access, profile, isAuthenticated, isAnonymous, isAdmin, logout } = useAuth();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const { snapshot: syncSnapshot, retrySyncNow } = useSyncStatus();
    const isTripDetailRoute = location.pathname.startsWith('/trip/');
    const locationState = location.state as ExampleTransitionLocationState | null;
    const useExampleSharedTransition = trip.isExample && (locationState?.useExampleSharedTransition ?? true);
    const mapViewTransitionName = getExampleMapViewTransitionName(useExampleSharedTransition);
    const titleViewTransitionName = getExampleTitleViewTransitionName(useExampleSharedTransition);
    const tripRef = useRef(trip);
    const retryGenerationTabFeedbackSessionRef = useRef<TripGenerationTabFeedbackSession | null>(null);
    const pendingRetryGenerationStateRef = useRef(false);
    const retryMutationInFlightRef = useRef(false);
    tripRef.current = trip;
    const [generationNowMs, setGenerationNowMs] = useState(() => Date.now());
    const [retryModelId, setRetryModelId] = useState<string>(getDefaultCreateTripModel().id);
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
    const generationState = useMemo<TripGenerationState>(
        () => getTripGenerationState(trip, generationNowMs),
        [generationNowMs, trip]
    );
    const shouldPollGenerationState = shouldPollTripGenerationState(trip, generationNowMs);
    useEffect(() => {
        if (!shouldPollGenerationState) return undefined;
        const timer = window.setInterval(() => {
            setGenerationNowMs(Date.now());
        }, 1_000);
        return () => window.clearInterval(timer);
    }, [shouldPollGenerationState, trip.id]);
    useEffect(() => {
        if (!DB_ENABLED) return undefined;
        if (!shouldPollGenerationState) return undefined;
        if (connectivitySnapshot.state === 'offline') return undefined;
        if (tripAccess?.source === 'public_read') return undefined;

        let cancelled = false;
        let inFlight = false;
        const poll = async () => {
            if (cancelled || inFlight) return;
            inFlight = true;
            try {
                const remote = await dbGetTrip(trip.id, { includeOwnerProfile: false });
                if (cancelled || !remote?.trip) return;

                const remoteTrip = remote.trip;
                const localTrip = tripRef.current;
                if (shouldApplyPolledTripUpdate(localTrip, remoteTrip, Date.now())) {
                    onUpdateTrip(remoteTrip, { preserveUpdatedAt: true });
                }
            } finally {
                inFlight = false;
            }
        };

        void poll();
        const timer = window.setInterval(() => {
            void poll();
        }, TRIP_GENERATION_POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [
        connectivitySnapshot.state,
        onUpdateTrip,
        shouldPollGenerationState,
        trip.id,
        tripAccess?.source,
    ]);
    useEffect(() => {
        if (!DB_ENABLED) return undefined;
        if (connectivitySnapshot.state === 'offline') return undefined;
        if (tripAccess?.source === 'public_read') return undefined;
        if (generationState !== 'queued' && generationState !== 'running') return undefined;
        if (latestGenerationAttemptOrchestration !== 'async_worker') return undefined;

        let cancelled = false;
        const kickWorker = () => {
            if (cancelled) return;
            void triggerTripGenerationWorker({
                tripId: trip.id,
                limit: 1,
                source: 'trip_view_generation_poll_nudge',
            });
        };

        kickWorker();
        const timer = window.setInterval(kickWorker, 15_000);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [
        connectivitySnapshot.state,
        generationState,
        latestGenerationAttemptOrchestration,
        trip.id,
        tripAccess?.source,
    ]);
    useEffect(() => () => {
        retryGenerationTabFeedbackSessionRef.current?.cancel();
        retryGenerationTabFeedbackSessionRef.current = null;
        pendingRetryGenerationStateRef.current = false;
    }, []);
    const latestGenerationAttempt = useMemo<TripGenerationAttemptSummary | null>(
        () => getLatestTripGenerationAttempt(trip),
        [trip]
    );
    const latestGenerationAttemptOrchestration = useMemo(() => {
        const metadata = latestGenerationAttempt?.metadata;
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
        const orchestration = metadata.orchestration;
        return typeof orchestration === 'string' ? orchestration : null;
    }, [latestGenerationAttempt?.metadata]);
    const pendingAuthQueueRequestId = useMemo(() => {
        const metadata = latestGenerationAttempt?.metadata;
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
        const queueRequestValue = metadata.queueRequestId;
        const queueRequestId = typeof queueRequestValue === 'string' ? queueRequestValue.trim() : '';
        if (!queueRequestId) return null;
        const pendingAuthValue = metadata.pendingAuth;
        return pendingAuthValue === true ? queueRequestId : null;
    }, [latestGenerationAttempt?.metadata]);
    const [isResolvingPendingAuthGeneration, setIsResolvingPendingAuthGeneration] = useState(false);
    const generationElapsedMs = useMemo(
        () => getTripGenerationElapsedMs(trip, generationNowMs),
        [generationNowMs, trip]
    );
    useEffect(() => {
        const session = retryGenerationTabFeedbackSessionRef.current;
        const isGenerationInFlight = generationState === 'running' || generationState === 'queued';

        if (isGenerationInFlight) {
            pendingRetryGenerationStateRef.current = false;
            if (!session && tripAccess?.source !== 'public_read') {
                retryGenerationTabFeedbackSessionRef.current = beginTripGenerationTabFeedback();
            }
            return;
        }

        if (!session) return;
        if (pendingRetryGenerationStateRef.current && generationState === 'failed') {
            return;
        }

        if (generationState === 'succeeded') {
            session.complete('success', { title: trip.title });
            retryGenerationTabFeedbackSessionRef.current = null;
            pendingRetryGenerationStateRef.current = false;
            return;
        }
        if (generationState === 'failed') {
            session.complete('error');
            retryGenerationTabFeedbackSessionRef.current = null;
            pendingRetryGenerationStateRef.current = false;
            return;
        }
        session.cancel();
        retryGenerationTabFeedbackSessionRef.current = null;
        pendingRetryGenerationStateRef.current = false;
    }, [generationState, trip.title, tripAccess?.source]);
    const isGenerationSlow = (
        (generationState === 'running' || generationState === 'queued')
        && typeof generationElapsedMs === 'number'
        && generationElapsedMs >= TRIP_GENERATION_TIMEOUT_MS
    );
    const ownerUsersUrl = useMemo(() => {
        if (!isAdminFallbackView || !adminAccess?.ownerId) return null;
        return `/admin/trips?user=${encodeURIComponent(adminAccess.ownerId)}&drawer=user`;
    }, [adminAccess?.ownerId, isAdminFallbackView]);

    const paywallActivationMode = useMemo<TripPaywallActivationMode>(
        () => resolveTripPaywallActivationMode({
            isAuthenticated,
            isAnonymous,
            isTripDetailRoute,
        }),
        [isAnonymous, isAuthenticated, isTripDetailRoute]
    );

    const handlePaywallActivateClick = useCallback((
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => {
        trackEvent(analyticsEvent, {
            trip_id: trip.id,
            activation_mode: paywallActivationMode,
        });
        if (!isPlainLeftClick(event)) return;

        event.preventDefault();
        if (paywallActivationMode === 'direct_reactivate') {
            const now = Date.now();
            const reactivatedTrip = buildDirectReactivatedTrip({
                trip: tripRef.current,
                nowMs: now,
                tripExpirationDays: access?.entitlements.tripExpirationDays,
            });
            onUpdateTrip(reactivatedTrip);
            if (onCommitState) {
                onCommitState(
                    reactivatedTrip,
                    reactivatedTrip.defaultView ?? initialViewSettings ?? trip.defaultView,
                    { label: 'Lifecycle: Reactivated expired trip' }
                );
            }
            showAppToast({
                tone: 'add',
                title: t('tripPaywall.reactivate.toast.title'),
                description: t('tripPaywall.reactivate.toast.description'),
            });
            return;
        }

        openLoginModal({
            source,
            nextPath: buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            }),
            reloadOnSuccess: true,
        });
    }, [
        access?.entitlements.tripExpirationDays,
        initialViewSettings,
        location.hash,
        location.pathname,
        location.search,
        onCommitState,
        onUpdateTrip,
        openLoginModal,
        paywallActivationMode,
        t,
        trip.defaultView,
        trip.id,
    ]);

    const handleResolvePendingAuthGeneration = useCallback(async () => {
        if (!pendingAuthQueueRequestId || isResolvingPendingAuthGeneration) return;

        if (isAuthenticated && !isAnonymous) {
            setIsResolvingPendingAuthGeneration(true);
            try {
                const result = await processQueuedTripGenerationAfterAuth(pendingAuthQueueRequestId);
                registerTripGenerationCompletionWatch(result.tripId, 'auth_queue_claim_trip_view');
                showAppToast({
                    tone: 'add',
                    title: 'Generation started',
                    description: 'Trip generation started and is running in the background.',
                });
                navigate(`/trip/${result.tripId}`, { replace: true });
            } catch (error) {
                showAppToast({
                    tone: 'warning',
                    title: 'Generation unavailable',
                    description: error instanceof Error ? error.message : 'Could not start trip generation.',
                });
            } finally {
                setIsResolvingPendingAuthGeneration(false);
            }
            return;
        }

        const authRedirect = buildLoginPathWithNext({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            language: i18n.language,
            resolvedLanguage: i18n.resolvedLanguage,
        });
        rememberAuthReturnPath(authRedirect.nextPath);
        setPendingAuthRedirect(authRedirect.nextPath, 'trip_generation_pending_auth');
        const query = new URLSearchParams();
        query.set('next', authRedirect.nextPath);
        query.set('claim', pendingAuthQueueRequestId);
        navigate(`${authRedirect.loginPath}?${query.toString()}`);
    }, [
        i18n.language,
        i18n.resolvedLanguage,
        isAnonymous,
        isAuthenticated,
        isResolvingPendingAuthGeneration,
        location.hash,
        location.pathname,
        location.search,
        navigate,
        pendingAuthQueueRequestId,
    ]);

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
    const [isRetryingGeneration, setIsRetryingGeneration] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
    const cityColorPaletteId = trip.cityColorPaletteId || DEFAULT_CITY_COLOR_PALETTE_ID;
    const mapColorMode = normalizeMapColorMode(trip.mapColorMode);
    const allowMapColorModeControls = useMemo(
        () => canEdit && isInternalMapColorModeControlEnabled(),
        [canEdit, location.search]
    );
    const { viewMode, setViewMode } = useTripViewModeState();

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
    const pendingHistoryLabelRef = useRef<string | null>(null);
    const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingCommitRef = useRef<{ trip: ITrip; view: IViewSettings; skipToast?: boolean } | null>(null);
    const suppressCommitRef = useRef(false);
    const navigateHistoryRef = useRef<((action: 'undo' | 'redo', options?: { silent?: boolean }) => boolean) | null>(null);
    const skipViewDiffRef = useRef(false);
    const appliedViewKeyRef = useRef<string | null>(null);
    const prevViewRef = useRef<IViewSettings | null>(null);
    const {
        layoutMode,
        setLayoutMode,
        timelineMode,
        setTimelineMode,
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
    const zoomChangeSourceRef = useRef<ZoomChangeSource>(null);
    const [isZoomDirty, setIsZoomDirty] = useState(false);
    const skipPersistMapDockModeRef = useRef(false);
    const [mapDockMode, setMapDockMode] = useState<'docked' | 'floating'>(() => {
        if (initialViewSettings?.mapDockMode === 'floating' || initialViewSettings?.mapDockMode === 'docked') {
            return initialViewSettings.mapDockMode;
        }
        const persisted = readFloatingMapPreviewState().mode;
        return persisted === 'floating' || persisted === 'docked' ? persisted : 'docked';
    });
    const markZoomDirty = useCallback((source: ZoomChangeSource = 'manual') => {
        if (source) {
            zoomChangeSourceRef.current = source;
        }
        if (source === 'manual') {
            setIsZoomDirty(true);
        }
    }, []);
    const markAutoFitZoomChange = useCallback(() => {
        zoomChangeSourceRef.current = 'auto';
    }, []);
    useEffect(() => {
        setIsZoomDirty(false);
        zoomChangeSourceRef.current = null;
    }, [trip.id]);
    useEffect(() => {
        if (!isMobileViewport || mapDockMode === 'docked') return;
        skipPersistMapDockModeRef.current = true;
        skipViewDiffRef.current = true;
        setMapDockMode('docked');
    }, [isMobileViewport, mapDockMode]);
    useEffect(() => {
        if (skipPersistMapDockModeRef.current) {
            skipPersistMapDockModeRef.current = false;
            return;
        }
        writeFloatingMapPreviewState({ mode: mapDockMode });
    }, [mapDockMode]);
    const clampZoomLevel = useCallback((value: number) => {
        if (!Number.isFinite(value)) return 1;
        return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, value));
    }, []);
    const horizontalTimelineDayCount = useMemo(() => {
        const bounds = getTimelineBounds(trip.items);
        return Math.max(1, bounds.dayCount);
    }, [trip.items]);
    const pixelsPerDay = BASE_PIXELS_PER_DAY * zoomLevel;
    const {
        handleTimelineTouchStart,
        handleTimelineTouchMove,
        handleTimelineTouchEnd,
    } = useTimelinePinchZoom({
        isMobile: isMobileViewport,
        zoomLevel,
        clampZoomLevel,
        setZoomLevel,
        onUserZoomChange: markZoomDirty,
    });

    const showToast = useCallback((message: string, options?: {
        tone?: ChangeTone;
        title?: string;
        iconVariant?: 'undo' | 'redo';
        action?: { label: string; onClick: () => void };
        disableDefaultUndo?: boolean;
    }) => {
        if (suppressToasts) return;
        const action = resolveTripToastUndoAction({
            action: options?.action,
            disableDefaultUndo: options?.disableDefaultUndo,
            onUndo: () => navigateHistoryRef.current?.('undo') ?? false,
        });
        showAppToast({
            tone: options?.tone || 'info',
            title: options?.title || 'Saved',
            description: message,
            duration: 3200,
            iconVariant: options?.iconVariant,
            action,
        });
    }, [suppressToasts]);

    useTripCopyNoticeToast({
        tripId: trip.id,
        showToast,
    });

    useEffect(() => {
        const handleSyncToast = (event: Event) => {
            const detail = (event as CustomEvent<SyncToastEventDetail | undefined>).detail;
            if (!detail) return;
            if (detail.type === 'sync_started') {
                const messageKey = detail.pendingCount === 1
                    ? 'connectivity.toast.syncStartedOne'
                    : 'connectivity.toast.syncStartedMany';
                showToast(t(messageKey, { count: detail.pendingCount }), {
                    tone: 'info',
                    title: t('connectivity.toast.title'),
                });
                return;
            }
            if (detail.type === 'sync_completed') {
                showToast(t('connectivity.toast.syncCompleted'), {
                    tone: 'add',
                    title: t('connectivity.toast.title'),
                });
                return;
            }
            if (detail.type === 'sync_partial_failure') {
                const messageKey = detail.failedCount === 1
                    ? 'connectivity.toast.syncPartialFailureOne'
                    : 'connectivity.toast.syncPartialFailureMany';
                showToast(t(messageKey, { count: detail.failedCount }), {
                    tone: 'neutral',
                    title: t('connectivity.toast.title'),
                });
            }
        };

        window.addEventListener(TRIP_SYNC_TOAST_EVENT, handleSyncToast as EventListener);
        return () => {
            window.removeEventListener(TRIP_SYNC_TOAST_EVENT, handleSyncToast as EventListener);
        };
    }, [showToast, t]);

    const handleRestoreServerBackup = useCallback(() => {
        const conflictBackup = getLatestConflictBackupForTrip(trip.id);
        if (!conflictBackup) return;
        const restoredTrip: ITrip = {
            ...conflictBackup.serverTripSnapshot,
            updatedAt: Date.now(),
        };
        onUpdateTrip(restoredTrip);
        if (onCommitState) {
            onCommitState(
                restoredTrip,
                restoredTrip.defaultView ?? initialViewSettings ?? trip.defaultView,
                { label: 'Data: Restored server backup' }
            );
        }
        showToast(t('connectivity.toast.serverBackupRestored'), {
            tone: 'neutral',
            title: t('connectivity.toast.title'),
        });
    }, [initialViewSettings, onCommitState, onUpdateTrip, showToast, t, trip.defaultView, trip.id]);

    const canRetryGeneration = canEdit
        && !isRetryingGeneration
        && !pendingAuthQueueRequestId
        && Boolean(trip.aiMeta?.generation?.inputSnapshot)
        && generationState !== 'running'
        && generationState !== 'queued';
    const canAbortAndRetryGeneration = canEdit
        && !isRetryingGeneration
        && Boolean(trip.aiMeta?.generation?.inputSnapshot)
        && isGenerationSlow;

    const currentViewSettings: IViewSettings = useMemo(() => ({
        layoutMode,
        timelineMode,
        timelineView,
        mapDockMode,
        mapStyle,
        routeMode,
        showCityNames,
        zoomLevel,
        sidebarWidth,
        timelineHeight
    }), [layoutMode, timelineMode, timelineView, mapDockMode, mapStyle, routeMode, showCityNames, zoomLevel, sidebarWidth, timelineHeight]);

    const tripInfoRetryAnalyticsAttributes = useMemo(
        () => getAnalyticsDebugAttributes('trip_generation__trip_info--retry', {
            trip_id: trip.id,
            source: 'trip_info_modal',
        }),
        [trip.id]
    );

    const handleOpenBenchmarkWithSnapshot = useCallback(() => {
        const snapshot = trip.aiMeta?.generation?.inputSnapshot;
        const importUrl = buildBenchmarkScenarioImportUrl({
            snapshot: snapshot || null,
            source: 'trip_info',
            tripId: trip.id,
        });
        if (!importUrl) {
            showToast('No generation input snapshot found for benchmark export.', {
                tone: 'neutral',
                title: 'Benchmark export unavailable',
            });
            return;
        }
        trackEvent('trip_generation__trip_info--open_benchmark', {
            trip_id: trip.id,
            flow: snapshot?.flow || 'unknown',
            source: 'trip_info_modal',
        });
        window.open(importUrl, '_blank', 'noopener,noreferrer');
    }, [showToast, trip.aiMeta?.generation?.inputSnapshot, trip.id]);

    const handleRetryGeneration = useCallback(async (
        source: 'trip_info' | 'trip_strip',
        modelIdOverride?: string | null,
        baseTripOverride?: ITrip,
    ) => {
        if (isRetryingGeneration || retryMutationInFlightRef.current) return;
        const baseTrip = baseTripOverride || trip;
        const selectedRetryModelId = modelIdOverride || retryModelId || null;
        if (source === 'trip_info') {
            trackEvent('trip_generation__trip_info--retry', {
                trip_id: trip.id,
                source,
                model_id: selectedRetryModelId || 'default',
            });
        }
        if (!canEdit) {
            showToast(t('tripView.generation.retry.readOnly'), {
                tone: 'neutral',
                title: t('tripView.generation.retry.readOnlyTitle'),
            });
            return;
        }
        if (!baseTrip.aiMeta?.generation?.inputSnapshot) {
            showToast(t('tripView.generation.retry.missingSnapshot'), {
                tone: 'neutral',
                title: t('tripView.generation.retry.missingSnapshotTitle'),
            });
            return;
        }

        retryMutationInFlightRef.current = true;
        setIsRetryingGeneration(true);
        retryGenerationTabFeedbackSessionRef.current?.cancel();
        retryGenerationTabFeedbackSessionRef.current = beginTripGenerationTabFeedback();
        pendingRetryGenerationStateRef.current = true;
        let keepRetryFeedbackActive = false;
        try {
            const result = await retryTripGenerationWithDefaultModel(baseTrip, {
                source: source === 'trip_info' ? 'trip_info_modal' : 'trip_status_strip',
                contextSource: 'trip_retry',
                modelId: selectedRetryModelId,
                onTripUpdate: (updatedTrip) => {
                    if (shouldPollTripGenerationState(updatedTrip, Date.now())) {
                        pendingRetryGenerationStateRef.current = false;
                    }
                    onUpdateTrip(updatedTrip);
                },
            });

            if (onCommitState) {
                onCommitState(
                    result.trip,
                    result.trip.defaultView ?? currentViewSettings,
                    {
                        label: result.state === 'queued'
                            ? 'Data: Retried trip generation'
                            : 'Data: Retried trip generation (failed)',
                        adminOverride: isAdminFallbackView && adminOverrideEnabled,
                    }
                );
            }

            if (result.state === 'queued') {
                keepRetryFeedbackActive = true;
                showToast(t('tripView.generation.retry.queued'), {
                    tone: 'neutral',
                    title: t('tripView.generation.retry.queuedTitle'),
                });
            } else if (result.state === 'succeeded') {
                retryGenerationTabFeedbackSessionRef.current?.complete('success', {
                    title: result.trip.title,
                });
                showToast(t('tripView.generation.retry.completed'), {
                    tone: 'add',
                    title: t('tripView.generation.retry.completedTitle'),
                });
            } else {
                pendingRetryGenerationStateRef.current = false;
                retryGenerationTabFeedbackSessionRef.current?.complete('error');
                showToast(t('tripView.generation.retry.failed'), {
                    tone: 'neutral',
                    title: t('tripView.generation.retry.failedTitle'),
                });
            }
        } catch (error) {
            pendingRetryGenerationStateRef.current = false;
            retryGenerationTabFeedbackSessionRef.current?.complete('error');
            showToast(error instanceof Error ? error.message : t('tripView.generation.retry.unexpected'), {
                tone: 'neutral',
                title: t('tripView.generation.retry.failedTitle'),
            });
        } finally {
            setIsRetryingGeneration(false);
            retryMutationInFlightRef.current = false;
            if (!keepRetryFeedbackActive) {
                retryGenerationTabFeedbackSessionRef.current = null;
                pendingRetryGenerationStateRef.current = false;
            }
        }
    }, [
        adminOverrideEnabled,
        canEdit,
        currentViewSettings,
        isAdminFallbackView,
        isRetryingGeneration,
        onCommitState,
        onUpdateTrip,
        retryModelId,
        showToast,
        t,
        trip,
    ]);

    const handleAbortAndRetryGeneration = useCallback(async () => {
        if (isRetryingGeneration) return;
        const snapshot = trip.aiMeta?.generation?.inputSnapshot;
        if (!snapshot) {
            showToast(t('tripView.generation.retry.missingSnapshot'), {
                tone: 'neutral',
                title: t('tripView.generation.retry.missingSnapshotTitle'),
            });
            return;
        }
        const latestRequestId = latestGenerationAttempt?.requestId || null;
        const abortedLiveRequest = abortActiveTripGenerationRequest({
            tripId: trip.id,
            requestId: latestRequestId,
            reason: 'user_abort_retry',
        });

        const abortedTrip = markTripGenerationFailed(trip, {
            flow: snapshot.flow,
            source: 'trip_status_strip_abort_retry',
            requestId: latestRequestId,
            attemptId: latestGenerationAttempt?.id || null,
            provider: latestGenerationAttempt?.provider || trip.aiMeta?.provider || null,
            model: latestGenerationAttempt?.model || trip.aiMeta?.model || null,
            providerModel: latestGenerationAttempt?.providerModel || null,
            error: {
                code: 'AI_GENERATION_ABORTED_BY_USER',
                status: 499,
                message: abortedLiveRequest
                    ? 'Generation aborted by user after prolonged runtime.'
                    : 'Generation marked as aborted by user after prolonged runtime.',
                failureKind: 'abort',
                aborted: true,
            },
            metadata: {
                abortedByUser: true,
                abortedLiveRequest,
                selectedRetryModelId: retryModelId || null,
            },
        });

        onUpdateTrip(abortedTrip);
        if (onCommitState) {
            onCommitState(
                abortedTrip,
                abortedTrip.defaultView ?? currentViewSettings,
                {
                    label: 'Data: Aborted long-running generation',
                    adminOverride: isAdminFallbackView && adminOverrideEnabled,
                }
            );
        }

        trackEvent('trip_generation__trip_strip--abort_retry', {
            trip_id: trip.id,
            had_live_abort: abortedLiveRequest,
            model_id: retryModelId || 'default',
        });

        await handleRetryGeneration('trip_strip', retryModelId, abortedTrip);
    }, [
        adminOverrideEnabled,
        currentViewSettings,
        handleRetryGeneration,
        isAdminFallbackView,
        isRetryingGeneration,
        latestGenerationAttempt?.id,
        latestGenerationAttempt?.model,
        latestGenerationAttempt?.provider,
        latestGenerationAttempt?.providerModel,
        latestGenerationAttempt?.requestId,
        onCommitState,
        onUpdateTrip,
        retryModelId,
        showToast,
        t,
        trip,
    ]);

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

    const safeUpdateTrip = useCallback((updatedTrip: ITrip, options?: { persist?: boolean; preserveUpdatedAt?: boolean }) => {
        if (!requireEdit()) return;
        onUpdateTrip(updatedTrip, options);
    }, [onUpdateTrip, requireEdit]);

    const showSavedToastForLabel = useCallback((label: string) => {
        const tone = resolveChangeTone(label);
        const { label: actionLabel } = getToneMeta(tone);
        showToast(stripHistoryPrefix(label), { tone, title: actionLabel });
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
    navigateHistoryRef.current = navigateHistory;

    const setPendingLabel = useCallback((label: string) => {
        pendingHistoryLabelRef.current = label;
    }, []);

    const markUserEdit = useCallback(() => {
        suppressCommitRef.current = false;
    }, []);

    const { debugHistory } = useTripHistoryDebugTools({ isDev: IS_DEV });

    const {
        isEditingTitle,
        setIsEditingTitle,
        editTitleValue,
        setEditTitleValue,
    } = useTripTitleEditorState();
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
        removeLocalStorageItem('tf_country_info_expanded');
    }, []);

    useTripViewSettingsSync({
        layoutMode,
        timelineMode,
        timelineView,
        mapDockMode,
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
        setTimelineMode,
        setTimelineView,
        setMapDockMode,
        setZoomLevel,
        setSidebarWidth,
        setTimelineHeight,
        setShowCityNames,
        suppressCommitRef,
        skipViewDiffRef,
        appliedViewKeyRef,
        prevViewRef,
    });

    const resolveMapDockModeLabel = useCallback((
        fromMode: 'docked' | 'floating',
        toMode: 'docked' | 'floating',
    ): string => (
        t('tripView.visualHistory.mapPreviewState', {
            from: t(`tripView.visualHistory.mapPreviewStateValue.${fromMode}`),
            to: t(`tripView.visualHistory.mapPreviewStateValue.${toMode}`),
        })
    ), [t]);

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

    const tripMeta = useMemo(() => buildTripMetaSummary(trip), [trip.items, trip.startDate]);
    const tripSummary = tripMeta.summaryLine;
    const isGenerationInFlight = generationState === 'running' || generationState === 'queued';
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
        && isGenerationInFlight
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

    const {
        activeShareUrl,
        handleShare,
        handleCopyShareLink,
        handleGenerateShare,
    } = useTripShareActions({
        canShare,
        isTripLockedByExpiry,
        tripId: trip.id,
        trip,
        currentViewSettings,
        shareMode,
        shareUrlsByMode,
        setShareUrlsByMode,
        setIsShareOpen,
        setIsGeneratingShare,
        showToast,
    });

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

    const scheduleCommit = useCallback((
        nextTrip?: ITrip,
        nextView?: IViewSettings,
        options?: CommitScheduleOptions,
    ) => {
        if (!canEdit) return;
        if (isExamplePreview) return;
        if (suppressCommitRef.current) {
            suppressCommitRef.current = false;
            debugHistory('Suppressed commit due to popstate');
            return;
        }
        const tripToCommit = nextTrip || trip;
        const viewToCommit = nextView || currentViewSettings;
        pendingCommitRef.current = { trip: tripToCommit, view: viewToCommit, skipToast: options?.skipToast };
        debugHistory('Scheduled commit', { label: pendingHistoryLabelRef.current || 'Data: Updated trip' });

        if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
        const pendingLabel = pendingHistoryLabelRef.current || 'Data: Updated trip';
        const commitDelay = /^Data:\s+/i.test(pendingLabel) ? 150 : 700;
        commitTimerRef.current = setTimeout(() => {
            const payload = pendingCommitRef.current || { trip: tripToCommit, view: viewToCommit, skipToast: options?.skipToast };
            const label = pendingHistoryLabelRef.current || 'Data: Updated trip';
            debugHistory('Committing', { label });
            if (onCommitState) {
                onCommitState(payload.trip, payload.view, {
                    replace: false,
                    label,
                    adminOverride: isAdminFallbackView && adminOverrideEnabled,
                });
            }
            pendingHistoryLabelRef.current = null;
            if (onCommitState) {
                refreshHistory();
            }
            if (!payload.skipToast) {
                showSavedToastForLabel(label);
            }
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

        const {
            changes,
            isAutoZoomOnlyChange,
        } = resolveVisualDiff({
            previous: prev,
            current: currentViewSettings,
            zoomChangeSource: zoomChangeSourceRef.current,
            resolveMapDockModeLabel,
        });

        if (isAutoZoomOnlyChange) {
            if (
                commitTimerRef.current
                && pendingCommitRef.current
                && pendingHistoryLabelRef.current
                && /^Visual:\s*/i.test(pendingHistoryLabelRef.current)
            ) {
                pendingCommitRef.current = {
                    ...pendingCommitRef.current,
                    view: currentViewSettings,
                };
                debugHistory('Merged auto-fit zoom into pending visual commit');
            }
            prevViewRef.current = currentViewSettings;
            zoomChangeSourceRef.current = null;
            return;
        }

        const nextVisualLabel = buildVisualHistoryLabel(pendingHistoryLabelRef.current, changes);
        if (nextVisualLabel) {
            setPendingLabel(nextVisualLabel);
            scheduleCommit(undefined, currentViewSettings);
        }

        prevViewRef.current = currentViewSettings;
        zoomChangeSourceRef.current = null;
    }, [currentViewSettings, debugHistory, resolveMapDockModeLabel, setPendingLabel, scheduleCommit]);

    const { handleToggleFavorite } = useTripFavoriteHandler({
        trip,
        currentViewSettings,
        requireEdit,
        markUserEdit,
        setPendingLabel,
        safeUpdateTrip,
        scheduleCommit,
        showToast,
    });

    const handleUpdateItems = useTripUpdateItemsHandler({
        trip,
        currentViewSettings,
        markUserEdit,
        safeUpdateTrip,
        setPendingLabel,
        pendingHistoryLabelRef,
        scheduleCommit,
        normalizeOffsetsForTrip: normalizeNegativeOffsetsForTrip,
    });

    const {
        selectedCitiesInTimeline,
        showSelectedCitiesPanel,
        detailsPanelVisible,
        clearSelection,
        handleTimelineSelect,
        applySelectedCityOrder,
        handleReverseSelectedCities,
    } = useTripSelectionController({
        tripItems: trip.items,
        displayTripItems: displayTrip.items,
        selectedItemId,
        setSelectedItemId,
        selectedCityIds,
        setSelectedCityIds,
        isHistoryOpen,
        isTripInfoOpen,
        setPendingLabel,
        handleUpdateItems,
    });

    const handleMapCitySelect = useCallback((cityId: string) => {
        handleTimelineSelect(cityId, { isCity: true });
    }, [handleTimelineSelect]);

    const handleMapActivitySelect = useCallback((activityId: string) => {
        handleTimelineSelect(activityId, { isCity: false });
    }, [handleTimelineSelect]);

    const {
        routeStatusById,
        handleRouteMetrics,
        handleRouteStatus,
        clearRouteStatusForItem,
    } = useTripRouteStatusState({
        tripRef,
        pendingCommitRef,
        onUpdateTrip,
    });

    const {
        handleUpdateItem,
        handleBatchItemUpdate,
        handleCityColorPaletteChange,
        handleMapColorModeChange,
    } = useTripItemUpdateHandlers({
        trip,
        cityColorPaletteId,
        mapColorMode,
        currentViewSettings,
        requireEdit,
        markUserEdit,
        setPendingLabel,
        handleUpdateItems,
        clearRouteStatusForItem,
        safeUpdateTrip,
        scheduleCommit,
    });

    const {
        handleForceFill,
        selectedCityForceFill,
    } = useTripCityForceFill({
        tripItems: trip.items,
        selectedItemId,
        setPendingLabel,
        handleUpdateItems,
    });

    const {
        handleDeleteItem,
        handleOpenAddCity,
        handleOpenAddActivity,
        handleAddActivityItem,
        handleAddCityItem,
    } = useTripItemMutationHandlers({
        trip,
        addActivityState,
        setAddActivityState,
        isAddCityModalOpen,
        setIsAddCityModalOpen,
        isHistoryOpen,
        selectedItemId,
        setSelectedItemId,
        setSelectedCityIds,
        requireEdit,
        markUserEdit,
        setPendingLabel,
        handleUpdateItems,
        showToast,
        pendingHistoryLabelRef,
        onUndoDelete: (deletedItem, context) => {
            const deletedEntityLabel = deletedItem.type === 'city'
                ? `city "${deletedItem.title}"`
                : deletedItem.type === 'activity'
                    ? `activity "${deletedItem.title}"`
                    : `transport "${deletedItem.title}"`;
            const didUndoImmediately = navigateHistory('undo', { silent: true });
            if (didUndoImmediately) {
                showToast(`Undid removal of ${deletedEntityLabel}`, {
                    tone: 'add',
                    title: 'Undo',
                    iconVariant: 'undo',
                    disableDefaultUndo: true,
                });
                return;
            }

            window.setTimeout(() => {
                const didUndoAfterCommit = navigateHistory('undo', { silent: true });
                if (didUndoAfterCommit) {
                    showToast(`Undid removal of ${deletedEntityLabel}`, {
                        tone: 'add',
                        title: 'Undo',
                        iconVariant: 'undo',
                        disableDefaultUndo: true,
                    });
                    return;
                }

                setPendingLabel(`Data: Restored ${deletedEntityLabel}`);
                handleUpdateItems(context.previousItems, { suppressCommitToast: true });
                showToast(`Restored ${deletedEntityLabel}`, {
                    tone: 'add',
                    title: 'Undo',
                    iconVariant: 'undo',
                    disableDefaultUndo: true,
                });
            }, 200);
        },
        onResetSuppressedCommit: () => {
            suppressCommitRef.current = false;
        },
    });

    const {
        verticalLayoutTimelineRef,
        startResizing,
        handleSidebarResizeKeyDown,
        handleDetailsResizeKeyDown,
        handleTimelineResizeKeyDown,
    } = useTripResizeControls({
        layoutMode,
        mapDockMode,
        timelineMode,
        timelineView,
        horizontalTimelineDayCount,
        zoomLevel,
        isZoomDirty,
        clampZoomLevel,
        setZoomLevel,
        sidebarWidth,
        setSidebarWidth,
        detailsWidth,
        setDetailsWidth,
        timelineHeight,
        setTimelineHeight,
        detailsPanelVisible,
        minSidebarWidth: MIN_SIDEBAR_WIDTH,
        minTimelineHeight: MIN_TIMELINE_HEIGHT,
        minBottomMapHeight: MIN_BOTTOM_MAP_HEIGHT,
        minMapWidth: MIN_MAP_WIDTH,
        minTimelineColumnWidth: MIN_TIMELINE_COLUMN_WIDTH,
        minDetailsWidth: MIN_DETAILS_WIDTH,
        hardMinDetailsWidth: HARD_MIN_DETAILS_WIDTH,
        resizerWidth: RESIZER_WIDTH,
        resizeKeyboardStep: RESIZE_KEYBOARD_STEP,
        horizontalTimelineAutoFitPadding: HORIZONTAL_TIMELINE_AUTO_FIT_PADDING,
        verticalTimelineAutoFitPadding: VERTICAL_TIMELINE_AUTO_FIT_PADDING,
        zoomLevelPresets: TIMELINE_ZOOM_LEVEL_PRESETS,
        basePixelsPerDay: BASE_PIXELS_PER_DAY,
        onAutoFitZoomApplied: markAutoFitZoomChange,
    });

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
    const showOwnedTripConnectivityStatus = !shareStatus && !isExamplePreview && !isAdminFallbackView;
    const latestConflictBackupEntry = useMemo(() => {
        if (!showOwnedTripConnectivityStatus) return null;
        return getLatestConflictBackupForTrip(trip.id);
    }, [showOwnedTripConnectivityStatus, syncSnapshot.hasConflictBackups, syncSnapshot.lastRunAt, trip.id]);
    const isAdminSession = access?.role === 'admin';
    const ownerSummary = useMemo(() => {
        const ownerUsername = tripAccess?.ownerUsername?.trim() || null;
        const ownerEmail = tripAccess?.ownerEmail?.trim() || null;
        const ownerId = tripAccess?.ownerId?.trim() || null;
        const currentUserId = access?.userId?.trim() || null;
        const currentUsername = profile?.username?.trim() || null;
        const isOwner = Boolean(
            tripAccess?.source === 'owner'
            || (ownerId && currentUserId && ownerId === currentUserId)
        );

        if (ownerUsername) {
            const normalizedHandle = ownerUsername.startsWith('@') ? ownerUsername : `@${ownerUsername}`;
            return `${normalizedHandle}${isOwner ? ' (you)' : ''}`;
        }
        if (ownerEmail) {
            return `${ownerEmail}${isOwner ? ' (you)' : ''}`;
        }
        if (ownerId && isAdminSession) {
            return `${ownerId}${isOwner ? ' (you)' : ''}`;
        }
        if (isOwner && currentUsername) {
            const normalizedHandle = currentUsername.startsWith('@') ? currentUsername : `@${currentUsername}`;
            return `${normalizedHandle} (you)`;
        }
        if (isOwner) return 'You';
        if (ownerId) return 'Traveler';
        return null;
    }, [
        isAdminSession,
        access?.userId,
        profile?.username,
        tripAccess?.ownerEmail,
        tripAccess?.ownerId,
        tripAccess?.ownerUsername,
        tripAccess?.source,
    ]);
    const tripOwnerAdminMeta = useMemo(() => {
        if (!isAdminSession) return null;
        const ownerUserId = (tripAccess?.ownerId?.trim() || access?.userId?.trim() || null);
        const ownerUsername = (tripAccess?.ownerUsername?.trim() || profile?.username?.trim() || null);
        const ownerEmail = (tripAccess?.ownerEmail?.trim() || access?.email?.trim() || null);
        const accessSource = tripAccess?.source || (ownerUserId ? 'owner' : null);
        return {
            ownerUserId,
            ownerUsername,
            ownerEmail,
            accessSource,
        };
    }, [isAdminSession, tripAccess?.ownerId, tripAccess?.ownerUsername, tripAccess?.ownerEmail, tripAccess?.source, access?.userId, access?.email, profile?.username]);
    const ownerHint = useMemo(() => {
        if (tripAccess?.source === 'public_read') {
            return 'You are viewing a public trip owned by another account. Archive and edit actions are disabled.';
        }
        if (tripAccess?.source === 'admin_fallback' && !adminOverrideEnabled) {
            return 'This is an admin fallback view. Enable admin override above to edit as an admin.';
        }
        return null;
    }, [adminOverrideEnabled, tripAccess?.source]);

    const timelineCanvas = (
        <TripTimelineCanvas
            timelineMode={timelineMode}
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

    const { handleStartTitleEdit, handleCommitTitleEdit } = useTripTitleEditHandlers({
        canManageTripMetadata,
        isMobile,
        isEditingTitle,
        editTitleValue,
        trip,
        currentViewSettings,
        editTitleInputRef,
        setEditTitleValue,
        setIsEditingTitle,
        requireEdit,
        markUserEdit,
        setPendingLabel,
        safeUpdateTrip,
        scheduleCommit,
    });

    const selectedDetailItem = useMemo(
        () => displayTrip.items.find((item) => item.id === selectedItemId) ?? null,
        [displayTrip.items, selectedItemId]
    );
    const selectedRouteStatus = useMemo(
        () => (selectedItemId ? routeStatusById[selectedItemId] : undefined),
        [routeStatusById, selectedItemId]
    );
    const handleTripCalendarExport = useCallback((
        scope: TripCalendarExportScope,
        source: 'details_panel' | 'trip_info_modal' | 'print_view',
        activityId?: string,
    ) => {
        const bundle = buildTripCalendarExport({
            trip: displayTrip,
            scope,
            activityId,
        });
        if (!bundle) return;
        const downloaded = downloadTripCalendarExport(bundle);
        if (!downloaded) return;

        trackEvent(TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE[scope], {
            trip_id: trip.id,
            source,
            event_count: bundle.eventCount,
            ...(activityId ? { item_id: activityId } : {}),
        });
    }, [displayTrip, trip.id]);

    const handleExportSelectedActivityCalendar = useCallback((itemId: string) => {
        handleTripCalendarExport('activity', 'details_panel', itemId);
    }, [handleTripCalendarExport]);

    const handleExportActivitiesCalendar = useCallback((source: 'trip_info_modal' | 'print_view') => {
        handleTripCalendarExport('activities', source);
    }, [handleTripCalendarExport]);

    const handleExportCitiesCalendar = useCallback((source: 'trip_info_modal' | 'print_view') => {
        handleTripCalendarExport('cities', source);
    }, [handleTripCalendarExport]);

    const handleExportAllCalendar = useCallback((source: 'trip_info_modal' | 'print_view') => {
        handleTripCalendarExport('all', source);
    }, [handleTripCalendarExport]);

    const detailsPanelContent = renderDetailsPanelContent({
        showSelectedCitiesPanel,
        selectedCitiesInTimeline,
        onCloseSelection: clearSelection,
        onApplySelectedCityOrder: applySelectedCityOrder,
        onReverseSelectedCities: handleReverseSelectedCities,
        timelineView,
        canEdit,
        selectedDetailItem,
        selectedItemId,
        onUpdateItem: handleUpdateItem,
        onBatchUpdateItem: handleBatchItemUpdate,
        onDeleteItem: handleDeleteItem,
        tripStartDate: trip.startDate,
        displayItems: displayTrip.items,
        routeMode,
        selectedRouteStatus,
        onForceFill: handleForceFill,
        selectedCityForceFillMode: selectedCityForceFill?.mode,
        selectedCityForceFillLabel: selectedCityForceFill?.label,
        cityColorPaletteId,
        onCityColorPaletteChange: canEdit ? handleCityColorPaletteChange : undefined,
        onExportActivityCalendar: handleExportSelectedActivityCalendar,
    });

    if (viewMode === 'print') {
        return (
            <GoogleMapsLoader language={appLanguage}>
                <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center text-sm text-gray-500">Preparing print layout...</div>}>
                    <PrintLayout
                        trip={displayTrip}
                        isPaywalled={isPaywallLocked}
                        onClose={() => setViewMode('planner')}
                        onUpdateTrip={handleUpdateItems}
                        onExportActivitiesCalendar={() => handleExportActivitiesCalendar('print_view')}
                        onExportCitiesCalendar={() => handleExportCitiesCalendar('print_view')}
                        onExportAllCalendar={() => handleExportAllCalendar('print_view')}
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
                    paywallActivationMode={paywallActivationMode}
                    onPaywallActivateClick={handlePaywallActivateClick}
                    tripId={trip.id}
                    connectivityState={showOwnedTripConnectivityStatus ? connectivitySnapshot.state : undefined}
                    connectivityReason={showOwnedTripConnectivityStatus ? connectivitySnapshot.reason : null}
                    connectivityForced={showOwnedTripConnectivityStatus ? connectivitySnapshot.isForced : false}
                    pendingSyncCount={showOwnedTripConnectivityStatus ? syncSnapshot.pendingCount : 0}
                    failedSyncCount={showOwnedTripConnectivityStatus ? syncSnapshot.failedCount : 0}
                    isSyncingQueue={showOwnedTripConnectivityStatus ? syncSnapshot.isSyncing : false}
                    onRetrySyncQueue={showOwnedTripConnectivityStatus
                        ? (() => {
                            void retrySyncNow();
                        })
                        : undefined}
                    hasConflictBackupForTrip={showOwnedTripConnectivityStatus ? Boolean(latestConflictBackupEntry) : false}
                    onRestoreConflictBackup={showOwnedTripConnectivityStatus && latestConflictBackupEntry ? handleRestoreServerBackup : undefined}
                    generationState={generationState}
                    generationElapsedMs={generationElapsedMs}
                    generationTimeoutMs={TRIP_GENERATION_TIMEOUT_MS}
                    generationFailureMessage={latestGenerationAttempt?.errorMessage || null}
                    pendingAuthQueueRequestId={pendingAuthQueueRequestId}
                    canRetryGeneration={canRetryGeneration}
                    canAbortAndRetryGeneration={canAbortAndRetryGeneration}
                    isRetryingGeneration={isRetryingGeneration}
                    isResolvingPendingAuthGeneration={isResolvingPendingAuthGeneration}
                    onResolvePendingAuthGeneration={() => {
                        void handleResolvePendingAuthGeneration();
                    }}
                    onAbortAndRetryGeneration={() => {
                        void handleAbortAndRetryGeneration();
                    }}
                    onOpenRetryModelSelector={() => {
                        trackEvent('trip_generation__trip_strip--change_model', {
                            trip_id: trip.id,
                            source: 'trip_strip',
                        });
                        openTripInfoModal();
                    }}
                    onRetryGeneration={() => {
                        void handleRetryGeneration('trip_strip');
                    }}
                    exampleTripBanner={exampleTripBanner}
                />

                {/* Main Content */}
                <main className="flex-1 relative overflow-hidden flex flex-col">
                    <TripViewPlannerWorkspace
                        isPaywallLocked={isPaywallLocked}
                        isMobile={isMobile}
                        isMobileMapExpanded={isMobileMapExpanded}
                        onCloseMobileMap={() => setIsMobileMapExpanded(false)}
                        onToggleMobileMapExpanded={() => setIsMobileMapExpanded((value) => !value)}
                        timelineCanvas={timelineCanvas}
                        onTimelineTouchStart={handleTimelineTouchStart}
                        onTimelineTouchMove={handleTimelineTouchMove}
                        onTimelineTouchEnd={handleTimelineTouchEnd}
                        onZoomOut={() => {
                            trackEvent('trip_view__zoom', {
                                direction: 'out',
                                trip_id: trip.id,
                                timeline_mode: timelineMode,
                            });
                            markZoomDirty();
                            setZoomLevel((value) => clampZoomLevel(value - 0.1));
                        }}
                        onZoomIn={() => {
                            trackEvent('trip_view__zoom', {
                                direction: 'in',
                                trip_id: trip.id,
                                timeline_mode: timelineMode,
                            });
                            markZoomDirty();
                            setZoomLevel((value) => clampZoomLevel(value + 0.1));
                        }}
                        onTimelineModeChange={(mode) => {
                            if (mode === timelineMode) return;
                            trackEvent(mode === 'calendar' ? 'trip_view__mode--calendar' : 'trip_view__mode--timeline', {
                                trip_id: trip.id,
                            });
                            setTimelineMode(mode);
                        }}
                        onTimelineViewChange={(view) => {
                            if (view === timelineView) return;
                            trackEvent(
                                view === 'horizontal'
                                    ? 'trip_view__layout_direction--horizontal'
                                    : 'trip_view__layout_direction--vertical',
                                { trip_id: trip.id, target: 'timeline' }
                            );
                            setTimelineView(view);
                        }}
                        mapDockMode={mapDockMode}
                        onMapDockModeChange={(mode) => {
                            if (mode === mapDockMode) return;
                            trackEvent(
                                mode === 'floating'
                                    ? 'trip_view__map_preview--minimize'
                                    : 'trip_view__map_preview--maximize',
                                {
                                    trip_id: trip.id,
                                    layout_mode: layoutMode,
                                }
                            );
                            runWithOptionalViewTransition(() => {
                                setMapDockMode(mode);
                            });
                        }}
                        timelineMode={timelineMode}
                        timelineView={timelineView}
                        mapViewportRef={mapViewportRef}
                        isMapBootstrapEnabled={isMapBootstrapEnabled}
                        ItineraryMapComponent={ItineraryMap}
                        mapLoadingFallback={<MapLoadingFallback />}
                        mapDeferredFallback={<MapDeferredFallback onLoadNow={enableMapBootstrap} />}
                        displayItems={displayTrip.items}
                        selectedItemId={selectedItemId}
                        onMapCitySelect={handleMapCitySelect}
                        onMapActivitySelect={handleMapActivitySelect}
                        layoutMode={layoutMode}
                        effectiveLayoutMode={effectiveLayoutMode}
                        onLayoutModeChange={(mode) => {
                            if (mode === layoutMode) return;
                            trackEvent(
                                mode === 'horizontal'
                                    ? 'trip_view__layout_direction--horizontal'
                                    : 'trip_view__layout_direction--vertical',
                                { trip_id: trip.id, target: 'map' }
                            );
                            setLayoutMode(mode);
                        }}
                        mapStyle={mapStyle}
                        onMapStyleChange={setMapStyle}
                        routeMode={routeMode}
                        onRouteModeChange={setRouteMode}
                        showCityNames={showCityNames}
                        onShowCityNamesChange={setShowCityNames}
                        mapColorMode={mapColorMode}
                        onMapColorModeChange={allowMapColorModeControls ? handleMapColorModeChange : undefined}
                        initialMapFocusQuery={initialMapFocusQuery}
                        onRouteMetrics={handleRouteMetrics}
                        onRouteStatus={handleRouteStatus}
                        tripId={trip.id}
                        mapViewTransitionName={mapViewTransitionName}
                        sidebarWidth={sidebarWidth}
                        detailsWidth={detailsWidth}
                        timelineHeight={timelineHeight}
                        detailsPanelVisible={detailsPanelVisible}
                        detailsPanelContent={detailsPanelContent}
                        verticalLayoutTimelineRef={verticalLayoutTimelineRef}
                        onStartResizing={startResizing}
                        onSidebarResizeKeyDown={handleSidebarResizeKeyDown}
                        onDetailsResizeKeyDown={handleDetailsResizeKeyDown}
                        onTimelineResizeKeyDown={handleTimelineResizeKeyDown}
                    />
                    <TripViewModalLayer
                        isMobile={isMobile}
                        detailsPanelVisible={detailsPanelVisible}
                        detailsPanelContent={detailsPanelContent}
                        onCloseDetailsDrawer={clearSelection}
                        addActivityState={addActivityState}
                        onCloseAddActivity={() => setAddActivityState({ ...addActivityState, isOpen: false })}
                        onAddActivity={handleAddActivityItem}
                        trip={trip}
                        isAddCityModalOpen={isAddCityModalOpen}
                        onCloseAddCityModal={() => setIsAddCityModalOpen(false)}
                        onAddCity={(name, lat, lng) => handleAddCityItem({ title: name, coordinates: { lat, lng } })}
                        isTripInfoOpen={isTripInfoOpen}
                        onCloseTripInfo={closeTripInfoModal}
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
                        ownerSummary={ownerSummary}
                        ownerHint={ownerHint}
                        adminMeta={tripOwnerAdminMeta}
                        aiMeta={displayTrip.aiMeta}
                        generationState={generationState}
                        latestGenerationAttempt={latestGenerationAttempt}
                        canRetryGeneration={canRetryGeneration}
                        isRetryingGeneration={isRetryingGeneration}
                        retryModelId={retryModelId}
                        onRetryModelIdChange={setRetryModelId}
                        onRetryGeneration={handleRetryGeneration}
                        onOpenBenchmarkWithSnapshot={handleOpenBenchmarkWithSnapshot}
                        canOpenBenchmarkWithSnapshot={Boolean(displayTrip.aiMeta?.generation?.inputSnapshot)}
                        tripInfoRetryAnalyticsAttributes={tripInfoRetryAnalyticsAttributes}
                        forkMeta={forkMeta}
                        isTripInfoHistoryExpanded={isTripInfoHistoryExpanded}
                        onToggleTripInfoHistoryExpanded={() => setIsTripInfoHistoryExpanded((value) => !value)}
                        showAllHistory={showAllHistory}
                        onToggleShowAllHistory={() => setShowAllHistory((value) => !value)}
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
                        onExportActivitiesCalendar={() => handleExportActivitiesCalendar('trip_info_modal')}
                        onExportCitiesCalendar={() => handleExportCitiesCalendar('trip_info_modal')}
                        onExportAllCalendar={() => handleExportAllCalendar('trip_info_modal')}
                        shouldEnableReleaseNotice={shouldEnableReleaseNotice}
                        isShareOpen={isShareOpen}
                        shareMode={shareMode}
                        onShareModeChange={setShareMode}
                        activeShareUrl={activeShareUrl}
                        onCloseShare={() => setIsShareOpen(false)}
                        onCopyShareLink={handleCopyShareLink}
                        onGenerateShare={handleGenerateShare}
                        isGeneratingShare={isGeneratingShare}
                        isHistoryOpen={isHistoryOpen}
                        historyModalItems={historyModalItems}
                        pendingSyncCount={showOwnedTripConnectivityStatus ? syncSnapshot.pendingCount : 0}
                        failedSyncCount={showOwnedTripConnectivityStatus ? syncSnapshot.failedCount : 0}
                        onCloseHistory={() => setIsHistoryOpen(false)}
                        onHistoryGo={(item) => {
                            setIsHistoryOpen(false);
                            suppressCommitRef.current = true;
                            navigate(item.url);
                            showToast(item.details, { tone: item.tone, title: 'Opened from history' });
                        }}
                        shareStatus={shareStatus}
                        onCopyTrip={onCopyTrip}
                        expirationLabel={expirationLabel}
                        tripId={trip.id}
                        paywallActivationMode={paywallActivationMode}
                        onPaywallActivateClick={handlePaywallActivateClick}
                        showGenerationOverlay={showGenerationOverlay}
                        generationProgressMessage={generationProgressMessage}
                        loadingDestinationSummary={loadingDestinationSummary}
                        tripDateRange={tripMeta.dateRange}
                        tripTotalDaysLabel={tripMeta.totalDaysLabel}
                    />

                </main>
            </div>
        </GoogleMapsLoader>
    );
};

export const TripView: React.FC<TripViewProps> = (props) => useTripViewRender(props);
