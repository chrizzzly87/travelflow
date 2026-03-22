import {
  clampNearbyAirportLimit,
  normalizeNearbyAirportsResponse,
  parseCommercialServiceTier,
  type AirportCommercialServiceTier,
  type NearbyAirportsResponse,
} from '../shared/airportReference';
import {
  ensureRuntimeLocationLoaded,
  type RuntimeLocationStoreSnapshot,
} from './runtimeLocationService';

export const NEARBY_AIRPORTS_ENDPOINT = '/api/runtime/nearby-airports';

const hasFiniteCoordinates = (
  latitude: number | null,
  longitude: number | null,
): boolean => (
  typeof latitude === 'number'
  && typeof longitude === 'number'
  && Number.isFinite(latitude)
  && Number.isFinite(longitude)
);

const buildNearbyAirportsUrl = (params: {
  lat: number;
  lng: number;
  limit: number;
  minimumServiceTier?: AirportCommercialServiceTier;
  countryCode?: string | null;
}): string => {
  const searchParams = new URLSearchParams();
  searchParams.set('lat', String(params.lat));
  searchParams.set('lng', String(params.lng));
  searchParams.set('limit', String(clampNearbyAirportLimit(params.limit)));
  searchParams.set('minimumServiceTier', parseCommercialServiceTier(params.minimumServiceTier));
  const countryCode = typeof params.countryCode === 'string' ? params.countryCode.trim().toUpperCase() : '';
  if (countryCode) {
    searchParams.set('countryCode', countryCode);
  }
  return `${NEARBY_AIRPORTS_ENDPOINT}?${searchParams.toString()}`;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
      return (payload as { error: string }).error;
    }
  } catch {
    // Ignore invalid JSON and fall back to a generic message.
  }

  return `Nearby airports request failed with ${response.status}.`;
};

export const fetchNearbyAirports = async ({
  lat,
  lng,
  limit = 10,
  minimumServiceTier = 'local',
  countryCode = null,
  fetchImpl = fetch,
}: {
  lat: number;
  lng: number;
  limit?: number;
  minimumServiceTier?: AirportCommercialServiceTier;
  countryCode?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<NearbyAirportsResponse> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Valid latitude and longitude are required.');
  }

  const response = await fetchImpl(buildNearbyAirportsUrl({ lat, lng, limit, minimumServiceTier, countryCode }), {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = normalizeNearbyAirportsResponse(await response.json().catch(() => null));
  if (!payload) {
    throw new Error('Nearby airports response was invalid.');
  }

  return payload;
};

export const fetchNearbyAirportsForRuntimeLocation = async ({
  limit = 10,
  minimumServiceTier = 'local',
  fetchImpl = fetch,
  snapshot,
}: {
  limit?: number;
  minimumServiceTier?: AirportCommercialServiceTier;
  fetchImpl?: typeof fetch;
  snapshot?: RuntimeLocationStoreSnapshot | null;
} = {}): Promise<NearbyAirportsResponse | null> => {
  const runtimeSnapshot = snapshot || await ensureRuntimeLocationLoaded(fetchImpl);
  const { latitude, longitude } = runtimeSnapshot.location;

  if (!hasFiniteCoordinates(latitude, longitude)) {
    return null;
  }

  return fetchNearbyAirports({
    lat: latitude,
    lng: longitude,
    limit,
    minimumServiceTier,
    fetchImpl,
  });
};

export const __nearbyAirportsServiceInternals = {
  buildNearbyAirportsUrl,
};
