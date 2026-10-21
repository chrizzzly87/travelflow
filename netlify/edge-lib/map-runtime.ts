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

/**
 * The administrator's map-provider setting, cached per isolate. Generated
 * preview images are produced here, so they have to follow the same switch the
 * browser does — otherwise the planner renders Mapbox while every shared image
 * still carries a Google basemap.
 */
let cachedAdminPreset: { preset: MapRuntimePreset | null; readAt: number } | null = null;
const ADMIN_PRESET_TTL_MS = 60_000;

const readAdminMapRuntimePreset = async (): Promise<MapRuntimePreset | null> => {
  const now = Date.now();
  if (cachedAdminPreset && now - cachedAdminPreset.readAt < ADMIN_PRESET_TTL_MS) {
    return cachedAdminPreset.preset;
  }

  const supabaseUrl = readEdgeEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const anonKey = readEdgeEnv('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;

  let preset: MapRuntimePreset | null = null;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_runtime_settings`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    if (response.ok) {
      const rows = await response.json() as Array<{ map_runtime_preset?: unknown }>;
      const value = rows?.[0]?.map_runtime_preset;
      if (value === 'google_all' || value === 'mapbox_all' || value === 'mapbox_visual_google_services') {
        preset = value;
      }
    }
  } catch {
    // A settings lookup must never fail an image request; the environment
    // default stands in.
    preset = null;
  }

  cachedAdminPreset = { preset, readAt: now };
  return preset;
};

export const resolveEdgeMapRuntimeAsync = async (request: Request): Promise<MapRuntimeResolution> => {
  const adminPreset = await readAdminMapRuntimePreset();
  const { override, overrideSource } = readMapRuntimeOverrideFromRequest(request);
  return resolveMapRuntime({
    defaultPreset: adminPreset || getEdgeDefaultMapRuntimePreset(),
    override,
    overrideSource: override ? overrideSource : 'default',
    availability: {
      googleMapsKeyAvailable: Boolean(getEdgeGoogleMapsApiKey().trim()),
      mapboxAccessTokenAvailable: Boolean(getEdgeMapboxAccessToken().trim()),
    },
  });
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
