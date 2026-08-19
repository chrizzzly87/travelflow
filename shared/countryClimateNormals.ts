/**
 * Shared types and validation for `data/countryClimateNormals.json`.
 *
 * The dataset holds monthly climate normals (temperature + precipitation) per country,
 * plus a curated `season` signal (high / shoulder / low) derived from the editorial
 * seasonality in `data/countryTravelData.json`.
 *
 * IMPORTANT: `season` is a curated product signal. It is NOT measured tourist volume and
 * must never be presented to users as measured data. See `docs/COUNTRY_CLIMATE_DATA.md`.
 *
 * Units: temperatures are degrees Celsius, precipitation is millimetres. Fahrenheit and
 * inches are derived at render time — units are never duplicated in the data file.
 */

export const COUNTRY_CLIMATE_SCHEMA_VERSION = 1;

export type ClimateSeason = 'high' | 'shoulder' | 'low';

/** Curated seasonality inputs consumed by {@link deriveClimateSeason}. */
export interface CountrySeasonalityInput {
  bestMonths?: number[];
  shoulderMonths?: number[];
  avoidMonths?: number[];
  events?: Array<{ month: number }>;
  publicHolidays?: Array<{ month: number }>;
}

/**
 * Human-readable statement of the season derivation rule. It is embedded in the generated
 * document and mirrored in `docs/COUNTRY_CLIMATE_DATA.md`.
 */
export const CLIMATE_SEASON_RULE = [
  'Per country and month: base = 2 if the month is in curated bestMonths, 0 if in avoidMonths, otherwise 1.',
  'boost = 0.5 for >=1 curated event in that month, +0.5 for >=2 events, +0.5 for >=1 public holiday, capped at 1.0.',
  'score = base + boost; season = high when score >= 2, shoulder when score >= 1, otherwise low.',
  'A month listed in avoidMonths can never be promoted above shoulder.',
].join(' ');

export const CLIMATE_SEASON_DISCLAIMER =
  'Curated editorial signal derived from TravelFlow seasonality data, events, and public holidays. It is NOT measured visitor volume and must not be presented as measured data.';

/**
 * Derives the curated travel-season signal for a country/month pair.
 * See {@link CLIMATE_SEASON_RULE}. This is a product signal, not measured tourist volume.
 */
export const deriveClimateSeason = (country: CountrySeasonalityInput, month: number): ClimateSeason => {
  const best = new Set(country.bestMonths || []);
  const avoid = new Set(country.avoidMonths || []);

  const base = best.has(month) ? 2 : avoid.has(month) ? 0 : 1;

  const eventCount = (country.events || []).filter((event) => event?.month === month).length;
  const holidayCount = (country.publicHolidays || []).filter((holiday) => holiday?.month === month).length;

  let boost = 0;
  if (eventCount >= 1) boost += 0.5;
  if (eventCount >= 2) boost += 0.5;
  if (holidayCount >= 1) boost += 0.5;
  boost = Math.min(boost, 1);

  const score = base + boost;
  if (avoid.has(month)) return score >= 1 ? 'shoulder' : 'low';
  if (score >= 2) return 'high';
  if (score >= 1) return 'shoulder';
  return 'low';
};

export type ClimateAnchorRole = 'primary' | 'secondary';

export interface CountryClimateAnchor {
  /** Stable id, `${countryCode}-${airportIata ?? index}`. */
  id: string;
  countryCode: string;
  role: ClimateAnchorRole;
  /** Human readable anchor label, e.g. `Bangkok (BKK)`. */
  label: string;
  latitude: number;
  longitude: number;
  airportIata?: string;
  airportIcao?: string;
  airportTier?: string;
  /** How the coordinate was chosen (`airport-medoid`, `curated-region`, `airport-centroid`). */
  derivation: string;
}

