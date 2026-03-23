export type AirportCommercialServiceTier = 'local' | 'regional' | 'major';

export interface AirportReference {
  ident: string;
  iataCode: string | null;
  icaoCode: string | null;
  name: string;
  municipality: string | null;
  subdivisionName: string | null;
  regionCode: string | null;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  airportType: 'large_airport' | 'medium_airport' | 'small_airport';
  scheduledService: boolean;
  isCommercial: boolean;
  commercialServiceTier: AirportCommercialServiceTier;
  isMajorCommercial: boolean;
}

export interface AirportReferenceMetadata {
  dataVersion: string;
  generatedAt: string;
  commercialAirportCount: number;
  sourceAirportCount: number;
  sources: {
    primary: string;
    mirror: string;
    enrichment: string;
  };
}

export interface NearbyAirportResult {
  airport: AirportReference;
  airDistanceKm: number;
  rank: number;
}

export interface NearbyAirportsResponse {
  origin: {
    lat: number;
    lng: number;
  };
  airports: NearbyAirportResult[];
  dataVersion: string;
}

interface AirportReferenceSnapshotModule {
  COMMERCIAL_AIRPORT_REFERENCES?: unknown;
}

interface AirportReferenceMetadataModule {
  AIRPORT_REFERENCE_METADATA?: unknown;
}

const EARTH_RADIUS_KM = 6371;
export const DEFAULT_NEARBY_AIRPORTS_LIMIT = 10;
export const MAX_NEARBY_AIRPORTS_LIMIT = 10;
export const DEFAULT_MINIMUM_AIRPORT_SERVICE_TIER: AirportCommercialServiceTier = 'local';

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRequiredString = (value: unknown, fallback = ''): string => {
  const normalized = asNullableString(value);
  return normalized || fallback;
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

const normalizeCode = (value: unknown): string | null => {
  const normalized = asNullableString(value);
  return normalized ? normalized.toUpperCase() : null;
};

const normalizeCountryCodeFilter = (value: unknown): string | null => {
  const normalized = asNullableString(value);
  return normalized ? normalized.toUpperCase() : null;
};

const normalizeAirportType = (value: unknown): AirportReference['airportType'] | null => {
  const normalized = asNullableString(value);
  if (normalized === 'large_airport' || normalized === 'medium_airport' || normalized === 'small_airport') {
    return normalized;
  }
  return null;
};

export const inferCommercialServiceTier = (
  airportType: AirportReference['airportType'],
): AirportCommercialServiceTier => {
  if (airportType === 'large_airport') return 'major';
  if (airportType === 'medium_airport') return 'regional';
  return 'local';
};

export const deriveAirportCommercialFlags = ({
  airportType,
  scheduledService,
  iataCode,
  icaoCode,
}: {
  airportType: AirportReference['airportType'];
  scheduledService: boolean;
  iataCode: string | null;
  icaoCode: string | null;
}): Pick<AirportReference, 'commercialServiceTier' | 'isMajorCommercial' | 'isCommercial'> => {
  const commercialServiceTier = inferCommercialServiceTier(airportType);
  const hasStableCode = Boolean(iataCode || icaoCode);
  const isCommercial = scheduledService && hasStableCode;

  return {
    commercialServiceTier,
    isMajorCommercial: commercialServiceTier === 'major',
    isCommercial,
  };
};

const normalizeCommercialServiceTier = (value: unknown): AirportCommercialServiceTier | null => {
  const normalized = asNullableString(value);
  if (normalized === 'major' || normalized === 'regional' || normalized === 'local') {
    return normalized;
  }
  return null;
};

export const parseCommercialServiceTier = (
  value: unknown,
  fallback: AirportCommercialServiceTier = DEFAULT_MINIMUM_AIRPORT_SERVICE_TIER,
): AirportCommercialServiceTier => normalizeCommercialServiceTier(value) || fallback;

const COMMERCIAL_SERVICE_TIER_RANK: Record<AirportCommercialServiceTier, number> = {
  local: 0,
  regional: 1,
  major: 2,
};

export const isCommercialServiceTierAtLeast = (
  airport: Pick<AirportReference, 'commercialServiceTier'>,
  minimumServiceTier: AirportCommercialServiceTier,
): boolean => COMMERCIAL_SERVICE_TIER_RANK[airport.commercialServiceTier] >= COMMERCIAL_SERVICE_TIER_RANK[minimumServiceTier];

const compareAirportIdentity = (left: AirportReference, right: AirportReference): number => {
  const leftCode = left.iataCode || left.icaoCode || left.ident;
  const rightCode = right.iataCode || right.icaoCode || right.ident;
  return leftCode.localeCompare(rightCode)
    || left.name.localeCompare(right.name)
    || left.ident.localeCompare(right.ident);
};

export const clampNearbyAirportLimit = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_NEARBY_AIRPORTS_LIMIT;
  return Math.max(1, Math.min(MAX_NEARBY_AIRPORTS_LIMIT, Math.trunc(value)));
};

