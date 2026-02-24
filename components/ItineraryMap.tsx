import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ITimelineItem, MapColorMode, MapStyle, RouteMode, RouteStatus } from '../types';
import { Focus, Columns, Rows, Layers, Maximize2, Minimize2 } from 'lucide-react';
import { readLocalStorageItem, writeLocalStorageItem } from '../services/browserStorageService';
import { buildRouteCacheKey, DEFAULT_MAP_COLOR_MODE, findTravelBetweenCities, getContrastTextColor, getHexFromColorClass, getNormalizedCityName } from '../utils';
import { useGoogleMaps } from './GoogleMapsLoader';
import { normalizeTransportMode } from '../shared/transportModes';

interface ItineraryMapProps {
    items: ITimelineItem[];
    selectedItemId?: string | null;
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
    focusLocationQuery?: string;
    fitToRouteKey?: string;
    onRouteMetrics?: (travelItemId: string, metrics: { routeDistanceKm?: number; routeDurationHours?: number; mode?: string; routeKey?: string }) => void;
    onRouteStatus?: (travelItemId: string, status: RouteStatus, meta?: { mode?: string; routeKey?: string }) => void;
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
    ]
};

type RouteCacheEntry = {
    status: 'ok' | 'failed';
    updatedAt: number;
    path?: google.maps.LatLngLiteral[];
    distanceKm?: number;
    durationHours?: number;
};

const ROUTE_CACHE = new Map<string, RouteCacheEntry>();
export const ROUTE_FAILURE_TTL_MS = 5 * 60 * 1000;
const ROUTE_STORAGE_KEY = 'tf_route_cache_v1';
export const ROUTE_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;
let routeCacheHydrated = false;

const ROUTE_OUTLINE_COLOR_BY_STYLE: Record<MapStyle, string> = {
    minimal: '#0f172a',
    standard: '#0f172a',
    clean: '#0f172a',
    dark: '#f8fafc',
    satellite: '#f8fafc',
};

export const getRouteOutlineColor = (style: MapStyle = 'standard'): string => {
    return ROUTE_OUTLINE_COLOR_BY_STYLE[style];
};

const buildOutlineIconSequences = (
    icons: google.maps.IconSequence[],
    outlineColor: string,
): google.maps.IconSequence[] => {
    return icons.map((sequence) => {
        const icon = sequence.icon;
        const baseScale = typeof icon.scale === 'number' ? icon.scale : 2.5;
        return {
            ...sequence,
            icon: {
                ...icon,
                strokeColor: outlineColor,
                strokeOpacity: Math.max(icon.strokeOpacity ?? 0.9, 0.95),
                scale: baseScale + 1,
            },
        };
    });
};

