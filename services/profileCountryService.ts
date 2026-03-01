import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import type { AppLanguage } from '../types';
import { COUNTRIES } from '../utils';

export interface ProfileCountryOption {
    code: string;
    name: string;
    flag: string;
}

const normalizeCountrySearchToken = (value: string): string => value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const COUNTRY_OPTIONS: ProfileCountryOption[] = [...COUNTRIES]
    .map((country) => ({
        code: country.code.toUpperCase(),
        name: country.name,
        flag: country.flag,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

const COUNTRY_BY_CODE = new Map(
    COUNTRY_OPTIONS.map((country) => [country.code, country] as const)
);

export const getProfileCountryOptions = (): ProfileCountryOption[] => COUNTRY_OPTIONS;

const getLocalizedCountryName = (code: string, locale?: string | AppLanguage): string => {
    const normalizedCode = normalizeProfileCountryCode(code);
    if (!normalizedCode) return '';

    const normalizedLocale = normalizeLocale(locale || DEFAULT_LOCALE);
    try {
        const displayNames = new Intl.DisplayNames([normalizedLocale], { type: 'region' });
        const localizedName = displayNames.of(normalizedCode);
        if (localizedName) return localizedName;
    } catch {
        // Ignore and fall back to source country label.
    }

    return COUNTRY_BY_CODE.get(normalizedCode)?.name || normalizedCode;
};

export const isProfileCountryCode = (value: unknown): value is string => (
    typeof value === 'string'
    && /^[A-Z]{2}$/.test(value.trim().toUpperCase())
    && COUNTRY_BY_CODE.has(value.trim().toUpperCase())
);

export const normalizeProfileCountryCode = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    const trimmed = value.trim();
    if (!trimmed) return '';

    if (/^[A-Za-z]{2}$/.test(trimmed)) {
        const upper = trimmed.toUpperCase();
        return COUNTRY_BY_CODE.has(upper) ? upper : '';
    }
    return '';
};

export const getProfileCountryOptionByCode = (
    code?: string | null,
    locale?: string | AppLanguage
): ProfileCountryOption | null => {
    const normalizedCode = normalizeProfileCountryCode(code || '');
    if (!normalizedCode) return null;
    const source = COUNTRY_BY_CODE.get(normalizedCode);
    if (!source) return null;
    return {
        ...source,
        name: getLocalizedCountryName(normalizedCode, locale),
    };
};

export const getProfileCountryDisplayName = (
    codeOrLegacy: string | null | undefined,
    locale?: string | AppLanguage
): string => {
    const raw = typeof codeOrLegacy === 'string' ? codeOrLegacy.trim() : '';
    if (!raw) return '';

    const normalizedCode = normalizeProfileCountryCode(raw);
    if (!normalizedCode) return raw;

    return getLocalizedCountryName(normalizedCode, locale);
};

const includesToken = (token: string, query: string): boolean => token.includes(query);
const startsWithToken = (token: string, query: string): boolean => token.startsWith(query);

export const searchProfileCountryOptions = (
    query: string,
    limit = 24,
    locale?: string | AppLanguage
): ProfileCountryOption[] => {
    const normalizedQuery = normalizeCountrySearchToken(query);
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 24;
    const normalizedLocale = normalizeLocale(locale || DEFAULT_LOCALE);

    const localizedOptions = COUNTRY_OPTIONS.map((country) => ({
        ...country,
        name: getLocalizedCountryName(country.code, normalizedLocale),
    }));

    if (!normalizedQuery) {
        return localizedOptions.slice(0, normalizedLimit);
    }

    const startsWithMatches = localizedOptions.filter((country) => {
        const nameToken = normalizeCountrySearchToken(country.name);
        const fallbackNameToken = normalizeCountrySearchToken(COUNTRY_BY_CODE.get(country.code)?.name || '');
        const codeToken = country.code.toLocaleLowerCase();
        return startsWithToken(nameToken, normalizedQuery)
            || startsWithToken(fallbackNameToken, normalizedQuery)
            || startsWithToken(codeToken, normalizedQuery);
    });

    const includesMatches = localizedOptions.filter((country) => {
        if (startsWithMatches.some((match) => match.code === country.code)) return false;
        const nameToken = normalizeCountrySearchToken(country.name);
        const fallbackNameToken = normalizeCountrySearchToken(COUNTRY_BY_CODE.get(country.code)?.name || '');
        const codeToken = country.code.toLocaleLowerCase();
        return includesToken(nameToken, normalizedQuery)
            || includesToken(fallbackNameToken, normalizedQuery)
            || includesToken(codeToken, normalizedQuery);
    });

    return [...startsWithMatches, ...includesMatches].slice(0, normalizedLimit);
};