export interface CountryClimateAnchorRef {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface CountryClimateMonth {
  /** 1 = January … 12 = December. */
  month: number;
  /** Mean daily maximum temperature in °C. */
  avgHighC: number;
  /** Mean daily minimum temperature in °C. */
  avgLowC: number;
  /** Mean daily mean temperature in °C. */
  avgTempC: number;
  /** Mean total precipitation for the month in mm. */
  precipitationMm: number;
  /** Mean number of days in the month with >= 1 mm precipitation. */
  rainyDays: number;
  /** Curated travel-season signal — see module docblock. */
  season: ClimateSeason;
}

export interface CountryClimateRegion {
  key: string;
  label: string;
  anchor: CountryClimateAnchorRef;
  months: CountryClimateMonth[];
}

export interface CountryClimateRecord {
  countryCode: string;
  countryName: string;
  /** Primary anchor the country-level `months` were measured at. */
  anchor: CountryClimateAnchorRef;
  /** Total anchors sampled for this country (1 for most countries). */
  anchorCount: number;
  months: CountryClimateMonth[];
  /**
   * Present only for large/elongated countries where one anchor is not representative.
   * The first region always mirrors the country-level `anchor` / `months`.
   */
  regions?: CountryClimateRegion[];
}

export interface CountryClimateSource {
  provider: string;
  endpoint: string;
  dataset: string;
  window: {
    startDate: string;
    endDate: string;
    years: number;
  };
  accessedAt: string;
  license: string;
  attribution: string;
}

export interface CountryClimateUnits {
  temperature: 'celsius';
  precipitation: 'millimeters';
  note: string;
}

export interface CountryClimateSeasonDerivation {
  signal: 'curated';
  rule: string;
  disclaimer: string;
}

export interface CountryClimateDocument {
  schemaVersion: number;
  generatedAt: string;
  units: CountryClimateUnits;
  source: CountryClimateSource;
  seasonDerivation: CountryClimateSeasonDerivation;
  anchors: CountryClimateAnchor[];
  countries: CountryClimateRecord[];
}

/** Plausible bounds for monthly means anywhere on Earth (with generous headroom). */
export const CLIMATE_BOUNDS = {
  minTempC: -70,
  maxTempC: 60,
  maxPrecipitationMm: 4000,
  maxRainyDays: 31,
} as const;

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const SEASONS: readonly string[] = ['high', 'shoulder', 'low'];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const validateMonths = (
  months: unknown,
  scope: string,
  errors: string[],
): void => {
  if (!Array.isArray(months)) {
    errors.push(`${scope}: months must be an array`);
    return;
  }
  if (months.length !== 12) {
    errors.push(`${scope}: expected 12 months, received ${months.length}`);
  }

  const seen = new Set<number>();
  months.forEach((entry, index) => {
    const month = entry as Partial<CountryClimateMonth> | null;
    const label = `${scope}.months[${index}]`;
    if (!month || typeof month !== 'object') {
      errors.push(`${label}: must be an object`);
      return;
    }
    if (!isFiniteNumber(month.month) || !MONTHS.includes(month.month)) {
      errors.push(`${label}: month must be an integer 1-12`);
    } else if (seen.has(month.month)) {
      errors.push(`${label}: duplicate month ${month.month}`);
    } else {
      seen.add(month.month);
    }

    const numericFields: Array<[keyof CountryClimateMonth, number, number]> = [
      ['avgHighC', CLIMATE_BOUNDS.minTempC, CLIMATE_BOUNDS.maxTempC],
      ['avgLowC', CLIMATE_BOUNDS.minTempC, CLIMATE_BOUNDS.maxTempC],
      ['avgTempC', CLIMATE_BOUNDS.minTempC, CLIMATE_BOUNDS.maxTempC],
      ['precipitationMm', 0, CLIMATE_BOUNDS.maxPrecipitationMm],
      ['rainyDays', 0, CLIMATE_BOUNDS.maxRainyDays],
    ];

    numericFields.forEach(([field, min, max]) => {
      const value = month[field];
      if (!isFiniteNumber(value)) {
        errors.push(`${label}.${field}: must be a finite number`);
        return;
      }
      if (value < min || value > max) {
        errors.push(`${label}.${field}: ${value} is outside plausible bounds [${min}, ${max}]`);
      }
    });

    if (isFiniteNumber(month.avgHighC) && isFiniteNumber(month.avgLowC) && month.avgHighC < month.avgLowC) {
      errors.push(`${label}: avgHighC (${month.avgHighC}) must be >= avgLowC (${month.avgLowC})`);
    }

    if (typeof month.season !== 'string' || !SEASONS.includes(month.season)) {
      errors.push(`${label}.season: must be one of ${SEASONS.join(' | ')}`);
    }
  });

  if (seen.size > 0 && seen.size < 12) {
    const missing = MONTHS.filter((month) => !seen.has(month));
    if (missing.length > 0) errors.push(`${scope}: missing months ${missing.join(', ')}`);
  }
};

export interface ValidateCountryClimateOptions {
  /** Country codes that must exist in the document (e.g. every code in countryTravelData). */
  knownCountryCodes?: Set<string> | string[];
  /** Country codes that must be covered by the dataset (e.g. destination-guide countries). */
  requiredCountryCodes?: Set<string> | string[];
}

/**
 * Reports required country codes that the document does not cover. Kept separate from
 * {@link validateCountryClimateDocument} so callers can decide whether an incomplete backfill
 * is a hard error or a warning.
 */
export const findMissingClimateCoverage = (
  document: CountryClimateDocument | null | undefined,
  requiredCountryCodes: Set<string> | string[],
): string[] => {
  const required = requiredCountryCodes instanceof Set ? requiredCountryCodes : new Set(requiredCountryCodes);
  const covered = new Set((document?.countries || []).map((country) => country?.countryCode));
  return Array.from(required)
    .filter((code) => !covered.has(code))
    .sort();
};

const toSet = (value: Set<string> | string[] | undefined): Set<string> | undefined => {
  if (!value) return undefined;
  return value instanceof Set ? value : new Set(value);
};

export const validateCountryClimateDocument = (
  document: CountryClimateDocument | null | undefined,
  options: ValidateCountryClimateOptions = {},
): string[] => {
  const errors: string[] = [];
  if (!document || typeof document !== 'object') {
    return ['Document must be an object'];
  }

  if (document.schemaVersion !== COUNTRY_CLIMATE_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${COUNTRY_CLIMATE_SCHEMA_VERSION}, received ${String(document.schemaVersion)}`,
    );
  }
  if (typeof document.generatedAt !== 'string' || Number.isNaN(Date.parse(document.generatedAt))) {
    errors.push('generatedAt must be an ISO timestamp');
  }
  if (!document.source || typeof document.source.provider !== 'string' || !document.source.provider) {
    errors.push('source.provider is required');
  }
  if (!document.source || typeof document.source.endpoint !== 'string' || !document.source.endpoint) {
    errors.push('source.endpoint is required');
  }
  if (!document.source?.window?.startDate || !document.source?.window?.endDate) {
    errors.push('source.window.startDate and source.window.endDate are required');
  }
  if (!document.source || typeof document.source.attribution !== 'string' || !document.source.attribution) {
    errors.push('source.attribution is required');
  }
  if (document.units?.temperature !== 'celsius' || document.units?.precipitation !== 'millimeters') {
    errors.push('units must declare celsius temperature and millimeters precipitation');
  }
  if (document.seasonDerivation?.signal !== 'curated') {
    errors.push('seasonDerivation.signal must be "curated"');
  }
  if (!document.seasonDerivation?.rule) {
    errors.push('seasonDerivation.rule is required');
  }

  const anchors = Array.isArray(document.anchors) ? document.anchors : [];
  if (!Array.isArray(document.anchors)) errors.push('anchors must be an array');

  const anchorIds = new Set<string>();
  anchors.forEach((anchor, index) => {
    const label = `anchors[${index}]`;
    if (!anchor?.id) {
      errors.push(`${label}.id is required`);
    } else if (anchorIds.has(anchor.id)) {
      errors.push(`${label}.id duplicate: ${anchor.id}`);
    } else {
      anchorIds.add(anchor.id);
    }
    if (!isFiniteNumber(anchor?.latitude) || anchor.latitude < -90 || anchor.latitude > 90) {
      errors.push(`${label}.latitude must be within [-90, 90]`);
    }
    if (!isFiniteNumber(anchor?.longitude) || anchor.longitude < -180 || anchor.longitude > 180) {
      errors.push(`${label}.longitude must be within [-180, 180]`);
    }
    if (anchor?.role !== 'primary' && anchor?.role !== 'secondary') {
      errors.push(`${label}.role must be primary or secondary`);
    }
    if (!anchor?.label) errors.push(`${label}.label is required`);
  });

  const countries = Array.isArray(document.countries) ? document.countries : [];
  if (!Array.isArray(document.countries)) errors.push('countries must be an array');

  const knownCountryCodes = toSet(options.knownCountryCodes);
  const seenCountryCodes = new Set<string>();

  countries.forEach((country, index) => {
    const code = country?.countryCode;
    const scope = `countries[${index}]${code ? ` (${code})` : ''}`;
    if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) {
      errors.push(`${scope}.countryCode must be a 2-letter uppercase ISO code`);
    } else if (seenCountryCodes.has(code)) {
      errors.push(`${scope}.countryCode duplicate`);
    } else {
      seenCountryCodes.add(code);
      if (knownCountryCodes && !knownCountryCodes.has(code)) {
        errors.push(`${scope}.countryCode does not resolve to a known country`);
      }
    }

    if (!country?.anchor?.id || !anchorIds.has(country.anchor.id)) {
      errors.push(`${scope}.anchor.id must reference an entry in anchors`);
    }
    if (!isFiniteNumber(country?.anchor?.latitude) || !isFiniteNumber(country?.anchor?.longitude)) {
      errors.push(`${scope}.anchor must carry numeric latitude/longitude`);
    }

    validateMonths(country?.months, scope, errors);

    if (country?.regions !== undefined) {
      if (!Array.isArray(country.regions)) {
        errors.push(`${scope}.regions must be an array when present`);
      } else {
        const regionKeys = new Set<string>();
        country.regions.forEach((region, regionIndex) => {
          const regionScope = `${scope}.regions[${regionIndex}]`;
          if (!region?.key) {
            errors.push(`${regionScope}.key is required`);
          } else if (regionKeys.has(region.key)) {
            errors.push(`${regionScope}.key duplicate: ${region.key}`);
          } else {
            regionKeys.add(region.key);
          }
          if (!region?.anchor?.id || !anchorIds.has(region.anchor.id)) {
            errors.push(`${regionScope}.anchor.id must reference an entry in anchors`);
          }
          validateMonths(region?.months, regionScope, errors);
        });
      }
    }
  });

  anchors.forEach((anchor, index) => {
    if (anchor?.countryCode && !seenCountryCodes.has(anchor.countryCode)) {
      errors.push(`anchors[${index}].countryCode ${anchor.countryCode} has no matching country record`);
    }
  });

  const requiredCountryCodes = toSet(options.requiredCountryCodes);
  if (requiredCountryCodes) {
    const missing = Array.from(requiredCountryCodes).filter((code) => !seenCountryCodes.has(code));
    if (missing.length > 0) {
      errors.push(`Missing required country coverage: ${missing.sort().join(', ')}`);
    }
  }

  return errors;
};
