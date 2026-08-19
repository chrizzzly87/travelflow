import { describe, expect, it } from 'vitest';

import {
  INITIAL_COUNTRY_EXPLORER_STATE,
  applyCountryExplorerState,
  areCountryExplorerStatesEqual,
  countActiveFilters,
  countryExplorerReducer,
  hasActiveCountryExplorerState,
  matchesTripLengthBand,
  parseCountryExplorerState,
  serializeCountryExplorerState,
  type CountryExplorerState,
} from '../../services/countryExplorerFilters';
import {
  listCountryExplorerEntries,
  listCountryExplorerRegions,
  listCountryExplorerTags,
} from '../../services/countryExplorerService';

const entries = listCountryExplorerEntries();
const availableRegions = listCountryExplorerRegions(entries);
const availableTags = listCountryExplorerTags(entries);

const stateWith = (overrides: Partial<CountryExplorerState> = {}): CountryExplorerState => ({
  ...INITIAL_COUNTRY_EXPLORER_STATE,
  ...overrides,
});

describe('countryExplorerReducer', () => {
  it('toggles a facet value on and off', () => {
    const added = countryExplorerReducer(INITIAL_COUNTRY_EXPLORER_STATE, {
      type: 'toggle-facet',
      facet: 'regions',
      value: 'Europe',
    });
    expect(added.regions).toEqual(['Europe']);

    const removed = countryExplorerReducer(added, { type: 'toggle-facet', facet: 'regions', value: 'Europe' });
    expect(removed.regions).toEqual([]);
  });

  it('ignores an unknown trip length band', () => {
    const next = countryExplorerReducer(INITIAL_COUNTRY_EXPLORER_STATE, {
      type: 'toggle-facet',
      facet: 'tripLengths',
      value: 'epic',
    });
    expect(next).toBe(INITIAL_COUNTRY_EXPLORER_STATE);
  });

  it('switches to the month sort when a month is picked, and back when it is cleared', () => {
    const withMonth = countryExplorerReducer(INITIAL_COUNTRY_EXPLORER_STATE, { type: 'set-month', month: 4 });
    expect(withMonth).toMatchObject({ month: 4, sort: 'month' });

    const cleared = countryExplorerReducer(withMonth, { type: 'set-month', month: null });
    expect(cleared).toMatchObject({ month: null, sort: 'popular' });
  });

  it('keeps a manually chosen sort when the month changes', () => {
    const manual = countryExplorerReducer(stateWith({ month: 4, sort: 'month' }), { type: 'set-sort', sort: 'name' });
    const withOtherMonth = countryExplorerReducer(manual, { type: 'set-month', month: 7 });
    expect(withOtherMonth.sort).toBe('name');

    const withoutMonth = countryExplorerReducer(withOtherMonth, { type: 'set-month', month: null });
    expect(withoutMonth.sort).toBe('name');
  });

  it('rejects an out-of-range month', () => {
    expect(countryExplorerReducer(INITIAL_COUNTRY_EXPLORER_STATE, { type: 'set-month', month: 13 }).month).toBeNull();
    expect(countryExplorerReducer(INITIAL_COUNTRY_EXPLORER_STATE, { type: 'set-month', month: 0 }).month).toBeNull();
  });

  it('clears facets but keeps query and month', () => {
    const dirty = stateWith({ query: 'japan', month: 4, regions: ['Asia'], tags: ['food'], tripLengths: ['medium'] });
    const cleared = countryExplorerReducer(dirty, { type: 'clear-filters' });
    expect(cleared).toMatchObject({ query: 'japan', month: 4, regions: [], tags: [], tripLengths: [] });
  });

  it('resets everything', () => {
    const dirty = stateWith({ query: 'japan', month: 4, regions: ['Asia'] });
    expect(countryExplorerReducer(dirty, { type: 'reset' })).toEqual(INITIAL_COUNTRY_EXPLORER_STATE);
  });

  it('counts active filters without counting query or month', () => {
    const state = stateWith({ query: 'japan', month: 4, regions: ['Asia', 'Europe'], tripLengths: ['long'] });
    expect(countActiveFilters(state)).toBe(3);
    expect(hasActiveCountryExplorerState(state)).toBe(true);
    expect(hasActiveCountryExplorerState(INITIAL_COUNTRY_EXPLORER_STATE)).toBe(false);
  });
});

