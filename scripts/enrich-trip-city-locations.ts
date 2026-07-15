import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type JsonRecord = Record<string, unknown>;

interface TripRow {
  id: string;
  data: JsonRecord;
}

export interface GeocodeLocation {
  coordinates: { lat: number; lng: number };
  countryName: string;
  countryCode: string;
}

interface BackfillOptions {
  apply: boolean;
  reportUnresolved: boolean;
  tripId?: string;
  limit?: number;
}

const PAGE_SIZE = 500;

const isRecord = (value: unknown): value is JsonRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const asFiniteCoordinate = (value: unknown, minimum: number, maximum: number): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const getCoordinates = (item: JsonRecord): { lat: number; lng: number } | null => {
  if (!isRecord(item.coordinates)) return null;
  const lat = asFiniteCoordinate(item.coordinates.lat, -90, 90);
  const lng = asFiniteCoordinate(item.coordinates.lng, -180, 180);
  return lat !== null && lng !== null ? { lat, lng } : null;
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const splitLocationSuffixes = (value: string): string[] => {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return [];
  return parts.slice(1).map((_, index) => parts.slice(index + 1).join(', '));
};

const getTripDestinationContexts = (trip: JsonRecord): string[] => {
  const generation = isRecord(trip.aiMeta) && isRecord(trip.aiMeta.generation)
    ? trip.aiMeta.generation
    : null;
  const snapshot = generation && isRecord(generation.inputSnapshot)
    ? generation.inputSnapshot
    : null;
  const payload = snapshot && isRecord(snapshot.payload) ? snapshot.payload : null;
  const options = payload && isRecord(payload.options) ? payload.options : null;
  const arrayValues = ['countries', 'destinationOrder', 'selectedIslandNames', 'specificCities']
    .flatMap((key) => options && Array.isArray(options[key]) ? options[key].map(asText) : []);

  return dedupe([
    snapshot ? asText(snapshot.destinationLabel) : '',
    options ? asText(options.startDestination) : '',
    ...arrayValues,
  ]);
};

export const buildCityForwardGeocodeQueries = (item: JsonRecord, trip: JsonRecord): string[] => {
  const cityName = asText(item.location) || asText(item.title);
  if (!cityName) return [];

  const country = asText(item.countryName) || asText(item.countryCode);
  const otherCityContexts = (Array.isArray(trip.items) ? trip.items : []).flatMap((candidate) => {
    if (!isRecord(candidate) || candidate === item || candidate.type !== 'city') return [];
    return [
      asText(candidate.countryName) || asText(candidate.countryCode),
      ...splitLocationSuffixes(asText(candidate.location) || asText(candidate.title)),
    ];
  });
  const contexts = dedupe([country, ...getTripDestinationContexts(trip), ...otherCityContexts]);
  const hasExplicitContext = cityName.includes(',');

  return dedupe([
    ...(hasExplicitContext ? [cityName] : []),
    ...contexts.map((context) => `${cityName}, ${context}`),
    cityName,
  ]);
};

export const mergeCityGeocodeLocation = (
  item: JsonRecord,
  resolved: GeocodeLocation,
): JsonRecord => ({
  ...item,
  coordinates: getCoordinates(item) || resolved.coordinates,
  countryName: resolved.countryName,
  countryCode: resolved.countryCode,
});

const loadEnv = (): Record<string, string> => {
  const values: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const filename of ['.env', '.env.local']) {
    const filePath = path.resolve(import.meta.dirname, '..', filename);
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return values;
};

const parseArgs = (args: string[]): BackfillOptions => {
  const options: BackfillOptions = { apply: false, reportUnresolved: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--report-unresolved') options.reportUnresolved = true;
    else if (arg === '--trip') options.tripId = args[++index];
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else throw new Error(`Unsupported option: ${arg}`);
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error('--limit must be a positive integer.');
  }
  return options;
};

const parseGeocodeResult = (payload: unknown): GeocodeLocation | null => {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return null;
  const result = payload.results.find(isRecord);
  if (!result || !isRecord(result.geometry) || !isRecord(result.geometry.location)) return null;
  const lat = asFiniteCoordinate(result.geometry.location.lat, -90, 90);
  const lng = asFiniteCoordinate(result.geometry.location.lng, -180, 180);
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const country = components.find((component) => (
    isRecord(component) && Array.isArray(component.types) && component.types.includes('country')
  ));
  const countryName = isRecord(country) ? asText(country.long_name) : '';
  const countryCode = isRecord(country) ? asText(country.short_name).toUpperCase() : '';
  if (lat === null || lng === null || !countryName || !/^[A-Z]{2}$/.test(countryCode)) return null;
  return { coordinates: { lat, lng }, countryName, countryCode };
};

const geocode = async (
  apiKey: string,
  params: { address: string } | { coordinates: { lat: number; lng: number } },
): Promise<GeocodeLocation | null> => {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  if ('address' in params) url.searchParams.set('address', params.address);
  else {
    url.searchParams.set('latlng', `${params.coordinates.lat},${params.coordinates.lng}`);
    url.searchParams.set('result_type', 'country');
  }
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Geocoding returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (isRecord(payload) && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Geocoding returned ${String(payload.status || 'UNKNOWN_ERROR')}.`);
  }
  return parseGeocodeResult(payload);
};

const fetchTrips = async (
  supabaseUrl: string,
  serviceKey: string,
  options: BackfillOptions,
): Promise<TripRow[]> => {
  const rows: TripRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL('/rest/v1/trips', supabaseUrl);
    url.searchParams.set('select', 'id,data');
    url.searchParams.set('order', 'id.asc');
    url.searchParams.set('limit', String(Math.min(PAGE_SIZE, options.limit ? options.limit - rows.length : PAGE_SIZE)));
    url.searchParams.set('offset', String(offset));
    if (options.tripId) url.searchParams.set('id', `eq.${options.tripId}`);
    const response = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) throw new Error(`Trip fetch failed with HTTP ${response.status}: ${await response.text()}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Trip fetch returned a non-array response.');
    rows.push(...page.filter((row): row is TripRow => isRecord(row) && typeof row.id === 'string' && isRecord(row.data)));
    if (page.length < PAGE_SIZE || options.tripId || (options.limit && rows.length >= options.limit)) break;
  }
  return options.limit ? rows.slice(0, options.limit) : rows;
};

const updateTrip = async (supabaseUrl: string, serviceKey: string, trip: TripRow): Promise<void> => {
  const url = new URL('/rest/v1/trips', supabaseUrl);
  url.searchParams.set('id', `eq.${trip.id}`);
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ data: trip.data }),
  });
  if (!response.ok) throw new Error(`Trip ${trip.id} update failed with HTTP ${response.status}: ${await response.text()}`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const supabaseUrl = asText(env.VITE_SUPABASE_URL);
  const serviceKey = asText(env.SUPABASE_SERVICE_ROLE_KEY);
  const mapsApiKey = asText(env.VITE_GOOGLE_MAPS_API_KEY);
  if (!supabaseUrl || !serviceKey || !mapsApiKey) {
    throw new Error('VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and VITE_GOOGLE_MAPS_API_KEY are required.');
  }

  const trips = await fetchTrips(supabaseUrl, serviceKey, options);
  const cache = new Map<string, GeocodeLocation | null>();
  let cityCount = 0;
  let enrichedCityCount = 0;
  let changedTripCount = 0;
  let unresolvedCityCount = 0;
  const unresolvedCities: Array<{ tripId: string; cityId: string; label: string }> = [];

  for (const row of trips) {
    const items = Array.isArray(row.data.items) ? row.data.items : [];
    let changed = false;
    const nextItems: unknown[] = [];
    for (const rawItem of items) {
      if (!isRecord(rawItem) || rawItem.type !== 'city') {
        nextItems.push(rawItem);
        continue;
      }
      cityCount += 1;
      const coordinates = getCoordinates(rawItem);
      const hasCountry = Boolean(asText(rawItem.countryName) && /^[A-Za-z]{2}$/.test(asText(rawItem.countryCode)));
      if (coordinates && hasCountry) {
        nextItems.push(rawItem);
        continue;
      }

      let resolved: GeocodeLocation | null = null;
      if (coordinates) {
        const key = `reverse:${coordinates.lat.toFixed(5)},${coordinates.lng.toFixed(5)}`;
        if (!cache.has(key)) cache.set(key, await geocode(mapsApiKey, { coordinates }));
        resolved = cache.get(key) || null;
      } else {
        for (const query of buildCityForwardGeocodeQueries(rawItem, row.data)) {
          const key = `forward:${query.toLocaleLowerCase()}`;
          if (!cache.has(key)) cache.set(key, await geocode(mapsApiKey, { address: query }));
          resolved = cache.get(key) || null;
          if (resolved) break;
        }
      }

      if (!resolved) {
        unresolvedCityCount += 1;
        if (options.reportUnresolved) {
          unresolvedCities.push({
            tripId: row.id,
            cityId: asText(rawItem.id),
            label: asText(rawItem.location) || asText(rawItem.title),
          });
        }
        nextItems.push(rawItem);
        continue;
      }
      enrichedCityCount += 1;
      changed = true;
      nextItems.push(mergeCityGeocodeLocation(rawItem, resolved));
    }

    if (!changed) continue;
    changedTripCount += 1;
    row.data = { ...row.data, items: nextItems };
    if (options.apply) await updateTrip(supabaseUrl, serviceKey, row);
  }

  console.log(JSON.stringify({
    mode: options.apply ? 'apply' : 'dry-run',
    tripsScanned: trips.length,
    citiesScanned: cityCount,
    tripsChanged: changedTripCount,
    citiesEnriched: enrichedCityCount,
    citiesUnresolved: unresolvedCityCount,
    geocodingRequests: cache.size,
    ...(options.reportUnresolved ? { unresolvedCities } : {}),
  }, null, 2));
};

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
