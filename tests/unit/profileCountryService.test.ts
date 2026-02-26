import { describe, expect, it } from 'vitest';
import {
  getProfileCountryDisplayName,
  getProfileCountryOptionByCode,
  normalizeProfileCountryCode,
  searchProfileCountryOptions,
} from '../../services/profileCountryService';

describe('services/profileCountryService', () => {
  it('normalizes only ISO alpha-2 country codes', () => {
    expect(normalizeProfileCountryCode('de')).toBe('DE');
    expect(normalizeProfileCountryCode('DE')).toBe('DE');
    expect(normalizeProfileCountryCode('Germany')).toBe('');
    expect(normalizeProfileCountryCode('United States')).toBe('');
    expect(normalizeProfileCountryCode('Unknownland')).toBe('');
    expect(normalizeProfileCountryCode('')).toBe('');
  });

  it('resolves country options by code', () => {
    const germany = getProfileCountryOptionByCode('de');
    expect(germany?.code).toBe('DE');
    expect(germany?.name).toBe('Germany');
    expect(getProfileCountryOptionByCode('XX')).toBeNull();
  });

  it('returns localized country display names from ISO code and falls back safely', () => {
    const countryLabel = getProfileCountryDisplayName('DE', 'de');
    expect(countryLabel).toBeTruthy();
    expect(countryLabel).not.toBe('DE');

    expect(getProfileCountryDisplayName('Germany', 'en')).toBe('Germany');
    expect(getProfileCountryDisplayName('')).toBe('');
    expect(getProfileCountryDisplayName('Unknownland')).toBe('Unknownland');
  });

  it('searches only sovereign countries and excludes island destination entries', () => {
    const top = searchProfileCountryOptions('', 5);
    expect(top).toHaveLength(5);
    expect(top.every((entry) => /^[A-Z]{2}$/.test(entry.code))).toBe(true);

    const germanyMatches = searchProfileCountryOptions('ger', 10);
    expect(germanyMatches.some((entry) => entry.code === 'DE')).toBe(true);

    const baliMatches = searchProfileCountryOptions('bali', 10);
    expect(baliMatches.some((entry) => entry.name.toLowerCase() === 'bali')).toBe(false);
  });
});
