import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LazyMotion, animate, domMax, m, useDragControls, useMotionValue, useSpring, type PanInfo } from 'framer-motion';

import { trackEvent } from '../../services/analyticsService';
import {
    type FloatingMapSizePreset,
    readFloatingMapPreviewState,
    writeFloatingMapPreviewState,
} from './floatingMapPreviewState';

interface TripFloatingMapPreviewProps {
    mapDockMode: 'docked' | 'floating';
    mapViewportRef: React.RefObject<HTMLDivElement | null>;
    dockedMapAnchorRef: React.RefObject<HTMLDivElement | null>;
    dockedGeometryKey: string;
    tripId: string;
    children: React.ReactNode;
}

const FLOATING_MAP_MARGIN = 24;
const FLOATING_MAP_MIN_WIDTH = 220;
const FLOATING_MAP_MAX_WIDTH = 360;
const FLOATING_MAP_VIEWPORT_RATIO = 0.24;
const FLOATING_MAP_DRAG_THRESHOLD = 4;
const FLOATING_MAP_MAX_ROTATION = 11;
const FLOATING_MAP_ROTATION_VELOCITY_FACTOR = 0.015;
const FLOATING_MAP_SETTLE_DURATION_MS = 380;
const FLOATING_MAP_BORDER_RADIUS = '1rem';
const FLOATING_MAP_NAV_TOP_OFFSET = 92;
const FLOATING_MAP_ASPECT_RATIO = 2 / 3;
const FLOATING_MAP_PRESET_ORDER: FloatingMapSizePreset[] = ['sm', 'md', 'lg'];
const clampValue = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const resolveFloatingMapPresetWidths = (baseWidth: number): Record<FloatingMapSizePreset, number> => ({
    sm: Math.round(clampValue(baseWidth * 0.86, FLOATING_MAP_MIN_WIDTH, FLOATING_MAP_MAX_WIDTH)),
    md: Math.round(clampValue(baseWidth, FLOATING_MAP_MIN_WIDTH, FLOATING_MAP_MAX_WIDTH)),
    lg: Math.round(clampValue(baseWidth * 1.16, FLOATING_MAP_MIN_WIDTH, FLOATING_MAP_MAX_WIDTH)),
});

const resolveWidthForPreset = (baseWidth: number, preset: FloatingMapSizePreset): number =>
    resolveFloatingMapPresetWidths(baseWidth)[preset];

const resolveNearestSizePreset = (
    candidateWidth: number,
    baseWidth: number,
    fallback: FloatingMapSizePreset,
): FloatingMapSizePreset => {
    const presets = resolveFloatingMapPresetWidths(baseWidth);
    return FLOATING_MAP_PRESET_ORDER.reduce((closest, preset) => {
        const closestDistance = Math.abs(presets[closest] - candidateWidth);
        const presetDistance = Math.abs(presets[preset] - candidateWidth);
        if (presetDistance < closestDistance) return preset;
        return closest;
    }, fallback);
};

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

const resolveFloatingMapWidth = (): number => {
    if (typeof window === 'undefined') return FLOATING_MAP_MIN_WIDTH;
    return Math.max(
        FLOATING_MAP_MIN_WIDTH,
        Math.min(FLOATING_MAP_MAX_WIDTH, window.innerWidth * FLOATING_MAP_VIEWPORT_RATIO),
    );
};

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

const resolveDefaultFloatingMapPosition = (panelWidth: number, panelHeight: number): { x: number; y: number } => {
    if (typeof window === 'undefined') {
        return { x: FLOATING_MAP_MARGIN, y: FLOATING_MAP_MARGIN };
    }
    return clampFloatingMapPosition(
        {
            x: window.innerWidth - panelWidth - FLOATING_MAP_MARGIN,
            y: window.innerHeight - panelHeight - FLOATING_MAP_MARGIN,
        },
        panelWidth,
        panelHeight,
    );
};

const resolveDockedMapRect = (anchor: HTMLDivElement | null): { x: number; y: number; width: number; height: number } | null => {
    if (!anchor) return null;
    const rect = anchor.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
    };
};

