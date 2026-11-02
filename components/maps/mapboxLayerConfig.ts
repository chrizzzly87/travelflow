import type { MapStyle } from '../../types';
import type { MapImplementation } from '../../shared/mapRuntime';
import { buildMapboxDashedRouteDasharray, type MapboxLineLayerConfig } from './mapboxOverlayRuntime';
import { resolveTripMapDarkRoutePresentation } from './tripMapProviderPresentation';

/**
 * Route line styling: the Google polyline outline/main triple and the
 * Mapbox line layers derived from it. Moved verbatim from `ItineraryMap.tsx`.
 */

export const ROUTE_OUTER_OUTLINE_COLOR = '#f8fafc';
export const ROUTE_MINIMAL_GAP_COLOR = '#f5f5f5';
export const ROUTE_CLEAN_GAP_COLOR = '#ffffff';
export const ROUTE_STANDARD_GAP_COLOR = '#eef2f7';
export const ROUTE_DARK_GAP_COLOR = '#1b2230';
export const ROUTE_CLEAN_DARK_GAP_COLOR = '#1b2230';

export const getRouteOutlineColor = (_style: MapStyle = 'standard'): string => {
    if (_style === 'minimal') return ROUTE_MINIMAL_GAP_COLOR;
    if (_style === 'clean') return ROUTE_CLEAN_GAP_COLOR;
    if (_style === 'standard') return ROUTE_STANDARD_GAP_COLOR;
    if (_style === 'dark') return ROUTE_DARK_GAP_COLOR;
    if (_style === 'cleanDark') return ROUTE_CLEAN_DARK_GAP_COLOR;
    return '#0f172a';
};

export const getRouteOuterOutlineColor = (_style: MapStyle = 'standard'): string => {
    return ROUTE_OUTER_OUTLINE_COLOR;
};

export const isDarkMapStyle = (style: MapStyle): boolean =>
    style === 'dark' || style === 'cleanDark';

export const buildRoutePolylinePairOptions = (
    options: google.maps.PolylineOptions,
    style: MapStyle = 'standard',
): {
    outerOutlineOptions: google.maps.PolylineOptions;
    outlineOptions: google.maps.PolylineOptions;
    mainOptions: google.maps.PolylineOptions;
} => {
    const baseWeight = options.strokeWeight ?? 3;
    const baseOpacity = options.strokeOpacity ?? 0.7;
    const baseZIndex = options.zIndex ?? 30;
    const mainStrokeWeight = baseWeight + 1;
    const innerOutlineColor = getRouteOutlineColor(style);
    const isDarkFamilyStyle = isDarkMapStyle(style);
    const isIconOnlyRoute = baseOpacity <= 0 && (options.icons?.length ?? 0) > 0;
    const outerOutlineColor = isDarkFamilyStyle
        ? (options.strokeColor ?? getRouteOuterOutlineColor(style))
        : getRouteOuterOutlineColor(style);
    const shouldApplyDarkRouteBorders = isDarkFamilyStyle;
    const shouldApplyDarkOuterRouteBorder = shouldApplyDarkRouteBorders && !isIconOnlyRoute;

    const outerOutlineOptions: google.maps.PolylineOptions = {
        ...options,
        strokeColor: outerOutlineColor,
        strokeOpacity: shouldApplyDarkOuterRouteBorder ? 0.5 : 0,
        strokeWeight: shouldApplyDarkOuterRouteBorder ? mainStrokeWeight + 5 : mainStrokeWeight,
        icons: undefined,
        zIndex: baseZIndex - 2,
    };

    const outlineOptions: google.maps.PolylineOptions = {
        ...options,
        strokeColor: innerOutlineColor,
        strokeOpacity: shouldApplyDarkRouteBorders ? 1 : 0,
        strokeWeight: shouldApplyDarkRouteBorders ? mainStrokeWeight + 3 : mainStrokeWeight,
        icons: undefined,
        zIndex: baseZIndex - 1,
    };

    const mainOptions: google.maps.PolylineOptions = {
        ...options,
        strokeOpacity: baseOpacity,
        strokeWeight: mainStrokeWeight,
        zIndex: baseZIndex,
    };

    return { outerOutlineOptions, outlineOptions, mainOptions };
};

export const buildMapboxRouteLayerConfigs = ({
    routeId,
    options,
    style,
    provider = 'mapbox',
}: {
    routeId: string;
    options: google.maps.PolylineOptions;
    style: MapStyle;
    provider?: MapImplementation;
}): MapboxLineLayerConfig[] => {
    const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions(options, style);
    const isDarkStyle = isDarkMapStyle(style);
    const toLayerConfig = (
        suffix: 'outer' | 'outline' | 'main',
        layerOptions: google.maps.PolylineOptions,
    ): MapboxLineLayerConfig | null => {
        const dasharray = buildMapboxDashedRouteDasharray(
            (layerOptions.icons as Array<{ repeat?: string }> | undefined),
        );
        const resolvedOpacity = (layerOptions.strokeOpacity ?? 0) > 0
            ? Number(layerOptions.strokeOpacity)
            : (dasharray ? 0.92 : 0);
        if (resolvedOpacity <= 0) return null;
        return {
            id: `${routeId}-${suffix}`,
            color: String(layerOptions.strokeColor ?? '#0f172a'),
            opacity: resolvedOpacity,
            width: Number(layerOptions.strokeWeight ?? 1),
            dasharray,
        };
    };

    if (isDarkStyle) {
        const mainLayer = toLayerConfig('main', mainOptions);
        if (!mainLayer) return [];
        const darkRoutePresentation = resolveTripMapDarkRoutePresentation(provider, style);
        const darkRouteLayers: MapboxLineLayerConfig[] = [];
        darkRouteLayers.push({
            id: `${routeId}-shadow`,
            color: darkRoutePresentation.shadowColor,
            opacity: darkRoutePresentation.shadowOpacity,
            width: Math.max(1.5, mainLayer.width + darkRoutePresentation.shadowWidthBoost),
            emissiveStrength: darkRoutePresentation.shadowEmissiveStrength,
        });
        if (!mainLayer.dasharray) {
            darkRouteLayers.push({
                id: `${routeId}-glow`,
                color: mainLayer.color,
                opacity: darkRoutePresentation.glowOpacity,
                width: Math.max(1.3, mainLayer.width + darkRoutePresentation.glowWidthBoost),
                emissiveStrength: darkRoutePresentation.glowEmissiveStrength,
            });
        }
        darkRouteLayers.push({
            ...mainLayer,
            opacity: Math.max(mainLayer.opacity, darkRoutePresentation.mainOpacity),
            emissiveStrength: darkRoutePresentation.mainEmissiveStrength,
        });
        return darkRouteLayers;
    }

    return [
        toLayerConfig('outer', outerOutlineOptions),
        toLayerConfig('outline', outlineOptions),
        toLayerConfig('main', mainOptions),
    ].filter((layer): layer is MapboxLineLayerConfig => Boolean(layer));
};
