import type { ICoordinates } from '../types';

export type DirectionsPlatform = 'ios' | 'android' | 'web';

export interface DirectionsTarget {
    /** Coordinates when the stop has them; a place query is used otherwise. */
    coordinates?: ICoordinates | null;
    /** Human-readable destination, used as the map pin label or the search term. */
    label: string;
}

export interface DirectionsLinks {
    /**
     * Android's `geo:` scheme. Android shows its own "open with" chooser for
     * this, which is the native picker between Google Maps, Waze and the rest.
     */
    geoUri: string;
    appleMapsUrl: string;
    googleMapsUrl: string;
}

const isFiniteCoordinate = (coordinates: ICoordinates | null | undefined): coordinates is ICoordinates => (
    Boolean(coordinates)
    && Number.isFinite(coordinates!.lat)
    && Number.isFinite(coordinates!.lng)
    && Math.abs(coordinates!.lat) <= 90
    && Math.abs(coordinates!.lng) <= 180
);

/**
 * Resolves the platform from a user-agent string.
 *
 * Only Android exposes a system chooser for map links, so the caller needs to
 * know where it is: iOS has to be offered the choice in-app, and a desktop
 * browser gets a normal web link.
 */
export const resolveDirectionsPlatform = (userAgent: string | undefined): DirectionsPlatform => {
    const ua = (userAgent || '').toLowerCase();
    if (!ua) return 'web';
    if (/android/.test(ua)) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    // iPadOS reports a desktop Safari UA and is only distinguishable by touch.
    if (/macintosh/.test(ua) && typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 1) return 'ios';
    return 'web';
};

export const buildDirectionsLinks = (target: DirectionsTarget): DirectionsLinks | null => {
    const label = target.label.trim();
    const coordinates = isFiniteCoordinate(target.coordinates) ? target.coordinates : null;
    if (!coordinates && !label) return null;

    if (coordinates) {
        const pair = `${coordinates.lat},${coordinates.lng}`;
        // The label in parentheses is what Android shows on the dropped pin.
        const geoQuery = label ? `${pair}(${label})` : pair;
        return {
            geoUri: `geo:${pair}?q=${encodeURIComponent(geoQuery)}`,
            appleMapsUrl: `maps://?daddr=${encodeURIComponent(pair)}&dirflg=d`,
            googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pair)}`,
        };
    }

    return {
        geoUri: `geo:0,0?q=${encodeURIComponent(label)}`,
        appleMapsUrl: `maps://?daddr=${encodeURIComponent(label)}&dirflg=d`,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(label)}`,
    };
};

/**
 * Builds the destination label for an activity.
 *
 * Activities often carry no coordinates of their own — the map falls back to
 * the city — so the query has to name the city too, or "Belem" lands anywhere.
 */
export const buildActivityDirectionsLabel = (
    activityTitle: string,
    activityLocation: string | undefined,
    cityTitle: string | undefined,
): string => {
    const place = activityLocation?.trim() || activityTitle?.trim() || '';
    const city = cityTitle?.trim() || '';
    if (!city) return place;
    if (!place) return city;

    // A stored address usually already ends with the city, and repeating it
    // ("Rua de Belém 84, Lisbon, Lisbon") makes the search term worse.
    if (place.toLowerCase().includes(city.toLowerCase())) return place;
    return `${place}, ${city}`;
};
