import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { writeLocalStorageItem } from '../../services/browserStorageService';
import type { IViewSettings, MapStyle, RouteMode, TripCompanionSection } from '../../types';
import { normalizeTripWorkspacePage } from '../../shared/tripWorkspace';
import { applyViewSettingsToSearchParams } from '../../utils';

interface UseTripViewSettingsSyncOptions {
    layoutMode: 'vertical' | 'horizontal';
    timelineMode: 'calendar' | 'timeline';
    timelineView: 'horizontal' | 'vertical';
    activeCompanionSection: TripCompanionSection;
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
    setActiveCompanionSection: Dispatch<SetStateAction<TripCompanionSection>>;
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

const toFiniteNumber = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSettingsForCallback = (settings: IViewSettings): IViewSettings => ({
    ...settings,
    showCityNames: Boolean(settings.showCityNames),
    zoomLevel: Number(toFiniteNumber(settings.zoomLevel, 1).toFixed(2)),
    zoomBehavior: settings.zoomBehavior === 'manual' ? 'manual' : 'fit',
    sidebarWidth: Math.round(toFiniteNumber(settings.sidebarWidth, 560)),
    detailsWidth: Math.round(toFiniteNumber(settings.detailsWidth, 440)),
    timelineHeight: Math.round(toFiniteNumber(settings.timelineHeight, 340)),
});

export const useTripViewSettingsSync = ({
    layoutMode,
    timelineMode,
    timelineView,
    activeCompanionSection,
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
    setActiveCompanionSection,
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
        writeLocalStorageItem('tf_zoom_level', zoomLevel.toFixed(2));
    }, [zoomLevel]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const rawSettings: IViewSettings = {
                layoutMode,
                timelineMode,
                timelineView,
                activeCompanionSection,
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
        activeCompanionSection,
        sidebarWidth,
        detailsWidth,
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
        if (initialViewSettings.timelineMode) setTimelineMode(initialViewSettings.timelineMode);
        if (initialViewSettings.timelineView) setTimelineView(initialViewSettings.timelineView);
        const initialWorkspacePage = normalizeTripWorkspacePage(initialViewSettings.activeCompanionSection);
        if (initialWorkspacePage) setActiveCompanionSection(initialWorkspacePage);
        if (initialViewSettings.mapDockMode) setMapDockMode(initialViewSettings.mapDockMode);
        if (typeof initialViewSettings.zoomLevel === 'number') setZoomLevel(initialViewSettings.zoomLevel);
        setZoomBehavior(initialViewSettings.zoomBehavior === 'manual' ? 'manual' : 'fit');
        if (typeof initialViewSettings.sidebarWidth === 'number') setSidebarWidth(initialViewSettings.sidebarWidth);
        if (typeof initialViewSettings.detailsWidth === 'number') setDetailsWidth(initialViewSettings.detailsWidth);
        if (typeof initialViewSettings.timelineHeight === 'number') setTimelineHeight(initialViewSettings.timelineHeight);
        setShowCityNames(initialViewSettings.showCityNames ?? true);

        prevViewRef.current = initialViewSettings;
    }, [
        initialViewSettings,
        currentViewSettings,
        setMapStyle,
        setRouteMode,
        setLayoutMode,
        setTimelineMode,
        setTimelineView,
        setActiveCompanionSection,
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
