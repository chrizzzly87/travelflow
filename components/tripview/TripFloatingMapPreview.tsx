import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LazyMotion, animate, domMax, m, useDragControls, useMotionValue, useSpring, type PanInfo } from 'framer-motion';
import { ArrowsInSimple, ArrowsOutSimple, DeviceRotate } from '@phosphor-icons/react';

import { trackEvent } from '../../services/analyticsService';
import {
    type FloatingMapOrientation,
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
const FLOATING_MAP_MIN_WIDTH = 180;
const FLOATING_MAP_MAX_WIDTH = 420;
const FLOATING_MAP_VIEWPORT_RATIO = 0.26;
const FLOATING_MAP_SMALL_SIZE_RATIO = 0.62;
const FLOATING_MAP_MIN_SIZE_DELTA = 90;
const FLOATING_MAP_DRAG_THRESHOLD = 4;
const FLOATING_MAP_MAX_ROTATION = 11;
const FLOATING_MAP_ROTATION_VELOCITY_FACTOR = 0.015;
const FLOATING_MAP_SETTLE_DURATION_MS = 380;
const FLOATING_MAP_BORDER_RADIUS = '1rem';
const FLOATING_MAP_NAV_TOP_OFFSET = 92;
const FLOATING_MAP_ASPECT_RATIO: Record<FloatingMapOrientation, number> = {
    portrait: 2 / 3,
    landscape: 3 / 2,
};
const FLOATING_MAP_ORIENTATION_SWAP_FACTOR = 1 / FLOATING_MAP_ASPECT_RATIO.portrait;
const FLOATING_MAP_INTERACTION_SCALE = 1.01;
const clampValue = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const resolveFloatingMapPresetWidths = (baseWidth: number): Record<FloatingMapSizePreset, number> => {
    const clampedBase = clampValue(baseWidth, FLOATING_MAP_MIN_WIDTH, FLOATING_MAP_MAX_WIDTH);
    const largeWidth = Math.round(clampedBase);
    const compactMaxWidth = Math.max(
        FLOATING_MAP_MIN_WIDTH,
        largeWidth - FLOATING_MAP_MIN_SIZE_DELTA,
    );
    const compactWidth = Math.round(clampValue(
        largeWidth * FLOATING_MAP_SMALL_SIZE_RATIO,
        FLOATING_MAP_MIN_WIDTH,
        compactMaxWidth,
    ));
    const middleWidth = Math.round((compactWidth + largeWidth) / 2);

    return {
        sm: compactWidth,
        md: middleWidth,
        lg: largeWidth,
    };
};

const resolveWidthForPreset = (baseWidth: number, preset: FloatingMapSizePreset): number =>
    resolveFloatingMapPresetWidths(baseWidth)[preset];

const normalizeFloatingMapSizePreset = (preset?: FloatingMapSizePreset): FloatingMapSizePreset =>
    preset === 'sm' ? 'sm' : 'lg';

const resolveFloatingMapDimensions = (
    shortEdge: number,
    orientation: FloatingMapOrientation,
): { width: number; height: number } => {
    const portraitWidth = shortEdge;
    const portraitHeight = portraitWidth * FLOATING_MAP_ORIENTATION_SWAP_FACTOR;
    if (orientation === 'portrait') {
        return {
            width: portraitWidth,
            height: portraitHeight,
        };
    }
    return {
        width: portraitHeight,
        height: portraitWidth,
    };
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

type FloatingMapSideAnchor = {
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'bottom';
};

const resolveFloatingMapSideAnchor = (
    position: { x: number; y: number },
    panelWidth: number,
    panelHeight: number,
): FloatingMapSideAnchor => {
    const { minX, minY, maxX, maxY } = resolveFloatingMapBounds(panelWidth, panelHeight);
    const centerX = minX + ((maxX - minX) / 2);
    const distanceLeft = Math.abs(position.x - minX);
    const distanceRight = Math.abs(position.x - maxX);
    const distanceCenter = Math.abs(position.x - centerX);
    const distanceTop = Math.abs(position.y - minY);
    const distanceBottom = Math.abs(position.y - maxY);
    const horizontal: FloatingMapSideAnchor['horizontal'] = distanceCenter <= distanceLeft && distanceCenter <= distanceRight
        ? 'center'
        : distanceRight < distanceLeft
            ? 'right'
            : 'left';

    return {
        horizontal,
        vertical: distanceBottom < distanceTop ? 'bottom' : 'top',
    };
};

const resolveFloatingMapPositionForAnchor = (
    anchor: FloatingMapSideAnchor,
    panelWidth: number,
    panelHeight: number,
): { x: number; y: number } => {
    const bounds = resolveFloatingMapBounds(panelWidth, panelHeight);
    const centerX = bounds.minX + ((bounds.maxX - bounds.minX) / 2);
    return {
        x: anchor.horizontal === 'right'
            ? bounds.maxX
            : anchor.horizontal === 'center'
                ? centerX
                : bounds.minX,
        y: anchor.vertical === 'bottom' ? bounds.maxY : bounds.minY,
    };
};

type FloatingMapSnapTarget = {
    x: number;
    y: number;
    anchor: FloatingMapSideAnchor;
};

const resolveFloatingMapSnapTargets = (panelWidth: number, panelHeight: number): FloatingMapSnapTarget[] => {
    const { minX, minY, maxX, maxY } = resolveFloatingMapBounds(panelWidth, panelHeight);
    const centerX = minX + ((maxX - minX) / 2);
    return [
        { x: minX, y: minY, anchor: { horizontal: 'left', vertical: 'top' } },
        { x: maxX, y: minY, anchor: { horizontal: 'right', vertical: 'top' } },
        { x: maxX, y: maxY, anchor: { horizontal: 'right', vertical: 'bottom' } },
        { x: centerX, y: maxY, anchor: { horizontal: 'center', vertical: 'bottom' } },
        { x: minX, y: maxY, anchor: { horizontal: 'left', vertical: 'bottom' } },
    ];
};

const resolveNearestFloatingMapSnapTarget = (
    position: { x: number; y: number },
    panelWidth: number,
    panelHeight: number,
): FloatingMapSnapTarget => {
    const points = resolveFloatingMapSnapTargets(panelWidth, panelHeight);
    if (points.length === 0) {
        const clampedPosition = clampFloatingMapPosition(position, panelWidth, panelHeight);
        return {
            ...clampedPosition,
            anchor: resolveFloatingMapSideAnchor(clampedPosition, panelWidth, panelHeight),
        };
    }
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
        normalizeFloatingMapSizePreset(initialPersistedStateRef.current.sizePreset)
    ));
    const [floatingMapOrientation, setFloatingMapOrientation] = useState<FloatingMapOrientation>(() => (
        initialPersistedStateRef.current.orientation ?? 'portrait'
    ));
    const floatingMapSizePresetRef = useRef<FloatingMapSizePreset>(floatingMapSizePreset);
    const floatingMapOrientationRef = useRef<FloatingMapOrientation>(floatingMapOrientation);
    const [isFloatingMapDragging, setIsFloatingMapDragging] = useState(false);
    const [isFloatingMapSettling, setIsFloatingMapSettling] = useState(false);
    const [isHandlePressed, setIsHandlePressed] = useState(false);
    const [hasResolvedInitialGeometry, setHasResolvedInitialGeometry] = useState(false);
    const dragSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const floatingMapDragControls = useDragControls();
    const floatingMapPositionRef = useRef<{ x: number; y: number } | null>(null);
    const floatingMapAnchorRef = useRef<FloatingMapSideAnchor | null>(null);
    const initialStoredPositionRef = useRef<{ x: number; y: number } | null>(
        initialPersistedStateRef.current.position ?? null,
    );
    const lastDockedMapRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
    const didMoveFloatingMapRef = useRef(false);
    const didTrackFloatingMapRepositionRef = useRef(false);
    const floatingMapShortEdge = resolveWidthForPreset(floatingMapBaseWidth, floatingMapSizePreset);
    const floatingMapDimensions = resolveFloatingMapDimensions(floatingMapShortEdge, floatingMapOrientation);
    const floatingMapSurfaceWidth = floatingMapDimensions.width;
    const floatingMapSurfaceHeight = floatingMapDimensions.height;
    const floatingMapX = useMotionValue(FLOATING_MAP_MARGIN);
    const floatingMapY = useMotionValue(FLOATING_MAP_MARGIN);
    const surfaceWidth = useMotionValue(floatingMapSurfaceWidth);
    const surfaceHeight = useMotionValue(floatingMapSurfaceHeight);
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
                stiffness: 330,
                damping: 40,
                mass: 0.9,
            });
            animate(floatingMapY, target.y, {
                type: 'spring',
                stiffness: 330,
                damping: 40,
                mass: 0.9,
            });
            animate(surfaceWidth, target.width, {
                type: 'spring',
                stiffness: 320,
                damping: 40,
                mass: 0.92,
            });
            animate(surfaceHeight, target.height, {
                type: 'spring',
                stiffness: 320,
                damping: 40,
                mass: 0.92,
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
            setIsFloatingMapSettling(false);
            setIsHandlePressed(false);
            return true;
        }

        const floatingMapHeight = floatingMapSurfaceHeight;
        const floatingMapWidth = floatingMapSurfaceWidth;
        const currentPosition = floatingMapPositionRef.current
            ?? initialStoredPositionRef.current
            ?? resolveDefaultFloatingMapPosition(floatingMapWidth, floatingMapHeight);
        const clampedPosition = clampFloatingMapPosition(currentPosition, floatingMapWidth, floatingMapHeight);
        floatingMapPositionRef.current = clampedPosition;
        floatingMapAnchorRef.current = resolveFloatingMapSideAnchor(
            clampedPosition,
            floatingMapWidth,
            floatingMapHeight,
        );
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
    }, [applySurfaceGeometry, dockedMapAnchorRef, floatingMapRotation, floatingMapSurfaceHeight, floatingMapSurfaceWidth, mapDockMode]);

    useEffect(() => {
        floatingMapSizePresetRef.current = floatingMapSizePreset;
    }, [floatingMapSizePreset]);

    useEffect(() => {
        floatingMapOrientationRef.current = floatingMapOrientation;
    }, [floatingMapOrientation]);

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
            const nextBaseWidth = resolveFloatingMapWidth();
            setFloatingMapBaseWidth(nextBaseWidth);
            if (mapDockMode === 'floating') {
                const currentPosition = floatingMapPositionRef.current ?? {
                    x: floatingMapX.get(),
                    y: floatingMapY.get(),
                };
                const currentWidth = surfaceWidth.get();
                const currentHeight = surfaceHeight.get();
                const sideAnchor = floatingMapAnchorRef.current
                    ?? resolveFloatingMapSideAnchor(currentPosition, currentWidth, currentHeight);
                const normalizedPreset = normalizeFloatingMapSizePreset(floatingMapSizePresetRef.current);
                const nextShortEdge = resolveWidthForPreset(nextBaseWidth, normalizedPreset);
                const nextDimensions = resolveFloatingMapDimensions(nextShortEdge, floatingMapOrientationRef.current);
                const anchoredPosition = resolveFloatingMapPositionForAnchor(
                    sideAnchor,
                    nextDimensions.width,
                    nextDimensions.height,
                );

                floatingMapAnchorRef.current = sideAnchor;
                floatingMapPositionRef.current = anchoredPosition;
                applySurfaceGeometry(
                    {
                        x: anchoredPosition.x,
                        y: anchoredPosition.y,
                        width: nextDimensions.width,
                        height: nextDimensions.height,
                    },
                    true,
                );
                writeFloatingMapPreviewState({
                    position: anchoredPosition,
                    sizePreset: normalizedPreset,
                    orientation: floatingMapOrientationRef.current,
                });
                return;
            }
            syncSurfaceGeometry(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [
        applySurfaceGeometry,
        floatingMapX,
        floatingMapY,
        mapDockMode,
        surfaceHeight,
        surfaceWidth,
        syncSurfaceGeometry,
    ]);

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

    const persistFloatingMapState = useCallback((
        position: { x: number; y: number },
        sizePreset: FloatingMapSizePreset,
        orientation: FloatingMapOrientation = floatingMapOrientationRef.current,
    ) => {
        const normalizedPreset = normalizeFloatingMapSizePreset(sizePreset);
        writeFloatingMapPreviewState({
            position,
            sizePreset: normalizedPreset,
            orientation,
        });
    }, []);

    const applyAnchoredSurfaceGeometry = useCallback((
        targetSize: { width: number; height: number },
        targetOrientation: FloatingMapOrientation,
        targetSizePreset: FloatingMapSizePreset,
    ) => {
        const currentPosition = floatingMapPositionRef.current ?? {
            x: floatingMapX.get(),
            y: floatingMapY.get(),
        };
        const currentWidth = surfaceWidth.get();
        const currentHeight = surfaceHeight.get();
        const sideAnchor = resolveFloatingMapSideAnchor(currentPosition, currentWidth, currentHeight);
        const normalizedPreset = normalizeFloatingMapSizePreset(targetSizePreset);
        const anchoredPosition = resolveFloatingMapPositionForAnchor(sideAnchor, targetSize.width, targetSize.height);

        floatingMapPositionRef.current = anchoredPosition;
        floatingMapAnchorRef.current = sideAnchor;
        floatingMapOrientationRef.current = targetOrientation;
        floatingMapSizePresetRef.current = normalizedPreset;

        setFloatingMapOrientation(targetOrientation);
        setFloatingMapSizePreset(normalizedPreset);
        applySurfaceGeometry({
            x: anchoredPosition.x,
            y: anchoredPosition.y,
            width: targetSize.width,
            height: targetSize.height,
        }, true);
        persistFloatingMapState(anchoredPosition, normalizedPreset, targetOrientation);
    }, [applySurfaceGeometry, floatingMapX, floatingMapY, persistFloatingMapState, surfaceHeight, surfaceWidth]);

    const toggleFloatingMapSize = useCallback(() => {
        if (mapDockMode !== 'floating') return;
        const nextSizePreset: FloatingMapSizePreset = floatingMapSizePresetRef.current === 'lg' ? 'sm' : 'lg';
        const orientation = floatingMapOrientationRef.current;
        const nextShortEdge = resolveWidthForPreset(floatingMapBaseWidth, nextSizePreset);
        const nextDimensions = resolveFloatingMapDimensions(nextShortEdge, orientation);
        applyAnchoredSurfaceGeometry(nextDimensions, orientation, nextSizePreset);
        trackEvent('trip_view__map_preview--size_toggle', {
            trip_id: tripId,
            size_preset: nextSizePreset,
        });
    }, [applyAnchoredSurfaceGeometry, floatingMapBaseWidth, mapDockMode, tripId]);

    const toggleFloatingMapOrientation = useCallback(() => {
        if (mapDockMode !== 'floating') return;
        const nextOrientation: FloatingMapOrientation =
            floatingMapOrientationRef.current === 'portrait' ? 'landscape' : 'portrait';
        const currentWidth = surfaceWidth.get();
        const currentHeight = surfaceHeight.get();
        const nextDimensions = {
            width: currentHeight,
            height: currentWidth,
        };
        applyAnchoredSurfaceGeometry(nextDimensions, nextOrientation, floatingMapSizePresetRef.current);
        trackEvent('trip_view__map_preview--orientation_toggle', {
            trip_id: tripId,
            orientation: nextOrientation,
        });
    }, [
        applyAnchoredSurfaceGeometry,
        mapDockMode,
        surfaceHeight,
        surfaceWidth,
        tripId,
    ]);

    const beginFloatingMapDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
        if (mapDockMode !== 'floating') return;
        setIsHandlePressed(true);
        event.preventDefault();
        event.stopPropagation();
        floatingMapDragControls.start(event, { snapToCursor: false });
    }, [floatingMapDragControls, mapDockMode]);

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
        floatingMapPositionRef.current = { x: snapTarget.x, y: snapTarget.y };
        floatingMapAnchorRef.current = snapTarget.anchor;
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

        persistFloatingMapState(
            { x: snapTarget.x, y: snapTarget.y },
            normalizeFloatingMapSizePreset(floatingMapSizePresetRef.current),
        );
    }, [clearFloatingMapSettleTimer, floatingMapRotation, floatingMapX, floatingMapY, persistFloatingMapState, surfaceHeight, surfaceWidth]);

    return (
        <LazyMotion features={domMax}>
            <m.div
                ref={mapViewportRef}
                data-testid={mapDockMode === 'floating' ? 'floating-map-container' : undefined}
                drag={mapDockMode === 'floating'}
                dragControls={floatingMapDragControls}
                dragListener={false}
                dragElastic={0.06}
                dragMomentum={false}
                onDragStart={handleFloatingMapDragStart}
                onDrag={handleFloatingMapDrag}
                onDragEnd={handleFloatingMapDragEnd}
                animate={{
                    scale: isFloatingMapDragging ? FLOATING_MAP_INTERACTION_SCALE : 1,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 36,
                    mass: 0.9,
                }}
                className={`fixed overflow-hidden bg-gray-100 transition-[border-radius,box-shadow,border-width] duration-300 ease-out ${
                    mapDockMode === 'floating'
                        ? `z-[1400] border-[4px] border-white ${
                            isFloatingMapDragging
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
                    <div className="pointer-events-none absolute top-0 start-0 z-[92] flex items-start gap-1 ps-1 pt-1">
                        <button
                            type="button"
                            data-testid="floating-map-resize-handle"
                            data-floating-map-control="true"
                            onClick={toggleFloatingMapSize}
                            className="group pointer-events-auto relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[4px] border-white bg-white/92 text-gray-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-accent-600"
                            aria-label={floatingMapSizePreset === 'lg'
                                ? 'Use compact floating map size'
                                : 'Use expanded floating map size'}
                        >
                            {floatingMapSizePreset === 'lg'
                                ? <ArrowsInSimple size={18} weight="regular" className="-scale-x-100" />
                                : <ArrowsOutSimple size={18} weight="regular" className="-scale-x-100" />}
                            <span className="sr-only">
                                {floatingMapSizePreset === 'lg'
                                    ? 'Use compact floating map size'
                                    : 'Use expanded floating map size'}
                            </span>
                        </button>
                        <button
                            type="button"
                            data-testid="floating-map-orientation-toggle"
                            data-floating-map-control="true"
                            onClick={toggleFloatingMapOrientation}
                            className="group pointer-events-auto relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[4px] border-white bg-white/92 text-gray-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-accent-600"
                            aria-label={floatingMapOrientation === 'portrait'
                                ? 'Switch floating map preview to landscape'
                                : 'Switch floating map preview to portrait'}
                        >
                            <m.span
                                animate={{ rotate: floatingMapOrientation === 'landscape' ? 90 : 0 }}
                                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                                className="inline-flex h-[18px] w-[18px] items-center justify-center"
                            >
                                <DeviceRotate size={18} weight="regular" />
                            </m.span>
                            <span className="sr-only">
                                {floatingMapOrientation === 'portrait'
                                    ? 'Switch floating map preview to landscape'
                                    : 'Switch floating map preview to portrait'}
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
