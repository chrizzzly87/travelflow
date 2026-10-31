/** Google Maps JSON styles for each named map style. Moved verbatim from `ItineraryMap.tsx`. */

export const MAP_STYLES = {
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
