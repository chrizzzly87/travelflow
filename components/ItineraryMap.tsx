import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { ITimelineItem, MapColorMode, MapStyle, RouteFailureReason, RouteMode, RouteStatus } from '../types';
import { ArrowLeftRight, ArrowUpDown, Focus, Layers, Maximize2, Minimize2 } from 'lucide-react';
import { readLocalStorageItem, writeLocalStorageItem } from '../services/browserStorageService';
import { buildRouteCacheKey, DEFAULT_MAP_COLOR_MODE, findTravelBetweenCities, getHexFromColorClass, getNormalizedCityName } from '../utils';
import { getAnalyticsDebugAttributes } from '../services/analyticsService';
import { useGoogleMaps } from './GoogleMapsLoader';
import { normalizeTransportMode } from '../shared/transportModes';

interface ItineraryMapProps {
    items: ITimelineItem[];
    selectedItemId?: string | null;
    onCityMarkerSelect?: (cityId: string) => void;
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
    setMap: (map: google.maps.Map | null) => void;
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
const MARKER_OVERLAP_RADIUS_METERS = 420;
const MARKER_COORDINATE_GROUP_PRECISION = 5;
export const MAP_VIEWPORT_READY_MIN_DIMENSION_PX = 80;
export const MAX_WALK_ROUTE_CHECK_KM = 60;
export const MAX_BICYCLE_ROUTE_CHECK_KM = 160;
export const MAX_TRANSIT_ROUTE_CHECK_KM = 1400;
export const MAX_DRIVING_ROUTE_CHECK_KM = 3000;
export const TRANSIT_SECOND_PASS_MAX_KM = 320;
export const TRANSIT_DRIVING_RETRY_MAX_KM = TRANSIT_SECOND_PASS_MAX_KM;
export const ROUTES_COMPUTE_FIELDS = [
    'path',
    'distanceMeters',
    'durationMillis',
] as const;
const ROUTES_COMPUTE_MINIMAL_FIELDS = ['path'] as const;
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
const TRANSPORT_MARKER_BADGE_SIZE = 40;
const TRANSPORT_MARKER_ICON_SCALE = 0.46;
const TRANSPORT_MARKER_VIEWBOX_SIZE = 256;
const TRANSPORT_MARKER_ICON_INSET = (TRANSPORT_MARKER_VIEWBOX_SIZE * (1 - TRANSPORT_MARKER_ICON_SCALE)) / 2;

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

const isRoutesFieldMaskError = (error: unknown): boolean => {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : '';
    return /property fields/i.test(message) || /contains invalid fields/i.test(message) || /field mask/i.test(message);
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

const buildCityMarkerSvgDataUrl = (
    color: string,
    isSelected: boolean,
): { url: string; size: number } => {
    const size = isSelected ? 54 : 44;
    const pinStroke = isSelected ? resolveCssColorVar('--tf-accent-500', CITY_PIN_SELECTED_OUTLINE_FALLBACK) : '#ffffff';
    const ringStroke = isSelected ? resolveCssColorVar('--tf-accent-200', CITY_PIN_SELECTED_RING_FALLBACK) : '#dbe3ee';
    const halo = isSelected ? 0.24 : 0.1;
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
            <g transform="translate(4 2)">
                <ellipse cx="12" cy="26.2" rx="6.4" ry="2.8" fill="#0f172a" opacity="0.16" />
                <path d="M12 0.9c-5.9 0-10.7 4.8-10.7 10.7 0 7.9 10.7 17.8 10.7 17.8s10.7-9.9 10.7-17.8C22.7 5.7 17.9 0.9 12 0.9z" fill="${color}" stroke="${pinStroke}" stroke-width="${isSelected ? 1.9 : 1.5}" />
                <circle cx="12" cy="11.6" r="${isSelected ? '8.5' : '7.8'}" fill="${color}" opacity="${halo}" />
                <circle cx="12" cy="11.6" r="${isSelected ? '6.3' : '5.8'}" fill="#ffffff" stroke="${ringStroke}" stroke-width="${isSelected ? '1.55' : '1.25'}" />
            </g>
        </svg>
    `;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return { url, size };
};

const buildCityMarkerHtml = (index: number, color: string, isSelected: boolean): string => {
    const { url, size } = buildCityMarkerSvgDataUrl(color, isSelected);
    const fontSize = isSelected ? 13 : 12;
    const numberTopPercent = isSelected ? 45 : 45.3;
    return `
        <div style="position:relative;width:${size}px;height:${size}px;line-height:1;user-select:none;">
            <img src="${url}" alt="" draggable="false" style="display:block;width:${size}px;height:${size}px;pointer-events:none;" />
            <span style="position:absolute;left:50%;top:${numberTopPercent}%;transform:translate(-50%,-50%);color:#0f172a;font-weight:800;font-size:${fontSize}px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;pointer-events:none;">${index + 1}</span>
        </div>
    `;
};

const buildTransportMarkerHtml = (mode?: string, color?: string, rotationDegrees?: number): string => {
    const size = TRANSPORT_MARKER_BADGE_SIZE;
    const badgeColor = color || '#1f2937';
    const iconPath = resolveTransportIconPath(mode);
    const rotation = mode === 'plane' ? normalizeRotationDegrees(rotationDegrees) : 0;
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${TRANSPORT_MARKER_VIEWBOX_SIZE} ${TRANSPORT_MARKER_VIEWBOX_SIZE}">
            <circle cx="128" cy="128" r="112" fill="${badgeColor}" />
            <g transform="rotate(${rotation} 128 128)">
                <g transform="translate(${TRANSPORT_MARKER_ICON_INSET} ${TRANSPORT_MARKER_ICON_INSET}) scale(${TRANSPORT_MARKER_ICON_SCALE})">
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

export const offsetLatLngByMeters = (
    origin: google.maps.LatLngLiteral,
    eastMeters: number,
    northMeters: number,
): google.maps.LatLngLiteral => {
    const metersPerDegreeLat = 111_320;
    const safeCosine = Math.max(0.01, Math.cos((origin.lat * Math.PI) / 180));
    const metersPerDegreeLng = metersPerDegreeLat * safeCosine;
    return {
        lat: origin.lat + (northMeters / metersPerDegreeLat),
        lng: origin.lng + (eastMeters / metersPerDegreeLng),
    };
};

export const buildOverlappingMarkerPosition = (
    origin: google.maps.LatLngLiteral,
    overlapIndex: number,
    overlapCount: number,
    radiusMeters = MARKER_OVERLAP_RADIUS_METERS,
): google.maps.LatLngLiteral => {
    if (overlapCount <= 1 || overlapIndex < 0 || overlapIndex >= overlapCount) {
        return origin;
    }
    const angle = (-Math.PI / 2) + ((2 * Math.PI * overlapIndex) / overlapCount);
    const eastMeters = Math.cos(angle) * radiusMeters;
    const northMeters = Math.sin(angle) * radiusMeters;
    return offsetLatLngByMeters(origin, eastMeters, northMeters);
};

const buildCoordinateGroupKey = (coordinates: google.maps.LatLngLiteral): string => (
    `${coordinates.lat.toFixed(MARKER_COORDINATE_GROUP_PRECISION)},${coordinates.lng.toFixed(MARKER_COORDINATE_GROUP_PRECISION)}`
);

const getTransitFallbackDepartureTime = (): Date => {
    const nextWindow = new Date();
    nextWindow.setHours(12, 0, 0, 0);
    if (nextWindow.getTime() <= Date.now()) {
        nextWindow.setDate(nextWindow.getDate() + 1);
    }
    return nextWindow;
};

export const isMapViewportReady = (rect: { width: number; height: number } | null | undefined): boolean => {
    if (!rect) return false;
    return rect.width >= MAP_VIEWPORT_READY_MIN_DIMENSION_PX && rect.height >= MAP_VIEWPORT_READY_MIN_DIMENSION_PX;
};

export const getMapLabelCityName = (value?: string): string => {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';
    const firstSegment = raw.split(',')[0]?.trim();
    return firstSegment || raw;
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

const hydrateRouteCache = () => {
    if (routeCacheHydrated) return;
    if (typeof window === 'undefined') return;
    routeCacheHydrated = true;
    try {
        const raw = readLocalStorageItem(ROUTE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const now = Date.now();
        filterHydratedRouteCacheEntries(parsed, now).forEach(([key, entry]) => {
            ROUTE_CACHE.set(key, entry);
        });
    } catch (e) {
        console.warn('Failed to hydrate route cache', e);
    }
};

const persistRouteCache = () => {
    if (typeof window === 'undefined') return;
    try {
        const now = Date.now();
        const payload = buildPersistedRouteCachePayload(ROUTE_CACHE, now);
        writeLocalStorageItem(ROUTE_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Failed to persist route cache', e);
    }
};

interface ItineraryMapInstanceBridgeProps {
    mapId: string;
    onMapInstanceChange: (map: google.maps.Map | null) => void;
}

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
    layoutMode, 
    onLayoutChange, 
    showLayoutControls = true,
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
    viewTransitionName
}) => {
    const mapInstanceIdRef = useRef(`tf-itinerary-map-${Math.random().toString(36).slice(2, 10)}`);
    const mapInstanceId = mapInstanceIdRef.current;
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const googleMapRef = useRef<any>(null); // google.maps.Map
    const markersRef = useRef<OverlayMarkerHandle[]>([]);
    const cityMarkerMetaRef = useRef<Array<{ id: string; color: string; index: number; marker: OverlayMarkerHandle }>>([]);
    const routesRef = useRef<any[]>([]); // stored polylines/renderers
    const transportMarkersRef = useRef<OverlayMarkerHandle[]>([]);
    const cityLabelOverlaysRef = useRef<any[]>([]);
    const lastFocusQueryRef = useRef<string | null>(null);
    const lastFitToRouteKeyRef = useRef<string | null>(null);
    const fitRafRef = useRef<number | null>(null);
    const onRouteMetricsRef = useRef<typeof onRouteMetrics>(onRouteMetrics);
    const onRouteStatusRef = useRef<typeof onRouteStatus>(onRouteStatus);
    const onCityMarkerSelectRef = useRef<typeof onCityMarkerSelect>(onCityMarkerSelect);
    
    const { isLoaded, loadError } = useGoogleMaps();
    const [mapInitialized, setMapInitialized] = useState(false);
    const mapActionsDisabled = !mapInitialized || Boolean(loadError);
    
    // Internal state for menu, but style comes from props (or defaults to standard if not provided)
    const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);
    const shouldRenderMapCanvas = isLoaded && !loadError;
    const cities = useMemo(() => 
        items
            .filter(i => i.type === 'city' && i.coordinates)
            .sort((a, b) => a.startDateOffset - b.startDateOffset),
    [items]);
    const selectedCityId = useMemo(
        () => (selectedItemId && cities.some(city => city.id === selectedItemId) ? selectedItemId : null),
        [selectedItemId, cities]
    );

    const cancelScheduledFit = useCallback(() => {
        if (fitRafRef.current === null || typeof window === 'undefined') return;
        window.cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = null;
    }, []);

    const runFitBounds = useCallback(() => {
        if (!googleMapRef.current || cities.length === 0) return;

        const bounds = new window.google.maps.LatLngBounds();
        cities.forEach(city => {
            if (city.coordinates) {
                bounds.extend({ lat: city.coordinates.lat, lng: city.coordinates.lng });
            }
        });
        googleMapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }, [cities]);

    const scheduleFitWhenViewportReady = useCallback((maxAttempts = 14) => {
        if (!googleMapRef.current || cities.length === 0 || typeof window === 'undefined') return;
        cancelScheduledFit();

        let attemptCount = 0;
        const tryFit = () => {
            fitRafRef.current = null;
            if (!googleMapRef.current || cities.length === 0) return;

            const rect = mapContainerRef.current?.getBoundingClientRect();
            if (!isMapViewportReady(rect) && attemptCount < maxAttempts) {
                attemptCount += 1;
                fitRafRef.current = window.requestAnimationFrame(tryFit);
                return;
            }

            if (window.google?.maps?.event?.trigger) {
                window.google.maps.event.trigger(googleMapRef.current, 'resize');
            }
            runFitBounds();
        };

        fitRafRef.current = window.requestAnimationFrame(tryFit);
    }, [cancelScheduledFit, cities.length, runFitBounds]);

    useEffect(() => {
        onRouteMetricsRef.current = onRouteMetrics;
    }, [onRouteMetrics]);

    useEffect(() => {
        onRouteStatusRef.current = onRouteStatus;
    }, [onRouteStatus]);

    useEffect(() => {
        onCityMarkerSelectRef.current = onCityMarkerSelect;
    }, [onCityMarkerSelect]);

    const handleMapInstanceChange = useCallback((map: google.maps.Map | null) => {
        if (googleMapRef.current === map) return;
        googleMapRef.current = map;
        setMapInitialized(Boolean(map));
    }, []);

    useEffect(() => {
        if (!mapActionsDisabled) return;
        setIsStyleMenuOpen(false);
    }, [mapActionsDisabled]);

    // Handle Style Change
    useEffect(() => {
        if (!googleMapRef.current) return;
        
        // Ensure we force a style update
        if (activeStyle === 'satellite') {
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
    }, [activeStyle, mapInitialized]);

    const mapRenderSignature = useMemo(() => {
        const citySignature = cities
            .map(city => `${city.id}|${city.title}|${city.color}|${city.coordinates?.lat},${city.coordinates?.lng}`)
            .join('||');
        const routeSignature = cities
            .slice(0, -1)
            .map((city, idx) => {
                const nextCity = cities[idx + 1];
                const travelItem = findTravelBetweenCities(items, city, nextCity);
                const mode = normalizeTransportMode(travelItem?.transportMode);
                return `${city.id}->${nextCity.id}:${mode}`;
            })
            .join('||');
        return `${citySignature}__${routeSignature}__${mapColorMode}`;
    }, [cities, items, mapColorMode]);

    // Update Markers & Routes
    useEffect(() => {
        if (!mapInitialized || !googleMapRef.current || !window.google?.maps?.OverlayView) return;

        // 1. Clear existing markers & routes
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        routesRef.current.forEach(r => r.setMap(null));
        routesRef.current = [];
        transportMarkersRef.current.forEach(m => m.setMap(null));
        transportMarkersRef.current = [];
        cityLabelOverlaysRef.current.forEach(o => o.setMap(null));
        cityLabelOverlaysRef.current = [];
        cityMarkerMetaRef.current = [];
        let isEffectDisposed = false;
        const isEffectActive = () => !isEffectDisposed;

        const createOverlayMarker = ({
            position,
            html,
            zIndex,
            clickable = false,
            centerAnchor = false,
            onClick,
        }: {
            position: google.maps.LatLngLiteral;
            html: string;
            zIndex: number;
            clickable?: boolean;
            centerAnchor?: boolean;
            onClick?: () => void;
        }): OverlayMarkerHandle => {
            const overlay = new window.google.maps.OverlayView();
            let markerDiv: HTMLDivElement | null = null;
            let currentPosition = position;
            let currentHtml = html;
            let currentZIndex = zIndex;
            const clickHandler = (event: MouseEvent) => {
                event.stopPropagation();
                onClick?.();
            };

            overlay.onAdd = function onAdd() {
                markerDiv = document.createElement('div');
                markerDiv.style.position = 'absolute';
                markerDiv.style.transform = centerAnchor ? 'translate(-50%, -50%)' : 'translate(-50%, -100%)';
                markerDiv.style.pointerEvents = clickable ? 'auto' : 'none';
                markerDiv.style.cursor = clickable ? 'pointer' : 'default';
                markerDiv.style.zIndex = `${currentZIndex}`;
                markerDiv.innerHTML = currentHtml;
                if (clickable) {
                    markerDiv.addEventListener('click', clickHandler);
                }
                const panes = this.getPanes();
                const targetPane = clickable ? panes.overlayMouseTarget : panes.overlayLayer;
                targetPane.appendChild(markerDiv);
            };

            overlay.draw = function draw() {
                if (!markerDiv) return;
                const projection = this.getProjection();
                if (!projection) return;
                const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(currentPosition.lat, currentPosition.lng));
                if (!point) return;
                markerDiv.style.left = `${point.x}px`;
                markerDiv.style.top = `${point.y}px`;
            };

            overlay.onRemove = function onRemove() {
                if (!markerDiv) return;
                if (clickable) {
                    markerDiv.removeEventListener('click', clickHandler);
                }
                markerDiv.remove();
                markerDiv = null;
            };

            overlay.setMap(googleMapRef.current);

            return {
                setMap: (map: google.maps.Map | null) => overlay.setMap(map),
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
            const geometry = window.google?.maps?.geometry?.spherical;
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
            const geometry = window.google?.maps?.geometry?.spherical;
            if (!geometry) {
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

        const normalizeRoutePathPoints = (rawPath: unknown): google.maps.LatLngLiteral[] => {
            if (!Array.isArray(rawPath)) return [];
            return rawPath
                .map((point): google.maps.LatLngLiteral | null => {
                    if (!point || typeof point !== 'object') return null;
                    const latRaw = (point as { lat?: unknown }).lat;
                    const lngRaw = (point as { lng?: unknown }).lng;

                    if (typeof latRaw === 'number' && Number.isFinite(latRaw) && typeof lngRaw === 'number' && Number.isFinite(lngRaw)) {
                        return { lat: latRaw, lng: lngRaw };
                    }
                    if (typeof latRaw === 'function' && typeof lngRaw === 'function') {
                        const latValue = latRaw();
                        const lngValue = lngRaw();
                        if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
                            return { lat: latValue, lng: lngValue };
                        }
                    }

                    return null;
                })
                .filter((point): point is google.maps.LatLngLiteral => Boolean(point));
        };

        const computePathDistanceMeters = (path: google.maps.LatLngLiteral[]): number | undefined => {
            if (path.length < 2) return undefined;
            const geometry = window.google?.maps?.geometry?.spherical;
            if (!geometry) return undefined;
            let distanceMeters = 0;
            for (let idx = 1; idx < path.length; idx++) {
                distanceMeters += geometry.computeDistanceBetween(
                    new window.google.maps.LatLng(path[idx - 1].lat, path[idx - 1].lng),
                    new window.google.maps.LatLng(path[idx].lat, path[idx].lng),
                );
            }
            return distanceMeters > 0 ? distanceMeters : undefined;
        };

        const parseDurationSeconds = (value: unknown): number | undefined => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value > 10_000 ? value / 1000 : value;
            }
            if (typeof value === 'string') {
                const secondsMatch = value.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
                if (secondsMatch) {
                    const parsedSeconds = Number.parseFloat(secondsMatch[1]);
                    return Number.isFinite(parsedSeconds) ? parsedSeconds : undefined;
                }
            }
            if (value && typeof value === 'object') {
                const secondsValue = (value as { seconds?: unknown }).seconds;
                const nanosValue = (value as { nanos?: unknown }).nanos;
                if (typeof secondsValue === 'number' && Number.isFinite(secondsValue)) {
                    const nanosSeconds = typeof nanosValue === 'number' && Number.isFinite(nanosValue) ? nanosValue / 1_000_000_000 : 0;
                    return secondsValue + nanosSeconds;
                }
            }
            return undefined;
        };

        const createRoutePolylinePair = (options: google.maps.PolylineOptions) => {
            if (!isEffectActive() || !googleMapRef.current || !window.google?.maps?.Polyline) return null;
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

        const drawRoutePath = (path: google.maps.LatLngLiteral[], color: string, weight = 3) => {
            if (!isEffectActive()) return null;
            const arrowIcon = {
                path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: color,
                strokeOpacity: 1,
                strokeWeight: 0.1,
                scale: 3.2
            };
            return createRoutePolylinePair({
                path,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.7,
                strokeWeight: weight,
                clickable: false,
                icons: [
                    { icon: arrowIcon, offset: '25%' },
                    { icon: arrowIcon, offset: '75%' }
                ],
                zIndex: 40,
            });
        };

        const brandRouteColor = '#4f46e5';
        const resolveMapColor = (colorToken: string): string =>
            mapColorMode === 'brand' ? brandRouteColor : getHexFromColorClass(colorToken);
        const coordinateMarkerGroups = new Map<string, number[]>();

        cities.forEach((city, index) => {
            if (!city.coordinates) return;
            const key = buildCoordinateGroupKey(city.coordinates);
            const grouped = coordinateMarkerGroups.get(key) ?? [];
            grouped.push(index);
            coordinateMarkerGroups.set(key, grouped);
        });

        const resolveCityMarkerPosition = (city: ITimelineItem, index: number): google.maps.LatLngLiteral | null => {
            if (!city.coordinates) return null;
            const key = buildCoordinateGroupKey(city.coordinates);
            const grouped = coordinateMarkerGroups.get(key);
            if (!grouped || grouped.length <= 1) return city.coordinates;
            const overlapIndex = grouped.indexOf(index);
            if (overlapIndex < 0) return city.coordinates;
            return buildOverlappingMarkerPosition(city.coordinates, overlapIndex, grouped.length);
        };

        if (!isPaywalled) {
            // 2. Add Markers
            cities.forEach((city, index) => {
                if (!isEffectActive()) return;
                if (!city.coordinates) return;
                const markerPosition = resolveCityMarkerPosition(city, index);
                if (!markerPosition) return;
                
                const isSelected = city.id === selectedCityId;
                const cityMarkerColor = resolveMapColor(city.color);
                const marker = createOverlayMarker({
                    position: markerPosition,
                    html: buildCityMarkerHtml(index, cityMarkerColor, isSelected),
                    zIndex: isSelected ? 100 : 10,
                    clickable: true,
                    onClick: () => onCityMarkerSelectRef.current?.(city.id),
                });
                
                cityMarkerMetaRef.current.push({
                    id: city.id,
                    color: cityMarkerColor,
                    index,
                    marker,
                });
                markersRef.current.push(marker);
            });
        }

        if (!isPaywalled && showCityNames && googleMapRef.current) {
            const startCity = cities[0];
            const endCity = cities[cities.length - 1];
            const startCityKey = getNormalizedCityName(startCity?.title);
            const endCityKey = getNormalizedCityName(endCity?.title);
            const isRoundTrip = !!(startCityKey && endCityKey && startCityKey === endCityKey);
            const isCleanDarkLabelStyle = activeStyle === 'cleanDark';
            const defaultLabelTextColor = '#111827';
            const defaultLabelSubTextColor = 'var(--tf-primary)';
            const defaultLabelTextShadow = '0 1px 2px rgba(255,255,255,0.8)';
            const cleanDarkLabelTextColor = '#f8fafc';
            const cleanDarkLabelSubTextColor = resolveCssColorVar('--tf-accent-200', '#c7d2fe');
            const cleanDarkLabelTextShadow = '0 1px 2px rgba(11,18,32,0.88)';

            const createCityLabelOverlay = (position: google.maps.LatLngLiteral, name: string, subLabel?: string) => {
                const overlay = new window.google.maps.OverlayView();
                (overlay as any).div = null;

                overlay.onAdd = function () {
                    const div = document.createElement('div');
                    div.style.position = 'absolute';
                    div.style.transform = 'translate(12px, -50%)';
                    div.style.pointerEvents = 'none';
                    div.style.display = 'flex';
                    div.style.flexDirection = 'column';
                    div.style.gap = '1px';
                    div.style.whiteSpace = 'nowrap';
                    div.style.zIndex = '120';

                    const nameEl = document.createElement('div');
                    nameEl.textContent = name;
                    nameEl.style.fontSize = '13px';
                    nameEl.style.fontWeight = '700';
                    nameEl.style.color = isCleanDarkLabelStyle ? cleanDarkLabelTextColor : defaultLabelTextColor;
                    nameEl.style.textShadow = isCleanDarkLabelStyle ? cleanDarkLabelTextShadow : defaultLabelTextShadow;

                    div.appendChild(nameEl);

                    if (subLabel) {
                        const subEl = document.createElement('div');
                        subEl.textContent = subLabel;
                        subEl.style.fontSize = '10px';
                        subEl.style.fontWeight = '600';
                        subEl.style.color = isCleanDarkLabelStyle ? cleanDarkLabelSubTextColor : defaultLabelSubTextColor;
                        subEl.style.textTransform = 'uppercase';
                        subEl.style.letterSpacing = '0.08em';
                        subEl.style.textShadow = isCleanDarkLabelStyle ? cleanDarkLabelTextShadow : defaultLabelTextShadow;
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
                        (overlay as any).div.style.left = `${point.x}px`;
                        (overlay as any).div.style.top = `${point.y}px`;
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

            const shownRoundTripLabel = new Set<string>();

            cities.forEach((city) => {
                if (!city.coordinates) return;
                const cityKey = getNormalizedCityName(city.title);
                const labelName = getMapLabelCityName(city.title || city.location) || city.title || city.location || '';
                if (isRoundTrip && cityKey && cityKey === startCityKey) {
                    if (shownRoundTripLabel.has(cityKey)) return;
                    shownRoundTripLabel.add(cityKey);
                    const overlay = createCityLabelOverlay(
                        { lat: city.coordinates.lat, lng: city.coordinates.lng },
                        labelName,
                        'START • END'
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                    return;
                }

                let subLabel: string | undefined;
                if (startCity && city.id === startCity.id) subLabel = 'START';
                if (endCity && city.id === endCity.id) subLabel = 'END';

                if (subLabel) {
                    const overlay = createCityLabelOverlay(
                        { lat: city.coordinates.lat, lng: city.coordinates.lng },
                        labelName,
                        subLabel
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                } else {
                    const overlay = createCityLabelOverlay(
                        { lat: city.coordinates.lat, lng: city.coordinates.lng },
                        labelName
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                }
            });
        }

        // 3. Draw Routes
        const drawRoutes = async () => {
             if (!isEffectActive()) return;
             hydrateRouteCache();
             const importLibrary = window.google?.maps?.importLibrary;
             let computeRoutes: ((request: unknown) => Promise<unknown>) | null = null;
             let routesTransitModes: Record<string, unknown> | null = null;

             if (typeof importLibrary === 'function') {
                 try {
                     const routesLibrary = await importLibrary('routes' as never) as {
                         Route?: { computeRoutes?: (request: unknown) => Promise<unknown> };
                         TransitMode?: Record<string, unknown>;
                     };
                     if (routesLibrary?.Route && typeof routesLibrary.Route.computeRoutes === 'function') {
                         computeRoutes = routesLibrary.Route.computeRoutes.bind(routesLibrary.Route);
                     }
                     if (routesLibrary?.TransitMode && typeof routesLibrary.TransitMode === 'object') {
                         routesTransitModes = routesLibrary.TransitMode;
                     }
                 } catch (error) {
                     console.warn('Failed to load Routes library; route checks will fall back to straight-line rendering', error);
                 }
             }
             if (!isEffectActive()) return;

             for (let i = 0; i < cities.length - 1; i++) {
                 if (!isEffectActive()) return;
                 const start = cities[i];
                 const end = cities[i+1];
                 if (!start.coordinates || !end.coordinates) continue;

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

                 const travelModes = window.google.maps.TravelMode;

                 const wantsRealRoute = routeMode === 'realistic';
                 const routeAttemptModes = routeAttemptPolicy.modes.map((modeKey) =>
                     (travelModes[modeKey] ?? modeKey) as google.maps.TravelMode
                 );
                 const useRealRoute = wantsRealRoute && routeAttemptModes.length > 0;

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

                         if (mode !== 'na') {
                             const midPoint = getPointAlongPath(cached.path, 0.5);
                             if (!midPoint) continue;
                             const markerHeading = mode === 'plane' ? getHeadingAlongPath(cached.path, 0.5) : undefined;
                             const transportMarker = createOverlayMarker({
                                 position: midPoint,
                                 html: buildTransportMarkerHtml(mode, startColor, markerHeading),
                                 zIndex: 50,
                                 centerAnchor: true,
                             });
                             transportMarkersRef.current.push(transportMarker);
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
                         const tryRoute = async (travelMode: google.maps.TravelMode, attemptIndex: number) => {
                             if (!isEffectActive()) {
                                 throw new Error('Route draw cancelled');
                             }
                             const origin = { lat: start.coordinates.lat, lng: start.coordinates.lng };
                             const destination = { lat: end.coordinates.lat, lng: end.coordinates.lng };
                             let path: google.maps.LatLngLiteral[] = [];
                             let distanceKm: number | undefined;
                             let durationHours: number | undefined;
                             const isTransitMode = (
                                 travelMode === travelModes.TRANSIT ||
                                 travelMode === 'TRANSIT'
                             );
                             const transitDepartureTime = getTransitFallbackDepartureTime();

                             if (!computeRoutes) {
                                 throw new Error('Routes API unavailable');
                             }

                             const buildRouteRequest = (fields: readonly string[]): Record<string, unknown> => {
                                 const routeRequest: Record<string, unknown> = {
                                     origin,
                                     destination,
                                     travelMode,
                                     fields,
                                 };
                                 if (isTransitMode) {
                                     routeRequest.departureTime = transitDepartureTime;
                                     const allowedTransitModes: unknown[] = [];
                                     const isPrimaryTransitAttempt = attemptIndex === 0;
                                     if (isPrimaryTransitAttempt && mode === 'train') {
                                         if (routesTransitModes?.TRAIN) {
                                             allowedTransitModes.push(routesTransitModes.TRAIN);
                                         } else {
                                             allowedTransitModes.push('TRAIN');
                                         }
                                         if (routesTransitModes?.RAIL) {
                                             allowedTransitModes.push(routesTransitModes.RAIL);
                                         }
                                     }
                                     if (isPrimaryTransitAttempt && mode === 'bus') {
                                         if (routesTransitModes?.BUS) {
                                             allowedTransitModes.push(routesTransitModes.BUS);
                                         } else {
                                             allowedTransitModes.push('BUS');
                                         }
                                     }
                                     if (allowedTransitModes.length > 0) {
                                         routeRequest.transitPreference = {
                                             allowedTransitModes,
                                         };
                                     }
                                 }
                                 return routeRequest;
                             };
                             const applyRoutesResult = (routesResult: unknown) => {
                                 const parsedResult = routesResult as {
                                     routes?: Array<{
                                         path?: unknown;
                                         distanceMeters?: unknown;
                                         durationMillis?: unknown;
                                     }>;
                                 };
                                 const route = parsedResult.routes?.[0];
                                 path = normalizeRoutePathPoints(route?.path);
                                 const distanceMeters = typeof route?.distanceMeters === 'number' && Number.isFinite(route.distanceMeters)
                                     ? route.distanceMeters
                                     : computePathDistanceMeters(path);
                                 distanceKm = distanceMeters ? distanceMeters / 1000 : undefined;

                                 const durationSeconds = parseDurationSeconds(route?.durationMillis);
                                 durationHours = durationSeconds ? durationSeconds / 3600 : undefined;
                             };

                             try {
                                 const routesResult = await computeRoutes(buildRouteRequest(ROUTES_COMPUTE_FIELDS));
                                 if (!isEffectActive()) {
                                     throw new Error('Route draw cancelled');
                                 }
                                 applyRoutesResult(routesResult);
                             } catch (computeRoutesError) {
                                 if (!isEffectActive()) {
                                     throw new Error('Route draw cancelled');
                                 }

                                 if (isRoutesFieldMaskError(computeRoutesError)) {
                                     const fallbackResult = await computeRoutes(buildRouteRequest(ROUTES_COMPUTE_MINIMAL_FIELDS));
                                     if (!isEffectActive()) {
                                         throw new Error('Route draw cancelled');
                                     }
                                     applyRoutesResult(fallbackResult);
                                 } else {
                                     throw computeRoutesError;
                                 }
                             }

                             if (!path || path.length === 0) {
                                 throw new Error('No route path returned');
                             }
                             if (isRoutePathLikelyStraight(path, origin, destination, mode)) {
                                 throw new Error('Route path is straight');
                             }
                             if (!isEffectActive()) {
                                 throw new Error('Route draw cancelled');
                             }

                             drawRoutePath(path, startColor, 3);

                             if (mode !== 'na') {
                                 const midPoint = getPointAlongPath(path, 0.5);
                                 if (midPoint) {
                                     const markerHeading = mode === 'plane' ? getHeadingAlongPath(path, 0.5) : undefined;
                                     const transportMarker = createOverlayMarker({
                                         position: midPoint,
                                         html: buildTransportMarkerHtml(mode, startColor, markerHeading),
                                         zIndex: 50,
                                         centerAnchor: true,
                                     });
                                     transportMarkersRef.current.push(transportMarker);
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

                 // Fallback / Flight: Draw Geodesic Polyline
                 const isDashedFallback = mode !== 'plane';
                 const arrowIcon = {
                     path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, 
                     fillColor: startColor,
                     fillOpacity: 1,
                     strokeColor: startColor,
                     strokeOpacity: 1,
                     strokeWeight: 0.1,
                     scale: 3.2
                 };
                 const icons = isDashedFallback
                     ? [
                         {
                             icon: { path: 'M 0,-1 0,1', strokeColor: startColor, strokeOpacity: 0.9, scale: 2.5 },
                             offset: '0',
                             repeat: '12px'
                         },
                         { icon: arrowIcon, offset: '25%' },
                         { icon: arrowIcon, offset: '75%' }
                       ]
                     : [
                         { icon: arrowIcon, offset: '25%' },
                         { icon: arrowIcon, offset: '75%' },
                     ];
                 if (!isEffectActive()) return;
                 createRoutePolylinePair({
                     path: [
                         { lat: start.coordinates.lat, lng: start.coordinates.lng },
                         { lat: end.coordinates.lat, lng: end.coordinates.lng }
                     ],
                     geodesic: true,
                     strokeColor: startColor,
                     strokeOpacity: isDashedFallback ? 0 : 0.6,
                     strokeWeight: 2,
                     clickable: false,
                     icons,
                     zIndex: 35,
                 });

                 const mid = getPointAlongPath([
                     { lat: start.coordinates.lat, lng: start.coordinates.lng },
                     { lat: end.coordinates.lat, lng: end.coordinates.lng },
                 ], 0.5);
                 if (mode !== 'na') {
                     if (!isEffectActive()) return;
                     if (!mid) continue;
                     const markerHeading = mode === 'plane'
                         ? getHeadingBetweenPoints(start.coordinates, end.coordinates)
                         : undefined;
                     const transportMarker = createOverlayMarker({
                         position: mid,
                         html: buildTransportMarkerHtml(mode, startColor, markerHeading),
                         zIndex: 50,
                         centerAnchor: true,
                     });
                     transportMarkersRef.current.push(transportMarker);
                 }
             }
        };

        if (!isPaywalled) {
            void drawRoutes();
        }
        return () => {
            isEffectDisposed = true;
        };

    }, [mapInitialized, mapRenderSignature, routeMode, showCityNames, isPaywalled, activeStyle]); 

    useEffect(() => {
        if (!mapInitialized || !window.google?.maps?.OverlayView) return;

        cityMarkerMetaRef.current.forEach(({ id, color, index, marker }) => {
            const isSelected = id === selectedCityId;
            marker.update({
                html: buildCityMarkerHtml(index, color, isSelected),
                zIndex: isSelected ? 100 : 10,
            });
        });
    }, [mapInitialized, selectedCityId]);

    // Pan to selected
    useEffect(() => {
        if (!googleMapRef.current || !selectedCityId) return;
        
        const t = setTimeout(() => {
            const selectedCity = cities.find(i => i.id === selectedCityId);
            if (selectedCity && selectedCity.coordinates) {
                googleMapRef.current.panTo({ lat: selectedCity.coordinates.lat, lng: selectedCity.coordinates.lng });
                googleMapRef.current.setZoom(10);
            }
        }, 100);
        return () => clearTimeout(t);
    }, [selectedCityId, mapInitialized, cities]);

    // Fit Bounds
    const handleFit = () => {
        scheduleFitWhenViewportReady();
    };

    // Auto fit on load
    useEffect(() => {
        if (mapInitialized && cities.length > 0) {
            scheduleFitWhenViewportReady();
        }
    }, [mapInitialized, cities.length, scheduleFitWhenViewportReady]);

    // Re-center when an external "active route" key changes (e.g., opening a different saved plan).
    useEffect(() => {
        if (!fitToRouteKey || !mapInitialized || cities.length === 0) return;
        if (lastFitToRouteKeyRef.current === fitToRouteKey) return;

        lastFitToRouteKeyRef.current = fitToRouteKey;
        scheduleFitWhenViewportReady();
    }, [fitToRouteKey, mapInitialized, cities.length, scheduleFitWhenViewportReady]);

    useEffect(() => {
        if (!mapInitialized || !googleMapRef.current || typeof ResizeObserver === 'undefined') return;
        const container = mapContainerRef.current;
        if (!container) return;

        let resizeRafId: number | null = null;
        const observer = new ResizeObserver(() => {
            if (resizeRafId !== null || !googleMapRef.current) return;
            resizeRafId = window.requestAnimationFrame(() => {
                resizeRafId = null;
                if (!googleMapRef.current) return;
                if (window.google?.maps?.event?.trigger) {
                    window.google.maps.event.trigger(googleMapRef.current, 'resize');
                }
            });
        });
        observer.observe(container);

        return () => {
            observer.disconnect();
            if (resizeRafId !== null) {
                window.cancelAnimationFrame(resizeRafId);
            }
        };
    }, [mapInitialized]);

    useEffect(() => (
        () => {
            cancelScheduledFit();
        }
    ), [cancelScheduledFit]);

    // If we don't have city coordinates yet, center the map on the selected country/location.
    // Supports one or multiple focus queries separated by "||".
    useEffect(() => {
        const queries = (focusLocationQuery ?? '')
            .split(/\s*\|\|\s*/)
            .map((query) => query.trim())
            .filter((query) => query.length > 0);
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
                googleMapRef.current.setZoom(5);
                return;
            }
            googleMapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
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
    }, [focusLocationQuery, mapInitialized, cities.length]);

    return (
        <div
            ref={mapContainerRef}
            className="relative w-full h-full group bg-gray-100"
            style={viewTransitionName ? ({ viewTransitionName } as React.CSSProperties) : undefined}
        >
            {shouldRenderMapCanvas && (
                <GoogleMap
                    id={mapInstanceId}
                    defaultCenter={{ lat: 20, lng: 0 }}
                    defaultZoom={2}
                    disableDefaultUI
                    gestureHandling="cooperative"
                    reuseMaps
                    className="h-full w-full"
                >
                    <ItineraryMapInstanceBridge mapId={mapInstanceId} onMapInstanceChange={handleMapInstanceChange} />
                </GoogleMap>
            )}
            {!mapInitialized && !loadError && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-gray-100">
                    Loading Map...
                </div>
            )}
            {loadError && (
                <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-500 bg-gray-100">
                    Error loading map: {loadError.message}
                </div>
            )}
            
            {/* Controls */}
            <div data-floating-map-control="true" className="absolute top-4 end-4 z-[40] flex flex-col gap-2 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">
                    {onMapDockModeToggle && (
                        <button
                            type="button"
                            onClick={onMapDockModeToggle}
                            data-testid="map-dock-toggle-button"
                            data-floating-map-control="true"
                            className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
                            aria-label={mapDockMode === 'docked' ? 'Minimize map preview' : 'Maximize map preview'}
                            {...getAnalyticsDebugAttributes(
                                mapDockMode === 'docked' ? 'trip_view__map_preview--minimize' : 'trip_view__map_preview--maximize',
                                { surface: 'map_controls' },
                            )}
                        >
                            {mapDockMode === 'docked' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            <span className="sr-only">{mapDockMode === 'docked' ? 'Minimize map preview' : 'Maximize map preview'}</span>
                        </button>
                    )}
                    {showLayoutControls && onLayoutChange && (
                        <>
                            <button
                                onClick={() => onLayoutChange('vertical')}
                                className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'vertical' ? 'bg-accent-600 text-white border-accent-700' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`} aria-label="Vertical layout"
                                {...getAnalyticsDebugAttributes('trip_view__layout_direction--vertical', { surface: 'map_controls' })}
                            ><ArrowUpDown size={18} /></button>
                            <button
                                onClick={() => onLayoutChange('horizontal')}
                                className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'horizontal' ? 'bg-accent-600 text-white border-accent-700' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`} aria-label="Horizontal layout"
                                {...getAnalyticsDebugAttributes('trip_view__layout_direction--horizontal', { surface: 'map_controls' })}
                            ><ArrowLeftRight size={18} /></button>
                        </>
                    )}

                    {onToggleExpanded && (
                        <button
                            onClick={onToggleExpanded}
                            className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50 transition-colors flex items-center justify-center"
                            title={isExpanded ? 'Shrink map' : 'Expand map'}
                            aria-label={isExpanded ? 'Shrink map' : 'Expand map'}
                        >
                            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                    )}
                    
                    <button
                        onClick={handleFit}
                        disabled={mapActionsDisabled}
                        className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50 transition-colors flex items-center justify-center disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-300"
                        aria-label="Fit to itinerary"
                    ><Focus size={18} /></button>
                    
                    {/* Style Switcher */}
                    {onStyleChange && (
                      <div className="relative">
                          <button
                              onClick={() => {
                                  if (mapActionsDisabled) return;
                                  setIsStyleMenuOpen(!isStyleMenuOpen);
                              }}
                              disabled={mapActionsDisabled}
                              className={`p-2 rounded-lg shadow-md border transition-colors flex items-center justify-center ${
                                  mapActionsDisabled
                                      ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
                                      : isStyleMenuOpen
                                          ? 'bg-accent-50 border-accent-300 text-accent-600'
                                          : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'
                              }`}
                              aria-label="Map style"
                          ><Layers size={18} /></button>
                          {isStyleMenuOpen && !mapActionsDisabled && (
                              <div className="absolute top-0 right-full mr-2 bg-white rounded-lg shadow-xl border border-gray-100 w-40 overflow-hidden flex flex-col z-20">
                                  <button onClick={() => { onStyleChange('minimal'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'minimal' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Minimal</button>
                                  <button onClick={() => { onStyleChange('standard'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'standard' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Standard</button>
                                  <button onClick={() => { onStyleChange('dark'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'dark' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Dark</button>
                                  <button onClick={() => { onStyleChange('clean'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'clean' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Clean (light)</button>
                                  <button onClick={() => { onStyleChange('cleanDark'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'cleanDark' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Clean (dark)</button>
                                  <button onClick={() => { onStyleChange('satellite'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'satellite' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Satellite</button>
                                  {!isPaywalled && onRouteModeChange && (
                                      <>
                                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">Routes</div>
                                          <button onClick={() => { onRouteModeChange('simple'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${routeMode === 'simple' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Simple</button>
                                          <button onClick={() => { onRouteModeChange('realistic'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${routeMode === 'realistic' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Realistic</button>
                                      </>
                                  )}
                                  {!isPaywalled && onShowCityNamesChange && (
                                      <>
                                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">Labels</div>
                                          <button
                                              onClick={() => { onShowCityNamesChange(!showCityNames); setIsStyleMenuOpen(false); }}
                                              className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${showCityNames ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}
                                          >
                                              City names {showCityNames ? 'On' : 'Off'}
                                          </button>
                                      </>
                                  )}
                                  {onMapColorModeChange && (
                                      <>
                                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">Colors</div>
                                          <button
                                              onClick={() => { onMapColorModeChange('trip'); setIsStyleMenuOpen(false); }}
                                              className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${mapColorMode === 'trip' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}
                                          >
                                              Trip colors
                                          </button>
                                          <button
                                              onClick={() => { onMapColorModeChange('brand'); setIsStyleMenuOpen(false); }}
                                              className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${mapColorMode === 'brand' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}
                                          >
                                              Brand accent
                                          </button>
                                      </>
                                  )}
                              </div>
                          )}
                      </div>
                    )}
                </div>
            </div>
        </div>
    );
};
