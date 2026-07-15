import type { ICoordinates } from '../types.ts';

export interface AiTripCityLocation {
  name: string;
  description: string;
  coordinates?: ICoordinates;
  countryName?: string;
  countryCode?: string;
}

const asTrimmedText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const asCoordinate = (value: unknown, minimum: number, maximum: number): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const normalizeCountryCode = (value: unknown): string | undefined => {
  const normalized = asTrimmedText(value).toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
};

export const parseAiTripCityLocation = (
  value: unknown,
  fallbackName: string,
): AiTripCityLocation => {
  const city = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const lat = asCoordinate(city.lat, -90, 90);
  const lng = asCoordinate(city.lng, -180, 180);
  const countryName = asTrimmedText(city.countryName);

  return {
    name: asTrimmedText(city.name) || fallbackName,
    description: asTrimmedText(city.description),
    coordinates: lat !== null && lng !== null ? { lat, lng } : undefined,
    countryName: countryName || undefined,
    countryCode: normalizeCountryCode(city.countryCode),
  };
};
