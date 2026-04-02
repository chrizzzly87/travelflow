import { getCountrySearchAliasesFromData } from '../data/countryTravelData';

const COMBINING_MARKS_REGEX = /\p{Mark}+/gu;
const SPECIAL_SEARCH_CHARACTERS_REGEX = /[ßẞÆæǼǽŒœØøÐðÞþŁłĐđĦħıĲĳ]/g;
const NON_ALPHANUMERIC_REGEX = /[^\p{Letter}\p{Number}]+/gu;
const WHITESPACE_REGEX = /\s+/g;

const SPECIAL_SEARCH_REPLACEMENTS: Record<string, string> = {
    ß: 'ss',
    ẞ: 'ss',
    Æ: 'ae',
    æ: 'ae',
    Ǽ: 'ae',
    ǽ: 'ae',
    Œ: 'oe',
    œ: 'oe',
    Ø: 'o',
    ø: 'o',
    Ð: 'd',
    ð: 'd',
    Þ: 'th',
    þ: 'th',
    Ł: 'l',
    ł: 'l',
    Đ: 'd',
    đ: 'd',
    Ħ: 'h',
    ħ: 'h',
    ı: 'i',
    Ĳ: 'ij',
    ĳ: 'ij',
};

export const normalizeCountrySearchToken = (value: string): string => value
    .trim()
    .toLocaleLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(SPECIAL_SEARCH_CHARACTERS_REGEX, (character) => SPECIAL_SEARCH_REPLACEMENTS[character] || character)
    .normalize('NFKD')
    .replace(COMBINING_MARKS_REGEX, '')
    .replace(NON_ALPHANUMERIC_REGEX, ' ')
    .trim()
    .replace(WHITESPACE_REGEX, ' ');

export const buildCountrySearchKeys = (value: string): string[] => {
    const normalized = normalizeCountrySearchToken(value);
    if (!normalized) return [];

    const compact = normalized.replace(WHITESPACE_REGEX, '');
    return compact && compact !== normalized
        ? [normalized, compact]
        : [normalized];
};

export const getCountryAliases = (code?: string | null): string[] => {
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalizedCode) return [];
    return getCountrySearchAliasesFromData(normalizedCode);
};
