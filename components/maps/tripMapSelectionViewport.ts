import type { ITimelineItem } from '../../types';
import type { MapImplementation } from '../../shared/mapRuntime';
import { getTripMapProviderTuning, resolveTripMapViewportPadding } from './tripMapProviderTuning';

/**
 * Selection focus, viewport readiness and activity-marker visibility rules
 * for the itinerary map. Moved verbatim from `ItineraryMap.tsx`.
 */

export const MAP_VIEWPORT_READY_MIN_DIMENSION_PX = 80;

export const ACTIVITY_MARKERS_MIN_ZOOM = getTripMapProviderTuning('google').markers.activityMinZoom;

export const resolveSelectedMapFocusPosition = ({
    provider = 'google',
    selectedActivityId,
    selectedCityId,
    activityMarkerPositions,
    cities,
}: {
    provider?: MapImplementation;
    selectedActivityId?: string | null;
    selectedCityId?: string | null;
    activityMarkerPositions: Map<string, google.maps.LatLngLiteral>;
    cities: ITimelineItem[];
}): { position: google.maps.LatLngLiteral; zoom: number; kind: 'activity' | 'city' } | null => {
    const selectionTuning = getTripMapProviderTuning(provider).selection;
    if (selectedActivityId) {
        const activityPosition = activityMarkerPositions.get(selectedActivityId);
        if (activityPosition) {
            return { position: activityPosition, zoom: selectionTuning.activityFocusZoom, kind: 'activity' };
        }
    }
    if (selectedCityId) {
        const selectedCity = cities.find((item) => item.id === selectedCityId);
        if (selectedCity?.coordinates) {
            return {
                position: { lat: selectedCity.coordinates.lat, lng: selectedCity.coordinates.lng },
                zoom: selectionTuning.cityFocusZoom,
                kind: 'city',
            };
        }
    }
    return null;
};

export const shouldSkipRouteFitForSelection = ({
    respectSelection,
    selectionVersionAtSchedule,
    currentSelectionVersion,
    selectedItemId,
    selectedActivityId,
    selectedCityId,
}: {
    respectSelection: boolean;
    selectionVersionAtSchedule: number;
    currentSelectionVersion: number;
    selectedItemId?: string | null;
    selectedActivityId?: string | null;
    selectedCityId?: string | null;
}): boolean => {
    if (!respectSelection) return false;
    if (selectionVersionAtSchedule !== currentSelectionVersion) return true;
    return Boolean(selectedItemId || selectedActivityId || selectedCityId);
};

export const resolveSelectionViewportActions = ({
    isTargetVisible,
    isTargetWithinSafeZone,
    currentZoom,
    targetZoom,
    alwaysCenter = false,
}: {
    isTargetVisible: boolean;
    isTargetWithinSafeZone?: boolean;
    currentZoom: number | null;
    targetZoom: number;
    // Activity pins are small and easy to lose among the city markers, so
    // selecting one always recenters the map instead of leaving an
    // already-visible pin wherever it happens to sit.
    alwaysCenter?: boolean;
}): { shouldPan: boolean; shouldZoom: boolean } => {
    const isTargetComfortablyVisible = isTargetWithinSafeZone ?? isTargetVisible;
    const shouldZoom = currentZoom === null || currentZoom < targetZoom;
    const shouldPan = alwaysCenter || !isTargetComfortablyVisible || shouldZoom;
    return { shouldPan, shouldZoom };
};

export const resolveMapViewportPadding = ({
    provider = 'google',
    mapDockMode,
    mapViewportSize,
}: {
    provider?: MapImplementation;
    mapDockMode: 'docked' | 'floating';
    mapViewportSize: { width: number; height: number } | null;
}): google.maps.Padding => {
    return resolveTripMapViewportPadding({
        provider,
        mapDockMode,
        mapViewportSize,
    });
};

export const isCoordinateWithinSafeBounds = ({
    bounds,
    point,
    insetRatio = 0.22,
}: {
    bounds: google.maps.LatLngBounds;
    point: google.maps.LatLngLiteral;
    insetRatio?: number;
}): boolean => {
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const latSpan = northEast.lat() - southWest.lat();
    const lngSpan = northEast.lng() - southWest.lng();
    if (!Number.isFinite(latSpan) || !Number.isFinite(lngSpan)) return false;
    if (latSpan <= 0 || lngSpan <= 0) return false;

    const clampedInsetRatio = Math.max(0, Math.min(0.45, insetRatio));
    const latInset = latSpan * clampedInsetRatio;
    const lngInset = lngSpan * clampedInsetRatio;

    return point.lat >= southWest.lat() + latInset
        && point.lat <= northEast.lat() - latInset
        && point.lng >= southWest.lng() + lngInset
        && point.lng <= northEast.lng() - lngInset;
};

export const shouldDisplayActivityMarkers = ({
    provider = 'google',
    isEnabled,
    zoom,
}: {
    provider?: MapImplementation;
    isEnabled: boolean;
    zoom: number | null | undefined;
}): boolean => {
    if (!isEnabled) return false;
    if (!Number.isFinite(zoom)) return false;
    return Number(zoom) >= getTripMapProviderTuning(provider).markers.activityMinZoom;
};

export const isMapViewportReady = (rect: { width: number; height: number } | null | undefined): boolean => {
    if (!rect) return false;
    return rect.width >= MAP_VIEWPORT_READY_MIN_DIMENSION_PX && rect.height >= MAP_VIEWPORT_READY_MIN_DIMENSION_PX;
};