export const normalizeAirportReference = (value: unknown): AirportReference | null => {
  const typed = asRecord(value);
  if (!typed) return null;

  const ident = normalizeCode(typed.ident);
  const name = asRequiredString(typed.name);
  const countryCode = normalizeCode(typed.countryCode);
  const countryName = asRequiredString(typed.countryName);
  const latitude = asNullableNumber(typed.latitude);
  const longitude = asNullableNumber(typed.longitude);
  const airportType = normalizeAirportType(typed.airportType);
  const scheduledService = typed.scheduledService === true;
  const iataCode = normalizeCode(typed.iataCode);
  const icaoCode = normalizeCode(typed.icaoCode);
  const commercialServiceTier = normalizeCommercialServiceTier(typed.commercialServiceTier);
  const inferredCommercialServiceTier = airportType ? inferCommercialServiceTier(airportType) : null;
  const resolvedCommercialServiceTier = commercialServiceTier || inferredCommercialServiceTier;
  const derivedFlags = airportType
    ? deriveAirportCommercialFlags({
      airportType,
      scheduledService,
      iataCode,
      icaoCode,
    })
    : null;
  const isCommercial = typed.isCommercial === true || derivedFlags?.isCommercial === true;
  const isMajorCommercial = typed.isMajorCommercial === true || resolvedCommercialServiceTier === 'major';

  if (!ident || !name || !countryCode || !countryName || latitude === null || longitude === null || !airportType) {
    return null;
  }

  return {
    ident,
    iataCode,
    icaoCode,
    name,
    municipality: asNullableString(typed.municipality),
    subdivisionName: asNullableString(typed.subdivisionName),
    regionCode: normalizeCode(typed.regionCode),
    countryCode,
    countryName,
    latitude,
    longitude,
    timezone: asNullableString(typed.timezone),
    airportType,
    scheduledService,
    isCommercial,
    commercialServiceTier: resolvedCommercialServiceTier || derivedFlags?.commercialServiceTier || 'local',
    isMajorCommercial,
  };
};

export const normalizeAirportSnapshot = (value: unknown): AirportReference[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeAirportReference(entry))
    .filter((entry): entry is AirportReference => Boolean(entry))
    .sort(compareAirportIdentity);
};

export const normalizeAirportReferenceMetadata = (value: unknown): AirportReferenceMetadata | null => {
  const typed = asRecord(value);
  if (!typed) return null;
  const sources = asRecord(typed.sources);
  const dataVersion = asRequiredString(typed.dataVersion);
  const generatedAt = asRequiredString(typed.generatedAt);
  const commercialAirportCount = asNullableNumber(typed.commercialAirportCount);
  const sourceAirportCount = asNullableNumber(typed.sourceAirportCount);
  const primary = asRequiredString(sources?.primary);
  const mirror = asRequiredString(sources?.mirror);
  const enrichment = asRequiredString(sources?.enrichment);

  if (!dataVersion || !generatedAt || commercialAirportCount === null || sourceAirportCount === null || !primary || !mirror || !enrichment) {
    return null;
  }

  return {
    dataVersion,
    generatedAt,
    commercialAirportCount,
    sourceAirportCount,
    sources: {
      primary,
      mirror,
      enrichment,
    },
  };
};

