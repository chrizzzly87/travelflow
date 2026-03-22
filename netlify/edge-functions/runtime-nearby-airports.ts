import {
  clampNearbyAirportLimit,
  findNearestCommercialAirports,
  normalizeAirportReference,
  parseCommercialServiceTier,
  type AirportCommercialServiceTier,
  type AirportReferenceMetadata,
  type AirportReference,
  type NearbyAirportsResponse,
} from '../../shared/airportReference.ts';
import {
  loadAirportReferenceMetadataFromStaticAsset,
  loadCommercialAirportReferencesFromStaticAsset,
} from '../edge-lib/airport-reference-static.ts';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const readEnv = (name: string): string => {
  try {
    return (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env?.get(name) || '';
  } catch {
    return '';
  }
};

const json = (status: number, payload: unknown): Response => new Response(JSON.stringify(payload), {
  status,
  headers: JSON_HEADERS,
});

const getSupabaseAnonConfig = (): SupabaseConfig | null => {
  const url = readEnv('VITE_SUPABASE_URL').trim();
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY').trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

const asFiniteNumber = (value: string | null): number | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseNearbyAirportsRequest = (request: Request): {
  lat: number | null;
  lng: number | null;
  limit: number;
  minimumServiceTier: AirportCommercialServiceTier;
  countryCode: string | null;
} => {
  const url = new URL(request.url);
  const countryCode = url.searchParams.get('countryCode');
  return {
    lat: asFiniteNumber(url.searchParams.get('lat')),
    lng: asFiniteNumber(url.searchParams.get('lng')),
    limit: clampNearbyAirportLimit(asFiniteNumber(url.searchParams.get('limit'))),
    minimumServiceTier: parseCommercialServiceTier(url.searchParams.get('minimumServiceTier'), 'major'),
    countryCode: typeof countryCode === 'string' && countryCode.trim()
      ? countryCode.trim().toUpperCase()
      : null,
  };
};

const isValidCoordinatePair = (lat: number | null, lng: number | null): boolean => (
  typeof lat === 'number'
  && typeof lng === 'number'
  && Number.isFinite(lat)
  && Number.isFinite(lng)
  && lat >= -90
  && lat <= 90
  && lng >= -180
  && lng <= 180
);

const mapAirportRpcRow = (row: unknown): AirportReference | null => {
  if (!row || typeof row !== 'object') return null;
  const typed = row as Record<string, unknown>;
  return normalizeAirportReference({
    ident: typed.ident,
    iataCode: typed.iata_code,
    icaoCode: typed.icao_code,
    name: typed.name,
    municipality: typed.municipality,
    subdivisionName: typed.subdivision_name,
    regionCode: typed.region_code,
    countryCode: typed.country_code,
    countryName: typed.country_name,
    latitude: typed.latitude,
    longitude: typed.longitude,
    timezone: typed.timezone,
    airportType: typed.airport_type,
    scheduledService: typed.scheduled_service,
    isCommercial: typed.is_commercial,
    commercialServiceTier: typed.commercial_service_tier,
    isMajorCommercial: typed.is_major_commercial,
  });
};

export const queryNearbyAirportsViaSupabase = async (
  config: SupabaseConfig,
  params: { lat: number; lng: number; limit: number; minimumServiceTier: AirportCommercialServiceTier },
): Promise<AirportReference[] | null> => {
  const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/find_nearest_commercial_airports`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({
      p_lat: params.lat,
      p_lng: params.lng,
      p_limit: params.limit,
      p_min_service_tier: params.minimumServiceTier,
    }),
  });

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) return null;

  return payload
    .map((row) => mapAirportRpcRow(row))
    .filter((airport): airport is AirportReference => Boolean(airport));
};

const mapAirportMetadataRow = (row: unknown): AirportReferenceMetadata | null => {
  if (!row || typeof row !== 'object') return null;
  const typed = row as Record<string, unknown>;
  if (typeof typed.data_version !== 'string' || typeof typed.generated_at !== 'string') return null;

  return {
    dataVersion: typed.data_version,
    generatedAt: typed.generated_at,
    commercialAirportCount: typeof typed.commercial_airport_count === 'number'
      ? typed.commercial_airport_count
      : Number(typed.commercial_airport_count || 0),
    sourceAirportCount: typeof typed.source_airport_count === 'number'
      ? typed.source_airport_count
      : Number(typed.source_airport_count || 0),
    sources: (
      typed.sources && typeof typed.sources === 'object'
        ? {
          primary: typeof (typed.sources as Record<string, unknown>).primary === 'string' ? (typed.sources as Record<string, unknown>).primary as string : '',
          mirror: typeof (typed.sources as Record<string, unknown>).mirror === 'string' ? (typed.sources as Record<string, unknown>).mirror as string : '',
          enrichment: typeof (typed.sources as Record<string, unknown>).enrichment === 'string' ? (typed.sources as Record<string, unknown>).enrichment as string : '',
        }
        : { primary: '', mirror: '', enrichment: '' }
    ),
  };
};

export const queryAirportMetadataViaSupabase = async (
  config: SupabaseConfig,
): Promise<AirportReferenceMetadata | null> => {
  const response = await fetch(
    `${config.url.replace(/\/$/, '')}/rest/v1/airports_reference_metadata?id=eq.global&select=data_version,generated_at,commercial_airport_count,source_airport_count,sources`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        apikey: config.anonKey,
        authorization: `Bearer ${config.anonKey}`,
      },
    },
  );

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload) || payload.length === 0) return null;
  return mapAirportMetadataRow(payload[0]);
};

export const buildNearbyAirportsResponse = async ({
  lat,
  lng,
  limit,
  minimumServiceTier,
  countryCode,
  airports,
  metadataOverride,
}: {
  lat: number;
  lng: number;
  limit: number;
  minimumServiceTier: AirportCommercialServiceTier;
  countryCode?: string | null;
  airports: AirportReference[];
  metadataOverride?: AirportReferenceMetadata | null;
}): Promise<NearbyAirportsResponse> => {
  return {
    origin: { lat, lng },
    airports: findNearestCommercialAirports({
      lat,
      lng,
      airports,
      limit,
      minimumServiceTier,
      countryCode,
    }),
    dataVersion: metadataOverride?.dataVersion || 'unknown',
  };
};

export default async (request: Request): Promise<Response> => {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Method not allowed',
    }), {
      status: 405,
      headers: {
        ...JSON_HEADERS,
        allow: 'GET',
      },
    });
  }

  const { lat, lng, limit, minimumServiceTier, countryCode } = parseNearbyAirportsRequest(request);
  if (!isValidCoordinatePair(lat, lng)) {
    return json(400, {
      ok: false,
      error: 'Valid lat and lng query parameters are required.',
    });
  }

  const supabaseConfig = getSupabaseAnonConfig();
  const rpcAirports = supabaseConfig && !countryCode
    ? await queryNearbyAirportsViaSupabase(supabaseConfig, { lat, lng, limit, minimumServiceTier }).catch(() => null)
    : null;
  const rpcMetadata = supabaseConfig
    ? await queryAirportMetadataViaSupabase(supabaseConfig).catch(() => null)
    : null;

  const airports = rpcAirports || await loadCommercialAirportReferencesFromStaticAsset(request.url);
  const metadata = rpcMetadata || await loadAirportReferenceMetadataFromStaticAsset(request.url);
  return json(200, await buildNearbyAirportsResponse({
    lat,
    lng,
    limit,
    minimumServiceTier,
    countryCode,
    airports,
    metadataOverride: metadata,
  }));
};

export const __runtimeNearbyAirportsInternals = {
  buildNearbyAirportsResponse,
  getSupabaseAnonConfig,
  parseNearbyAirportsRequest,
  queryAirportMetadataViaSupabase,
  queryNearbyAirportsViaSupabase,
};
