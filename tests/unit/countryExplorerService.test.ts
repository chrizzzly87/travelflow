import { describe, expect, it } from 'vitest';

import {
  getCountryMonthInsight,
  getMonthMatchScore,
  getSeasonBand,
  listCountryExplorerEntries,
  listCountryExplorerRegions,
  listCountryExplorerTags,
  toCountryExplorerEntry,
} from '../../services/countryExplorerService';
import { listClimateCountryCodes } from '../../services/countryClimateService';
import type { DestinationGuideEntry } from '../../shared/destinationGuides';

const entries = listCountryExplorerEntries();
const coveredCodes = new Set(listClimateCountryCodes());

const buildGuide = (overrides: Partial<DestinationGuideEntry> = {}): DestinationGuideEntry => ({
  id: 'test-country',
  name: 'Testland',
  slug: 'testland',
  kind: 'country',
  // Deliberately a code that will never be in the climate dataset.
  countryCode: 'ZZ',
  region: 'Nowhere',
  tags: ['nature'],
  suggestedTripDays: { min: 5, max: 12, recommended: 9 },
  seasonality: { idealMonths: [5, 6], shoulderMonths: [4, 7], avoidMonths: [1] },
  airports: [],
  beaches: [],
  highlights: [],
  events: [],
  sourceLinks: [],
  sourceUpdatedAt: null,
  reviewedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('country explorer entries', () => {
  it('exposes twelve precomputed season bands per country', () => {
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry) => {
      expect(entry.seasonBands).toHaveLength(12);
      entry.seasonBands.forEach((band) => expect(['ideal', 'shoulder', 'avoid']).toContain(band));
    });
  });

  it('derives bands from the curated seasonality', () => {
    const entry = toCountryExplorerEntry(buildGuide());
    expect(getSeasonBand(entry, 5)).toBe('ideal');
    expect(getSeasonBand(entry, 4)).toBe('shoulder');
    expect(getSeasonBand(entry, 1)).toBe('avoid');
  });

  it('treats a guide with no seasonality as fully non-ideal instead of throwing', () => {
    const entry = toCountryExplorerEntry(buildGuide({ seasonality: undefined }));
    expect(entry.idealMonths).toEqual([]);
    expect(entry.seasonBands.every((band) => band === 'avoid')).toBe(true);
  });

  it('is defensive about out-of-range months', () => {
    const entry = toCountryExplorerEntry(buildGuide());
    expect(getSeasonBand(entry, 0)).toBe('avoid');
    expect(getSeasonBand(entry, 13)).toBe('avoid');
    expect(getCountryMonthInsight(entry, 13)).toBeUndefined();
    expect(getCountryMonthInsight(entry, Number.NaN)).toBeUndefined();
  });

  it('lists regions alphabetically and tags by frequency', () => {
    const regions = listCountryExplorerRegions(entries);
    expect(regions).toEqual([...regions].sort((left, right) => left.localeCompare(right)));
    expect(listCountryExplorerTags(entries).length).toBeGreaterThan(0);
  });
});

describe('getCountryMonthInsight graceful degradation', () => {
  it('omits climate entirely for a country with no climate row', () => {
    const entry = toCountryExplorerEntry(buildGuide());
    const insight = getCountryMonthInsight(entry, 5);
    expect(insight).toBeDefined();
    expect(insight?.band).toBe('ideal');
    expect(insight?.climate).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(insight, 'climate')).toBe(false);
  });

  it('never emits zero-filled climate for any uncovered country in the real corpus', () => {
    const uncovered = entries.filter((entry) => !coveredCodes.has(entry.countryCode));
    expect(uncovered.length).toBeGreaterThan(0);
    uncovered.forEach((entry) => {
      for (let month = 1; month <= 12; month += 1) {
        const insight = getCountryMonthInsight(entry, month);
        expect(insight?.climate).toBeUndefined();
        expect(insight?.band).toBeDefined();
      }
    });
  });

  it('returns full climate details for a covered country', () => {
    const covered = entries.find((entry) => coveredCodes.has(entry.countryCode));
    expect(covered).toBeDefined();
    const insight = getCountryMonthInsight(covered!, 7);
    expect(insight?.climate).toBeDefined();
    expect(['dry', 'light', 'wet', 'very-wet']).toContain(insight!.climate!.rainfall);
    expect(['high', 'shoulder', 'low']).toContain(insight!.climate!.season);
    expect(Number.isFinite(insight!.climate!.avgHighC)).toBe(true);
    expect(insight!.climate!.avgHighC).toBeGreaterThanOrEqual(insight!.climate!.avgLowC);
  });
});

describe('getMonthMatchScore', () => {
  it('ranks ideal above shoulder above avoid', () => {
    const entry = toCountryExplorerEntry(buildGuide());
    expect(getMonthMatchScore(entry, 5)).toBeGreaterThan(getMonthMatchScore(entry, 4));
    expect(getMonthMatchScore(entry, 4)).toBeGreaterThan(getMonthMatchScore(entry, 1));
  });

  it('is neutral when no month is selected', () => {
    expect(getMonthMatchScore(toCountryExplorerEntry(buildGuide()), null)).toBe(0);
  });
});
