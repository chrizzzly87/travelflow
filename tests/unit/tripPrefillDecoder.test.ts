import { describe, expect, it } from 'vitest';
import { decodeTripPrefill } from '../../services/tripPrefillDecoder';

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
});
