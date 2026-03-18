import { normalizeTransportMode } from '../shared/transportModes';

export const GOOGLE_ROUTES_COMPUTE_FIELDS = [
  'path',
  'distanceMeters',
  'durationMillis',
] as const;

const GOOGLE_ROUTES_COMPUTE_MINIMAL_FIELDS = ['path'] as const;

export interface GoogleRouteRuntime {
  computeRoutes: (request: unknown) => Promise<unknown>;
  transitModes: Record<string, unknown> | null;
}

export interface GoogleRouteLegResult {
  path: google.maps.LatLngLiteral[];
  distanceKm?: number;
  durationHours?: number;
}

const isRoutesFieldMaskError = (error: unknown): boolean => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  return /property fields/i.test(message) || /contains invalid fields/i.test(message) || /field mask/i.test(message);
};

const getTransitFallbackDepartureTime = (): Date => {
  const nextWindow = new Date();
  nextWindow.setHours(12, 0, 0, 0);
  if (nextWindow.getTime() <= Date.now()) {
    nextWindow.setDate(nextWindow.getDate() + 1);
  }
  return nextWindow;
};

const normalizeRoutePathPoints = (rawPath: unknown): google.maps.LatLngLiteral[] => {
  if (!Array.isArray(rawPath)) return [];
  return rawPath
    .map((point): google.maps.LatLngLiteral | null => {
      if (!point || typeof point !== 'object') return null;
      const latRaw = (point as { lat?: unknown }).lat;
      const lngRaw = (point as { lng?: unknown }).lng;

      if (typeof latRaw === 'number' && Number.isFinite(latRaw) && typeof lngRaw === 'number' && Number.isFinite(lngRaw)) {
        return { lat: latRaw, lng: lngRaw };
      }
      if (typeof latRaw === 'function' && typeof lngRaw === 'function') {
        const latValue = latRaw();
        const lngValue = lngRaw();
        if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
          return { lat: latValue, lng: lngValue };
        }
      }

      return null;
    })
    .filter((point): point is google.maps.LatLngLiteral => Boolean(point));
};

const computePathDistanceMeters = (path: google.maps.LatLngLiteral[]): number | undefined => {
  if (path.length < 2) return undefined;
  const geometry = window.google?.maps?.geometry?.spherical;
  if (!geometry || !window.google?.maps?.LatLng) return undefined;

  let distanceMeters = 0;
  for (let index = 1; index < path.length; index += 1) {
    distanceMeters += geometry.computeDistanceBetween(
      new window.google.maps.LatLng(path[index - 1].lat, path[index - 1].lng),
      new window.google.maps.LatLng(path[index].lat, path[index].lng),
    );
  }
  return distanceMeters > 0 ? distanceMeters : undefined;
};

const parseDurationSeconds = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000 ? value / 1000 : value;
  }
  if (typeof value === 'string') {
    const secondsMatch = value.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
    if (secondsMatch) {
      const parsedSeconds = Number.parseFloat(secondsMatch[1]);
      return Number.isFinite(parsedSeconds) ? parsedSeconds : undefined;
    }
  }
  if (value && typeof value === 'object') {
    const secondsValue = (value as { seconds?: unknown }).seconds;
    const nanosValue = (value as { nanos?: unknown }).nanos;
    if (typeof secondsValue === 'number' && Number.isFinite(secondsValue)) {
      const nanosSeconds = typeof nanosValue === 'number' && Number.isFinite(nanosValue) ? nanosValue / 1_000_000_000 : 0;
      return secondsValue + nanosSeconds;
    }
  }
  return undefined;
};

const buildAllowedTransitModes = (
  transportMode: string | undefined,
  transitModes: Record<string, unknown> | null,
  attemptIndex: number,
): unknown[] => {
  if (attemptIndex !== 0) return [];

  const normalizedMode = normalizeTransportMode(transportMode);
  if (normalizedMode === 'train') {
    const allowedModes = [transitModes?.TRAIN || 'TRAIN'];
    if (transitModes?.RAIL) {
      allowedModes.push(transitModes.RAIL);
    }
    return allowedModes;
  }

  if (normalizedMode === 'bus') {
    return [transitModes?.BUS || 'BUS'];
  }

  return [];
};

