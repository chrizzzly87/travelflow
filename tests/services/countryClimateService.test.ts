import { beforeEach, describe, expect, it } from 'vitest';

import countryClimateNormals from '../../data/countryClimateNormals.json';
import countryTravelData from '../../data/countryTravelData.json';
import destinationGuides from '../../data/destinationGuides.json';
import {
  RAINFALL_THRESHOLDS_MM,
  celsiusToFahrenheit,
  getClimateSeasonDerivation,
  getClimateSourceMeta,
  getCountryClimate,
  getCountryClimateMonth,
  getCountryClimateMonths,
  getCountryClimateRegions,
  getCountrySeason,
  getMonthClimate,
  getMonthRainfallLevel,
  getRainfallLevel,
  hasMultipleClimateAnchors,
  listClimateCountryCodes,
  resetCountryClimateCacheForTests,
} from '../../services/countryClimateService';
import type { CountryClimateDocument } from '../../shared/countryClimateNormals';

const document = countryClimateNormals as unknown as CountryClimateDocument;
const anyCountryCode = document.countries[0].countryCode;

describe('services/countryClimateService', () => {
  beforeEach(() => {
    resetCountryClimateCacheForTests();
  });

  describe('getCountryClimate', () => {
    it('returns the full record for a known country', () => {
      const record = getCountryClimate(anyCountryCode);
      expect(record?.countryCode).toBe(anyCountryCode);
      expect(record?.months).toHaveLength(12);
      expect(record?.anchor.id).toBeTruthy();
    });

    it('normalizes casing and surrounding whitespace', () => {
      expect(getCountryClimate(` ${anyCountryCode.toLowerCase()} `)?.countryCode).toBe(anyCountryCode);
    });

    it('returns undefined for unknown, malformed, and nullish country codes without throwing', () => {
      expect(getCountryClimate('ZZ')).toBeUndefined();
      expect(getCountryClimate('THAILAND')).toBeUndefined();
      expect(getCountryClimate('')).toBeUndefined();
      expect(getCountryClimate(null)).toBeUndefined();
      expect(getCountryClimate(undefined)).toBeUndefined();
      expect(getCountryClimate(42 as unknown as string)).toBeUndefined();
    });
  });

  describe('getMonthClimate', () => {
    it('returns the compact summary for every calendar month', () => {
      for (let month = 1; month <= 12; month += 1) {
        const summary = getMonthClimate(anyCountryCode, month);
        expect(summary).toBeDefined();
        expect(Object.keys(summary as object).sort()).toEqual([
          'avgHighC',
          'avgLowC',
          'precipitationMm',
          'season',
        ]);
        expect(summary?.avgHighC).toBeGreaterThanOrEqual(summary?.avgLowC as number);
        expect(summary?.precipitationMm).toBeGreaterThanOrEqual(0);
        expect(['high', 'shoulder', 'low']).toContain(summary?.season);
      }
    });

    it('rejects out-of-range and non-integer months', () => {
      expect(getMonthClimate(anyCountryCode, 0)).toBeUndefined();
      expect(getMonthClimate(anyCountryCode, 13)).toBeUndefined();
      expect(getMonthClimate(anyCountryCode, -1)).toBeUndefined();
      expect(getMonthClimate(anyCountryCode, 6.5)).toBeUndefined();
      expect(getMonthClimate(anyCountryCode, Number.NaN)).toBeUndefined();
      expect(getMonthClimate(anyCountryCode, '6' as unknown as number)).toBeUndefined();
    });

    it('returns undefined for a missing country instead of throwing', () => {
      expect(getMonthClimate('ZZ', 6)).toBeUndefined();
      expect(getMonthClimate(null, 6)).toBeUndefined();
    });
  });

  describe('month collections and season lookups', () => {
    it('returns 12 months in calendar order', () => {
      const months = getCountryClimateMonths(anyCountryCode);
      expect(months.map((entry) => entry.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('returns an empty array for an unknown country', () => {
      expect(getCountryClimateMonths('ZZ')).toEqual([]);
    });

    it('exposes rainyDays and avgTempC on the raw month entry', () => {
      const entry = getCountryClimateMonth(anyCountryCode, 1);
      expect(typeof entry?.avgTempC).toBe('number');
      expect(typeof entry?.rainyDays).toBe('number');
    });

    it('matches the season on the compact summary', () => {
      expect(getCountrySeason(anyCountryCode, 3)).toBe(getMonthClimate(anyCountryCode, 3)?.season);
      expect(getCountrySeason('ZZ', 3)).toBeUndefined();
    });
  });

  describe('regions', () => {
    it('returns an empty array for single-anchor countries and populated regions otherwise', () => {
      const multiAnchor = document.countries.find((country) => (country.anchorCount || 1) > 1);
      const singleAnchor = document.countries.find((country) => (country.anchorCount || 1) === 1);

      expect(getCountryClimateRegions('ZZ')).toEqual([]);

      if (singleAnchor) {
        expect(getCountryClimateRegions(singleAnchor.countryCode)).toEqual([]);
        expect(hasMultipleClimateAnchors(singleAnchor.countryCode)).toBe(false);
      }

      if (multiAnchor) {
        const regions = getCountryClimateRegions(multiAnchor.countryCode);
        expect(regions.length).toBeGreaterThan(1);
        regions.forEach((region) => {
          expect(region.months).toHaveLength(12);
          expect(region.anchor.id).toBeTruthy();
        });
        expect(hasMultipleClimateAnchors(multiAnchor.countryCode)).toBe(true);
        // regions[0] mirrors the country-level anchor.
        expect(regions[0].anchor.id).toBe(multiAnchor.anchor.id);
      }
    });

    it('reports false for unknown countries', () => {
      expect(hasMultipleClimateAnchors('ZZ')).toBe(false);
    });
  });

  describe('getRainfallLevel', () => {
    it('buckets at the documented thresholds', () => {
      expect(getRainfallLevel(0)).toBe('dry');
      expect(getRainfallLevel(RAINFALL_THRESHOLDS_MM.light - 0.1)).toBe('dry');
      expect(getRainfallLevel(RAINFALL_THRESHOLDS_MM.light)).toBe('light');
      expect(getRainfallLevel(RAINFALL_THRESHOLDS_MM.wet - 0.1)).toBe('light');
      expect(getRainfallLevel(RAINFALL_THRESHOLDS_MM.wet)).toBe('wet');
      expect(getRainfallLevel(RAINFALL_THRESHOLDS_MM.veryWet - 0.1)).toBe('wet');
      expect(getRainfallLevel(RAINFALL_THRESHOLDS_MM.veryWet)).toBe('very-wet');
      expect(getRainfallLevel(900)).toBe('very-wet');
    });

    it('returns undefined for invalid input rather than guessing', () => {
      expect(getRainfallLevel(-1)).toBeUndefined();
      expect(getRainfallLevel(Number.NaN)).toBeUndefined();
      expect(getRainfallLevel(null)).toBeUndefined();
      expect(getRainfallLevel(undefined)).toBeUndefined();
      expect(getRainfallLevel('50' as unknown as number)).toBeUndefined();
    });

    it('resolves the bucket by country and month', () => {
      const precipitation = getMonthClimate(anyCountryCode, 7)?.precipitationMm as number;
      expect(getMonthRainfallLevel(anyCountryCode, 7)).toBe(getRainfallLevel(precipitation));
      expect(getMonthRainfallLevel('ZZ', 7)).toBeUndefined();
      expect(getMonthRainfallLevel(anyCountryCode, 99)).toBeUndefined();
    });
  });

  describe('metadata helpers', () => {
    it('converts celsius to fahrenheit at render time', () => {
      expect(celsiusToFahrenheit(0)).toBe(32);
      expect(celsiusToFahrenheit(100)).toBe(212);
      expect(celsiusToFahrenheit(-40)).toBe(-40);
      expect(celsiusToFahrenheit(21.5)).toBe(70.7);
    });

    it('lists every covered country code sorted', () => {
      const codes = listClimateCountryCodes();
      expect(codes.length).toBe(document.countries.length);
      expect(codes).toEqual(codes.slice().sort());
      expect(codes).toContain(anyCountryCode);
    });

    it('exposes attribution and the curated-season disclaimer', () => {
      expect(getClimateSourceMeta().provider).toBe('Open-Meteo');
      expect(getClimateSourceMeta().attribution).toContain('Open-Meteo');
      expect(getClimateSeasonDerivation().signal).toBe('curated');
      expect(getClimateSeasonDerivation().rule).toBeTruthy();
      expect(getClimateSeasonDerivation().disclaimer).toBeTruthy();
    });
  });

  describe('dataset coverage', () => {
    it('serves complete 12-month data for every destination-guide country it covers', () => {
      const guideCountryCodes = (destinationGuides as { guides: Array<{ kind: string; countryCode?: string }> })
        .guides.filter((guide) => guide.kind === 'country' && guide.countryCode)
        .map((guide) => guide.countryCode as string);
      const covered = new Set(listClimateCountryCodes());
      const servable = guideCountryCodes.filter((code) => covered.has(code));

      expect(servable.length).toBeGreaterThan(0);
      servable.forEach((code) => {
        expect(getCountryClimateMonths(code).map((entry) => entry.month)).toEqual([
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
        ]);
      });
    });

    it('returns undefined rather than throwing for guide countries still awaiting backfill', () => {
      const guideCountryCodes = (destinationGuides as { guides: Array<{ kind: string; countryCode?: string }> })
        .guides.filter((guide) => guide.kind === 'country' && guide.countryCode)
        .map((guide) => guide.countryCode as string);
      const covered = new Set(listClimateCountryCodes());

      guideCountryCodes
        .filter((code) => !covered.has(code))
        .forEach((code) => {
          expect(getCountryClimate(code)).toBeUndefined();
          expect(getMonthClimate(code, 6)).toBeUndefined();
          expect(getCountryClimateMonths(code)).toEqual([]);
        });
    });

    it('only references country codes that exist in countryTravelData', () => {
      const known = new Set(
        (countryTravelData as { countries: Array<{ countryCode: string }> }).countries.map(
          (country) => country.countryCode,
        ),
      );
      expect(listClimateCountryCodes().filter((code) => !known.has(code))).toEqual([]);
    });
  });
});
