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

  it('normalizes run comments to trimmed string/null with max-length validation', () => {
    expect(__benchmarkValidationInternals.normalizeRunComment(null)).toEqual({
      ok: true,
      comment: null,
    });
    expect(__benchmarkValidationInternals.normalizeRunComment('  quick note  ')).toEqual({
      ok: true,
      comment: 'quick note',
    });
    expect(__benchmarkValidationInternals.normalizeRunComment('   ')).toEqual({
      ok: true,
      comment: null,
    });
    expect(__benchmarkValidationInternals.normalizeRunComment(42)).toEqual({
      ok: false,
      error: 'Invalid comment. Expected string or null.',
    });
    expect(__benchmarkValidationInternals.normalizeRunComment('x'.repeat(2001))).toEqual({
      ok: false,
      error: 'Comment too long. Max 2000 characters.',
    });
  });

  it('builds and groups telemetry comment entries by provider/model', () => {
    const entries = __benchmarkValidationInternals.toBenchmarkRunCommentTelemetryEntries([
      {
        id: 'run-openai-1',
        provider: 'openai',
        model: 'gpt-5',
        run_comment: 'Strong overall structure',
        run_comment_updated_at: '2026-02-25T10:30:00.000Z',
        created_at: '2026-02-25T10:00:00.000Z',
        status: 'completed',
        satisfaction_rating: 'good',
      },
      {
        id: 'run-openai-2',
        provider: 'openai',
        model: 'gpt-5',
        run_comment: 'Confused activities with cities',
        run_comment_updated_at: '2026-02-25T11:30:00.000Z',
        created_at: '2026-02-25T11:00:00.000Z',
        status: 'completed',
        satisfaction_rating: 'bad',
      },
      {
        id: 'run-qwen-1',
        provider: 'openrouter',
        model: 'qwen/qwen3.5-plus-02-15',
        run_comment: 'Fast but sparse day plan',
        run_comment_updated_at: null,
        created_at: '2026-02-25T09:00:00.000Z',
        status: 'failed',
        satisfaction_rating: null,
      },
      {
        id: 'ignore-empty',
        provider: 'openrouter',
        model: 'qwen/qwen3.5-plus-02-15',
        run_comment: '',
        run_comment_updated_at: null,
        created_at: '2026-02-25T09:10:00.000Z',
        status: 'failed',
        satisfaction_rating: null,
      },
    ] as never);

    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      runId: 'run-openai-2',
      provider: 'openai',
      model: 'gpt-5',
      comment: 'Confused activities with cities',
    });

    const groups = __benchmarkValidationInternals.groupBenchmarkRunComments(entries);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5',
      total: 2,
    });
    expect(groups[0]?.comments[0]?.runId).toBe('run-openai-2');
    expect(groups[1]).toMatchObject({
      provider: 'openrouter',
      model: 'qwen/qwen3.5-plus-02-15',
      total: 1,
    });
  });
});