export const loadGoogleRouteRuntime = async (): Promise<GoogleRouteRuntime | null> => {
  const importLibrary = window.google?.maps?.importLibrary;
  if (typeof importLibrary !== 'function') return null;

  try {
    const routesLibrary = await importLibrary('routes' as never) as {
      Route?: { computeRoutes?: (request: unknown) => Promise<unknown> };
      TransitMode?: Record<string, unknown>;
    };

    if (!routesLibrary?.Route || typeof routesLibrary.Route.computeRoutes !== 'function') {
      return null;
    }

    return {
      computeRoutes: routesLibrary.Route.computeRoutes.bind(routesLibrary.Route),
      transitModes: routesLibrary?.TransitMode && typeof routesLibrary.TransitMode === 'object'
        ? routesLibrary.TransitMode
        : null,
    };
  } catch (error) {
    console.warn('Failed to load Routes library; route checks will fall back to straight-line rendering', error);
    return null;
  }
};

export const computeGoogleRouteLeg = async ({
  origin,
  destination,
  travelMode,
  transportMode,
  attemptIndex,
  routeRuntime,
  isCancelled,
}: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  travelMode: google.maps.TravelMode;
  transportMode?: string;
  attemptIndex: number;
  routeRuntime: GoogleRouteRuntime | null;
  isCancelled?: () => boolean;
}): Promise<GoogleRouteLegResult> => {
  if (isCancelled?.()) {
    throw new Error('Route draw cancelled');
  }
  if (!routeRuntime?.computeRoutes) {
    throw new Error('Routes API unavailable');
  }

  const isTransitMode = String(travelMode).toUpperCase() === 'TRANSIT';
  const transitDepartureTime = getTransitFallbackDepartureTime();

  const buildRouteRequest = (fields: readonly string[]): Record<string, unknown> => {
    const routeRequest: Record<string, unknown> = {
      origin,
      destination,
      travelMode,
      fields,
    };
    if (isTransitMode) {
      routeRequest.departureTime = transitDepartureTime;
      const allowedTransitModes = buildAllowedTransitModes(
        transportMode,
        routeRuntime.transitModes,
        attemptIndex,
      );
      if (allowedTransitModes.length > 0) {
        routeRequest.transitPreference = {
          allowedTransitModes,
        };
      }
    }
    return routeRequest;
  };

  const applyRoutesResult = (routesResult: unknown): GoogleRouteLegResult => {
    const parsedResult = routesResult as {
      routes?: Array<{
        path?: unknown;
        distanceMeters?: unknown;
        durationMillis?: unknown;
      }>;
    };
    const route = parsedResult.routes?.[0];
    const path = normalizeRoutePathPoints(route?.path);
    const distanceMeters = typeof route?.distanceMeters === 'number' && Number.isFinite(route.distanceMeters)
      ? route.distanceMeters
      : computePathDistanceMeters(path);
    const durationSeconds = parseDurationSeconds(route?.durationMillis);

    return {
      path,
      distanceKm: distanceMeters ? distanceMeters / 1000 : undefined,
      durationHours: durationSeconds ? durationSeconds / 3600 : undefined,
    };
  };

  try {
    const routesResult = await routeRuntime.computeRoutes(buildRouteRequest(GOOGLE_ROUTES_COMPUTE_FIELDS));
    if (isCancelled?.()) {
      throw new Error('Route draw cancelled');
    }
    return applyRoutesResult(routesResult);
  } catch (error) {
    if (isCancelled?.()) {
      throw new Error('Route draw cancelled');
    }
    if (!isRoutesFieldMaskError(error)) {
      throw error;
    }

    const fallbackResult = await routeRuntime.computeRoutes(buildRouteRequest(GOOGLE_ROUTES_COMPUTE_MINIMAL_FIELDS));
    if (isCancelled?.()) {
      throw new Error('Route draw cancelled');
    }
    return applyRoutesResult(fallbackResult);
  }
};
