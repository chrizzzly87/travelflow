import { readLocalStorageItem } from './browserStorageService';
import type { IViewSettings } from '../types';
import { normalizeViewSettingsForRuntime } from '../shared/tripRuntimeNormalization';
import { toOptionalFiniteNumber } from '../shared/numberUtils';

const isLayoutModeValue = (value: unknown): value is IViewSettings['layoutMode'] => (
    value === 'vertical' || value === 'horizontal'
);

const isTimelineModeValue = (value: unknown): value is NonNullable<IViewSettings['timelineMode']> => (
    value === 'calendar' || value === 'timeline'
);

const isTimelineViewValue = (value: unknown): value is IViewSettings['timelineView'] => (
    value === 'vertical' || value === 'horizontal'
);

const isMapStyleValue = (value: unknown): value is IViewSettings['mapStyle'] => (
    value === 'minimal'
    || value === 'standard'
    || value === 'dark'
    || value === 'satellite'
    || value === 'clean'
    || value === 'cleanDark'
);

const isRouteModeValue = (value: unknown): value is NonNullable<IViewSettings['routeMode']> => (
    value === 'simple' || value === 'realistic'
);

const readPersistedBoolean = (key: string): boolean | undefined => {
    const stored = readLocalStorageItem(key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return undefined;
};

const readPersistedFiniteNumber = (key: string): number | undefined => {
    const stored = readLocalStorageItem(key);
    if (stored === null) return undefined;
    return toOptionalFiniteNumber(stored);
};

/**
 * The map style an administrator set as the app-wide default. A style the
 * visitor picked themselves always wins; this only decides where they start.
 */
let runtimeDefaultMapStyle: IViewSettings['mapStyle'] | null = null;

export const setRuntimeDefaultMapStyle = (mapStyle: IViewSettings['mapStyle']): void => {
    runtimeDefaultMapStyle = isMapStyleValue(mapStyle) ? mapStyle : null;
};

export const getRuntimeDefaultMapStyle = (): IViewSettings['mapStyle'] | null => runtimeDefaultMapStyle;

export const readPersistedTripViewSettings = (): Partial<IViewSettings> | undefined => {
    if (typeof window === 'undefined') return undefined;

    const partial: Partial<IViewSettings> = {};
    const persistedMapStyle = readLocalStorageItem('tf_map_style');
    const persistedRouteMode = readLocalStorageItem('tf_route_mode');
    const persistedLayoutMode = readLocalStorageItem('tf_layout_mode');
    const persistedTimelineMode = readLocalStorageItem('tf_timeline_mode');
    const persistedTimelineView = readLocalStorageItem('tf_timeline_view');

    if (isMapStyleValue(persistedMapStyle)) partial.mapStyle = persistedMapStyle;
    else if (runtimeDefaultMapStyle) partial.mapStyle = runtimeDefaultMapStyle;
    if (isRouteModeValue(persistedRouteMode)) partial.routeMode = persistedRouteMode;
    if (isLayoutModeValue(persistedLayoutMode)) partial.layoutMode = persistedLayoutMode;
    if (isTimelineModeValue(persistedTimelineMode)) partial.timelineMode = persistedTimelineMode;
    if (isTimelineViewValue(persistedTimelineView)) partial.timelineView = persistedTimelineView;

    const persistedShowCityNames = readPersistedBoolean('tf_city_names');
    if (typeof persistedShowCityNames === 'boolean') partial.showCityNames = persistedShowCityNames;

    const zoomLevel = readPersistedFiniteNumber('tf_zoom_level');
    if (typeof zoomLevel === 'number') partial.zoomLevel = zoomLevel;

    const sidebarWidth = readPersistedFiniteNumber('tf_sidebar_width');
    if (typeof sidebarWidth === 'number') partial.sidebarWidth = sidebarWidth;

    const detailsWidth = readPersistedFiniteNumber('tf_details_width');
    if (typeof detailsWidth === 'number') partial.detailsWidth = detailsWidth;

    const timelineHeight = readPersistedFiniteNumber('tf_timeline_height');
    if (typeof timelineHeight === 'number') partial.timelineHeight = timelineHeight;

    return Object.keys(partial).length > 0 ? partial : undefined;
};

export const resolveTripInitialViewSettings = ({
    preferredView,
    fallbackView,
    allowPersistedOverrides = false,
}: {
    preferredView?: IViewSettings;
    fallbackView?: IViewSettings;
    allowPersistedOverrides?: boolean;
}): IViewSettings | undefined => {
    const normalizedPreferredView = normalizeViewSettingsForRuntime(preferredView);
    const normalizedFallbackView = normalizeViewSettingsForRuntime(fallbackView);
    const baseView = normalizedPreferredView ?? normalizedFallbackView;
    if (!allowPersistedOverrides) return baseView;

    const persistedView = readPersistedTripViewSettings();
    if (!persistedView) return baseView;
    return normalizeViewSettingsForRuntime({
        ...(baseView ?? {}),
        ...persistedView,
    });
};
