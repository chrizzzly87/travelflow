import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { writeLocalStorageItem } from '../../services/browserStorageService';

interface UseTripResizeControlsOptions {
    isMobile: boolean;
    layoutMode: 'vertical' | 'horizontal';
    mapDockMode: 'docked' | 'floating';
    timelineMode: 'calendar' | 'timeline';
    timelineView: 'horizontal' | 'vertical';
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
    onAutoFitZoomApplied?: () => void;
    onManualViewSettingsChange?: () => void;
    onPaneResize?: () => void;
}

const MIN_AUTO_FIT_TIMELINE_WIDTH = 160;
const MIN_AUTO_FIT_TIMELINE_HEIGHT = 220;

const parseDimensionValue = (value?: string): number | null => {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const resolveTimelineSurface = (viewport: HTMLDivElement): HTMLElement =>
    viewport.querySelector<HTMLElement>('.timeline-scroll') ?? viewport;

const resolveTimelineContentExtent = (
    surface: HTMLElement,
    axis: 'width' | 'height',
): number => {
    const contentElement = surface.firstElementChild instanceof HTMLElement
        ? surface.firstElementChild
        : null;
    const explicitExtent = parseDimensionValue(
        axis === 'width' ? contentElement?.style.width : contentElement?.style.height,
    );

    if (explicitExtent !== null && explicitExtent > 0) {
        return explicitExtent;
    }

    const scrollExtent = axis === 'width'
        ? Math.max(surface.scrollWidth, contentElement?.scrollWidth ?? 0)
        : Math.max(surface.scrollHeight, contentElement?.scrollHeight ?? 0);

    return scrollExtent;
};

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

    const fittingPreset = [...normalizedPresets]
        .reverse()
        .find((presetZoom) => presetZoom <= (clampedTarget + 0.001));

    return fittingPreset ?? normalizedPresets[0];
};