export const TripFloatingMapPreview: React.FC<TripFloatingMapPreviewProps> = ({
    mapDockMode,
    mapViewportRef,
    dockedMapAnchorRef,
    dockedGeometryKey,
    tripId,
    children,
}) => {
    const initialPersistedStateRef = useRef(readFloatingMapPreviewState());
    const [floatingMapBaseWidth, setFloatingMapBaseWidth] = useState(() => resolveFloatingMapWidth());
    const [floatingMapSizePreset, setFloatingMapSizePreset] = useState<FloatingMapSizePreset>(() => (
        initialPersistedStateRef.current.sizePreset ?? 'md'
    ));
    const floatingMapSizePresetRef = useRef<FloatingMapSizePreset>(floatingMapSizePreset);
    const [isFloatingMapDragging, setIsFloatingMapDragging] = useState(false);
    const [isFloatingMapResizing, setIsFloatingMapResizing] = useState(false);
    const [isFloatingMapSettling, setIsFloatingMapSettling] = useState(false);
    const [isHandlePressed, setIsHandlePressed] = useState(false);
    const [hasResolvedInitialGeometry, setHasResolvedInitialGeometry] = useState(false);
    const dragSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resizeSessionRef = useRef<{
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
    } | null>(null);
    const floatingMapDragControls = useDragControls();
    const floatingMapPositionRef = useRef<{ x: number; y: number } | null>(null);
    const initialStoredPositionRef = useRef<{ x: number; y: number } | null>(
        initialPersistedStateRef.current.position ?? null,
    );
    const lastDockedMapRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const didMoveFloatingMapRef = useRef(false);
    const didTrackFloatingMapRepositionRef = useRef(false);
    const floatingMapWidth = resolveWidthForPreset(floatingMapBaseWidth, floatingMapSizePreset);
    const floatingMapX = useMotionValue(FLOATING_MAP_MARGIN);
    const floatingMapY = useMotionValue(FLOATING_MAP_MARGIN);
    const surfaceWidth = useMotionValue(floatingMapWidth);
    const surfaceHeight = useMotionValue(floatingMapWidth / FLOATING_MAP_ASPECT_RATIO);
    const floatingMapRotation = useMotionValue(0);
    const floatingMapVisualRotation = useSpring(floatingMapRotation, {
        stiffness: 330,
        damping: 27,
        mass: 0.62,
    });

    const clearFloatingMapSettleTimer = useCallback(() => {
        if (!dragSettleTimerRef.current) return;
        clearTimeout(dragSettleTimerRef.current);
        dragSettleTimerRef.current = null;
    }, []);

    const applySurfaceGeometry = useCallback((
        target: { x: number; y: number; width: number; height: number },
        animateToPosition: boolean,
    ) => {
        if (animateToPosition) {
            animate(floatingMapX, target.x, {
                type: 'spring',
                stiffness: 410,
                damping: 34,
                mass: 0.83,
            });
            animate(floatingMapY, target.y, {
                type: 'spring',
                stiffness: 410,
                damping: 34,
                mass: 0.83,
            });
            animate(surfaceWidth, target.width, {
                type: 'spring',
                stiffness: 390,
                damping: 36,
                mass: 0.86,
            });
            animate(surfaceHeight, target.height, {
                type: 'spring',
                stiffness: 390,
                damping: 36,
                mass: 0.86,
            });
            return;
        }

        floatingMapX.set(target.x);
        floatingMapY.set(target.y);
        surfaceWidth.set(target.width);
        surfaceHeight.set(target.height);
    }, [floatingMapX, floatingMapY, surfaceHeight, surfaceWidth]);

    const syncSurfaceGeometry = useCallback((animateToPosition: boolean): boolean => {
        if (mapDockMode === 'docked') {
            const dockedRect = resolveDockedMapRect(dockedMapAnchorRef.current) ?? lastDockedMapRectRef.current;
            if (!dockedRect) return false;
            lastDockedMapRectRef.current = dockedRect;
            applySurfaceGeometry(dockedRect, animateToPosition);
            floatingMapRotation.set(0);
            setIsFloatingMapDragging(false);
            setIsFloatingMapResizing(false);
            setIsFloatingMapSettling(false);
            setIsHandlePressed(false);
            return true;
        }

        const floatingMapHeight = floatingMapWidth / FLOATING_MAP_ASPECT_RATIO;
        const currentPosition = floatingMapPositionRef.current
            ?? initialStoredPositionRef.current
            ?? resolveDefaultFloatingMapPosition(floatingMapWidth, floatingMapHeight);
        const clampedPosition = clampFloatingMapPosition(currentPosition, floatingMapWidth, floatingMapHeight);
        floatingMapPositionRef.current = clampedPosition;
        initialStoredPositionRef.current = clampedPosition;
        applySurfaceGeometry(
            {
                x: clampedPosition.x,
                y: clampedPosition.y,
                width: floatingMapWidth,
                height: floatingMapHeight,
            },
            animateToPosition,
        );
        return true;
    }, [applySurfaceGeometry, dockedMapAnchorRef, floatingMapRotation, floatingMapWidth, mapDockMode]);

    useEffect(() => {
        floatingMapSizePresetRef.current = floatingMapSizePreset;
    }, [floatingMapSizePreset]);

    useEffect(() => {
        return () => {
            clearFloatingMapSettleTimer();
        };
    }, [clearFloatingMapSettleTimer]);

    useEffect(() => {
        const didResolve = syncSurfaceGeometry(hasResolvedInitialGeometry);
        if (didResolve && !hasResolvedInitialGeometry) {
            setHasResolvedInitialGeometry(true);
        }
    }, [hasResolvedInitialGeometry, mapDockMode, syncSurfaceGeometry]);

    useEffect(() => {
        if (!hasResolvedInitialGeometry || typeof window === 'undefined') return;
        const rafId = window.requestAnimationFrame(() => {
            syncSurfaceGeometry(true);
        });
        return () => window.cancelAnimationFrame(rafId);
    }, [hasResolvedInitialGeometry, syncSurfaceGeometry, mapDockMode]);

    useEffect(() => {
        if (mapDockMode !== 'docked' || typeof window === 'undefined') return;
        const rafId = window.requestAnimationFrame(() => {
            syncSurfaceGeometry(false);
        });
        return () => window.cancelAnimationFrame(rafId);
    }, [dockedGeometryKey, mapDockMode, syncSurfaceGeometry]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleResize = () => {
            setFloatingMapBaseWidth(resolveFloatingMapWidth());
            syncSurfaceGeometry(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [syncSurfaceGeometry]);

    useEffect(() => {
        if (mapDockMode !== 'docked') return;
        const anchor = dockedMapAnchorRef.current;
        if (!anchor || typeof ResizeObserver !== 'function') return;

        const observer = new ResizeObserver(() => {
            const nextDockedRect = resolveDockedMapRect(anchor);
            if (!nextDockedRect) return;
            lastDockedMapRectRef.current = nextDockedRect;
            applySurfaceGeometry(nextDockedRect, true);
        });

        observer.observe(anchor);
        return () => observer.disconnect();
    }, [applySurfaceGeometry, dockedGeometryKey, dockedMapAnchorRef, mapDockMode]);

    useEffect(() => {
        if (!isHandlePressed) return;
        const clearPressedState = () => setIsHandlePressed(false);
        window.addEventListener('pointerup', clearPressedState, true);
        window.addEventListener('pointercancel', clearPressedState, true);
        return () => {
            window.removeEventListener('pointerup', clearPressedState, true);
            window.removeEventListener('pointercancel', clearPressedState, true);
        };
    }, [isHandlePressed]);

    const persistFloatingMapState = useCallback((position: { x: number; y: number }, sizePreset: FloatingMapSizePreset) => {
        writeFloatingMapPreviewState({
            position,
            sizePreset,
        });
    }, []);

    const handleFloatingMapResizeEnd = useCallback((pointerId: number) => {
        if (!resizeSessionRef.current || resizeSessionRef.current.pointerId !== pointerId) return;
        resizeSessionRef.current = null;
        setIsFloatingMapResizing(false);
        const finalPosition = floatingMapPositionRef.current ?? {
            x: floatingMapX.get(),
            y: floatingMapY.get(),
        };
        persistFloatingMapState(finalPosition, floatingMapSizePresetRef.current);
    }, [floatingMapX, floatingMapY, persistFloatingMapState]);

    const handleFloatingMapResizeMove = useCallback((event: PointerEvent) => {
        const session = resizeSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) return;

        const horizontalDelta = event.clientX - session.startClientX;
        const verticalDelta = event.clientY - session.startClientY;
        const widthFromX = session.startWidth - horizontalDelta;
        const widthFromY = (session.startHeight - verticalDelta) * FLOATING_MAP_ASPECT_RATIO;
        const candidateWidth = Math.abs(horizontalDelta) >= Math.abs(verticalDelta) ? widthFromX : widthFromY;
        const nextPreset = resolveNearestSizePreset(
            candidateWidth,
            floatingMapBaseWidth,
            floatingMapSizePresetRef.current,
        );
        const nextWidth = resolveWidthForPreset(floatingMapBaseWidth, nextPreset);
        const nextHeight = nextWidth / FLOATING_MAP_ASPECT_RATIO;
        const fixedRight = session.startX + session.startWidth;
        const fixedBottom = session.startY + session.startHeight;
        const desiredPosition = {
            x: fixedRight - nextWidth,
            y: fixedBottom - nextHeight,
        };
        const clampedPosition = clampFloatingMapPosition(desiredPosition, nextWidth, nextHeight);
        floatingMapX.set(clampedPosition.x);
        floatingMapY.set(clampedPosition.y);
        surfaceWidth.set(nextWidth);
        surfaceHeight.set(nextHeight);
        floatingMapPositionRef.current = clampedPosition;

        if (nextPreset !== floatingMapSizePresetRef.current) {
            floatingMapSizePresetRef.current = nextPreset;
            setFloatingMapSizePreset(nextPreset);
        }
    }, [floatingMapBaseWidth, floatingMapX, floatingMapY, surfaceHeight, surfaceWidth]);

    useEffect(() => {
        if (!isFloatingMapResizing) return;
        const handlePointerMove = (event: PointerEvent) => {
            handleFloatingMapResizeMove(event);
        };
        const handlePointerUp = (event: PointerEvent) => {
            handleFloatingMapResizeEnd(event.pointerId);
        };

        window.addEventListener('pointermove', handlePointerMove, true);
        window.addEventListener('pointerup', handlePointerUp, true);
        window.addEventListener('pointercancel', handlePointerUp, true);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove, true);
            window.removeEventListener('pointerup', handlePointerUp, true);
            window.removeEventListener('pointercancel', handlePointerUp, true);
        };
    }, [handleFloatingMapResizeEnd, handleFloatingMapResizeMove, isFloatingMapResizing]);

    const beginFloatingMapResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (mapDockMode !== 'floating') return;
        event.preventDefault();
        event.stopPropagation();
        clearFloatingMapSettleTimer();
        setIsFloatingMapDragging(false);
        setIsFloatingMapSettling(false);
        setIsHandlePressed(false);
        setIsFloatingMapResizing(true);
        floatingMapRotation.set(0);
        resizeSessionRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: floatingMapX.get(),
            startY: floatingMapY.get(),
            startWidth: surfaceWidth.get(),
            startHeight: surfaceHeight.get(),
        };
    }, [clearFloatingMapSettleTimer, floatingMapRotation, floatingMapX, floatingMapY, mapDockMode, surfaceHeight, surfaceWidth]);

    const beginFloatingMapDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (mapDockMode !== 'floating' || isFloatingMapResizing) return;
        setIsHandlePressed(true);
        event.preventDefault();
        event.stopPropagation();
        floatingMapDragControls.start(event, { snapToCursor: false });
    }, [floatingMapDragControls, isFloatingMapResizing, mapDockMode]);

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
        const panelWidth = surfaceWidth.get();
        const panelHeight = surfaceHeight.get();
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
    }, [floatingMapRotation, floatingMapX, floatingMapY, surfaceHeight, surfaceWidth, tripId]);

    const handleFloatingMapDragEnd = useCallback(() => {
        setIsHandlePressed(false);
        setIsFloatingMapDragging(false);
        const panelWidth = surfaceWidth.get();
        const panelHeight = surfaceHeight.get();
        if (!didMoveFloatingMapRef.current) {
            animate(floatingMapRotation, 0, {
                type: 'spring',
                stiffness: 280,
                damping: 22,
                mass: 0.76,
            });
            setIsFloatingMapSettling(false);
            return;
        }

        const currentPosition = clampFloatingMapPosition(
            { x: floatingMapX.get(), y: floatingMapY.get() },
            panelWidth,
            panelHeight,
        );
        const snapTarget = resolveNearestFloatingMapSnapTarget(currentPosition, panelWidth, panelHeight);
        const releaseRotation = clampValue(floatingMapRotation.get() * 0.5, -7, 7);

        setIsFloatingMapSettling(true);
        floatingMapPositionRef.current = snapTarget;
        floatingMapRotation.set(releaseRotation);

        animate(floatingMapX, snapTarget.x, {
            type: 'spring',
            stiffness: 440,
            damping: 34,
            mass: 0.83,
        });
        animate(floatingMapY, snapTarget.y, {
            type: 'spring',
            stiffness: 440,
            damping: 34,
            mass: 0.83,
        });
        animate(floatingMapRotation, 0, {
            type: 'spring',
            stiffness: 260,
            damping: 20,
            mass: 0.75,
        });

        clearFloatingMapSettleTimer();
        dragSettleTimerRef.current = setTimeout(() => {
            setIsFloatingMapSettling(false);
            dragSettleTimerRef.current = null;
        }, FLOATING_MAP_SETTLE_DURATION_MS);

        persistFloatingMapState(snapTarget, floatingMapSizePresetRef.current);
    }, [clearFloatingMapSettleTimer, floatingMapRotation, floatingMapX, floatingMapY, persistFloatingMapState, surfaceHeight, surfaceWidth]);

    return (
        <LazyMotion features={domMax}>
            <m.div
                ref={mapViewportRef}
                data-testid={mapDockMode === 'floating' ? 'floating-map-container' : undefined}
                drag={mapDockMode === 'floating' && !isFloatingMapResizing}
                dragControls={floatingMapDragControls}
                dragListener={false}
                dragElastic={0.06}
                dragMomentum={false}
                onDragStart={handleFloatingMapDragStart}
                onDrag={handleFloatingMapDrag}
                onDragEnd={handleFloatingMapDragEnd}
                animate={{
                    scale: isFloatingMapDragging || isFloatingMapResizing ? 1.018 : 1,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 31,
                    mass: 0.82,
                }}
                className={`fixed overflow-hidden bg-gray-100 transition-[border-radius,box-shadow,border-width] duration-300 ease-out ${
                    mapDockMode === 'floating'
                        ? `z-[1400] border-[4px] border-white ${
                            isFloatingMapDragging || isFloatingMapResizing
                                ? 'shadow-[0_34px_70px_-28px_rgba(15,23,42,0.72),0_14px_30px_-16px_rgba(15,23,42,0.45)]'
                                : 'shadow-[0_20px_50px_-22px_rgba(15,23,42,0.58),0_10px_24px_-12px_rgba(15,23,42,0.38)]'
                        }`
                        : 'z-[20] border-0 shadow-none'
                }`}
                style={{
                    top: 0,
                    left: 0,
                    x: floatingMapX,
                    y: floatingMapY,
                    width: surfaceWidth,
                    height: surfaceHeight,
                    rotate: floatingMapVisualRotation,
                    transformOrigin: '50% 0%',
                    borderRadius: mapDockMode === 'floating' ? FLOATING_MAP_BORDER_RADIUS : '0px',
                }}
            >
                {mapDockMode === 'floating' && (
                    <div className="pointer-events-none absolute top-0 inset-x-0 z-[90] flex justify-center">
                        <button
                            type="button"
                            data-testid="floating-map-drag-handle"
                            data-floating-map-control="true"
                            onPointerDown={beginFloatingMapDrag}
                            className={`group pointer-events-auto inline-flex h-8 w-24 items-center justify-center rounded-t-none rounded-b-full border-[4px] border-t-0 border-white bg-white/95 shadow-sm backdrop-blur-md touch-none transition-transform ${
                                isHandlePressed || isFloatingMapDragging ? 'cursor-grabbing scale-[1.03]' : 'cursor-grab'
                            }`}
                            aria-label="Move floating map preview"
                        >
                            <span className="inline-block h-1.5 w-14 rounded-full bg-slate-400/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-colors group-hover:bg-accent-500" />
                            <span className="sr-only">Move floating map preview</span>
                        </button>
                    </div>
                )}
                {mapDockMode === 'floating' && (
                    <div className="pointer-events-none absolute top-0 start-0 z-[92]">
                        <button
                            type="button"
                            data-testid="floating-map-resize-handle"
                            data-floating-map-control="true"
                            onPointerDown={beginFloatingMapResize}
                            className="group pointer-events-auto relative flex h-8 w-8 items-start justify-start rounded-br-xl border-[4px] border-s-0 border-t-0 border-white bg-white/92 ps-1 pt-1 shadow-sm backdrop-blur-md transition-colors hover:bg-white cursor-nwse-resize touch-none"
                            aria-label="Resize floating map preview"
                        >
                            <span className="sr-only">Resize floating map preview</span>
                            <span className="relative inline-block h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-accent-500">
                                <span className="absolute end-0 top-0 h-0.5 w-3 rotate-45 rounded-full bg-current" />
                                <span className="absolute end-[-1px] top-[5px] h-0.5 w-3 rotate-45 rounded-full bg-current" />
                            </span>
                        </button>
                    </div>
                )}
                <div className="h-full w-full overflow-hidden" style={{ borderRadius: 'inherit' }}>
                    {children}
                </div>
                {isFloatingMapSettling && <span className="sr-only">Settling floating map preview</span>}
            </m.div>
        </LazyMotion>
    );
};
