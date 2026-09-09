import type { ICoordinates } from '../types';

/**
 * Builds the "open this place in a maps app" links used by the activity popup,
 * the details panel and the stay rows.
 *
 * Only universal https links are produced. The app-specific schemes
 * (`comgooglemaps://`, `geo:`) dead-end on a device that does not have the app
 * installed, while `google.com/maps` and `maps.apple.com` hand off to the
 * native app when it is there and fall back to the web map when it is not — so
 * the same href works on a phone and on a desktop with no platform sniffing.
 */

export interface MapDeepLinkTarget {
  /** Place name, e.g. the activity or stay title. */
  title?: string;
  /** Free-text location or address. */
  location?: string;
  coordinates?: ICoordinates | null;
  /** Google Place ID, when one was resolved. Pins the link to the exact place. */
  placeId?: string;
}

export interface MapDeepLinks {
  google: string;
  apple: string;
  /** True when the links point at an exact position rather than a text search. */
  isPrecise: boolean;
  /** The text used when falling back to a search, exposed for labels and tests. */
  searchQuery: string;
}

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/';
const APPLE_MAPS_URL = 'https://maps.apple.com/';

const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const hasFiniteCoordinates = (
  coordinates: ICoordinates | null | undefined,
): coordinates is ICoordinates => (
  Boolean(coordinates)
  && Number.isFinite(coordinates.lat)
  && Number.isFinite(coordinates.lng)
);

/**
 * Six decimals is roughly 10cm — more than a map pin needs, and it keeps the
 * links short and stable enough to compare in tests.
 */
const formatLatLng = (coordinates: ICoordinates): string => (
  `${Number(coordinates.lat.toFixed(6))},${Number(coordinates.lng.toFixed(6))}`
);

/**
 * "Louvre, Paris, France" — the title alone is too ambiguous for a search
 * fallback, and the location alone loses the place the traveller picked.
 */
export const buildMapSearchQuery = (target: MapDeepLinkTarget): string => {
  const title = trimmed(target.title);
  const location = trimmed(target.location);
  if (!title) return location;
  if (!location) return title;
  // A location that already repeats the title would produce "Louvre, Louvre".
  if (location.toLocaleLowerCase().includes(title.toLocaleLowerCase())) return location;
  return `${title}, ${location}`;
};

export const canOpenInMaps = (target: MapDeepLinkTarget): boolean => (
  hasFiniteCoordinates(target.coordinates) || buildMapSearchQuery(target).length > 0
);

export const buildMapDeepLinks = (target: MapDeepLinkTarget): MapDeepLinks | null => {
  const coordinates = hasFiniteCoordinates(target.coordinates) ? target.coordinates : null;
  const searchQuery = buildMapSearchQuery(target);
  if (!coordinates && !searchQuery) return null;

  const placeId = trimmed(target.placeId);
  const label = trimmed(target.title) || searchQuery;

  const googleParams = new URLSearchParams({ api: '1' });
  if (coordinates) {
    // With a place id Google resolves the exact listing; the coordinates stay
    // in `query` so the link still lands somewhere sane without it.
    googleParams.set('query', formatLatLng(coordinates));
    if (placeId) googleParams.set('query_place_id', placeId);
  } else {
    googleParams.set('query', searchQuery);
  }

  const appleParams = new URLSearchParams();
  if (coordinates) {
    // `ll` positions the map, `q` labels the dropped pin.
    appleParams.set('q', label || searchQuery);
    appleParams.set('ll', formatLatLng(coordinates));
  } else {
    appleParams.set('q', searchQuery);
  }

  return {
    google: `${GOOGLE_MAPS_SEARCH_URL}?${googleParams.toString()}`,
    apple: `${APPLE_MAPS_URL}?${appleParams.toString()}`,
    isPrecise: Boolean(coordinates),
    searchQuery,
  };
};
