import { isFiniteLatLngLiteral } from '../../shared/coordinateUtils';
import type { MapImplementation } from '../../shared/mapRuntime';
import { getTripMapProviderTuning } from './tripMapProviderTuning';

/**
 * Marker sizes per render tier, the tier maths that picks one from the
 * viewport, zoom and marker crowding, and marker stacking order.
 *
 * The profiles are module-level singletons on purpose: `ItineraryMap`
 * memoises the effective profile and its identity feeds the marker rebuild
 * effect, so a profile must never be recreated per call. Moved verbatim
 * from `ItineraryMap.tsx`.
 */

export const MARKER_TIER_ROUTE_REFERENCE_ZOOM = 10;
export const MARKER_GAP_DEDUPE_PRECISION = 6;

export const CITY_MARKER_Z_INDEX = 320;
export const CITY_MARKER_SELECTED_Z_INDEX = 340;
export const ACTIVITY_MARKER_Z_INDEX = 240;
/** Below planned activities: an idea never covers something already on the plan. */
export const IDEA_MARKER_Z_INDEX = 230;
export const ACTIVITY_MARKER_SELECTED_Z_INDEX = 260;

export const resolveCityMarkerZIndex = (
    isSelected: boolean,
    profile: MarkerRenderProfile,
): number => {
    const base = isSelected ? CITY_MARKER_SELECTED_Z_INDEX : CITY_MARKER_Z_INDEX;
    const size = isSelected ? profile.city.selectedSize : profile.city.size;
    return base + Math.max(0, Math.round(size / 2));
};

export type MarkerRenderProfile = {
    city: {
        shape: 'pin' | 'circle';
        size: number;
        selectedSize: number;
        fontSize: number;
        selectedFontSize: number;
        showInnerDot: boolean;
        numberColor: string;
    };
    activity: {
        size: number;
        selectedBoost: number;
        iconSize: number;
        tooltipFontSize: number;
        tooltipPaddingX: number;
        tooltipPaddingY: number;
    };
    transport: {
        show: boolean;
        size: number;
        iconScale: number;
    };
    routeStrokeScale: number;
};

export type MarkerRenderTier = 'default' | 'compact' | 'micro';
export type CityMarkerRenderProfile = MarkerRenderProfile['city'];

export const DOCKED_DEFAULT_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
    city: {
        shape: 'pin',
        size: 44,
        selectedSize: 54,
        fontSize: 12,
        selectedFontSize: 13,
        showInnerDot: true,
        numberColor: '#0f172a',
    },
    activity: {
        size: 34,
        selectedBoost: 4,
        iconSize: 15,
        tooltipFontSize: 11,
        tooltipPaddingX: 10,
        tooltipPaddingY: 6,
    },
    transport: {
        show: true,
        size: 40,
        iconScale: 0.46,
    },
    routeStrokeScale: 1,
};

export const FLOATING_DEFAULT_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
    city: {
        shape: 'circle',
        size: 30,
        selectedSize: 34,
        fontSize: 11,
        selectedFontSize: 12,
        showInnerDot: true,
        numberColor: '#0f172a',
    },
    activity: {
        size: 28,
        selectedBoost: 3,
        iconSize: 12,
        tooltipFontSize: 10,
        tooltipPaddingX: 8,
        tooltipPaddingY: 5,
    },
    transport: {
        show: true,
        size: 30,
        iconScale: 0.42,
    },
    routeStrokeScale: 0.9,
};

export const COMPACT_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
    city: {
        shape: 'circle',
        size: 22,
        selectedSize: 26,
        fontSize: 10,
        selectedFontSize: 10,
        showInnerDot: true,
        numberColor: '#0f172a',
    },
    activity: {
        size: 20,
        selectedBoost: 2,
        iconSize: 9,
        tooltipFontSize: 9,
        tooltipPaddingX: 7,
        tooltipPaddingY: 4,
    },
    transport: {
        show: true,
        size: 24,
        iconScale: 0.36,
    },
    routeStrokeScale: 0.82,
};

export const MICRO_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
    city: {
        shape: 'circle',
        size: 18,
        selectedSize: 21,
        fontSize: 9,
        selectedFontSize: 9,
        showInnerDot: false,
        numberColor: '#ffffff',
    },
    activity: {
        size: 16,
        selectedBoost: 2,
        iconSize: 8,
        tooltipFontSize: 9,
        tooltipPaddingX: 6,
        tooltipPaddingY: 3,
    },
    transport: {
        show: false,
        size: 26,
        iconScale: 0.34,
    },
    routeStrokeScale: 0.64,
};

export const resolveMarkerRenderProfile = (
    options?: {
        mapDockMode?: 'docked' | 'floating';
        markerTier?: MarkerRenderTier;
    },
): MarkerRenderProfile => {
    const mapDockMode = options?.mapDockMode;
    const markerTier = options?.markerTier ?? 'default';
    if (markerTier === 'micro') return MICRO_MARKER_RENDER_PROFILE;
    if (markerTier === 'compact') return COMPACT_MARKER_RENDER_PROFILE;
    return mapDockMode === 'floating'
        ? FLOATING_DEFAULT_MARKER_RENDER_PROFILE
        : DOCKED_DEFAULT_MARKER_RENDER_PROFILE;
};

