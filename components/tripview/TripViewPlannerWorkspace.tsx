import React, { Suspense, useCallback, useRef } from 'react';
import { ArrowLeftRight, ArrowUpDown, CalendarDays, Focus, Layers, List, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import { TripFloatingMapPreview } from './TripFloatingMapPreview';
import { TripMobilePlannerShell } from './TripMobilePlannerShell';

import type { ITimelineItem, ITrip, MapColorMode, MapStyle, RouteFailureReason, RouteMode, RouteStatus } from '../../types';

interface TripViewPlannerWorkspaceProps {
    isPaywallLocked: boolean;
    isMobile: boolean;
    /** Drives the mobile day planner; the desktop layout renders from `timelineCanvas`. */
    trip: ITrip;
    onSelectTimelineItem: (id: string | null, options?: { multi?: boolean; isCity?: boolean }) => void;
    onUpdateTimelineItem?: (itemId: string, patch: Partial<ITimelineItem>) => void;
    /** Writes a leg's transport, creating the travel item when it has none. */
    onSetLegTransport?: (
        leg: { fromCityId: string; toCityId: string; travelItemId: string | null },
        mode: string,
    ) => void;
    onAddTimelineActivity?: (dayOffset: number) => void;
    onOpenDiscover?: () => void;
    appLanguage?: string;
    timelineCanvas: React.ReactNode;
    onTimelineTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTimelineTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTimelineTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
    onZoomOut: () => void;
    onZoomIn: () => void;
    onTimelineModeChange: (mode: 'calendar' | 'timeline') => void;
    onTimelineViewChange: (view: 'horizontal' | 'vertical') => void;
    zoomLevel: number;
    mapDockMode: 'docked' | 'floating';
    onMapDockModeChange: (mode: 'docked' | 'floating') => void;
    timelineMode: 'calendar' | 'timeline';
    timelineView: 'horizontal' | 'vertical';
    mapViewportRef: React.RefObject<HTMLDivElement | null>;
    isMapBootstrapEnabled: boolean;
    ItineraryMapComponent: React.ComponentType<any>;
    mapLoadingFallback: React.ReactNode;
    mapDeferredFallback: React.ReactNode;
    displayItems: ITimelineItem[];
    selectedItemId: string | null;
    onMapCitySelect?: (cityId: string) => void;
    onMapActivitySelect?: (activityId: string) => void;
    /** Lets go of the current selection, restoring the whole-journey view. */
    onMapClearSelection?: () => void;
    /** Frame a selected city on its own plan and drop the rest of the journey. */
    cityFocusMode?: boolean;
    onOpenMapCustomize?: () => void;
    showActivityMarkers?: boolean;
    onShowActivityMarkersChange?: (enabled: boolean) => void;
    basemapDetail?: Record<string, boolean | undefined>;
    mapLookAxes?: { base: 'map' | 'satellite'; colorTheme: 'default' | 'faded' | 'monochrome'; lightPreset: 'dawn' | 'day' | 'dusk' | 'night' };
    tripOverlay?: Record<string, boolean | undefined>;
    todayDayOffset?: number | null;
    useGlobeProjection?: boolean;
    showTerrain?: boolean;
    mapPitch?: number;
    routeLineWeight?: number;
    isMapCustomizeOpen?: boolean;
    mapCustomizeLabel?: string;
    layoutMode: 'vertical' | 'horizontal';
    effectiveLayoutMode: 'vertical' | 'horizontal';
    onLayoutModeChange: (mode: 'vertical' | 'horizontal') => void;
    mapStyle: MapStyle;
    onMapStyleChange: (style: MapStyle) => void;
    routeMode: RouteMode;
    onRouteModeChange: (mode: RouteMode) => void;
    showCityNames: boolean;
    onShowCityNamesChange: (value: boolean) => void;
    mapColorMode: MapColorMode;
    onMapColorModeChange?: (mode: MapColorMode) => void;
    initialMapFocusQuery?: string;
    onRouteMetrics: (travelItemId: string, metrics: { routeDistanceKm?: number; routeDurationHours?: number; mode?: string; routeKey?: string }) => void;
    onRouteStatus: (travelItemId: string, status: RouteStatus, meta?: { mode?: string; routeKey?: string; reason?: RouteFailureReason }) => void;
    tripId: string;
    mapViewTransitionName: string | null;
    sidebarWidth: number;
    detailsWidth: number;
    timelineHeight: number;
    detailsPanelVisible: boolean;
    detailsPanelContent: React.ReactNode;
    verticalLayoutTimelineRef: React.RefObject<HTMLDivElement | null>;
    onStartResizing: (type: 'sidebar' | 'details' | 'timeline-h', startClientX?: number) => void;
    onSidebarResizeKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    onDetailsResizeKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    onTimelineResizeKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    floatingOverlayRightInset?: number;
    floatingOverlayLeftInset?: number;
}

const TRIP_FLOATING_MAP_PREVIEW_BETA_ENABLED = true;
const formatZoomLevelLabel = (value: number): string => `×${Number.isFinite(value) ? value.toFixed(1) : '1.0'}`;
const CONTROL_GROUP_CLASS_NAME = 'inline-flex flex-col items-center gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm backdrop-blur dark:shadow-none';
const CONTROL_TOGGLE_BUTTON_CLASS_NAME = 'inline-flex size-10 items-center justify-center rounded-lg transition-colors';
const CONTROL_TOGGLE_ACTIVE_CLASS_NAME = 'border-accent-700 bg-accent-600 text-white';
const CONTROL_TOGGLE_INACTIVE_CLASS_NAME = 'text-muted-foreground hover:bg-secondary hover:text-accent-600 dark:hover:text-accent-300';

export const TripViewPlannerWorkspace: React.FC<TripViewPlannerWorkspaceProps> = ({
    isPaywallLocked,
    isMobile,
    trip,
    onSelectTimelineItem,
    onUpdateTimelineItem,
    onSetLegTransport,
    onAddTimelineActivity,
    onOpenDiscover,
    appLanguage,
    timelineCanvas,
    onTimelineTouchStart,
    onTimelineTouchMove,
    onTimelineTouchEnd,
    onZoomOut,
    onZoomIn,
    onTimelineModeChange,
    onTimelineViewChange,
    zoomLevel,
    mapDockMode,
    onMapDockModeChange,
    timelineMode,
    timelineView,
    mapViewportRef,
    isMapBootstrapEnabled,
    ItineraryMapComponent,
    mapLoadingFallback,
    mapDeferredFallback,
    displayItems,
    selectedItemId,
    onMapCitySelect,
    onMapActivitySelect,
    onMapClearSelection,
    cityFocusMode,
    onOpenMapCustomize,
    showActivityMarkers,
    onShowActivityMarkersChange,
    basemapDetail,
    mapLookAxes,
    tripOverlay,
    todayDayOffset,
    useGlobeProjection,
    showTerrain,
    mapPitch,
    routeLineWeight,
    isMapCustomizeOpen,
    mapCustomizeLabel,
    layoutMode,
    effectiveLayoutMode,
    onLayoutModeChange,
    mapStyle,
    onMapStyleChange,
    routeMode,
    onRouteModeChange,
    showCityNames,
    onShowCityNamesChange,
    mapColorMode,
    onMapColorModeChange,
    initialMapFocusQuery,
    onRouteMetrics,
    onRouteStatus,
    tripId,
    mapViewTransitionName,
    sidebarWidth,
    detailsWidth,
    timelineHeight,
    detailsPanelVisible,
    detailsPanelContent,
    verticalLayoutTimelineRef,
    onStartResizing,
    onSidebarResizeKeyDown,
    onDetailsResizeKeyDown,
    onTimelineResizeKeyDown,
    floatingOverlayRightInset = 0,
    floatingOverlayLeftInset = 0,
}) => {
    const dockedMapAnchorRef = useRef<HTMLDivElement | null>(null);
    const isFloatingMapPreviewEnabled = !isMobile && TRIP_FLOATING_MAP_PREVIEW_BETA_ENABLED;
    const effectiveMapDockMode: 'docked' | 'floating' = isFloatingMapPreviewEnabled ? mapDockMode : 'docked';
    const plannerControlsLayerClassName = effectiveMapDockMode === 'floating' ? 'z-[30]' : 'z-[60]';
    const dockedGeometryKey = `${effectiveLayoutMode}:${layoutMode}:${sidebarWidth}:${detailsWidth}:${timelineHeight}:${detailsPanelVisible ? '1' : '0'}`;
    const floatingMapReservedRightInset = effectiveMapDockMode === 'floating'
        ? Math.max(detailsPanelVisible ? detailsWidth + 4 : 0, floatingOverlayRightInset)
        : 0;
    const floatingMapReservedLeftInset = effectiveMapDockMode === 'floating' ? floatingOverlayLeftInset : 0;

    const toggleMapDockMode = useCallback(() => {
        if (!isFloatingMapPreviewEnabled) return;
        onMapDockModeChange(effectiveMapDockMode === 'docked' ? 'floating' : 'docked');
    }, [effectiveMapDockMode, isFloatingMapPreviewEnabled, onMapDockModeChange]);
    const effectiveMapViewTransitionName = mapViewTransitionName && mapViewTransitionName.trim().length > 0
        ? mapViewTransitionName
        : undefined;

    const timelineControls = (
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
            {timelineMode === 'calendar' && (
                <>
                    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur dark:shadow-none">
                        <button
                            type="button"
                            onClick={() => onTimelineViewChange('horizontal')}
                            className={`inline-flex size-10 items-center justify-center rounded-lg transition-colors ${
                                timelineView === 'horizontal'
                                    ? 'bg-accent-600 text-white'
                                    : 'text-muted-foreground hover:bg-secondary'
                            }`}
                            aria-label="Horizontal timeline direction"
                            aria-pressed={timelineView === 'horizontal'}
                            {...getAnalyticsDebugAttributes('trip_view__layout_direction--horizontal', { surface: 'timeline_controls' })}
                        >
                            <ArrowLeftRight size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onTimelineViewChange('vertical')}
                            className={`inline-flex size-10 items-center justify-center rounded-lg transition-colors ${
                                timelineView === 'vertical'
                                    ? 'bg-accent-600 text-white'
                                    : 'text-muted-foreground hover:bg-secondary'
                            }`}
                            aria-label="Vertical timeline direction"
                            aria-pressed={timelineView === 'vertical'}
                            {...getAnalyticsDebugAttributes('trip_view__layout_direction--vertical', { surface: 'timeline_controls' })}
                        >
                            <ArrowUpDown size={16} />
                        </button>
                    </div>
                    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur dark:shadow-none">
                        <button
                            type="button"
                            onClick={onZoomOut}
                            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
                            aria-label="Zoom out timeline"
                            {...getAnalyticsDebugAttributes('trip_view__zoom', { direction: 'out' })}
                        >
                            <ZoomOut size={16} />
                        </button>
                        {!isMobile && (
                            <span
                                role="status"
                                aria-live="polite"
                                className="min-w-12 rounded-md px-1 py-1.5 text-center text-xs font-semibold tabular-nums text-foreground"
                            >
                                {formatZoomLevelLabel(zoomLevel)}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onZoomIn}
                            className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
                            aria-label="Zoom in timeline"
                            {...getAnalyticsDebugAttributes('trip_view__zoom', { direction: 'in' })}
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>
                </>
            )}
            <div className="ms-auto inline-flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur dark:shadow-none">
                <button
                    type="button"
                    onClick={() => onTimelineModeChange('calendar')}
                    className={`inline-flex size-10 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                        timelineMode === 'calendar'
                            ? 'bg-accent-600 text-white'
                            : 'text-muted-foreground hover:bg-secondary'
                    }`}
                    aria-label="Calendar view"
                    aria-pressed={timelineMode === 'calendar'}
                    {...getAnalyticsDebugAttributes('trip_view__mode--calendar', { surface: 'timeline_controls' })}
                >
                    <CalendarDays size={14} />
                    <span className="sr-only">Calendar view</span>
                </button>
                <button
                    type="button"
                    onClick={() => onTimelineModeChange('timeline')}
                    className={`inline-flex size-10 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                        timelineMode === 'timeline'
                            ? 'bg-accent-600 text-white'
                            : 'text-muted-foreground hover:bg-secondary'
                    }`}
                    aria-label="Timeline list view"
                    aria-pressed={timelineMode === 'timeline'}
                    {...getAnalyticsDebugAttributes('trip_view__mode--timeline', { surface: 'timeline_controls' })}
                >
                    <List size={14} />
                    <span className="sr-only">Timeline list view</span>
                </button>
            </div>
        </div>
    );

    const buildMap = (mapLayoutMode: 'vertical' | 'horizontal', showLayoutControls = true) => {
        if (!isMapBootstrapEnabled) {
            return (
                <div className="relative h-full w-full">
                    {mapDeferredFallback}
                    <div data-floating-map-control="true" className="absolute top-4 end-4 z-[40] flex flex-col gap-2 pointer-events-none">
                        <div className="flex flex-col gap-2 pointer-events-auto">
                            {isFloatingMapPreviewEnabled && (
                                <button
                                    type="button"
                                    onClick={toggleMapDockMode}
                                    data-testid="map-dock-toggle-button"
                                    data-floating-map-control="true"
                                    className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-secondary hover:text-accent-600 dark:hover:text-accent-300 dark:shadow-none"
                                    aria-label={effectiveMapDockMode === 'docked' ? 'Minimize map preview' : 'Maximize map preview'}
                                    {...getAnalyticsDebugAttributes(
                                        effectiveMapDockMode === 'docked' ? 'trip_view__map_preview--minimize' : 'trip_view__map_preview--maximize',
                                        { surface: 'map_controls' },
                                    )}
                                >
                                    {effectiveMapDockMode === 'docked' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                    <span className="sr-only">{effectiveMapDockMode === 'docked' ? 'Minimize map preview' : 'Maximize map preview'}</span>
                                </button>
                            )}
                            {showLayoutControls && (
                                <div className={CONTROL_GROUP_CLASS_NAME}>
                                    <button
                                        type="button"
                                        onClick={() => onLayoutModeChange('vertical')}
                                        className={`${CONTROL_TOGGLE_BUTTON_CLASS_NAME} ${layoutMode === 'vertical' ? CONTROL_TOGGLE_ACTIVE_CLASS_NAME : CONTROL_TOGGLE_INACTIVE_CLASS_NAME}`}
                                        aria-label="Vertical layout"
                                        aria-pressed={layoutMode === 'vertical'}
                                        {...getAnalyticsDebugAttributes('trip_view__layout_direction--vertical', { surface: 'map_controls' })}
                                    >
                                        <ArrowUpDown size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onLayoutModeChange('horizontal')}
                                        className={`${CONTROL_TOGGLE_BUTTON_CLASS_NAME} ${layoutMode === 'horizontal' ? CONTROL_TOGGLE_ACTIVE_CLASS_NAME : CONTROL_TOGGLE_INACTIVE_CLASS_NAME}`}
                                        aria-label="Horizontal layout"
                                        aria-pressed={layoutMode === 'horizontal'}
                                        {...getAnalyticsDebugAttributes('trip_view__layout_direction--horizontal', { surface: 'map_controls' })}
                                    >
                                        <ArrowLeftRight size={18} />
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                disabled
                                className="flex size-10 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-card text-gray-300 shadow-md dark:shadow-none"
                                aria-label="Fit to itinerary"
                            >
                                <Focus size={18} />
                            </button>
                            <button
                                type="button"
                                disabled
                                className="flex size-10 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-card text-gray-300 shadow-md dark:shadow-none"
                                aria-label="Map style"
                            >
                                <Layers size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <Suspense fallback={mapLoadingFallback}>
                <ItineraryMapComponent
                    key={tripId}
                    items={displayItems}
                    selectedItemId={selectedItemId}
                    onCityMarkerSelect={onMapCitySelect}
                    onActivityMarkerSelect={onMapActivitySelect}
                    onClearSelection={onMapClearSelection}
                    cityFocusMode={cityFocusMode}
                    onOpenCustomize={onOpenMapCustomize}
                    showActivityMarkers={showActivityMarkers}
                    onShowActivityMarkersChange={onShowActivityMarkersChange}
                    basemapDetail={basemapDetail}
                    mapLookAxes={mapLookAxes}
                    tripOverlay={tripOverlay}
                    todayDayOffset={todayDayOffset}
                    useGlobeProjection={useGlobeProjection}
                    showTerrain={showTerrain}
                    mapPitch={mapPitch}
                    routeLineWeight={routeLineWeight}
                    isCustomizeOpen={isMapCustomizeOpen}
                    customizeLabel={mapCustomizeLabel}
                    enableActivityPopup={!isMobile}
                    layoutMode={mapLayoutMode}
                    onLayoutChange={showLayoutControls ? onLayoutModeChange : undefined}
                    showLayoutControls={showLayoutControls}
                    activeStyle={mapStyle}
                    onStyleChange={onMapStyleChange}
                    routeMode={routeMode}
                    onRouteModeChange={isPaywallLocked ? undefined : onRouteModeChange}
                    showCityNames={isPaywallLocked ? false : showCityNames}
                    onShowCityNamesChange={isPaywallLocked ? undefined : onShowCityNamesChange}
                    mapColorMode={mapColorMode}
                    onMapColorModeChange={onMapColorModeChange}
                    mapDockMode={isFloatingMapPreviewEnabled ? effectiveMapDockMode : undefined}
                    onMapDockModeToggle={isFloatingMapPreviewEnabled ? toggleMapDockMode : undefined}
                    focusLocationQuery={initialMapFocusQuery}
                    onRouteMetrics={onRouteMetrics}
                    onRouteStatus={onRouteStatus}
                    fitToRouteKey={tripId}
                    isPaywalled={isPaywallLocked}
                    viewTransitionName={effectiveMapViewTransitionName}
                />
            </Suspense>
        );
    };

    return (
        <>
            <div className={`w-full h-full ${isPaywallLocked ? 'pointer-events-none select-none' : ''}`}>
                {isMobile ? (
                    <TripMobilePlannerShell
                        trip={trip}
                        tripId={tripId}
                        mapNode={buildMap('vertical', false)}
                        mapViewportRef={mapViewportRef}
                        timelineCanvas={(
                            <div
                                ref={verticalLayoutTimelineRef}
                                data-testid="planner-mobile-timeline-pane"
                                className="relative h-full w-full overflow-hidden"
                                onTouchStart={timelineMode === 'calendar' ? onTimelineTouchStart : undefined}
                                onTouchMove={timelineMode === 'calendar' ? onTimelineTouchMove : undefined}
                                onTouchEnd={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                                onTouchCancel={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                            >
                                {timelineCanvas}
                            </div>
                        )}
                        timelineControls={(
                            <div data-testid="planner-timeline-controls" className="pointer-events-auto">
                                {timelineControls}
                            </div>
                        )}
                        selectedItemId={selectedItemId}
                        onSelect={onSelectTimelineItem}
                        isPaywallLocked={isPaywallLocked}
                        appLanguage={appLanguage}
                        onUpdateItem={onUpdateTimelineItem}
                        onSetLegTransport={onSetLegTransport}
                        onAddActivity={onAddTimelineActivity}
                        onOpenDiscover={onOpenDiscover}
                    />
                ) : (
                    <>
                        <div className={`w-full h-full flex ${
                            effectiveMapDockMode === 'floating'
                                ? 'flex-row'
                                : (effectiveLayoutMode === 'horizontal' ? 'flex-row' : 'flex-col')
                        }`}>
                            {effectiveMapDockMode === 'floating' ? (
                                <>
                                    <div data-testid="planner-timeline-pane" className="flex-1 min-w-0 h-full relative bg-card border-r border-border">
                                        <div
                                            ref={verticalLayoutTimelineRef}
                                            className="w-full h-full relative overflow-hidden"
                                            onTouchStart={timelineMode === 'calendar' ? onTimelineTouchStart : undefined}
                                            onTouchMove={timelineMode === 'calendar' ? onTimelineTouchMove : undefined}
                                            onTouchEnd={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                                            onTouchCancel={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                                        >
                                            {timelineCanvas}
                                            <div data-testid="planner-timeline-controls" className={`absolute top-4 end-4 ${plannerControlsLayerClassName} pointer-events-auto`}>
                                                {timelineControls}
                                            </div>
                                        </div>
                                    </div>
                                    {detailsPanelVisible && (
                                        <>
                                            <button
                                                type="button"
                                                className="group relative z-[45] flex w-2 cursor-col-resize appearance-none items-center justify-center border-0 bg-secondary p-0 transition-colors after:absolute after:-inset-x-4 after:inset-y-0 hover:bg-accent-500"
                                                onMouseDown={(event) => onStartResizing('details', event.clientX)}
                                                onKeyDown={onDetailsResizeKeyDown}
                                                aria-label="Resize details panel"
                                            >
                                                <div className="h-8 w-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                            <div style={{ width: detailsWidth }} className="relative h-full shrink-0 overflow-hidden border-s border-border bg-card z-[50]">
                                                {detailsPanelContent}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : effectiveLayoutMode === 'horizontal' ? (
                                <>
                                    <div style={{ width: sidebarWidth }} className="h-full flex flex-col items-center bg-card border-r border-border z-20 shrink-0 relative">
                                        <div className="w-full flex-1 overflow-hidden relative flex flex-col min-w-0">
                                            <div ref={verticalLayoutTimelineRef} className="flex-1 w-full overflow-hidden relative min-w-0">
                                                {timelineCanvas}
                                                <div data-testid="planner-timeline-controls" className={`absolute top-4 end-4 ${plannerControlsLayerClassName} pointer-events-auto`}>
                                                    {timelineControls}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="group relative z-30 flex w-2 cursor-col-resize appearance-none items-center justify-center border-0 bg-secondary p-0 transition-colors after:absolute after:-inset-x-4 after:inset-y-0 hover:bg-accent-500"
                                        onMouseDown={() => onStartResizing('sidebar')}
                                        onKeyDown={onSidebarResizeKeyDown}
                                        aria-label="Resize timeline and map panels"
                                    >
                                        <div className="h-8 w-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>

                                    {detailsPanelVisible && (
                                        <div style={{ width: detailsWidth }} className="relative h-full shrink-0 overflow-hidden border-r border-border bg-card z-[40]">
                                            {detailsPanelContent}
                                            <button
                                                type="button"
                                                className="group absolute top-0 end-0 z-30 flex h-full w-2 cursor-col-resize appearance-none items-center justify-center border-0 bg-transparent p-0 transition-colors after:absolute after:-inset-x-4 after:inset-y-0 hover:bg-accent-50/60 dark:hover:bg-accent-400/12"
                                                onMouseDown={(event) => onStartResizing('details', event.clientX)}
                                                onKeyDown={onDetailsResizeKeyDown}
                                                title="Resize details panel"
                                                aria-label="Resize details panel"
                                            >
                                                <div className="h-10 w-0.5 rounded-full bg-gray-200 group-hover:bg-accent-400 transition-colors" />
                                            </button>
                                        </div>
                                    )}
                                    <div ref={dockedMapAnchorRef} className="flex-1 h-full relative bg-secondary min-w-0" />
                                </>
                            ) : (
                                <>
                                    <div ref={dockedMapAnchorRef} className="flex-1 relative bg-secondary min-h-0 w-full" />
                                    <button
                                        type="button"
                                        className="group relative z-30 flex h-2 w-full cursor-row-resize appearance-none items-center justify-center border-0 bg-secondary p-0 transition-colors after:absolute after:inset-x-0 after:-inset-y-4 hover:bg-accent-500"
                                        onMouseDown={() => onStartResizing('timeline-h')}
                                        onKeyDown={onTimelineResizeKeyDown}
                                        aria-label="Resize timeline panel"
                                    >
                                        <div className="w-12 h-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    <div style={{ height: timelineHeight }} className="w-full bg-card border-t border-border z-20 shrink-0 relative flex flex-row">
                                        <div ref={verticalLayoutTimelineRef} className="flex-1 h-full relative border-r border-border min-w-0">
                                            <div className="w-full h-full relative min-w-0">
                                                {timelineCanvas}
                                                <div data-testid="planner-timeline-controls" className={`absolute top-4 end-4 ${plannerControlsLayerClassName} pointer-events-auto`}>
                                                    {timelineControls}
                                                </div>
                                            </div>
                                        </div>
                                        {detailsPanelVisible && (
                                            <div style={{ width: detailsWidth }} className="relative h-full overflow-hidden border-l border-border bg-card z-[40]">
                                                {detailsPanelContent}
                                                <button
                                                    type="button"
                                                    className="group absolute top-0 end-0 z-30 flex h-full w-2 cursor-col-resize appearance-none items-center justify-center border-0 bg-transparent p-0 transition-colors after:absolute after:-inset-x-4 after:inset-y-0 hover:bg-accent-50/60 dark:hover:bg-accent-400/12"
                                                    onMouseDown={(event) => onStartResizing('details', event.clientX)}
                                                    onKeyDown={onDetailsResizeKeyDown}
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
                        <TripFloatingMapPreview
                            mapDockMode={effectiveMapDockMode}
                            mapViewportRef={mapViewportRef}
                            dockedMapAnchorRef={dockedMapAnchorRef}
                            dockedGeometryKey={dockedGeometryKey}
                            reservedRightInset={floatingMapReservedRightInset}
                            reservedLeftInset={floatingMapReservedLeftInset}
                            tripId={tripId}
                        >
                            {buildMap(layoutMode, effectiveMapDockMode !== 'floating')}
                        </TripFloatingMapPreview>
                    </>
                )}
            </div>
        </>
    );
};
