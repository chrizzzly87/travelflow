/**
 * Read-only accessors for `data/countryClimateNormals.json`.
 *
 * The dataset is committed to the repo and imported statically — no network call, no async API.
 * Every accessor returns `undefined` (or an empty array) for unknown input and never throws.
 *
 * Units: Celsius and millimetres. Convert to Fahrenheit/inches at render time with
 * {@link celsiusToFahrenheit} — the data file never duplicates units.
 *
 * `season` is a curated editorial signal, not measured visitor volume. See
 * `docs/COUNTRY_CLIMATE_DATA.md` before surfacing it in UI copy.
 */

import countryClimateNormals from '../data/countryClimateNormals.json';
import {
  type ClimateSeason,
  type CountryClimateDocument,
  type CountryClimateMonth,
  type CountryClimateRecord,
  type CountryClimateRegion,
  type CountryClimateSource,
} from '../shared/countryClimateNormals';

export type {
  ClimateSeason,
  CountryClimateMonth,
  CountryClimateRecord,
  CountryClimateRegion,
} from '../shared/countryClimateNormals';

const document = countryClimateNormals as unknown as CountryClimateDocument;

/** Qualitative rainfall buckets for a calendar month. */
export type RainfallLevel = 'dry' | 'light' | 'wet' | 'very-wet';

/**
 * Monthly precipitation thresholds in millimetres (lower bound inclusive).
 *
 * | Level      | Monthly total |
 * |------------|---------------|
 * | `dry`      | < 25 mm       |
 * | `light`    | 25–74 mm      |
 * | `wet`      | 75–174 mm     |
 * | `very-wet` | >= 175 mm     |
 *
 * Chosen so that Mediterranean summers land in `dry`, temperate year-round climates in
 * `light`/`wet`, and monsoon/tropical wet seasons in `very-wet`.
 */
export const RAINFALL_THRESHOLDS_MM = {
  light: 25,
  wet: 75,
  veryWet: 175,
} as const;

export interface MonthClimateSummary {
  avgHighC: number;
  avgLowC: number;
  precipitationMm: number;
  season: ClimateSeason;
}

const normalizeCountryCode = (countryCode: string | null | undefined): string | undefined => {
  if (typeof countryCode !== 'string') return undefined;
  const normalized = countryCode.trim().toUpperCase();
  return normalized.length === 2 ? normalized : undefined;
};

const isValidMonth = (month: unknown): month is number =>
  typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12;

const buildIndex = (): Map<string, CountryClimateRecord> => {
  const index = new Map<string, CountryClimateRecord>();
  const countries = Array.isArray(document?.countries) ? document.countries : [];
  countries.forEach((country) => {
    const code = normalizeCountryCode(country?.countryCode);
    if (code) index.set(code, country);
  });
  return index;
};

let countryIndex: Map<string, CountryClimateRecord> | null = null;

const getIndex = (): Map<string, CountryClimateRecord> => {
  if (!countryIndex) countryIndex = buildIndex();
  return countryIndex;
};

/** Full climate record for a country, or `undefined` when the country has no data. */
export const getCountryClimate = (countryCode: string | null | undefined): CountryClimateRecord | undefined => {
  const code = normalizeCountryCode(countryCode);
  if (!code) return undefined;
  return getIndex().get(code);
};

/** Raw month entry (including `avgTempC` and `rainyDays`), or `undefined`. */
export const getCountryClimateMonth = (
  countryCode: string | null | undefined,
  month: number,
): CountryClimateMonth | undefined => {
  if (!isValidMonth(month)) return undefined;
  const record = getCountryClimate(countryCode);
  if (!record || !Array.isArray(record.months)) return undefined;
  return record.months.find((entry) => entry?.month === month);
};

/** Compact summary for a country/month pair — the primary UI accessor. */
export const getMonthClimate = (
  countryCode: string | null | undefined,
  month: number,
): MonthClimateSummary | undefined => {
  const entry = getCountryClimateMonth(countryCode, month);
  if (!entry) return undefined;
  return {
    avgHighC: entry.avgHighC,
    avgLowC: entry.avgLowC,
    precipitationMm: entry.precipitationMm,
    season: entry.season,
  };
};

/** All 12 months for a country in calendar order, or an empty array when unknown. */
export const getCountryClimateMonths = (
  countryCode: string | null | undefined,
): CountryClimateMonth[] => {
  const record = getCountryClimate(countryCode);
  if (!record || !Array.isArray(record.months)) return [];
  return record.months.slice().sort((a, b) => a.month - b.month);
};

/** Curated season signal for a country/month pair, or `undefined`. */
export const getCountrySeason = (
  countryCode: string | null | undefined,
  month: number,
): ClimateSeason | undefined => getCountryClimateMonth(countryCode, month)?.season;

/**
 * Per-region breakdown for large/elongated countries. Returns an empty array for countries
 * modelled with a single anchor — the country-level record is representative in that case.
 */
export const getCountryClimateRegions = (
  countryCode: string | null | undefined,
): CountryClimateRegion[] => {
  const record = getCountryClimate(countryCode);
  if (!record?.regions || !Array.isArray(record.regions)) return [];
  return record.regions;
};

/** `true` when the country-level numbers come from one point and may misrepresent the country. */
export const hasMultipleClimateAnchors = (countryCode: string | null | undefined): boolean =>
  (getCountryClimate(countryCode)?.anchorCount || 1) > 1;

/** Buckets a monthly precipitation total into a qualitative label. See {@link RAINFALL_THRESHOLDS_MM}. */
export const getRainfallLevel = (precipitationMm: number | null | undefined): RainfallLevel | undefined => {
  if (typeof precipitationMm !== 'number' || !Number.isFinite(precipitationMm) || precipitationMm < 0) {
    return undefined;
  }
  if (precipitationMm >= RAINFALL_THRESHOLDS_MM.veryWet) return 'very-wet';
  if (precipitationMm >= RAINFALL_THRESHOLDS_MM.wet) return 'wet';
  if (precipitationMm >= RAINFALL_THRESHOLDS_MM.light) return 'light';
  return 'dry';
};

/** Convenience wrapper: rainfall bucket for a country/month pair. */
export const getMonthRainfallLevel = (
  countryCode: string | null | undefined,
  month: number,
): RainfallLevel | undefined => getRainfallLevel(getCountryClimateMonth(countryCode, month)?.precipitationMm);

/** Celsius → Fahrenheit, rounded to one decimal. Units are never duplicated in the data file. */
export const celsiusToFahrenheit = (celsius: number): number => Math.round((celsius * 1.8 + 32) * 10) / 10;

/** Every country code with climate data, sorted. */
export const listClimateCountryCodes = (): string[] => Array.from(getIndex().keys()).sort();

/** Source, licensing, and attribution metadata — render attribution wherever the data is shown. */
export const getClimateSourceMeta = (): CountryClimateSource => document.source;

/** Documented season-derivation rule and its "not measured data" disclaimer. */
export const getClimateSeasonDerivation = (): CountryClimateDocument['seasonDerivation'] =>
  document.seasonDerivation;

/** Test-only: drops the memoized country index. */
export const resetCountryClimateCacheForTests = (): void => {
  countryIndex = null;
};
