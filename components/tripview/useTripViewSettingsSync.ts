import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { writeLocalStorageItem } from '../../services/browserStorageService';
import type { IViewSettings, MapStyle, RouteMode } from '../../types';
import { applyViewSettingsToSearchParams } from '../../utils';
import { roundFiniteNumber, toFiniteNumber } from '../../shared/numberUtils';
import { normalizeViewSettingsForRuntime } from '../../shared/tripRuntimeNormalization';
import { getNormalizedViewSettingsKey } from '../../shared/viewSettings';

interface UseTripViewSettingsSyncOptions {
    layoutMode: 'vertical' | 'horizontal';
    timelineMode: 'calendar' | 'timeline';
    timelineView: 'horizontal' | 'vertical';
    mapDockMode: 'docked' | 'floating';
    mapStyle: MapStyle;
    routeMode: RouteMode;
    showCityNames: boolean;
    zoomLevel: number;
    zoomBehavior: NonNullable<IViewSettings['zoomBehavior']>;
    sidebarWidth: number;
    detailsWidth: number;
    timelineHeight: number;
    viewMode: 'planner' | 'print';
    onViewSettingsChange?: (settings: IViewSettings) => void;
    initialViewSettings?: IViewSettings;
    currentViewSettings: IViewSettings;
    setMapStyle: Dispatch<SetStateAction<MapStyle>>;
    setRouteMode: Dispatch<SetStateAction<RouteMode>>;
    setLayoutMode: Dispatch<SetStateAction<'vertical' | 'horizontal'>>;
    setTimelineMode: Dispatch<SetStateAction<'calendar' | 'timeline'>>;
    setTimelineView: Dispatch<SetStateAction<'horizontal' | 'vertical'>>;
    setMapDockMode: Dispatch<SetStateAction<'docked' | 'floating'>>;
    setZoomLevel: Dispatch<SetStateAction<number>>;
    setZoomBehavior: Dispatch<SetStateAction<NonNullable<IViewSettings['zoomBehavior']>>>;
    setSidebarWidth: Dispatch<SetStateAction<number>>;
    setDetailsWidth: Dispatch<SetStateAction<number>>;
    setTimelineHeight: Dispatch<SetStateAction<number>>;
    setShowCityNames: Dispatch<SetStateAction<boolean>>;
    suppressCommitRef: MutableRefObject<boolean>;
    pendingManualViewSettingsPersistRef: MutableRefObject<boolean>;
    skipViewDiffRef: MutableRefObject<boolean>;
    appliedViewKeyRef: MutableRefObject<string | null>;
    prevViewRef: MutableRefObject<IViewSettings | null>;
}

const normalizeSettingsForCallback = (settings: IViewSettings): IViewSettings => ({
    ...settings,
    showCityNames: Boolean(settings.showCityNames),
    zoomLevel: roundFiniteNumber(settings.zoomLevel, 2, 1),
    zoomBehavior: settings.zoomBehavior === 'manual' ? 'manual' : 'fit',
    sidebarWidth: Math.round(toFiniteNumber(settings.sidebarWidth, 560)),
    detailsWidth: Math.round(toFiniteNumber(settings.detailsWidth, 440)),
    timelineHeight: Math.round(toFiniteNumber(settings.timelineHeight, 340)),
});

