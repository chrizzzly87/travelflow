import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCALE,
    formatLocaleOptionLabel,
    isLocale,
    localeToDir,
    normalizeLocale,
} from '../../config/locales';

describe('locales config', () => {
    it('recognizes supported locales', () => {
        expect(isLocale('en')).toBe(true);
        expect(isLocale('ko')).toBe(true);
        expect(isLocale('xx')).toBe(false);
        expect(isLocale(undefined)).toBe(false);
    });

    it('normalizes invalid locale values to default', () => {
        expect(normalizeLocale('de')).toBe('de');
        expect(normalizeLocale('xx')).toBe(DEFAULT_LOCALE);
        expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
    });

    it('returns expected metadata for known locales', () => {
        expect(localeToDir('en')).toBe('ltr');
        expect(formatLocaleOptionLabel('pl')).toBe('Polski');
    });
});
