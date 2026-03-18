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
    expect(getProfileCountryDisplayName('KR', 'ko')).toBe('대한민국');

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

  it('returns locale-aware option labels and supports localized search terms', () => {
    const optionInGerman = getProfileCountryOptionByCode('DE', 'de');
    expect(optionInGerman).toBeTruthy();
    expect(optionInGerman?.name).toBe(getProfileCountryDisplayName('DE', 'de'));

    const germanMatches = searchProfileCountryOptions('deut', 10, 'de');
    expect(germanMatches.some((entry) => entry.code === 'DE')).toBe(true);
  });

  it('matches generated aliases, long-form names, and localized alternatives', () => {
    expect(searchProfileCountryOptions('england', 10).some((entry) => entry.code === 'GB')).toBe(true);
    expect(searchProfileCountryOptions('uk', 10).some((entry) => entry.code === 'GB')).toBe(true);
    expect(searchProfileCountryOptions('grossbritannien', 10).some((entry) => entry.code === 'GB')).toBe(true);
    expect(searchProfileCountryOptions('usa', 10).some((entry) => entry.code === 'US')).toBe(true);
    expect(searchProfileCountryOptions('cote divoire', 10).some((entry) => entry.code === 'CI')).toBe(true);
    expect(searchProfileCountryOptions('prc', 10).some((entry) => entry.code === 'CN')).toBe(true);
    expect(searchProfileCountryOptions("people's republic of china", 10).some((entry) => entry.code === 'CN')).toBe(true);
    expect(searchProfileCountryOptions('volksrepublik china', 10).some((entry) => entry.code === 'CN')).toBe(true);
    expect(searchProfileCountryOptions('대한민국', 10).some((entry) => entry.code === 'KR')).toBe(true);
    expect(searchProfileCountryOptions('dr kongo', 10).some((entry) => entry.code === 'CD')).toBe(true);
    expect(searchProfileCountryOptions('zaire', 10).some((entry) => entry.code === 'CD')).toBe(true);
    expect(searchProfileCountryOptions('republik kongo', 10).some((entry) => entry.code === 'CG')).toBe(true);
    expect(searchProfileCountryOptions('ceylon', 10).some((entry) => entry.code === 'LK')).toBe(true);
    expect(searchProfileCountryOptions('siam', 10).some((entry) => entry.code === 'TH')).toBe(true);
    expect(searchProfileCountryOptions('birma', 10).some((entry) => entry.code === 'MM')).toBe(true);
    expect(searchProfileCountryOptions('persien', 10).some((entry) => entry.code === 'IR')).toBe(true);
    expect(searchProfileCountryOptions('weissrussland', 10).some((entry) => entry.code === 'BY')).toBe(true);
    expect(searchProfileCountryOptions('republik moldau', 10).some((entry) => entry.code === 'MD')).toBe(true);
  });
});
