import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { writeLocalStorageItem } from '../../services/browserStorageService';

interface UseTripResizeControlsOptions {
    layoutMode: 'vertical' | 'horizontal';
    mapDockMode: 'docked' | 'floating';
    timelineMode: 'calendar' | 'timeline';
    timelineView: 'horizontal' | 'vertical';
    horizontalTimelineDayCount: number;
    zoomLevel: number;
    isZoomDirty: boolean;
    clampZoomLevel: (value: number) => number;
    setZoomLevel: Dispatch<SetStateAction<number>>;
    sidebarWidth: number;
    setSidebarWidth: Dispatch<SetStateAction<number>>;
    detailsWidth: number;
    setDetailsWidth: Dispatch<SetStateAction<number>>;
    timelineHeight: number;
    setTimelineHeight: Dispatch<SetStateAction<number>>;
    detailsPanelVisible: boolean;
    minSidebarWidth: number;
    minTimelineHeight: number;
    minBottomMapHeight: number;
    minMapWidth: number;
    minTimelineColumnWidth: number;
    minDetailsWidth: number;
    hardMinDetailsWidth: number;
    resizerWidth: number;
    resizeKeyboardStep: number;
    horizontalTimelineAutoFitPadding: number;
    verticalTimelineAutoFitPadding: number;
    zoomLevelPresets: number[];
    basePixelsPerDay: number;
}

const MIN_AUTO_FIT_TIMELINE_WIDTH = 160;
const MIN_AUTO_FIT_TIMELINE_HEIGHT = 220;

const resolveAutoFitZoom = (
    targetZoom: number,
    clampZoomLevel: (value: number) => number,
    zoomLevelPresets: number[],
): number => {
    const clampedTarget = clampZoomLevel(targetZoom);
    if (!Number.isFinite(clampedTarget)) return NaN;

    const normalizedPresets = zoomLevelPresets
        .map((value) => clampZoomLevel(value))
        .filter((value, index, values) => Number.isFinite(value) && values.indexOf(value) === index)
        .sort((left, right) => left - right);

    if (normalizedPresets.length === 0) return clampedTarget;

    let bestZoom = normalizedPresets[0];
    let bestScore = Number.POSITIVE_INFINITY;
    normalizedPresets.forEach((presetZoom) => {
        const absoluteDistance = Math.abs(presetZoom - clampedTarget);
        const underfillPenalty = presetZoom < clampedTarget ? 0.015 : 0;
        const score = absoluteDistance + underfillPenalty;
        if (score < bestScore) {
            bestScore = score;
            bestZoom = presetZoom;
        }
    });
    return bestZoom;
};

