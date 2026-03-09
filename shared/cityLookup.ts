import type { AppLanguage, ICoordinates } from '../types';

export interface CityLookupSuggestion {
  id: string;
  name: string;
  label: string;
  coordinates: ICoordinates;
  countryName?: string;
  countryCode?: string;
}

type AddressComponentLike = {
  long_name?: unknown;
  short_name?: unknown;
  longText?: unknown;
  shortText?: unknown;
  types?: unknown;
};

type SearchByTextResponseShape = {
  places?: Array<{
    id?: unknown;
    displayName?: unknown;
    formattedAddress?: unknown;
    location?: unknown;
    addressComponents?: unknown;
  }>;
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeCoordinates = (location: unknown): ICoordinates | null => {
  if (!location || typeof location !== 'object') return null;
  const latValue = (location as { lat?: unknown }).lat;
  const lngValue = (location as { lng?: unknown }).lng;

  if (typeof latValue === 'number' && Number.isFinite(latValue) && typeof lngValue === 'number' && Number.isFinite(lngValue)) {
    return { lat: latValue, lng: lngValue };
  }

  if (typeof latValue === 'function' && typeof lngValue === 'function') {
    const latFromFn = latValue();
    const lngFromFn = lngValue();
    if (typeof latFromFn === 'number' && Number.isFinite(latFromFn) && typeof lngFromFn === 'number' && Number.isFinite(lngFromFn)) {
      return { lat: latFromFn, lng: lngFromFn };
    }
  }

  return null;
};

const normalizeAddressComponents = (raw: unknown): AddressComponentLike[] => (
  Array.isArray(raw)
    ? raw.filter((item): item is AddressComponentLike => Boolean(item && typeof item === 'object'))
    : []
);

const resolveCountryFromAddressComponents = (components: AddressComponentLike[]): { countryName?: string; countryCode?: string } => {
  const country = components.find((component) => {
    const types = Array.isArray(component.types) ? component.types : [];
    return types.includes('country');
  });
  if (!country) return {};

  const countryName = normalizeText(country.longText) || normalizeText(country.long_name);
  const countryCode = normalizeText(country.shortText) || normalizeText(country.short_name);
  return {
    countryName: countryName || undefined,
    countryCode: countryCode || undefined,
  };
};

const resolveCountryFromLabel = (label: string): { countryName?: string } => {
  const parts = label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return {};
  const countryName = parts[parts.length - 1];
  return { countryName: countryName || undefined };
};

const resolveDisplayName = (displayName: unknown): string => {
  if (typeof displayName === 'string') return displayName.trim();
  if (displayName && typeof displayName === 'object') {
    const text = normalizeText((displayName as { text?: unknown }).text);
    if (text) return text;
  }
  return '';
};

const dedupeSuggestions = (suggestions: CityLookupSuggestion[]): CityLookupSuggestion[] => {
  const seen = new Set<string>();
  const unique: CityLookupSuggestion[] = [];
  for (const suggestion of suggestions) {
    const key = `${suggestion.name.toLocaleLowerCase()}|${suggestion.coordinates.lat.toFixed(5)},${suggestion.coordinates.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(suggestion);
  }
  return unique;
};

export const mapSearchByTextResponseToCitySuggestions = (
  response: SearchByTextResponseShape | null | undefined,
  maxResults = 5,
): CityLookupSuggestion[] => {
  const places = Array.isArray(response?.places) ? response.places : [];
  const mapped = places
    .map((place) => {
      const coordinates = normalizeCoordinates(place?.location);
      if (!coordinates) return null;

      const label = normalizeText(place?.formattedAddress);
      const name = resolveDisplayName(place?.displayName) || label.split(',')[0]?.trim() || '';
      if (!name) return null;

      const countryFromComponents = resolveCountryFromAddressComponents(normalizeAddressComponents(place?.addressComponents));
      const countryFromLabel = resolveCountryFromLabel(label);
      return {
        id: normalizeText(place?.id) || `${name}-${coordinates.lat.toFixed(5)}-${coordinates.lng.toFixed(5)}`,
        name,
        label: label || name,
        coordinates,
        countryName: countryFromComponents.countryName ?? countryFromLabel.countryName,
        countryCode: countryFromComponents.countryCode,
      } satisfies CityLookupSuggestion;
    })
    .filter((value): value is CityLookupSuggestion => Boolean(value));

  return dedupeSuggestions(mapped).slice(0, maxResults);
};

const geocodeAddress = (
  geocoder: google.maps.Geocoder,
  address: string,
): Promise<google.maps.GeocoderResult[]> => (
  new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && Array.isArray(results)) {
        resolve(results);
        return;
      }
      if (status === 'ZERO_RESULTS') {
        resolve([]);
        return;
      }
      reject(new Error(`Geocoder failed: ${status}`));
    });
  })
);

const mapGeocoderResultsToCitySuggestions = (
  results: google.maps.GeocoderResult[],
  maxResults = 5,
): CityLookupSuggestion[] => {
  const mapped = results
    .map((result) => {
      const location = result.geometry?.location;
      if (!location) return null;
      const coordinates: ICoordinates = {
        lat: location.lat(),
        lng: location.lng(),
      };
      const label = normalizeText(result.formatted_address);
      const name = label.split(',')[0]?.trim() || label;
      if (!name) return null;
      const country = resolveCountryFromAddressComponents(
        normalizeAddressComponents(result.address_components as unknown),
      );
      return {
        id: normalizeText(result.place_id) || `${name}-${coordinates.lat.toFixed(5)}-${coordinates.lng.toFixed(5)}`,
        name,
        label: label || name,
        coordinates,
        countryName: country.countryName,
        countryCode: country.countryCode,
      } satisfies CityLookupSuggestion;
    })
    .filter((value): value is CityLookupSuggestion => Boolean(value));

  return dedupeSuggestions(mapped).slice(0, maxResults);
};

const mapLanguageToGoogleLanguage = (language?: AppLanguage): string | undefined => {
  if (!language) return undefined;
  return language;
};

export const searchCitySuggestions = async (
  query: string,
  options?: { language?: AppLanguage; maxResults?: number },
): Promise<CityLookupSuggestion[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  const maxResults = Math.max(1, options?.maxResults ?? 5);

  if (typeof window === 'undefined' || !window.google?.maps) return [];

  const importLibrary = window.google.maps.importLibrary;
  if (typeof importLibrary === 'function') {
    try {
      const placesLibrary = await importLibrary('places' as never) as {
        Place?: {
          searchByText?: (request: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const searchByText = placesLibrary?.Place?.searchByText;
      if (typeof searchByText === 'function') {
        const fields = ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents'] as const;
        const language = mapLanguageToGoogleLanguage(options?.language);
        const baseRequest: Record<string, unknown> = {
          textQuery: trimmedQuery,
          maxResultCount: maxResults,
          fields,
        };
        if (language) {
          baseRequest.language = language;
        }

        const typedResponse = await searchByText({
          ...baseRequest,
          includedType: 'locality',
        }) as SearchByTextResponseShape;
        const typedSuggestions = mapSearchByTextResponseToCitySuggestions(typedResponse, maxResults);
        if (typedSuggestions.length > 0) return typedSuggestions;

        const relaxedResponse = await searchByText(baseRequest) as SearchByTextResponseShape;
        const relaxedSuggestions = mapSearchByTextResponseToCitySuggestions(relaxedResponse, maxResults);
        if (relaxedSuggestions.length > 0) return relaxedSuggestions;
      }
    } catch {
      // Fallback to geocoder below.
    }
  }

  if (!window.google.maps.Geocoder) return [];
  try {
    const geocoder = new window.google.maps.Geocoder();
    const results = await geocodeAddress(geocoder, trimmedQuery);
    return mapGeocoderResultsToCitySuggestions(results, maxResults);
  } catch {
    return [];
  }
};

export const resolveCitySuggestion = async (
  query: string,
  options?: { language?: AppLanguage },
): Promise<CityLookupSuggestion | null> => {
  const suggestions = await searchCitySuggestions(query, { language: options?.language, maxResults: 1 });
  return suggestions[0] ?? null;
};
