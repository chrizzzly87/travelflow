import {
  deriveAirportCommercialFlags,
  type AirportReference,
  type AirportReferenceMetadata,
} from './airportReference.ts';

export const PRIMARY_AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
export const MIRROR_AIRPORTS_URL = 'https://datahub.io/core/airport-codes/_r/-/archive/data.csv';
export const ENRICHMENT_AIRPORTS_URL = 'https://raw.githubusercontent.com/mborsetti/airportsdata/main/airportsdata/airports.csv';

export interface PrimaryAirportRecord {
  ident: string;
  airportType: 'large_airport' | 'medium_airport' | 'small_airport' | 'other';
  name: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  regionCode: string | null;
  municipality: string | null;
  scheduledService: boolean;
  icaoCode: string | null;
  iataCode: string | null;
}

export interface EnrichmentAirportRecord {
  icaoCode: string;
  iataCode: string | null;
  subdivisionName: string | null;
  timezone: string | null;
}

type CsvRow = string[];

const normalizeText = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const normalizeNullableText = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const normalizeCode = (value: unknown): string | null => {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || null;
};

const normalizeBoolean = (value: unknown): boolean => (
  normalizeText(value).toLowerCase() === 'yes'
);

const normalizeNumber = (value: unknown): number | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseCsvLine = (line: string): CsvRow => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
};

const parseCsvDocument = (csv: string): { header: string[]; rows: CsvRow[] } => {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length === 0) return { header: [], rows: [] };
  const [headerLine, ...rowLines] = lines;
  return {
    header: parseCsvLine(headerLine),
    rows: rowLines.map(parseCsvLine),
  };
};

const buildColumnIndex = (header: string[]): Record<string, number> => (
  Object.fromEntries(header.map((columnName, index) => [columnName, index]))
);

export const resolveCountryName = (countryCode: string): string => {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
};

const normalizeAirportType = (value: unknown): PrimaryAirportRecord['airportType'] => {
  const normalized = normalizeText(value);
  if (normalized === 'large_airport' || normalized === 'medium_airport' || normalized === 'small_airport') {
    return normalized;
  }
  return 'other';
};

export const parsePrimaryAirportCsv = (csv: string): PrimaryAirportRecord[] => {
  const { header, rows } = parseCsvDocument(csv);
  const columns = buildColumnIndex(header);

  return rows
    .map((row): PrimaryAirportRecord | null => {
      const ident = normalizeCode(row[columns.ident]);
      const airportType = normalizeAirportType(row[columns.type]);
      const name = normalizeText(row[columns.name]);
      const latitude = normalizeNumber(row[columns.latitude_deg]);
      const longitude = normalizeNumber(row[columns.longitude_deg]);
      const countryCode = normalizeCode(row[columns.iso_country]);

      if (!ident || !name || !countryCode || latitude === null || longitude === null) return null;

      return {
        ident,
        airportType,
        name,
        latitude,
        longitude,
        countryCode,
        regionCode: normalizeCode(row[columns.iso_region]),
        municipality: normalizeNullableText(row[columns.municipality]),
        scheduledService: normalizeBoolean(row[columns.scheduled_service]),
        icaoCode: normalizeCode(row[columns.icao_code]),
        iataCode: normalizeCode(row[columns.iata_code]),
      };
    })
    .filter((entry): entry is PrimaryAirportRecord => Boolean(entry));
};

export const parseEnrichmentAirportCsv = (csv: string): EnrichmentAirportRecord[] => {
  const { header, rows } = parseCsvDocument(csv);
  const columns = buildColumnIndex(header);

  return rows
    .map((row): EnrichmentAirportRecord | null => {
      const icaoCode = normalizeCode(row[columns.icao]);
      if (!icaoCode) return null;

      return {
        icaoCode,
        iataCode: normalizeCode(row[columns.iata]),
        subdivisionName: normalizeNullableText(row[columns.subd]),
        timezone: normalizeNullableText(row[columns.tz]),
      };
    })
    .filter((entry): entry is EnrichmentAirportRecord => Boolean(entry));
};

