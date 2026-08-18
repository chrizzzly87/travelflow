import { describe, expect, it } from 'vitest';

import countryClimateNormals from '../../data/countryClimateNormals.json';
import countryTravelData from '../../data/countryTravelData.json';
import destinationGuides from '../../data/destinationGuides.json';
import {
  CLIMATE_BOUNDS,
  COUNTRY_CLIMATE_SCHEMA_VERSION,
  type CountryClimateDocument,
  deriveClimateSeason,
  validateCountryClimateDocument,
} from '../../shared/countryClimateNormals';

const committedDocument = countryClimateNormals as unknown as CountryClimateDocument;

const knownCountryCodes = new Set(
  (countryTravelData as { countries: Array<{ countryCode: string }> }).countries.map(
    (country) => country.countryCode,
  ),
);

const requiredCountryCodes = new Set(
  (destinationGuides as { guides: Array<{ kind: string; countryCode?: string }> }).guides
    .filter((guide) => guide.kind === 'country' && guide.countryCode)
    .map((guide) => guide.countryCode as string),
);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const buildMinimalDocument = (): CountryClimateDocument => ({
  schemaVersion: COUNTRY_CLIMATE_SCHEMA_VERSION,
  generatedAt: '2026-08-18T10:00:00.000Z',
  units: { temperature: 'celsius', precipitation: 'millimeters', note: 'Celsius/mm only.' },
  source: {
    provider: 'Open-Meteo',
    endpoint: 'https://archive-api.open-meteo.com/v1/archive',
    dataset: 'ERA5',
    window: { startDate: '2015-01-01', endDate: '2024-12-31', years: 10 },
    accessedAt: '2026-08-18T10:00:00.000Z',
    license: 'CC BY 4.0',
    attribution: 'Weather data by Open-Meteo.com',
  },
  seasonDerivation: { signal: 'curated', rule: 'rule', disclaimer: 'not measured' },
  anchors: [
    {
      id: 'TH-BKK',
      countryCode: 'TH',
      role: 'primary',
      label: 'Bangkok (BKK)',
      latitude: 13.68,
      longitude: 100.75,
      derivation: 'curated-region',
    },
  ],
  countries: [
    {
      countryCode: 'TH',
      countryName: 'Thailand',
      anchor: { id: 'TH-BKK', label: 'Bangkok (BKK)', latitude: 13.68, longitude: 100.75 },
      anchorCount: 1,
      months: Array.from({ length: 12 }, (_unused, index) => ({
        month: index + 1,
        avgHighC: 32,
        avgLowC: 24,
        avgTempC: 28,
        precipitationMm: 100,
        rainyDays: 10,
        season: 'high' as const,
      })),
    },
  ],
});