export const toWebMercatorPixel = (
    coordinates: google.maps.LatLngLiteral,
    zoom: number,
): { x: number; y: number } => {
    const scale = 256 * (2 ** zoom);
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, coordinates.lat));
    const latRad = (clampedLat * Math.PI) / 180;
    const x = ((coordinates.lng + 180) / 360) * scale;
    const y = (0.5 - (Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI))) * scale;
    return { x, y };
};

export const estimateRoutePixelSpan = (
    coordinates: google.maps.LatLngLiteral[],
    zoom: number | null,
): number => {
    if (!Number.isFinite(zoom)) return 0;
    if (coordinates.length < 2) return 0;
    const projected = coordinates.map((coordinate) => toWebMercatorPixel(coordinate, Number(zoom)));
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    return Math.hypot(width, height);
};

export const estimateNearestMarkerGapPx = (
    coordinates: google.maps.LatLngLiteral[],
    zoom: number | null,
): number => {
    if (!Number.isFinite(zoom)) return Number.POSITIVE_INFINITY;
    const finiteCoordinates = coordinates.filter(isFiniteLatLngLiteral);
    if (finiteCoordinates.length < 2) return Number.POSITIVE_INFINITY;

    const uniqueCoordinates: google.maps.LatLngLiteral[] = [];
    const seenCoordinateKeys = new Set<string>();
    finiteCoordinates.forEach((coordinate) => {
        const key = `${coordinate.lat.toFixed(MARKER_GAP_DEDUPE_PRECISION)},${coordinate.lng.toFixed(MARKER_GAP_DEDUPE_PRECISION)}`;
        if (seenCoordinateKeys.has(key)) return;
        seenCoordinateKeys.add(key);
        uniqueCoordinates.push(coordinate);
    });

    if (uniqueCoordinates.length < 2) return Number.POSITIVE_INFINITY;
    const projected = uniqueCoordinates.map((coordinate) => toWebMercatorPixel(coordinate, Number(zoom)));
    let minDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < projected.length; i += 1) {
        for (let j = i + 1; j < projected.length; j += 1) {
            const distance = Math.hypot(projected[i].x - projected[j].x, projected[i].y - projected[j].y);
            if (distance < minDistance) {
                minDistance = distance;
            }
            if (minDistance <= 10) return minDistance;
        }
    }
    return minDistance;
};

export const resolveMarkerRenderTier = ({
    provider = 'google',
    viewportWidth,
    viewportHeight,
    zoom,
    routePixelSpan,
    nearestMarkerGapPx,
}: {
    provider?: MapImplementation;
    viewportWidth: number;
    viewportHeight: number;
    zoom: number | null;
    routePixelSpan: number;
    nearestMarkerGapPx: number;
}): MarkerRenderTier => {
    const tuning = getTripMapProviderTuning(provider);
    const markerTierTuning = tuning.markers.tier;
    const shortEdge = Math.min(viewportWidth, viewportHeight);
    if (!Number.isFinite(shortEdge) || shortEdge <= 0) return 'default';
    const effectiveZoom = Number.isFinite(zoom) ? Number(zoom) : 11;
    const zoomNormalizedRouteSpan = Number.isFinite(routePixelSpan)
        ? routePixelSpan / (2 ** (effectiveZoom - MARKER_TIER_ROUTE_REFERENCE_ZOOM))
        : 0;
    const routeCoverage = shortEdge > 0 ? zoomNormalizedRouteSpan / shortEdge : 0;
    const veryDenseRoute = Number.isFinite(routeCoverage) && routeCoverage > markerTierTuning.denseRouteCoverage;
    const extremeDenseRoute = Number.isFinite(routeCoverage) && routeCoverage > markerTierTuning.extremeDenseRouteCoverage;
    const lowZoom = effectiveZoom <= markerTierTuning.lowZoom;
    const veryLowZoom = effectiveZoom <= markerTierTuning.veryLowZoom;

    if (shortEdge <= markerTierTuning.microShortEdge) return 'micro';
    if (veryLowZoom && shortEdge <= markerTierTuning.microVeryLowZoomMaxShortEdge) return 'micro';
    if (shortEdge <= markerTierTuning.microVeryLowZoomMaxShortEdge && extremeDenseRoute) return 'micro';
    if (shortEdge <= markerTierTuning.compactVeryLowZoomDenseMaxShortEdge && veryLowZoom && veryDenseRoute) return 'micro';

    if (shortEdge <= markerTierTuning.compactShortEdge) return 'compact';
    if (lowZoom) return 'compact';
    if (shortEdge <= markerTierTuning.compactDenseMaxShortEdge && veryDenseRoute && effectiveZoom <= markerTierTuning.compactDenseZoomCutoff) return 'compact';
    return 'default';
};

