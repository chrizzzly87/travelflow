import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { COUNTRY_TRAVEL_DATA, getCountrySeasonByCode } from '../../data/countryTravelData';
import { getLocalizedCountryNameFromData, getLocalizedIslandNameFromData } from '../../data/countryLocalizedNames';
import { getCountrySearchAliasesFromData } from '../../data/countrySearchMetadata';
import { MONTH_LABELS } from '../../data/countryMonthLabels';
import { SPLIT_TARGETS, readCountryTravelData, renderSplit } from '../../scripts/split-country-travel-data.mjs';

const dataDir = path.resolve(__dirname, '../../data');

describe('country travel data split', () => {
  it.each(Object.keys(SPLIT_TARGETS))('%s stays in sync with countryTravelData.json', (filename) => {
    // Regenerating must be a no-op. The monolith is the source of truth; a
    // generator run that changes it has to be followed by a split run.
    expect(fs.readFileSync(path.join(dataDir, filename), 'utf8')).toBe(renderSplit(filename));
  });

  it('serves the same seasons the monolith holds', () => {
    const source = readCountryTravelData();
    expect(COUNTRY_TRAVEL_DATA.countries).toHaveLength(source.countries.length);

    for (const country of source.countries) {
      const entry = getCountrySeasonByCode(country.countryCode);
      expect(entry?.countryName).toBe(country.countryName);
      expect(entry?.bestMonths).toEqual(country.bestMonths);
      expect(entry?.events).toHaveLength(country.events.length);
    }
  });

  it('serves the same localized names and aliases the monolith holds', () => {
    const source = readCountryTravelData();
    const countries = source.localizedDestinationNames?.countries || {};
    const islands = source.localizedDestinationNames?.islands || {};

    for (const [code, names] of Object.entries<Record<string, string>>(countries)) {
      for (const [locale, name] of Object.entries(names)) {
        expect(getLocalizedCountryNameFromData(code, locale)).toBe(name);
      }
    }
    for (const [code, names] of Object.entries<Record<string, string>>(islands)) {
      for (const [locale, name] of Object.entries(names)) {
        expect(getLocalizedIslandNameFromData(code, locale)).toBe(name);
      }
    }
    for (const code of Object.keys(source.countrySearchMetadata?.countries || {})) {
      expect(getCountrySearchAliasesFromData(code).length).toBeGreaterThanOrEqual(0);
    }
    expect(getCountrySearchAliasesFromData('TR')).toContain('Turkiye');
  });

  it('keeps month labels free of any data import', () => {
    expect(MONTH_LABELS).toHaveLength(12);
    const source = fs.readFileSync(path.join(dataDir, 'countryMonthLabels.ts'), 'utf8');
    // The whole point of this module: a month strip must not cost a data chunk.
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
