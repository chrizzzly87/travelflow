/**
 * Generates `data/countryClimateNormals.json` — monthly climate normals per country plus a
 * curated travel-season signal.
 *
 * Usage:
 *   pnpm climate:generate                  # refresh every country (uses on-disk cache)
 *   pnpm climate:generate --only=TH,JP     # refresh a subset
 *   pnpm climate:generate --force          # ignore the cache and refetch
 *   pnpm climate:generate --limit=10       # smoke test against the first N countries
 *   pnpm climate:generate --cached-only    # rebuild offline from tmp/climate-cache, never fetch
 *
 * The generated JSON is COMMITTED. This script is a manual refresh tool, never a build step,
 * so the production build never depends on a live network call.
 *
 * Source: Open-Meteo Historical Weather API (ERA5 reanalysis). Free, no API key.
 * https://open-meteo.com/en/docs/historical-weather-api
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  CLIMATE_SEASON_DISCLAIMER,
  CLIMATE_SEASON_RULE,
  COUNTRY_CLIMATE_SCHEMA_VERSION,
  deriveClimateSeason,
  type CountryClimateAnchor,
  type CountryClimateDocument,
  type CountryClimateMonth,
  type CountryClimateRecord,
  type CountryClimateRegion,
} from '../shared/countryClimateNormals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COUNTRY_TRAVEL_DATA_PATH = resolve(__dirname, '../data/countryTravelData.json');
const AIRPORTS_PATH = resolve(__dirname, '../public/data/airports/commercialAirports.generated.json');
const OUTPUT_PATH = resolve(__dirname, '../data/countryClimateNormals.json');
const CACHE_DIR = resolve(__dirname, '../tmp/climate-cache');

const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';
const WINDOW_START = '2015-01-01';
const WINDOW_END = '2024-12-31';
const WINDOW_YEARS = 10;

const REQUEST_DELAY_MS = Number(process.env.CLIMATE_REQUEST_DELAY_MS || 1200);
/** Open-Meteo's free tier is quota-weighted by days x variables, so 429s are expected. */
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.CLIMATE_RATE_LIMIT_COOLDOWN_MS || 65_000);
const MAX_RETRIES = 40;
const RAINY_DAY_THRESHOLD_MM = 1;

const SOURCE_LICENSE = 'CC BY 4.0 (Open-Meteo) — underlying ERA5 data © Copernicus Climate Change Service';
const SOURCE_ATTRIBUTION = 'Weather data by Open-Meteo.com (ERA5 reanalysis, Copernicus Climate Change Service)';

interface AirportEntry {
  iataCode?: string | null;
  icaoCode?: string | null;
  name: string;
  municipality?: string | null;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
  commercialServiceTier: 'major' | 'regional' | 'local';
}

interface CountryTravelEntry {
  countryCode: string;
  countryName: string;
  bestMonths?: number[];
  shoulderMonths?: number[];
  avoidMonths?: number[];
  events?: Array<{ month: number }>;
  publicHolidays?: Array<{ month: number }>;
}

interface CountryTravelDocument {
  countries: CountryTravelEntry[];
}

interface AnchorPlan {
  id: string;
  countryCode: string;
  role: 'primary' | 'secondary';
  label: string;
  latitude: number;
  longitude: number;
  airportIata?: string;
  airportIcao?: string;
  airportTier?: string;
  derivation: string;
  regionKey: string;
  regionLabel: string;
}

/**
 * Curated anchors.
 *
 * - A single entry pins the primary anchor to the country's main travel gateway, which is a
 *   better representative than the automatic medoid for countries we actively merchandise.
 * - Multiple entries are used where one point is clearly unrepresentative (very large landmass,
 *   strong latitudinal spread, elongated or archipelago shape). The first entry is the primary
 *   anchor behind the country-level `months`; the rest become `regions`.
 *
 * Every IATA code is checked against the in-repo airport dataset at runtime; an unknown code
 * produces a warning and falls back to the automatic anchor selection.
 */
