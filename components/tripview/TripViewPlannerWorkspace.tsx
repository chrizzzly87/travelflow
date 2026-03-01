import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowUpDown, CalendarDays, Focus, Layers, List, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { LazyMotion, animate, domMax, m, useDragControls, useMotionValue, type PanInfo } from 'framer-motion';
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
const FLOATING_MAP_ROTATION_VELOCITY_FACTOR = 0.015;
const FLOATING_MAP_SETTLE_DURATION_MS = 380;
const FLOATING_MAP_BORDER_RADIUS = '1.125rem';
const FLOATING_MAP_NAV_TOP_OFFSET = 92;

const resolveFloatingMapTopBoundary = (): number => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return FLOATING_MAP_NAV_TOP_OFFSET;
    }
    const appHeader = document.querySelector<HTMLElement>('header');
    if (!appHeader) return FLOATING_MAP_NAV_TOP_OFFSET;
    const rect = appHeader.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top > window.innerHeight * 0.5) {
        return FLOATING_MAP_NAV_TOP_OFFSET;
    }
    return Math.max(FLOATING_MAP_NAV_TOP_OFFSET, Math.ceil(rect.bottom + 12));
};

const clampValue = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const resolveFloatingMapBounds = (panelWidth: number, panelHeight: number) => {
    const minX = FLOATING_MAP_MARGIN;
    const minY = Math.max(FLOATING_MAP_MARGIN, resolveFloatingMapTopBoundary());
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
    return [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
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
    const dragSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const floatingMapPositionRef = useRef<{ x: number; y: number } | null>(null);
    const floatingMapPanelSizeRef = useRef<{ width: number; height: number }>({
        width: FLOATING_MAP_MIN_WIDTH,
        height: (FLOATING_MAP_MIN_WIDTH * 3) / 2,
    });
    const didMoveFloatingMapRef = useRef(false);
    const didTrackFloatingMapRepositionRef = useRef(false);
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
    const floatingMapDragControls = useDragControls();
    const floatingMapX = useMotionValue(floatingMapFallbackPosition.x);
    const floatingMapY = useMotionValue(floatingMapFallbackPosition.y);
    const floatingMapRotation = useMotionValue(0);

    const clearFloatingMapSettleTimer = useCallback(() => {
        if (!dragSettleTimerRef.current) return;
        clearTimeout(dragSettleTimerRef.current);
        dragSettleTimerRef.current = null;
    }, []);

    const beginFloatingMapDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
        if (isMobile || mapDockMode !== 'floating') return;
        event.preventDefault();
        floatingMapDragControls.start(event, { snapToCursor: false });
    }, [floatingMapDragControls, isMobile, mapDockMode]);

    const applyFloatingMapPosition = useCallback((
        nextPosition: { x: number; y: number },
        panelWidth: number,
        panelHeight: number,
        animateToPosition = false,
    ) => {
        const clampedPosition = clampFloatingMapPosition(nextPosition, panelWidth, panelHeight);
        floatingMapPositionRef.current = clampedPosition;
        if (animateToPosition) {
            animate(floatingMapX, clampedPosition.x, {
                type: 'spring',
                stiffness: 430,
                damping: 35,
                mass: 0.84,
            });
            animate(floatingMapY, clampedPosition.y, {
                type: 'spring',
                stiffness: 430,
                damping: 35,
                mass: 0.84,
            });
            return;
        }
        floatingMapX.set(clampedPosition.x);
        floatingMapY.set(clampedPosition.y);
    }, [floatingMapX, floatingMapY]);

    const handleFloatingMapDragStart = useCallback(() => {
        didMoveFloatingMapRef.current = false;
        didTrackFloatingMapRepositionRef.current = false;
        clearFloatingMapSettleTimer();
        setIsFloatingMapDragging(true);
        setIsFloatingMapSettling(false);
    }, [clearFloatingMapSettleTimer]);

    const handleFloatingMapDrag = useCallback((
        _event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
    ) => {
        const { width: panelWidth, height: panelHeight } = floatingMapPanelSizeRef.current;
        const currentPosition = {
            x: floatingMapX.get(),
            y: floatingMapY.get(),
        };
        const clampedPosition = clampFloatingMapPosition(currentPosition, panelWidth, panelHeight);
        if (clampedPosition.x !== currentPosition.x) floatingMapX.set(clampedPosition.x);
        if (clampedPosition.y !== currentPosition.y) floatingMapY.set(clampedPosition.y);
        floatingMapPositionRef.current = clampedPosition;

        const movement = Math.hypot(info.offset.x, info.offset.y);
        if (movement >= FLOATING_MAP_DRAG_THRESHOLD) {
            didMoveFloatingMapRef.current = true;
            if (!didTrackFloatingMapRepositionRef.current) {
                trackEvent('trip_view__map_preview--reposition', {
                    trip_id: tripId,
                });
                didTrackFloatingMapRepositionRef.current = true;
            }
        }

        const targetRotation = clampValue(
            info.velocity.x * FLOATING_MAP_ROTATION_VELOCITY_FACTOR,
            -FLOATING_MAP_MAX_ROTATION,
            FLOATING_MAP_MAX_ROTATION,
        );
        const nextRotation = (floatingMapRotation.get() * 0.2) + (targetRotation * 0.8);
        floatingMapRotation.set(nextRotation);
    }, [floatingMapRotation, floatingMapX, floatingMapY, tripId]);

    const handleFloatingMapDragEnd = useCallback(() => {
        setIsFloatingMapDragging(false);
        const panel = mapViewportRef.current;
        if (!panel) {
            setIsFloatingMapSettling(false);
            return;
        }
        const panelRect = panel.getBoundingClientRect();
        floatingMapPanelSizeRef.current = {
            width: panelRect.width,
            height: panelRect.height,
        };
        if (!didMoveFloatingMapRef.current) {
            animate(floatingMapRotation, 0, {
                type: 'spring',
                stiffness: 260,
                damping: 22,
                mass: 0.76,
            });
            setIsFloatingMapSettling(false);
            return;
        }

        const currentPosition = clampFloatingMapPosition(
            { x: floatingMapX.get(), y: floatingMapY.get() },
            panelRect.width,
            panelRect.height,
        );
        const snapTarget = resolveNearestFloatingMapSnapTarget(currentPosition, panelRect.width, panelRect.height);
        const releaseRotation = clampValue(floatingMapRotation.get() * 0.52, -7, 7);

        setIsFloatingMapSettling(true);
        floatingMapPositionRef.current = snapTarget;
        floatingMapRotation.set(releaseRotation);

        animate(floatingMapX, snapTarget.x, {
            type: 'spring',
            stiffness: 420,
            damping: 33,
            mass: 0.82,
        });
        animate(floatingMapY, snapTarget.y, {
            type: 'spring',
            stiffness: 420,
            damping: 33,
            mass: 0.82,
        });
        animate(floatingMapRotation, 0, {
            type: 'spring',
            stiffness: 250,
            damping: 19,
            mass: 0.74,
        });

        clearFloatingMapSettleTimer();
        dragSettleTimerRef.current = setTimeout(() => {
            setIsFloatingMapSettling(false);
            dragSettleTimerRef.current = null;
        }, FLOATING_MAP_SETTLE_DURATION_MS);
    }, [clearFloatingMapSettleTimer, floatingMapRotation, floatingMapX, floatingMapY, mapViewportRef]);

    useEffect(() => {
        return () => {
            clearFloatingMapSettleTimer();
        };
    }, [clearFloatingMapSettleTimer]);

    useEffect(() => {
        if (mapDockMode === 'floating') return;
        clearFloatingMapSettleTimer();
        setIsFloatingMapDragging(false);
        setIsFloatingMapSettling(false);
        floatingMapRotation.set(0);
    }, [clearFloatingMapSettleTimer, floatingMapRotation, mapDockMode]);

    useEffect(() => {
        if (isMobile || mapDockMode !== 'floating') return;
        const resolvePosition = () => {
            const panel = mapViewportRef.current;
            if (!panel) return;
            const panelRect = panel.getBoundingClientRect();
            floatingMapPanelSizeRef.current = {
                width: panelRect.width,
                height: panelRect.height,
            };
            const previous = floatingMapPositionRef.current ?? {
                x: floatingMapX.get(),
                y: floatingMapY.get(),
            };
            const nextPosition = Number.isFinite(previous.x) && Number.isFinite(previous.y)
                ? previous
                : {
                    x: window.innerWidth - panelRect.width - FLOATING_MAP_MARGIN,
                    y: window.innerHeight - panelRect.height - FLOATING_MAP_MARGIN,
                };
            applyFloatingMapPosition(nextPosition, panelRect.width, panelRect.height);
        };

        const rafId = window.requestAnimationFrame(resolvePosition);
        return () => window.cancelAnimationFrame(rafId);
    }, [applyFloatingMapPosition, floatingMapWidth, floatingMapX, floatingMapY, isMobile, mapDockMode, mapViewportRef]);

    useEffect(() => {
        if (isMobile || mapDockMode !== 'floating') return;
        const handleResize = () => {
            const panel = mapViewportRef.current;
            if (!panel) return;
            const panelRect = panel.getBoundingClientRect();
            floatingMapPanelSizeRef.current = {
                width: panelRect.width,
                height: panelRect.height,
            };
            const previous = floatingMapPositionRef.current ?? {
                x: floatingMapX.get(),
                y: floatingMapY.get(),
            };
            applyFloatingMapPosition(previous, panelRect.width, panelRect.height, true);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [applyFloatingMapPosition, floatingMapX, floatingMapY, isMobile, mapDockMode, mapViewportRef]);

    const toggleMapDockMode = useCallback(() => {
        onMapDockModeChange(mapDockMode === 'docked' ? 'floating' : 'docked');
    }, [mapDockMode, onMapDockModeChange]);
    const effectiveMapViewTransitionName = mapViewTransitionName ?? 'trip-map-dock-preview';

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
                            <LazyMotion features={domMax}>
                                <m.div
                                    ref={mapViewportRef}
                                    data-testid="floating-map-container"
                                    drag
                                    dragControls={floatingMapDragControls}
                                    dragListener={false}
                                    dragElastic={0.06}
                                    dragMomentum={false}
                                    onDragStart={handleFloatingMapDragStart}
                                    onDrag={handleFloatingMapDrag}
                                    onDragEnd={handleFloatingMapDragEnd}
                                    animate={{
                                        scale: isFloatingMapDragging ? 1.02 : 1,
                                    }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 380,
                                        damping: 30,
                                        mass: 0.82,
                                    }}
                                    className={`tf-floating-map-enter fixed z-[1400] overflow-hidden bg-gray-100 border-[4px] border-t-[10px] border-white ${
                                        isFloatingMapDragging
                                            ? 'shadow-[0_34px_70px_-28px_rgba(15,23,42,0.72),0_14px_30px_-16px_rgba(15,23,42,0.45)]'
                                            : 'shadow-[0_18px_50px_-22px_rgba(15,23,42,0.6),0_8px_22px_-12px_rgba(15,23,42,0.4)]'
                                    }`}
                                    style={{
                                        width: `${floatingMapWidth}px`,
                                        aspectRatio: '2 / 3',
                                        top: 0,
                                        left: 0,
                                        x: floatingMapX,
                                        y: floatingMapY,
                                        rotate: floatingMapRotation,
                                        transformOrigin: '50% 0%',
                                        borderRadius: FLOATING_MAP_BORDER_RADIUS,
                                        willChange: isFloatingMapDragging || isFloatingMapSettling ? 'transform' : 'auto',
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
                                </m.div>
                            </LazyMotion>
                        )}
                    </>
                )}
            </div>
        </>
    );
};