export const useTripResizeControls = ({
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
    minSidebarWidth,
    minTimelineHeight,
    minBottomMapHeight,
    minMapWidth,
    minTimelineColumnWidth,
    minDetailsWidth,
    hardMinDetailsWidth,
    resizerWidth,
    resizeKeyboardStep,
    horizontalTimelineAutoFitPadding,
    verticalTimelineAutoFitPadding,
    zoomLevelPresets,
    basePixelsPerDay,
}: UseTripResizeControlsOptions) => {
    const verticalLayoutTimelineRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef<'sidebar' | 'details' | 'timeline-h' | null>(null);
    const detailsResizeStartXRef = useRef(0);
    const detailsResizeStartWidthRef = useRef(detailsWidth);
    const previousLayoutModeRef = useRef(layoutMode);
    const previousMapDockModeRef = useRef(mapDockMode);
    const previousTimelineModeRef = useRef(timelineMode);
    const previousTimelineViewRef = useRef(timelineView);
    const hasAutoFitRunRef = useRef(false);

    const clampDetailsWidth = useCallback((rawWidth: number) => {
        if (typeof window === 'undefined') return Math.max(minDetailsWidth, rawWidth);

        if (layoutMode === 'horizontal') {
            const maxWidth = window.innerWidth - sidebarWidth - minMapWidth - (resizerWidth * 2);
            const boundedMax = Math.max(hardMinDetailsWidth, maxWidth);
            const boundedMin = Math.min(minDetailsWidth, boundedMax);
            return Math.max(boundedMin, Math.min(boundedMax, rawWidth));
        }

        const maxWidth = window.innerWidth - minTimelineColumnWidth;
        const boundedMax = Math.max(hardMinDetailsWidth, maxWidth);
        const boundedMin = Math.min(minDetailsWidth, boundedMax);
        return Math.max(boundedMin, Math.min(boundedMax, rawWidth));
    }, [
        hardMinDetailsWidth,
        layoutMode,
        minDetailsWidth,
        minMapWidth,
        minTimelineColumnWidth,
        resizerWidth,
        sidebarWidth,
    ]);

    useEffect(() => {
        setDetailsWidth((previous) => clampDetailsWidth(previous));
    }, [clampDetailsWidth, setDetailsWidth]);

    useEffect(() => {
        const handleResize = () => setDetailsWidth((previous) => clampDetailsWidth(previous));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampDetailsWidth, setDetailsWidth]);

    const autoFitTimelineZoom = useCallback((mode: 'horizontal' | 'vertical') => {
        if (isZoomDirty) return false;

        const timelineViewport = verticalLayoutTimelineRef.current;
        if (!timelineViewport) return false;

        const dayCount = Math.max(1, horizontalTimelineDayCount);
        let targetPixelsPerDay: number | null = null;

        if (mode === 'horizontal') {
            const measuredWidth = timelineViewport.clientWidth;
            if (measuredWidth <= 0) return false;
            const usableTimelineWidth = Math.max(MIN_AUTO_FIT_TIMELINE_WIDTH, measuredWidth - horizontalTimelineAutoFitPadding);
            const currentTimelineWidth = dayCount * basePixelsPerDay * zoomLevel;
            if (currentTimelineWidth >= usableTimelineWidth) return false;
            targetPixelsPerDay = usableTimelineWidth / dayCount;
        } else {
            const measuredHeight = timelineViewport.clientHeight;
            if (measuredHeight <= 0) return false;
            const usableTimelineHeight = Math.max(MIN_AUTO_FIT_TIMELINE_HEIGHT, measuredHeight - verticalTimelineAutoFitPadding);
            targetPixelsPerDay = usableTimelineHeight / dayCount;
        }

        const nextZoom = resolveAutoFitZoom(
            targetPixelsPerDay / basePixelsPerDay,
            clampZoomLevel,
            zoomLevelPresets,
        );
        if (!Number.isFinite(nextZoom)) return false;

        setZoomLevel((previous) => (Math.abs(previous - nextZoom) < 0.01 ? previous : nextZoom));
        return true;
    }, [
        basePixelsPerDay,
        clampZoomLevel,
        horizontalTimelineAutoFitPadding,
        horizontalTimelineDayCount,
        isZoomDirty,
        setZoomLevel,
        verticalTimelineAutoFitPadding,
        zoomLevel,
        zoomLevelPresets,
    ]);

    useEffect(() => {
        const previousLayoutMode = previousLayoutModeRef.current;
        const previousMapDockMode = previousMapDockModeRef.current;
        const previousTimelineMode = previousTimelineModeRef.current;
        const previousTimelineView = previousTimelineViewRef.current;
        const isFirstRenderAutoFit = !hasAutoFitRunRef.current;
        const didLayoutModeChange = previousLayoutMode !== layoutMode;
        const didMapDockModeChange = previousMapDockMode !== mapDockMode;
        const didTimelineModeChange = previousTimelineMode !== timelineMode;
        const didTimelineViewChange = previousTimelineView !== timelineView;
        const shouldAttemptAutoFit = timelineMode === 'calendar'
            && !isZoomDirty
            && (
                isFirstRenderAutoFit
                || didLayoutModeChange
                || didMapDockModeChange
                || didTimelineModeChange
                || didTimelineViewChange
            );

        if (shouldAttemptAutoFit) {
            const fitMode: 'horizontal' | 'vertical' = timelineView === 'vertical' ? 'vertical' : 'horizontal';
            const runAutoFit = () => {
                if (!autoFitTimelineZoom(fitMode)) {
                    requestAnimationFrame(() => {
                        autoFitTimelineZoom(fitMode);
                    });
                }
            };
            requestAnimationFrame(runAutoFit);
        }

        previousLayoutModeRef.current = layoutMode;
        previousMapDockModeRef.current = mapDockMode;
        previousTimelineModeRef.current = timelineMode;
        previousTimelineViewRef.current = timelineView;
        hasAutoFitRunRef.current = true;
    }, [autoFitTimelineZoom, isZoomDirty, layoutMode, mapDockMode, timelineMode, timelineView]);

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
        if (isResizingRef.current === 'sidebar') {
            writeLocalStorageItem('tf_sidebar_width', sidebarWidth.toString());
        }
        if (isResizingRef.current === 'details') {
            writeLocalStorageItem('tf_details_width', Math.round(detailsWidth).toString());
        }
        if (isResizingRef.current === 'timeline-h') {
            writeLocalStorageItem('tf_timeline_height', timelineHeight.toString());
        }

        isResizingRef.current = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, [detailsWidth, sidebarWidth, timelineHeight]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!isResizingRef.current) return;

        if (isResizingRef.current === 'sidebar') {
            const reservedForDetails = detailsPanelVisible ? detailsWidth : 0;
            const maxSidebar = window.innerWidth - reservedForDetails - minMapWidth - (resizerWidth * 2);
            const boundedMax = Math.max(minSidebarWidth, maxSidebar);
            setSidebarWidth(Math.max(minSidebarWidth, Math.min(boundedMax, event.clientX)));
            return;
        }

        if (isResizingRef.current === 'details') {
            const deltaX = event.clientX - detailsResizeStartXRef.current;
            const nextWidth = detailsResizeStartWidthRef.current + deltaX;
            setDetailsWidth(clampDetailsWidth(nextWidth));
            return;
        }

        const maxTimelineHeight = window.innerHeight - minBottomMapHeight;
        setTimelineHeight(Math.max(minTimelineHeight, Math.min(maxTimelineHeight, window.innerHeight - event.clientY)));
    }, [
        clampDetailsWidth,
        detailsPanelVisible,
        detailsWidth,
        minBottomMapHeight,
        minMapWidth,
        minSidebarWidth,
        minTimelineHeight,
        resizerWidth,
        setDetailsWidth,
        setSidebarWidth,
        setTimelineHeight,
    ]);

    const handleSidebarResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const reservedForDetails = detailsPanelVisible ? detailsWidth : 0;
        const maxSidebar = window.innerWidth - reservedForDetails - minMapWidth - (resizerWidth * 2);
        const boundedMax = Math.max(minSidebarWidth, maxSidebar);
        setSidebarWidth((previous) =>
            Math.max(minSidebarWidth, Math.min(boundedMax, previous + (direction * resizeKeyboardStep)))
        );
    }, [
        detailsPanelVisible,
        detailsWidth,
        minMapWidth,
        minSidebarWidth,
        resizeKeyboardStep,
        resizerWidth,
        setSidebarWidth,
    ]);

    const handleDetailsResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setDetailsWidth((previous) => clampDetailsWidth(previous + (direction * resizeKeyboardStep)));
    }, [clampDetailsWidth, resizeKeyboardStep, setDetailsWidth]);

    const handleTimelineResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        const maxTimelineHeight = window.innerHeight - minBottomMapHeight;
        setTimelineHeight((previous) =>
            Math.max(minTimelineHeight, Math.min(maxTimelineHeight, previous + (direction * resizeKeyboardStep)))
        );
    }, [minBottomMapHeight, minTimelineHeight, resizeKeyboardStep, setTimelineHeight]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [handleMouseMove, stopResizing]);

    return {
        verticalLayoutTimelineRef,
        startResizing,
        handleSidebarResizeKeyDown,
        handleDetailsResizeKeyDown,
        handleTimelineResizeKeyDown,
    };
};