export const buildRoutePolylinePairOptions = (
    options: google.maps.PolylineOptions,
    style: MapStyle = 'standard',
): { outlineOptions: google.maps.PolylineOptions; mainOptions: google.maps.PolylineOptions } => {
    const baseWeight = options.strokeWeight ?? 3;
    const baseOpacity = options.strokeOpacity ?? 0.7;
    const baseZIndex = options.zIndex ?? 30;
    const iconSequences = options.icons ?? [];
    const hasIconSequences = iconSequences.length > 0;
    const isIconOnlyRoute = baseOpacity <= 0.05 && hasIconSequences;
    const outlineColor = getRouteOutlineColor(style);

    const outlineOptions: google.maps.PolylineOptions = {
        ...options,
        strokeColor: outlineColor,
        strokeOpacity: baseOpacity > 0.05 ? Math.min(1, Math.max(baseOpacity + 0.2, 0.45)) : 0,
        strokeWeight: baseWeight + 2,
        icons: isIconOnlyRoute ? buildOutlineIconSequences(iconSequences, outlineColor) : undefined,
        zIndex: baseZIndex - 1,
    };

    const mainOptions: google.maps.PolylineOptions = {
        ...options,
        strokeOpacity: baseOpacity,
        strokeWeight: baseWeight,
        zIndex: baseZIndex,
    };

    return { outlineOptions, mainOptions };
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
                payload[key] = { status: 'failed', updatedAt: entry.updatedAt };
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

export const ItineraryMap: React.FC<ItineraryMapProps> = ({ 
    items, 
    selectedItemId, 
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
    focusLocationQuery,
    fitToRouteKey,
    onRouteMetrics,
    onRouteStatus,
    mapColorMode = DEFAULT_MAP_COLOR_MODE,
    onMapColorModeChange,
    isPaywalled = false,
    viewTransitionName
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null); // google.maps.Map
    const markersRef = useRef<any[]>([]); // google.maps.Marker[]
    const routesRef = useRef<any[]>([]); // stored polylines/renderers
    const transportMarkersRef = useRef<any[]>([]); // google.maps.Marker[]
    const cityLabelOverlaysRef = useRef<any[]>([]);
    const lastFocusQueryRef = useRef<string | null>(null);
    const lastFitToRouteKeyRef = useRef<string | null>(null);
    const onRouteMetricsRef = useRef<typeof onRouteMetrics>(onRouteMetrics);
    const onRouteStatusRef = useRef<typeof onRouteStatus>(onRouteStatus);
    
    const { isLoaded, loadError } = useGoogleMaps();
    const [mapInitialized, setMapInitialized] = useState(false);
    
    // Internal state for menu, but style comes from props (or defaults to standard if not provided)
    const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

    useEffect(() => {
        onRouteMetricsRef.current = onRouteMetrics;
    }, [onRouteMetrics]);

    useEffect(() => {
        onRouteStatusRef.current = onRouteStatus;
    }, [onRouteStatus]);

    // Initial Map Setup
    useEffect(() => {
        if (!isLoaded || !mapRef.current || googleMapRef.current || !window.google?.maps?.Map) return;

        try {
            googleMapRef.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: 20, lng: 0 },
                zoom: 2,
                disableDefaultUI: true,
                gestureHandling: 'cooperative',
                styles: null
            });
            setMapInitialized(true);
        } catch (e) {
            console.error("Failed to init map", e);
        }
    }, [isLoaded]);

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

    const cities = useMemo(() => 
        items
            .filter(i => i.type === 'city' && i.coordinates)
            .sort((a, b) => a.startDateOffset - b.startDateOffset),
    [items]);
    const selectedCityId = useMemo(
        () => (selectedItemId && cities.some(city => city.id === selectedItemId) ? selectedItemId : null),
        [selectedItemId, cities]
    );

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
        if (!mapInitialized || !googleMapRef.current || !window.google?.maps?.Marker) return;

        // 1. Clear existing markers & routes
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        routesRef.current.forEach(r => r.setMap(null));
        routesRef.current = [];
        transportMarkersRef.current.forEach(m => m.setMap(null));
        transportMarkersRef.current = [];
        cityLabelOverlaysRef.current.forEach(o => o.setMap(null));
        cityLabelOverlaysRef.current = [];

        const buildPinIcon = (color: string, isSelected: boolean) => {
            const size = isSelected ? 44 : 34;
            const stroke = isSelected ? '#111827' : '#ffffff';
            const strokeWidth = isSelected ? 2.5 : 1.5;
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
                </svg>
            `;
            const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
            return {
                url,
                scaledSize: new window.google.maps.Size(size, size),
                anchor: new window.google.maps.Point(size / 2, size),
                labelOrigin: new window.google.maps.Point(size / 2, size / 2 - 2),
            };
        };

        const getTransportSvgBody = (mode?: string) => {
            switch (mode) {
                case 'na':
                case undefined:
                    return `<path d="M8 6h8" /><path d="M8 10h8" /><path d="M8 14h5" />`;
                case 'train':
                    return `
                        <rect width="16" height="16" x="4" y="3" rx="2" />
                        <path d="M4 11h16" />
                        <path d="M12 3v8" />
                        <path d="m8 19-2 3" />
                        <path d="m18 22-2-3" />
                        <path d="M8 15h.01" />
                        <path d="M16 15h.01" />
                    `;
                case 'bus':
                    return `
                        <path d="M8 6v6" />
                        <path d="M15 6v6" />
                        <path d="M2 12h19.6" />
                        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
                        <circle cx="7" cy="18" r="2" />
                        <path d="M9 18h5" />
                        <circle cx="16" cy="18" r="2" />
                    `;
                case 'boat':
                    return `
                        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
                        <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
                        <path d="M12 10v4" />
                        <path d="M12 2v3" />
                    `;
                case 'car':
                    return `
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                        <circle cx="7" cy="17" r="2" />
                        <path d="M9 17h6" />
                        <circle cx="17" cy="17" r="2" />
                    `;
                case 'motorcycle':
                    return `
                        <circle cx="6" cy="17" r="3" />
                        <circle cx="18" cy="17" r="3" />
                        <path d="M6 17l4-5h6l2 5" />
                        <path d="M10 12h5" />
                        <path d="M12 9l3-2" />
                        <path d="M15 7h3" />
                    `;
                case 'bicycle':
                    return `
                        <circle cx="6" cy="17" r="3" />
                        <circle cx="18" cy="17" r="3" />
                        <path d="M6 17l4-7h5l3 7" />
                        <path d="M10 10l-2-3" />
                        <path d="M15 10l2-2" />
                        <path d="M11 10h4" />
                    `;
                case 'walk':
                    return `
                        <ellipse cx="8" cy="17" rx="2.6" ry="3.6" />
                        <ellipse cx="16.5" cy="9.5" rx="2.2" ry="3.1" />
                        <circle cx="15.6" cy="5.7" r="0.7" />
                        <circle cx="17" cy="5.4" r="0.6" />
                        <circle cx="18.2" cy="5.9" r="0.55" />
                    `;
                case 'plane':
                    return `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />`;
                default:
                    return '';
            }
        };

        const buildTransportIcon = (mode?: string, color?: string) => {
            const size = 22;
            const stroke = color || '#111827';
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
                    <g fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        ${getTransportSvgBody(mode)}
                    </g>
                </svg>
            `;
            const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
            return {
                url,
                scaledSize: new window.google.maps.Size(size, size),
                anchor: new window.google.maps.Point(size / 2, size / 2),
            };
        };

        const getOffsetPosition = (start: google.maps.LatLngLiteral, end: google.maps.LatLngLiteral, mid: google.maps.LatLngLiteral) => {
            const geometry = window.google?.maps?.geometry?.spherical;
            if (!geometry) return mid;
            const startLatLng = new window.google.maps.LatLng(start.lat, start.lng);
            const endLatLng = new window.google.maps.LatLng(end.lat, end.lng);
            const midLatLng = new window.google.maps.LatLng(mid.lat, mid.lng);
            const distance = geometry.computeDistanceBetween(startLatLng, endLatLng);
            const offset = Math.min(Math.max(distance * 0.05, 2000), 20000);
            const heading = geometry.computeHeading(startLatLng, endLatLng);
            const offsetHeading = heading + 90;
            const result = geometry.computeOffset(midLatLng, offset, offsetHeading);
            return { lat: result.lat(), lng: result.lng() };
        };

        const createRoutePolylinePair = (options: google.maps.PolylineOptions) => {
            if (!googleMapRef.current || !window.google?.maps?.Polyline) return null;
            const { outlineOptions, mainOptions } = buildRoutePolylinePairOptions(options, activeStyle);
            const outline = new window.google.maps.Polyline({
                ...outlineOptions,
                map: googleMapRef.current,
            });
            const main = new window.google.maps.Polyline({
                ...mainOptions,
                map: googleMapRef.current,
            });
            routesRef.current.push(outline, main);
            return { outline, main };
        };

        const drawRoutePath = (path: google.maps.LatLngLiteral[], color: string, weight = 3) => {
            return createRoutePolylinePair({
                path,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.7,
                strokeWeight: weight,
                clickable: false,
                icons: [{
                    icon: {
                        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        strokeColor: color,
                        strokeOpacity: 0.9,
                        scale: 2.5
                    },
                    offset: '50%'
                }],
                zIndex: 40,
            });
        };

        const brandRouteColor = '#4f46e5';
        const resolveMapColor = (colorToken: string): string =>
            mapColorMode === 'brand' ? brandRouteColor : getHexFromColorClass(colorToken);

        if (!isPaywalled) {
            // 2. Add Markers
            cities.forEach((city, index) => {
                if (!city.coordinates) return;
                
                const isSelected = city.id === selectedCityId;
                const cityMarkerColor = resolveMapColor(city.color);
                const cityMarkerLabelColor = getContrastTextColor(cityMarkerColor);
                const marker = new window.google.maps.Marker({
                    map: googleMapRef.current,
                    position: { lat: city.coordinates.lat, lng: city.coordinates.lng },
                    title: city.title,
                    label: { 
                        text: `${index + 1}`, 
                        color: cityMarkerLabelColor,
                        fontWeight: '700', 
                        fontSize: isSelected ? '14px' : '12px' 
                    },
                    icon: buildPinIcon(cityMarkerColor, isSelected),
                    zIndex: isSelected ? 100 : 10,
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

                    const nameEl = document.createElement('div');
                    nameEl.textContent = name;
                    nameEl.style.fontSize = '13px';
                    nameEl.style.fontWeight = '700';
                    nameEl.style.color = '#111827';
                    nameEl.style.textShadow = '0 1px 2px rgba(255,255,255,0.8)';

                    div.appendChild(nameEl);

                    if (subLabel) {
                        const subEl = document.createElement('div');
                        subEl.textContent = subLabel;
                        subEl.style.fontSize = '10px';
                        subEl.style.fontWeight = '600';
                        subEl.style.color = 'var(--tf-primary)';
                        subEl.style.textTransform = 'uppercase';
                        subEl.style.letterSpacing = '0.08em';
                        subEl.style.textShadow = '0 1px 2px rgba(255,255,255,0.8)';
                        div.appendChild(subEl);
                    }

                    (overlay as any).div = div;
                    const panes = this.getPanes();
                    panes.overlayLayer.appendChild(div);
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
                if (isRoundTrip && cityKey && cityKey === startCityKey) {
                    if (shownRoundTripLabel.has(cityKey)) return;
                    shownRoundTripLabel.add(cityKey);
                    const overlay = createCityLabelOverlay(
                        { lat: city.coordinates.lat, lng: city.coordinates.lng },
                        city.title,
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
                        city.title,
                        subLabel
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                } else {
                    const overlay = createCityLabelOverlay(
                        { lat: city.coordinates.lat, lng: city.coordinates.lng },
                        city.title
                    );
                    cityLabelOverlaysRef.current.push(overlay);
                }
            });
        }

        // 3. Draw Routes
        const drawRoutes = async () => {
             hydrateRouteCache();
             const directionsService = new window.google.maps.DirectionsService();

             for (let i = 0; i < cities.length - 1; i++) {
                 const start = cities[i];
                 const end = cities[i+1];
                 if (!start.coordinates || !end.coordinates) continue;

                 const travelItem = findTravelBetweenCities(items, start, end);
                 const mode = normalizeTransportMode(travelItem?.transportMode);
                 const startColor = resolveMapColor(start.color); // Color based on start city
                 const cacheKey = start.coordinates && end.coordinates
                     ? buildRouteCacheKey(start.coordinates, end.coordinates, mode)
                     : null;
                 let routingAttempted = false;
                 let routingFailed = false;

                 const travelModes = window.google.maps.TravelMode;

                 const getDirectionsMode = (transportMode: string): google.maps.TravelMode | null => {
                     switch (transportMode) {
                         case 'train':
                         case 'bus':
                             return (travelModes.TRANSIT ?? 'TRANSIT') as google.maps.TravelMode;
                         case 'walk':
                             return (travelModes.WALKING ?? 'WALKING') as google.maps.TravelMode;
                         case 'bicycle':
                             return (travelModes.BICYCLING ?? 'BICYCLING') as google.maps.TravelMode;
                         case 'motorcycle':
                         case 'car':
                             return (travelModes.DRIVING ?? 'DRIVING') as google.maps.TravelMode;
                         default:
                             return null;
                     }
                 };

                 const wantsRealRoute = routeMode === 'realistic';
                 const primaryMode = getDirectionsMode(mode);
                 const useRealRoute = wantsRealRoute && !!primaryMode;

                 const requiresDirections = mode !== 'plane' && mode !== 'boat' && mode !== 'na';
                 if (wantsRealRoute && requiresDirections && !primaryMode) {
                     routingAttempted = true;
                     routingFailed = true;
                     if (travelItem && onRouteStatusRef.current) {
                         onRouteStatusRef.current(travelItem.id, 'failed', { mode, routeKey: cacheKey ?? undefined });
                     }
                 }

                 if (useRealRoute && primaryMode && cacheKey) {
                     const cached = ROUTE_CACHE.get(cacheKey);
                     const isCachedFailureFresh = cached?.status === 'failed' && (Date.now() - cached.updatedAt) < ROUTE_FAILURE_TTL_MS;

                     if (cached?.status === 'ok' && cached.path?.length) {
                         routingAttempted = true;
                         drawRoutePath(cached.path, startColor, 3);

                         if (mode !== 'na') {
                             const midPoint = cached.path[Math.floor(cached.path.length / 2)];
                             const offsetPos = getOffsetPosition(
                                 { lat: start.coordinates.lat, lng: start.coordinates.lng },
                                 { lat: end.coordinates.lat, lng: end.coordinates.lng },
                                 midPoint
                             );
                             const transportMarker = new window.google.maps.Marker({
                                 map: googleMapRef.current,
                                 position: offsetPos,
                                 icon: buildTransportIcon(mode, startColor),
                                 clickable: false,
                                 zIndex: 50
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

                     if (isCachedFailureFresh) {
                         routingAttempted = true;
                         routingFailed = true;
                         if (travelItem && onRouteStatusRef.current) {
                             onRouteStatusRef.current(travelItem.id, 'failed', { mode, routeKey: cacheKey });
                         }
                     } else {
                         routingAttempted = true;
                         if (travelItem && onRouteStatusRef.current) {
                             onRouteStatusRef.current(travelItem.id, 'calculating', { mode, routeKey: cacheKey });
                         }
                         const tryRoute = async (travelMode: google.maps.TravelMode) => {
                             const origin = { lat: start.coordinates.lat, lng: start.coordinates.lng };
                             const destination = { lat: end.coordinates.lat, lng: end.coordinates.lng };
                             const request: google.maps.DirectionsRequest = {
                                 origin,
                                 destination,
                                 travelMode
                             };

                             const isWalking = (
                                 travelMode === travelModes.WALKING ||
                                 travelMode === 'WALKING'
                             );
                             const isBicycling = (
                                 travelMode === travelModes.BICYCLING ||
                                 travelMode === 'BICYCLING'
                             );
                             if (isWalking) {
                                 request.avoidHighways = true;
                                 request.avoidTolls = true;
                             } else if (isBicycling) {
                                 request.avoidTolls = true;
                             }
                             if (travelMode === travelModes.TRANSIT || travelMode === 'TRANSIT') {
                                 const transitModeValues: google.maps.TransitMode[] = [];
                                 if (mode === 'train') {
                                     if (window.google.maps.TransitMode?.TRAIN) {
                                         transitModeValues.push(window.google.maps.TransitMode.TRAIN);
                                     }
                                     if (window.google.maps.TransitMode?.RAIL) {
                                         transitModeValues.push(window.google.maps.TransitMode.RAIL);
                                     }
                                 }
                                 if (mode === 'bus' && window.google.maps.TransitMode?.BUS) {
                                     transitModeValues.push(window.google.maps.TransitMode.BUS);
                                 }
                                 if (transitModeValues.length > 0) {
                                     request.transitOptions = { modes: transitModeValues };
                                 }
                             }

                             const result = await directionsService.route(request);
                             const rawPath = result.routes?.[0]?.overview_path;
                             const path = rawPath?.map((point) => ({ lat: point.lat(), lng: point.lng() }));

                             if (!path || path.length === 0) {
                                 throw new Error('No route path returned');
                             }
                             const geometry = window.google?.maps?.geometry?.spherical;
                             if (geometry) {
                                 const toLatLng = (point: google.maps.LatLngLiteral) => new window.google.maps.LatLng(point.lat, point.lng);
                                 const straightMeters = geometry.computeDistanceBetween(
                                     new window.google.maps.LatLng(origin.lat, origin.lng),
                                     new window.google.maps.LatLng(destination.lat, destination.lng)
                                 );
                                 let pathMeters = 0;
                                 for (let idx = 1; idx < path.length; idx++) {
                                     pathMeters += geometry.computeDistanceBetween(
                                         toLatLng(path[idx - 1]),
                                         toLatLng(path[idx])
                                     );
                                 }
                                 const ratio = straightMeters > 0 ? pathMeters / straightMeters : 0;
                                 if (path.length <= 2 || (ratio > 0 && ratio < 1.01)) {
                                     throw new Error('Route path is straight');
                                 }
                             } else if (path.length <= 2) {
                                 throw new Error('Route path is straight');
                             }

                             drawRoutePath(path, startColor, 3);

                             if (mode !== 'na') {
                                 const midPoint = path[Math.floor(path.length / 2)];
                                 const offsetPos = getOffsetPosition(
                                     { lat: start.coordinates.lat, lng: start.coordinates.lng },
                                     { lat: end.coordinates.lat, lng: end.coordinates.lng },
                                     midPoint
                                 );
                                 const transportMarker = new window.google.maps.Marker({
                                     map: googleMapRef.current,
                                     position: offsetPos,
                                     icon: buildTransportIcon(mode, startColor),
                                     clickable: false,
                                     zIndex: 50
                                 });
                                 transportMarkersRef.current.push(transportMarker);
                             }

                             const legs = result.routes?.[0]?.legs ?? [];
                             const distanceMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
                             const durationSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
                             const distanceKm = distanceMeters > 0 ? distanceMeters / 1000 : undefined;
                             const durationHours = durationSeconds > 0 ? durationSeconds / 3600 : undefined;

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

                         try {
                             await tryRoute(primaryMode);
                             continue;
                         } catch (e) {
                             routingFailed = true;
                             ROUTE_CACHE.set(cacheKey, { status: 'failed', updatedAt: Date.now() });
                             persistRouteCache();
                             if (travelItem && onRouteStatusRef.current) {
                                 onRouteStatusRef.current(travelItem.id, 'failed', { mode, routeKey: cacheKey });
                             }
                             console.warn(`Routing failed for ${mode}, falling back to line`, e);
                         }
                     }
                 }

                 // Fallback / Flight: Draw Geodesic Polyline
                 const isDashedFallback = mode !== 'plane';
                 const arrowIcon = { 
                     path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, 
                     strokeColor: startColor, 
                     strokeOpacity: 0.9,
                     scale: 2.5 
                 };
                 const icons = isDashedFallback
                     ? [
                         {
                             icon: { path: 'M 0,-1 0,1', strokeColor: startColor, strokeOpacity: 0.9, scale: 2.5 },
                             offset: '0',
                             repeat: '12px'
                         },
                         { icon: arrowIcon, offset: '50%' }
                       ]
                     : [{ icon: arrowIcon, offset: '50%' }];
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

                 const mid = {
                     lat: (start.coordinates.lat + end.coordinates.lat) / 2,
                     lng: (start.coordinates.lng + end.coordinates.lng) / 2
                 };
                 if (mode !== 'na') {
                     const offsetPos = getOffsetPosition(
                         { lat: start.coordinates.lat, lng: start.coordinates.lng },
                         { lat: end.coordinates.lat, lng: end.coordinates.lng },
                         mid
                     );
                     const transportMarker = new window.google.maps.Marker({
                         map: googleMapRef.current,
                         position: offsetPos,
                         icon: buildTransportIcon(mode, startColor),
                         clickable: false,
                         zIndex: 50
                     });
                     transportMarkersRef.current.push(transportMarker);
                 }
             }
        };

        if (!isPaywalled) {
            drawRoutes();
        }

    }, [mapInitialized, mapRenderSignature, selectedCityId, routeMode, showCityNames, isPaywalled, activeStyle]); 

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
        if (!googleMapRef.current || cities.length === 0) return;

        const bounds = new window.google.maps.LatLngBounds();
        cities.forEach(city => {
            if (city.coordinates) {
                bounds.extend({ lat: city.coordinates.lat, lng: city.coordinates.lng });
            }
        });
        googleMapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    };

    // Auto fit on load
    useEffect(() => {
        if (mapInitialized && cities.length > 0) {
           setTimeout(handleFit, 200); 
        }
    }, [mapInitialized]);

    // Re-center when an external "active route" key changes (e.g., opening a different saved plan).
    useEffect(() => {
        if (!fitToRouteKey || !mapInitialized || cities.length === 0) return;
        if (lastFitToRouteKeyRef.current === fitToRouteKey) return;

        lastFitToRouteKeyRef.current = fitToRouteKey;
        const timer = setTimeout(handleFit, 200);
        return () => clearTimeout(timer);
    }, [fitToRouteKey, mapInitialized, cities.length]);

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

    if (loadError) {
        return (
            <div
                className="p-4 text-red-500"
                style={viewTransitionName ? ({ viewTransitionName } as React.CSSProperties) : undefined}
            >
                Error loading map: {loadError.message}
            </div>
        );
    }
    if (!isLoaded) {
        return (
            <div
                className="w-full h-full bg-gray-100 flex items-center justify-center"
                style={viewTransitionName ? ({ viewTransitionName } as React.CSSProperties) : undefined}
            >
                Loading Map...
            </div>
        );
    }

    return (
        <div
            className="relative w-full h-full group bg-gray-100"
            style={viewTransitionName ? ({ viewTransitionName } as React.CSSProperties) : undefined}
        >
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Controls */}
            <div className="absolute top-4 right-4 z-[10] flex flex-col gap-2 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">
                    {showLayoutControls && onLayoutChange && (
                        <>
                            <button
                                onClick={() => onLayoutChange('vertical')}
                                className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'vertical' ? 'bg-accent-600 text-white border-accent-700' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`} aria-label="Vertical layout"
                            ><Rows size={18} /></button>
                            <button
                                onClick={() => onLayoutChange('horizontal')}
                                className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'horizontal' ? 'bg-accent-600 text-white border-accent-700' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`} aria-label="Horizontal layout"
                            ><Columns size={18} /></button>
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
                        className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50 transition-colors flex items-center justify-center" aria-label="Fit to itinerary"
                    ><Focus size={18} /></button>
                    
                    {/* Style Switcher */}
                    {onStyleChange && (
                      <div className="relative">
                          <button
                              onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)}
                              className={`p-2 rounded-lg shadow-md border transition-colors flex items-center justify-center ${isStyleMenuOpen ? 'bg-accent-50 border-accent-300 text-accent-600' : 'bg-white border-gray-200 text-gray-600 hover:text-accent-600 hover:bg-gray-50'}`} aria-label="Map style"
                          ><Layers size={18} /></button>
                          {isStyleMenuOpen && (
                              <div className="absolute top-0 right-full mr-2 bg-white rounded-lg shadow-xl border border-gray-100 w-36 overflow-hidden flex flex-col z-20">
                                  <button onClick={() => { onStyleChange('minimal'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'minimal' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Minimal</button>
                                  <button onClick={() => { onStyleChange('standard'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'standard' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Standard</button>
                                  <button onClick={() => { onStyleChange('dark'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'dark' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Dark</button>
                                  <button onClick={() => { onStyleChange('satellite'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'satellite' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Satellite</button>
                                  <button onClick={() => { onStyleChange('clean'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'clean' ? 'text-accent-600 bg-accent-50' : 'text-gray-700'}`}>Clean</button>
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
