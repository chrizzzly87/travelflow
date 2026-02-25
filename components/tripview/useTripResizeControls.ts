import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { writeLocalStorageItem } from '../../services/browserStorageService';

interface UseTripResizeControlsOptions {
    layoutMode: 'vertical' | 'horizontal';
    timelineView: 'horizontal' | 'vertical';
    horizontalTimelineDayCount: number;
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
    basePixelsPerDay: number;
}

export const useTripResizeControls = ({
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
    basePixelsPerDay,
}: UseTripResizeControlsOptions) => {
    const verticalLayoutTimelineRef = useRef<HTMLDivElement | null>(null);
    const isResizingRef = useRef<'sidebar' | 'details' | 'timeline-h' | null>(null);
    const detailsResizeStartXRef = useRef(0);
    const detailsResizeStartWidthRef = useRef(detailsWidth);
    const previousLayoutModeRef = useRef(layoutMode);

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

    const autoFitHorizontalTimelineForVerticalLayout = useCallback(() => {
        if (layoutMode !== 'vertical' || timelineView !== 'horizontal') return false;

        const measuredWidth = verticalLayoutTimelineRef.current?.clientWidth ?? 0;
        if (measuredWidth <= 0) return false;

        const usableTimelineWidth = Math.max(160, measuredWidth - horizontalTimelineAutoFitPadding);
        const targetPixelsPerDay = usableTimelineWidth / horizontalTimelineDayCount;
        const targetZoom = clampZoomLevel(targetPixelsPerDay / basePixelsPerDay);
        if (!Number.isFinite(targetZoom)) return false;

        setZoomLevel((previous) => (Math.abs(previous - targetZoom) < 0.01 ? previous : targetZoom));
        return true;
    }, [
        basePixelsPerDay,
        clampZoomLevel,
        horizontalTimelineAutoFitPadding,
        horizontalTimelineDayCount,
        layoutMode,
        setZoomLevel,
        timelineView,
    ]);

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
    }, [autoFitHorizontalTimelineForVerticalLayout, layoutMode, timelineView]);

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
