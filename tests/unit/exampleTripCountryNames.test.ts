import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { exampleTripCards } from '../../data/exampleTripCards';
import { getExampleTripCountryDisplayName } from '../../data/exampleTripCountryNames.generated';
import { getDestinationDisplayName } from '../../services/destinationService';
import {
  EXAMPLE_TRIP_COUNTRY_CODES,
  renderExampleTripCountryNamesModule,
} from '../../scripts/generate-example-trip-country-names.mjs';

const LOCALES = ['en', 'es', 'de', 'fr', 'pt', 'ru', 'it', 'pl', 'ko', 'fa', 'ur'];

const generatedPath = path.resolve(__dirname, '../../data/exampleTripCountryNames.generated.ts');

describe('example trip country names', () => {
  it('stays in sync with countryTravelData.json', () => {
    // Regenerating must be a no-op; otherwise the checked-in table has drifted
    // from the source data and the homepage would show a stale name.
    expect(fs.readFileSync(generatedPath, 'utf8')).toBe(renderExampleTripCountryNamesModule());
  });

  it('covers every country the example cards render', () => {
    const cardCountries = new Set(
      exampleTripCards.flatMap((card) => card.countries.map((country) => country.name)),
    );
    expect(cardCountries.size).toBe(EXAMPLE_TRIP_COUNTRY_CODES.length);
    for (const name of cardCountries) {
      expect(getExampleTripCountryDisplayName(name, 'en')).toBe(name);
    }
  });

  it('returns what the full destination service would return', () => {
    // The slim table exists only to keep data/countryTravelData.json off the
    // mobile boot path — it must not change a single rendered name.
    const cardCountries = exampleTripCards.flatMap((card) => card.countries.map((c) => c.name));
    for (const name of new Set(cardCountries)) {
      for (const locale of LOCALES) {
        expect(getExampleTripCountryDisplayName(name, locale)).toBe(
          getDestinationDisplayName(name, locale),
        );
      }
    }
  });

  it('falls back to the given name for an unknown country', () => {
    expect(getExampleTripCountryDisplayName('Atlantis', 'de')).toBe('Atlantis');
  });
});
