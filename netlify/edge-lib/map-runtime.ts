import {
  MAP_RUNTIME_CACHE_KEY_QUERY_PARAM,
  MAP_RUNTIME_OVERRIDE_COOKIE_NAME,
  buildMapRuntimeSelectionCacheKey,
  parseMapRuntimeOverrideCookie,
  parseMapRuntimeSelectionCacheKey,
  resolveMapRuntime,
  type MapRuntimeOverride,
  type MapRuntimePreset,
  type MapRuntimeResolution,
  type MapRuntimeSelection,
} from '../../shared/mapRuntime.ts';

const readEdgeEnv = (name: string): string => {
  if (typeof Deno !== 'undefined' && typeof Deno.env?.get === 'function') {
    return Deno.env.get(name) || '';
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || '';
  }
  return '';
};

const readCookieFromRequest = (request: Request, cookieName: string): string | null => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookieParts = cookieHeader.split(';');
  for (const cookiePart of cookieParts) {
    const [rawName, ...rawValueParts] = cookiePart.trim().split('=');
    if (!rawName || rawName !== cookieName) continue;
    const rawValue = rawValueParts.join('=');
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
};

export const getEdgeDefaultMapRuntimePreset = (): MapRuntimePreset => {
  const rawPreset = readEdgeEnv('VITE_MAP_RUNTIME_PRESET');
  return rawPreset === 'mapbox_visual_google_services'
    || rawPreset === 'mapbox_all'
    || rawPreset === 'google_all'
    ? rawPreset
    : 'google_all';
};

export const getEdgeMapboxAccessToken = (): string => readEdgeEnv('VITE_MAPBOX_ACCESS_TOKEN');
export const getEdgeGoogleMapsApiKey = (): string => readEdgeEnv('VITE_GOOGLE_MAPS_API_KEY');

export const readMapRuntimeOverrideFromRequest = (
  request: Request,
): { override: MapRuntimeOverride | null; overrideSource: MapRuntimeResolution['overrideSource'] } => {
  const url = new URL(request.url);
  const querySelection = parseMapRuntimeSelectionCacheKey(url.searchParams.get(MAP_RUNTIME_CACHE_KEY_QUERY_PARAM));
  if (querySelection) {
    return {
      override: { selection: querySelection },
      overrideSource: 'query',
    };
  }

  return {
    override: parseMapRuntimeOverrideCookie(readCookieFromRequest(request, MAP_RUNTIME_OVERRIDE_COOKIE_NAME)),
    overrideSource: 'cookie',
  };
};

export const resolveEdgeMapRuntime = (request: Request): MapRuntimeResolution => {
  const { override, overrideSource } = readMapRuntimeOverrideFromRequest(request);
  return resolveMapRuntime({
    defaultPreset: getEdgeDefaultMapRuntimePreset(),
    override,
    overrideSource: override ? overrideSource : 'default',
    availability: {
      googleMapsKeyAvailable: Boolean(getEdgeGoogleMapsApiKey().trim()),
      mapboxAccessTokenAvailable: Boolean(getEdgeMapboxAccessToken().trim()),
    },
  });
};

export const applyMapRuntimeSelectionToUrl = (
  url: URL,
  selection: MapRuntimeSelection,
): void => {
  url.searchParams.set(MAP_RUNTIME_CACHE_KEY_QUERY_PARAM, buildMapRuntimeSelectionCacheKey(selection));
};