export const normalizeNearbyAirportResult = (value: unknown): NearbyAirportResult | null => {
  const typed = asRecord(value);
  if (!typed) return null;
  const airport = normalizeAirportReference(typed.airport);
  const airDistanceKm = asNullableNumber(typed.airDistanceKm);
  const rank = asNullableNumber(typed.rank);

  if (!airport || airDistanceKm === null || rank === null) return null;

  return {
    airport,
    airDistanceKm,
    rank,
  };
};

export const normalizeNearbyAirportsResponse = (value: unknown): NearbyAirportsResponse | null => {
  const typed = asRecord(value);
  if (!typed) return null;
  const origin = asRecord(typed.origin);
  const lat = asNullableNumber(origin?.lat);
  const lng = asNullableNumber(origin?.lng);
  const dataVersion = asRequiredString(typed.dataVersion);
  const airports = Array.isArray(typed.airports)
    ? typed.airports
      .map((entry) => normalizeNearbyAirportResult(entry))
      .filter((entry): entry is NearbyAirportResult => Boolean(entry))
    : [];

  if (lat === null || lng === null || !dataVersion) return null;

  return {
    origin: { lat, lng },
    airports,
    dataVersion,
  };
};

export const computeAirDistanceKm = (
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
): number => {
  const toRadians = (value: number) => value * (Math.PI / 180);
  const dLat = toRadians(end.lat - start.lat);
  const dLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);

  const haversine = (
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  );
  const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return EARTH_RADIUS_KM * angularDistance;
};

export const getAirportByCode = (
  airports: AirportReference[],
  code: string,
): AirportReference | null => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  return airports.find((airport) => (
    airport.iataCode === normalized
    || airport.icaoCode === normalized
    || airport.ident === normalized
  )) || null;
};

export const findNearestCommercialAirports = ({
  lat,
  lng,
  airports,
  limit = DEFAULT_NEARBY_AIRPORTS_LIMIT,
  minimumServiceTier = 'local',
  countryCode = null,
}: {
  lat: number;
  lng: number;
  airports: AirportReference[];
  limit?: number;
  minimumServiceTier?: AirportCommercialServiceTier;
  countryCode?: string | null;
}): NearbyAirportResult[] => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const safeLimit = clampNearbyAirportLimit(limit);
  const normalizedCountryCode = normalizeCountryCodeFilter(countryCode);

  return airports
    .filter((airport) => (
      airport.isCommercial
      && isCommercialServiceTierAtLeast(airport, parseCommercialServiceTier(minimumServiceTier))
      && (!normalizedCountryCode || airport.countryCode === normalizedCountryCode)
    ))
    .map((airport) => ({
      airport,
      airDistanceKm: computeAirDistanceKm({ lat, lng }, { lat: airport.latitude, lng: airport.longitude }),
    }))
    .sort((left, right) => (
      left.airDistanceKm - right.airDistanceKm
      || compareAirportIdentity(left.airport, right.airport)
    ))
    .slice(0, safeLimit)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
};

let airportReferenceSnapshotPromise: Promise<AirportReference[]> | null = null;
let airportReferenceMetadataPromise: Promise<AirportReferenceMetadata | null> | null = null;

export const loadCommercialAirportReferences = async (): Promise<AirportReference[]> => {
  if (!airportReferenceSnapshotPromise) {
    airportReferenceSnapshotPromise = import('../data/airports/commercialAirports.generated.ts')
      .then((module: AirportReferenceSnapshotModule) => normalizeAirportSnapshot(module.COMMERCIAL_AIRPORT_REFERENCES))
      .catch(() => []);
  }
  return airportReferenceSnapshotPromise;
};

export const loadAirportReferenceMetadata = async (): Promise<AirportReferenceMetadata | null> => {
  if (!airportReferenceMetadataPromise) {
    airportReferenceMetadataPromise = import('../data/airports/metadata.generated.ts')
      .then((module: AirportReferenceMetadataModule) => normalizeAirportReferenceMetadata(module.AIRPORT_REFERENCE_METADATA))
      .catch(() => null);
  }
  return airportReferenceMetadataPromise;
};