const CURATED_COUNTRY_ANCHORS: Record<string, Array<{ iata: string; label: string }>> = {
  AE: [{ iata: 'DXB', label: 'Dubai' }],
  AM: [{ iata: 'EVN', label: 'Yerevan' }],
  AT: [{ iata: 'VIE', label: 'Vienna' }],
  AZ: [{ iata: 'GYD', label: 'Baku' }],
  BG: [{ iata: 'SOF', label: 'Sofia' }],
  BO: [
    { iata: 'LPB', label: 'La Paz (altiplano)' },
    { iata: 'VVI', label: 'Santa Cruz (lowlands)' },
  ],
  BW: [{ iata: 'GBE', label: 'Gaborone' }],
  CD: [{ iata: 'FIH', label: 'Kinshasa' }],
  CG: [{ iata: 'BZV', label: 'Brazzaville' }],
  CV: [{ iata: 'RAI', label: 'Praia' }],
  CZ: [{ iata: 'PRG', label: 'Prague' }],
  EC: [
    { iata: 'UIO', label: 'Quito (Andes)' },
    { iata: 'GYE', label: 'Guayaquil (coast)' },
  ],
  ET: [{ iata: 'ADD', label: 'Addis Ababa' }],
  FI: [
    { iata: 'HEL', label: 'Helsinki (south)' },
    { iata: 'RVN', label: 'Rovaniemi (Lapland)' },
  ],
  GE: [{ iata: 'TBS', label: 'Tbilisi' }],
  GH: [{ iata: 'ACC', label: 'Accra' }],
  GQ: [{ iata: 'SSG', label: 'Malabo' }],
  HN: [{ iata: 'TGU', label: 'Tegucigalpa' }],
  HT: [{ iata: 'PAP', label: 'Port-au-Prince' }],
  IE: [{ iata: 'DUB', label: 'Dublin' }],
  IR: [{ iata: 'IKA', label: 'Tehran' }],
  KI: [{ iata: 'TRW', label: 'Tarawa' }],
  KR: [
    { iata: 'ICN', label: 'Seoul' },
    { iata: 'CJU', label: 'Jeju (south)' },
  ],
  LT: [{ iata: 'VNO', label: 'Vilnius' }],
  LY: [{ iata: 'MJI', label: 'Tripoli' }],
  ML: [{ iata: 'BKO', label: 'Bamako' }],
  MM: [{ iata: 'RGN', label: 'Yangon' }],
  MW: [{ iata: 'LLW', label: 'Lilongwe' }],
  MZ: [{ iata: 'MPM', label: 'Maputo' }],
  NA: [{ iata: 'WDH', label: 'Windhoek' }],
  NG: [
    { iata: 'LOS', label: 'Lagos (coast)' },
    { iata: 'ABV', label: 'Abuja (interior)' },
  ],
  NP: [{ iata: 'KTM', label: 'Kathmandu' }],
  OM: [{ iata: 'MCT', label: 'Muscat' }],
  PK: [
    { iata: 'KHI', label: 'Karachi (south)' },
    { iata: 'ISB', label: 'Islamabad (north)' },
  ],
  PL: [{ iata: 'WAW', label: 'Warsaw' }],
  PY: [{ iata: 'ASU', label: 'Asuncion' }],
  RO: [{ iata: 'OTP', label: 'Bucharest' }],
  SD: [{ iata: 'KRT', label: 'Khartoum' }],
  SO: [{ iata: 'MGQ', label: 'Mogadishu' }],
  SY: [{ iata: 'DAM', label: 'Damascus' }],
  TL: [{ iata: 'DIL', label: 'Dili' }],
  TN: [{ iata: 'TUN', label: 'Tunis' }],
  TT: [{ iata: 'POS', label: 'Port of Spain' }],
  TW: [{ iata: 'TPE', label: 'Taipei' }],
  UA: [{ iata: 'IEV', label: 'Kyiv' }],
  UZ: [{ iata: 'TAS', label: 'Tashkent' }],
  YE: [{ iata: 'SAH', label: 'Sanaa' }],
  ZW: [{ iata: 'HRE', label: 'Harare' }],
  FM: [{ iata: 'PNI', label: 'Pohnpei' }],
  BB: [{ iata: 'BGI', label: 'Bridgetown' }],
  CH: [{ iata: 'ZRH', label: 'Zurich' }],
  CO: [
    { iata: 'BOG', label: 'Bogota (Andes)' },
    { iata: 'CTG', label: 'Cartagena (Caribbean coast)' },
  ],
  CR: [{ iata: 'SJO', label: 'San Jose' }],
  CU: [{ iata: 'HAV', label: 'Havana' }],
  CY: [{ iata: 'LCA', label: 'Larnaca' }],
  DE: [{ iata: 'BER', label: 'Berlin' }],
  DK: [{ iata: 'CPH', label: 'Copenhagen' }],
  DO: [{ iata: 'SDQ', label: 'Santo Domingo' }],
  FJ: [{ iata: 'NAN', label: 'Nadi' }],
  FR: [{ iata: 'CDG', label: 'Paris' }],
  GB: [{ iata: 'LHR', label: 'London' }],
  GR: [{ iata: 'ATH', label: 'Athens' }],
  HR: [
    { iata: 'ZAG', label: 'Zagreb (interior)' },
    { iata: 'SPU', label: 'Split (Adriatic coast)' },
  ],
  IS: [{ iata: 'KEF', label: 'Reykjavik' }],
  IT: [{ iata: 'FCO', label: 'Rome' }],
  JM: [{ iata: 'KIN', label: 'Kingston' }],
  KH: [{ iata: 'KTI', label: 'Phnom Penh' }],
  LK: [{ iata: 'CMB', label: 'Colombo' }],
  MA: [
    { iata: 'CMN', label: 'Casablanca (Atlantic coast)' },
    { iata: 'RAK', label: 'Marrakech (interior)' },
  ],
  MU: [{ iata: 'MRU', label: 'Mauritius' }],
  MV: [{ iata: 'MLE', label: 'Male' }],
  MY: [
    { iata: 'KUL', label: 'Kuala Lumpur (peninsula)' },
    { iata: 'BKI', label: 'Kota Kinabalu (Borneo)' },
  ],
  NL: [{ iata: 'AMS', label: 'Amsterdam' }],
  PH: [{ iata: 'MNL', label: 'Manila' }],
  SC: [{ iata: 'SEZ', label: 'Mahe' }],
  SE: [
    { iata: 'ARN', label: 'Stockholm (south)' },
    { iata: 'LLA', label: 'Lulea (Arctic north)' },
  ],
  SG: [{ iata: 'SIN', label: 'Singapore' }],
  TH: [{ iata: 'BKK', label: 'Bangkok' }],
  TZ: [
    { iata: 'DAR', label: 'Dar es Salaam (coast)' },
    { iata: 'JRO', label: 'Kilimanjaro (northern safari circuit)' },
  ],
  VN: [
    { iata: 'SGN', label: 'Ho Chi Minh City (south)' },
    { iata: 'DAD', label: 'Da Nang (central)' },
    { iata: 'HAN', label: 'Hanoi (north)' },
  ],
  AR: [
    { iata: 'EZE', label: 'Buenos Aires' },
    { iata: 'SLA', label: 'Salta (northwest)' },
    { iata: 'USH', label: 'Ushuaia (Patagonia)' },
  ],
  AU: [
    { iata: 'SYD', label: 'Sydney (southeast)' },
    { iata: 'MEL', label: 'Melbourne (south)' },
    { iata: 'PER', label: 'Perth (west)' },
    { iata: 'DRW', label: 'Darwin (tropical north)' },
  ],
  BR: [
    { iata: 'GRU', label: 'Sao Paulo (southeast)' },
    { iata: 'MAO', label: 'Manaus (Amazon)' },
    { iata: 'SSA', label: 'Salvador (northeast coast)' },
  ],
  CA: [
    { iata: 'YYZ', label: 'Toronto (east)' },
    { iata: 'YVR', label: 'Vancouver (west coast)' },
    { iata: 'YYC', label: 'Calgary (Rockies)' },
  ],
  CL: [
    { iata: 'SCL', label: 'Santiago (central)' },
    { iata: 'CJC', label: 'Calama (Atacama north)' },
    { iata: 'PUQ', label: 'Punta Arenas (far south)' },
  ],
  CN: [
    { iata: 'PEK', label: 'Beijing (north)' },
    { iata: 'CAN', label: 'Guangzhou (south)' },
    { iata: 'URC', label: 'Urumqi (northwest)' },
  ],
  DZ: [
    { iata: 'ALG', label: 'Algiers (coast)' },
    { iata: 'TMR', label: 'Tamanrasset (Sahara)' },
  ],
  EG: [
    { iata: 'CAI', label: 'Cairo (north)' },
    { iata: 'ASW', label: 'Aswan (south)' },
  ],
  ES: [
    { iata: 'MAD', label: 'Madrid (interior)' },
    { iata: 'AGP', label: 'Malaga (south coast)' },
    { iata: 'TFS', label: 'Tenerife (Canary Islands)' },
  ],
  ID: [
    { iata: 'CGK', label: 'Jakarta (Java)' },
    { iata: 'DPS', label: 'Bali' },
    { iata: 'BPN', label: 'Balikpapan (Borneo)' },
  ],
  IN: [
    { iata: 'DEL', label: 'Delhi (north)' },
    { iata: 'BOM', label: 'Mumbai (west coast)' },
    { iata: 'MAA', label: 'Chennai (south)' },
  ],
  JP: [
    { iata: 'HND', label: 'Tokyo (Honshu)' },
    { iata: 'CTS', label: 'Sapporo (Hokkaido)' },
    { iata: 'OKA', label: 'Okinawa (subtropical south)' },
  ],
  KZ: [
    { iata: 'ALA', label: 'Almaty (southeast)' },
    { iata: 'NQZ', label: 'Astana (steppe north)' },
  ],
  MX: [
    { iata: 'MEX', label: 'Mexico City (central highlands)' },
    { iata: 'CUN', label: 'Cancun (Caribbean coast)' },
    { iata: 'TIJ', label: 'Tijuana (northwest)' },
  ],
  NO: [
    { iata: 'OSL', label: 'Oslo (south)' },
    { iata: 'TOS', label: 'Tromso (Arctic north)' },
  ],
  NZ: [
    { iata: 'AKL', label: 'Auckland (north island)' },
    { iata: 'ZQN', label: 'Queenstown (south island)' },
  ],
  PE: [
    { iata: 'LIM', label: 'Lima (coast)' },
    { iata: 'CUZ', label: 'Cusco (Andes)' },
    { iata: 'IQT', label: 'Iquitos (Amazon)' },
  ],
  PT: [
    { iata: 'LIS', label: 'Lisbon (mainland)' },
    { iata: 'FNC', label: 'Madeira' },
  ],
  RU: [
    { iata: 'SVO', label: 'Moscow (west)' },
    { iata: 'AER', label: 'Sochi (Black Sea)' },
    { iata: 'VVO', label: 'Vladivostok (far east)' },
  ],
  SA: [
    { iata: 'RUH', label: 'Riyadh (interior)' },
    { iata: 'JED', label: 'Jeddah (Red Sea coast)' },
  ],
  TR: [
    { iata: 'IST', label: 'Istanbul (northwest)' },
    { iata: 'AYT', label: 'Antalya (Mediterranean coast)' },
  ],
  US: [
    { iata: 'JFK', label: 'New York (northeast)' },
    { iata: 'ORD', label: 'Chicago (midwest)' },
    { iata: 'MIA', label: 'Miami (southeast)' },
    { iata: 'LAX', label: 'Los Angeles (west coast)' },
  ],
  ZA: [
    { iata: 'JNB', label: 'Johannesburg (highveld)' },
    { iata: 'CPT', label: 'Cape Town (southwest coast)' },
  ],
};

