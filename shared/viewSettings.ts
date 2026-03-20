import type { IViewSettings } from '../types';
import { normalizeViewSettingsForRuntime } from './tripRuntimeNormalization';

export const areViewSettingsEqual = (
    a?: IViewSettings,
    b?: IViewSettings,
): boolean => {
    if (!a && !b) return true;
    if (!a || !b) return false;

    return (
        a.layoutMode === b.layoutMode
        && a.timelineMode === b.timelineMode
        && a.timelineView === b.timelineView
        && a.mapDockMode === b.mapDockMode
        && a.mapStyle === b.mapStyle
        && a.routeMode === b.routeMode
        && a.showCityNames === b.showCityNames
        && a.zoomLevel === b.zoomLevel
        && a.zoomBehavior === b.zoomBehavior
        && a.sidebarWidth === b.sidebarWidth
        && a.detailsWidth === b.detailsWidth
        && a.timelineHeight === b.timelineHeight
    );
};

export const getNormalizedViewSettingsKey = (
    view?: IViewSettings | Partial<IViewSettings> | null,
): string | null => {
    const normalizedView = normalizeViewSettingsForRuntime(view);
    if (!normalizedView) return null;

    return JSON.stringify({
        layoutMode: normalizedView.layoutMode,
        timelineMode: normalizedView.timelineMode,
        timelineView: normalizedView.timelineView,
        mapDockMode: normalizedView.mapDockMode,
        mapStyle: normalizedView.mapStyle,
        routeMode: normalizedView.routeMode,
        showCityNames: normalizedView.showCityNames,
        zoomLevel: normalizedView.zoomLevel,
        zoomBehavior: normalizedView.zoomBehavior,
        sidebarWidth: normalizedView.sidebarWidth,
        detailsWidth: normalizedView.detailsWidth,
        timelineHeight: normalizedView.timelineHeight,
    });
};
