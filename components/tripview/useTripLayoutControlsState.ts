import { useState } from 'react';

import { readLocalStorageItem } from '../../services/browserStorageService';
import type { IViewSettings, MapStyle, RouteMode } from '../../types';
import { normalizeViewSettingsForRuntime } from '../../shared/tripRuntimeNormalization';

interface UseTripLayoutControlsStateOptions {
    initialViewSettings?: IViewSettings;
    defaultDetailsWidth: number;
}

export const useTripLayoutControlsState = ({
    initialViewSettings,
    defaultDetailsWidth,
}: UseTripLayoutControlsStateOptions) => {
    const normalizedInitialViewSettings = normalizeViewSettingsForRuntime(initialViewSettings);
    const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
        if (normalizedInitialViewSettings?.mapStyle) return normalizedInitialViewSettings.mapStyle;
        if (typeof window !== 'undefined') return (readLocalStorageItem('tf_map_style') as MapStyle) || 'standard';
        return 'standard';
    });

    const [routeMode, setRouteMode] = useState<RouteMode>(() => {
        if (normalizedInitialViewSettings?.routeMode) return normalizedInitialViewSettings.routeMode;
        if (typeof window !== 'undefined') return (readLocalStorageItem('tf_route_mode') as RouteMode) || 'simple';
        return 'simple';
    });

    const [showCityNames, setShowCityNames] = useState<boolean>(() => {
        if (normalizedInitialViewSettings?.showCityNames !== undefined) return normalizedInitialViewSettings.showCityNames;
        if (typeof window !== 'undefined') {
            const stored = readLocalStorageItem('tf_city_names');
            if (stored !== null) return stored === 'true';
        }
        return true;
    });

    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>(() => {
        if (normalizedInitialViewSettings?.layoutMode) return normalizedInitialViewSettings.layoutMode;
        if (typeof window !== 'undefined') {
            return (readLocalStorageItem('tf_layout_mode') as 'vertical' | 'horizontal') || 'horizontal';
        }
        return 'horizontal';
    });

    const [timelineMode, setTimelineMode] = useState<'calendar' | 'timeline'>(() => {
        if (normalizedInitialViewSettings?.timelineMode) return normalizedInitialViewSettings.timelineMode;
        if (typeof window !== 'undefined') {
            const stored = readLocalStorageItem('tf_timeline_mode');
            if (stored === 'calendar' || stored === 'timeline') return stored;
        }
        return 'calendar';
    });

    const [timelineView, setTimelineView] = useState<'horizontal' | 'vertical'>(() => {
        if (normalizedInitialViewSettings?.timelineView) return normalizedInitialViewSettings.timelineView;
        if (typeof window !== 'undefined') {
            return (readLocalStorageItem('tf_timeline_view') as 'horizontal' | 'vertical') || 'horizontal';
        }
        return 'horizontal';
    });

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (typeof normalizedInitialViewSettings?.sidebarWidth === 'number') return normalizedInitialViewSettings.sidebarWidth;
        if (typeof window !== 'undefined') return parseInt(readLocalStorageItem('tf_sidebar_width') || '550', 10);
        return 550;
    });

    const [timelineHeight, setTimelineHeight] = useState(() => {
        if (typeof normalizedInitialViewSettings?.timelineHeight === 'number') return normalizedInitialViewSettings.timelineHeight;
        if (typeof window !== 'undefined') return parseInt(readLocalStorageItem('tf_timeline_height') || '400', 10);
        return 400;
    });

    const [detailsWidth, setDetailsWidth] = useState(() => {
        if (typeof normalizedInitialViewSettings?.detailsWidth === 'number' && Number.isFinite(normalizedInitialViewSettings.detailsWidth)) {
            return normalizedInitialViewSettings.detailsWidth;
        }
        if (typeof window !== 'undefined') {
            const stored = parseInt(readLocalStorageItem('tf_details_width') || `${defaultDetailsWidth}`, 10);
            if (Number.isFinite(stored)) return stored;
        }
        return defaultDetailsWidth;
    });

    const [zoomLevel, setZoomLevel] = useState(() => {
        if (typeof normalizedInitialViewSettings?.zoomLevel === 'number') return normalizedInitialViewSettings.zoomLevel;
        if (typeof window !== 'undefined') {
            const stored = parseFloat(readLocalStorageItem('tf_zoom_level') || '');
            if (Number.isFinite(stored)) return stored;
        }
        return 1.0;
    });

    const [zoomBehavior, setZoomBehavior] = useState<NonNullable<IViewSettings['zoomBehavior']>>(() => (
        normalizedInitialViewSettings?.zoomBehavior === 'manual' ? 'manual' : 'fit'
    ));

    return {
        layoutMode,
        setLayoutMode,
        timelineMode,
        setTimelineMode,
        timelineView,
        setTimelineView,
        mapStyle,
        setMapStyle,
        routeMode,
        setRouteMode,
        showCityNames,
        setShowCityNames,
        zoomLevel,
        setZoomLevel,
        zoomBehavior,
        setZoomBehavior,
        sidebarWidth,
        setSidebarWidth,
        timelineHeight,
        setTimelineHeight,
        detailsWidth,
        setDetailsWidth,
    };
};