/** Countries with no commercial airport in the in-repo dataset. Coordinates are capital cities. */
const FALLBACK_ANCHORS: Record<string, { label: string; latitude: number; longitude: number }> = {
  AD: { label: 'Andorra la Vella', latitude: 42.5063, longitude: 1.5218 },
  LI: { label: 'Vaduz', latitude: 47.141, longitude: 9.5215 },
  MC: { label: 'Monaco', latitude: 43.7384, longitude: 7.4246 },
  PS: { label: 'Ramallah', latitude: 31.9038, longitude: 35.2034 },
  SM: { label: 'San Marino', latitude: 43.9424, longitude: 12.4578 },
  VA: { label: 'Vatican City', latitude: 41.9029, longitude: 12.4534 },
};

const TIER_PRIORITY: Record<string, number> = { major: 0, regional: 1, local: 2 };

const round1 = (value: number): number => Math.round(value * 10) / 10;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const haversineKm = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

const airportLabel = (airport: AirportEntry): string => {
  const place = airport.municipality?.trim() || airport.name.replace(/\s+(International\s+)?Airport$/i, '').trim();
  return airport.iataCode ? `${place} (${airport.iataCode})` : place;
};

const parseArgs = (argv: string[]) => {
  const only = new Set<string>();
  let force = false;
  let cachedOnly = false;
  let limit = Number.POSITIVE_INFINITY;

  argv.forEach((arg) => {
    if (arg === '--force') force = true;
    else if (arg === '--cached-only') cachedOnly = true;
    else if (arg.startsWith('--only=')) {
      arg
        .slice('--only='.length)
        .split(',')
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean)
        .forEach((code) => only.add(code));
    } else if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
    }
  });

  return { only, force, cachedOnly, limit };
};

