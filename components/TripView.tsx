import React, { useState, useRef, useCallback, useEffect, useMemo, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLanguage, ITrip, ITimelineItem, IViewSettings, ShareMode } from '../types';
import { GoogleMapsLoader } from './GoogleMapsLoader';
import { BASE_PIXELS_PER_DAY, DEFAULT_CITY_COLOR_PALETTE_ID, DEFAULT_DISTANCE_UNIT, buildShareUrl, formatDistance, getTimelineBounds, getTripDistanceKm, isInternalMapColorModeControlEnabled, normalizeMapColorMode } from '../utils';
import { getExampleMapViewTransitionName, getExampleTitleViewTransitionName } from '../shared/viewTransitionNames';
import { type DbTripAccessMetadata } from '../services/dbApi';
import {
    buildPaywalledTripDisplay,
} from '../config/paywall';
import { trackEvent } from '../services/analyticsService';
import { removeLocalStorageItem } from '../services/browserStorageService';
import { useLoginModal } from '../hooks/useLoginModal';
import { buildPathFromLocationParts } from '../services/authNavigationService';
import { useAuth } from '../hooks/useAuth';
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
    aiMeta: ITrip['aiMeta'];
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
    onCloseHistory: () => void;
    onHistoryGo: (item: any) => void;
    shareStatus?: ShareMode;
    onCopyTrip?: () => void;
    expirationLabel: string | null;
    tripId: string;
    onPaywallLoginClick: (
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
    aiMeta,
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
    onCloseHistory,
    onHistoryGo,
    shareStatus,
    onCopyTrip,
    expirationLabel,
    tripId,
    onPaywallLoginClick,
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
                    aiMeta={aiMeta}
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
            onPaywallLoginClick={onPaywallLoginClick}
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
    exampleTripBanner,
}: TripViewProps): React.ReactElement => {
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
    });

    const showToast = useCallback((message: string, options?: {
        tone?: ChangeTone;
        title?: string;
        iconVariant?: 'undo' | 'redo';
        action?: { label: string; onClick: () => void };
    }) => {
        if (suppressToasts) return;
        showAppToast({
            tone: options?.tone || 'info',
            title: options?.title || 'Saved',
            description: message,
            duration: 3200,
            iconVariant: options?.iconVariant,
            action: options?.action,
        });
    }, [suppressToasts]);

    useTripCopyNoticeToast({
        tripId: trip.id,
        showToast,
    });

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

    const tripMeta = useMemo(() => buildTripMetaSummary(trip), [trip.items, trip.startDate]);
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

    const scheduleCommit = useCallback((nextTrip?: ITrip, nextView?: IViewSettings) => {
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
        const commitDelay = /^Data:\s+/i.test(pendingLabel) ? 150 : 700;
        commitTimerRef.current = setTimeout(() => {
            const payload = pendingCommitRef.current || { trip: tripToCommit, view: viewToCommit };
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
                    });
                    return;
                }

                setPendingLabel(`Data: Restored ${deletedEntityLabel}`);
                handleUpdateItems(context.previousItems);
                showToast(`Restored ${deletedEntityLabel}`, {
                    tone: 'add',
                    title: 'Undo',
                    iconVariant: 'undo',
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
        timelineView,
        horizontalTimelineDayCount,
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
        basePixelsPerDay: BASE_PIXELS_PER_DAY,
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
                        onZoomOut={() => setZoomLevel((value) => clampZoomLevel(value - 0.1))}
                        onZoomIn={() => setZoomLevel((value) => clampZoomLevel(value + 0.1))}
                        onToggleTimelineView={() => setTimelineView((value) => (value === 'horizontal' ? 'vertical' : 'horizontal'))}
                        timelineView={timelineView}
                        mapViewportRef={mapViewportRef}
                        isMapBootstrapEnabled={isMapBootstrapEnabled}
                        ItineraryMapComponent={ItineraryMap}
                        mapLoadingFallback={<MapLoadingFallback />}
                        mapDeferredFallback={<MapDeferredFallback onLoadNow={enableMapBootstrap} />}
                        displayItems={displayTrip.items}
                        selectedItemId={selectedItemId}
                        layoutMode={layoutMode}
                        effectiveLayoutMode={effectiveLayoutMode}
                        onLayoutModeChange={setLayoutMode}
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
                        aiMeta={displayTrip.aiMeta}
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
                        onPaywallLoginClick={handlePaywallLoginClick}
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
