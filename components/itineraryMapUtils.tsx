import React, { useCallback, useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { renderToStaticMarkup } from 'react-dom/server';
import type mapboxgl from 'mapbox-gl';
import { ActivityType, ITimelineItem, MapColorMode, MapStyle, RouteFailureReason, RouteMode, RouteStatus } from '../types';
import { ArrowLeftRight, ArrowUpDown, Focus, Layers, Maximize2, Minimize2 } from 'lucide-react';
import { MapPinArea } from '@phosphor-icons/react';
import { readLocalStorageItem, writeLocalStorageItem } from '../services/browserStorageService';
import { buildRouteCacheKey, DEFAULT_MAP_COLOR_MODE, findTravelBetweenCities, getHexFromColorClass, getNormalizedCityName, pickPrimaryActivityType } from '../utils';
import { getAnalyticsDebugAttributes } from '../services/analyticsService';
import { useGoogleMaps, useMapRuntime } from './GoogleMapsLoader';
import { normalizeTransportMode } from '../shared/transportModes';
import { ActivityTypeIcon, getActivityTypePaletteParts } from './ActivityTypeVisuals';
import { getMapSurfaceBackgroundColor, GOOGLE_BASEMAP_HIDDEN_STYLES } from '../services/mapRendererVisualStyleService';
import { isMapboxStyleReadyForRuntimeMutations } from './maps/mapboxBasemapUtils';
import { buildFlightRouteVisualPaths } from './maps/flightRouteGeometry';
import { collectTripMapFitBoundsCoordinates } from './maps/tripMapFitBoundsGeometry';
import { createGoogleMixedSurfaceController, type GoogleMixedSurfaceController } from './maps/googleMixedSurfaceController';
import { buildTripMapCityMarkerHtml } from './maps/tripMapCityMarkerHtml';
import { resolveTripMapCityMarkerImageUrl } from './maps/tripMapCityMarkerMedia';
import {
    buildTripMapCityLabelOverlayDescriptors,
    buildTripMapCityOverlayDescriptors,
    buildTripMapCoordinateGroupKey,
    buildOverlappingMarkerPosition,
    getMapLabelCityName,
    offsetLatLngByMeters,
    resolveTripMapCityLabelName,
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
import { buildMapboxDashedRouteDasharray, createMapboxLineHandle, createMapboxOverlayMarker, type MapboxLineLayerConfig } from './maps/mapboxOverlayRuntime';
import {
    resolveTripMapCityLabelOffsetPx,
    resolveTripMapDarkRoutePresentation,
    resolveTripMapFlightCurveOptions,
    resolveTripMapFlightGroundShadowStyle,
    type TripMapCityLabelAnchor,
} from './maps/tripMapProviderPresentation';
import { resolveActiveOverlayMapTarget, shouldHideGoogleMapCanvas } from './maps/mapRenderTarget';
import {
    getTripMapProviderTuning,
    resolveTripMapSelectionSafeInsetRatio,
    resolveTripMapViewportPadding,
} from './maps/tripMapProviderTuning';
import { GOOGLE_ROUTES_COMPUTE_FIELDS, computeGoogleRouteLeg, loadGoogleRouteRuntime } from '../services/routeService';
import { isFiniteLatLngLiteral } from '../shared/coordinateUtils';
import type { MapImplementation } from '../shared/mapRuntime';

interface ItineraryMapProps {
    items: ITimelineItem[];
    selectedItemId?: string | null;
    onCityMarkerSelect?: (cityId: string) => void;
    onActivityMarkerSelect?: (activityId: string) => void;
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
}

const MAP_STYLES = {
    // "Pale Dawn" - Very clean, grayscale, high contrast for overlays
    minimal: [
        { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
        { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#9aa6b2" }, { "weight": 1.4 }, { "visibility": "on" }] },
        { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#d5dce3" }, { "weight": 0.5 }] },
        { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
        { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
        { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
        { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
        { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
        { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
        { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
    ],
    standard: [], 
    dark: [
        { "elementType": "geometry", "stylers": [{ "color": "#1b2230" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b2230" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#d0d8e2" }] },
        {
            "featureType": "administrative.locality",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#f3c98b" }]
        },
        {
            "featureType": "administrative.country",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#9fb3c8" }, { "weight": 1.2 }, { "visibility": "on" }]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#8fb3c0" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{ "color": "#1a3b3a" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#8bc2b3" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{ "color": "#3a4558" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#243246" }]
        },
        {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#d5dde8" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [{ "color": "#566579" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#2f3c4f" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#f7ddb0" }]
        },
        {
            "featureType": "transit",
            "elementType": "geometry",
            "stylers": [{ "color": "#34506b" }]
        },
        {
            "featureType": "transit.station",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#9fc6e5" }]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#0b3f5f" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#b7d5ea" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#0b3f5f" }]
        }
    ],
    clean: [
        { "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f9f9f9" }, { "weight": 2 }] },
        { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
        { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#a8a8a8" }, { "weight": 1 }, { "visibility": "on" }] },
        { "featureType": "administrative.province", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
        { "featureType": "administrative.province", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
        { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road", "stylers": [{ "visibility": "off" }] },
        { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#dcefff" }] }, // Higher-contrast water fill
        { "featureType": "landscape.natural", "elementType": "geometry.stroke", "stylers": [{ "color": "#a7c9e6" }, { "weight": 1.4 }, { "visibility": "on" }] },
        { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
    ],
    cleanDark: [
        { "elementType": "geometry", "stylers": [{ "color": "#1b2230" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] },
        { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
        { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#8ea3b7" }, { "weight": 1.2 }, { "visibility": "on" }] },
        { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "visibility": "on" }, { "color": "#6f8193" }] },
        { "featureType": "administrative.country", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "on" }, { "color": "#1b2230" }, { "weight": 1.25 }] },
        { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "visibility": "off" }] },
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "featureType": "road", "stylers": [{ "visibility": "off" }] },
        { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0b3f5f" }] },
        { "featureType": "landscape.natural", "elementType": "geometry.stroke", "stylers": [{ "color": "#2d3f52" }, { "weight": 1.25 }, { "visibility": "on" }] },
        { "featureType": "water", "elementType": "labels", "stylers": [{ "visibility": "off" }] }
    ]
};

type RouteCacheEntry = {
    status: 'ok' | 'failed';
    updatedAt: number;
    path?: google.maps.LatLngLiteral[];
    distanceKm?: number;
    durationHours?: number;
    reason?: RouteFailureReason;
};

type OverlayMarkerUpdate = {
    html?: string;
    position?: google.maps.LatLngLiteral;
    zIndex?: number;
};

type OverlayMarkerHandle = {
    setMap: (map: unknown | null) => void;
    update: (updates: OverlayMarkerUpdate) => void;
};

const ROUTE_CACHE = new Map<string, RouteCacheEntry>();
export const ROUTE_FAILURE_TTL_MS = 5 * 60 * 1000;
const ROUTE_STORAGE_KEY = 'tf_route_cache_v1';
export const ROUTE_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;
const ROUTE_FAILURE_WARNING_TTL_MS = 2 * 60 * 1000;
const RECENT_ROUTE_FAILURE_WARNINGS = new Map<string, number>();
let routeCacheHydrated = false;

const ROUTE_OUTER_OUTLINE_COLOR = '#f8fafc';
const ROUTE_MINIMAL_GAP_COLOR = '#f5f5f5';
const ROUTE_CLEAN_GAP_COLOR = '#ffffff';
const ROUTE_STANDARD_GAP_COLOR = '#eef2f7';
const ROUTE_DARK_GAP_COLOR = '#1b2230';
const ROUTE_CLEAN_DARK_GAP_COLOR = '#1b2230';
const EARTH_RADIUS_KM = 6371;
const ACTIVITY_MARKER_OVERLAP_RADIUS_METERS = 260;
const ACTIVITY_CITY_FALLBACK_MIN_SLOTS = 4;
const MARKER_COORDINATE_GROUP_PRECISION = 5;
const MARKER_TIER_ROUTE_REFERENCE_ZOOM = 10;
const MARKER_GAP_DEDUPE_PRECISION = 6;
export const MAP_VIEWPORT_READY_MIN_DIMENSION_PX = 80;
export const MAX_WALK_ROUTE_CHECK_KM = 60;
export const MAX_BICYCLE_ROUTE_CHECK_KM = 160;
export const MAX_TRANSIT_ROUTE_CHECK_KM = 1400;
export const MAX_DRIVING_ROUTE_CHECK_KM = 3000;
export const TRANSIT_SECOND_PASS_MAX_KM = 320;
export const TRANSIT_DRIVING_RETRY_MAX_KM = TRANSIT_SECOND_PASS_MAX_KM;
export const ROUTES_COMPUTE_FIELDS = GOOGLE_ROUTES_COMPUTE_FIELDS;
export type RouteApiMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
export type RouteAttemptPolicy = {
    shouldAttempt: boolean;
    modes: RouteApiMode[];
    reason?: 'unsupported_mode' | 'invalid_distance' | 'distance_cap_exceeded';
};

const TRANSPORT_ICON_PATHS: Record<string, string> = {
    plane: 'M240,136v32a8,8,0,0,1-8,8,7.61,7.61,0,0,1-1.57-.16L156,161v23.73l17.66,17.65A8,8,0,0,1,176,208v24a8,8,0,0,1-11,7.43l-37-14.81L91,239.43A8,8,0,0,1,80,232V208a8,8,0,0,1,2.34-5.66L100,184.69V161L25.57,175.84A7.61,7.61,0,0,1,24,176a8,8,0,0,1-8-8V136a8,8,0,0,1,4.42-7.16L100,89.06V44a28,28,0,0,1,56,0V89.06l79.58,39.78A8,8,0,0,1,240,136Z',
    bus: 'M254.07,106.79,208.53,53.73A16,16,0,0,0,196.26,48H32A16,16,0,0,0,16,64V176a16,16,0,0,0,16,16H49a32,32,0,0,0,62,0h50a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V112A8,8,0,0,0,254.07,106.79ZM32,104V64H88v40Zm48,96a16,16,0,1,1,16-16A16,16,0,0,1,80,200Zm80-96H104V64h56Zm32,96a16,16,0,1,1,16-16A16,16,0,0,1,192,200Zm-16-96V64h20.26l34.33,40Z',
    car: 'M240,112H211.31L168,68.69A15.86,15.86,0,0,0,156.69,64H44.28A16,16,0,0,0,31,71.12L1.34,115.56A8.07,8.07,0,0,0,0,120v48a16,16,0,0,0,16,16H33a32,32,0,0,0,62,0h66a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V128A16,16,0,0,0,240,112ZM44.28,80H156.69l32,32H23ZM64,192a16,16,0,1,1,16-16A16,16,0,0,1,64,192Zm128,0a16,16,0,1,1,16-16A16,16,0,0,1,192,192Z',
    motorcycle: 'M216,120a41,41,0,0,0-6.6.55l-5.82-15.14A55.64,55.64,0,0,1,216,104a8,8,0,0,0,0-16H196.88L183.47,53.13A8,8,0,0,0,176,48H144a8,8,0,0,0,0,16h26.51l9.23,24H152c-18.5,0-33.5,4.31-43.37,12.46a16,16,0,0,1-16.76,2.07c-10.58-4.81-73.29-30.12-73.8-30.26a8,8,0,0,0-5,15.19S68.57,109.4,79.6,120.4A55.67,55.67,0,0,1,95.43,152H79.2a40,40,0,1,0,0,16h52.12a31.91,31.91,0,0,0,30.74-23.1,56,56,0,0,1,26.59-33.72l5.82,15.13A40,40,0,1,0,216,120ZM40,168H62.62a24,24,0,1,1,0-16H40a8,8,0,0,0,0,16Zm176,16a24,24,0,0,1-15.58-42.23l8.11,21.1a8,8,0,1,0,14.94-5.74L215.35,136l.65,0a24,24,0,0,1,0,48Z',
    train: 'M184,24H72A32,32,0,0,0,40,56V184a32,32,0,0,0,32,32h8L65.6,235.2a8,8,0,1,0,12.8,9.6L100,216h56l21.6,28.8a8,8,0,1,0,12.8-9.6L176,216h8a32,32,0,0,0,32-32V56A32,32,0,0,0,184,24ZM84,184a12,12,0,1,1,12-12A12,12,0,0,1,84,184Zm36-64H56V80h64Zm52,64a12,12,0,1,1,12-12A12,12,0,0,1,172,184Zm28-64H136V80h64Z',
    bicycle: 'M136,52a28,28,0,1,1,28,28A28,28,0,0,1,136,52ZM240,176a40,40,0,1,1-40-40A40,40,0,0,1,240,176Zm-16,0a24,24,0,1,0-24,24A24,24,0,0,0,224,176Zm-24-64a8,8,0,0,0-8-8H155.31L125.66,74.34a8,8,0,0,0-11.32,0l-32,32a8,8,0,0,0,0,11.32L120,155.31V200a8,8,0,0,0,16,0V152a8,8,0,0,0-2.34-5.66L99.31,112,120,91.31l26.34,26.35A8,8,0,0,0,152,120h40A8,8,0,0,0,200,112ZM96,176a40,40,0,1,1-40-40A40,40,0,0,1,96,176Zm-16,0a24,24,0,1,0-24,24A24,24,0,0,0,80,176Z',
    boat: 'M160,140V72.85a4,4,0,0,1,7-2.69l55,60.46a8,8,0,0,1,.43,10.26,8.24,8.24,0,0,1-6.58,3.12H164A4,4,0,0,1,160,140Zm87.21,32.53A8,8,0,0,0,240,168H144V8a8,8,0,0,0-14.21-5l-104,128A8,8,0,0,0,32,144h96v24H16a8,8,0,0,0-6.25,13l29.6,37a15.93,15.93,0,0,0,12.49,6H204.16a15.93,15.93,0,0,0,12.49-6l29.6-37A8,8,0,0,0,247.21,172.53Z',
    walk: 'M216.06,192v12A36,36,0,0,1,144,204V192a8,8,0,0,1,8-8h56A8,8,0,0,1,216.06,192ZM104,160h-56a8,8,0,0,0-8,8v12A36,36,0,0,0,112,180V168A8,8,0,0,0,104,160ZM76,16C64.36,16,53.07,26.31,44.2,45c-13.93,29.38-18.56,73,.29,96a8,8,0,0,0,6.2,2.93h50.55a8,8,0,0,0,6.2-2.93c18.85-23,14.22-66.65.29-96C98.85,26.31,87.57,16,76,16Zm78.8,152h50.55a8,8,0,0,0,6.2-2.93c18.85-23,14.22-66.65.29-96C202.93,50.31,191.64,40,180,40s-22.89,10.31-31.77,29c-13.93,29.38-18.56,73,.29,96A8,8,0,0,0,154.76,168Z',
};

const resolveTransportIconPath = (mode?: string): string => {
    const normalized = normalizeTransportMode(mode);
    if (normalized === 'na' || !normalized) return TRANSPORT_ICON_PATHS.walk;
    if (normalized === 'bike') return TRANSPORT_ICON_PATHS.bicycle;
    if (normalized === 'motorcycle') return TRANSPORT_ICON_PATHS.motorcycle;
    if (normalized in TRANSPORT_ICON_PATHS) {
        return TRANSPORT_ICON_PATHS[normalized as keyof typeof TRANSPORT_ICON_PATHS];
    }
    return TRANSPORT_ICON_PATHS.walk;
};

const CITY_PIN_SELECTED_OUTLINE_FALLBACK = '#3b82f6';
const CITY_PIN_SELECTED_RING_FALLBACK = '#bfdbfe';
const TRANSPORT_MARKER_VIEWBOX_SIZE = 256;
const CITY_MARKER_Z_INDEX = 320;
const CITY_MARKER_SELECTED_Z_INDEX = 340;
const ACTIVITY_MARKER_Z_INDEX = 240;
const ACTIVITY_MARKER_SELECTED_Z_INDEX = 260;
export const ACTIVITY_MARKERS_MIN_ZOOM = getTripMapProviderTuning('google').markers.activityMinZoom;

const resolveCityMarkerZIndex = (
    isSelected: boolean,
    profile: MarkerRenderProfile,
): number => {
    const base = isSelected ? CITY_MARKER_SELECTED_Z_INDEX : CITY_MARKER_Z_INDEX;
    const size = isSelected ? profile.city.selectedSize : profile.city.size;
    return base + Math.max(0, Math.round(size / 2));
};

type MarkerRenderProfile = {
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
type CityMarkerRenderProfile = MarkerRenderProfile['city'];

const DOCKED_DEFAULT_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
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

const FLOATING_DEFAULT_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
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

const COMPACT_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
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

const MICRO_MARKER_RENDER_PROFILE: MarkerRenderProfile = {
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

const toWebMercatorPixel = (
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

const resolveCssColorVar = (name: string, fallback: string): string => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
};

const normalizeRotationDegrees = (value?: number): number => {
    if (!Number.isFinite(value)) return 0;
    const normalized = (value as number) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
};

export const mapRouteAttemptPolicyReasonToFailureReason = (
    reason?: RouteAttemptPolicy['reason'],
): RouteFailureReason => {
    if (reason === 'unsupported_mode') return 'unsupported_mode';
    if (reason === 'distance_cap_exceeded') return 'distance_cap_exceeded';
    if (reason === 'invalid_distance') return 'invalid_distance';
    return 'request_error';
};

export const classifyRouteComputationError = (error: unknown): RouteFailureReason => {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : '';
    const normalized = message.toUpperCase();

    if (normalized.includes('ZERO_RESULTS') || normalized.includes('NO ROUTE COULD BE FOUND')) {
        return 'zero_results';
    }
    if (normalized.includes('NO ROUTE PATH RETURNED')) {
        return 'no_route_path';
    }
    if (normalized.includes('ROUTE PATH IS STRAIGHT')) {
        return 'straight_path';
    }
    if (normalized.includes('ROUTES API UNAVAILABLE')) {
        return 'api_unavailable';
    }
    return 'request_error';
};

export const shouldLogRouteFailureWarning = ({
    routeKey,
    mode,
    reason,
    nowMs = Date.now(),
}: {
    routeKey: string;
    mode: string;
    reason: RouteFailureReason;
    nowMs?: number;
}): boolean => {
    const warningKey = `${routeKey}::${mode}::${reason}`;
    const previous = RECENT_ROUTE_FAILURE_WARNINGS.get(warningKey);
    if (typeof previous === 'number' && nowMs - previous < ROUTE_FAILURE_WARNING_TTL_MS) {
        return false;
    }
    RECENT_ROUTE_FAILURE_WARNINGS.set(warningKey, nowMs);
    return true;
};

const buildTransportMarkerHtml = (
    mode: string | undefined,
    color: string | undefined,
    rotationDegrees: number | undefined,
    profile: MarkerRenderProfile,
): string => {
    const size = profile.transport.size;
    const badgeColor = color || '#1f2937';
    const iconPath = resolveTransportIconPath(mode);
    const rotation = mode === 'plane' ? normalizeRotationDegrees(rotationDegrees) : 0;
    const iconInset = (TRANSPORT_MARKER_VIEWBOX_SIZE * (1 - profile.transport.iconScale)) / 2;
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${TRANSPORT_MARKER_VIEWBOX_SIZE} ${TRANSPORT_MARKER_VIEWBOX_SIZE}">
            <circle cx="128" cy="128" r="112" fill="${badgeColor}" />
            <g transform="rotate(${rotation} 128 128)">
                <g transform="translate(${iconInset} ${iconInset}) scale(${profile.transport.iconScale})">
                    <path d="${iconPath}" fill="#ffffff" />
                </g>
            </g>
        </svg>
    `;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return `
        <div style="width:${size}px;height:${size}px;line-height:1;user-select:none;">
            <img src="${url}" alt="" draggable="false" style="display:block;width:${size}px;height:${size}px;pointer-events:none;" />
        </div>
    `;
};

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

const isDarkMapStyle = (style: MapStyle): boolean =>
    style === 'dark' || style === 'cleanDark';

export const estimateGreatCircleDistanceKm = (
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
): number => {
    const toRadians = (value: number) => value * (Math.PI / 180);
    const dLat = toRadians(end.lat - start.lat);
    const dLng = toRadians(end.lng - start.lng);
    const startLat = toRadians(start.lat);
    const endLat = toRadians(end.lat);

    const haversine = (
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    );
    const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return EARTH_RADIUS_KM * angularDistance;
};

export const computeMaxPathDeviationMeters = (
    path: google.maps.LatLngLiteral[],
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
): number => {
    if (path.length < 3) return 0;

    const meanLatRadians = ((start.lat + end.lat) / 2) * (Math.PI / 180);
    const metersPerDegreeLat = 111_320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.max(0.01, Math.cos(meanLatRadians));
    const toProjected = (point: google.maps.LatLngLiteral) => ({
        x: point.lng * metersPerDegreeLng,
        y: point.lat * metersPerDegreeLat,
    });

    const startProjected = toProjected(start);
    const endProjected = toProjected(end);
    const dx = endProjected.x - startProjected.x;
    const dy = endProjected.y - startProjected.y;
    const denominator = (dx * dx) + (dy * dy);
    if (denominator <= 0) return 0;

    let maxDeviation = 0;
    for (let index = 1; index < path.length - 1; index += 1) {
        const point = toProjected(path[index]);
        const projectionFactor = ((point.x - startProjected.x) * dx + (point.y - startProjected.y) * dy) / denominator;
        const clampedFactor = Math.max(0, Math.min(1, projectionFactor));
        const projectedX = startProjected.x + (clampedFactor * dx);
        const projectedY = startProjected.y + (clampedFactor * dy);
        const deviation = Math.hypot(point.x - projectedX, point.y - projectedY);
        if (deviation > maxDeviation) {
            maxDeviation = deviation;
        }
    }

    return maxDeviation;
};

export const isRoutePathLikelyStraight = (
    path: google.maps.LatLngLiteral[],
    start: google.maps.LatLngLiteral,
    end: google.maps.LatLngLiteral,
    mode: string,
): boolean => {
    const modeRequiresHigherShapeFidelity = mode === 'bus' || mode === 'train';
    const minimumPathPointCount = modeRequiresHigherShapeFidelity ? 4 : 3;
    if (path.length < minimumPathPointCount) return true;

    const straightMeters = estimateGreatCircleDistanceKm(start, end) * 1000;
    if (!Number.isFinite(straightMeters) || straightMeters <= 0) return true;

    let pathMeters = 0;
    for (let idx = 1; idx < path.length; idx++) {
        pathMeters += estimateGreatCircleDistanceKm(path[idx - 1], path[idx]) * 1000;
    }

    const ratio = pathMeters / straightMeters;
    const minimumDetourRatio = modeRequiresHigherShapeFidelity ? 1.05 : 1.015;
    const minimumDeviationMeters = Math.max(
        modeRequiresHigherShapeFidelity ? 550 : 450,
        Math.min(modeRequiresHigherShapeFidelity ? 8_500 : 3_500, straightMeters * (modeRequiresHigherShapeFidelity ? 0.022 : 0.015)),
    );
    const maxDeviationMeters = computeMaxPathDeviationMeters(path, start, end);

    const hasStraightLikeDetour = ratio > 0 && ratio < minimumDetourRatio;
    const hasStraightLikeShape = maxDeviationMeters < minimumDeviationMeters;
    return hasStraightLikeDetour || hasStraightLikeShape;
};

const ACTIVITY_ICON_MARKUP_CACHE = new Map<string, string>();

const escapeHtml = (value: string): string => (
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
);

const buildActivityIconMarkup = (type: ActivityType, iconSize: number): string => {
    const cacheKey = `${type}:${iconSize}`;
    const cached = ACTIVITY_ICON_MARKUP_CACHE.get(cacheKey);
    if (cached) return cached;
    const markup = renderToStaticMarkup(
        <ActivityTypeIcon type={type} size={iconSize} />
    );
    const styled = markup.replace(
        '<svg',
        `<svg style="width:${iconSize}px;height:${iconSize}px;display:block;stroke:currentColor;stroke-width:2.3;color:currentColor;fill:none;"`,
    );
    ACTIVITY_ICON_MARKUP_CACHE.set(cacheKey, styled);
    return styled;
};

const buildActivityMarkerHtml = (
    type: ActivityType,
    isSelected: boolean,
    title: string | undefined,
    profile: MarkerRenderProfile,
): string => {
    const size = isSelected
        ? profile.activity.size + profile.activity.selectedBoost
        : profile.activity.size;
    const palette = getActivityTypePaletteParts(type);
    const selectedOutlineColor = resolveCssColorVar('--tf-accent-500', '#2563eb');
    const iconMarkup = buildActivityIconMarkup(type, profile.activity.iconSize);
    const tooltipLabel = typeof title === 'string' && title.trim().length > 0
        ? escapeHtml(title.trim())
        : '';
    const tooltipMarkup = tooltipLabel
        ? `<div data-role="activity-marker-tooltip" style="position:absolute;inset:auto auto 100% 50%;transform:translate(-50%, calc(-100% - 8px));pointer-events:none;opacity:0;transition:opacity 140ms ease, transform 140ms ease;z-index:30;white-space:nowrap;background:rgba(15,23,42,0.95);color:#f8fafc;border-radius:9999px;padding:${profile.activity.tooltipPaddingY}px ${profile.activity.tooltipPaddingX}px;font-size:${profile.activity.tooltipFontSize}px;font-weight:600;letter-spacing:0.01em;box-shadow:0 8px 24px rgba(15,23,42,0.24);backdrop-filter:blur(6px);">${tooltipLabel}</div>`
        : '';

    return `
        <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;line-height:1;user-select:none;">
            <div class="${palette.bg} ${palette.border}" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;border-width:2px;border-style:solid;box-shadow:${isSelected ? `0 0 0 2px ${selectedOutlineColor}` : 'none'};">
                <div class="${palette.text}" style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;">${iconMarkup}</div>
            </div>
            ${tooltipMarkup}
        </div>
    `;
};

type ResolvedActivityMarker = {
    id: string;
    title: string;
    type: ActivityType;
    baseCoordinates: google.maps.LatLngLiteral;
    position: google.maps.LatLngLiteral;
    coordinateSource: 'activity' | 'city';
};

const resolveActivityOwnerCity = (
    activity: ITimelineItem,
    cityItems: ITimelineItem[],
): ITimelineItem | null => {
    const directOwner = cityItems.find((city) => (
        activity.startDateOffset >= city.startDateOffset
        && activity.startDateOffset < city.startDateOffset + Math.max(city.duration, 0)
    ));
    if (directOwner) return directOwner;

    const previousCity = [...cityItems].reverse().find((city) => city.startDateOffset <= activity.startDateOffset);
    if (previousCity) return previousCity;
    return cityItems[0] || null;
};

export const resolveActivityMarkerPositions = (
    items: ITimelineItem[],
): ResolvedActivityMarker[] => {
    const cityItems = items
        .filter((item): item is ITimelineItem => item.type === 'city' && isFiniteLatLngLiteral(item.coordinates))
        .sort((left, right) => left.startDateOffset - right.startDateOffset);
    const activities = items
        .filter((item): item is ITimelineItem => item.type === 'activity')
        .sort((left, right) => {
            if (left.startDateOffset !== right.startDateOffset) return left.startDateOffset - right.startDateOffset;
            return left.title.localeCompare(right.title);
        });

    const candidates: Array<{
        id: string;
        title: string;
        type: ActivityType;
        baseCoordinates: google.maps.LatLngLiteral;
        coordinateSource: 'activity' | 'city';
    }> = [];
    for (const activity of activities) {
        const activityCoordinates = isFiniteLatLngLiteral(activity.coordinates) ? activity.coordinates : null;
        const ownerCity = activityCoordinates ? null : resolveActivityOwnerCity(activity, cityItems);
        const baseCoordinates = activityCoordinates || ownerCity?.coordinates || null;
        if (!isFiniteLatLngLiteral(baseCoordinates)) continue;
        const primaryType = pickPrimaryActivityType(activity.activityType);
        candidates.push({
            id: activity.id,
            title: activity.title,
            type: primaryType,
            baseCoordinates,
            coordinateSource: activityCoordinates ? 'activity' : 'city',
        });
    }

    const groupedByCoordinates = new Map<string, number[]>();
    candidates.forEach((candidate, index) => {
        const key = buildTripMapCoordinateGroupKey(candidate.baseCoordinates, MARKER_COORDINATE_GROUP_PRECISION);
        if (!key) return;
        const grouped = groupedByCoordinates.get(key) ?? [];
        grouped.push(index);
        groupedByCoordinates.set(key, grouped);
    });

    return candidates.map((candidate, index) => {
        const key = buildTripMapCoordinateGroupKey(candidate.baseCoordinates, MARKER_COORDINATE_GROUP_PRECISION);
        const grouped = key ? (groupedByCoordinates.get(key) ?? []) : [];
        const overlapIndex = Math.max(0, grouped.indexOf(index));
        const overlapCount = candidate.coordinateSource === 'city'
            ? Math.max(ACTIVITY_CITY_FALLBACK_MIN_SLOTS, grouped.length)
            : grouped.length;
        const position = buildOverlappingMarkerPosition(
            candidate.baseCoordinates,
            overlapIndex,
            overlapCount,
            ACTIVITY_MARKER_OVERLAP_RADIUS_METERS,
        );
        return {
            ...candidate,
            position,
        };
    });
};

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
}): { position: google.maps.LatLngLiteral; zoom: number } | null => {
    const selectionTuning = getTripMapProviderTuning(provider).selection;
    if (selectedActivityId) {
        const activityPosition = activityMarkerPositions.get(selectedActivityId);
        if (activityPosition) {
            return { position: activityPosition, zoom: selectionTuning.activityFocusZoom };
        }
    }
    if (selectedCityId) {
        const selectedCity = cities.find((item) => item.id === selectedCityId);
        if (selectedCity?.coordinates) {
            return {
                position: { lat: selectedCity.coordinates.lat, lng: selectedCity.coordinates.lng },
                zoom: selectionTuning.cityFocusZoom,
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
}: {
    isTargetVisible: boolean;
    isTargetWithinSafeZone?: boolean;
    currentZoom: number | null;
    targetZoom: number;
}): { shouldPan: boolean; shouldZoom: boolean } => {
    const isTargetComfortablyVisible = isTargetWithinSafeZone ?? isTargetVisible;
    const shouldZoom = currentZoom === null || currentZoom < targetZoom;
    const shouldPan = !isTargetComfortablyVisible || shouldZoom;
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

export {
    buildOverlappingMarkerPosition,
    getMapLabelCityName,
    offsetLatLngByMeters,
    resolveTripMapCityLabelName,
};

export type CityLabelAnchor = TripMapCityLabelAnchor;
export const resolveCityLabelPlacement = resolveTripMapCityLabelPlacement;
export const resolveCityLabelTheme = resolveTripMapCityLabelTheme;

export const resolveCityLabelAnchor = (
    _city: google.maps.LatLngLiteral,
    _previous?: google.maps.LatLngLiteral | null,
    _next?: google.maps.LatLngLiteral | null,
): CityLabelAnchor => {
    return 'above';
};

export const buildRouteAttemptPolicy = (
    mode: string,
    straightDistanceKm: number,
): RouteAttemptPolicy => {
    if (!Number.isFinite(straightDistanceKm) || straightDistanceKm <= 0) {
        return { shouldAttempt: false, modes: [], reason: 'invalid_distance' };
    }

    switch (mode) {
        case 'walk':
            return straightDistanceKm <= MAX_WALK_ROUTE_CHECK_KM
                ? { shouldAttempt: true, modes: ['WALKING'] }
                : { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
        case 'bicycle':
            return straightDistanceKm <= MAX_BICYCLE_ROUTE_CHECK_KM
                ? { shouldAttempt: true, modes: ['BICYCLING'] }
                : { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
        case 'train':
        case 'bus':
            if (straightDistanceKm > MAX_TRANSIT_ROUTE_CHECK_KM) {
                return { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
            }
            if (straightDistanceKm <= TRANSIT_SECOND_PASS_MAX_KM) {
                // Second pass stays in TRANSIT mode but drops strict train/bus submode filters.
                return { shouldAttempt: true, modes: ['TRANSIT', 'TRANSIT'] };
            }
            return { shouldAttempt: true, modes: ['TRANSIT'] };
        case 'car':
        case 'motorcycle':
            return straightDistanceKm <= MAX_DRIVING_ROUTE_CHECK_KM
                ? { shouldAttempt: true, modes: ['DRIVING'] }
                : { shouldAttempt: false, modes: [], reason: 'distance_cap_exceeded' };
        default:
            return { shouldAttempt: false, modes: [], reason: 'unsupported_mode' };
    }
};

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

export const filterHydratedRouteCacheEntries = (
    parsed: unknown,
    now: number,
): Array<[string, RouteCacheEntry]> => {
    if (!parsed || typeof parsed !== 'object') return [];
    const entries = parsed as Record<string, RouteCacheEntry>;
    return Object.entries(entries).filter(([, entry]) => {
        if (!entry || !entry.updatedAt || !entry.status) return false;
        if (entry.status === 'failed' && now - entry.updatedAt > ROUTE_FAILURE_TTL_MS) return false;
        if (now - entry.updatedAt > ROUTE_PERSIST_TTL_MS) return false;
        return true;
    });
};

export const buildPersistedRouteCachePayload = (
    routeCache: Map<string, RouteCacheEntry>,
    now: number,
): Record<string, RouteCacheEntry> => {
    const payload: Record<string, RouteCacheEntry> = {};
    routeCache.forEach((entry, key) => {
        if (!entry || !entry.updatedAt || !entry.status) return;
        if (entry.status === 'failed') {
            if (now - entry.updatedAt <= ROUTE_FAILURE_TTL_MS) {
                payload[key] = {
                    status: 'failed',
                    updatedAt: entry.updatedAt,
                    reason: entry.reason,
                };
            }
            return;
        }
        if (now - entry.updatedAt <= ROUTE_PERSIST_TTL_MS) {
            payload[key] = entry;
        }
    });
    return payload;
};