export const resolveZoomEnhancedCityMarkerProfile = ({
    provider = 'google',
    baseProfile,
    markerTier,
    zoom,
}: {
    provider?: MapImplementation;
    baseProfile: CityMarkerRenderProfile;
    markerTier: MarkerRenderTier;
    zoom: number | null;
}): CityMarkerRenderProfile => {
    const tuning = getTripMapProviderTuning(provider);
    const cityZoomTuning = tuning.markers.cityZoomProfile;
    if (markerTier !== 'default') return baseProfile;
    if (!Number.isFinite(zoom)) return baseProfile;
    const effectiveZoom = Number(zoom);
    if (effectiveZoom < cityZoomTuning.farCircleMaxZoom) {
        return {
            ...baseProfile,
            shape: 'circle',
            size: Math.max(16, Math.round(baseProfile.size * 0.64)),
            selectedSize: Math.max(20, Math.round(baseProfile.selectedSize * 0.68)),
            fontSize: Math.max(9, baseProfile.fontSize - 2),
            selectedFontSize: Math.max(10, baseProfile.selectedFontSize - 2),
            showInnerDot: false,
            numberColor: '#ffffff',
        };
    }
    if (effectiveZoom < cityZoomTuning.mediumCircleMaxZoom) {
        return {
            ...baseProfile,
            shape: 'circle',
            size: Math.max(20, Math.round(baseProfile.size * 0.8)),
            selectedSize: Math.max(24, Math.round(baseProfile.selectedSize * 0.82)),
            fontSize: Math.max(10, baseProfile.fontSize - 1),
            selectedFontSize: Math.max(11, baseProfile.selectedFontSize - 1),
            showInnerDot: false,
        };
    }
    if (effectiveZoom < cityZoomTuning.nearCircleMaxZoom) {
        return {
            ...baseProfile,
            shape: 'circle',
            size: Math.max(22, Math.round(baseProfile.size * 0.9)),
            selectedSize: Math.max(26, Math.round(baseProfile.selectedSize * 0.92)),
        };
    }
    if (effectiveZoom < cityZoomTuning.compactPinMaxZoom) {
        return {
            ...baseProfile,
            shape: 'pin',
            size: Math.max(24, Math.round(baseProfile.size * 0.96)),
            selectedSize: Math.max(28, Math.round(baseProfile.selectedSize * 0.98)),
            fontSize: Math.max(11, baseProfile.fontSize),
            selectedFontSize: Math.max(12, baseProfile.selectedFontSize),
        };
    }

    const scaleBand = cityZoomTuning.scaleBands.find((entry) => effectiveZoom >= entry.minZoom);
    const scale = scaleBand?.scale ?? 1.03;

    return {
        ...baseProfile,
        shape: 'pin',
        size: Math.round(baseProfile.size * scale),
        selectedSize: Math.round(baseProfile.selectedSize * scale),
        fontSize: Math.min(baseProfile.fontSize + 1, 15),
        selectedFontSize: Math.min(baseProfile.selectedFontSize + 1, 16),
    };
};

export const resolveCrowdedCityMarkerProfile = ({
    provider = 'google',
    baseProfile,
    markerTier,
    zoom,
    nearestMarkerGapPx,
}: {
    provider?: MapImplementation;
    baseProfile: CityMarkerRenderProfile;
    markerTier: MarkerRenderTier;
    zoom: number | null;
    nearestMarkerGapPx: number;
}): CityMarkerRenderProfile => {
    const tuning = getTripMapProviderTuning(provider);
    const crowdingTuning = tuning.markers.crowding;
    if (markerTier === 'micro') return baseProfile;
    if (!Number.isFinite(nearestMarkerGapPx)) return baseProfile;
    if (Number.isFinite(zoom) && Number(zoom) >= crowdingTuning.disableCrowdingAtZoom) return baseProfile;

    const veryCrowded = nearestMarkerGapPx < crowdingTuning.veryCrowdedGapPx;
    const crowded = nearestMarkerGapPx < crowdingTuning.crowdedGapPx;
    if (!crowded) return baseProfile;

    const scale = veryCrowded ? 0.8 : 0.9;
    const compactSize = Math.max(17, Math.round(baseProfile.size * scale));
    const compactSelectedSize = Math.max(compactSize + 2, Math.round(baseProfile.selectedSize * scale));
    const compactFontSize = Math.max(8, baseProfile.fontSize - 1);
    const compactSelectedFontSize = Math.max(compactFontSize, baseProfile.selectedFontSize - 1);

    return {
        ...baseProfile,
        shape: 'circle',
        size: compactSize,
        selectedSize: compactSelectedSize,
        fontSize: compactFontSize,
        selectedFontSize: compactSelectedFontSize,
        showInnerDot: veryCrowded ? false : baseProfile.showInnerDot,
        numberColor: veryCrowded ? '#ffffff' : baseProfile.numberColor,
    };
};
