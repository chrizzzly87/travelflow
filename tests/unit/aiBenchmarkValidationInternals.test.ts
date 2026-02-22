import { describe, expect, it, vi } from 'vitest';
import { __benchmarkValidationInternals } from '../../netlify/edge-functions/ai-benchmark.ts';

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
});