/**
 * Picks the medoid (the member closest to the group mean) of the highest available
 * commercial tier. Deterministic and independent of dataset ordering.
 */
const pickRepresentativeAirport = (airports: AirportEntry[]): AirportEntry | undefined => {
  if (airports.length === 0) return undefined;
  const bestTier = airports.reduce(
    (acc, airport) => Math.min(acc, TIER_PRIORITY[airport.commercialServiceTier] ?? 3),
    3,
  );
  const pool = airports.filter((airport) => (TIER_PRIORITY[airport.commercialServiceTier] ?? 3) === bestTier);
  const meanLat = pool.reduce((sum, airport) => sum + airport.latitude, 0) / pool.length;
  const meanLon = pool.reduce((sum, airport) => sum + airport.longitude, 0) / pool.length;

  return pool
    .slice()
    .sort((a, b) => {
      const distanceDelta =
        haversineKm(meanLat, meanLon, a.latitude, a.longitude) -
        haversineKm(meanLat, meanLon, b.latitude, b.longitude);
      if (Math.abs(distanceDelta) > 0.001) return distanceDelta;
      return (a.iataCode || a.name).localeCompare(b.iataCode || b.name);
    })
    .at(0);
};

const buildAnchorPlans = (
  country: CountryTravelEntry,
  airports: AirportEntry[],
  warnings: string[],
): AnchorPlan[] => {
  const curated = CURATED_COUNTRY_ANCHORS[country.countryCode];
  if (curated) {
    const byIata = new Map(airports.filter((a) => a.iataCode).map((a) => [a.iataCode as string, a]));
    const plans: AnchorPlan[] = [];
    curated.forEach((entry) => {
      const airport = byIata.get(entry.iata);
      if (!airport) {
        warnings.push(`${country.countryCode}: curated anchor ${entry.iata} not found in airport dataset`);
        return;
      }
      plans.push({
        id: `${country.countryCode}-${entry.iata}`,
        countryCode: country.countryCode,
        role: plans.length === 0 ? 'primary' : 'secondary',
        label: `${entry.label} (${entry.iata})`,
        latitude: airport.latitude,
        longitude: airport.longitude,
        airportIata: entry.iata,
        airportIcao: airport.icaoCode || undefined,
        airportTier: airport.commercialServiceTier,
        derivation: 'curated-region',
        regionKey: entry.iata.toLowerCase(),
        regionLabel: entry.label,
      });
    });
    if (plans.length > 0) return plans;
  }

  const airport = pickRepresentativeAirport(airports);
  if (airport) {
    const suffix = airport.iataCode || airport.icaoCode || 'anchor';
    return [
      {
        id: `${country.countryCode}-${suffix}`,
        countryCode: country.countryCode,
        role: 'primary',
        label: airportLabel(airport),
        latitude: airport.latitude,
        longitude: airport.longitude,
        airportIata: airport.iataCode || undefined,
        airportIcao: airport.icaoCode || undefined,
        airportTier: airport.commercialServiceTier,
        derivation: 'airport-medoid',
        regionKey: suffix.toLowerCase(),
        regionLabel: airportLabel(airport),
      },
    ];
  }

  const fallback = FALLBACK_ANCHORS[country.countryCode];
  if (fallback) {
    return [
      {
        id: `${country.countryCode}-capital`,
        countryCode: country.countryCode,
        role: 'primary',
        label: fallback.label,
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        derivation: 'curated-capital',
        regionKey: 'capital',
        regionLabel: fallback.label,
      },
    ];
  }

  warnings.push(`${country.countryCode}: no airport and no fallback anchor — skipped`);
  return [];
};

