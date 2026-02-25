import { describe, expect, it } from 'vitest';
import {
  COUNTRY_TRAVEL_DATA,
  MONTH_LABELS,
  buildMonthScoreMap,
  getCommonBestMonths,
  getCountrySeasonByCode,
  getCountrySeasonByName,
  getDurationRecommendation,
  getLocalizedCountryNameFromData,
  getLocalizedIslandNameFromData,
  monthRangeBetweenDates,
  rankCountriesForMonths,
} from '../../data/countryTravelData';

describe('data/countryTravelData', () => {
  it('loads country dataset and month labels', () => {
    expect(COUNTRY_TRAVEL_DATA.countries.length).toBeGreaterThan(100);
    expect(MONTH_LABELS).toHaveLength(12);
  });

  it('resolves countries by name and code', () => {
    const germanyByName = getCountrySeasonByName('Germany');
    const germanyByCode = getCountrySeasonByCode('DE');

    expect(germanyByName?.countryCode).toBe('DE');
    expect(germanyByCode?.countryName).toBe('Germany');
  });

  it('calculates month score maps and ideal/shoulder months', () => {
    const scores = buildMonthScoreMap(['Germany', 'Spain']);
    expect(Object.keys(scores).length).toBeGreaterThan(0);

    const common = getCommonBestMonths(['Germany', 'Spain']);
    expect(common.ideal.every((month) => month >= 1 && month <= 12)).toBe(true);
    expect(common.shoulder.every((month) => month >= 1 && month <= 12)).toBe(true);
    expect(getCommonBestMonths([])).toEqual({ ideal: [], shoulder: [] });
  });

  it('builds month ranges between dates with invalid-date handling', () => {
    expect(monthRangeBetweenDates('2026-01-15', '2026-03-02')).toEqual([1, 2, 3]);
    expect(monthRangeBetweenDates('invalid', '2026-03-02')).toEqual([]);
  });

  it('ranks countries and computes duration recommendations', () => {
    const ranked = rankCountriesForMonths([6, 7, 8]);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThan(0);
    expect(rankCountriesForMonths([])).toEqual([]);

    const rec = getDurationRecommendation(['Germany', 'Spain'], ['slow-travel']);
    expect(rec.min).toBeGreaterThanOrEqual(3);
    expect(rec.max).toBeGreaterThan(rec.min);
    expect(rec.recommended).toBeGreaterThanOrEqual(rec.min);
    expect(rec.recommended).toBeLessThanOrEqual(rec.max);

    expect(getDurationRecommendation([], [])).toEqual({ min: 5, max: 14, recommended: 9 });
    expect(getDurationRecommendation(['Unknown'], [])).toEqual({ min: 5, max: 14, recommended: 9 });
  });

  it('returns localized destination names with locale normalization', () => {
    const de = getLocalizedCountryNameFromData('DE', 'de-DE');
    expect(de).toBeTruthy();

    const island = getLocalizedIslandNameFromData('ID-BA', 'de');
    expect(island).toBeTruthy();

    expect(getLocalizedCountryNameFromData('UNKNOWN', 'en')).toBeUndefined();
  });
});
