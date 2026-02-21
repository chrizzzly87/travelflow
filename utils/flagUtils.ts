const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;
const ASCII_A = 65;

const REGIONAL_FLAG_EMOJI_REGEX = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
const LEADING_FLAG_EMOJI_REGEX = /^\s*(?:🏴|[\u{1F1E6}-\u{1F1FF}]{2})\s*/u;
const FLAG_CODE_REGEX = /^[a-z]{2}(?:-[a-z]{2,4})?$/;

export const SCOTLAND_FLAG_CODE = 'gb-sct';

const isRegionalIndicator = (codePoint: number): boolean =>
    codePoint >= REGIONAL_INDICATOR_START && codePoint <= REGIONAL_INDICATOR_END;

const regionalPairToCode = (flagEmoji: string): string | null => {
    const chars = Array.from(flagEmoji);
    if (chars.length !== 2) return null;

    const codePoints = chars.map((char) => char.codePointAt(0));
    if (codePoints.some((codePoint) => typeof codePoint !== 'number')) return null;

    const [first, second] = codePoints as number[];
    if (!isRegionalIndicator(first) || !isRegionalIndicator(second)) return null;

    const firstChar = String.fromCharCode(ASCII_A + (first - REGIONAL_INDICATOR_START));
    const secondChar = String.fromCharCode(ASCII_A + (second - REGIONAL_INDICATOR_START));
    return `${firstChar}${secondChar}`.toLowerCase();
};

export const normalizeFlagCode = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === '🌍') return null;

    const normalizedCodeCandidate = trimmed
        .replace(/_/g, '-')
        .replace(/\s+/g, '')
        .toLowerCase();
    if (FLAG_CODE_REGEX.test(normalizedCodeCandidate)) {
        return normalizedCodeCandidate;
    }

    if (trimmed.includes('🏴')) {
        return SCOTLAND_FLAG_CODE;
    }

    const regionalMatch = trimmed.match(REGIONAL_FLAG_EMOJI_REGEX);
    if (!regionalMatch) return null;
    return regionalPairToCode(regionalMatch[0]);
};

export const stripLeadingFlagEmoji = (value: string): string => {
    return value.replace(LEADING_FLAG_EMOJI_REGEX, '').trim();
};

const SPECIAL_EMOJI_BY_FLAG_CODE: Record<string, string> = {
    'gb-eng': '🏴',
    'gb-sct': '🏴',
    'gb-wls': '🏴',
    'gb-zet': '🏴',
};

const codeToRegionalEmoji = (countryCode: string): string | null => {
    if (!/^[a-z]{2}$/.test(countryCode)) return null;
    const upper = countryCode.toUpperCase();
    const [first, second] = upper.split('');
    if (!first || !second) return null;
    const firstIndicator = REGIONAL_INDICATOR_START + (first.charCodeAt(0) - ASCII_A);
    const secondIndicator = REGIONAL_INDICATOR_START + (second.charCodeAt(0) - ASCII_A);
    return String.fromCodePoint(firstIndicator, secondIndicator);
};

export const flagCodeToEmoji = (value?: string | null): string | null => {
    const normalizedCode = normalizeFlagCode(value);
    if (!normalizedCode) return null;

    const special = SPECIAL_EMOJI_BY_FLAG_CODE[normalizedCode];
    if (special) return special;

    const countryCode = normalizedCode.split('-')[0];
    if (!countryCode) return null;
    return codeToRegionalEmoji(countryCode);
};
