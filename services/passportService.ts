import { normalizeProfileCountryCode } from './profileCountryService';

export type PassportCoverTone = 'blue' | 'red' | 'green' | 'black';

export interface PassportCoverTheme {
    tone: PassportCoverTone;
    coverHex: string;
    spineHex: string;
    borderHex: string;
    textHex: string;
    mutedTextHex: string;
    emblemHex: string;
}

export const MAX_PROFILE_PASSPORT_STICKERS = 3;

const RED_PASSPORT_COUNTRIES = new Set([
    'AL', 'AT', 'BE', 'BG', 'CH', 'CN', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR',
    'HR', 'HU', 'IE', 'IS', 'IT', 'JP', 'LA', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK',
    'MT', 'NL', 'NO', 'PH', 'PL', 'PT', 'RO', 'RS', 'SE', 'SI', 'SK', 'TH', 'TR', 'VN',
]);

const GREEN_PASSPORT_COUNTRIES = new Set([
    'AE', 'AF', 'BD', 'BH', 'DZ', 'EG', 'ID', 'IQ', 'IR', 'JO', 'KW', 'LB', 'LY', 'MA',
    'ML', 'MR', 'MY', 'NE', 'NG', 'OM', 'PK', 'PS', 'QA', 'SA', 'SN', 'SO', 'SY', 'TD',
    'TN', 'YE',
]);

const BLACK_PASSPORT_COUNTRIES = new Set([
    'AO', 'BI', 'BW', 'CD', 'CG', 'MW', 'NZ', 'TZ', 'ZM', 'ZW',
]);

const PASSPORT_THEME_BY_TONE: Record<PassportCoverTone, PassportCoverTheme> = {
    blue: {
        tone: 'blue',
        coverHex: '#152a4a',
        spineHex: '#0f1e36',
        borderHex: '#0f223f',
        textHex: '#f3f6fb',
        mutedTextHex: '#bfcee3',
        emblemHex: '#d8e6ff',
    },
    red: {
        tone: 'red',
        coverHex: '#5b1725',
        spineHex: '#3f101a',
        borderHex: '#42131d',
        textHex: '#fff4f5',
        mutedTextHex: '#f2cdd2',
        emblemHex: '#ffe4e8',
    },
    green: {
        tone: 'green',
        coverHex: '#1a4736',
        spineHex: '#133426',
        borderHex: '#173b2e',
        textHex: '#f2fbf7',
        mutedTextHex: '#c4e8d9',
        emblemHex: '#ddf5eb',
    },
    black: {
        tone: 'black',
        coverHex: '#222429',
        spineHex: '#15171a',
        borderHex: '#171a1d',
        textHex: '#f8fafc',
        mutedTextHex: '#c8d0da',
        emblemHex: '#e2e8f0',
    },
};

export const resolvePassportCoverTone = (countryCode?: string | null): PassportCoverTone => {
    const normalizedCountryCode = normalizeProfileCountryCode(countryCode || '');
    if (!normalizedCountryCode) return 'blue';
    if (RED_PASSPORT_COUNTRIES.has(normalizedCountryCode)) return 'red';
    if (GREEN_PASSPORT_COUNTRIES.has(normalizedCountryCode)) return 'green';
    if (BLACK_PASSPORT_COUNTRIES.has(normalizedCountryCode)) return 'black';
    return 'blue';
};

export const getPassportCoverTheme = (countryCode?: string | null): PassportCoverTheme => {
    return PASSPORT_THEME_BY_TONE[resolvePassportCoverTone(countryCode)];
};

export const normalizePassportStickerSelection = (
    value: unknown,
    limit = MAX_PROFILE_PASSPORT_STICKERS
): string[] => {
    if (!Array.isArray(value)) return [];
    const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : MAX_PROFILE_PASSPORT_STICKERS;
    const next: string[] = [];
    value.forEach((entry) => {
        if (next.length >= normalizedLimit) return;
        if (typeof entry !== 'string') return;
        const normalized = entry.trim();
        if (!normalized || next.includes(normalized)) return;
        next.push(normalized);
    });
    return next;
};
