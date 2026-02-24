import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { writeLocalStorageItem } from '../../services/browserStorageService';
import type { IViewSettings, MapStyle, RouteMode } from '../../types';
import { applyViewSettingsToSearchParams } from '../../utils';

interface UseTripViewSettingsSyncOptions {
    layoutMode: 'vertical' | 'horizontal';
    timelineView: 'horizontal' | 'vertical';
    mapStyle: MapStyle;
    routeMode: RouteMode;
    showCityNames: boolean;
    zoomLevel: number;
    sidebarWidth: number;
    timelineHeight: number;
    viewMode: 'planner' | 'print';
    onViewSettingsChange?: (settings: IViewSettings) => void;
    initialViewSettings?: IViewSettings;
    currentViewSettings: IViewSettings;
    setMapStyle: Dispatch<SetStateAction<MapStyle>>;
    setRouteMode: Dispatch<SetStateAction<RouteMode>>;
    setLayoutMode: Dispatch<SetStateAction<'vertical' | 'horizontal'>>;
    setTimelineView: Dispatch<SetStateAction<'horizontal' | 'vertical'>>;
    setZoomLevel: Dispatch<SetStateAction<number>>;
    setSidebarWidth: Dispatch<SetStateAction<number>>;
    setTimelineHeight: Dispatch<SetStateAction<number>>;
    setShowCityNames: Dispatch<SetStateAction<boolean>>;
    suppressCommitRef: MutableRefObject<boolean>;
    skipViewDiffRef: MutableRefObject<boolean>;
    appliedViewKeyRef: MutableRefObject<string | null>;
    prevViewRef: MutableRefObject<IViewSettings | null>;
}

export const useTripViewSettingsSync = ({
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
}: UseTripViewSettingsSyncOptions) => {
    useEffect(() => {
        writeLocalStorageItem('tf_map_style', mapStyle);
    }, [mapStyle]);

    useEffect(() => {
        writeLocalStorageItem('tf_route_mode', routeMode);
    }, [routeMode]);

    useEffect(() => {
        writeLocalStorageItem('tf_layout_mode', layoutMode);
    }, [layoutMode]);

    useEffect(() => {
        writeLocalStorageItem('tf_timeline_view', timelineView);
    }, [timelineView]);

    useEffect(() => {
        writeLocalStorageItem('tf_city_names', String(showCityNames));
    }, [showCityNames]);

    useEffect(() => {
        writeLocalStorageItem('tf_zoom_level', zoomLevel.toFixed(2));
    }, [zoomLevel]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const settings: IViewSettings = {
                layoutMode,
                timelineView,
                mapStyle,
                routeMode,
                showCityNames,
                zoomLevel,
                sidebarWidth,
                timelineHeight,
            };

            if (onViewSettingsChange) {
                onViewSettingsChange(settings);
            }

            if (!onViewSettingsChange) {
                const url = new URL(window.location.href);
                applyViewSettingsToSearchParams(url.searchParams, settings);
                if (viewMode === 'print') url.searchParams.set('mode', 'print');
                else url.searchParams.delete('mode');
                window.history.replaceState({}, '', url.toString());
            }
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [
        layoutMode,
        zoomLevel,
        viewMode,
        mapStyle,
        routeMode,
        timelineView,
        sidebarWidth,
        timelineHeight,
        showCityNames,
        onViewSettingsChange,
    ]);

    useEffect(() => {
        if (!initialViewSettings) return;

        const key = JSON.stringify(initialViewSettings);
        const currentKey = JSON.stringify(currentViewSettings);
        if (key === currentKey) {
            appliedViewKeyRef.current = key;
            return;
        }
        if (appliedViewKeyRef.current === key) return;

        appliedViewKeyRef.current = key;
        suppressCommitRef.current = true;
        skipViewDiffRef.current = true;

        if (initialViewSettings.mapStyle) setMapStyle(initialViewSettings.mapStyle);
        if (initialViewSettings.routeMode) setRouteMode(initialViewSettings.routeMode);
        if (initialViewSettings.layoutMode) setLayoutMode(initialViewSettings.layoutMode);
        if (initialViewSettings.timelineView) setTimelineView(initialViewSettings.timelineView);
        if (typeof initialViewSettings.zoomLevel === 'number') setZoomLevel(initialViewSettings.zoomLevel);
        if (typeof initialViewSettings.sidebarWidth === 'number') setSidebarWidth(initialViewSettings.sidebarWidth);
        if (typeof initialViewSettings.timelineHeight === 'number') setTimelineHeight(initialViewSettings.timelineHeight);
        setShowCityNames(initialViewSettings.showCityNames ?? true);

        prevViewRef.current = initialViewSettings;
    }, [
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
    ]);
};