const buildUniqueMap = <T>(items: T[], keySelector: (item: T) => string | null): Map<string, T> => {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = keySelector(item);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const uniqueItems = new Map<string, T>();
  items.forEach((item) => {
    const key = keySelector(item);
    if (!key || counts.get(key) !== 1) return;
    uniqueItems.set(key, item);
  });

  return uniqueItems;
};

const isCommercialAirport = (airport: PrimaryAirportRecord): boolean => {
  if (!airport.scheduledService) return false;
  if (airport.airportType !== 'large_airport' && airport.airportType !== 'medium_airport' && airport.airportType !== 'small_airport') {
    return false;
  }
  return Boolean(airport.iataCode || airport.icaoCode);
};

export const mergeAirportSources = (
  primaryAirports: PrimaryAirportRecord[],
  enrichmentAirports: EnrichmentAirportRecord[],
): AirportReference[] => {
  const enrichmentByIcao = buildUniqueMap(enrichmentAirports, (item) => item.icaoCode);
  const enrichmentByIata = buildUniqueMap(enrichmentAirports, (item) => item.iataCode);

  return primaryAirports
    .filter(isCommercialAirport)
    .map((airport) => {
      const enrichment = (
        (airport.icaoCode ? enrichmentByIcao.get(airport.icaoCode) : null)
        || (airport.ident ? enrichmentByIcao.get(airport.ident) : null)
        || (airport.iataCode ? enrichmentByIata.get(airport.iataCode) : null)
        || null
      );
      const resolvedAirportType = airport.airportType === 'other' ? 'small_airport' : airport.airportType;
      const commercialFlags = deriveAirportCommercialFlags({
        airportType: resolvedAirportType,
        scheduledService: airport.scheduledService,
        iataCode: airport.iataCode,
        icaoCode: airport.icaoCode || airport.ident,
      });

      return {
        ident: airport.ident,
        iataCode: airport.iataCode,
        icaoCode: airport.icaoCode || airport.ident,
        name: airport.name,
        municipality: airport.municipality,
        subdivisionName: enrichment?.subdivisionName || null,
        regionCode: airport.regionCode,
        countryCode: airport.countryCode,
        countryName: resolveCountryName(airport.countryCode),
        latitude: airport.latitude,
        longitude: airport.longitude,
        timezone: enrichment?.timezone || null,
        airportType: resolvedAirportType,
        scheduledService: airport.scheduledService,
        isCommercial: commercialFlags.isCommercial,
        commercialServiceTier: commercialFlags.commercialServiceTier,
        isMajorCommercial: commercialFlags.isMajorCommercial,
      } satisfies AirportReference;
    })
    .sort((left, right) => (
      (left.iataCode || left.icaoCode || left.ident).localeCompare(right.iataCode || right.icaoCode || right.ident)
      || left.name.localeCompare(right.name)
      || left.ident.localeCompare(right.ident)
    ));
};

export const buildDataVersion = (generatedAt: string, airportCount: number): string => (
  `${generatedAt.slice(0, 10)}-${airportCount}`
);

const fetchText = async (url: string, fetchImpl: typeof fetch = fetch): Promise<string> => {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

export const generateAirportReferenceArtifacts = async (
  fetchImpl: typeof fetch = fetch,
): Promise<{
  airports: AirportReference[];
  metadata: AirportReferenceMetadata;
}> => {
  const [primaryCsv, enrichmentCsv] = await Promise.all([
    fetchText(PRIMARY_AIRPORTS_URL, fetchImpl),
    fetchText(ENRICHMENT_AIRPORTS_URL, fetchImpl),
  ]);

  const primaryAirports = parsePrimaryAirportCsv(primaryCsv);
  const enrichmentAirports = parseEnrichmentAirportCsv(enrichmentCsv);
  const airports = mergeAirportSources(primaryAirports, enrichmentAirports);
  const generatedAt = new Date().toISOString();

  return {
    airports,
    metadata: {
      dataVersion: buildDataVersion(generatedAt, airports.length),
      generatedAt,
      commercialAirportCount: airports.length,
      sourceAirportCount: primaryAirports.length,
      sources: {
        primary: PRIMARY_AIRPORTS_URL,
        mirror: MIRROR_AIRPORTS_URL,
        enrichment: ENRICHMENT_AIRPORTS_URL,
      },
    },
  };
};
