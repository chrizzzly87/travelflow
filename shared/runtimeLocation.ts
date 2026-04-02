export interface RuntimeLocation {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  postalCode: string | null;
}

export type RuntimeLocationSource = 'netlify-context' | 'session-cache' | 'unavailable' | 'error';

export interface RuntimeLocationPayload {
  available: boolean;
  source: RuntimeLocationSource;
  fetchedAt: string | null;
  location: RuntimeLocation;
}

const EMPTY_LOCATION: RuntimeLocation = {
  city: null,
  countryCode: null,
  countryName: null,
  subdivisionCode: null,
  subdivisionName: null,
  latitude: null,
  longitude: null,
  timezone: null,
  postalCode: null,
};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const hasMeaningfulLocationValue = (location: RuntimeLocation): boolean => (
  Boolean(
    location.city
    || location.countryCode
    || location.countryName
    || location.subdivisionCode
    || location.subdivisionName
    || location.timezone
    || location.postalCode
    || location.latitude !== null
    || location.longitude !== null
  )
);

export const createEmptyRuntimeLocation = (): RuntimeLocation => ({ ...EMPTY_LOCATION });

export const normalizeRuntimeLocation = (value: unknown): RuntimeLocation => {
  const typed = asRecord(value);
  if (!typed) return createEmptyRuntimeLocation();

  return {
    city: asNullableString(typed.city),
    countryCode: asNullableString(typed.countryCode),
    countryName: asNullableString(typed.countryName),
    subdivisionCode: asNullableString(typed.subdivisionCode),
    subdivisionName: asNullableString(typed.subdivisionName),
    latitude: asNullableNumber(typed.latitude),
    longitude: asNullableNumber(typed.longitude),
    timezone: asNullableString(typed.timezone),
    postalCode: asNullableString(typed.postalCode),
  };
};

export const normalizeRuntimeLocationPayload = (
  value: unknown,
  fallbackSource: RuntimeLocationSource = 'unavailable',
): RuntimeLocationPayload => {
  const typed = asRecord(value);
  const normalizedLocation = normalizeRuntimeLocation(typed?.location);
  const normalizedFetchedAt = asNullableString(typed?.fetchedAt);
  const normalizedSourceRaw = asNullableString(typed?.source);
  const normalizedSource: RuntimeLocationSource = (
    normalizedSourceRaw === 'netlify-context'
    || normalizedSourceRaw === 'session-cache'
    || normalizedSourceRaw === 'unavailable'
    || normalizedSourceRaw === 'error'
  )
    ? normalizedSourceRaw
    : fallbackSource;

  const explicitAvailable = typeof typed?.available === 'boolean' ? typed.available : null;
  const available = explicitAvailable ?? hasMeaningfulLocationValue(normalizedLocation);

  return {
    available,
    source: available
      ? normalizedSource
      : (
        normalizedSource === 'session-cache' || normalizedSource === 'unavailable' || normalizedSource === 'error'
          ? normalizedSource
          : fallbackSource
      ),
    fetchedAt: normalizedFetchedAt,
    location: normalizedLocation,
  };
};

export const buildRuntimeLocationPayload = (params: {
  source: RuntimeLocationSource;
  fetchedAt?: string | null;
  location?: RuntimeLocation;
}): RuntimeLocationPayload => {
  const location = params.location || createEmptyRuntimeLocation();
  const available = hasMeaningfulLocationValue(location);
  return {
    available,
    source: available
      ? params.source
      : (
        params.source === 'session-cache' || params.source === 'error'
          ? params.source
          : 'unavailable'
      ),
    fetchedAt: asNullableString(params.fetchedAt) || null,
    location,
  };
};