export const useTripViewSettingsSync = ({
    layoutMode,
    timelineMode,
    timelineView,
    mapDockMode,
    mapStyle,
    routeMode,
    showCityNames,
    zoomLevel,
    zoomBehavior,
    sidebarWidth,
    detailsWidth,
    timelineHeight,
    viewMode,
    onViewSettingsChange,
    initialViewSettings,
    currentViewSettings,
    setMapStyle,
    setRouteMode,
    setLayoutMode,
    setTimelineMode,
    setTimelineView,
    setMapDockMode,
    setZoomLevel,
    setZoomBehavior,
    setSidebarWidth,
    setDetailsWidth,
    setTimelineHeight,
    setShowCityNames,
    suppressCommitRef,
    pendingManualViewSettingsPersistRef,
    skipViewDiffRef,
    appliedViewKeyRef,
    prevViewRef,
}: UseTripViewSettingsSyncOptions) => {
    const lastEmittedSettingsKeyRef = useRef<string | null>(null);

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
        writeLocalStorageItem('tf_timeline_mode', timelineMode);
    }, [timelineMode]);

    useEffect(() => {
        writeLocalStorageItem('tf_timeline_view', timelineView);
    }, [timelineView]);

    useEffect(() => {
        writeLocalStorageItem('tf_city_names', String(showCityNames));
    }, [showCityNames]);

    useEffect(() => {
        writeLocalStorageItem('tf_zoom_level', roundFiniteNumber(zoomLevel, 2, 1).toFixed(2));
    }, [zoomLevel]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const rawSettings: IViewSettings = {
                layoutMode,
                timelineMode,
                timelineView,
                mapDockMode,
                mapStyle,
                routeMode,
                showCityNames,
                zoomLevel,
                zoomBehavior,
                sidebarWidth,
                detailsWidth,
                timelineHeight,
            };
            const settings = normalizeSettingsForCallback(rawSettings);
            const settingsKey = JSON.stringify(settings);

            if (onViewSettingsChange) {
                if (!pendingManualViewSettingsPersistRef.current) return;
                pendingManualViewSettingsPersistRef.current = false;
                if (lastEmittedSettingsKeyRef.current === settingsKey) return;
                lastEmittedSettingsKeyRef.current = settingsKey;
                onViewSettingsChange(settings);
                return;
            }

            const url = new URL(window.location.href);
            applyViewSettingsToSearchParams(url.searchParams, settings);
            if (viewMode === 'print') url.searchParams.set('mode', 'print');
            else url.searchParams.delete('mode');
            window.history.replaceState({}, '', url.toString());
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [
        layoutMode,
        timelineMode,
        mapDockMode,
        zoomLevel,
        zoomBehavior,
        viewMode,
        mapStyle,
        routeMode,
        timelineView,
        sidebarWidth,
        detailsWidth,
        timelineHeight,
        showCityNames,
        onViewSettingsChange,
    ]);

    useEffect(() => {
        const normalizedInitialViewSettings = normalizeViewSettingsForRuntime(initialViewSettings);
        if (!normalizedInitialViewSettings) return;

        const key = getNormalizedViewSettingsKey(normalizedInitialViewSettings);
        const currentKey = getNormalizedViewSettingsKey(currentViewSettings);
        if (!key || !currentKey) return;
        if (pendingManualViewSettingsPersistRef.current && key !== currentKey) {
            return;
        }
        if (key === currentKey) {
            appliedViewKeyRef.current = key;
            return;
        }
        if (appliedViewKeyRef.current === key) return;

        appliedViewKeyRef.current = key;
        suppressCommitRef.current = true;
        skipViewDiffRef.current = true;

        if (normalizedInitialViewSettings.mapStyle) setMapStyle(normalizedInitialViewSettings.mapStyle);
        if (normalizedInitialViewSettings.routeMode) setRouteMode(normalizedInitialViewSettings.routeMode);
        if (normalizedInitialViewSettings.layoutMode) setLayoutMode(normalizedInitialViewSettings.layoutMode);
        if (normalizedInitialViewSettings.timelineMode) setTimelineMode(normalizedInitialViewSettings.timelineMode);
        if (normalizedInitialViewSettings.timelineView) setTimelineView(normalizedInitialViewSettings.timelineView);
        if (normalizedInitialViewSettings.mapDockMode) setMapDockMode(normalizedInitialViewSettings.mapDockMode);
        if (typeof normalizedInitialViewSettings.zoomLevel === 'number') setZoomLevel(normalizedInitialViewSettings.zoomLevel);
        setZoomBehavior(normalizedInitialViewSettings.zoomBehavior === 'manual' ? 'manual' : 'fit');
        if (typeof normalizedInitialViewSettings.sidebarWidth === 'number') setSidebarWidth(normalizedInitialViewSettings.sidebarWidth);
        if (typeof normalizedInitialViewSettings.detailsWidth === 'number') setDetailsWidth(normalizedInitialViewSettings.detailsWidth);
        if (typeof normalizedInitialViewSettings.timelineHeight === 'number') setTimelineHeight(normalizedInitialViewSettings.timelineHeight);
        setShowCityNames(normalizedInitialViewSettings.showCityNames ?? true);

        prevViewRef.current = normalizedInitialViewSettings;
    }, [
        initialViewSettings,
        currentViewSettings,
        setMapStyle,
        setRouteMode,
        setLayoutMode,
        setTimelineMode,
        setTimelineView,
        setMapDockMode,
        setZoomLevel,
        setZoomBehavior,
        setSidebarWidth,
        setDetailsWidth,
        setTimelineHeight,
        setShowCityNames,
        suppressCommitRef,
        skipViewDiffRef,
        appliedViewKeyRef,
        prevViewRef,
    ]);
};
