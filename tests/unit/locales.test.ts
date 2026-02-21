import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  formatLocaleOptionLabel,
  isLocale,
  localeToDir,
  localeToHtmlLang,
  localeToIntlLocale,
  normalizeLocale,
} from '../../config/locales';

describe('config/locales', () => {
  it('validates and normalizes locale values', () => {
    expect(isLocale('de')).toBe(true);
    expect(isLocale('xx')).toBe(false);
    expect(normalizeLocale('it')).toBe('it');
    expect(normalizeLocale('xx')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it('returns locale mappings', () => {
    expect(localeToHtmlLang('de')).toBe('de');
    expect(localeToIntlLocale('de')).toBe('de-DE');
    expect(localeToDir('ko')).toBe('ltr');
  });

  it('exposes all supported locale labels and flags', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
      expect(LOCALE_FLAGS[locale]).toMatch(/^[A-Z]{2}$/);
      expect(formatLocaleOptionLabel(locale)).toBe(LOCALE_LABELS[locale]);
    }
  });
});