interface DailySeries {
  time: string[];
  temperature_2m_max: Array<number | null>;
  temperature_2m_min: Array<number | null>;
  precipitation_sum: Array<number | null>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });

const fetchDailySeries = async (anchor: AnchorPlan): Promise<DailySeries> => {
  const url = new URL(ARCHIVE_ENDPOINT);
  url.searchParams.set('latitude', anchor.latitude.toFixed(4));
  url.searchParams.set('longitude', anchor.longitude.toFixed(4));
  url.searchParams.set('start_date', WINDOW_START);
  url.searchParams.set('end_date', WINDOW_END);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  url.searchParams.set('timezone', 'UTC');

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    let rateLimited = false;
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (response.status === 429) {
        rateLimited = true;
        throw new Error('Open-Meteo responded with 429 (quota)');
      }
      if (response.status >= 500) {
        throw new Error(`Open-Meteo responded with ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`Open-Meteo responded with ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      const payload = (await response.json()) as { daily?: DailySeries };
      if (!payload.daily?.time?.length) throw new Error('Open-Meteo returned no daily series');
      return payload.daily;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        // Quota resets on a fixed window, so a flat cooldown beats exponential backoff there.
        const backoff = rateLimited ? RATE_LIMIT_COOLDOWN_MS : REQUEST_DELAY_MS * 2 ** attempt;
        console.warn(`  retry ${attempt}/${MAX_RETRIES - 1} for ${anchor.id} in ${backoff}ms (${String(error)})`);
        await sleep(backoff);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const loadCachedSeries = async (anchor: AnchorPlan, force: boolean): Promise<DailySeries | null> => {
  if (force) return null;
  const path = resolve(CACHE_DIR, `${anchor.id}.json`);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as {
      window?: { startDate?: string; endDate?: string };
      latitude?: number;
      longitude?: number;
      daily?: DailySeries;
    };
    if (raw.window?.startDate !== WINDOW_START || raw.window?.endDate !== WINDOW_END) return null;
    if (round1(raw.latitude ?? NaN) !== round1(anchor.latitude)) return null;
    if (round1(raw.longitude ?? NaN) !== round1(anchor.longitude)) return null;
    return raw.daily?.time?.length ? raw.daily : null;
  } catch {
    return null;
  }
};

const saveCachedSeries = async (anchor: AnchorPlan, daily: DailySeries): Promise<void> => {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    resolve(CACHE_DIR, `${anchor.id}.json`),
    JSON.stringify({
      anchorId: anchor.id,
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      window: { startDate: WINDOW_START, endDate: WINDOW_END },
      fetchedAt: new Date().toISOString(),
      daily,
    }),
    'utf8',
  );
};

interface MonthAggregate {
  avgHighC: number;
  avgLowC: number;
  avgTempC: number;
  precipitationMm: number;
  rainyDays: number;
}

const aggregateMonthlyNormals = (daily: DailySeries, anchorId: string): MonthAggregate[] => {
  const highs: number[][] = Array.from({ length: 12 }, () => []);
  const lows: number[][] = Array.from({ length: 12 }, () => []);
  const means: number[][] = Array.from({ length: 12 }, () => []);
  const precipByYearMonth = new Map<string, number>();
  const rainyByYearMonth = new Map<string, number>();
  const yearsByMonth: Array<Set<string>> = Array.from({ length: 12 }, () => new Set<string>());

  daily.time.forEach((iso, index) => {
    const year = iso.slice(0, 4);
    const monthIndex = Number(iso.slice(5, 7)) - 1;
    if (monthIndex < 0 || monthIndex > 11) return;

    const high = daily.temperature_2m_max[index];
    const low = daily.temperature_2m_min[index];
    const precipitation = daily.precipitation_sum[index];

    if (typeof high === 'number' && Number.isFinite(high)) highs[monthIndex].push(high);
    if (typeof low === 'number' && Number.isFinite(low)) lows[monthIndex].push(low);
    if (
      typeof high === 'number' &&
      typeof low === 'number' &&
      Number.isFinite(high) &&
      Number.isFinite(low)
    ) {
      means[monthIndex].push((high + low) / 2);
    }

    if (typeof precipitation === 'number' && Number.isFinite(precipitation)) {
      const key = `${year}-${monthIndex}`;
      yearsByMonth[monthIndex].add(year);
      precipByYearMonth.set(key, (precipByYearMonth.get(key) || 0) + precipitation);
      if (precipitation >= RAINY_DAY_THRESHOLD_MM) {
        rainyByYearMonth.set(key, (rainyByYearMonth.get(key) || 0) + 1);
      }
    }
  });

  const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

  return Array.from({ length: 12 }, (_unused, monthIndex) => {
    if (highs[monthIndex].length === 0 || lows[monthIndex].length === 0) {
      throw new Error(`${anchorId}: no temperature samples for month ${monthIndex + 1}`);
    }
    const years = Array.from(yearsByMonth[monthIndex]);
    const monthlyTotals = years.map((year) => precipByYearMonth.get(`${year}-${monthIndex}`) || 0);
    const monthlyRainy = years.map((year) => rainyByYearMonth.get(`${year}-${monthIndex}`) || 0);

    const avgHighC = round1(mean(highs[monthIndex]));
    const avgLowC = round1(mean(lows[monthIndex]));

    return {
      avgHighC,
      // ERA5 max is always >= min per day, but guard against rounding flipping the pair.
      avgLowC: Math.min(avgLowC, avgHighC),
      avgTempC: round1(mean(means[monthIndex])),
      precipitationMm: monthlyTotals.length > 0 ? Math.max(0, round1(mean(monthlyTotals))) : 0,
      rainyDays: monthlyRainy.length > 0 ? Math.max(0, round1(mean(monthlyRainy))) : 0,
    };
  });
};

const toMonths = (aggregates: MonthAggregate[], country: CountryTravelEntry): CountryClimateMonth[] =>
  aggregates.map((aggregate, index) => ({
    month: index + 1,
    ...aggregate,
    season: deriveClimateSeason(country, index + 1),
  }));

const main = async (): Promise<void> => {
  const { only, force, cachedOnly, limit } = parseArgs(process.argv.slice(2));

  const travelDocument = JSON.parse(await readFile(COUNTRY_TRAVEL_DATA_PATH, 'utf8')) as CountryTravelDocument;
  const airports = JSON.parse(await readFile(AIRPORTS_PATH, 'utf8')) as AirportEntry[];

  const airportsByCountry = new Map<string, AirportEntry[]>();
  airports.forEach((airport) => {
    if (!airport?.countryCode || !Number.isFinite(airport.latitude) || !Number.isFinite(airport.longitude)) return;
    const bucket = airportsByCountry.get(airport.countryCode);
    if (bucket) bucket.push(airport);
    else airportsByCountry.set(airport.countryCode, [airport]);
  });

  const warnings: string[] = [];
  const targets = travelDocument.countries
    .filter((country) => (only.size === 0 ? true : only.has(country.countryCode)))
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  const existing = existsSync(OUTPUT_PATH)
    ? (JSON.parse(await readFile(OUTPUT_PATH, 'utf8')) as CountryClimateDocument)
    : null;
  const existingByCode = new Map((existing?.countries || []).map((entry) => [entry.countryCode, entry]));
  const existingAnchorsByCode = new Map<string, CountryClimateAnchor[]>();
  (existing?.anchors || []).forEach((anchor) => {
    const bucket = existingAnchorsByCode.get(anchor.countryCode);
    if (bucket) bucket.push(anchor);
    else existingAnchorsByCode.set(anchor.countryCode, [anchor]);
  });

  const records: CountryClimateRecord[] = [];
  const anchorEntries: CountryClimateAnchor[] = [];
  const failures: string[] = [];

  let processed = 0;
  for (const country of targets) {
    processed += 1;
    const plans = buildAnchorPlans(country, airportsByCountry.get(country.countryCode) || [], warnings);
    if (plans.length === 0) {
      failures.push(`${country.countryCode} (${country.countryName}): no anchor`);
      continue;
    }

    const regions: CountryClimateRegion[] = [];
    const planAnchors: CountryClimateAnchor[] = [];
    let failed = false;

    for (const plan of plans) {
      let daily = await loadCachedSeries(plan, force);
      if (!daily && cachedOnly) {
        failures.push(`${country.countryCode} anchor ${plan.id}: not cached (--cached-only)`);
        failed = true;
        break;
      }
      if (!daily) {
        try {
          console.log(`[${processed}/${targets.length}] fetching ${plan.id} (${plan.label})`);
          daily = await fetchDailySeries(plan);
          await saveCachedSeries(plan, daily);
        } catch (error) {
          failures.push(`${country.countryCode} anchor ${plan.id}: ${String(error)}`);
          failed = true;
          break;
        }
        await sleep(REQUEST_DELAY_MS);
      }

      try {
        const aggregates = aggregateMonthlyNormals(daily, plan.id);
        regions.push({
          key: plan.regionKey,
          label: plan.regionLabel,
          anchor: { id: plan.id, label: plan.label, latitude: plan.latitude, longitude: plan.longitude },
          months: toMonths(aggregates, country),
        });
        planAnchors.push({
          id: plan.id,
          countryCode: plan.countryCode,
          role: plan.role,
          label: plan.label,
          latitude: plan.latitude,
          longitude: plan.longitude,
          airportIata: plan.airportIata,
          airportIcao: plan.airportIcao,
          airportTier: plan.airportTier,
          derivation: plan.derivation,
        });
      } catch (error) {
        failures.push(`${country.countryCode} anchor ${plan.id}: ${String(error)}`);
        failed = true;
        break;
      }
    }

    if (failed || regions.length === 0) {
      const previous = existingByCode.get(country.countryCode);
      if (previous) {
        records.push(previous);
        anchorEntries.push(...(existingAnchorsByCode.get(country.countryCode) || []));
        warnings.push(`${country.countryCode}: fetch failed, kept previously committed record`);
      }
      continue;
    }

    const primary = regions[0];
    records.push({
      countryCode: country.countryCode,
      countryName: country.countryName,
      anchor: primary.anchor,
      anchorCount: regions.length,
      months: primary.months,
      ...(regions.length > 1 ? { regions } : {}),
    });
    anchorEntries.push(...planAnchors);
  }

  // Preserve countries that were not part of this run (e.g. --only / --limit).
  if (only.size > 0 || Number.isFinite(limit)) {
    const covered = new Set(records.map((record) => record.countryCode));
    (existing?.countries || []).forEach((record) => {
      if (covered.has(record.countryCode)) return;
      records.push(record);
      anchorEntries.push(...(existingAnchorsByCode.get(record.countryCode) || []));
    });
  }

  records.sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  anchorEntries.sort((a, b) => a.id.localeCompare(b.id));

  const document: CountryClimateDocument = {
    schemaVersion: COUNTRY_CLIMATE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    units: {
      temperature: 'celsius',
      precipitation: 'millimeters',
      note: 'Celsius and millimetres only. Fahrenheit and inches are derived at render time — never duplicate units in this file.',
    },
    source: {
      provider: 'Open-Meteo',
      endpoint: ARCHIVE_ENDPOINT,
      dataset: 'ERA5 / ERA5-Land reanalysis (Historical Weather API)',
      window: { startDate: WINDOW_START, endDate: WINDOW_END, years: WINDOW_YEARS },
      accessedAt: new Date().toISOString(),
      license: SOURCE_LICENSE,
      attribution: SOURCE_ATTRIBUTION,
    },
    seasonDerivation: {
      signal: 'curated',
      rule: CLIMATE_SEASON_RULE,
      disclaimer: CLIMATE_SEASON_DISCLAIMER,
    },
    anchors: anchorEntries,
    countries: records,
  };

  // Pretty-printed for readable diffs, except month rows which stay on one line each —
  // the file is ~40% smaller that way and a month is easier to scan as a single row.
  const serialized = JSON.stringify(document, null, 2).replace(
    /\{\s*\n\s*"month": [\s\S]*?\n\s*\}/g,
    (block) => block.replace(/\s*\n\s*/g, ' ').replace(/\{ /, '{ ').replace(/ \}$/, ' }'),
  );
  await writeFile(OUTPUT_PATH, `${serialized}\n`, 'utf8');

  console.log(
    `Wrote ${records.length} countries / ${anchorEntries.length} anchors to data/countryClimateNormals.json`,
  );
  if (warnings.length > 0) console.warn(`Warnings:\n  ${warnings.join('\n  ')}`);
  if (failures.length > 0) {
    console.error(`Failures:\n  ${failures.join('\n  ')}`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
