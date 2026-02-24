import { useState } from 'react';

import { readLocalStorageItem } from '../../services/browserStorageService';
import type { IViewSettings, MapStyle, RouteMode } from '../../types';

interface UseTripLayoutControlsStateOptions {
    initialViewSettings?: IViewSettings;
    defaultDetailsWidth: number;
}

export const useTripLayoutControlsState = ({
    initialViewSettings,
    defaultDetailsWidth,
}: UseTripLayoutControlsStateOptions) => {
    const [mapStyle, setMapStyle] = useState<MapStyle>(() => {
        if (initialViewSettings?.mapStyle) return initialViewSettings.mapStyle;
        if (typeof window !== 'undefined') return (readLocalStorageItem('tf_map_style') as MapStyle) || 'standard';
        return 'standard';
    });

    const [routeMode, setRouteMode] = useState<RouteMode>(() => {
        if (initialViewSettings?.routeMode) return initialViewSettings.routeMode;
        if (typeof window !== 'undefined') return (readLocalStorageItem('tf_route_mode') as RouteMode) || 'simple';
        return 'simple';
    });

    const [showCityNames, setShowCityNames] = useState<boolean>(() => {
        if (initialViewSettings?.showCityNames !== undefined) return initialViewSettings.showCityNames;
        if (typeof window !== 'undefined') {
            const stored = readLocalStorageItem('tf_city_names');
            if (stored !== null) return stored === 'true';
        }
        return true;
    });

    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>(() => {
        if (initialViewSettings) return initialViewSettings.layoutMode;
        if (typeof window !== 'undefined') {
            return (readLocalStorageItem('tf_layout_mode') as 'vertical' | 'horizontal') || 'horizontal';
        }
        return 'horizontal';
    });

    const [timelineView, setTimelineView] = useState<'horizontal' | 'vertical'>(() => {
        if (initialViewSettings) return initialViewSettings.timelineView;
        if (typeof window !== 'undefined') {
            return (readLocalStorageItem('tf_timeline_view') as 'horizontal' | 'vertical') || 'horizontal';
        }
        return 'horizontal';
    });

    const [sidebarWidth, setSidebarWidth] = useState(() => {
        if (initialViewSettings && initialViewSettings.sidebarWidth) return initialViewSettings.sidebarWidth;
        if (typeof window !== 'undefined') return parseInt(readLocalStorageItem('tf_sidebar_width') || '550', 10);
        return 550;
    });

    const [timelineHeight, setTimelineHeight] = useState(() => {
        if (initialViewSettings && initialViewSettings.timelineHeight) return initialViewSettings.timelineHeight;
        if (typeof window !== 'undefined') return parseInt(readLocalStorageItem('tf_timeline_height') || '400', 10);
        return 400;
    });

    const [detailsWidth, setDetailsWidth] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = parseInt(readLocalStorageItem('tf_details_width') || `${defaultDetailsWidth}`, 10);
            if (Number.isFinite(stored)) return stored;
        }
        return defaultDetailsWidth;
    });

    const [zoomLevel, setZoomLevel] = useState(() => {
        if (typeof initialViewSettings?.zoomLevel === 'number') return initialViewSettings.zoomLevel;
        if (typeof window !== 'undefined') {
            const stored = parseFloat(readLocalStorageItem('tf_zoom_level') || '');
            if (Number.isFinite(stored)) return stored;
        }
        return 1.0;
    });

    return {
        layoutMode,
        setLayoutMode,
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
        sidebarWidth,
        setSidebarWidth,
        timelineHeight,
        setTimelineHeight,
        detailsWidth,
        setDetailsWidth,
    };
};
