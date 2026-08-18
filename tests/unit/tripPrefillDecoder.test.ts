import { describe, expect, it } from 'vitest';
import { MAX_PREFILL_CITY_LIST, decodeTripPrefill } from '../../services/tripPrefillDecoder';

const encode = (value: unknown): string => {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('services/tripPrefillDecoder', () => {
  it('decodes valid payloads and keeps only allowed values', () => {
    const encoded = encode({
      countries: ['Germany', 'germany', 'Bali', 'Unknown'],
      startDate: '2026-06-01',
      endDate: '2026-06-12',
      budget: 'High',
      pace: 'Balanced',
      cities: 'Berlin, Prague',
      notes: 'No overnight bus',
      roundTrip: true,
      mode: 'wizard',
      styles: ['backpacker', 123],
      vibes: ['culture'],
      logistics: ['fast-transport', false],
      meta: { source: 'test' },
    });

    const parsed = decodeTripPrefill(encoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.countries).toEqual(['Germany', 'Bali']);
    expect(parsed?.budget).toBe('High');
    expect(parsed?.pace).toBe('Balanced');
    expect(parsed?.mode).toBe('wizard');
    expect(parsed?.styles).toEqual(['backpacker']);
    expect(parsed?.logistics).toEqual(['fast-transport']);
    expect(parsed?.meta).toEqual({ source: 'test' });
  });

  it('drops invalid fields and keeps only array-typed fields when present', () => {
    const encoded = encode({
      countries: ['UnknownLand'],
      startDate: '2026-99-99',
      endDate: 'nope',
      budget: 'Ultra',
      pace: 'Warp',
      mode: 'invalid',
      styles: [1, 2],
      vibes: [true],
      logistics: [null],
    });

    expect(decodeTripPrefill(encoded)).toEqual({
      styles: [],
      vibes: [],
      logistics: [],
    });
  });

  it('returns null for invalid/base64-corrupt payloads', () => {
    expect(decodeTripPrefill('%%%')).toBeNull();
    expect(decodeTripPrefill('not-valid-base64')).toBeNull();
  });

  it('accepts classic mode and boolean flags', () => {
    const encoded = encode({
      mode: 'classic',
      roundTrip: false,
      countries: ['Germany'],
    });

    const parsed = decodeTripPrefill(encoded);
    expect(parsed).toEqual({
      mode: 'classic',
      roundTrip: false,
      countries: ['Germany'],
    });
  });

  it('normalizes legacy wizard budget and pace values for backward compatibility', () => {
    const encoded = encode({
      countries: ['Portugal'],
      budget: 'Premium',
      pace: 'Intensive',
    });

    expect(decodeTripPrefill(encoded)).toEqual({
      countries: ['Portugal'],
      budget: 'High',
      pace: 'Fast',
    });
  });

  it('accepts alias-backed destinations and stores canonical country names once', () => {
    const encoded = encode({
      countries: [
        'England',
        'UK',
        'USA',
        "Côte d'Ivoire",
        'PRC',
        "People's Republic of China",
        'DR Kongo',
        'Zaire',
        'Ceylon',
      ],
    });

    expect(decodeTripPrefill(encoded)).toEqual({
      countries: ['United Kingdom', 'United States', 'Ivory Coast', 'China', 'Congo (Democratic Republic)', 'Sri Lanka'],
    });
  });

  describe('structured city lists', () => {
    it('keeps a legacy comma-separated list untouched and adds no cityList', () => {
      const parsed = decodeTripPrefill(encode({ cities: 'Lisbon, Sintra, Porto' }));
      expect(parsed?.cities).toBe('Lisbon, Sintra, Porto');
      expect(parsed?.cityList).toBeUndefined();
    });

    it('accepts an ordered cityList and mirrors it into the legacy string', () => {
      const parsed = decodeTripPrefill(encode({ cityList: ['Tokyo', ' Hakone ', 'Kyoto', '', 42] }));
      expect(parsed?.cityList).toEqual(['Tokyo', 'Hakone', 'Kyoto']);
      expect(parsed?.cities).toBe('Tokyo, Hakone, Kyoto');
    });

    it('prefers an explicit cities string when both forms are present', () => {
      const parsed = decodeTripPrefill(encode({ cities: 'Rome, Florence', cityList: ['Rome', 'Florence'] }));
      expect(parsed?.cities).toBe('Rome, Florence');
      expect(parsed?.cityList).toEqual(['Rome', 'Florence']);
    });

    it('caps very long city lists', () => {
      const cityList = Array.from({ length: MAX_PREFILL_CITY_LIST + 6 }, (_, index) => `City ${index + 1}`);
      const parsed = decodeTripPrefill(encode({ cityList }));
      expect(parsed?.cityList).toHaveLength(MAX_PREFILL_CITY_LIST);
      expect(parsed?.cityList?.[0]).toBe('City 1');
    });

    it('ignores a malformed cityList', () => {
      expect(decodeTripPrefill(encode({ cityList: 'Tokyo, Kyoto' }))?.cityList).toBeUndefined();
      expect(decodeTripPrefill(encode({ cityList: [], notes: 'keep' }))?.cityList).toBeUndefined();
    });
  });
});
