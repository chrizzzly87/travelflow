/**
 * Filter/search/month state for the countries explorer, as a pure reducer plus URL codec.
 *
 * All of the explorer's user state lives in one object so that:
 *  - the whole view is shareable and back/forward-safe via the query string;
 *  - the logic is unit-testable without React;
 *  - a future interactive map or distance sort can drive the same state by dispatching actions
 *    (for example a `toggle-facet` on `regions`) instead of owning a parallel copy.
 */

import type { CountryExplorerEntry } from './countryExplorerService';
import { getMonthMatchScore } from './countryExplorerService';
import { searchCountryCandidates } from './countryExplorerSearch';

export type TripLengthBand = 'short' | 'medium' | 'long';
export type CountryExplorerFacet = 'regions' | 'tags' | 'tripLengths';
export type CountryExplorerSort = 'popular' | 'month' | 'name';

export const TRIP_LENGTH_BANDS: Record<TripLengthBand, { minDays?: number; maxDays?: number }> = {
  short: { maxDays: 9 },
  medium: { minDays: 10, maxDays: 12 },
  long: { minDays: 13 },
};

export const TRIP_LENGTH_BAND_ORDER: TripLengthBand[] = ['short', 'medium', 'long'];
export const COUNTRY_EXPLORER_SORTS: CountryExplorerSort[] = ['popular', 'month', 'name'];

export interface CountryExplorerState {
  query: string;
  regions: string[];
  tags: string[];
  tripLengths: TripLengthBand[];
  /** 1-12, or `null` for "any month". */
  month: number | null;
  sort: CountryExplorerSort;
}

export const INITIAL_COUNTRY_EXPLORER_STATE: CountryExplorerState = {
  query: '',
  regions: [],
  tags: [],
  tripLengths: [],
  month: null,
  sort: 'popular',
};

export type CountryExplorerAction =
  | { type: 'set-query'; query: string }
  | { type: 'toggle-facet'; facet: CountryExplorerFacet; value: string }
  | { type: 'set-month'; month: number | null }
  | { type: 'set-sort'; sort: CountryExplorerSort }
  | { type: 'clear-filters' }
  | { type: 'reset' }
  | { type: 'hydrate'; state: CountryExplorerState };

const isValidMonth = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 12
);

const toggleValue = <TValue extends string>(values: TValue[], value: TValue): TValue[] => (
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]
);

/**
 * Selecting a month opts the user into the "best for this month" ordering, and clearing it opts
 * back out. The change is never silent: the sort control renders the active sort and the user can
 * override it at any time — a manual override is preserved because we only auto-switch from the
 * paired default.
 */
export const countryExplorerReducer = (
  state: CountryExplorerState,
  action: CountryExplorerAction,
): CountryExplorerState => {
  switch (action.type) {
    case 'set-query':
      return state.query === action.query ? state : { ...state, query: action.query };
    case 'toggle-facet': {
      if (action.facet === 'tripLengths') {
        if (!TRIP_LENGTH_BAND_ORDER.includes(action.value as TripLengthBand)) return state;
        return { ...state, tripLengths: toggleValue(state.tripLengths, action.value as TripLengthBand) };
      }
      return { ...state, [action.facet]: toggleValue(state[action.facet], action.value) };
    }
    case 'set-month': {
      const month = isValidMonth(action.month) ? action.month : null;
      if (month === state.month) return state;
      if (month === null) {
        return { ...state, month, sort: state.sort === 'month' ? 'popular' : state.sort };
      }
      return { ...state, month, sort: state.sort === 'popular' ? 'month' : state.sort };
    }
    case 'set-sort':
      return COUNTRY_EXPLORER_SORTS.includes(action.sort) ? { ...state, sort: action.sort } : state;
    case 'clear-filters':
      return { ...state, regions: [], tags: [], tripLengths: [] };
    case 'reset':
      return INITIAL_COUNTRY_EXPLORER_STATE;
    case 'hydrate':
      return action.state;
    default:
      return state;
  }
};

/** Number of active facet selections — drives the "clear filters" affordance and its badge. */
export const countActiveFilters = (state: CountryExplorerState): number => (
  state.regions.length + state.tags.length + state.tripLengths.length
);

export const hasActiveCountryExplorerState = (state: CountryExplorerState): boolean => (
  countActiveFilters(state) > 0 || state.query.trim().length > 0 || state.month !== null
);

export const matchesTripLengthBand = (
  recommendedDays: number | undefined,
  band: TripLengthBand,
): boolean => {
  if (typeof recommendedDays !== 'number' || !Number.isFinite(recommendedDays)) return false;
  const { minDays, maxDays } = TRIP_LENGTH_BANDS[band];
  if (typeof minDays === 'number' && recommendedDays < minDays) return false;
  if (typeof maxDays === 'number' && recommendedDays > maxDays) return false;
  return true;
};

