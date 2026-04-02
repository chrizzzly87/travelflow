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
