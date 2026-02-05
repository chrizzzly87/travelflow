import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ITimelineItem, MapStyle, RouteMode } from '../types';
import { Focus, Columns, Rows, Layers } from 'lucide-react';
import { findTravelBetweenCities, getHexFromColorClass, getNormalizedCityName } from '../utils';
import { useGoogleMaps } from './GoogleMapsLoader';

interface ItineraryMapProps {
    items: ITimelineItem[];
    selectedItemId?: string | null;
    layoutMode?: 'horizontal' | 'vertical';
    onLayoutChange?: (mode: 'horizontal' | 'vertical') => void;
    activeStyle?: MapStyle;
    onStyleChange?: (style: MapStyle) => void;
    routeMode?: RouteMode;
    onRouteModeChange?: (mode: RouteMode) => void;
    showCityNames?: boolean;
    onShowCityNamesChange?: (enabled: boolean) => void;
    focusLocationQuery?: string;
    fitToRouteKey?: string;
}

const MAP_STYLES = {
    // "Pale Dawn" - Very clean, grayscale, high contrast for overlays
    minimal: [
        { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
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
        { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
        {
            "featureType": "administrative.locality",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#d59563" }]
        },
        {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#d59563" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{ "color": "#263c3f" }]
        },
        {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#6b9a76" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{ "color": "#38414e" }]
        },
        {
            "featureType": "road",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#212a37" }]
        },
        {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#9ca5b3" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [{ "color": "#746855" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#1f2835" }]
        },
        {
            "featureType": "road.highway",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#f3d19c" }]
        },
        {
            "featureType": "transit",
            "elementType": "geometry",
            "stylers": [{ "color": "#2f3948" }]
        },
        {
            "featureType": "transit.station",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#d59563" }]
        },
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#17263c" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#515c6d" }]
        },
        {
            "featureType": "water",
            "elementType": "labels.text.stroke",
            "stylers": [{ "color": "#17263c" }]
        }
    ],
    clean: [
        { "elementType": "geometry", "stylers": [{ "color": "#f9f9f9" }] },
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
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e3f2fd" }] }, // Very light blue
        { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
    ]
};

export const ItineraryMap: React.FC<ItineraryMapProps> = ({ 
    items, 
    selectedItemId, 
    layoutMode, 
    onLayoutChange, 
    activeStyle = 'clean', 
    onStyleChange,
    routeMode = 'simple',
    onRouteModeChange,
    showCityNames = true,
    onShowCityNamesChange,
    focusLocationQuery,
    fitToRouteKey
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null); // google.maps.Map
    const markersRef = useRef<any[]>([]); // google.maps.Marker[]
    const routesRef = useRef<any[]>([]); // stored polylines/renderers
    const transportMarkersRef = useRef<any[]>([]); // google.maps.Marker[]
    const cityLabelOverlaysRef = useRef<any[]>([]);
    const lastFocusQueryRef = useRef<string | null>(null);
    const lastFitToRouteKeyRef = useRef<string | null>(null);
    
    const { isLoaded, loadError } = useGoogleMaps();
    const [mapInitialized, setMapInitialized] = useState(false);
    
    // Internal state for menu, but style comes from props (or defaults to minimal if not provided)
    const [isStyleMenuOpen, setIsStyleMenuOpen] = useState(false);

    // Initial Map Setup
    useEffect(() => {
        if (!isLoaded || !mapRef.current || googleMapRef.current) return;

        try {
            googleMapRef.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: 20, lng: 0 },
                zoom: 2,
                disableDefaultUI: true,
                gestureHandling: 'cooperative',
                styles: MAP_STYLES.clean // Default start, updated immediately by next effect
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
                const mode = travelItem?.transportMode || 'na';
                return `${city.id}->${nextCity.id}:${mode}`;
            })
            .join('||');
        return `${citySignature}__${routeSignature}`;
    }, [cities, items]);

    // Helper: Find transport mode between cities
    const getTransportBetween = (city1: ITimelineItem, city2: ITimelineItem) => {
        const travelItem = findTravelBetweenCities(items, city1, city2);
        return travelItem?.transportMode || 'na';
    };

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
                case 'plane':
                default:
                    return `<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />`;
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

        // 2. Add Markers
        cities.forEach((city, index) => {
            if (!city.coordinates) return;
            
            const isSelected = city.id === selectedCityId;
            const marker = new window.google.maps.Marker({
                map: googleMapRef.current,
                position: { lat: city.coordinates.lat, lng: city.coordinates.lng },
                title: city.title,
                label: { 
                    text: `${index + 1}`, 
                    color: '#ffffff', 
                    fontWeight: '700', 
                    fontSize: isSelected ? '14px' : '12px' 
                },
                icon: buildPinIcon(getHexFromColorClass(city.color), isSelected),
                zIndex: isSelected ? 100 : 10,
            });
            
            markersRef.current.push(marker);
        });

        if (showCityNames && googleMapRef.current) {
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
                        subEl.style.color = '#4f46e5';
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
             const directionsService = new window.google.maps.DirectionsService();

             for (let i = 0; i < cities.length - 1; i++) {
                 const start = cities[i];
                 const end = cities[i+1];
                 if (!start.coordinates || !end.coordinates) continue;

                 const mode = getTransportBetween(start, end);
                 const startColor = getHexFromColorClass(start.color); // Color based on start city

                 const useRealRoute = routeMode === 'realistic' && ['car', 'bus', 'train'].includes(mode);

                 if (useRealRoute) {
                     let primaryMode = window.google.maps.TravelMode.DRIVING;
                     if (mode === 'train' || mode === 'bus') primaryMode = window.google.maps.TravelMode.TRANSIT;

                     const tryRoute = async (travelMode: google.maps.TravelMode) => {
                         const result = await directionsService.route({
                             origin: { lat: start.coordinates.lat, lng: start.coordinates.lng },
                             destination: { lat: end.coordinates.lat, lng: end.coordinates.lng },
                             travelMode
                         });

                         const path = result.routes?.[0]?.overview_path;
                         const shouldUseTransitPolylineOnly =
                             routeMode === 'realistic' &&
                             (mode === 'train' || mode === 'bus') &&
                             travelMode === window.google.maps.TravelMode.TRANSIT;

                         if (shouldUseTransitPolylineOnly && path?.length) {
                             const line = new window.google.maps.Polyline({
                                 path,
                                 geodesic: true,
                                 strokeColor: startColor,
                                 strokeOpacity: 0.7,
                                 strokeWeight: 3,
                                 clickable: false,
                                 icons: [{
                                     icon: {
                                         path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                         strokeColor: startColor,
                                         strokeOpacity: 0.9,
                                         scale: 2.5
                                     },
                                     offset: '50%'
                                 }],
                                 map: googleMapRef.current
                             });
                             routesRef.current.push(line);
                         } else {
                             const renderer = new window.google.maps.DirectionsRenderer({
                                 map: googleMapRef.current,
                                 directions: result,
                                 suppressMarkers: true,
                                 suppressInfoWindows: true,
                                 preserveViewport: true,
                                 polylineOptions: {
                                     strokeColor: startColor,
                                     strokeOpacity: 0.7,
                                     strokeWeight: 3,
                                     clickable: false,
                                     icons: [{
                                         icon: {
                                             path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                             strokeColor: startColor,
                                             strokeOpacity: 0.9,
                                             scale: 2.5
                                         },
                                         offset: '50%'
                                     }]
                                 }
                             });
                             routesRef.current.push(renderer);
                         }

                         if (mode !== 'na' && path && path.length) {
                             const midPoint = path[Math.floor(path.length / 2)];
                             const mid = { lat: midPoint.lat(), lng: midPoint.lng() };
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
                     };

                     try {
                         await tryRoute(primaryMode);
                         continue;
                     } catch (e) {
                         // Transit can fail for long distances or low coverage; fallback to driving
                         if (primaryMode === window.google.maps.TravelMode.TRANSIT) {
                             try {
                                 await tryRoute(window.google.maps.TravelMode.DRIVING);
                                 continue;
                             } catch (e2) {
                                 console.warn("Routing failed, falling back to line", e2);
                             }
                         } else {
                             console.warn("Routing failed, falling back to line", e);
                         }
                     }
                 }

                 // Fallback / Flight: Draw Geodesic Polyline
                 const line = new window.google.maps.Polyline({
                     path: [
                         { lat: start.coordinates.lat, lng: start.coordinates.lng },
                         { lat: end.coordinates.lat, lng: end.coordinates.lng }
                     ],
                     geodesic: true,
                     strokeColor: startColor,
                     strokeOpacity: 0.6,
                     strokeWeight: 2,
                     clickable: false,
                     icons: [{
                         icon: { 
                             path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, 
                             strokeColor: startColor, 
                             strokeOpacity: 0.9,
                             scale: 2.5 
                         },
                         offset: '50%'
                     }],
                     map: googleMapRef.current
                 });
                 routesRef.current.push(line);

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

        drawRoutes();

    }, [mapInitialized, mapRenderSignature, selectedCityId, routeMode, showCityNames]); 

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
    useEffect(() => {
        const query = focusLocationQuery?.trim();
        if (!query || !mapInitialized || !googleMapRef.current || cities.length > 0) return;
        if (!window.google?.maps?.Geocoder) return;
        if (lastFocusQueryRef.current === query) return;

        lastFocusQueryRef.current = query;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: query }, (results, status) => {
            if (status !== 'OK' || !results?.length) return;
            const match = results[0];
            if (match.geometry?.viewport) {
                googleMapRef.current.fitBounds(match.geometry.viewport);
                return;
            }
            if (match.geometry?.location) {
                googleMapRef.current.setCenter(match.geometry.location);
                googleMapRef.current.setZoom(5);
            }
        });
    }, [focusLocationQuery, mapInitialized, cities.length]);

    if (loadError) return <div className="p-4 text-red-500">Error loading map: {loadError.message}</div>;
    if (!isLoaded) return <div className="w-full h-full bg-gray-100 flex items-center justify-center">Loading Map...</div>;

    return (
        <div className="relative w-full h-full group bg-gray-100">
            <div ref={mapRef} className="w-full h-full" />
            
            {/* Controls */}
            <div className="absolute top-4 right-4 z-[10] flex flex-col gap-2 pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto">
                    {onLayoutChange && (
                        <>
                            <button onClick={() => onLayoutChange('vertical')} className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'vertical' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><Rows size={18} /></button>
                            <button onClick={() => onLayoutChange('horizontal')} className={`p-2 rounded-lg shadow-md border transition-colors ${layoutMode === 'horizontal' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`}><Columns size={18} /></button>
                        </>
                    )}
                    
                    <button onClick={handleFit} className="p-2 rounded-lg shadow-md border bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors flex items-center justify-center" title="Fit to Itinerary"><Focus size={18} /></button>
                    
                    {/* Style Switcher */}
                    {onStyleChange && (
                      <div className="relative">
                          <button onClick={() => setIsStyleMenuOpen(!isStyleMenuOpen)} className={`p-2 rounded-lg shadow-md border transition-colors flex items-center justify-center ${isStyleMenuOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:text-indigo-600 hover:bg-gray-50'}`} title="Map Style"><Layers size={18} /></button>
                          {isStyleMenuOpen && (
                              <div className="absolute top-0 right-full mr-2 bg-white rounded-lg shadow-xl border border-gray-100 w-36 overflow-hidden flex flex-col z-20">
                                  <button onClick={() => { onStyleChange('minimal'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'minimal' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Minimal</button>
                                  <button onClick={() => { onStyleChange('standard'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'standard' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Standard</button>
                                  <button onClick={() => { onStyleChange('dark'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'dark' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Dark</button>
                                  <button onClick={() => { onStyleChange('satellite'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'satellite' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Satellite</button>
                                  <button onClick={() => { onStyleChange('clean'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${activeStyle === 'clean' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Clean</button>
                                  {onRouteModeChange && (
                                      <>
                                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">Routes</div>
                                          <button onClick={() => { onRouteModeChange('simple'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${routeMode === 'simple' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Simple</button>
                                          <button onClick={() => { onRouteModeChange('realistic'); setIsStyleMenuOpen(false); }} className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${routeMode === 'realistic' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}>Realistic</button>
                                      </>
                                  )}
                                  {onShowCityNamesChange && (
                                      <>
                                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">Labels</div>
                                          <button
                                              onClick={() => { onShowCityNamesChange(!showCityNames); setIsStyleMenuOpen(false); }}
                                              className={`px-3 py-2 text-xs font-medium text-left hover:bg-gray-50 ${showCityNames ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700'}`}
                                          >
                                              City names {showCityNames ? 'On' : 'Off'}
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
