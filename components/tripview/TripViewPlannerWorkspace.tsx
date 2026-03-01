import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowUpDown, CalendarDays, Focus, Layers, List, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

import type { ITimelineItem, MapColorMode, MapStyle, RouteMode, RouteStatus } from '../../types';

interface TripViewPlannerWorkspaceProps {
    isPaywallLocked: boolean;
    isMobile: boolean;
    isMobileMapExpanded: boolean;
    onCloseMobileMap: () => void;
    onToggleMobileMapExpanded: () => void;
    timelineCanvas: React.ReactNode;
    onTimelineTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTimelineTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
    onTimelineTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
    onZoomOut: () => void;
    onZoomIn: () => void;
    onTimelineModeChange: (mode: 'calendar' | 'timeline') => void;
    onTimelineViewChange: (view: 'horizontal' | 'vertical') => void;
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
    onRouteStatus: (travelItemId: string, status: RouteStatus, meta?: { mode?: string; routeKey?: string }) => void;
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
}

const FLOATING_MAP_MARGIN = 24;
const FLOATING_MAP_MIN_WIDTH = 220;
const FLOATING_MAP_MAX_WIDTH = 360;
const FLOATING_MAP_VIEWPORT_RATIO = 0.24;
const FLOATING_MAP_DRAG_THRESHOLD = 4;
const FLOATING_MAP_MAX_ROTATION = 11;
const FLOATING_MAP_ROTATION_VELOCITY_FACTOR = 20;
const FLOATING_MAP_SETTLE_DURATION_MS = 380;
const FLOATING_MAP_SQUIRCLE_RADIUS = '24% / 16%';

const clampValue = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const resolveFloatingMapBounds = (panelWidth: number, panelHeight: number) => {
    const minX = FLOATING_MAP_MARGIN;
    const minY = FLOATING_MAP_MARGIN;
    if (typeof window === 'undefined') {
        return {
            minX,
            minY,
            maxX: minX,
            maxY: minY,
        };
    }
    return {
        minX,
        minY,
        maxX: Math.max(minX, window.innerWidth - panelWidth - FLOATING_MAP_MARGIN),
        maxY: Math.max(minY, window.innerHeight - panelHeight - FLOATING_MAP_MARGIN),
    };
};

const clampFloatingMapPosition = (
    nextPosition: { x: number; y: number },
    panelWidth: number,
    panelHeight: number,
): { x: number; y: number } => {
    const { minX, minY, maxX, maxY } = resolveFloatingMapBounds(panelWidth, panelHeight);
    return {
        x: clampValue(nextPosition.x, minX, maxX),
        y: clampValue(nextPosition.y, minY, maxY),
    };
};

const resolveFloatingMapSnapTargets = (panelWidth: number, panelHeight: number): Array<{ x: number; y: number }> => {
    const { minX, minY, maxX, maxY } = resolveFloatingMapBounds(panelWidth, panelHeight);
    const midX = minX + ((maxX - minX) / 2);
    const midY = minY + ((maxY - minY) / 2);
    return [
        { x: minX, y: minY },
        { x: midX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: midY },
        { x: maxX, y: maxY },
        { x: midX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: midY },
    ];
};

const resolveNearestFloatingMapSnapTarget = (
    position: { x: number; y: number },
    panelWidth: number,
    panelHeight: number,
): { x: number; y: number } => {
    const points = resolveFloatingMapSnapTargets(panelWidth, panelHeight);
    if (points.length === 0) return clampFloatingMapPosition(position, panelWidth, panelHeight);
    return points.reduce((closest, candidate) => {
        const closestDistance = Math.hypot(closest.x - position.x, closest.y - position.y);
        const candidateDistance = Math.hypot(candidate.x - position.x, candidate.y - position.y);
        return candidateDistance < closestDistance ? candidate : closest;
    }, points[0]);
};

