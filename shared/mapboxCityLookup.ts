import type { AppLanguage } from '../types';
import type { CityLookupSuggestion } from './cityLookup';

const MAPBOX_FORWARD_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward';

interface MapboxCityLookupOptions {
  accessToken: string;
  language?: AppLanguage;
  fetchImpl?: typeof fetch;
}

type MapboxForwardFeature = {
  properties?: {
    mapbox_id?: unknown;
    name?: unknown;
    full_address?: unknown;
    place_formatted?: unknown;
    coordinates?: { latitude?: unknown; longitude?: unknown } | null;
    context?: { country?: { name?: unknown; country_code?: unknown } | null } | null;
  } | null;
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const mapFeatureToSuggestion = (feature: MapboxForwardFeature): CityLookupSuggestion | null => {
  const properties = feature?.properties;
  if (!properties) return null;

  const id = normalizeText(properties.mapbox_id);
  const name = normalizeText(properties.name);
  const lat = properties.coordinates?.latitude;
  const lng = properties.coordinates?.longitude;
  if (!id || !name || typeof lat !== 'number' || typeof lng !== 'number'
    || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const countryName = normalizeText(properties.context?.country?.name);
  const countryCode = normalizeText(properties.context?.country?.country_code).toUpperCase();

  return {
    id,
    name,
    label: normalizeText(properties.full_address) || normalizeText(properties.place_formatted) || name,
    coordinates: { lat, lng },
    ...(countryName ? { countryName } : {}),
    ...(countryCode ? { countryCode } : {}),
  };
};

export const searchMapboxCitySuggestions = async (
  query: string,
  options: MapboxCityLookupOptions & { maxResults?: number },
): Promise<CityLookupSuggestion[]> => {
  const trimmedQuery = query.trim();
  const accessToken = options.accessToken.trim();
  if (!trimmedQuery || !accessToken) return [];

  const params = new URLSearchParams({
    q: trimmedQuery,
    types: 'place',
    limit: String(Math.min(10, Math.max(1, options.maxResults ?? 5))),
    // Results are stored in trips (name and coordinates), which the temporary endpoint does not allow.
    permanent: 'true',
  });
  if (options.language) params.set('language', options.language);
  params.set('access_token', accessToken);

  try {
    const response = await (options.fetchImpl ?? fetch)(`${MAPBOX_FORWARD_GEOCODE_URL}?${params.toString()}`);
    if (!response.ok) return [];
    const body = await response.json() as { features?: MapboxForwardFeature[] } | null;
    const features = Array.isArray(body?.features) ? body.features : [];
    return features
      .map(mapFeatureToSuggestion)
      .filter((suggestion): suggestion is CityLookupSuggestion => suggestion !== null);
  } catch {
    return [];
  }
};

export const resolveMapboxCitySuggestion = async (
  query: string,
  options: MapboxCityLookupOptions,
): Promise<CityLookupSuggestion | null> => {
  const [first] = await searchMapboxCitySuggestions(query, { ...options, maxResults: 1 });
  return first ?? null;
};
