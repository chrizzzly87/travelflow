import { describe, expect, it, vi } from 'vitest';
import { __benchmarkValidationInternals } from '../../netlify/edge-functions/ai-benchmark.ts';

const VALID_CITY_DESCRIPTION = [
  'Compact benchmark itinerary notes.',
  '',
  '### Must See',
  '- [ ] City landmark',
  '- [ ] Historic temple',
  '',
  '### Must Try',
  '- [ ] Local noodle soup',
  '- [ ] Fresh market snacks',
  '',
  '### Must Do',
  '- [ ] Night market walk',
  '- [ ] Riverside boat ride',
].join('\n');

const buildValidModelData = () => ({
  tripTitle: 'Southeast Asia Loop',
  countryInfo: {
    currency: 'THB',
    exchangeRate: 38,
    languages: ['Thai', 'English'],
    sockets: 'Type A, C',
    visaLink: 'https://example.com/visa',
    auswaertigesAmtLink: 'https://example.com/amt',
  },
  cities: [
    {
      name: 'Bangkok',
      days: 3,
      description: VALID_CITY_DESCRIPTION,
      lat: 13.7563,
      lng: 100.5018,
    },
    {
      name: 'Bangkok',
      days: 1,
      description: VALID_CITY_DESCRIPTION,
      lat: 13.7563,
      lng: 100.5018,
    },
  ],
  travelSegments: [
    {
      fromCityIndex: 0,
      toCityIndex: 1,
      transportMode: 'bus',
      description: 'Overnight bus',
      duration: 10,
    },
  ],
  activities: [
    {
      title: 'Street food walk',
      cityIndex: 0,
      dayOffsetInCity: 0,
      duration: 0.5,
      description: 'Explore evening street food vendors.',
      activityTypes: ['food'],
    },
  ],
});

describe('ai-benchmark countryInfo normalization internals', () => {
  it('collects direct, array, and map-based countryInfo entries', () => {
    const direct = __benchmarkValidationInternals.collectCountryInfoEntries({
      currency: 'THB',
      languages: ['Thai'],
    });
    expect(direct).toHaveLength(1);

    const fromArray = __benchmarkValidationInternals.collectCountryInfoEntries([
      { currency: 'THB', languages: ['Thai'] },
      { currency: 'VND', languages: ['Vietnamese'] },
    ]);
    expect(fromArray).toHaveLength(2);

    const fromMap = __benchmarkValidationInternals.collectCountryInfoEntries({
      TH: { currency: 'THB', languages: ['Thai'] },
      VN: { currency: 'VND', languages: ['Vietnamese'] },
    });
    expect(fromMap).toHaveLength(2);
  });

  it('normalizes languages from arrays and comma-delimited strings', () => {
    const languages = __benchmarkValidationInternals.collectCountryInfoLanguages([
      { languages: ['Thai', 'English'] },
      { languages: 'Vietnamese, English | Khmer' },
    ]);
    expect(languages).toEqual(['Thai', 'English', 'Vietnamese', 'Khmer']);
  });

  it('picks first numeric exchange rate across heterogeneous entries', () => {
    const exchangeRate = __benchmarkValidationInternals.pickCountryInfoExchangeRate([
      { exchangeRate: 'invalid' },
      { exchangeRateToEUR: 4200 },
      { exchangeRate: 37 },
    ]);
    expect(exchangeRate).toBe(4200);
  });

  it('resolves run latency from explicit value or started_at fallback', () => {
    expect(__benchmarkValidationInternals.resolveRunLatencyMs({
      latency_ms: 1234,
    } as never)).toBe(1234);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-02-22T14:00:00.000Z'));
      const computed = __benchmarkValidationInternals.resolveRunLatencyMs({
        latency_ms: null,
        started_at: '2026-02-22T13:59:58.500Z',
      } as never);
      expect(computed).toBe(1500);
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows zero-day terminal city in round-trip mode and downgrades to warning', () => {
    const data = buildValidModelData();
    data.cities[1].days = 0;

    const result = __benchmarkValidationInternals.validateModelData(data, { roundTrip: true });
    expect(result.schemaValid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('Terminal round-trip city returned with 0 days'))).toBe(true);
  });

  it('keeps zero-day city blocking when round-trip mode is disabled', () => {
    const data = buildValidModelData();
    data.cities[1].days = 0;

    const result = __benchmarkValidationInternals.validateModelData(data, { roundTrip: false });
    expect(result.schemaValid).toBe(false);
    expect(result.errors).toContain('One or more entries are missing mandatory fields or have wrong field types');
  });
});
