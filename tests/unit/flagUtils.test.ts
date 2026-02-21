import { describe, expect, it } from 'vitest';
import {
  SCOTLAND_FLAG_CODE,
  flagCodeToEmoji,
  normalizeFlagCode,
  stripLeadingFlagEmoji,
} from '../../utils/flagUtils';

describe('utils/flagUtils', () => {
  it('normalizes code and emoji representations', () => {
    expect(normalizeFlagCode('US')).toBe('us');
    expect(normalizeFlagCode('pt_br')).toBe('pt-br');
    expect(normalizeFlagCode('🇩🇪')).toBe('de');
    expect(normalizeFlagCode('🏴')).toBe(SCOTLAND_FLAG_CODE);
    expect(normalizeFlagCode('🌍')).toBeNull();
    expect(normalizeFlagCode('')).toBeNull();
  });

  it('returns null for empty or non-flag values', () => {
    expect(normalizeFlagCode(undefined)).toBeNull();
    expect(normalizeFlagCode(null)).toBeNull();
    expect(normalizeFlagCode('   ')).toBeNull();
    expect(normalizeFlagCode('hello world')).toBeNull();
    expect(normalizeFlagCode('🇦')).toBeNull();
  });

  it('strips leading flag emojis from labels', () => {
    expect(stripLeadingFlagEmoji('🇫🇷 Paris')).toBe('Paris');
    expect(stripLeadingFlagEmoji('🏴 Scotland')).toBe('Scotland');
    expect(stripLeadingFlagEmoji('  🇺🇸   New York')).toBe('New York');
    expect(stripLeadingFlagEmoji('Berlin 🇩🇪')).toBe('Berlin 🇩🇪');
    expect(stripLeadingFlagEmoji('Berlin')).toBe('Berlin');
  });

  it('converts normalized codes back to emoji', () => {
    expect(flagCodeToEmoji('us')).toBe('🇺🇸');
    expect(flagCodeToEmoji('us-ca')).toBe('🇺🇸');
    expect(flagCodeToEmoji('pt_br')).toBe('🇵🇹');
    expect(flagCodeToEmoji('gb-eng')).toBe('🏴');
    expect(flagCodeToEmoji('gb-sct')).toBe('🏴');
    expect(flagCodeToEmoji('gb-wls')).toBe('🏴');
    expect(flagCodeToEmoji('gb-zet')).toBe('🏴');
    expect(flagCodeToEmoji('')).toBeNull();
    expect(flagCodeToEmoji('invalid')).toBeNull();
  });
});