const compareBySort = (
  sort: CountryExplorerSort,
  month: number | null,
) => (left: CountryExplorerEntry, right: CountryExplorerEntry): number => {
  if (sort === 'name') return left.name.localeCompare(right.name);
  if (sort === 'month') {
    const delta = getMonthMatchScore(right, month) - getMonthMatchScore(left, month);
    if (delta !== 0) return delta;
  }
  return 0;
};

/**
 * Search → facet filter → sort. Input order is the editorial popularity order, and both the
 * search ranking and the sort comparators are stable, so `popular` never needs an explicit key.
 */
export const applyCountryExplorerState = (
  entries: CountryExplorerEntry[],
  state: CountryExplorerState,
): CountryExplorerEntry[] => {
  const searched = searchCountryCandidates(
    entries.map((entry) => ({ item: entry, tokens: entry.searchTokens })),
    state.query,
  ).map((result) => result.item);

  const filtered = searched.filter((entry) => {
    if (state.regions.length > 0 && !state.regions.includes(entry.region)) return false;
    if (state.tags.length > 0 && !state.tags.some((tag) => entry.tags.includes(tag))) return false;
    if (
      state.tripLengths.length > 0
      && !state.tripLengths.some((band) => matchesTripLengthBand(entry.recommendedDays, band))
    ) return false;
    return true;
  });

  if (state.sort === 'popular') return filtered;
  return filtered.slice().sort(compareBySort(state.sort, state.month));
};

// --- URL codec -------------------------------------------------------------------------------

export const COUNTRY_EXPLORER_QUERY_KEYS = {
  query: 'q',
  regions: 'region',
  tags: 'style',
  tripLengths: 'length',
  month: 'month',
  sort: 'sort',
} as const;

const parseList = (raw: string | null, allowed?: string[]): string[] => {
  if (!raw) return [];
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  const unique = Array.from(new Set(values));
  return allowed ? unique.filter((value) => allowed.includes(value)) : unique;
};

export interface CountryExplorerParseOptions {
  /** Restricts region/tag values to what the corpus actually offers, so stale links stay sane. */
  availableRegions?: string[];
  availableTags?: string[];
}

export const parseCountryExplorerState = (
  params: URLSearchParams,
  options: CountryExplorerParseOptions = {},
): CountryExplorerState => {
  const rawMonth = Number.parseInt(params.get(COUNTRY_EXPLORER_QUERY_KEYS.month) || '', 10);
  const month = isValidMonth(rawMonth) ? rawMonth : null;
  const rawSort = params.get(COUNTRY_EXPLORER_QUERY_KEYS.sort) as CountryExplorerSort | null;
  const sort = rawSort && COUNTRY_EXPLORER_SORTS.includes(rawSort)
    ? rawSort
    : (month === null ? 'popular' : 'month');

  return {
    query: (params.get(COUNTRY_EXPLORER_QUERY_KEYS.query) || '').trim(),
    regions: parseList(params.get(COUNTRY_EXPLORER_QUERY_KEYS.regions), options.availableRegions),
    tags: parseList(params.get(COUNTRY_EXPLORER_QUERY_KEYS.tags), options.availableTags),
    tripLengths: parseList(
      params.get(COUNTRY_EXPLORER_QUERY_KEYS.tripLengths),
      TRIP_LENGTH_BAND_ORDER,
    ) as TripLengthBand[],
    month,
    sort: month === null && sort === 'month' ? 'popular' : sort,
  };
};

/** Serializes only non-default values, so the pristine view keeps a clean URL. */
export const serializeCountryExplorerState = (state: CountryExplorerState): URLSearchParams => {
  const params = new URLSearchParams();
  const query = state.query.trim();
  if (query) params.set(COUNTRY_EXPLORER_QUERY_KEYS.query, query);
  if (state.regions.length > 0) params.set(COUNTRY_EXPLORER_QUERY_KEYS.regions, state.regions.join(','));
  if (state.tags.length > 0) params.set(COUNTRY_EXPLORER_QUERY_KEYS.tags, state.tags.join(','));
  if (state.tripLengths.length > 0) {
    params.set(COUNTRY_EXPLORER_QUERY_KEYS.tripLengths, state.tripLengths.join(','));
  }
  if (state.month !== null) params.set(COUNTRY_EXPLORER_QUERY_KEYS.month, String(state.month));

  const defaultSort: CountryExplorerSort = state.month === null ? 'popular' : 'month';
  if (state.sort !== defaultSort) params.set(COUNTRY_EXPLORER_QUERY_KEYS.sort, state.sort);

  return params;
};

export const areCountryExplorerStatesEqual = (
  left: CountryExplorerState,
  right: CountryExplorerState,
): boolean => serializeCountryExplorerState(left).toString() === serializeCountryExplorerState(right).toString();