export const TripViewPlannerWorkspace: React.FC<TripViewPlannerWorkspaceProps> = ({
    isPaywallLocked,
    isMobile,
    isMobileMapExpanded,
    onCloseMobileMap,
    onToggleMobileMapExpanded,
    timelineCanvas,
    onTimelineTouchStart,
    onTimelineTouchMove,
    onTimelineTouchEnd,
    onZoomOut,
    onZoomIn,
    onTimelineModeChange,
    onTimelineViewChange,
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
}) => {
    const floatingMapRef = useRef<HTMLDivElement | null>(null);
    const dragCleanupRef = useRef<(() => void) | null>(null);
    const dragSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const floatingMapPositionRef = useRef<{ x: number; y: number } | null>(null);
    const floatingMapRotationRef = useRef(0);
    const [floatingMapPosition, setFloatingMapPosition] = useState<{ x: number; y: number } | null>(null);
    const [floatingMapRotationDeg, setFloatingMapRotationDeg] = useState(0);
    const [isFloatingMapDragging, setIsFloatingMapDragging] = useState(false);
    const [isFloatingMapSettling, setIsFloatingMapSettling] = useState(false);
    const floatingMapWidth = typeof window === 'undefined'
        ? FLOATING_MAP_MIN_WIDTH
        : Math.max(
            FLOATING_MAP_MIN_WIDTH,
            Math.min(FLOATING_MAP_MAX_WIDTH, window.innerWidth * FLOATING_MAP_VIEWPORT_RATIO),
        );
    const floatingMapFallbackPosition = useMemo(() => (
        typeof window === 'undefined'
            ? { x: FLOATING_MAP_MARGIN, y: FLOATING_MAP_MARGIN }
            : clampFloatingMapPosition(
                {
                    x: window.innerWidth - floatingMapWidth - FLOATING_MAP_MARGIN,
                    y: window.innerHeight - ((floatingMapWidth * 3) / 2) - FLOATING_MAP_MARGIN,
                },
                floatingMapWidth,
                (floatingMapWidth * 3) / 2,
            )
    ), [floatingMapWidth]);

    const stopDraggingFloatingMap = useCallback(() => {
        if (!dragCleanupRef.current) return;
        dragCleanupRef.current();
        dragCleanupRef.current = null;
    }, []);

    const clearFloatingMapSettleTimer = useCallback(() => {
        if (!dragSettleTimerRef.current) return;
        clearTimeout(dragSettleTimerRef.current);
        dragSettleTimerRef.current = null;
    }, []);

    const beginFloatingMapDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (isMobile || mapDockMode !== 'floating') return;
        const panel = floatingMapRef.current;
        if (!panel) return;
        event.preventDefault();

        stopDraggingFloatingMap();
        clearFloatingMapSettleTimer();
        setIsFloatingMapDragging(true);
        setIsFloatingMapSettling(false);

        const panelRect = panel.getBoundingClientRect();
        const basePosition = floatingMapPositionRef.current ?? floatingMapFallbackPosition;
        const startClientX = event.clientX;
        const startClientY = event.clientY;
        const velocitySample = {
            x: event.clientX,
            time: performance.now(),
        };
        let didActivateDrag = false;
        let didTrackReposition = false;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startClientX;
            const deltaY = moveEvent.clientY - startClientY;
            if (!didActivateDrag && Math.hypot(deltaX, deltaY) < FLOATING_MAP_DRAG_THRESHOLD) return;
            if (!didActivateDrag) {
                didActivateDrag = true;
                setIsFloatingMapDragging(true);
                if (!didTrackReposition) {
                    trackEvent('trip_view__map_preview--reposition', {
                        trip_id: tripId,
                    });
                    didTrackReposition = true;
                }
            }
            moveEvent.preventDefault();

            const nextPosition = clampFloatingMapPosition(
                {
                    x: basePosition.x + deltaX,
                    y: basePosition.y + deltaY,
                },
                panelRect.width,
                panelRect.height,
            );
            floatingMapPositionRef.current = nextPosition;
            setFloatingMapPosition(nextPosition);

            const now = performance.now();
            const deltaTime = Math.max(1, now - velocitySample.time);
            const velocityX = (moveEvent.clientX - velocitySample.x) / deltaTime;
            const targetRotation = clampValue(
                velocityX * FLOATING_MAP_ROTATION_VELOCITY_FACTOR,
                -FLOATING_MAP_MAX_ROTATION,
                FLOATING_MAP_MAX_ROTATION,
            );
            const nextRotation = (floatingMapRotationRef.current * 0.25) + (targetRotation * 0.75);
            floatingMapRotationRef.current = nextRotation;
            setFloatingMapRotationDeg(nextRotation);

            velocitySample.x = moveEvent.clientX;
            velocitySample.time = now;
        };

        const handlePointerUp = () => {
            stopDraggingFloatingMap();
            if (!didActivateDrag) {
                setIsFloatingMapDragging(false);
                setIsFloatingMapSettling(false);
                return;
            }
            const resolvedPanel = floatingMapRef.current;
            const panelWidth = resolvedPanel?.offsetWidth ?? panelRect.width;
            const panelHeight = resolvedPanel?.offsetHeight ?? panelRect.height;
            const currentPosition = floatingMapPositionRef.current ?? basePosition;
            const snapTarget = resolveNearestFloatingMapSnapTarget(currentPosition, panelWidth, panelHeight);
            const releaseRotation = clampValue(floatingMapRotationRef.current * 0.55, -7, 7);

            setIsFloatingMapSettling(true);
            floatingMapRotationRef.current = releaseRotation;
            setFloatingMapRotationDeg(releaseRotation);
            floatingMapPositionRef.current = snapTarget;
            setFloatingMapPosition(snapTarget);

            requestAnimationFrame(() => {
                floatingMapRotationRef.current = 0;
                setFloatingMapRotationDeg(0);
            });

            clearFloatingMapSettleTimer();
            dragSettleTimerRef.current = setTimeout(() => {
                setIsFloatingMapDragging(false);
                setIsFloatingMapSettling(false);
                dragSettleTimerRef.current = null;
            }, FLOATING_MAP_SETTLE_DURATION_MS);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        dragCleanupRef.current = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [
        clearFloatingMapSettleTimer,
        floatingMapFallbackPosition,
        isMobile,
        mapDockMode,
        stopDraggingFloatingMap,
        tripId,
    ]);

    useEffect(() => {
        return () => {
            stopDraggingFloatingMap();
            clearFloatingMapSettleTimer();
        };
    }, [clearFloatingMapSettleTimer, stopDraggingFloatingMap]);

    useEffect(() => {
        if (mapDockMode === 'floating') return;
        stopDraggingFloatingMap();
        clearFloatingMapSettleTimer();
        setIsFloatingMapDragging(false);
        setIsFloatingMapSettling(false);
        setFloatingMapRotationDeg(0);
    }, [clearFloatingMapSettleTimer, mapDockMode, stopDraggingFloatingMap]);

    useEffect(() => {
        floatingMapPositionRef.current = floatingMapPosition;
    }, [floatingMapPosition]);

    useEffect(() => {
        floatingMapRotationRef.current = floatingMapRotationDeg;
    }, [floatingMapRotationDeg]);

    useEffect(() => {
        if (isMobile || mapDockMode !== 'floating') return;
        const resolvePosition = () => {
            const panel = floatingMapRef.current;
            if (!panel) return;
            const panelRect = panel.getBoundingClientRect();
            setFloatingMapPosition((previous) => {
                if (previous) {
                    return clampFloatingMapPosition(previous, panelRect.width, panelRect.height);
                }
                return clampFloatingMapPosition(
                    {
                        x: window.innerWidth - panelRect.width - FLOATING_MAP_MARGIN,
                        y: window.innerHeight - panelRect.height - FLOATING_MAP_MARGIN,
                    },
                    panelRect.width,
                    panelRect.height,
                );
            });
        };

        const rafId = window.requestAnimationFrame(resolvePosition);
        return () => window.cancelAnimationFrame(rafId);
    }, [isMobile, mapDockMode, floatingMapWidth]);

    useEffect(() => {
        if (isMobile || mapDockMode !== 'floating') return;
        const handleResize = () => {
            const panel = floatingMapRef.current;
            if (!panel) return;
            const panelRect = panel.getBoundingClientRect();
            setFloatingMapPosition((previous) => {
                if (!previous) {
                    return clampFloatingMapPosition(
                        {
                            x: window.innerWidth - panelRect.width - FLOATING_MAP_MARGIN,
                            y: window.innerHeight - panelRect.height - FLOATING_MAP_MARGIN,
                        },
                        panelRect.width,
                        panelRect.height,
                    );
                }
                return clampFloatingMapPosition(previous, panelRect.width, panelRect.height);
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile, mapDockMode]);

    const toggleMapDockMode = useCallback(() => {
        onMapDockModeChange(mapDockMode === 'docked' ? 'floating' : 'docked');
    }, [mapDockMode, onMapDockModeChange]);
    const effectiveMapViewTransitionName = mapViewTransitionName ?? 'trip-map-dock-preview';
    const floatingMapTransform = `translateZ(0) rotate(${floatingMapRotationDeg.toFixed(2)}deg) scale(${isFloatingMapDragging ? 1.02 : 1})`;
    const floatingMapTransition = isFloatingMapDragging
        ? 'left 0ms linear, top 0ms linear, transform 0ms linear, box-shadow 140ms ease'
        : isFloatingMapSettling
            ? 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.2, 1.25, 0.32, 1), box-shadow 220ms ease'
            : 'left 220ms cubic-bezier(0.22, 1, 0.36, 1), top 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms ease-out, box-shadow 200ms ease-out';

    const timelineControls = (
        <div className="flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
            {timelineMode === 'calendar' && (
                <>
                    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
                        <button
                            type="button"
                            onClick={() => onTimelineViewChange('horizontal')}
                            className={`rounded-md p-1.5 transition-colors ${
                                timelineView === 'horizontal'
                                    ? 'bg-accent-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
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
                            className={`rounded-md p-1.5 transition-colors ${
                                timelineView === 'vertical'
                                    ? 'bg-accent-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            aria-label="Vertical timeline direction"
                            aria-pressed={timelineView === 'vertical'}
                            {...getAnalyticsDebugAttributes('trip_view__layout_direction--vertical', { surface: 'timeline_controls' })}
                        >
                            <ArrowUpDown size={16} />
                        </button>
                    </div>
                    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
                        <button
                            type="button"
                            onClick={onZoomOut}
                            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                            aria-label="Zoom out timeline"
                            {...getAnalyticsDebugAttributes('trip_view__zoom', { direction: 'out' })}
                        >
                            <ZoomOut size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={onZoomIn}
                            className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                            aria-label="Zoom in timeline"
                            {...getAnalyticsDebugAttributes('trip_view__zoom', { direction: 'in' })}
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>
                </>
            )}
            <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm backdrop-blur">
                <button
                    type="button"
                    onClick={() => onTimelineModeChange('calendar')}
                    className={`inline-flex items-center rounded-md p-1.5 text-xs font-semibold transition-colors ${
                        timelineMode === 'calendar'
                            ? 'bg-accent-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
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
                    className={`inline-flex items-center rounded-md p-1.5 text-xs font-semibold transition-colors ${
                        timelineMode === 'timeline'
                            ? 'bg-accent-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
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

    const renderMap = (mapLayoutMode: 'vertical' | 'horizontal', showLayoutControls = true) => {
        if (!isMapBootstrapEnabled) {
            return (
                <div className="relative h-full w-full">
                    {mapDeferredFallback}
                    <div data-floating-map-control="true" className="absolute top-4 end-4 z-[40] flex flex-col gap-2 pointer-events-none">
                        <div className="flex flex-col gap-2 pointer-events-auto">
                            {!isMobile && (
                                <button
                                    type="button"
                                    onClick={toggleMapDockMode}
                                    data-testid="map-dock-toggle-button"
                                    data-floating-map-control="true"
                                    className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
                                    aria-label={mapDockMode === 'docked' ? 'Minimize map preview' : 'Maximize map preview'}
                                    {...getAnalyticsDebugAttributes(
                                        mapDockMode === 'docked' ? 'trip_view__map_preview--minimize' : 'trip_view__map_preview--maximize',
                                        { surface: 'map_controls' },
                                    )}
                                >
                                    {mapDockMode === 'docked' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                    <span className="sr-only">{mapDockMode === 'docked' ? 'Minimize map preview' : 'Maximize map preview'}</span>
                                </button>
                            )}
                            {showLayoutControls && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => onLayoutModeChange('vertical')}
                                        className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'vertical' ? 'bg-accent-600 text-white border-accent-700' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`}
                                        aria-label="Vertical layout"
                                        {...getAnalyticsDebugAttributes('trip_view__layout_direction--vertical', { surface: 'map_controls' })}
                                    >
                                        <ArrowUpDown size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onLayoutModeChange('horizontal')}
                                        className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'horizontal' ? 'bg-accent-600 text-white border-accent-700' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`}
                                        aria-label="Horizontal layout"
                                        {...getAnalyticsDebugAttributes('trip_view__layout_direction--horizontal', { surface: 'map_controls' })}
                                    >
                                        <ArrowLeftRight size={18} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                disabled
                                className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-300 cursor-not-allowed flex items-center justify-center"
                                aria-label="Fit to itinerary"
                            >
                                <Focus size={18} />
                            </button>
                            <button
                                type="button"
                                disabled
                                className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-300 cursor-not-allowed flex items-center justify-center"
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
                    items={displayItems}
                    selectedItemId={selectedItemId}
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
                    isExpanded={isMobile ? isMobileMapExpanded : undefined}
                    onToggleExpanded={isMobile ? onToggleMobileMapExpanded : undefined}
                    mapDockMode={!isMobile ? mapDockMode : undefined}
                    onMapDockModeToggle={!isMobile ? toggleMapDockMode : undefined}
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
            {isMobileMapExpanded && (
                <button
                    type="button"
                    className="fixed inset-0 z-[1430] bg-black/25"
                    aria-label="Close expanded map"
                    onClick={onCloseMobileMap}
                />
            )}
            <div className={`w-full h-full ${isPaywallLocked ? 'pointer-events-none select-none' : ''}`}>
                {isMobile ? (
                    <div className="w-full h-full flex flex-col">
                        <div
                            className="flex-1 min-h-0 w-full bg-white border-b border-gray-200 relative overflow-hidden"
                            onTouchStart={timelineMode === 'calendar' ? onTimelineTouchStart : undefined}
                            onTouchMove={timelineMode === 'calendar' ? onTimelineTouchMove : undefined}
                            onTouchEnd={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                            onTouchCancel={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                        >
                            {timelineCanvas}
                            <div className="absolute top-3 end-3 z-[60] pointer-events-auto">
                                {timelineControls}
                            </div>
                        </div>
                        <div
                            ref={mapViewportRef}
                            className={`${isMobileMapExpanded ? 'fixed inset-x-0 bottom-0 h-[70vh] z-[1450] border-t border-gray-200 shadow-2xl bg-white' : 'relative h-[34vh] min-h-[220px] bg-gray-100'}`}
                        >
                            {renderMap('vertical', false)}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={`w-full h-full flex ${
                            mapDockMode === 'floating'
                                ? 'flex-row'
                                : (effectiveLayoutMode === 'horizontal' ? 'flex-row' : 'flex-col')
                        }`}>
                            {mapDockMode === 'floating' ? (
                                <>
                                    <div data-testid="planner-timeline-pane" className="flex-1 min-w-0 h-full relative bg-white border-r border-gray-100">
                                        <div
                                            ref={verticalLayoutTimelineRef}
                                            className="w-full h-full relative overflow-hidden"
                                            onTouchStart={timelineMode === 'calendar' ? onTimelineTouchStart : undefined}
                                            onTouchMove={timelineMode === 'calendar' ? onTimelineTouchMove : undefined}
                                            onTouchEnd={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                                            onTouchCancel={timelineMode === 'calendar' ? onTimelineTouchEnd : undefined}
                                        >
                                            {timelineCanvas}
                                            <div className="absolute top-4 end-4 z-[60] pointer-events-auto">
                                                {timelineControls}
                                            </div>
                                        </div>
                                    </div>
                                    {detailsPanelVisible && (
                                        <div style={{ width: detailsWidth }} className="h-full bg-white border-s border-gray-200 z-20 shrink-0 relative overflow-hidden">
                                            {detailsPanelContent}
                                        </div>
                                    )}
                                </>
                            ) : effectiveLayoutMode === 'horizontal' ? (
                                <>
                                    <div style={{ width: sidebarWidth }} className="h-full flex flex-col items-center bg-white border-r border-gray-200 z-20 shrink-0 relative">
                                        <div className="w-full flex-1 overflow-hidden relative flex flex-col min-w-0">
                                            <div ref={verticalLayoutTimelineRef} className="flex-1 w-full overflow-hidden relative min-w-0">
                                                {timelineCanvas}
                                                <div className="absolute top-4 end-4 z-[60] pointer-events-auto">
                                                    {timelineControls}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="w-1 bg-gray-100 hover:bg-accent-500 cursor-col-resize transition-colors z-30 flex items-center justify-center group appearance-none border-0 p-0"
                                        onMouseDown={() => onStartResizing('sidebar')}
                                        onKeyDown={onSidebarResizeKeyDown}
                                        aria-label="Resize timeline and map panels"
                                    >
                                        <div className="h-8 w-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>

                                    {detailsPanelVisible && (
                                        <div style={{ width: detailsWidth }} className="h-full bg-white border-r border-gray-200 z-20 shrink-0 relative overflow-hidden">
                                            {detailsPanelContent}
                                            <button
                                                type="button"
                                                className="absolute top-0 end-0 h-full w-2 cursor-col-resize z-30 flex items-center justify-center group hover:bg-accent-50/60 transition-colors appearance-none border-0 bg-transparent p-0"
                                                onMouseDown={(event) => onStartResizing('details', event.clientX)}
                                                onKeyDown={onDetailsResizeKeyDown}
                                                title="Resize details panel"
                                                aria-label="Resize details panel"
                                            >
                                                <div className="h-10 w-0.5 rounded-full bg-gray-200 group-hover:bg-accent-400 transition-colors" />
                                            </button>
                                        </div>
                                    )}

                                    <div ref={mapViewportRef} className="flex-1 h-full relative bg-gray-100 min-w-0">
                                        {renderMap(layoutMode, true)}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div ref={mapViewportRef} className="flex-1 relative bg-gray-100 min-h-0 w-full">
                                        {renderMap(layoutMode, true)}
                                    </div>
                                    <button
                                        type="button"
                                        className="h-1 bg-gray-100 hover:bg-accent-500 cursor-row-resize transition-colors z-30 flex justify-center items-center group w-full appearance-none border-0 p-0"
                                        onMouseDown={() => onStartResizing('timeline-h')}
                                        onKeyDown={onTimelineResizeKeyDown}
                                        aria-label="Resize timeline panel"
                                    >
                                        <div className="w-12 h-1 group-hover:bg-accent-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                    <div style={{ height: timelineHeight }} className="w-full bg-white border-t border-gray-200 z-20 shrink-0 relative flex flex-row">
                                        <div ref={verticalLayoutTimelineRef} className="flex-1 h-full relative border-r border-gray-100 min-w-0">
                                            <div className="w-full h-full relative min-w-0">
                                                {timelineCanvas}
                                                <div className="absolute top-4 end-4 z-[60] pointer-events-auto">
                                                    {timelineControls}
                                                </div>
                                            </div>
                                        </div>
                                        {detailsPanelVisible && (
                                            <div style={{ width: detailsWidth }} className="h-full bg-white border-l border-gray-200 overflow-hidden relative">
                                                {detailsPanelContent}
                                                <button
                                                    type="button"
                                                    className="absolute top-0 end-0 h-full w-2 cursor-col-resize z-30 flex items-center justify-center group hover:bg-accent-50/60 transition-colors appearance-none border-0 bg-transparent p-0"
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
                        {mapDockMode === 'floating' && (
                            <div
                                ref={mapViewportRef}
                                data-testid="floating-map-container"
                                className={`tf-floating-map-enter fixed z-[1400] overflow-hidden bg-gray-100 border-[4px] border-t-[10px] border-white ${
                                    isFloatingMapDragging
                                        ? 'shadow-[0_34px_70px_-28px_rgba(15,23,42,0.72),0_14px_30px_-16px_rgba(15,23,42,0.45)]'
                                        : 'shadow-[0_18px_50px_-22px_rgba(15,23,42,0.6),0_8px_22px_-12px_rgba(15,23,42,0.4)]'
                                }`}
                                style={{
                                    width: `${floatingMapWidth}px`,
                                    aspectRatio: '2 / 3',
                                    left: (floatingMapPosition?.x ?? floatingMapFallbackPosition.x),
                                    top: (floatingMapPosition?.y ?? floatingMapFallbackPosition.y),
                                    transform: floatingMapTransform,
                                    transformOrigin: '50% 0%',
                                    transition: floatingMapTransition,
                                    borderRadius: FLOATING_MAP_SQUIRCLE_RADIUS,
                                }}
                            >
                                <div className="pointer-events-none absolute top-0 inset-x-0 z-[90] flex justify-center pt-2">
                                    <button
                                        type="button"
                                        data-testid="floating-map-drag-handle"
                                        data-floating-map-control="true"
                                        onPointerDown={beginFloatingMapDrag}
                                        className={`pointer-events-auto inline-flex h-8 w-24 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-sm backdrop-blur-md touch-none ${
                                            isFloatingMapDragging ? 'cursor-grabbing scale-[1.04]' : 'cursor-grab'
                                        } transition-transform`}
                                        aria-label="Move floating map preview"
                                    >
                                        <span className="inline-block h-1.5 w-14 rounded-full bg-slate-400/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" />
                                        <span className="sr-only">Move floating map preview</span>
                                    </button>
                                </div>
                                <div className="h-full w-full overflow-hidden" style={{ borderRadius: 'inherit' }}>
                                    {renderMap(layoutMode, false)}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
};
