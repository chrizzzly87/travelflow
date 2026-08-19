/**
 * View-model layer for the `/inspirations/countries` explorer.
 *
 * Everything here is pure and synchronous so the page can derive at render time (no effects) and
 * so the interesting logic is testable in Node without mounting React.
 *
 * Two data sources feed a card:
 *  - the curated destination guide (`seasonality`) — always present, drives the 12-month strip;
 *  - the climate normals dataset — **partial coverage by design**. Every climate accessor returns
 *    `undefined` for uncovered countries, and this module never fabricates a substitute. Missing
 *    climate simply means the card falls back to the curated strip.
 */

import type { DestinationGuideEntry, DestinationSeason } from '../shared/destinationGuides';
import { SUPPORTED_LOCALES } from '../config/locales';
import { getLocalizedCountryNameFromData } from '../data/countryTravelData';
import { getCountryAliases } from './countryAliasService';
import { listDestinationGuides } from './destinationGuideService';
import {
  getMonthClimate,
  getRainfallLevel,
  type ClimateSeason,
  type RainfallLevel,
} from './countryClimateService';
import {
  buildSearchTokens,
  type CountrySearchToken,
  type NormalizedSearchToken,
} from './countryExplorerSearch';

export const COUNTRY_EXPLORER_GUIDE_LIMIT = 100;
export const MONTHS_IN_YEAR = 12;

/** Curated best/shoulder/avoid band for one month. Never derived from climate numbers. */
export type CountrySeasonBand = DestinationSeason;

export interface CountryExplorerEntry {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  region: string;
  tags: string[];
  recommendedDays?: number;
  idealMonths: number[];
  shoulderMonths: number[];
  /** 12 entries, index 0 = January. Precomputed so cards never scan arrays per render. */
  seasonBands: CountrySeasonBand[];
  searchTokens: NormalizedSearchToken[];
}

/**
 * Everything a card needs for one selected month.
 * `climate` is absent whenever the country is not in the climate dataset yet.
 */
export interface CountryMonthInsight {
  month: number;
  /** Curated editorial band from the guide's `seasonality`. Always available. */
  band: CountrySeasonBand;
  climate?: {
    avgHighC: number;
    avgLowC: number;
    precipitationMm: number;
    rainfall: RainfallLevel;
    /** Curated season signal — NOT measured visitor volume. See docs/COUNTRY_CLIMATE_DATA.md. */
    season: ClimateSeason;
  };
}

const isValidMonth = (month: unknown): month is number => (
  typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= MONTHS_IN_YEAR
);

const buildSeasonBands = (guide: DestinationGuideEntry): CountrySeasonBand[] => {
  const ideal = new Set(guide.seasonality?.idealMonths || []);
  const shoulder = new Set(guide.seasonality?.shoulderMonths || []);
  return Array.from({ length: MONTHS_IN_YEAR }, (_entry, index) => {
    const month = index + 1;
    if (ideal.has(month)) return 'ideal';
    if (shoulder.has(month)) return 'shoulder';
    return 'avoid';
  });
};

const buildEntryTokens = (guide: DestinationGuideEntry): NormalizedSearchToken[] => {
  const tokens: CountrySearchToken[] = [
    { value: guide.name, kind: 'name' },
    { value: guide.slug, kind: 'name' },
    { value: guide.countryCode, kind: 'code' },
    { value: guide.region, kind: 'region' },
  ];

  getCountryAliases(guide.countryCode).forEach((alias) => tokens.push({ value: alias, kind: 'alias' }));
  SUPPORTED_LOCALES.forEach((locale) => {
    const localizedName = getLocalizedCountryNameFromData(guide.countryCode, locale);
    if (localizedName) tokens.push({ value: localizedName, kind: 'alias' });
  });
  guide.tags.forEach((tag) => tokens.push({ value: tag, kind: 'tag' }));

  return buildSearchTokens(tokens);
};

export const toCountryExplorerEntry = (guide: DestinationGuideEntry): CountryExplorerEntry => ({
  id: guide.id,
  name: guide.name,
  slug: guide.slug,
  countryCode: guide.countryCode,
  region: guide.region,
  tags: guide.tags,
  recommendedDays: guide.suggestedTripDays?.recommended,
  idealMonths: guide.seasonality?.idealMonths || [],
  shoulderMonths: guide.seasonality?.shoulderMonths || [],
  seasonBands: buildSeasonBands(guide),
  searchTokens: buildEntryTokens(guide),
});

let cachedEntries: CountryExplorerEntry[] | null = null;

/**
 * All country guides as explorer entries, in editorial priority order.
 * Memoized at module scope — the underlying data is a static JSON import.
 */
export const listCountryExplorerEntries = (): CountryExplorerEntry[] => {
  if (!cachedEntries) {
    cachedEntries = listDestinationGuides({ kind: 'country', limit: COUNTRY_EXPLORER_GUIDE_LIMIT })
      .map(toCountryExplorerEntry);
  }
  return cachedEntries;
};

/** Test-only: drops the memoized entry list. */
export const resetCountryExplorerCacheForTests = (): void => {
  cachedEntries = null;
};

/** Curated band for a month, or `'avoid'` for out-of-range input (never throws). */
export const getSeasonBand = (entry: CountryExplorerEntry, month: number): CountrySeasonBand => (
  isValidMonth(month) ? entry.seasonBands[month - 1] : 'avoid'
);

/**
 * Per-month card data. Degrades gracefully: when the climate dataset has no row for this country
 * (or the row is incomplete) the `climate` field is simply omitted rather than zero-filled.
 */
export const getCountryMonthInsight = (
  entry: CountryExplorerEntry,
  month: number,
): CountryMonthInsight | undefined => {
  if (!isValidMonth(month)) return undefined;

  const insight: CountryMonthInsight = { month, band: getSeasonBand(entry, month) };
  const climate = getMonthClimate(entry.countryCode, month);
  if (!climate) return insight;

  const rainfall = getRainfallLevel(climate.precipitationMm);
  if (
    !Number.isFinite(climate.avgHighC)
    || !Number.isFinite(climate.avgLowC)
    || !rainfall
  ) {
    return insight;
  }

  return {
    ...insight,
    climate: {
      avgHighC: climate.avgHighC,
      avgLowC: climate.avgLowC,
      precipitationMm: climate.precipitationMm,
      rainfall,
      season: climate.season,
    },
  };
};

const BAND_MATCH_SCORE: Record<CountrySeasonBand, number> = {
  ideal: 2,
  shoulder: 1,
  avoid: 0,
};

/**
 * Ranking weight for the "best for this month" sort. Purely curated — climate numbers are shown
 * to the user but never silently reorder the list.
 */
export const getMonthMatchScore = (entry: CountryExplorerEntry, month: number | null): number => (
  month === null ? 0 : BAND_MATCH_SCORE[getSeasonBand(entry, month)]
);

/** Distinct regions present in the corpus, alphabetically sorted. */
export const listCountryExplorerRegions = (entries: CountryExplorerEntry[]): string[] => (
  Array.from(new Set(entries.map((entry) => entry.region))).sort((left, right) => left.localeCompare(right))
);

/** Distinct tags present in the corpus, most common first then alphabetical. */
export const listCountryExplorerTags = (entries: CountryExplorerEntry[]): string[] => {
  const counts = new Map<string, number>();
  entries.forEach((entry) => entry.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));
  return Array.from(counts.entries())
    .sort((left, right) => (right[1] - left[1]) || left[0].localeCompare(right[0]))
    .map(([tag]) => tag);
};
