import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import type { IViewSettings } from '../../types';
import {
    MAX_ZOOM_LEVEL,
    MIN_ZOOM_LEVEL,
    RESIZER_WIDTH,
    TIMELINE_ZOOM_LEVEL_PRESETS,
} from './tripViewModel';
import type { ZoomChangeSource } from './viewChangeDiff';

interface UseTripLayoutSizingOptions {
    tripId: string;
    setZoomBehavior: Dispatch<SetStateAction<NonNullable<IViewSettings['zoomBehavior']>>>;
}

/**
 * Zoom bookkeeping and the view-settings persist refs that TripView's
 * timeline, history and view-settings sync share. The zoom and pane sizes
 * themselves stay in `useTripLayoutControlsState`.
 *
 * TripView calls this where the `trip.id` reset effect used to run, so effect
 * order is unchanged. The dependency arrays are the ones TripView used.
 */
export const useTripLayoutSizing = ({
    tripId,
    setZoomBehavior,
}: UseTripLayoutSizingOptions) => {
    const pendingManualViewSettingsPersistRef = useRef(false);
    const pendingManualVisualCommitRef = useRef(false);
    const paneLayoutCustomizedRef = useRef(false);
    const zoomChangeSourceRef = useRef<ZoomChangeSource>(null);
    const [isZoomDirty, setIsZoomDirty] = useState(false);
    const markManualViewChange = useCallback(() => {
        pendingManualViewSettingsPersistRef.current = true;
        pendingManualVisualCommitRef.current = true;
    }, []);
    const markZoomDirty = useCallback((source: ZoomChangeSource = 'manual') => {
        if (source) {
            zoomChangeSourceRef.current = source;
        }
        if (source === 'manual') {
            setZoomBehavior('manual');
            markManualViewChange();
            setIsZoomDirty(true);
        }
    }, [markManualViewChange, setZoomBehavior]);
    const markAutoFitZoomChange = useCallback(() => {
        zoomChangeSourceRef.current = 'auto';
        setZoomBehavior('fit');
    }, [setZoomBehavior]);
    useEffect(() => {
        setIsZoomDirty(false);
        zoomChangeSourceRef.current = null;
        pendingManualViewSettingsPersistRef.current = false;
        pendingManualVisualCommitRef.current = false;
    }, [tripId]);
    const clampZoomLevel = useCallback((value: number) => {
        if (!Number.isFinite(value)) return 1;
        return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, value));
    }, []);
    const resolveSteppedZoomLevel = useCallback((
        currentZoomLevel: number,
        direction: 'in' | 'out',
    ) => {
        const uniquePresets = new Set<number>();
        for (const value of TIMELINE_ZOOM_LEVEL_PRESETS) {
            uniquePresets.add(clampZoomLevel(value));
        }
        const normalizedPresets = Array.from(uniquePresets).sort((left, right) => left - right);

        if (direction === 'in') {
            return normalizedPresets.find((preset) => preset > (currentZoomLevel + 0.001))
                ?? normalizedPresets[normalizedPresets.length - 1]
                ?? clampZoomLevel(currentZoomLevel);
        }

        return [...normalizedPresets]
            .reverse()
            .find((preset) => preset < (currentZoomLevel - 0.001))
            ?? normalizedPresets[0]
            ?? clampZoomLevel(currentZoomLevel);
    }, [clampZoomLevel]);

    return {
        pendingManualViewSettingsPersistRef,
        pendingManualVisualCommitRef,
        paneLayoutCustomizedRef,
        zoomChangeSourceRef,
        isZoomDirty,
        markManualViewChange,
        markZoomDirty,
        markAutoFitZoomChange,
        clampZoomLevel,
        resolveSteppedZoomLevel,
    };
};

interface UseDockedPaneRebalanceOptions {
    isMobile: boolean;
    effectiveLayoutMode: 'vertical' | 'horizontal';
    effectiveMapDockMode: 'docked' | 'floating';
    detailsPanelVisible: boolean;
    paneLayoutCustomizedRef: MutableRefObject<boolean>;
    clampDetailsWidth: (rawWidth: number) => number;
    clampSidebarWidth: (rawWidth: number, nextDetailsWidth?: number) => number;
    setDetailsWidth: Dispatch<SetStateAction<number>>;
    setSidebarWidth: Dispatch<SetStateAction<number>>;
}

/**
 * Splits the window evenly between the docked panes until the traveller drags
 * a resizer. It needs the clamps from `useTripResizeControls`, so TripView
 * calls it right after that hook, where the layout effect used to sit.
 */
export const useDockedPaneRebalance = ({
    isMobile,
    effectiveLayoutMode,
    effectiveMapDockMode,
    detailsPanelVisible,
    paneLayoutCustomizedRef,
    clampDetailsWidth,
    clampSidebarWidth,
    setDetailsWidth,
    setSidebarWidth,
}: UseDockedPaneRebalanceOptions) => {
    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        if (isMobile) return;
        if (paneLayoutCustomizedRef.current) return;
        if (effectiveLayoutMode !== 'horizontal' || effectiveMapDockMode !== 'docked') return;

        const rebalanceDockedPaneWidths = () => {
            const availableWidth = window.innerWidth - (detailsPanelVisible ? RESIZER_WIDTH * 2 : RESIZER_WIDTH);
            const targetPaneWidth = Math.floor(availableWidth / (detailsPanelVisible ? 3 : 2));

            if (detailsPanelVisible) {
                const nextDetailsWidth = clampDetailsWidth(targetPaneWidth);
                const nextSidebarWidth = clampSidebarWidth(targetPaneWidth, nextDetailsWidth);
                setDetailsWidth(nextDetailsWidth);
                setSidebarWidth(nextSidebarWidth);
                return;
            }

            setSidebarWidth(clampSidebarWidth(targetPaneWidth, 0));
        };

        rebalanceDockedPaneWidths();
        window.addEventListener('resize', rebalanceDockedPaneWidths);
        return () => {
            window.removeEventListener('resize', rebalanceDockedPaneWidths);
        };
    // The ref is read, not tracked, exactly as in TripView's original effect.
    }, [
        clampDetailsWidth,
        clampSidebarWidth,
        detailsPanelVisible,
        effectiveLayoutMode,
        effectiveMapDockMode,
        isMobile,
        setDetailsWidth,
        setSidebarWidth,
    ]);
};
