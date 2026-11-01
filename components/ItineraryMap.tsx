import React, { useCallback, useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { buildDayTripMarkerHtml, buildTripMapDayTripDescriptors, collectDayTripMarkerIds, isDayTripRoundTrip } from './maps/tripMapDayTripModel';
import { Button } from './ui/button';
import type mapboxgl from 'mapbox-gl';
import {
    ActivityType,
    ITimelineItem,
    MapBaseSurface,
    MapColorMode,
    MapColorTheme,
    MapLightPreset,
    MapStyle,
    RouteFailureReason,
    RouteMode,
    RouteStatus,
} from '../types';
import { ArrowLeftRight, ArrowUpDown, Focus, Layers, Lightbulb, Locate, LocateFixed, LocateOff, Maximize2, Minimize2, Route, Tag, TagsIcon } from 'lucide-react';
import { MapPinArea } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { buildRouteCacheKey, DEFAULT_MAP_COLOR_MODE, findTravelBetweenCities, getHexFromColorClass, pickPrimaryActivityType } from '../utils';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { enableUserLocation } from '../services/userLocationService';
import { useTripUserLocation } from '../hooks/useTripUserLocation';
import {
    USER_LOCATION_MARKER_Z_INDEX,
    USER_LOCATION_RECENTER_MIN_ZOOM,
    buildUserLocationMarkerHtml,
    createGoogleUserLocationOverlay,
} from './maps/userLocationMarker';
import { useGoogleMaps, useMapRuntime } from './GoogleMapsLoader';
import { normalizeTransportMode } from '../shared/transportModes';
import { ActivityMapPopup } from './maps/ActivityMapPopup';
import { IdeaMapPopup, type IdeaMapAction } from './maps/IdeaMapPopup';
import { useMapMarkerAnchor } from './maps/useMapMarkerAnchor';
import {
    getMapSurfaceBackgroundColor,
    GOOGLE_BASEMAP_HIDDEN_STYLES,
    type MapboxBasemapDetailOverrides,
} from '../services/mapRendererVisualStyleService';
import { MapboxBasemapSync } from './maps/MapboxBasemapSync';
import { isMapboxStyleReadyForRuntimeMutations } from './maps/mapboxBasemapUtils';
import { buildFlightRouteVisualPaths } from './maps/flightRouteGeometry';
import { collectTripMapFitBoundsCoordinates } from './maps/tripMapFitBoundsGeometry';
import { createGoogleTripMapCamera, createMapboxTripMapCamera, type TripMapCamera } from './maps/tripMapCamera';
import { createGoogleMixedSurfaceController, type GoogleMixedSurfaceController } from './maps/googleMixedSurfaceController';
import { buildTripMapCityMarkerHtml } from './maps/tripMapCityMarkerHtml';
import { MARKER_HOVER_Z_INDEX, MARKER_TOOLTIP_HIDDEN_TRANSFORM, MARKER_TOOLTIP_SHOWN_TRANSFORM } from './maps/markerTooltip';
import { buildMapIdeaSignature, type MapIdeaMarker } from '../shared/tripIdeas';
import { resolveTripMapCityMarkerImageUrl } from './maps/tripMapCityMarkerMedia';
import {
    buildTripMapCityLabelOverlayDescriptors,
    buildTripMapCityOverlayDescriptors,
} from './maps/tripMapCityOverlayModel';
import {
    buildTripMapCityLabelHtml,
    resolveTripMapCityLabelPlacement,
    resolveTripMapCityLabelTheme,
} from './maps/tripMapCityLabelHtml';
import {
    resolveTripMapProjectedCityLabelLayouts,
    type TripMapProjectedCityLabelLayout,
} from './maps/tripMapCityLabelLayout';
import { createMapboxLineHandle, createMapboxOverlayMarker, type RuntimeMarkerHandle } from './maps/mapboxOverlayRuntime';
import {
    resolveTripMapCityLabelOffsetPx,
    resolveTripMapFlightCurveOptions,
    resolveTripMapFlightGroundShadowStyle,
    type TripMapCityLabelAnchor,
} from './maps/tripMapProviderPresentation';
import { resolveActiveOverlayMapTarget, shouldHideGoogleMapCanvas } from './maps/mapRenderTarget';
import {
    getTripMapProviderTuning,
    resolveTripMapSelectionSafeInsetRatio,
} from './maps/tripMapProviderTuning';
import { computeGoogleRouteLeg, loadGoogleRouteRuntime } from '../services/routeService';
import { isFiniteLatLngLiteral } from '../shared/coordinateUtils';
import {
    clampCityFocusZoom,
    resolveCityFocusCamera,
} from './maps/tripMapCityFraming';
import { MAP_STYLES } from './maps/googleMapStyles';
import { ROUTE_CACHE, ROUTE_FAILURE_TTL_MS, hydrateRouteCache, persistRouteCache, shouldLogRouteFailureWarning } from './maps/routeCache';
import { buildRouteAttemptPolicy, classifyRouteComputationError, mapRouteAttemptPolicyReasonToFailureReason } from './maps/routeAttemptPolicy';
import { estimateGreatCircleDistanceKm, isRoutePathLikelyStraight } from './maps/routePathGeometry';
import {
    ACTIVITY_MARKER_SELECTED_Z_INDEX,
    ACTIVITY_MARKER_Z_INDEX,
    IDEA_MARKER_Z_INDEX,
    estimateNearestMarkerGapPx,
    estimateRoutePixelSpan,
    resolveCityMarkerZIndex,
    resolveCrowdedCityMarkerProfile,
    resolveMarkerRenderProfile,
    resolveMarkerRenderTier,
    resolveZoomEnhancedCityMarkerProfile,
} from './maps/markerRenderProfiles';
import {
    CITY_PIN_SELECTED_OUTLINE_FALLBACK,
    CITY_PIN_SELECTED_RING_FALLBACK,
    buildActivityMarkerHtml,
    buildIdeaMarkerHtml,
    buildTransportMarkerHtml,
    resolveCssColorVar,
} from './maps/markerHtml';
import { buildMapboxRouteLayerConfigs, buildRoutePolylinePairOptions } from './maps/mapboxLayerConfig';
import { resolveActivityMarkerPositions } from './maps/tripMapActivityMarkerPositions';
import {
    isCoordinateWithinSafeBounds,
    isMapViewportReady,
    resolveMapViewportPadding,
    resolveSelectedMapFocusPosition,
    resolveSelectionViewportActions,
    shouldDisplayActivityMarkers,
    shouldSkipRouteFitForSelection,
} from './maps/tripMapSelectionViewport';

interface ItineraryMapProps {
    items: ITimelineItem[];
    selectedItemId?: string | null;
    onCityMarkerSelect?: (cityId: string) => void;
    onActivityMarkerSelect?: (activityId: string) => void;
    /** Off on small screens, where the details sheet already covers the map. */
    enableActivityPopup?: boolean;
    layoutMode?: 'horizontal' | 'vertical';
    onLayoutChange?: (mode: 'horizontal' | 'vertical') => void;
    showLayoutControls?: boolean;
    activeStyle?: MapStyle;
    onStyleChange?: (style: MapStyle) => void;
    routeMode?: RouteMode;
    onRouteModeChange?: (mode: RouteMode) => void;
    showCityNames?: boolean;
    onShowCityNamesChange?: (enabled: boolean) => void;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    mapDockMode?: 'docked' | 'floating';
    onMapDockModeToggle?: () => void;
    focusLocationQuery?: string;
    fitToRouteKey?: string;
    onRouteMetrics?: (travelItemId: string, metrics: { routeDistanceKm?: number; routeDurationHours?: number; mode?: string; routeKey?: string }) => void;
    onRouteStatus?: (travelItemId: string, status: RouteStatus, meta?: { mode?: string; routeKey?: string; reason?: RouteFailureReason }) => void;
    mapColorMode?: MapColorMode;
    onMapColorModeChange?: (mode: MapColorMode) => void;
    isPaywalled?: boolean;
    viewTransitionName?: string;
    /**
     * Frame a selected city on its own plan and drop the rest of the journey
     * while it is selected. Off restores the previous constant-zoom behaviour.
     */
    cityFocusMode?: boolean;
    /** Lets go of the current selection, restoring the whole-journey view. */
    onClearSelection?: () => void;
    /** Opens the customize sheet. Absent hides the control entirely. */
    onOpenCustomize?: () => void;
    isCustomizeOpen?: boolean;
    /**
     * Controlled by the customize sheet when given. Left uncontrolled the map
     * keeps its own toggle, which is what the standalone print preview uses.
     */
    showActivityMarkers?: boolean;
    onShowActivityMarkersChange?: (enabled: boolean) => void;
    /**
     * The trip's saved ideas that have a position. The layer and its toggle
     * only exist when this is non-empty and `onShowIdeaMarkersChange` is given.
     */
    ideaMarkers?: MapIdeaMarker[];
    showIdeaMarkers?: boolean;
    onShowIdeaMarkersChange?: (enabled: boolean) => void;
    /** Save, undo a save, or skip from the pin's card. */
    onIdeaAction?: (ideaId: string, action: IdeaMapAction) => void;
    /** Save and Skip need an editable trip; the card still opens without. */
    canEditIdeas?: boolean;
    /** What the customize sheet turned on or off on top of the chosen style. */
    basemapDetail?: MapboxBasemapDetailOverrides;
    /**
     * The look as its three axes. Mapbox takes these directly; `activeStyle`
     * stays the nearest named style, which is all Google can render.
     */
    mapLookAxes?: {
        base: MapBaseSurface;
        colorTheme: MapColorTheme;
        lightPreset: Exclude<MapLightPreset, 'auto'>;
    };
    /**
     * Which day of the trip today is, as an offset from its start. Null when
     * the trip is not running, which is what switches past-day fading off.
     */
    todayDayOffset?: number | null;
    /** What the trip itself draws on top of the basemap. */
    tripOverlay?: {
        dimPastDays?: boolean;
        showRouteArrows?: boolean;
        dashedRoutes?: boolean;
        showTraffic?: boolean;
        showTransitLines?: boolean;
    };
    /** Globe instead of the tuning's resting projection. Mapbox only. */
    useGlobeProjection?: boolean;
    showTerrain?: boolean;
    /** Camera tilt in degrees. Mapbox only; Google ignores it. */
    mapPitch?: number;
    /** Multiplier on the route stroke, so a busy map can be thinned out. */
    routeLineWeight?: number;
    /** Localised by the owner: this component has no translation context. */
    customizeLabel?: string;
    /**
     * Offer the traveller's own position. Still only shown while the trip is
     * running or the visitor appears to be in one of its countries.
     */
    showUserLocation?: boolean;
    /** Trip id for analytics on the location control. */
    analyticsTripId?: string;
}

type OverlayMarkerUpdate = {
    html?: string;
    position?: google.maps.LatLngLiteral;
    zIndex?: number;
};

type OverlayMarkerHandle = {
    setMap: (map: unknown | null) => void;
    update: (updates: OverlayMarkerUpdate) => void;
};

const EMPTY_IDEA_MARKERS: MapIdeaMarker[] = [];

type CityLabelAnchor = TripMapCityLabelAnchor;
const resolveCityLabelPlacement = resolveTripMapCityLabelPlacement;
const resolveCityLabelTheme = resolveTripMapCityLabelTheme;

interface ItineraryMapInstanceBridgeProps {
    mapId: string;
    onMapInstanceChange: (map: google.maps.Map | null) => void;
}

/** Google's own arrow symbol. Only call it on the Google branch: it reads `window.google`. */
const buildGoogleRouteArrowIcon = (color: string, routeScale: number): google.maps.Symbol => ({
    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: 0.1,
    scale: 3.2 * Math.max(0.72, routeScale),
});

const ItineraryMapInstanceBridge: React.FC<ItineraryMapInstanceBridgeProps> = ({ mapId, onMapInstanceChange }) => {
    const map = useMap(mapId);

    useEffect(() => {
        onMapInstanceChange(map);
    }, [map, onMapInstanceChange]);

    useEffect(() => (
        () => {
            onMapInstanceChange(null);
        }
    ), [onMapInstanceChange]);

    return null;
};

export const ItineraryMap: React.FC<ItineraryMapProps> = ({ 
    items, 
    selectedItemId, 
    onCityMarkerSelect,
    onActivityMarkerSelect,
    enableActivityPopup = false,
    layoutMode, 
    onLayoutChange, 
    showLayoutControls = true,
    cityFocusMode = true,
    onClearSelection,
    onOpenCustomize,
    isCustomizeOpen = false,
    customizeLabel: customizeLabelProp,
    showActivityMarkers,
    onShowActivityMarkersChange,
    ideaMarkers = EMPTY_IDEA_MARKERS,
    showIdeaMarkers = false,
    onShowIdeaMarkersChange,
    onIdeaAction,
    canEditIdeas = false,
    basemapDetail,
    mapLookAxes,
    tripOverlay,
    todayDayOffset = null,
    useGlobeProjection = false,
    showTerrain = false,
    mapPitch = 0,
    routeLineWeight = 1,
    activeStyle = 'standard',
    onStyleChange,
    routeMode = 'simple',
    onRouteModeChange,
    showCityNames = true,
    onShowCityNamesChange,
    isExpanded = false,
    onToggleExpanded,
    mapDockMode = 'docked',
    onMapDockModeToggle,
    focusLocationQuery,
    fitToRouteKey,
    onRouteMetrics,
    onRouteStatus,
    mapColorMode = DEFAULT_MAP_COLOR_MODE,
    onMapColorModeChange,
    isPaywalled = false,
    viewTransitionName,
    showUserLocation = false,
    analyticsTripId,
}) => {
    const { t } = useTranslation('common');
    const customizeLabel = customizeLabelProp ?? t('tripView.mapCustomize.open');
    const mapInstanceIdRef = useRef(`tf-itinerary-map-${Math.random().toString(36).slice(2, 10)}`);
    const mapInstanceId = mapInstanceIdRef.current;
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const googleMapRef = useRef<any>(null); // google.maps.Map
    const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
    const mapboxModuleRef = useRef<typeof import('mapbox-gl').default | null>(null);
    const markersRef = useRef<OverlayMarkerHandle[]>([]);
    const cityMarkerMetaRef = useRef<Array<{ id: string; color: string; imageUrl: string | null; index: number; marker: OverlayMarkerHandle }>>([]);
    const activityMarkerMetaRef = useRef<Array<{ id: string; title: string; type: ActivityType; marker: OverlayMarkerHandle; isVisible: boolean }>>([]);
    const activityMarkerPositionByIdRef = useRef<Map<string, google.maps.LatLngLiteral>>(new Map());
    const routesRef = useRef<any[]>([]); // stored polylines/renderers
    const transportMarkerMetaRef = useRef<Array<{ mode?: string; color?: string; rotationDegrees?: number; marker: OverlayMarkerHandle }>>([]);
    const cityLabelOverlaysRef = useRef<any[]>([]);
    const lastFocusQueryRef = useRef<string | null>(null);
    const lastFitToRouteKeyRef = useRef<string | null>(null);
    const fitRafRef = useRef<number | null>(null);
    const resizeAutoFitTimerRef = useRef<number | null>(null);
    const dockModeRefitTimerRef = useRef<number | null>(null);
    const hasAutoFitCompletedRef = useRef(false);
    const scheduleFitWhenViewportReadyRef = useRef<(maxAttempts?: number, options?: { respectSelection?: boolean }) => void>(() => {});
    const onRouteMetricsRef = useRef<typeof onRouteMetrics>(onRouteMetrics);
    const onRouteStatusRef = useRef<typeof onRouteStatus>(onRouteStatus);
    const onCityMarkerSelectRef = useRef<typeof onCityMarkerSelect>(onCityMarkerSelect);
    const onActivityMarkerSelectRef = useRef<typeof onActivityMarkerSelect>(onActivityMarkerSelect);
    const googleMixedSurfaceControllerRef = useRef<GoogleMixedSurfaceController | null>(null);
    /**
     * Every camera move goes through this: the Mapbox map in standalone mode,
     * the Google map otherwise (where Mapbox, if shown, follows Google).
     */
    const cameraRef = useRef<TripMapCamera | null>(null);
    
    const { isLoaded, loadError: googleLoadError, disabled: googleMapsDisabled } = useGoogleMaps();
    const { runtime, mapboxAccessToken, presetSettled } = useMapRuntime();
    /**
     * Mapbox with no Google underneath (`mapbox_all`). Decided only once the
     * admin preset has settled; until then the map shows "Loading map…".
     */
    const isStandaloneMapbox = Boolean(presetSettled)
        && runtime.effectiveSelection.renderer === 'mapbox'
        && googleMapsDisabled;
    const isStandaloneMapboxRef = useRef(isStandaloneMapbox);
    isStandaloneMapboxRef.current = isStandaloneMapbox;
    const [standaloneMapboxLoadError, setStandaloneMapboxLoadError] = useState<Error | null>(null);
    const loadError = googleLoadError ?? (isStandaloneMapbox ? standaloneMapboxLoadError : null);
    const routesImplementation = runtime.effectiveSelection.routes;
    const locationSearchImplementation = runtime.effectiveSelection.locationSearch;
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const [mapboxBasemapFailureKey, setMapboxBasemapFailureKey] = useState<string | null>(null);
    const [isMapboxSurfaceReady, setIsMapboxSurfaceReady] = useState(false);
    const [mapboxStyleReloadNonce, setMapboxStyleReloadNonce] = useState(0);
    // On by default: the zoom gate in `shouldDisplayActivityMarkers` keeps them
    // out of a country-wide view, so they only appear once the map is close
    // enough for them to mean something.
    const [uncontrolledActivityMarkersEnabled, setUncontrolledActivityMarkersEnabled] = useState(true);
    const activityMarkersEnabled = showActivityMarkers ?? uncontrolledActivityMarkersEnabled;
    const toggleActivityMarkers = useCallback(() => {
        const next = !activityMarkersEnabled;
        if (onShowActivityMarkersChange) {
            onShowActivityMarkersChange(next);
            return;
        }
        setUncontrolledActivityMarkersEnabled(next);
    }, [activityMarkersEnabled, onShowActivityMarkersChange]);
    const ideaLayerAvailable = Boolean(onShowIdeaMarkersChange) && ideaMarkers.length > 0;
    const ideaMarkersVisible = ideaLayerAvailable && showIdeaMarkers;
    const ideaMarkersRef = useRef(ideaMarkers);
    const ideaMarkersVisibleRef = useRef(ideaMarkersVisible);
    const ideaMarkerHandlesRef = useRef<OverlayMarkerHandle[]>([]);
    const [popupIdeaId, setPopupIdeaId] = useState<string | null>(null);
    const [popupActivityId, setPopupActivityId] = useState<string | null>(null);
    const [mapZoomLevel, setMapZoomLevel] = useState<number | null>(null);
    const [mapViewportSize, setMapViewportSize] = useState<{ width: number; height: number } | null>(null);
    const previousMapDockModeRef = useRef<'docked' | 'floating'>(mapDockMode);
    const mapActionsDisabled = !mapInitialized || Boolean(loadError);
    const activityMarkersEnabledRef = useRef(activityMarkersEnabled);
    const userLocation = useTripUserLocation({
        enabled: showUserLocation && !isPaywalled,
        items,
        todayDayOffset,
    });
    const userLocationFix = userLocation.isOffered ? userLocation.fix : null;
    const userLocationFixRef = useRef(userLocationFix);
    userLocationFixRef.current = userLocationFix;
    const userLocationMarkerRef = useRef<RuntimeMarkerHandle | null>(null);
    const pendingUserLocationRecenterRef = useRef(false);
    const [isUserLocationInView, setIsUserLocationInView] = useState(true);
    const mapZoomLevelRef = useRef<number | null>(mapZoomLevel);
    
    // Internal state for menu, but style comes from props (or defaults to standard if not provided)
    const mapboxBasemapAvailabilityKey = `${mapboxAccessToken}::${runtime.activeSelectionKey}`;
    const mapboxBasemapAvailable = mapboxBasemapFailureKey !== mapboxBasemapAvailabilityKey;
    const shouldUseRequestedMapboxBasemap = runtime.effectiveSelection.renderer === 'mapbox' && mapboxAccessToken.length > 0;
    // Standalone has no Google map to fall back to, so a Mapbox failure is an error, not a switch.
    const isMapboxBasemapEnabled = shouldUseRequestedMapboxBasemap && (mapboxBasemapAvailable || isStandaloneMapbox);
    const tripMapProvider = runtime.effectiveSelection.renderer;
    const tripMapTuning = useMemo(() => getTripMapProviderTuning(tripMapProvider), [tripMapProvider]);
    const mapSurfaceBackgroundColor = useMemo(() => getMapSurfaceBackgroundColor(activeStyle), [activeStyle]);
    const shouldHideGoogleCanvasInMixedMode = shouldHideGoogleMapCanvas({
        isMapboxEnabled: isMapboxBasemapEnabled,
    });
    const shouldRenderMapCanvas = Boolean(presetSettled) && isLoaded && !loadError && !isStandaloneMapbox;
    const shouldShowMapLoadingOverlay = !loadError && (
        !presetSettled
        || (!isMapboxBasemapEnabled && !mapInitialized)
        || (isMapboxBasemapEnabled && !isMapboxSurfaceReady)
    );
    const cities = useMemo(() => 
        items
            .filter((item): item is ITimelineItem => item.type === 'city' && isFiniteLatLngLiteral(item.coordinates))
            .sort((a, b) => a.startDateOffset - b.startDateOffset),
    [items]);
    const cityMapSignature = useMemo(
        () => cities.map((city) => `${city.id}|${city.coordinates?.lat},${city.coordinates?.lng}`).join('||'),
        [cities],
    );
    const selectedCityId = useMemo(
        () => (selectedItemId && cities.some(city => city.id === selectedItemId) ? selectedItemId : null),
        [selectedItemId, cities]
    );
    const selectedActivityId = useMemo(
        () => (selectedItemId && items.some(item => item.id === selectedItemId && item.type === 'activity') ? selectedItemId : null),
        [items, selectedItemId]
    );
    const selectedItemIdRef = useRef<string | null>(selectedItemId ?? null);
    /**
     * Looking at one city. The rest of the journey — every other city marker,
     * its label and all the connecting lines — is noise on top of the one place
     * being read, so it comes off the map until the selection is let go.
     */
    const isCityFocusMode = cityFocusMode && Boolean(selectedCityId) && !selectedActivityId;
    const showRouteArrows = tripOverlay?.showRouteArrows ?? true;
    const dashedRoutes = tripOverlay?.dashedRoutes ?? false;

    const showTrafficLayer = tripOverlay?.showTraffic ?? false;
    /**
     * Fading days already behind you. Only meaningful while the trip is
     * actually running — before it starts nothing is past, and afterwards
     * everything is, which would fade the whole map to nothing.
     */
    const shouldDimPastDays = Boolean(tripOverlay?.dimPastDays)
        && typeof todayDayOffset === 'number'
        && Number.isFinite(todayDayOffset);
    const showTransitLinesLayer = tripOverlay?.showTransitLines ?? false;
    const selectedActivityIdRef = useRef<string | null>(selectedActivityId);
    const selectedCityIdRef = useRef<string | null>(selectedCityId);
    const selectionVersionRef = useRef(0);
    const normalizedSelectedItemId = selectedItemId ?? null;
    if (selectedItemIdRef.current !== normalizedSelectedItemId) {
        selectedItemIdRef.current = normalizedSelectedItemId;
        selectionVersionRef.current += 1;
    }
    selectedActivityIdRef.current = selectedActivityId;
    selectedCityIdRef.current = selectedCityId;
    const resolvedActivityMarkerPositionById = useMemo(() => {
        const markerPositions = new Map<string, google.maps.LatLngLiteral>();
        resolveActivityMarkerPositions(items).forEach((marker) => {
            markerPositions.set(marker.id, marker.position);
        });
        return markerPositions;
    }, [items]);
    const finiteCityCoordinates = useMemo(() => {
        const coordinates: google.maps.LatLngLiteral[] = [];
        for (const city of cities) {
            if (isFiniteLatLngLiteral(city.coordinates)) {
                coordinates.push(city.coordinates);
            }
        }
        return coordinates;
    }, [cities]);
    const routePixelSpan = useMemo(
        () => estimateRoutePixelSpan(
            finiteCityCoordinates,
            mapZoomLevel,
        ),
        [finiteCityCoordinates, mapZoomLevel],
    );
    const nearestMarkerGapPx = useMemo(
        () => estimateNearestMarkerGapPx(
            finiteCityCoordinates,
            mapZoomLevel,
        ),
        [finiteCityCoordinates, mapZoomLevel],
    );
    const markerRenderTier = useMemo(
        () => resolveMarkerRenderTier({
            provider: tripMapProvider,
            viewportWidth: mapViewportSize?.width ?? 0,
            viewportHeight: mapViewportSize?.height ?? 0,
            zoom: mapZoomLevel,
            routePixelSpan,
            nearestMarkerGapPx,
        }),
        [mapViewportSize, mapZoomLevel, nearestMarkerGapPx, routePixelSpan, tripMapProvider],
    );
    const markerRenderProfile = useMemo(
        () => resolveMarkerRenderProfile({
            mapDockMode,
            markerTier: markerRenderTier,
        }),
        [mapDockMode, markerRenderTier],
    );
    const zoomEnhancedCityProfile = useMemo(
        () => resolveZoomEnhancedCityMarkerProfile({
            provider: tripMapProvider,
            baseProfile: markerRenderProfile.city,
            markerTier: markerRenderTier,
            zoom: mapZoomLevel,
        }),
        [mapZoomLevel, markerRenderProfile.city, markerRenderTier, tripMapProvider],
    );
    const crowdedCityProfile = useMemo(
        () => resolveCrowdedCityMarkerProfile({
            provider: tripMapProvider,
            baseProfile: zoomEnhancedCityProfile,
            markerTier: markerRenderTier,
            zoom: mapZoomLevel,
            nearestMarkerGapPx,
        }),
        [zoomEnhancedCityProfile, markerRenderTier, mapZoomLevel, nearestMarkerGapPx, tripMapProvider],
    );
    const rawMarkerRenderProfile = useMemo(() => {
        if (crowdedCityProfile === markerRenderProfile.city) return markerRenderProfile;
        return {
            ...markerRenderProfile,
            city: crowdedCityProfile,
        };
    }, [crowdedCityProfile, markerRenderProfile]);

    /**
     * Stabilised by value, not by identity.
     *
     * The profile is derived from the live zoom and from the gap between the
     * nearest markers on screen, so panning and zooming produced a brand new
     * object on almost every frame. That object is a dependency of the marker
     * and route rebuild, which therefore tore every marker and polyline off the
     * map and built them again — and re-ran the async route draw — while the
     * traveller was still moving. That is the flicker where routes vanish and
     * come back a moment later.
     *
     * The underlying numbers only change at the tier and zoom-band boundaries,
     * so keying on the serialised value collapses the churn to the handful of
     * genuine transitions.
     */
    const markerRenderProfileKey = JSON.stringify(rawMarkerRenderProfile);
    const effectiveMarkerRenderProfile = useMemo(
        () => rawMarkerRenderProfile,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value on purpose
        [markerRenderProfileKey],
    );
    const activityMarkerStylesById = useMemo(() => {
        const styles = new Map<string, { type: ActivityType; title: string }>();
        items.forEach((item) => {
            if (item.type !== 'activity') return;
            styles.set(item.id, {
                type: pickPrimaryActivityType(item.activityType),
                title: item.title || '',
            });
        });
        return styles;
    }, [items]);

    const cancelScheduledFit = useCallback(() => {
        if (fitRafRef.current === null || typeof window === 'undefined') return;
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
    }, []);

    const cancelResizeAutoFitTimer = useCallback(() => {
        if (resizeAutoFitTimerRef.current === null || typeof window === 'undefined') return;
        window.clearTimeout(resizeAutoFitTimerRef.current);
        resizeAutoFitTimerRef.current = null;
    }, []);

    const cancelDockModeRefitTimer = useCallback(() => {
        if (dockModeRefitTimerRef.current === null || typeof window === 'undefined') return;
        window.clearTimeout(dockModeRefitTimerRef.current);
        dockModeRefitTimerRef.current = null;
    }, []);

    const fitBoundsPoints = useMemo(() => collectTripMapFitBoundsCoordinates({
        cities,
        items,
        provider: tripMapProvider,
    }), [cities, items, tripMapProvider]);

    const runFitBounds = useCallback(() => {
        const camera = cameraRef.current;
        if (!camera || cities.length === 0) return;

        // Measure the container here rather than trusting the observed size:
        // the pane can change without a resize observation (a sheet sliding over
        // a full-bleed map), and a stale size produces padding that no longer
        // fits, which is how "fit to itinerary" ended up framing nothing.
        const liveRect = mapContainerRef.current?.getBoundingClientRect();
        const fitViewportSize = liveRect && liveRect.width > 0 && liveRect.height > 0
            ? { width: liveRect.width, height: liveRect.height }
            : mapViewportSize;
        camera.fitBounds(fitBoundsPoints, resolveMapViewportPadding({
            provider: tripMapProvider,
            mapDockMode,
            mapViewportSize: fitViewportSize,
        }));
    }, [cities.length, fitBoundsPoints, mapDockMode, mapViewportSize, tripMapProvider]);

    const scheduleFitWhenViewportReady = useCallback((maxAttempts = 14, options?: { respectSelection?: boolean }) => {
        if (!cameraRef.current || cities.length === 0 || typeof window === 'undefined') return;
        const respectSelection = options?.respectSelection ?? false;
        const selectionVersionAtSchedule = selectionVersionRef.current;
        cancelScheduledFit();

        let attemptCount = 0;
        const tryFit = () => {
            fitRafRef.current = null;
            const camera = cameraRef.current;
            if (!camera || cities.length === 0) return;

            const rect = mapContainerRef.current?.getBoundingClientRect();
            if (!isMapViewportReady(rect) && attemptCount < maxAttempts) {
                attemptCount += 1;
                fitRafRef.current = window.requestAnimationFrame(tryFit);
                return;
            }

            camera.resize();
            if (shouldSkipRouteFitForSelection({
                respectSelection,
                selectionVersionAtSchedule,
                currentSelectionVersion: selectionVersionRef.current,
                selectedItemId: selectedItemIdRef.current,
                selectedActivityId: selectedActivityIdRef.current,
                selectedCityId: selectedCityIdRef.current,
            })) {
                return;
            }
            runFitBounds();
        };

        fitRafRef.current = window.requestAnimationFrame(tryFit);
    }, [cancelScheduledFit, cities.length, runFitBounds]);

    useEffect(() => {
        scheduleFitWhenViewportReadyRef.current = scheduleFitWhenViewportReady;
    }, [scheduleFitWhenViewportReady]);

    useEffect(() => {
        onRouteMetricsRef.current = onRouteMetrics;
    }, [onRouteMetrics]);

    useEffect(() => {
        onRouteStatusRef.current = onRouteStatus;
    }, [onRouteStatus]);

    useEffect(() => {
        onCityMarkerSelectRef.current = onCityMarkerSelect;
    }, [onCityMarkerSelect]);

    useEffect(() => {
        onActivityMarkerSelectRef.current = onActivityMarkerSelect;
    }, [onActivityMarkerSelect]);

    useEffect(() => {
        activityMarkersEnabledRef.current = activityMarkersEnabled;
    }, [activityMarkersEnabled]);

    // Declared before the drawing pass, so it reads this render's ideas.
    useEffect(() => {
        ideaMarkersRef.current = ideaMarkers;
        ideaMarkersVisibleRef.current = ideaMarkersVisible;
    }, [ideaMarkers, ideaMarkersVisible]);

    useEffect(() => {
        mapZoomLevelRef.current = mapZoomLevel;
    }, [mapZoomLevel]);

    useEffect(() => {
        if (!fitToRouteKey) {
            lastFitToRouteKeyRef.current = null;
            return;
        }
        if (lastFitToRouteKeyRef.current === null) {
            lastFitToRouteKeyRef.current = fitToRouteKey;
        }
    }, [fitToRouteKey]);

    const handleMapInstanceChange = useCallback((map: google.maps.Map | null) => {
        if (googleMapRef.current === map) return;
        googleMapRef.current = map;
        cameraRef.current = map ? createGoogleTripMapCamera(map) : null;
        setMapInstance(map);
        setMapInitialized(Boolean(map));
        if (!map) {
            setMapZoomLevel(null);
            setMapViewportSize(null);
            return;
        }
        const nextZoom = map.getZoom?.();
        setMapZoomLevel(Number.isFinite(nextZoom) ? Number(nextZoom) : null);
        const containerRect = mapContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
            setMapViewportSize({
                width: Math.round(containerRect.width),
                height: Math.round(containerRect.height),
            });
        }
    }, []);

    const handleMapboxMapReadyChange = useCallback((map: mapboxgl.Map | null) => {
        mapboxMapRef.current = map;
        // Mixed mode keeps the Google camera; only a standalone map owns it.
        if (isStandaloneMapboxRef.current && map) {
            cameraRef.current = createMapboxTripMapCamera(map);
        }
        if (!map) {
            setIsMapboxSurfaceReady(false);
            if (!googleMapRef.current) {
                cameraRef.current = null;
                setMapInitialized(false);
                setMapZoomLevel(null);
            }
        }
    }, []);

    const handleMapboxModuleReadyChange = useCallback((mapboxModule: typeof import('mapbox-gl').default | null) => {
        mapboxModuleRef.current = mapboxModule;
    }, []);

    const handleMapboxSurfaceReadyChange = useCallback((isReady: boolean) => {
        setIsMapboxSurfaceReady(isReady);
        // Standalone: the map is usable once its first style is in. A later
        // style switch reports not-ready briefly, which must not tear down the
        // camera or re-run everything keyed on `mapInitialized`.
        if (!isReady || !isStandaloneMapboxRef.current || !cameraRef.current) return;
        setMapInitialized(true);
        const containerRect = mapContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
            setMapViewportSize({
                width: Math.round(containerRect.width),
                height: Math.round(containerRect.height),
            });
        }
    }, []);

    const handleMapboxStyleReload = useCallback(() => {
        setMapboxStyleReloadNonce((value) => value + 1);
    }, []);

    useEffect(() => {
        googleMixedSurfaceControllerRef.current?.destroy();
        googleMixedSurfaceControllerRef.current = null;
        if (!mapInstance) return;

        const controller = createGoogleMixedSurfaceController(mapInstance);
        if (!controller) return;
        googleMixedSurfaceControllerRef.current = controller;
        controller.apply(shouldHideGoogleCanvasInMixedMode);

        return () => {
            if (googleMixedSurfaceControllerRef.current === controller) {
                googleMixedSurfaceControllerRef.current = null;
            }
            controller.destroy();
        };
    }, [mapInstance, shouldHideGoogleCanvasInMixedMode]);

    useEffect(() => {
        googleMixedSurfaceControllerRef.current?.apply(shouldHideGoogleCanvasInMixedMode);
    }, [shouldHideGoogleCanvasInMixedMode]);

    useEffect(() => {
        if (isMapboxBasemapEnabled) return;
        setIsMapboxSurfaceReady(false);
    }, [isMapboxBasemapEnabled]);

    const handleMapboxBasemapError = useCallback((error: { message: string; status: number | null }) => {
        if (isStandaloneMapboxRef.current) {
            console.warn('Mapbox map failed in standalone mode', error);
            setIsMapboxSurfaceReady(false);
            setStandaloneMapboxLoadError(new Error(error.message));
            return;
        }
        console.warn('Mapbox basemap failed inside itinerary map; falling back to Google', error);
        setIsMapboxSurfaceReady(false);
        setMapboxBasemapFailureKey(mapboxBasemapAvailabilityKey);
    }, [mapboxBasemapAvailabilityKey]);

    useEffect(() => {
        const camera = cameraRef.current;
        if (!mapInitialized || !camera) return;
        const setZoom = (zoom: number | null) => {
            setMapZoomLevel(Number.isFinite(zoom) ? Number(zoom) : null);
        };
        setZoom(camera.getZoom());
        return camera.onZoom(setZoom);
    }, [mapInitialized]);

    // Handle Style Change
    useEffect(() => {
        if (!googleMapRef.current) return;
        
        // Ensure we force a style update
        if (isMapboxBasemapEnabled) {
            googleMapRef.current.setMapTypeId('roadmap');
            googleMapRef.current.setOptions({
                styles: GOOGLE_BASEMAP_HIDDEN_STYLES,
                backgroundColor: 'transparent',
            });
        } else if (activeStyle === 'satellite') {
            googleMapRef.current.setMapTypeId('satellite');
            googleMapRef.current.setOptions({ styles: null });
        } else {
            googleMapRef.current.setMapTypeId('roadmap');
            
            // Explicitly set null first if switching from standard to ensure clear
            if (activeStyle === 'standard') {
                googleMapRef.current.setOptions({ styles: null }); 
            } else {
                googleMapRef.current.setOptions({ styles: MAP_STYLES[activeStyle] });
            }
        }
    }, [activeStyle, isMapboxBasemapEnabled, mapInitialized]);

    const mapRenderSignature = useMemo(() => {
        const citySignature = cities
            .map(city => `${city.id}|${city.title}|${city.color}|${city.coordinates?.lat},${city.coordinates?.lng}`)
            .join('||');
        const activitySignature = items.reduce<string[]>((parts, item) => {
            if (item.type === 'activity') {
                parts.push(`${item.id}|${item.startDateOffset}|${item.duration}|${item.coordinates?.lat},${item.coordinates?.lng}|${item.activityKind ?? ''}|${item.stayCityId ?? ''}|${item.dayTripReturnCityId ?? ''}|${item.activityKind === 'day-trip' ? (item.location ?? '') : ''}`);
            }
            return parts;
        }, []).join('||');
        const routeSignature = cities
            .slice(0, -1)
            .map((city, idx) => {
                const nextCity = cities[idx + 1];
                const travelItem = findTravelBetweenCities(items, city, nextCity);
                const mode = normalizeTransportMode(travelItem?.transportMode);
                return `${city.id}->${nextCity.id}:${mode}`;
            })
            .join('||');
        return `${citySignature}__${activitySignature}__${routeSignature}__${mapColorMode}__${buildMapIdeaSignature(ideaMarkers)}`;
    }, [cities, ideaMarkers, items, mapColorMode]);

    // Update Markers & Routes
    useEffect(() => {
        let isEffectDisposed = false;
        const mapboxMap = isMapboxBasemapEnabled ? mapboxMapRef.current : null;
        const mapboxModule = isMapboxBasemapEnabled ? mapboxModuleRef.current : null;
        const canRenderMapVisuals = Boolean(
            mapInitialized
            // Standalone Mapbox draws everything itself; `window.google` does not exist there.
            && (isStandaloneMapbox || (googleMapRef.current && window.google?.maps))
            && (!isMapboxBasemapEnabled || mapboxMap)
            && (!isMapboxBasemapEnabled || mapboxModule)
            && (!isMapboxBasemapEnabled || (
                isMapboxSurfaceReady
                && mapboxMap
                && isMapboxStyleReadyForRuntimeMutations(mapboxMap)
            ))
            && (isMapboxBasemapEnabled || window.google?.maps?.OverlayView)
        );
        /** Google's geometry library, never read on the standalone Mapbox path. */
        const readGoogleSpherical = () => (isStandaloneMapbox ? undefined : window.google?.maps?.geometry?.spherical);

        const clearRenderedMapVisuals = () => {
            markersRef.current.forEach((marker) => marker.setMap(null));
            markersRef.current = [];
            activityMarkerMetaRef.current.forEach(({ marker }) => marker.setMap(null));
            activityMarkerMetaRef.current = [];
            ideaMarkerHandlesRef.current.forEach((marker) => marker.setMap(null));
            ideaMarkerHandlesRef.current = [];
            activityMarkerPositionByIdRef.current = new Map();
            routesRef.current.forEach((route) => route.setMap(null));
            routesRef.current = [];
            transportMarkerMetaRef.current.forEach(({ marker }) => marker.setMap(null));
            transportMarkerMetaRef.current = [];
            cityLabelOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
            cityLabelOverlaysRef.current = [];
            cityMarkerMetaRef.current = [];
        };

        // 1. Clear existing markers & routes
        clearRenderedMapVisuals();
        if (!canRenderMapVisuals) {
            return () => {
                isEffectDisposed = true;
                clearRenderedMapVisuals();
            };
        }
        let routeVisualIndex = 0;
        const isEffectActive = () => !isEffectDisposed;
        let markerDomListeners: Array<{
            target: HTMLDivElement;
            type: 'click' | 'mouseenter' | 'mouseleave';
            listener: EventListener;
        }> = [];
        const registerMarkerDomListener = (
            target: HTMLDivElement,
            type: 'click' | 'mouseenter' | 'mouseleave',
            listener: EventListener,
        ) => {
            target.addEventListener(type, listener);
            markerDomListeners.push({ target, type, listener });
        };
        const removeMarkerDomListeners = (target: HTMLDivElement) => {
            markerDomListeners = markerDomListeners.filter((entry) => {
                if (entry.target !== target) return true;
                entry.target.removeEventListener(entry.type, entry.listener);
                return false;
            });
        };

        /**
         * Wraps a marker's markup so a day already behind the traveller reads as
         * background. Done on a wrapper rather than inside each marker builder
         * so the builders stay pure string functions with no notion of "today",
         * and so it applies identically on both renderers.
         */
        const dimIfPast = (html: string, endDayOffset: number): string => {
            if (!shouldDimPastDays || endDayOffset > (todayDayOffset as number)) return html;
            return `<div style="opacity:0.34;filter:saturate(0.55);">${html}</div>`;
        };

        const createOverlayMarker = ({
            position,
            html,
            zIndex,
            clickable = false,
            centerAnchor = false,
            onClick,
            tooltipText,
            markerDomId,
        }: {
            position: google.maps.LatLngLiteral;
            html: string;
            zIndex: number;
            clickable?: boolean;
            centerAnchor?: boolean;
            onClick?: () => void;
            tooltipText?: string;
            markerDomId?: string;
        }): OverlayMarkerHandle => {
            if (mapboxMap) {
                return createMapboxOverlayMarker({
                    map: mapboxMap,
                    mapboxModule: mapboxModule!,
                    position,
                    html,
                    zIndex,
                    clickable,
                    centerAnchor,
                    onClick,
                    markerDomId,
                });
            }

            const overlay = new window.google.maps.OverlayView();
            let markerDiv: HTMLDivElement | null = null;
            let currentPosition = position;
            let currentHtml = html;
            let currentZIndex = zIndex;
            let tooltipNode: HTMLDivElement | null = null;
            const clickHandler: EventListener = (event) => {
                event.stopPropagation();
                onClick?.();
            };
            const showTooltipHandler: EventListener = () => {
                if (markerDiv) markerDiv.style.zIndex = `${MARKER_HOVER_Z_INDEX}`;
                if (!tooltipNode) return;
                Object.assign(tooltipNode.style, {
                    opacity: '1',
                    transform: MARKER_TOOLTIP_SHOWN_TRANSFORM,
                });
            };
            const hideTooltipHandler: EventListener = () => {
                if (markerDiv) markerDiv.style.zIndex = `${currentZIndex}`;
                if (!tooltipNode) return;
                Object.assign(tooltipNode.style, {
                    opacity: '0',
                    transform: MARKER_TOOLTIP_HIDDEN_TRANSFORM,
                });
            };

            overlay.onAdd = function onAdd() {
                markerDiv = document.createElement('div');
                markerDiv.style.cssText = [
                    'position: absolute',
                    `transform: ${centerAnchor ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)'}`,
                    `pointer-events: ${clickable ? 'auto' : 'none'}`,
                    `cursor: ${clickable ? 'pointer' : 'default'}`,
                    `z-index: ${currentZIndex}`,
                ].join('; ');
                markerDiv.innerHTML = currentHtml;
                if (clickable) {
                    registerMarkerDomListener(markerDiv, 'click', clickHandler);
                }
                if (tooltipText) {
                    tooltipNode = markerDiv.querySelector('[data-role="activity-marker-tooltip"]');
                    registerMarkerDomListener(markerDiv, 'mouseenter', showTooltipHandler);
                    registerMarkerDomListener(markerDiv, 'mouseleave', hideTooltipHandler);
                }
                const panes = this.getPanes();
                const targetPane = clickable
                    ? (panes.floatPane ?? panes.overlayMouseTarget ?? panes.overlayLayer)
                    : panes.overlayLayer;
                if (markerDomId) {
                    const staleNodes = targetPane.querySelectorAll('[data-tf-marker-id]');
                    staleNodes.forEach((node) => {
                        if (!(node instanceof HTMLElement)) return;
                        if (node.dataset.tfMarkerId !== markerDomId) return;
                        node.remove();
                    });
                    markerDiv.dataset.tfMarkerId = markerDomId;
                }
                targetPane.appendChild(markerDiv);
            };

            overlay.draw = function draw() {
                if (!markerDiv) return;
                const projection = this.getProjection();
                if (!projection) return;
                const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(currentPosition.lat, currentPosition.lng));
                if (!point) return;
                Object.assign(markerDiv.style, {
                    left: `${point.x}px`,
                    top: `${point.y}px`,
                });
            };

            overlay.onRemove = function onRemove() {
                if (!markerDiv) return;
                removeMarkerDomListeners(markerDiv);
                markerDiv.remove();
                markerDiv = null;
                tooltipNode = null;
            };

            overlay.setMap(googleMapRef.current);

            return {
                setMap: (map: unknown | null) => overlay.setMap((map as google.maps.Map | null) ?? null),
                update: (updates: OverlayMarkerUpdate) => {
                    if (updates.position) {
                        currentPosition = updates.position;
                    }
                    if (updates.zIndex !== undefined) {
                        currentZIndex = updates.zIndex;
                    }
                    if (updates.html !== undefined) {
                        currentHtml = updates.html;
                    }
                    if (markerDiv) {
                        markerDiv.style.zIndex = `${currentZIndex}`;
                        if (updates.html !== undefined) {
                            markerDiv.innerHTML = currentHtml;
                            if (tooltipText) {
                                tooltipNode = markerDiv.querySelector('[data-role="activity-marker-tooltip"]');
                            }
                        }
                    }
                    overlay.draw();
                },
            };
        };

        const getHeadingBetweenPoints = (
            from: google.maps.LatLngLiteral,
            to: google.maps.LatLngLiteral,
        ): number | undefined => {
            if (from.lat === to.lat && from.lng === to.lng) return undefined;
            const geometry = readGoogleSpherical();
            if (geometry) {
                return geometry.computeHeading(
                    new window.google.maps.LatLng(from.lat, from.lng),
                    new window.google.maps.LatLng(to.lat, to.lng),
                );
            }
            const headingFromNorthRadians = Math.atan2(to.lng - from.lng, to.lat - from.lat);
            return headingFromNorthRadians * (180 / Math.PI);
        };

        const getPointAlongPath = (
            path: google.maps.LatLngLiteral[],
            fraction: number,
        ): google.maps.LatLngLiteral | null => {
            if (path.length === 0) return null;
            if (path.length === 1) return path[0];
            const clampedFraction = Math.max(0, Math.min(1, fraction));
            const geometry = readGoogleSpherical();
            if (!geometry) {
                // A straight two-point leg (standalone Mapbox) has no vertex in
                // the middle, so interpolate instead of snapping to an end.
                if (path.length === 2) {
                    return {
                        lat: path[0].lat + (path[1].lat - path[0].lat) * clampedFraction,
                        lng: path[0].lng + (path[1].lng - path[0].lng) * clampedFraction,
                    };
                }
                const fallbackIndex = Math.round((path.length - 1) * clampedFraction);
                return path[Math.max(0, Math.min(path.length - 1, fallbackIndex))];
            }

            const toLatLng = (point: google.maps.LatLngLiteral) => new window.google.maps.LatLng(point.lat, point.lng);
            const segments = path.slice(1).map((point, index) => {
                const from = path[index];
                return {
                    from,
                    to: point,
                    distance: geometry.computeDistanceBetween(toLatLng(from), toLatLng(point)),
                };
            });
            const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);
            if (totalDistance <= 0) return path[Math.floor(path.length / 2)];

            let targetDistance = totalDistance * clampedFraction;
            for (const segment of segments) {
                if (targetDistance <= segment.distance) {
                    if (segment.distance <= 0) return segment.to;
                    const localFraction = targetDistance / segment.distance;
                    const interpolated = geometry.interpolate(
                        toLatLng(segment.from),
                        toLatLng(segment.to),
                        localFraction,
                    );
                    return { lat: interpolated.lat(), lng: interpolated.lng() };
                }
                targetDistance -= segment.distance;
            }

            return path[path.length - 1];
        };

        const getHeadingAlongPath = (
            path: google.maps.LatLngLiteral[],
            fraction: number,
        ): number | undefined => {
            if (path.length < 2) return undefined;
            const clampedFraction = Math.max(0, Math.min(1, fraction));
            const upperIndex = Math.max(1, Math.min(path.length - 1, Math.round((path.length - 1) * clampedFraction)));
            const from = path[upperIndex - 1];
            const to = path[upperIndex];
            return getHeadingBetweenPoints(from, to);
        };

        const createRoutePolylinePair = (options: google.maps.PolylineOptions) => {
            if (!isEffectActive()) return null;
            if (mapboxMap) {
                const path = (options.path ?? []) as google.maps.LatLngLiteral[];
                if (path.length < 2) return null;
                const routeId = `tf-mapbox-route-${routeVisualIndex}`;
                routeVisualIndex += 1;
                const layers = buildMapboxRouteLayerConfigs({
                    routeId,
                    options,
                    style: activeStyle,
                    provider: tripMapProvider,
                });
                if (layers.length === 0) return null;
                const routeHandle = createMapboxLineHandle({
                    map: mapboxMap,
                    sourceId: `${routeId}-source`,
                    path,
                    layers,
                });
                routesRef.current.push(routeHandle);
                return { outerOutline: null, outline: null, main: routeHandle };
            }
            if (!googleMapRef.current || !window.google?.maps?.Polyline) return null;
            const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions(options, activeStyle);
            const shouldRenderOuterOutline = (outerOutlineOptions.strokeOpacity ?? 0) > 0 || ((outerOutlineOptions.icons?.length ?? 0) > 0);
            const shouldRenderInnerOutline = (outlineOptions.strokeOpacity ?? 0) > 0 || ((outlineOptions.icons?.length ?? 0) > 0);
            let outerOutline: google.maps.Polyline | null = null;
            let outline: google.maps.Polyline | null = null;
            if (shouldRenderOuterOutline) {
                outerOutline = new window.google.maps.Polyline({
                    ...outerOutlineOptions,
                    map: googleMapRef.current,
                });
                routesRef.current.push(outerOutline);
            }
            if (shouldRenderInnerOutline) {
                outline = new window.google.maps.Polyline({
                    ...outlineOptions,
                    map: googleMapRef.current,
                });
                routesRef.current.push(outline);
            }
            const main = new window.google.maps.Polyline({
                ...mainOptions,
                map: googleMapRef.current,
            });
            routesRef.current.push(main);
            return { outerOutline, outline, main };
        };

        const drawRoutePath = (
            path: google.maps.LatLngLiteral[],
            color: string,
            weight = 3,
            options?: { dashed?: boolean; arrows?: boolean },
        ) => {
            if (!isEffectActive()) return null;
            // The traveller's thickness multiplier rides on top of the render
            // profile's own scale rather than replacing it, so a dense map still
            // thins its routes down at both ends of the slider.
            const routeScale = Math.max(0.58, effectiveMarkerRenderProfile.routeStrokeScale)
                * Math.max(0.5, Math.min(2, routeLineWeight));
            // Google symbols only exist on the Google branch: Mapbox line layers
            // ignore polyline icons apart from the dash repeat.
            const arrowIcon = mapboxMap ? null : buildGoogleRouteArrowIcon(color, routeScale);
            // A dashed line is drawn as repeated dot symbols with the stroke
            // turned off, which is the only way Google renders a dash pattern.
            const dashSymbol = {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.85,
                strokeColor: color,
                strokeWeight: Math.max(1.2, weight * routeScale),
                scale: 2.2,
            };
            const isDashed = options?.dashed ?? dashedRoutes;
            const withArrows = options?.arrows ?? showRouteArrows;
            const routeIcons: google.maps.IconSequence[] = [];
            if (isDashed) {
                routeIcons.push({ icon: dashSymbol as any, offset: '0', repeat: '14px' });
            }
            if (withArrows && arrowIcon) {
                routeIcons.push(
                    { icon: arrowIcon, offset: '25%' },
                    { icon: arrowIcon, offset: '75%' },
                );
            }

            return createRoutePolylinePair({
                path,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: isDashed ? 0 : 0.7,
                strokeWeight: Math.max(1.2, weight * routeScale),
                clickable: false,
                icons: routeIcons.length > 0 ? routeIcons : undefined,
                zIndex: 40,
            });
        };

        const drawGroundShadowPath = (path: google.maps.LatLngLiteral[], weight = 3) => {
            if (!isEffectActive()) return null;
            const routeScale = Math.max(0.58, effectiveMarkerRenderProfile.routeStrokeScale);
            const shadowStyle = resolveTripMapFlightGroundShadowStyle({
                provider: tripMapProvider,
                style: activeStyle,
                baseWeight: weight * routeScale,
            });
            return createRoutePolylinePair({
                path,
                geodesic: true,
                strokeColor: shadowStyle.color,
                strokeOpacity: shadowStyle.opacity,
                strokeWeight: shadowStyle.weight,
                clickable: false,
                zIndex: 34,
            });
        };

        const clearRouteVisualHandle = (
            handle: ReturnType<typeof createRoutePolylinePair> | null | undefined,
        ) => {
            if (!handle) return;
            handle.outerOutline?.setMap(null);
            handle.outline?.setMap(null);
            handle.main?.setMap(null);
        };

        const drawFallbackLegVisual = ({
            startCoordinates,
            endCoordinates,
            mode,
            color,
            includeTransportMarker,
        }: {
            startCoordinates: google.maps.LatLngLiteral;
            endCoordinates: google.maps.LatLngLiteral;
            mode: ReturnType<typeof normalizeTransportMode>;
            color: string;
            includeTransportMarker: boolean;
        }) => {
            const isFlightFallback = mode === 'plane';
            const flightRouteVisualPaths = isFlightFallback
                ? buildFlightRouteVisualPaths(
                    startCoordinates,
                    endCoordinates,
                    resolveTripMapFlightCurveOptions(tripMapProvider),
                )
                : null;
            const fallbackAirPath = flightRouteVisualPaths
                ? flightRouteVisualPaths.airPath
                : [
                    { lat: startCoordinates.lat, lng: startCoordinates.lng },
                    { lat: endCoordinates.lat, lng: endCoordinates.lng },
                ];
            const fallbackGroundPath = flightRouteVisualPaths?.groundPath ?? fallbackAirPath;
            const isDashedFallback = mode !== 'plane';
            const routeScale = Math.max(0.58, effectiveMarkerRenderProfile.routeStrokeScale);
            const arrowIcon = mapboxMap ? null : buildGoogleRouteArrowIcon(color, routeScale);
            const arrowIcons: google.maps.IconSequence[] = arrowIcon
                ? [
                    { icon: arrowIcon, offset: '25%' },
                    { icon: arrowIcon, offset: '75%' },
                ]
                : [];
            const icons = isDashedFallback
                ? [
                    {
                        icon: {
                            path: 'M 0,-1 0,1',
                            strokeColor: color,
                            strokeOpacity: 0.9,
                            scale: 2.5 * Math.max(0.72, routeScale),
                        },
                        offset: '0',
                        repeat: '12px'
                    },
                    ...arrowIcons,
                ]
                : arrowIcons;

            const groundShadowHandle = isFlightFallback
                ? drawGroundShadowPath(fallbackGroundPath, 2.35)
                : null;
            const routeHandle = createRoutePolylinePair({
                path: fallbackAirPath,
                geodesic: !isFlightFallback,
                strokeColor: color,
                strokeOpacity: isDashedFallback ? 0 : 0.6,
                strokeWeight: Math.max(1.05, 2 * effectiveMarkerRenderProfile.routeStrokeScale),
                clickable: false,
                icons,
                zIndex: 35,
            });

            if (includeTransportMarker && mode !== 'na' && effectiveMarkerRenderProfile.transport.show) {
                const midPoint = getPointAlongPath(fallbackAirPath, 0.5);
                if (midPoint) {
                    const markerHeading = mode === 'plane'
                        ? getHeadingAlongPath(fallbackAirPath, 0.5)
                        : undefined;
                    const transportMarker = createOverlayMarker({
                        position: midPoint,
                        html: buildTransportMarkerHtml(mode, color, markerHeading, effectiveMarkerRenderProfile),
                        zIndex: 50,
                        centerAnchor: true,
                    });
                    transportMarkerMetaRef.current.push({
                        mode,
                        color,
                        rotationDegrees: markerHeading,
                        marker: transportMarker,
                    });
                }
            }

            return {
                groundShadowHandle,
                routeHandle,
            };
        };

        const brandRouteColor = '#4f46e5';
        const resolveMapColor = (colorToken: string): string =>
            mapColorMode === 'brand' ? brandRouteColor : getHexFromColorClass(colorToken);
        const cityOverlayDescriptors = isCityFocusMode
            ? []
            : buildTripMapCityOverlayDescriptors(cities);

        if (!isPaywalled) {
            // 2. Add Markers
            cityOverlayDescriptors.forEach(({ city, cityIndex, markerPosition }) => {
                if (!isEffectActive()) return;
                const isSelected = city.id === selectedCityId;
                const cityMarkerColor = resolveMapColor(city.color);
                const cityMarkerImageUrl = resolveTripMapCityMarkerImageUrl(city);
                const marker = createOverlayMarker({
                    position: markerPosition,
                    html: dimIfPast(buildTripMapCityMarkerHtml({
                        provider: tripMapProvider,
                        index: cityIndex,
                        color: cityMarkerColor,
                        imageUrl: cityMarkerImageUrl,
                        isSelected,
                        profile: effectiveMarkerRenderProfile.city,
                        selectedOutlineColor: resolveCssColorVar('--tf-accent-500', CITY_PIN_SELECTED_OUTLINE_FALLBACK),
                        selectedRingColor: resolveCssColorVar('--tf-accent-200', CITY_PIN_SELECTED_RING_FALLBACK),
                    }), city.startDateOffset + Math.max(city.duration, 0)),
                    zIndex: resolveCityMarkerZIndex(isSelected, effectiveMarkerRenderProfile),
                    clickable: true,
                    onClick: () => onCityMarkerSelectRef.current?.(city.id),
                    markerDomId: `city:${city.id}`,
                });
                
                cityMarkerMetaRef.current.push({
                    id: city.id,
                    color: cityMarkerColor,
                    imageUrl: cityMarkerImageUrl,
                    index: cityIndex,
                    marker,
                });
                markersRef.current.push(marker);
            });

            const currentZoomValue = cameraRef.current?.getZoom();
            const resolvedZoomLevel = Number.isFinite(currentZoomValue)
                ? Number(currentZoomValue)
                : mapZoomLevelRef.current;
            const shouldAttachActivityMarkers = shouldDisplayActivityMarkers({
                provider: tripMapProvider,
                isEnabled: activityMarkersEnabledRef.current,
                zoom: resolvedZoomLevel,
            });
            const dayTripDescriptors = buildTripMapDayTripDescriptors(items);
            const activityMarkers = resolveActivityMarkerPositions(items, collectDayTripMarkerIds(dayTripDescriptors));
            activityMarkers.forEach((activityMarker) => {
                if (!isEffectActive()) return;
                const isSelected = activityMarker.id === selectedActivityId;
                const marker = createOverlayMarker({
                    position: activityMarker.position,
                    html: dimIfPast(
                        buildActivityMarkerHtml(
                            activityMarker.type,
                            isSelected,
                            activityMarker.title,
                            effectiveMarkerRenderProfile,
                        ),
                        activityMarker.endDayOffset,
                    ),
                    zIndex: isSelected ? ACTIVITY_MARKER_SELECTED_Z_INDEX : ACTIVITY_MARKER_Z_INDEX,
                    clickable: true,
                    onClick: () => {
                        // Selection still fires, so the timeline stays in sync
                        // exactly as it did before the callout existed.
                        onActivityMarkerSelectRef.current?.(activityMarker.id);
                        setPopupIdeaId(null);
                        setPopupActivityId(activityMarker.id);
                    },
                    tooltipText: activityMarker.title,
                    markerDomId: `activity:${activityMarker.id}`,
                });
                if (!shouldAttachActivityMarkers) {
                    marker.setMap(null);
                }

                activityMarkerMetaRef.current.push({
                    id: activityMarker.id,
                    title: activityMarker.title,
                    type: activityMarker.type,
                    marker,
                    isVisible: shouldAttachActivityMarkers,
                });
                activityMarkerPositionByIdRef.current.set(activityMarker.id, activityMarker.position);
            });

            // Day trips: a dashed loop from the stay to the destination and
            // back, plus a pin that stays visible at every zoom level. Drawn
            // straight (no directions lookup) — it shows where the day goes,
            // not the road there.
            dayTripDescriptors.forEach((dayTrip) => {
                if (!isEffectActive()) return;
                const color = resolveMapColor(dayTrip.stayColor);
                drawRoutePath(dayTrip.outboundPath, color, 2.4, { dashed: true, arrows: false });
                if (!isDayTripRoundTrip(dayTrip)) {
                    drawRoutePath(dayTrip.returnPath, color, 2.4, { dashed: true, arrows: false });
                }
                const isSelected = dayTrip.id === selectedActivityId;
                const marker = createOverlayMarker({
                    position: dayTrip.destination,
                    html: dimIfPast(
                        buildDayTripMarkerHtml({
                            label: dayTrip.destinationLabel,
                            color,
                            size: effectiveMarkerRenderProfile.activity.size + 6,
                            isSelected,
                            selectedOutlineColor: resolveCssColorVar('--tf-accent-500', '#2563eb'),
                            showLabel: showCityNames,
                        }),
                        dayTrip.endDayOffset,
                    ),
                    zIndex: isSelected ? ACTIVITY_MARKER_SELECTED_Z_INDEX : ACTIVITY_MARKER_Z_INDEX,
                    clickable: true,
                    onClick: () => {
                        onActivityMarkerSelectRef.current?.(dayTrip.id);
                        setPopupActivityId(dayTrip.id);
                    },
                    tooltipText: dayTrip.title,
                    markerDomId: `activity:${dayTrip.id}`,
                });
                markersRef.current.push(marker);
                activityMarkerPositionByIdRef.current.set(dayTrip.id, dayTrip.destination);
            });

            // Saved ideas: built with everything else so they share the
            // renderer, attached only while the traveller has the layer on.
            ideaMarkersRef.current.forEach((idea) => {
                if (!isEffectActive()) return;
                const marker = createOverlayMarker({
                    position: { lat: idea.lat, lng: idea.lng },
                    html: buildIdeaMarkerHtml(idea.type, idea.pending, idea.title, effectiveMarkerRenderProfile),
                    zIndex: IDEA_MARKER_Z_INDEX,
                    clickable: true,
                    onClick: () => {
                        // One card at a time: an idea card replaces an activity one.
                        setPopupActivityId(null);
                        setPopupIdeaId(idea.id);
                    },
                    tooltipText: idea.title,
                    markerDomId: `idea:${idea.id}`,
                });
                if (!ideaMarkersVisibleRef.current) marker.setMap(null);
                ideaMarkerHandlesRef.current.push(marker);
            });
        }

        if (!isPaywalled && showCityNames && (mapboxMap || googleMapRef.current)) {
            const baseLabelOffsetPx = resolveTripMapCityLabelOffsetPx({
                provider: tripMapProvider,
                markerSize: effectiveMarkerRenderProfile.city.size,
            });

            const createCityLabelOverlay = (
                position: google.maps.LatLngLiteral,
                name: string,
                subLabel?: string,
                anchor: CityLabelAnchor = 'right',
                labelOffsetPx: number = baseLabelOffsetPx,
                compact = false,
            ) => {
                if (mapboxMap) {
                    return createMapboxOverlayMarker({
                        map: mapboxMap,
                        mapboxModule: mapboxModule!,
                        position,
                        html: buildTripMapCityLabelHtml({
                            provider: tripMapProvider,
                            name,
                            subLabel,
                            anchor,
                            style: activeStyle,
                            offsetPx: labelOffsetPx,
                            compact,
                        }),
                        zIndex: 120,
                        centerAnchor: true,
                    });
                }

                const overlay = new window.google.maps.OverlayView();
                (overlay as any).div = null;

                overlay.onAdd = function () {
                    const div = document.createElement('div');
                    const placement = resolveCityLabelPlacement(
                        anchor,
                        labelOffsetPx,
                    );
                    const theme = resolveCityLabelTheme(activeStyle);
                    div.style.cssText = [
                        'position: absolute',
                        `transform: ${placement.transform}`,
                        `text-align: ${placement.textAlign}`,
                        'pointer-events: none',
                        'display: flex',
                        'flex-direction: column',
                        'gap: 2px',
                        'white-space: nowrap',
                        'z-index: 120',
                        'padding: 6px 9px',
                        'border-radius: 999px',
                        `background: ${theme.background}`,
                        `border: 1px solid ${theme.borderColor}`,
                        `box-shadow: ${theme.boxShadow}`,
                        'backdrop-filter: blur(12px)',
                    ].join('; ');

                    const nameEl = document.createElement('div');
                    nameEl.textContent = name;
                    nameEl.style.cssText = [
                        'font-size: 13px',
                        'font-weight: 700',
                        `color: ${theme.textColor}`,
                        `text-shadow: ${theme.textShadow}`,
                    ].join('; ');

                    div.appendChild(nameEl);

                    if (subLabel) {
                        const subEl = document.createElement('div');
                        subEl.textContent = subLabel;
                        subEl.style.cssText = [
                            'font-size: 10px',
                            'font-weight: 700',
                            `color: ${theme.subTextColor}`,
                            'text-transform: uppercase',
                            'letter-spacing: 0.08em',
                            `text-shadow: ${theme.textShadow}`,
                        ].join('; ');
                        div.appendChild(subEl);
                    }

                    (overlay as any).div = div;
                    const panes = this.getPanes();
                    const labelPane = panes.floatPane ?? panes.overlayMouseTarget ?? panes.overlayLayer;
                    labelPane.appendChild(div);
                };

                overlay.draw = function () {
                    const projection = this.getProjection();
                    if (!projection || !(overlay as any).div) return;
                    const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(position.lat, position.lng));
                    if (point) {
                        Object.assign((overlay as any).div.style, {
                            left: `${point.x}px`,
                            top: `${point.y}px`,
                        });
                    }
                };

                overlay.onRemove = function () {
                    if ((overlay as any).div) {
                        (overlay as any).div.remove();
                        (overlay as any).div = null;
                    }
                };

                overlay.setMap(googleMapRef.current);
                return overlay;
            };

            const cityLabelDescriptors = buildTripMapCityLabelOverlayDescriptors({
                provider: tripMapProvider,
                cityOverlays: cityOverlayDescriptors,
            });

            const mapboxCityLabelLayouts = mapboxMap
                ? resolveTripMapProjectedCityLabelLayouts({
                    provider: tripMapProvider,
                    labels: cityLabelDescriptors.flatMap((descriptor) => {
                        try {
                            const point = mapboxMap.project([
                                descriptor.markerPosition.lng,
                                descriptor.markerPosition.lat,
                            ]);
                            if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
                            return [{
                                key: descriptor.key,
                                point: { x: point.x, y: point.y },
                                name: descriptor.labelName,
                                subLabel: descriptor.subLabel,
                            }];
                        } catch {
                            return [];
                        }
                    }),
                    baseOffsetPx: baseLabelOffsetPx,
                    viewport: {
                        width: mapboxMap.getContainer().clientWidth,
                        height: mapboxMap.getContainer().clientHeight,
                    },
                })
                : new Map<string, TripMapProjectedCityLabelLayout>();

            cityLabelDescriptors.forEach(({ markerPosition, key, labelName, subLabel, defaultAnchor }) => {
                const labelLayout = mapboxCityLabelLayouts.get(key);
                if (labelLayout?.hidden) return;
                const labelAnchor = labelLayout?.anchor ?? defaultAnchor;
                const labelOffsetPx = labelLayout?.offsetPx ?? baseLabelOffsetPx;
                const compact = labelLayout?.compact ?? false;
                if (subLabel) {
                    const overlay = createCityLabelOverlay(
                        markerPosition,
                        labelName,
                        subLabel,
                        labelAnchor,
                        labelOffsetPx,
                        compact,
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                } else {
                    const overlay = createCityLabelOverlay(
                        markerPosition,
                        labelName,
                        undefined,
                        labelAnchor,
                        labelOffsetPx,
                        compact,
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                }
            });
        }

        /**
         * No routing service (`mapbox_all`): every leg is the straight or
         * flight-arc line the Google path falls back to. Nothing is requested,
         * logged or cached, because nothing failed.
         */
        const drawStraightRoutes = () => {
            for (let i = 0; i < cities.length - 1; i++) {
                if (!isEffectActive()) return;
                const start = cities[i];
                const end = cities[i + 1];
                if (!start.coordinates || !end.coordinates) continue;
                drawFallbackLegVisual({
                    startCoordinates: start.coordinates,
                    endCoordinates: end.coordinates,
                    mode: normalizeTransportMode(findTravelBetweenCities(items, start, end)?.transportMode),
                    color: resolveMapColor(start.color),
                    includeTransportMarker: true,
                });
            }
        };

        // 3. Draw Routes
        const drawRoutes = async () => {
             if (!isEffectActive()) return;
             if (routesImplementation === 'none') {
                 drawStraightRoutes();
                 return;
             }
             hydrateRouteCache();
             const googleRouteRuntime = await loadGoogleRouteRuntime();
             if (!isEffectActive()) return;

             for (let i = 0; i < cities.length - 1; i++) {
                 if (!isEffectActive()) return;
                 const start = cities[i];
                 const end = cities[i+1];
                 if (!start.coordinates || !end.coordinates) continue;
                 const startCoordinates = start.coordinates;
                 const endCoordinates = end.coordinates;

                 const travelItem = findTravelBetweenCities(items, start, end);
                 const mode = normalizeTransportMode(travelItem?.transportMode);
                 const startColor = resolveMapColor(start.color); // Color based on start city
                 const cacheKey = start.coordinates && end.coordinates
                     ? buildRouteCacheKey(start.coordinates, end.coordinates, mode)
                     : null;
                 const straightDistanceKm = estimateGreatCircleDistanceKm(start.coordinates, end.coordinates);
                 const routeAttemptPolicy = buildRouteAttemptPolicy(mode, straightDistanceKm);
                 let routingAttempted = false;
                 let routingFailed = false;

                 const wantsRealRoute = routeMode === 'realistic';
                 // The policy's mode names are Google's TravelMode values verbatim.
                 const routeAttemptModes = routeAttemptPolicy.modes as readonly string[] as google.maps.TravelMode[];
                 const useRealRoute = wantsRealRoute && routeAttemptModes.length > 0;
                 let provisionalRouteHandle: ReturnType<typeof createRoutePolylinePair> | null = null;
                 let provisionalGroundShadowHandle: ReturnType<typeof createRoutePolylinePair> | null = null;

                 const clearProvisionalFallbackVisual = () => {
                     clearRouteVisualHandle(provisionalGroundShadowHandle);
                     clearRouteVisualHandle(provisionalRouteHandle);
                     provisionalGroundShadowHandle = null;
                     provisionalRouteHandle = null;
                 };

                 const requiresDirections = mode !== 'plane' && mode !== 'boat' && mode !== 'na';
                 if (wantsRealRoute && requiresDirections && !routeAttemptPolicy.shouldAttempt) {
                     routingAttempted = true;
                     routingFailed = true;
                     const failureReason = mapRouteAttemptPolicyReasonToFailureReason(routeAttemptPolicy.reason);
                     if (cacheKey) {
                         ROUTE_CACHE.set(cacheKey, { status: 'failed', updatedAt: Date.now(), reason: failureReason });
                         persistRouteCache();
                     }
                     if (travelItem && onRouteStatusRef.current) {
                         onRouteStatusRef.current(travelItem.id, 'failed', {
                             mode,
                             routeKey: cacheKey ?? undefined,
                             reason: failureReason,
                         });
                     }
                 }

                 if (useRealRoute && cacheKey) {
                     const cached = ROUTE_CACHE.get(cacheKey);
                     const isCachedFailureFresh = cached?.status === 'failed' && (Date.now() - cached.updatedAt) < ROUTE_FAILURE_TTL_MS;

                     if (cached?.status === 'ok' && cached.path?.length) {
                         const cachedPathIsStraightLike = isRoutePathLikelyStraight(
                             cached.path,
                             start.coordinates,
                             end.coordinates,
                             mode,
                         );
                         if (cachedPathIsStraightLike) {
                             ROUTE_CACHE.delete(cacheKey);
                             persistRouteCache();
                         } else {
                         if (!isEffectActive()) return;
                         routingAttempted = true;
                         drawRoutePath(cached.path, startColor, 3);

                         if (mode !== 'na' && effectiveMarkerRenderProfile.transport.show) {
                             const midPoint = getPointAlongPath(cached.path, 0.5);
                             if (!midPoint) continue;
                             const markerHeading = mode === 'plane' ? getHeadingAlongPath(cached.path, 0.5) : undefined;
                             const transportMarker = createOverlayMarker({
                                 position: midPoint,
                                 html: buildTransportMarkerHtml(mode, startColor, markerHeading, effectiveMarkerRenderProfile),
                                 zIndex: 50,
                                 centerAnchor: true,
                             });
                             transportMarkerMetaRef.current.push({
                                 mode,
                                 color: startColor,
                                 rotationDegrees: markerHeading,
                                 marker: transportMarker,
                             });
                         }

                         if (travelItem && onRouteMetricsRef.current) {
                             onRouteMetricsRef.current(travelItem.id, {
                                 routeDistanceKm: cached.distanceKm,
                                 routeDurationHours: cached.durationHours,
                                 mode,
                                 routeKey: cacheKey
                             });
                         }
                         if (travelItem && onRouteStatusRef.current) {
                             onRouteStatusRef.current(travelItem.id, 'ready', { mode, routeKey: cacheKey });
                         }
                         continue;
                         }
                     }

                     if (isCachedFailureFresh) {
                         routingAttempted = true;
                         routingFailed = true;
                         if (travelItem && onRouteStatusRef.current) {
                             onRouteStatusRef.current(travelItem.id, 'failed', {
                                 mode,
                                 routeKey: cacheKey,
                                 reason: cached.reason,
                             });
                         }
                     } else {
                         routingAttempted = true;
                         if (travelItem && onRouteStatusRef.current) {
                             onRouteStatusRef.current(travelItem.id, 'calculating', { mode, routeKey: cacheKey });
                         }
                         if (isEffectActive()) {
                             const provisionalFallback = drawFallbackLegVisual({
                                 startCoordinates: start.coordinates,
                                 endCoordinates: end.coordinates,
                                 mode,
                                 color: startColor,
                                 includeTransportMarker: false,
                             });
                             provisionalGroundShadowHandle = provisionalFallback.groundShadowHandle;
                             provisionalRouteHandle = provisionalFallback.routeHandle;
                         }
                         const tryRoute = async (travelMode: google.maps.TravelMode, attemptIndex: number) => {
                             if (!isEffectActive()) {
                                 throw new Error('Route draw cancelled');
                             }
                             const origin = { lat: startCoordinates.lat, lng: startCoordinates.lng };
                             const destination = { lat: endCoordinates.lat, lng: endCoordinates.lng };
                             const { path, distanceKm, durationHours } = await computeGoogleRouteLeg({
                                 origin,
                                 destination,
                                 travelMode,
                                 transportMode: mode,
                                 attemptIndex,
                                 routeRuntime: googleRouteRuntime,
                                 isCancelled: () => !isEffectActive(),
                             });

                             if (!path || path.length === 0) {
                                 throw new Error('No route path returned');
                             }
                             if (isRoutePathLikelyStraight(path, origin, destination, mode)) {
                                 throw new Error('Route path is straight');
                             }
                             if (!isEffectActive()) {
                                 throw new Error('Route draw cancelled');
                             }

                             clearProvisionalFallbackVisual();
                             drawRoutePath(path, startColor, 3);

                             if (mode !== 'na' && effectiveMarkerRenderProfile.transport.show) {
                                 const midPoint = getPointAlongPath(path, 0.5);
                                 if (midPoint) {
                                     const markerHeading = mode === 'plane' ? getHeadingAlongPath(path, 0.5) : undefined;
                                     const transportMarker = createOverlayMarker({
                                         position: midPoint,
                                         html: buildTransportMarkerHtml(mode, startColor, markerHeading, effectiveMarkerRenderProfile),
                                         zIndex: 50,
                                         centerAnchor: true,
                                     });
                                     transportMarkerMetaRef.current.push({
                                         mode,
                                         color: startColor,
                                         rotationDegrees: markerHeading,
                                         marker: transportMarker,
                                     });
                                 }
                             }

                             ROUTE_CACHE.set(cacheKey, {
                                 status: 'ok',
                                 updatedAt: Date.now(),
                                 path,
                                 distanceKm,
                                 durationHours
                             });
                             persistRouteCache();

                             if (travelItem && onRouteMetricsRef.current) {
                                 onRouteMetricsRef.current(travelItem.id, {
                                     routeDistanceKm: distanceKm,
                                     routeDurationHours: durationHours,
                                     mode,
                                     routeKey: cacheKey
                                 });
                             }
                             if (travelItem && onRouteStatusRef.current) {
                                 onRouteStatusRef.current(travelItem.id, 'ready', { mode, routeKey: cacheKey });
                             }
                         };

                         let lastRouteError: unknown = null;
                         let routeResolved = false;
                         for (let attemptIndex = 0; attemptIndex < routeAttemptModes.length; attemptIndex++) {
                             if (!isEffectActive()) return;
                             const attemptMode = routeAttemptModes[attemptIndex];
                             try {
                                 await tryRoute(attemptMode, attemptIndex);
                                 routeResolved = true;
                                 break;
                             } catch (error) {
                                 if (!isEffectActive()) return;
                                 lastRouteError = error;
                             }
                         }

                         if (routeResolved) {
                             continue;
                         }
                         if (!isEffectActive()) return;

                         clearProvisionalFallbackVisual();
                         routingFailed = true;
                         const failureReason = classifyRouteComputationError(lastRouteError);
                         ROUTE_CACHE.set(cacheKey, {
                             status: 'failed',
                             updatedAt: Date.now(),
                             reason: failureReason,
                         });
                         persistRouteCache();
                         if (travelItem && onRouteStatusRef.current) {
                             onRouteStatusRef.current(travelItem.id, 'failed', {
                                 mode,
                                 routeKey: cacheKey,
                                 reason: failureReason,
                             });
                         }
                         if (shouldLogRouteFailureWarning({ routeKey: cacheKey, mode, reason: failureReason })) {
                             console.warn(`Routing failed for ${mode}, falling back to line`, lastRouteError);
                         }
                     }
                 }

                 clearProvisionalFallbackVisual();
                 if (!isEffectActive()) return;
                 drawFallbackLegVisual({
                     startCoordinates: start.coordinates,
                     endCoordinates: end.coordinates,
                     mode,
                     color: startColor,
                     includeTransportMarker: true,
                 });
             }
        };

        if (!isPaywalled && !isCityFocusMode) {
            void drawRoutes();
        }
        return () => {
            isEffectDisposed = true;
            markerDomListeners.forEach(({ target, type, listener }) => {
                target.removeEventListener(type, listener);
            });
            markerDomListeners = [];
            clearRenderedMapVisuals();
        };

    }, [activeStyle, effectiveMarkerRenderProfile, isCityFocusMode, isMapboxBasemapEnabled, isMapboxSurfaceReady, isPaywalled, isStandaloneMapbox, mapInitialized, mapRenderSignature, mapboxStyleReloadNonce, dashedRoutes, showRouteArrows, routeLineWeight, routeMode, routesImplementation, showCityNames]); 

    useEffect(() => {
        if (!mapInitialized) return;
        if (!isMapboxBasemapEnabled && !window.google?.maps?.OverlayView) return;

        cityMarkerMetaRef.current.forEach(({ id, color, imageUrl, index, marker }) => {
            const isSelected = id === selectedCityId;
            marker.update({
                html: buildTripMapCityMarkerHtml({
                    provider: tripMapProvider,
                    index,
                    color,
                    imageUrl,
                    isSelected,
                    profile: effectiveMarkerRenderProfile.city,
                    selectedOutlineColor: resolveCssColorVar('--tf-accent-500', CITY_PIN_SELECTED_OUTLINE_FALLBACK),
                    selectedRingColor: resolveCssColorVar('--tf-accent-200', CITY_PIN_SELECTED_RING_FALLBACK),
                }),
                zIndex: resolveCityMarkerZIndex(isSelected, effectiveMarkerRenderProfile),
            });
        });
        activityMarkerMetaRef.current.forEach((meta) => {
            const { id, marker } = meta;
            const latestMarkerStyle = activityMarkerStylesById.get(id);
            const resolvedType = latestMarkerStyle?.type ?? meta.type;
            const resolvedTitle = latestMarkerStyle?.title ?? meta.title;
            meta.type = resolvedType;
            meta.title = resolvedTitle;
            const isSelected = id === selectedActivityId;
            marker.update({
                html: buildActivityMarkerHtml(resolvedType, isSelected, resolvedTitle, effectiveMarkerRenderProfile),
                zIndex: isSelected ? ACTIVITY_MARKER_SELECTED_Z_INDEX : ACTIVITY_MARKER_Z_INDEX,
            });
        });
    }, [activityMarkerStylesById, isMapboxBasemapEnabled, mapInitialized, selectedActivityId, selectedCityId, effectiveMarkerRenderProfile]);

    useEffect(() => {
        if (!mapInitialized) return;
        const activeOverlayTarget = resolveActiveOverlayMapTarget({
            isMapboxEnabled: isMapboxBasemapEnabled,
            googleMap: googleMapRef.current,
            mapboxMap: mapboxMapRef.current,
        });
        transportMarkerMetaRef.current.forEach((meta) => {
            meta.marker.setMap(effectiveMarkerRenderProfile.transport.show ? activeOverlayTarget : null);
            meta.marker.update({
                html: buildTransportMarkerHtml(meta.mode, meta.color, meta.rotationDegrees, effectiveMarkerRenderProfile),
            });
        });
    }, [isMapboxBasemapEnabled, mapInitialized, effectiveMarkerRenderProfile]);

    useEffect(() => {
        if (!mapInitialized) return;
        const activeOverlayTarget = resolveActiveOverlayMapTarget({
            isMapboxEnabled: isMapboxBasemapEnabled,
            googleMap: googleMapRef.current,
            mapboxMap: mapboxMapRef.current,
        });
        const shouldShow = shouldDisplayActivityMarkers({
            provider: tripMapProvider,
            isEnabled: activityMarkersEnabled,
            zoom: mapZoomLevel,
        });
        activityMarkerMetaRef.current.forEach((meta) => {
            if (meta.isVisible === shouldShow) return;
            meta.marker.setMap(shouldShow ? activeOverlayTarget : null);
            meta.isVisible = shouldShow;
        });
    }, [activityMarkersEnabled, isMapboxBasemapEnabled, mapInitialized, mapZoomLevel]);

    useEffect(() => {
        if (!mapInitialized) return;
        const activeOverlayTarget = resolveActiveOverlayMapTarget({
            isMapboxEnabled: isMapboxBasemapEnabled,
            googleMap: googleMapRef.current,
            mapboxMap: mapboxMapRef.current,
        });
        ideaMarkerHandlesRef.current.forEach((marker) => {
            marker.setMap(ideaMarkersVisible ? activeOverlayTarget : null);
        });
    }, [ideaMarkersVisible, isMapboxBasemapEnabled, mapInitialized]);

    // Pan to selected
    useLayoutEffect(() => {
        if (!selectedItemIdRef.current) return;
        cancelResizeAutoFitTimer();
        cancelScheduledFit();
    }, [cancelResizeAutoFitTimer, cancelScheduledFit, selectedItemId]);

    /**
     * Framing a city is a fit, not a zoom, so it must not re-run on every
     * incidental dependency change — refitting under the traveller while they
     * pan around inside a city is the behaviour this replaces.
     */
    const lastCityFrameKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedCityId || selectedActivityId) {
            lastCityFrameKeyRef.current = null;
            return;
        }
        const tripCamera = cameraRef.current;
        if (!mapInitialized || !tripCamera) return;

        const frameKey = `${selectedCityId}|${mapDockMode}|${tripMapProvider}`;
        if (lastCityFrameKeyRef.current === frameKey) return;

        const city = cities.find((item) => item.id === selectedCityId);
        if (!city) return;

        const camera = resolveCityFocusCamera({
            city,
            items,
            cities,
            provider: tripMapProvider,
        });
        if (!camera) return;
        lastCityFrameKeyRef.current = frameKey;

        if (camera.kind === 'center') {
            tripCamera.panTo(camera.center, { zoom: camera.zoom });
            return;
        }

        const liveRect = mapContainerRef.current?.getBoundingClientRect();
        const cityPadding = resolveMapViewportPadding({
            provider: tripMapProvider,
            mapDockMode,
            mapViewportSize: liveRect && liveRect.width > 0 && liveRect.height > 0
                ? { width: liveRect.width, height: liveRect.height }
                : mapViewportSize,
        });
        const googleMap = isStandaloneMapbox ? null : googleMapRef.current as google.maps.Map | null;
        if (googleMap) {
            // Google keeps its own corner-to-corner bounds; the antimeridian arc
            // in the camera adapter is a Mapbox concern.
            googleMap.fitBounds(new window.google.maps.LatLngBounds(
                { lat: camera.bounds.south, lng: camera.bounds.west },
                { lat: camera.bounds.north, lng: camera.bounds.east },
            ), cityPadding);
        } else {
            tripCamera.fitBounds([
                { lat: camera.bounds.south, lng: camera.bounds.west },
                { lat: camera.bounds.north, lng: camera.bounds.east },
            ], cityPadding);
        }

        // `fitBounds` is free to land anywhere, and a compact city will happily
        // take it to street level. The clamp runs once the fit has settled, and
        // is owned by this effect: a re-run or an unmount before the fit settles
        // must not zoom a camera this effect no longer controls.
        const stopListeningForIdle = tripCamera.onIdle(() => {
            stopListeningForIdle();
            const clamped = clampCityFocusZoom(tripCamera.getZoom(), camera);
            if (clamped !== null) tripCamera.setZoom(clamped);
        });
        return stopListeningForIdle;
    }, [
        cities,
        isStandaloneMapbox,
        items,
        mapDockMode,
        mapInitialized,
        mapViewportSize,
        selectedActivityId,
        selectedCityId,
        tripMapProvider,
    ]);

    useEffect(() => {
        if (!cameraRef.current) return;
        // Cities are framed by the effect above; this one only chases activities.
        if (!selectedActivityId) return;

        const t = setTimeout(() => {
            const tripCamera = cameraRef.current;
            if (!tripCamera) return;
            const focusTarget = resolveSelectedMapFocusPosition({
                provider: tripMapProvider,
                selectedActivityId,
                selectedCityId,
                activityMarkerPositions: resolvedActivityMarkerPositionById,
                cities,
            });
            if (!focusTarget) return;

            const currentZoomValue = tripCamera.getZoom();
            const currentZoom = Number.isFinite(currentZoomValue) ? Number(currentZoomValue) : null;
            const isTargetVisible = tripCamera.containsPoint(focusTarget.position);
            // The inset check needs Google's bounds object; standalone Mapbox
            // leaves it out and goes by plain visibility.
            const isStandalone = isStandaloneMapboxRef.current;
            const currentBounds = isStandalone
                ? undefined
                : (googleMapRef.current as google.maps.Map | null)?.getBounds?.();
            const isTargetWithinSafeZone = isStandalone ? undefined : currentBounds
                ? isCoordinateWithinSafeBounds({
                    bounds: currentBounds,
                    point: focusTarget.position,
                    insetRatio: resolveTripMapSelectionSafeInsetRatio({
                        provider: tripMapProvider,
                        mapDockMode,
                    }),
                })
                : false;
            const { shouldPan, shouldZoom } = resolveSelectionViewportActions({
                isTargetVisible,
                isTargetWithinSafeZone,
                currentZoom,
                targetZoom: focusTarget.zoom,
                alwaysCenter: focusTarget.kind === 'activity',
            });

            if (!shouldPan && !shouldZoom) return;
            const targetZoom = Math.max(currentZoom ?? focusTarget.zoom, focusTarget.zoom);
            if (shouldPan) {
                tripCamera.panTo(
                    { lat: focusTarget.position.lat, lng: focusTarget.position.lng },
                    shouldZoom ? { zoom: targetZoom } : undefined,
                );
            } else {
                tripCamera.setZoom(targetZoom);
            }
        }, 100);
        return () => clearTimeout(t);
    }, [cityMapSignature, mapDockMode, mapInitialized, resolvedActivityMarkerPositionById, selectedActivityId, selectedCityId, tripMapProvider]);

    /**
     * Tapping empty map lets go too, which is the gesture people try first.
     * Markers sit in `floatPane`/`overlayMouseTarget`, above the basemap, so
     * they swallow their own clicks and this only ever fires on bare map.
     *
     * Both renderers need wiring: with Mapbox active the Google canvas carries
     * `pointer-events-none`, so its click never fires and the Mapbox canvas is
     * the one receiving the gesture.
     */
    useEffect(() => {
        if (!isCityFocusMode || !onClearSelection || !mapInitialized) return;
        const googleMap = googleMapRef.current;
        if (!googleMap) return;
        const mapsEvent = window.google?.maps?.event;
        if (!mapsEvent) return;

        const listener = googleMap.addListener('click', () => onClearSelection());
        return () => mapsEvent.removeListener(listener);
    }, [isCityFocusMode, mapInitialized, onClearSelection]);

    useEffect(() => {
        if (!isCityFocusMode || !onClearSelection || !mapInitialized) return;
        if (!isMapboxBasemapEnabled) return;
        const mapboxMap = mapboxMapRef.current;
        if (!mapboxMap) return;

        const handleMapboxClick = () => onClearSelection();
        mapboxMap.on('click', handleMapboxClick);
        return () => {
            mapboxMap.off('click', handleMapboxClick);
        };
    }, [isCityFocusMode, isMapboxBasemapEnabled, mapInitialized, onClearSelection]);

    /**
     * Google's own traffic and transit layers.
     *
     * Both are Google-only and both are attached to the Google map instance, so
     * they are detached while Mapbox is drawing — the Google tile pane is hidden
     * then, and a layer painted onto it would simply be invisible while still
     * costing tiles.
     */
    useEffect(() => {
        // Google is checked last: it does not exist on the standalone Mapbox path.
        if (!mapInitialized || !showTrafficLayer || isMapboxBasemapEnabled) return;
        const googleMap = googleMapRef.current;
        if (!googleMap || !window.google?.maps?.TrafficLayer) return;

        const layer = new window.google.maps.TrafficLayer();
        layer.setMap(googleMap);
        return () => layer.setMap(null);
    }, [isMapboxBasemapEnabled, mapInitialized, showTrafficLayer]);

    useEffect(() => {
        if (!mapInitialized || !showTransitLinesLayer || isMapboxBasemapEnabled) return;
        const googleMap = googleMapRef.current;
        if (!googleMap || !window.google?.maps?.TransitLayer) return;

        const layer = new window.google.maps.TransitLayer();
        layer.setMap(googleMap);
        return () => layer.setMap(null);
    }, [isMapboxBasemapEnabled, mapInitialized, showTransitLinesLayer]);

    /**
     * The traveller's own dot. Owned by its own effect rather than the marker
     * rebuild above: that one tears everything down whenever the route changes,
     * while this dot only ever moves. Mapbox draws markers on its own canvas, so
     * the dot follows whichever surface is showing.
     */
    const hasUserLocationFix = Boolean(userLocationFix);
    useEffect(() => {
        if (!hasUserLocationFix || !mapInitialized) return;
        const fix = userLocationFixRef.current;
        if (!fix) return;
        const position = { lat: fix.lat, lng: fix.lng };
        const html = buildUserLocationMarkerHtml({ isLive: fix.isLive });
        let handle: RuntimeMarkerHandle | null = null;
        if (isMapboxBasemapEnabled) {
            const mapboxMap = mapboxMapRef.current;
            const mapboxModule = mapboxModuleRef.current;
            if (!isMapboxSurfaceReady || !mapboxMap || !mapboxModule) return;
            handle = createMapboxOverlayMarker({
                map: mapboxMap,
                mapboxModule,
                position,
                html,
                zIndex: USER_LOCATION_MARKER_Z_INDEX,
                centerAnchor: true,
            });
        } else {
            const googleMap = googleMapRef.current as google.maps.Map | null;
            if (!googleMap || !window.google?.maps?.OverlayView) return;
            handle = createGoogleUserLocationOverlay({ map: googleMap, position, html });
        }
        userLocationMarkerRef.current = handle;
        return () => {
            handle?.setMap(null);
            if (userLocationMarkerRef.current === handle) userLocationMarkerRef.current = null;
        };
    }, [hasUserLocationFix, isMapboxBasemapEnabled, isMapboxSurfaceReady, mapInitialized]);

    const userLocationLat = userLocationFix?.lat;
    const userLocationLng = userLocationFix?.lng;
    const userLocationIsLive = userLocationFix?.isLive ?? false;

    const recenterOnUserLocation = useCallback((position: { lat: number; lng: number }) => {
        const camera = cameraRef.current;
        if (!camera) return;
        const zoom = camera.getZoom();
        const needsZoom = !Number.isFinite(zoom) || Number(zoom) < USER_LOCATION_RECENTER_MIN_ZOOM;
        camera.panTo(position, needsZoom ? { zoom: USER_LOCATION_RECENTER_MIN_ZOOM } : undefined);
    }, []);

    useEffect(() => {
        if (typeof userLocationLat !== 'number' || typeof userLocationLng !== 'number') return;
        const position = { lat: userLocationLat, lng: userLocationLng };
        userLocationMarkerRef.current?.update({
            position,
            html: buildUserLocationMarkerHtml({ isLive: userLocationIsLive }),
        });
        // A tap on the control before the first fix arrived: take the traveller
        // there as soon as a live position exists.
        if (userLocationIsLive && pendingUserLocationRecenterRef.current) {
            pendingUserLocationRecenterRef.current = false;
            recenterOnUserLocation(position);
        }
    }, [recenterOnUserLocation, userLocationIsLive, userLocationLat, userLocationLng]);

    /** Whether the dot is on screen, so the control can call attention to itself when it is not. */
    useEffect(() => {
        if (typeof userLocationLat !== 'number' || typeof userLocationLng !== 'number' || !mapInitialized) return;
        const camera = cameraRef.current;
        if (!camera) return;
        const position = { lat: userLocationLat, lng: userLocationLng };
        const check = () => {
            // Google has no bounds before its first render: unknown is not "out of view".
            const googleMap = isStandaloneMapboxRef.current ? null : googleMapRef.current as google.maps.Map | null;
            if (googleMap && !googleMap.getBounds?.()) return;
            setIsUserLocationInView(camera.containsPoint(position));
        };
        check();
        return camera.onIdle(check);
    }, [mapInitialized, userLocationLat, userLocationLng]);

    const handleUserLocationControl = () => {
        const fix = userLocationFixRef.current;
        if (userLocation.enabled !== true || userLocation.status === 'denied' || !fix) {
            pendingUserLocationRecenterRef.current = true;
            trackEvent('trip_view__map_user_location--enable', {
                trip_id: analyticsTripId,
                surface: 'map_controls',
            });
            enableUserLocation();
            return;
        }
        trackEvent('trip_view__map_user_location--recenter', {
            trip_id: analyticsTripId,
            surface: 'map_controls',
            in_view: isUserLocationInView,
        });
        recenterOnUserLocation({ lat: fix.lat, lng: fix.lng });
    };
    const isUserLocationOutOfView = Boolean(userLocationFix) && !isUserLocationInView;
    const userLocationControlLabel = userLocation.status === 'denied'
        ? t('tripView.mapControls.myLocationBlocked')
        : userLocation.status === 'locating' && !userLocationFix
            ? t('tripView.mapControls.myLocationLocating')
            : userLocationFix
                ? t('tripView.mapControls.centerOnMyLocation')
                : t('tripView.mapControls.showMyLocation');

    // Fit Bounds
    const handleFit = () => {
        scheduleFitWhenViewportReady();
    };

    // Auto fit on load
    useEffect(() => {
        if (!mapInitialized || cities.length === 0) return;
        if (selectedActivityId || selectedCityId) return;
        if (hasAutoFitCompletedRef.current) return;
        hasAutoFitCompletedRef.current = true;
        scheduleFitWhenViewportReadyRef.current(14, { respectSelection: true });
    }, [mapInitialized, cities.length, selectedActivityId, selectedCityId]);

    useEffect(() => {
        if (cities.length > 0) return;
        hasAutoFitCompletedRef.current = false;
    }, [cities.length]);

    // Re-center when an external "active route" key changes (e.g., opening a different saved plan).
    useEffect(() => {
        if (selectedActivityId || selectedCityId) return;
        if (!fitToRouteKey || !mapInitialized || cities.length === 0) return;
        if (lastFitToRouteKeyRef.current === fitToRouteKey) return;

        lastFitToRouteKeyRef.current = fitToRouteKey;
        scheduleFitWhenViewportReadyRef.current(14, { respectSelection: true });
    }, [fitToRouteKey, mapInitialized, cities.length, selectedActivityId, selectedCityId]);

    useEffect(() => {
        if (!mapInitialized || !mapDockMode || cities.length === 0) return;
        if (selectedActivityId || selectedCityId) return;
        scheduleFitWhenViewportReadyRef.current(14, { respectSelection: true });
    }, [cities.length, mapDockMode, mapInitialized, selectedActivityId, selectedCityId]);

    useEffect(() => {
        const previousDockMode = previousMapDockModeRef.current;
        previousMapDockModeRef.current = mapDockMode;
        if (!mapInitialized || cities.length === 0) return;
        if (previousDockMode === mapDockMode) return;
        cancelDockModeRefitTimer();
        if (mapDockMode !== 'docked') return;
        cancelResizeAutoFitTimer();
        cancelScheduledFit();
        dockModeRefitTimerRef.current = window.setTimeout(() => {
            dockModeRefitTimerRef.current = null;
            scheduleFitWhenViewportReadyRef.current(18, { respectSelection: false });
        }, tripMapTuning.resize.dockModeRefitDelayMs);
    }, [cancelDockModeRefitTimer, cancelResizeAutoFitTimer, cancelScheduledFit, cities.length, mapDockMode, mapInitialized, tripMapTuning.resize.dockModeRefitDelayMs]);

    useEffect(() => {
        if (!mapInitialized || !cameraRef.current || typeof ResizeObserver === 'undefined') return;
        const container = mapContainerRef.current;
        if (!container) return;

        let previousViewportSize = container.getBoundingClientRect();
        let lastAutoFitViewportSize = previousViewportSize;
        setMapViewportSize({
            width: Math.round(previousViewportSize.width),
            height: Math.round(previousViewportSize.height),
        });
        let resizeRafId: number | null = null;
        const observer = new ResizeObserver(() => {
            if (resizeRafId !== null || !cameraRef.current) return;
            resizeRafId = window.requestAnimationFrame(() => {
                resizeRafId = null;
                const camera = cameraRef.current;
                if (!camera) return;
                camera.resize();
                if (selectedActivityIdRef.current || selectedCityIdRef.current || cities.length === 0) {
                    const currentViewportSize = container.getBoundingClientRect();
                    previousViewportSize = currentViewportSize;
                    setMapViewportSize({
                        width: Math.round(currentViewportSize.width),
                        height: Math.round(currentViewportSize.height),
                    });
                    return;
                }
                const nextViewportSize = container.getBoundingClientRect();
                const widthDeltaSinceLastAutoFit = Math.abs(nextViewportSize.width - lastAutoFitViewportSize.width);
                const heightDeltaSinceLastAutoFit = Math.abs(nextViewportSize.height - lastAutoFitViewportSize.height);
                previousViewportSize = nextViewportSize;
                setMapViewportSize({
                    width: Math.round(nextViewportSize.width),
                    height: Math.round(nextViewportSize.height),
                });
                if (
                    widthDeltaSinceLastAutoFit < tripMapTuning.resize.autoFitViewportDeltaPx
                    && heightDeltaSinceLastAutoFit < tripMapTuning.resize.autoFitViewportDeltaPx
                ) return;
                cancelResizeAutoFitTimer();
                resizeAutoFitTimerRef.current = window.setTimeout(() => {
                    resizeAutoFitTimerRef.current = null;
                    scheduleFitWhenViewportReadyRef.current(14, { respectSelection: true });
                    lastAutoFitViewportSize = container.getBoundingClientRect();
                }, 140);
            });
        });
        observer.observe(container);

        return () => {
            observer.disconnect();
            cancelDockModeRefitTimer();
            cancelResizeAutoFitTimer();
            if (resizeRafId !== null) {
                window.cancelAnimationFrame(resizeRafId);
            }
        };
    }, [cancelDockModeRefitTimer, cancelResizeAutoFitTimer, cities.length, mapDockMode, mapInitialized, tripMapTuning.resize.autoFitViewportDeltaPx]);

    useEffect(() => (
        () => {
            cancelDockModeRefitTimer();
            cancelResizeAutoFitTimer();
            cancelScheduledFit();
        }
    ), [cancelDockModeRefitTimer, cancelResizeAutoFitTimer, cancelScheduledFit]);

    // If we don't have city coordinates yet, center the map on the selected country/location.
    // Supports one or multiple focus queries separated by "||".
    useEffect(() => {
        const queries: string[] = [];
        for (const rawQuery of (focusLocationQuery ?? '').split(/\s*\|\|\s*/)) {
            const query = rawQuery.trim();
            if (query.length > 0) {
                queries.push(query);
            }
        }
        // Geocoding a focus query is a Google service; Mapbox city search does not cover it.
        if (locationSearchImplementation !== 'google') return;
        if (queries.length === 0 || !mapInitialized || !googleMapRef.current || cities.length > 0) return;
        if (!window.google?.maps?.Geocoder) return;
        const focusKey = queries.join('||');
        if (lastFocusQueryRef.current === focusKey) return;

        lastFocusQueryRef.current = focusKey;
        let cancelled = false;
        const geocoder = new window.google.maps.Geocoder();
        const bounds = new window.google.maps.LatLngBounds();
        let pending = queries.length;
        let successCount = 0;
        let singleLocation: google.maps.LatLng | null = null;
        let singleHasViewport = false;

        const complete = () => {
            pending -= 1;
            if (pending > 0 || cancelled || !googleMapRef.current || successCount === 0) return;
            if (successCount === 1 && singleLocation && !singleHasViewport) {
                googleMapRef.current.setCenter(singleLocation);
                googleMapRef.current.setZoom(tripMapTuning.selection.queryFocusZoom);
                return;
            }
            googleMapRef.current.fitBounds(bounds, resolveMapViewportPadding({
                provider: tripMapProvider,
                mapDockMode,
                mapViewportSize,
            }));
        };

        queries.forEach((query) => {
            geocoder.geocode({ address: query }, (results, status) => {
                if (cancelled || !googleMapRef.current) return;
                if (status === 'OK' && results?.length) {
                    const match = results[0];
                    if (match.geometry?.viewport) {
                        singleHasViewport = true;
                        const northEast = match.geometry.viewport.getNorthEast();
                        const southWest = match.geometry.viewport.getSouthWest();
                        bounds.extend(northEast);
                        bounds.extend(southWest);
                        successCount += 1;
                    } else if (match.geometry?.location) {
                        singleLocation = match.geometry.location;
                        bounds.extend(match.geometry.location);
                        successCount += 1;
                    }
                }
                complete();
            });
        });

        return () => {
            cancelled = true;
        };
    }, [cities.length, focusLocationQuery, locationSearchImplementation, mapDockMode, mapInitialized, mapViewportSize, tripMapProvider, tripMapTuning.selection.queryFocusZoom]);

    const activityMarkerSourceById = useMemo(() => {
        const sources = new Map<string, 'activity' | 'city'>();
        resolveActivityMarkerPositions(items).forEach((marker) => {
            sources.set(marker.id, marker.coordinateSource);
        });
        return sources;
    }, [items]);

    const popupActivity = useMemo(() => (
        popupActivityId
            ? items.find((item) => item.id === popupActivityId && item.type === 'activity') || null
            : null
    ), [items, popupActivityId]);

    // The callout belongs to a pin, so it only exists while that pin is drawn.
    const isActivityPopupOpen = Boolean(
        enableActivityPopup && popupActivity && !isPaywalled && activityMarkersEnabled,
    );

    const { anchor: activityPopupAnchor, containerSize: activityPopupContainerSize } = useMapMarkerAnchor(
        mapContainerRef,
        isActivityPopupOpen && popupActivityId ? `activity:${popupActivityId}` : null,
    );

    const handleCloseActivityPopup = useCallback(() => {
        setPopupActivityId(null);
    }, []);

    // The card belongs to a drawn pin: a skipped idea or a hidden layer takes it away.
    const popupIdea = useMemo(
        () => (popupIdeaId && ideaMarkersVisible ? ideaMarkers.find((idea) => idea.id === popupIdeaId) ?? null : null),
        [ideaMarkers, ideaMarkersVisible, popupIdeaId],
    );
    const { anchor: ideaPopupAnchor, containerSize: ideaPopupContainerSize } = useMapMarkerAnchor(
        mapContainerRef,
        popupIdea ? `idea:${popupIdea.id}` : null,
    );
    const handleCloseIdeaPopup = useCallback(() => {
        setPopupIdeaId(null);
    }, []);
    const handleIdeaAction = useCallback((ideaId: string, action: IdeaMapAction) => {
        // Save and undo keep the card open to show the new state; skipping is done with it.
        if (action === 'skip') setPopupIdeaId(null);
        onIdeaAction?.(ideaId, action);
    }, [onIdeaAction]);

    const handleOpenActivityDetails = useCallback((activityId: string) => {
        setPopupActivityId(null);
        onActivityMarkerSelectRef.current?.(activityId);
    }, []);

    return (
        <div
            ref={mapContainerRef}
            className="relative w-full h-full group"
            data-tf-map-basemap={isMapboxBasemapEnabled ? 'mapbox' : 'google'}
            style={{
                ...(viewTransitionName ? ({ viewTransitionName } as React.CSSProperties) : {}),
                backgroundColor: mapSurfaceBackgroundColor,
            }}
        >
            {presetSettled && isMapboxBasemapEnabled && (
                <MapboxBasemapSync
                    accessToken={mapboxAccessToken}
                    googleMap={isStandaloneMapbox ? null : googleMapRef.current}
                    standalone={isStandaloneMapbox}
                    introBounds={isStandaloneMapbox ? fitBoundsPoints : undefined}
                    mapStyle={activeStyle}
                    mapDockMode={mapDockMode}
                    mapViewportSize={mapViewportSize}
                    detailOverrides={basemapDetail}
                    lookAxes={mapLookAxes}
                    preferGlobeProjection={useGlobeProjection}
                    showTerrain={showTerrain}
                    pitch={mapPitch}
                    interactive
                    onLoadError={handleMapboxBasemapError}
                    onMapReadyChange={handleMapboxMapReadyChange}
                    onModuleReadyChange={handleMapboxModuleReadyChange}
                    onSurfaceReadyChange={handleMapboxSurfaceReadyChange}
                    onStyleReload={handleMapboxStyleReload}
                />
            )}
            {shouldRenderMapCanvas && (
                <GoogleMap
                    id={mapInstanceId}
                    defaultCenter={{ lat: 20, lng: 0 }}
                    defaultZoom={2}
                    disableDefaultUI
                    gestureHandling="cooperative"
                    reuseMaps
                    className={shouldHideGoogleCanvasInMixedMode
                        ? 'pointer-events-none invisible absolute inset-0 z-10 h-full w-full bg-transparent opacity-0'
                        : isMapboxBasemapEnabled
                            ? 'pointer-events-none absolute inset-0 z-10 h-full w-full bg-transparent'
                            : 'absolute inset-0 z-10 h-full w-full bg-transparent'}
                >
                    <ItineraryMapInstanceBridge mapId={mapInstanceId} onMapInstanceChange={handleMapInstanceChange} />
                </GoogleMap>
            )}
            {isActivityPopupOpen && popupActivity && activityPopupAnchor && (
                <ActivityMapPopup
                    item={popupActivity}
                    anchor={activityPopupAnchor}
                    containerSize={activityPopupContainerSize}
                    markerCoordinatesSource={activityMarkerSourceById.get(popupActivity.id) || 'city'}
                    onClose={handleCloseActivityPopup}
                    onOpenDetails={handleOpenActivityDetails}
                />
            )}
            {popupIdea && ideaPopupAnchor && !isPaywalled && (
                <IdeaMapPopup
                    idea={popupIdea}
                    anchor={ideaPopupAnchor}
                    containerSize={ideaPopupContainerSize}
                    canEdit={canEditIdeas && Boolean(onIdeaAction)}
                    onClose={handleCloseIdeaPopup}
                    onAction={handleIdeaAction}
                />
            )}
            {shouldShowMapLoadingOverlay && (
                <div
                    className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
                    style={{ backgroundColor: mapSurfaceBackgroundColor }}
                >
                    Loading map…
                </div>
            )}
            {loadError && (
                <div
                    className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-500"
                    style={{ backgroundColor: mapSurfaceBackgroundColor }}
                >
                    Error loading map: {loadError.message}
                </div>
            )}
            
            {/*
              * The way out of a focused city. Bottom-centre rather than beside
              * the control stack: on a phone this has to be reachable with the
              * thumb that is already holding the device, and it sits above the
              * itinerary sheet so a half-open sheet never buries it.
              */}
            {isCityFocusMode && onClearSelection && (
                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[41] flex justify-center px-4">
                    <Button
                        type="button"
                        variant="floating"
                        size="sm"
                        onClick={onClearSelection}
                        data-testid="map-clear-city-focus"
                        data-floating-map-control="true"
                        className="pointer-events-auto rounded-full bg-card/95 ps-3 pe-4 text-xs font-semibold text-foreground shadow-lg backdrop-blur hover:border-accent-300 hover:bg-card hover:text-accent-700 dark:hover:border-accent-400/30 dark:hover:text-accent-200"
                        {...getAnalyticsDebugAttributes('trip_view__map_city_focus--clear', { surface: 'map_canvas' })}
                    >
                        <Route size={15} />
                        {t('tripView.mapCustomize.showWholeJourney')}
                    </Button>
                </div>
            )}

            {/* Controls */}
            <div data-floating-map-control="true" className="absolute top-4 end-4 z-[40] flex flex-col gap-2 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">
                    {onMapDockModeToggle && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={onMapDockModeToggle}
                            data-testid="map-dock-toggle-button"
                            data-floating-map-control="true"
                            className="rounded-lg"
                            aria-label={mapDockMode === 'docked' ? t('tripView.mapControls.minimizePreview') : t('tripView.mapControls.maximizePreview')}
                            {...getAnalyticsDebugAttributes(
                                mapDockMode === 'docked' ? 'trip_view__map_preview--minimize' : 'trip_view__map_preview--maximize',
                                { surface: 'map_controls' },
                            )}
                        >
                            {mapDockMode === 'docked' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            <span className="sr-only">{mapDockMode === 'docked' ? t('tripView.mapControls.minimizePreview') : t('tripView.mapControls.maximizePreview')}</span>
                        </Button>
                    )}
                    {showLayoutControls && onLayoutChange && (
                        <>
                            <Button
                                type="button"
                                variant="floating"
                                size="icon-lg"
                                onClick={() => onLayoutChange('vertical')}
                                className="rounded-lg"
                                aria-label={t('tripView.mapControls.layoutVertical')}
                                aria-pressed={layoutMode === 'vertical'}
                                {...getAnalyticsDebugAttributes('trip_view__layout_direction--vertical', { surface: 'map_controls' })}
                            ><ArrowUpDown size={18} /></Button>
                            <Button
                                type="button"
                                variant="floating"
                                size="icon-lg"
                                onClick={() => onLayoutChange('horizontal')}
                                className="rounded-lg"
                                aria-label={t('tripView.mapControls.layoutHorizontal')}
                                aria-pressed={layoutMode === 'horizontal'}
                                {...getAnalyticsDebugAttributes('trip_view__layout_direction--horizontal', { surface: 'map_controls' })}
                            ><ArrowLeftRight size={18} /></Button>
                        </>
                    )}

                    {onToggleExpanded && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={onToggleExpanded}
                            className="rounded-lg"
                            title={isExpanded ? t('tripView.mapControls.shrinkMap') : t('tripView.mapControls.expandMap')}
                            aria-label={isExpanded ? t('tripView.mapControls.shrinkMap') : t('tripView.mapControls.expandMap')}
                        >
                            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </Button>
                    )}

                    {userLocation.isOffered && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={handleUserLocationControl}
                            disabled={mapActionsDisabled}
                            data-testid="map-user-location-button"
                            data-floating-map-control="true"
                            data-out-of-view={isUserLocationOutOfView ? 'true' : undefined}
                            className={isUserLocationOutOfView
                                ? 'relative rounded-lg border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                                : 'relative rounded-lg'}
                            aria-label={userLocationControlLabel}
                            title={userLocationControlLabel}
                            {...getAnalyticsDebugAttributes(
                                userLocationFix ? 'trip_view__map_user_location--recenter' : 'trip_view__map_user_location--enable',
                                { surface: 'map_controls' },
                            )}
                        >
                            {userLocation.status === 'denied'
                                ? <LocateOff size={18} />
                                : userLocationFix
                                    ? <LocateFixed size={18} className={userLocation.status === 'locating' ? 'animate-pulse' : undefined} />
                                    : <Locate size={18} className={userLocation.status === 'locating' ? 'animate-pulse' : undefined} />}
                            {isUserLocationOutOfView && (
                                <span aria-hidden="true" className="absolute -top-1 -end-1 size-2.5 rounded-full border-2 border-card bg-blue-500" />
                            )}
                            <span className="sr-only">{userLocationControlLabel}</span>
                        </Button>
                    )}

                    <Button
                        type="button"
                        variant="floating"
                        size="icon-lg"
                        onClick={handleFit}
                        disabled={mapActionsDisabled}
                        className="rounded-lg"
                        aria-label={t('tripView.mapControls.fitToItinerary')}
                    ><Focus size={18} /></Button>
                    
                    {/*
                      * One button, one sheet. The popover this replaces was a
                      * 40px column of 10px labels holding style, route mode and
                      * colour — unreadable on a phone and with nowhere to put
                      * the settings the renderers already support.
                      */}
                    {onOpenCustomize && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={onOpenCustomize}
                            disabled={mapActionsDisabled}
                            data-testid="map-customize-button"
                            data-floating-map-control="true"
                            className="rounded-lg"
                            aria-label={customizeLabel}
                            aria-haspopup="dialog"
                            aria-expanded={isCustomizeOpen}
                            title={customizeLabel}
                            {...getAnalyticsDebugAttributes('trip_view__map_customize--open', { surface: 'map_controls' })}
                        >
                            <Layers size={18} />
                            <span className="sr-only">{customizeLabel}</span>
                        </Button>
                    )}
                    {!isPaywalled && onShowCityNamesChange && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={() => onShowCityNamesChange(!showCityNames)}
                            disabled={mapActionsDisabled}
                            className="rounded-lg"
                            aria-label={showCityNames ? t('tripView.mapControls.hideLabels') : t('tripView.mapControls.showLabels')}
                            aria-pressed={showCityNames}
                            title={showCityNames ? t('tripView.mapControls.hideLabels') : t('tripView.mapControls.showLabels')}
                            {...getAnalyticsDebugAttributes('trip_view__map_labels--toggle', {
                                surface: 'map_controls',
                                active: showCityNames,
                            })}
                        >
                            {showCityNames ? <TagsIcon size={18} /> : <Tag size={18} />}
                            <span className="sr-only">{showCityNames ? t('tripView.mapControls.hideLabels') : t('tripView.mapControls.showLabels')}</span>
                        </Button>
                    )}
                    {!isPaywalled && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={toggleActivityMarkers}
                            disabled={mapActionsDisabled}
                            className="rounded-lg"
                            aria-pressed={activityMarkersEnabled}
                            aria-label={activityMarkersEnabled ? t('tripView.mapControls.hideActivityMarkers') : t('tripView.mapControls.showActivityMarkers')}
                            title={activityMarkersEnabled ? t('tripView.mapControls.hideActivityMarkers') : t('tripView.mapControls.showActivityMarkers')}
                            {...getAnalyticsDebugAttributes('trip_view__map_activity_markers--toggle', {
                                surface: 'map_controls',
                                active: activityMarkersEnabled,
                            })}
                        >
                            <MapPinArea size={18} weight="bold" />
                            <span className="sr-only">{activityMarkersEnabled ? t('tripView.mapControls.hideActivityMarkers') : t('tripView.mapControls.showActivityMarkers')}</span>
                        </Button>
                    )}
                    {!isPaywalled && ideaLayerAvailable && (
                        <Button
                            type="button"
                            variant="floating"
                            size="icon-lg"
                            onClick={() => onShowIdeaMarkersChange?.(!showIdeaMarkers)}
                            disabled={mapActionsDisabled}
                            className="rounded-lg"
                            aria-pressed={showIdeaMarkers}
                            aria-label={showIdeaMarkers ? t('tripView.mapControls.hideIdeaMarkers') : t('tripView.mapControls.showIdeaMarkers')}
                            title={showIdeaMarkers ? t('tripView.mapControls.hideIdeaMarkers') : t('tripView.mapControls.showIdeaMarkers')}
                            data-testid="map-idea-markers-toggle"
                            {...getAnalyticsDebugAttributes('trip_view__map_idea_markers--toggle', {
                                surface: 'map_controls',
                                active: showIdeaMarkers,
                            })}
                        >
                            <Lightbulb size={18} />
                            <span className="sr-only">{showIdeaMarkers ? t('tripView.mapControls.hideIdeaMarkers') : t('tripView.mapControls.showIdeaMarkers')}</span>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
