import type { AppLanguage, ICoordinates } from '../types';
import { getGoogleMapsApiKey } from '../utils';
import {
  resolveCitySuggestion as resolveGoogleCitySuggestion,
  searchCitySuggestions as searchGoogleCitySuggestions,
  type CityLookupSuggestion,
} from '../shared/cityLookup';
import { getClientMapRuntimeResolution } from './mapRuntimeService';

export type { CityLookupSuggestion } from '../shared/cityLookup';

export interface HotelSearchResult {
  id: string;
  name: string;
  address: string;
}

export interface CountryLookupMatch {
  code: string;
  name: string;
}

type HotelSearchByTextResponseShape = {
  places?: Array<{
    id?: string;
    displayName?: string | { text?: string };
    formattedAddress?: string;
  }>;
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const resolvePlaceDisplayName = (displayName: unknown): string => {
  if (typeof displayName === 'string') return displayName.trim();
  if (displayName && typeof displayName === 'object') {
    const text = (displayName as { text?: unknown }).text;
    if (typeof text === 'string') return text.trim();
  }
  return '';
};

const getActiveLocationSearchImplementation = () => (
  getClientMapRuntimeResolution().effectiveSelection.locationSearch
);

export const mapSearchByTextPlacesToHotelResults = (
  response: HotelSearchByTextResponseShape | null | undefined,
): HotelSearchResult[] => {
  const places = Array.isArray(response?.places) ? response.places : [];
  return places
    .map((place) => {
      const name = resolvePlaceDisplayName(place?.displayName) || 'Hotel';
      const address = normalizeText(place?.formattedAddress);
      const id = normalizeText(place?.id) || `${name}-${address}`;
      return {
        id,
        name,
        address,
      };
    })
    .filter((result) => result.id.length > 0)
    .slice(0, 5);
};

export const searchCitySuggestions = async (
  query: string,
  options?: { language?: AppLanguage; maxResults?: number },
): Promise<CityLookupSuggestion[]> => {
  const implementation = getActiveLocationSearchImplementation();
  if (implementation !== 'google') {
    return [];
  }
  return searchGoogleCitySuggestions(query, options);
};

export const resolveCitySuggestion = async (
  query: string,
  options?: { language?: AppLanguage },
): Promise<CityLookupSuggestion | null> => {
  const implementation = getActiveLocationSearchImplementation();
  if (implementation !== 'google') {
    return null;
  }
  return resolveGoogleCitySuggestion(query, options);
};

export const searchHotelSuggestions = async (
  query: string,
  options?: { language?: AppLanguage; maxResults?: number; includedType?: string },
): Promise<HotelSearchResult[]> => {
  const implementation = getActiveLocationSearchImplementation();
  if (implementation !== 'google') return [];

  const trimmedQuery = query.trim();
  if (!trimmedQuery || typeof window === 'undefined' || !window.google?.maps) return [];

  const importLibrary = window.google.maps.importLibrary;
  if (typeof importLibrary !== 'function') return [];

  try {
    const placesLibrary = await importLibrary('places' as never) as {
      Place?: {
        searchByText?: (request: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const searchByText = placesLibrary?.Place?.searchByText;
    if (typeof searchByText !== 'function') return [];

    const response = await searchByText({
      textQuery: trimmedQuery,
      includedType: options?.includedType ?? 'lodging',
      maxResultCount: Math.max(1, options?.maxResults ?? 5),
      fields: ['id', 'displayName', 'formattedAddress'],
      language: options?.language,
    }) as HotelSearchByTextResponseShape;

    return mapSearchByTextPlacesToHotelResults(response);
  } catch {
    return [];
  }
};

export interface PlaceLocationMatch {
  coordinates: ICoordinates;
  placeId?: string;
  formattedAddress?: string;
}

type SearchByTextLocationShape = {
  places?: Array<{
    id?: string;
    formattedAddress?: string;
    location?: { lat?: unknown; lng?: unknown } | null;
  }>;
};

const readLatLng = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'function') {
    // The Places JS objects expose lat()/lng() rather than plain numbers.
    const result = (value as () => unknown)();
    return typeof result === 'number' && Number.isFinite(result) ? result : null;
  }
  return null;
};

export const mapSearchByTextPlacesToLocation = (
  response: SearchByTextLocationShape | null | undefined,
): PlaceLocationMatch | null => {
  const place = Array.isArray(response?.places) ? response.places[0] : null;
  if (!place) return null;
  const lat = readLatLng(place.location?.lat);
  const lng = readLatLng(place.location?.lng);
  if (lat === null || lng === null) return null;
  return {
    coordinates: { lat, lng },
    placeId: normalizeText(place.id) || undefined,
    formattedAddress: normalizeText(place.formattedAddress) || undefined,
  };
};

/**
 * Resolves a named place ("Taipei 101, Taipei") to a position plus its Place ID.
 *
 * Text search is preferred over plain geocoding because an activity is usually a
 * venue rather than an address, and because the Place ID it returns lets the
 * maps deep links open that exact listing. Geocoding stays as the fallback for
 * queries that are really addresses.
 */
export const searchPlaceLocation = async (
  query: string,
  options?: { language?: AppLanguage; bias?: ICoordinates | null },
): Promise<PlaceLocationMatch | null> => {
  const implementation = getActiveLocationSearchImplementation();
  if (implementation !== 'google') return null;

  const trimmedQuery = query.trim();
  if (!trimmedQuery || typeof window === 'undefined' || !window.google?.maps) return null;

  const importLibrary = window.google.maps.importLibrary;
  if (typeof importLibrary === 'function') {
    try {
      const placesLibrary = await importLibrary('places' as never) as {
        Place?: { searchByText?: (request: Record<string, unknown>) => Promise<unknown> };
      };
      const searchByText = placesLibrary?.Place?.searchByText;
      if (typeof searchByText === 'function') {
        const request: Record<string, unknown> = {
          textQuery: trimmedQuery,
          maxResultCount: 1,
          fields: ['id', 'location', 'formattedAddress'],
          language: options?.language,
        };
        if (options?.bias) {
          // Keeps "Central Park" in the city being planned rather than the
          // first global match.
          request.locationBias = {
            circle: { center: options.bias, radius: 50_000 },
          };
        }
        const response = await searchByText(request) as SearchByTextLocationShape;
        const match = mapSearchByTextPlacesToLocation(response);
        if (match) return match;
      }
    } catch {
      // Fall through to geocoding.
    }
  }

  const coordinates = await geocodeAddressQuery(trimmedQuery);
  return coordinates ? { coordinates } : null;
};

export const geocodeAddressQuery = async (
  query: string,
): Promise<ICoordinates | null> => {
  const implementation = getActiveLocationSearchImplementation();
  if (implementation !== 'google') return null;

  const trimmedQuery = query.trim();
  if (!trimmedQuery || typeof window === 'undefined' || !window.google?.maps?.Geocoder) {
    return null;
  }

  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: trimmedQuery }, (results, status) => {
      if (status !== 'OK' || !results?.[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const location = results[0].geometry.location;
      resolve({
        lat: location.lat(),
        lng: location.lng(),
      });
    });
  });
};

export const reverseGeocodeCountry = async (
  lat: number,
  lng: number,
): Promise<CountryLookupMatch | null> => {
  const implementation = getActiveLocationSearchImplementation();
  if (implementation !== 'google') return null;

  const apiKey = getGoogleMapsApiKey().trim();
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&result_type=country&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const components = Array.isArray(results[0]?.address_components) ? results[0].address_components : [];
    const countryComponent = components.find((component: unknown) => {
      if (!component || typeof component !== 'object') return false;
      const types = Array.isArray((component as { types?: unknown[] }).types)
        ? (component as { types?: unknown[] }).types
        : [];
      return types.includes('country');
    }) as { short_name?: unknown; long_name?: unknown } | undefined;

    const code = normalizeText(countryComponent?.short_name).toUpperCase();
    const name = normalizeText(countryComponent?.long_name);
    if (!code || !name) return null;
    return { code, name };
  } catch {
    return null;
  }
};
