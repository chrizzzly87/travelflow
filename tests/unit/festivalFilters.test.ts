import { describe, expect, it } from 'vitest';
import {
  INITIAL_FESTIVAL_FILTER_STATE,
  applyFestivalFilterState,
  countActiveFestivalFilters,
  festivalFilterReducer,
  hasActiveFestivalFilters,
  parseFestivalFilterState,
  serializeFestivalFilterState,
} from '../../services/festivalFilters';
import { FESTIVAL_CATALOG } from '../../services/festivalCatalogService';

const items = FESTIVAL_CATALOG.map((entry) => ({ entry }));

describe('services/festivalFilters', () => {
  describe('reducer', () => {
    it('toggles a region on and back off', () => {
      const selected = festivalFilterReducer(INITIAL_FESTIVAL_FILTER_STATE, { type: 'toggle-region', region: 'asia' });
      expect(selected.regions).toEqual(['asia']);

      const cleared = festivalFilterReducer(selected, { type: 'toggle-region', region: 'asia' });
      expect(cleared.regions).toEqual([]);
    });

    it('accumulates multiple regions', () => {
      const state = ['asia', 'europe', 'oceania'].reduce(
        (acc, region) => festivalFilterReducer(acc, { type: 'toggle-region', region: region as 'asia' }),
        INITIAL_FESTIVAL_FILTER_STATE,
      );
      expect(state.regions).toEqual(['asia', 'europe', 'oceania']);
    });

    it('rejects an out-of-range month instead of storing it', () => {
      expect(festivalFilterReducer(INITIAL_FESTIVAL_FILTER_STATE, { type: 'set-month', month: 13 }).month).toBeNull();
      expect(festivalFilterReducer(INITIAL_FESTIVAL_FILTER_STATE, { type: 'set-month', month: 0 }).month).toBeNull();
      expect(festivalFilterReducer(INITIAL_FESTIVAL_FILTER_STATE, { type: 'set-month', month: 4 }).month).toBe(4);
    });

    it('clears everything at once', () => {
      const dirty = festivalFilterReducer(
        festivalFilterReducer(INITIAL_FESTIVAL_FILTER_STATE, { type: 'toggle-region', region: 'europe' }),
        { type: 'set-month', month: 8 },
      );
      expect(hasActiveFestivalFilters(dirty)).toBe(true);
      expect(countActiveFestivalFilters(dirty)).toBe(2);

      const cleared = festivalFilterReducer(dirty, { type: 'clear-filters' });
      expect(cleared).toEqual(INITIAL_FESTIVAL_FILTER_STATE);
      expect(hasActiveFestivalFilters(cleared)).toBe(false);
    });
  });

  describe('URL codec', () => {
    it('round-trips state through the query string', () => {
      const state = { regions: ['asia' as const, 'europe' as const], month: 7 };
      expect(parseFestivalFilterState(serializeFestivalFilterState(state))).toEqual(state);
    });

    it('writes nothing for the default state so the canonical URL stays clean', () => {
      expect(serializeFestivalFilterState(INITIAL_FESTIVAL_FILTER_STATE).toString()).toBe('');
    });

    it('drops unknown regions and invalid months rather than rendering an empty grid', () => {
      const parsed = parseFestivalFilterState(new URLSearchParams('region=asia,atlantis&month=99'));
      expect(parsed).toEqual({ regions: ['asia'], month: null });
    });

    it('deduplicates repeated regions', () => {
      expect(parseFestivalFilterState(new URLSearchParams('region=asia,asia')).regions).toEqual(['asia']);
    });

    it('honours the available-region allowlist', () => {
      expect(parseFestivalFilterState(new URLSearchParams('region=asia,europe'), ['europe']).regions).toEqual(['europe']);
    });
  });

  describe('applying state', () => {
    it('returns everything when no filter is active', () => {
      expect(applyFestivalFilterState(items, INITIAL_FESTIVAL_FILTER_STATE)).toHaveLength(items.length);
    });

    it('narrows by region', () => {
      const filtered = applyFestivalFilterState(items, { regions: ['oceania'], month: null });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(({ entry }) => entry.regionId === 'oceania')).toBe(true);
    });

    it('narrows by month', () => {
      const filtered = applyFestivalFilterState(items, { regions: [], month: 4 });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(({ entry }) => entry.event.month === 4)).toBe(true);
    });

    it('combines region and month as an AND', () => {
      const filtered = applyFestivalFilterState(items, { regions: ['asia'], month: 4 });
      expect(filtered.every(({ entry }) => entry.regionId === 'asia' && entry.event.month === 4)).toBe(true);
    });
  });
});