export const useTripResizeControls = ({
    isMobile,
    layoutMode,
    mapDockMode,
    timelineMode,
    timelineView,
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
    onAutoFitZoomApplied,
    onManualViewSettingsChange,
    onPaneResize,
}: UseTripResizeControlsOptions) => {
    const verticalLayoutTimelineRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef<'sidebar' | 'details' | 'timeline-h' | null>(null);
    const detailsResizeStartXRef = useRef(0);
    const detailsResizeStartWidthRef = useRef(detailsWidth);
    const previousMapDockModeRef = useRef(mapDockMode);
    const previousTimelineModeRef = useRef(timelineMode);
    const previousTimelineViewRef = useRef(timelineView);
    const hasAutoFitRunRef = useRef(false);

    const clampSidebarWidth = useCallback((rawWidth: number, nextDetailsWidth = detailsWidth) => {
        if (typeof window === 'undefined') return Math.max(minSidebarWidth, rawWidth);
        if (isMobile) return Math.max(minSidebarWidth, rawWidth);
        if (layoutMode !== 'horizontal' || mapDockMode !== 'docked') {
            return Math.max(minSidebarWidth, rawWidth);
        }

        const reservedForDetails = detailsPanelVisible ? nextDetailsWidth : 0;
        const maxSidebar = window.innerWidth - reservedForDetails - minMapWidth - (resizerWidth * 2);
        const boundedMax = Math.max(minSidebarWidth, maxSidebar);
        return Math.max(minSidebarWidth, Math.min(boundedMax, rawWidth));
    }, [
        detailsPanelVisible,
        detailsWidth,
        isMobile,
        layoutMode,
        mapDockMode,
        minMapWidth,
        minSidebarWidth,
        resizerWidth,
    ]);

    const clampDetailsWidth = useCallback((rawWidth: number) => {
        if (typeof window === 'undefined') return Math.max(minDetailsWidth, rawWidth);
        if (isMobile) return Math.max(minDetailsWidth, rawWidth);

        if (layoutMode === 'horizontal') {
            const maxWidth = mapDockMode === 'docked'
                ? window.innerWidth - sidebarWidth - minMapWidth - (resizerWidth * 2)
                : window.innerWidth - minTimelineColumnWidth - resizerWidth;
            const boundedMax = Math.max(hardMinDetailsWidth, maxWidth);
            const boundedMin = Math.min(minDetailsWidth, boundedMax);
            return Math.max(boundedMin, Math.min(boundedMax, rawWidth));
        }

        const maxWidth = window.innerWidth - minTimelineColumnWidth - resizerWidth;
        const boundedMax = Math.max(hardMinDetailsWidth, maxWidth);
        const boundedMin = Math.min(minDetailsWidth, boundedMax);
        return Math.max(boundedMin, Math.min(boundedMax, rawWidth));
    }, [
        hardMinDetailsWidth,
        isMobile,
        layoutMode,
        mapDockMode,
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
        setSidebarWidth((previous) => clampSidebarWidth(previous));
    }, [clampSidebarWidth, setSidebarWidth]);

    useEffect(() => {
        const handleResize = () => {
            setSidebarWidth((previous) => clampSidebarWidth(previous));
            setDetailsWidth((previous) => clampDetailsWidth(previous));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [clampDetailsWidth, clampSidebarWidth, setDetailsWidth, setSidebarWidth]);

    const fitTimelineZoom = useCallback((mode?: 'horizontal' | 'vertical', options?: { force?: boolean }) => {
        const fitMode: 'horizontal' | 'vertical' = mode || (timelineView === 'vertical' ? 'vertical' : 'horizontal');
        if (!options?.force && isZoomDirty) return false;

        const timelineViewport = verticalLayoutTimelineRef.current;
        if (!timelineViewport) return false;
        const timelineSurface = resolveTimelineSurface(timelineViewport);

        let targetZoom: number | null = null;

        if (fitMode === 'horizontal') {
            const measuredWidth = timelineSurface.clientWidth || timelineViewport.clientWidth;
            if (measuredWidth <= 0) return false;
            const contentWidth = resolveTimelineContentExtent(timelineSurface, 'width');
            if (contentWidth <= 0) return false;
            const usableTimelineWidth = Math.max(MIN_AUTO_FIT_TIMELINE_WIDTH, measuredWidth - horizontalTimelineAutoFitPadding);
            targetZoom = zoomLevel * (usableTimelineWidth / contentWidth);
        } else {
            const measuredHeight = timelineSurface.clientHeight || timelineViewport.clientHeight;
            if (measuredHeight <= 0) return false;
            const contentHeight = resolveTimelineContentExtent(timelineSurface, 'height');
            if (contentHeight <= 0) return false;
            const usableTimelineHeight = Math.max(MIN_AUTO_FIT_TIMELINE_HEIGHT, measuredHeight - verticalTimelineAutoFitPadding);
            targetZoom = zoomLevel * (usableTimelineHeight / contentHeight);
        }

        const nextZoom = resolveAutoFitZoom(
            targetZoom,
            clampZoomLevel,
            zoomLevelPresets,
        );
        if (!Number.isFinite(nextZoom)) return false;

        if (Math.abs(zoomLevel - nextZoom) < 0.01) {
            return false;
        }
        if (!options?.force) {
            onAutoFitZoomApplied?.();
        }
        setZoomLevel((previous) => (Math.abs(previous - nextZoom) < 0.01 ? previous : nextZoom));
        return true;
    }, [
        clampZoomLevel,
        horizontalTimelineAutoFitPadding,
        isZoomDirty,
        onAutoFitZoomApplied,
        setZoomLevel,
        timelineView,
        verticalTimelineAutoFitPadding,
        zoomLevel,
        zoomLevelPresets,
    ]);

    useEffect(() => {
        const previousMapDockMode = previousMapDockModeRef.current;
        const previousTimelineMode = previousTimelineModeRef.current;
        const previousTimelineView = previousTimelineViewRef.current;
        const isFirstRenderAutoFit = !hasAutoFitRunRef.current;
        const didMapDockModeChange = previousMapDockMode !== mapDockMode;
        const didTimelineModeChange = previousTimelineMode !== timelineMode;
        const didTimelineViewChange = previousTimelineView !== timelineView;
        const shouldAttemptAutoFit = timelineMode === 'calendar'
            && !isZoomDirty
            && (
                isFirstRenderAutoFit
                || didMapDockModeChange
                || didTimelineModeChange
                || didTimelineViewChange
            );

        if (shouldAttemptAutoFit) {
            const fitMode: 'horizontal' | 'vertical' = timelineView === 'vertical' ? 'vertical' : 'horizontal';
            const runAutoFit = () => {
                if (!fitTimelineZoom(fitMode)) {
                    requestAnimationFrame(() => {
                        fitTimelineZoom(fitMode);
                    });
                }
            };
            requestAnimationFrame(runAutoFit);
        }

        previousMapDockModeRef.current = mapDockMode;
        previousTimelineModeRef.current = timelineMode;
        previousTimelineViewRef.current = timelineView;
        hasAutoFitRunRef.current = true;
    }, [fitTimelineZoom, isZoomDirty, mapDockMode, timelineMode, timelineView]);

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
            onManualViewSettingsChange?.();
            onPaneResize?.();
            setSidebarWidth(clampSidebarWidth(event.clientX));
            return;
        }

        if (isResizingRef.current === 'details') {
            onManualViewSettingsChange?.();
            onPaneResize?.();
            const deltaX = event.clientX - detailsResizeStartXRef.current;
            const nextWidth = layoutMode === 'horizontal' && mapDockMode === 'floating'
                ? detailsResizeStartWidthRef.current - deltaX
                : detailsResizeStartWidthRef.current + deltaX;
            setDetailsWidth(clampDetailsWidth(nextWidth));
            return;
        }

        onManualViewSettingsChange?.();
        onPaneResize?.();
        const maxTimelineHeight = window.innerHeight - minBottomMapHeight;
        setTimelineHeight(Math.max(minTimelineHeight, Math.min(maxTimelineHeight, window.innerHeight - event.clientY)));
    }, [
        clampDetailsWidth,
        clampSidebarWidth,
        minBottomMapHeight,
        minTimelineHeight,
        onManualViewSettingsChange,
        onPaneResize,
        setDetailsWidth,
        setSidebarWidth,
        setTimelineHeight,
    ]);

    const handleSidebarResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        onManualViewSettingsChange?.();
        onPaneResize?.();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setSidebarWidth((previous) =>
            clampSidebarWidth(previous + (direction * resizeKeyboardStep))
        );
    }, [
        clampSidebarWidth,
        onManualViewSettingsChange,
        onPaneResize,
        resizeKeyboardStep,
        setSidebarWidth,
    ]);

    const handleDetailsResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

        event.preventDefault();
        onManualViewSettingsChange?.();
        onPaneResize?.();
        const direction = layoutMode === 'horizontal' && mapDockMode === 'floating'
            ? (event.key === 'ArrowRight' ? -1 : 1)
            : (event.key === 'ArrowRight' ? 1 : -1);
        setDetailsWidth((previous) => clampDetailsWidth(previous + (direction * resizeKeyboardStep)));
    }, [clampDetailsWidth, layoutMode, mapDockMode, onManualViewSettingsChange, onPaneResize, resizeKeyboardStep, setDetailsWidth]);

    const handleTimelineResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

        event.preventDefault();
        onManualViewSettingsChange?.();
        onPaneResize?.();
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        const maxTimelineHeight = window.innerHeight - minBottomMapHeight;
        setTimelineHeight((previous) =>
            Math.max(minTimelineHeight, Math.min(maxTimelineHeight, previous + (direction * resizeKeyboardStep)))
        );
    }, [minBottomMapHeight, minTimelineHeight, onManualViewSettingsChange, onPaneResize, resizeKeyboardStep, setTimelineHeight]);

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
        fitTimelineZoom,
        clampSidebarWidth,
        clampDetailsWidth,
    };
};
