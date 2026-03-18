import { DEFAULT_LOCALE, normalizeLocale } from '../config/locales';
import { getCountrySearchAliasesFromData, getLocalizedCountryNameFromData } from '../data/countryTravelData';
import type { AppLanguage } from '../types';
import { COUNTRIES } from '../utils';
import { buildCountrySearchKeys } from './countryAliasService';

export interface ProfileCountryOption {
    code: string;
    name: string;
    flag: string;
}

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
    return getLocalizedCountryNameFromData(normalizedCode, normalizedLocale)
        || COUNTRY_BY_CODE.get(normalizedCode)?.name
        || normalizedCode;
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

const matchesSearchKeys = (
    candidateKeys: string[],
    queryKeys: string[],
    match: (candidate: string, query: string) => boolean
): boolean => queryKeys.some((queryKey) => candidateKeys.some((candidateKey) => match(candidateKey, queryKey)));

const getProfileCountrySearchKeys = (country: ProfileCountryOption, localizedName: string): string[] => {
    const keys = new Set<string>();

    [
        localizedName,
        COUNTRY_BY_CODE.get(country.code)?.name || '',
        country.code,
        ...getCountrySearchAliasesFromData(country.code),
    ].forEach((value) => {
        buildCountrySearchKeys(value).forEach((key) => {
            if (key) keys.add(key);
        });
    });

    return Array.from(keys);
};

export const searchProfileCountryOptions = (
    query: string,
    limit = 24,
    locale?: string | AppLanguage
): ProfileCountryOption[] => {
    const queryKeys = buildCountrySearchKeys(query);
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 24;
    const normalizedLocale = normalizeLocale(locale || DEFAULT_LOCALE);

    const localizedOptions = COUNTRY_OPTIONS.map((country) => ({
        ...country,
        name: getLocalizedCountryName(country.code, normalizedLocale),
    }));

    if (queryKeys.length === 0) {
        return localizedOptions.slice(0, normalizedLimit);
    }

    const startsWithMatches = localizedOptions.filter((country) => {
        const searchKeys = getProfileCountrySearchKeys(country, country.name);
        return matchesSearchKeys(searchKeys, queryKeys, (candidate, searchKey) => candidate.startsWith(searchKey));
    });

    const includesMatches = localizedOptions.filter((country) => {
        if (startsWithMatches.some((match) => match.code === country.code)) return false;
        const searchKeys = getProfileCountrySearchKeys(country, country.name);
        return matchesSearchKeys(searchKeys, queryKeys, (candidate, searchKey) => candidate.includes(searchKey));
    });

    return [...startsWithMatches, ...includesMatches].slice(0, normalizedLimit);
};
