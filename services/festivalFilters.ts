/**
 * Region/month filter state for the festivals index, as a pure reducer plus URL codec.
 *
 * Mirrors the countries explorer (`countryExplorerFilters.ts`): the query string is the single
 * source of truth, so the view is shareable and back/forward-safe, and the logic is unit-testable
 * without React.
 */

import type { FestivalCatalogEntry, FestivalRegionId } from './festivalCatalogService';
import { FESTIVAL_REGION_ORDER } from './festivalCatalogService';

export interface FestivalFilterState {
  /** Empty means "every region". */
  regions: FestivalRegionId[];
  /** 1-12, or `null` for "any month". */
  month: number | null;
}

export const INITIAL_FESTIVAL_FILTER_STATE: FestivalFilterState = {
  regions: [],
  month: null,
};

export type FestivalFilterAction =
  | { type: 'toggle-region'; region: FestivalRegionId }
  | { type: 'set-month'; month: number | null }
  | { type: 'clear-filters' };

export const FESTIVAL_QUERY_KEYS = {
  regions: 'region',
  month: 'month',
} as const;

const isValidMonth = (value: number): boolean => Number.isInteger(value) && value >= 1 && value <= 12;

const isRegionId = (value: string): value is FestivalRegionId => (
  (FESTIVAL_REGION_ORDER as string[]).includes(value)
);

export const festivalFilterReducer = (
  state: FestivalFilterState,
  action: FestivalFilterAction,
): FestivalFilterState => {
  switch (action.type) {
    case 'toggle-region':
      return {
        ...state,
        regions: state.regions.includes(action.region)
          ? state.regions.filter((region) => region !== action.region)
          : [...state.regions, action.region],
      };
    case 'set-month':
      return {
        ...state,
        month: action.month !== null && isValidMonth(action.month) ? action.month : null,
      };
    case 'clear-filters':
      return INITIAL_FESTIVAL_FILTER_STATE;
    default:
      return state;
  }
};

export const hasActiveFestivalFilters = (state: FestivalFilterState): boolean => (
  state.regions.length > 0 || state.month !== null
);

export const countActiveFestivalFilters = (state: FestivalFilterState): number => (
  state.regions.length + (state.month === null ? 0 : 1)
);

/**
 * Reads state out of the query string, dropping anything unknown so a hand-edited or stale URL
 * degrades to the default view rather than rendering an empty grid.
 */
export const parseFestivalFilterState = (
  params: URLSearchParams,
  availableRegions: FestivalRegionId[] = FESTIVAL_REGION_ORDER,
): FestivalFilterState => {
  const regions = (params.get(FESTIVAL_QUERY_KEYS.regions) || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is FestivalRegionId => isRegionId(value) && availableRegions.includes(value));

  const rawMonth = Number.parseInt(params.get(FESTIVAL_QUERY_KEYS.month) || '', 10);

  return {
    regions: Array.from(new Set(regions)),
    month: isValidMonth(rawMonth) ? rawMonth : null,
  };
};

/** Only non-default values are written, so the canonical URL stays clean. */
export const serializeFestivalFilterState = (state: FestivalFilterState): URLSearchParams => {
  const params = new URLSearchParams();
  if (state.regions.length > 0) params.set(FESTIVAL_QUERY_KEYS.regions, state.regions.join(','));
  if (state.month !== null) params.set(FESTIVAL_QUERY_KEYS.month, String(state.month));
  return params;
};

export const applyFestivalFilterState = <TEntry extends { entry: FestivalCatalogEntry }>(
  items: TEntry[],
  state: FestivalFilterState,
): TEntry[] => items.filter(({ entry }) => (
  (state.regions.length === 0 || state.regions.includes(entry.regionId))
  && (state.month === null || entry.event.month === state.month)
));
