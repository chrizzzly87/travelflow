import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import type { AppLanguage } from '../types';
import { COUNTRIES } from '../utils';
import { stripLeadingFlagEmoji } from '../utils/flagUtils';

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

const COUNTRY_CODE_BY_NAME = new Map(
    COUNTRY_OPTIONS.map((country) => [normalizeCountrySearchToken(country.name), country.code] as const)
);

export const getProfileCountryOptions = (): ProfileCountryOption[] => COUNTRY_OPTIONS;

export const isProfileCountryCode = (value: unknown): value is string => (
    typeof value === 'string'
    && /^[A-Z]{2}$/.test(value.trim().toUpperCase())
    && COUNTRY_BY_CODE.has(value.trim().toUpperCase())
);

export const normalizeProfileCountryCode = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    const withoutFlag = stripLeadingFlagEmoji(value);
    const trimmed = withoutFlag.trim();
    if (!trimmed) return '';

    if (/^[A-Za-z]{2}$/.test(trimmed)) {
        const upper = trimmed.toUpperCase();
        return COUNTRY_BY_CODE.has(upper) ? upper : '';
    }

    const normalizedToken = normalizeCountrySearchToken(trimmed);
    if (!normalizedToken) return '';
    return COUNTRY_CODE_BY_NAME.get(normalizedToken) || '';
};

export const getProfileCountryOptionByCode = (code?: string | null): ProfileCountryOption | null => {
    const normalizedCode = normalizeProfileCountryCode(code || '');
    if (!normalizedCode) return null;
    return COUNTRY_BY_CODE.get(normalizedCode) || null;
};

export const getProfileCountryDisplayName = (
    codeOrLegacy: string | null | undefined,
    locale?: string | AppLanguage
): string => {
    const raw = typeof codeOrLegacy === 'string' ? codeOrLegacy.trim() : '';
    if (!raw) return '';

    const normalizedCode = normalizeProfileCountryCode(raw);
    if (!normalizedCode) return raw;

    const country = COUNTRY_BY_CODE.get(normalizedCode);
    const normalizedLocale = normalizeLocale(locale || DEFAULT_LOCALE);
    try {
        const displayNames = new Intl.DisplayNames([normalizedLocale], { type: 'region' });
        const localizedName = displayNames.of(normalizedCode);
        if (localizedName) return localizedName;
    } catch {
        // Ignore and fall back to the country list label.
    }

    return country?.name || normalizedCode;
};

const includesToken = (token: string, query: string): boolean => token.includes(query);
const startsWithToken = (token: string, query: string): boolean => token.startsWith(query);

export const searchProfileCountryOptions = (query: string, limit = 24): ProfileCountryOption[] => {
    const normalizedQuery = normalizeCountrySearchToken(query);
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 24;

    if (!normalizedQuery) {
        return COUNTRY_OPTIONS.slice(0, normalizedLimit);
    }

    const startsWithMatches = COUNTRY_OPTIONS.filter((country) => {
        const nameToken = normalizeCountrySearchToken(country.name);
        const codeToken = country.code.toLocaleLowerCase();
        return startsWithToken(nameToken, normalizedQuery) || startsWithToken(codeToken, normalizedQuery);
    });

    const includesMatches = COUNTRY_OPTIONS.filter((country) => {
        if (startsWithMatches.some((match) => match.code === country.code)) return false;
        const nameToken = normalizeCountrySearchToken(country.name);
        const codeToken = country.code.toLocaleLowerCase();
        return includesToken(nameToken, normalizedQuery) || includesToken(codeToken, normalizedQuery);
    });

    return [...startsWithMatches, ...includesMatches].slice(0, normalizedLimit);
};