describe('shared/countryClimateNormals validation', () => {
  it('accepts a well-formed document', () => {
    expect(validateCountryClimateDocument(buildMinimalDocument())).toEqual([]);
  });

  it('rejects a non-object document', () => {
    expect(validateCountryClimateDocument(null)).toEqual(['Document must be an object']);
    expect(validateCountryClimateDocument(undefined)).toEqual(['Document must be an object']);
  });

  it('flags a wrong schema version', () => {
    const document = buildMinimalDocument();
    document.schemaVersion = 99;
    expect(validateCountryClimateDocument(document).join('\n')).toContain('schemaVersion must be');
  });

  it('flags a country with fewer than 12 months', () => {
    const document = buildMinimalDocument();
    document.countries[0].months = document.countries[0].months.slice(0, 11);
    const errors = validateCountryClimateDocument(document).join('\n');
    expect(errors).toContain('expected 12 months, received 11');
    expect(errors).toContain('missing months 12');
  });

  it('flags duplicated months', () => {
    const document = buildMinimalDocument();
    document.countries[0].months[1].month = 1;
    expect(validateCountryClimateDocument(document).join('\n')).toContain('duplicate month 1');
  });

  it('flags avgHighC below avgLowC', () => {
    const document = buildMinimalDocument();
    document.countries[0].months[5].avgHighC = 5;
    document.countries[0].months[5].avgLowC = 15;
    expect(validateCountryClimateDocument(document).join('\n')).toContain('must be >= avgLowC');
  });

  it('flags temperatures outside plausible bounds', () => {
    const document = buildMinimalDocument();
    document.countries[0].months[0].avgHighC = CLIMATE_BOUNDS.maxTempC + 10;
    expect(validateCountryClimateDocument(document).join('\n')).toContain('outside plausible bounds');
  });

  it('flags negative precipitation', () => {
    const document = buildMinimalDocument();
    document.countries[0].months[0].precipitationMm = -5;
    expect(validateCountryClimateDocument(document).join('\n')).toContain('precipitationMm');
  });

  it('flags an unknown season value', () => {
    const document = buildMinimalDocument();
    (document.countries[0].months[0] as { season: string }).season = 'peak';
    expect(validateCountryClimateDocument(document).join('\n')).toContain('season: must be one of');
  });

  it('flags a country code that does not resolve to a known country', () => {
    const document = buildMinimalDocument();
    document.countries[0].countryCode = 'ZZ';
    document.anchors[0].countryCode = 'ZZ';
    const errors = validateCountryClimateDocument(document, { knownCountryCodes }).join('\n');
    expect(errors).toContain('does not resolve to a known country');
  });

  it('flags a duplicated country record', () => {
    const document = buildMinimalDocument();
    document.countries.push(clone(document.countries[0]));
    expect(validateCountryClimateDocument(document).join('\n')).toContain('countryCode duplicate');
  });

  it('flags an anchor reference that is not in the anchors array', () => {
    const document = buildMinimalDocument();
    document.countries[0].anchor.id = 'TH-NOPE';
    expect(validateCountryClimateDocument(document).join('\n')).toContain(
      'anchor.id must reference an entry in anchors',
    );
  });

  it('flags an out-of-range anchor coordinate', () => {
    const document = buildMinimalDocument();
    document.anchors[0].latitude = 120;
    expect(validateCountryClimateDocument(document).join('\n')).toContain('latitude must be within');
  });

  it('validates region months as strictly as country months', () => {
    const document = buildMinimalDocument();
    document.countries[0].regions = [
      {
        key: 'bkk',
        label: 'Bangkok',
        anchor: document.countries[0].anchor,
        months: document.countries[0].months.slice(0, 3),
      },
    ];
    expect(validateCountryClimateDocument(document).join('\n')).toContain('regions[0]: expected 12 months');
  });

  it('reports missing required country coverage', () => {
    const document = buildMinimalDocument();
    const errors = validateCountryClimateDocument(document, {
      requiredCountryCodes: ['TH', 'JP', 'IT'],
    }).join('\n');
    expect(errors).toContain('Missing required country coverage: IT, JP');
  });

  it('passes for the committed dataset', () => {
    expect(
      validateCountryClimateDocument(committedDocument, { knownCountryCodes, requiredCountryCodes }),
    ).toEqual([]);
  });
});

describe('deriveClimateSeason', () => {
  it('maps curated best months to high season', () => {
    expect(deriveClimateSeason({ bestMonths: [4] }, 4)).toBe('high');
  });

  it('maps curated avoid months to low season', () => {
    expect(deriveClimateSeason({ avoidMonths: [7] }, 7)).toBe('low');
  });

  it('maps shoulder and unlisted months to shoulder season', () => {
    expect(deriveClimateSeason({ shoulderMonths: [5] }, 5)).toBe('shoulder');
    expect(deriveClimateSeason({}, 5)).toBe('shoulder');
  });

  it('promotes a shoulder month to high when events and holidays stack up', () => {
    expect(
      deriveClimateSeason(
        { shoulderMonths: [12], events: [{ month: 12 }, { month: 12 }], publicHolidays: [{ month: 12 }] },
        12,
      ),
    ).toBe('high');
  });

  it('never promotes an avoid month above shoulder', () => {
    expect(
      deriveClimateSeason(
        {
          avoidMonths: [8],
          events: [{ month: 8 }, { month: 8 }, { month: 8 }],
          publicHolidays: [{ month: 8 }, { month: 8 }],
        },
        8,
      ),
    ).toBe('shoulder');
  });

  it('keeps an avoid month low when the boost is only partial', () => {
    expect(deriveClimateSeason({ avoidMonths: [8], events: [{ month: 8 }] }, 8)).toBe('low');
  });

  it('ignores events and holidays in other months', () => {
    expect(deriveClimateSeason({ avoidMonths: [8], events: [{ month: 3 }] }, 8)).toBe('low');
  });

  it('reproduces the committed season values for every country and month', () => {
    const travelByCode = new Map(
      (
        countryTravelData as {
          countries: Array<{
            countryCode: string;
            bestMonths?: number[];
            shoulderMonths?: number[];
            avoidMonths?: number[];
            events?: Array<{ month: number }>;
            publicHolidays?: Array<{ month: number }>;
          }>;
        }
      ).countries.map((country) => [country.countryCode, country]),
    );

    committedDocument.countries.forEach((country) => {
      const curated = travelByCode.get(country.countryCode);
      expect(curated, `missing curated data for ${country.countryCode}`).toBeDefined();
      country.months.forEach((month) => {
        expect(deriveClimateSeason(curated as object, month.month)).toBe(month.season);
      });
    });
  });
});
