import { describe, expect, it } from 'vitest';
import {
  MAX_PROFILE_PASSPORT_STICKERS,
  getPassportCoverTheme,
  normalizePassportStickerSelection,
  resolvePassportCoverTone,
} from '../../services/passportService';

describe('services/passportService', () => {
  it('normalizes sticker selection to unique ids and max length', () => {
    const result = normalizePassportStickerSelection([
      ' first_trip_created ',
      'trip_architect_10',
      'trip_architect_10',
      'city_hopper_25',
      'distance_1000',
    ]);

    expect(result).toEqual([
      'first_trip_created',
      'trip_architect_10',
      'city_hopper_25',
    ]);
    expect(result.length).toBe(MAX_PROFILE_PASSPORT_STICKERS);
  });

  it('resolves passport cover tones by country and falls back to blue', () => {
    expect(resolvePassportCoverTone('DE')).toBe('red');
    expect(resolvePassportCoverTone('AE')).toBe('green');
    expect(resolvePassportCoverTone('NZ')).toBe('black');
    expect(resolvePassportCoverTone('US')).toBe('blue');
    expect(resolvePassportCoverTone('')).toBe('blue');
  });

  it('returns a complete passport cover theme', () => {
    const theme = getPassportCoverTheme('DE');
    expect(theme.tone).toBe('red');
    expect(theme.coverHex.length).toBeGreaterThan(0);
    expect(theme.textHex.length).toBeGreaterThan(0);
  });
});