describe('URL state round trip', () => {
  const parse = (search: string): CountryExplorerState => parseCountryExplorerState(
    new URLSearchParams(search),
    { availableRegions, availableTags },
  );

  it('serializes nothing for the pristine state', () => {
    expect(serializeCountryExplorerState(INITIAL_COUNTRY_EXPLORER_STATE).toString()).toBe('');
  });

  it('round-trips a fully populated state', () => {
    const state = stateWith({
      query: 'coast',
      regions: ['Europe', 'Asia'],
      tags: ['food', 'islands'],
      tripLengths: ['short', 'long'],
      month: 9,
      sort: 'name',
    });
    const restored = parse(serializeCountryExplorerState(state).toString());
    expect(restored).toEqual(state);
    expect(areCountryExplorerStatesEqual(state, restored)).toBe(true);
  });

  it('round-trips the implicit month sort without writing a sort param', () => {
    const state = stateWith({ month: 3, sort: 'month' });
    const params = serializeCountryExplorerState(state);
    expect(params.get('sort')).toBeNull();
    expect(parse(params.toString())).toEqual(state);
  });

  it('drops region and tag values that are not in the corpus', () => {
    const restored = parse('region=Europe,Atlantis&style=food,teleportation');
    expect(restored.regions).toEqual(['Europe']);
    expect(restored.tags).toEqual(['food']);
  });

  it('falls back to defaults for junk input', () => {
    expect(parse('month=banana&sort=random&length=epic')).toEqual(INITIAL_COUNTRY_EXPLORER_STATE);
  });

  it('never reports the month sort without a month', () => {
    expect(parse('sort=month').sort).toBe('popular');
  });

  it('de-duplicates repeated list values', () => {
    expect(parse('region=Europe,Europe').regions).toEqual(['Europe']);
  });
});

describe('matchesTripLengthBand', () => {
  it('maps recommended days into bands', () => {
    expect(matchesTripLengthBand(8, 'short')).toBe(true);
    expect(matchesTripLengthBand(10, 'short')).toBe(false);
    expect(matchesTripLengthBand(11, 'medium')).toBe(true);
    expect(matchesTripLengthBand(13, 'medium')).toBe(false);
    expect(matchesTripLengthBand(15, 'long')).toBe(true);
  });

  it('excludes entries without a recommended length', () => {
    expect(matchesTripLengthBand(undefined, 'short')).toBe(false);
  });
});

describe('applyCountryExplorerState', () => {
  it('keeps editorial order when nothing is selected', () => {
    const result = applyCountryExplorerState(entries, INITIAL_COUNTRY_EXPLORER_STATE);
    expect(result.map((entry) => entry.name)).toEqual(entries.map((entry) => entry.name));
  });

  it('intersects different facets and unions values inside one facet', () => {
    const regionOnly = applyCountryExplorerState(entries, stateWith({ regions: ['Caribbean'] }));
    expect(regionOnly.length).toBeGreaterThan(0);
    expect(regionOnly.every((entry) => entry.region === 'Caribbean')).toBe(true);

    const twoRegions = applyCountryExplorerState(entries, stateWith({ regions: ['Caribbean', 'Oceania'] }));
    expect(twoRegions.length).toBeGreaterThan(regionOnly.length);

    const impossible = applyCountryExplorerState(entries, stateWith({ regions: ['Caribbean'], tags: ['fjords'] }));
    expect(impossible).toEqual([]);
  });

  it('combines search with facets', () => {
    const result = applyCountryExplorerState(entries, stateWith({ query: 'a', regions: ['Oceania'] }));
    expect(result.every((entry) => entry.region === 'Oceania')).toBe(true);
  });

  it('sorts alphabetically on request', () => {
    const names = applyCountryExplorerState(entries, stateWith({ sort: 'name' })).map((entry) => entry.name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
  });

  it('surfaces ideal months first under the month sort', () => {
    const state = stateWith({ month: 1, sort: 'month' });
    const result = applyCountryExplorerState(entries, state);
    const bands = result.map((entry) => entry.seasonBands[0]);
    const rank = { ideal: 0, shoulder: 1, avoid: 2 } as const;
    expect(bands.map((band) => rank[band])).toEqual([...bands.map((band) => rank[band])].sort((a, b) => a - b));
  });

  it('does not reorder while the sort stays on popular', () => {
    const popular = applyCountryExplorerState(entries, stateWith({ month: 1, sort: 'popular' }));
    expect(popular.map((entry) => entry.name)).toEqual(entries.map((entry) => entry.name));
  });
});
