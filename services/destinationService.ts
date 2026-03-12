import popularIslandDestinationsJson from '../data/popularIslandDestinations.json';
import {
    getCountrySeasonByCode,
    getLocalizedCountryNameFromData,
    getLocalizedIslandNameFromData,
} from '../data/countryTravelData';
import { DESTINATION_RECOMMENDATION_PROFILES } from '../data/destinationRecommendationProfiles';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../config/locales';
import { COUNTRIES } from '../utils';

export type DestinationKind = 'country' | 'island';

export interface DestinationOption {
    name: string;
    code: string;
    flag: string;
    kind: DestinationKind;
    parentCountryName?: string;
    parentCountryCode?: string;
    aliases?: string[];
    localizedNames?: Record<string, string>;
}

interface DestinationSearchOptions {
    excludeNames?: string[];
    limit?: number;
    months?: number[];
}

interface IslandDestinationSeed {
    name: string;
    countryCode: string;
    code?: string;
    aliases?: string[];
    localizedNames?: Record<string, string>;
}

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code.toLocaleLowerCase(), country]));

const buildIslandCode = (parentCode: string, name: string): string =>
    `${parentCode}-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const normalizeDestinationLocale = (locale?: string): string => {
    if (!locale) return DEFAULT_LOCALE;
    const trimmed = locale.trim().toLocaleLowerCase();
    if (!trimmed) return DEFAULT_LOCALE;
    const [base] = trimmed.split('-');
    return base || DEFAULT_LOCALE;
};

const normalizeLocalizedNames = (
    localizedNames?: Record<string, string>
): Record<string, string> => {
    if (!localizedNames) return {};

    return Object.entries(localizedNames).reduce<Record<string, string>>((acc, [locale, value]) => {
        if (typeof value !== 'string') return acc;
        const normalizedLocale = normalizeDestinationLocale(locale);
        const normalizedValue = value.trim();
        if (!normalizedValue) return acc;
        acc[normalizedLocale] = normalizedValue;
        return acc;
    }, {});
};

const buildLocalizedNamesFromDataset = (
    kind: DestinationKind,
    code: string,
    fallbackName: string
): Record<string, string> => {
    const localizedNames: Record<string, string> = {};

    SUPPORTED_LOCALES.forEach((locale) => {
        const translatedName = kind === 'country'
            ? getLocalizedCountryNameFromData(code, locale)
            : getLocalizedIslandNameFromData(code, locale);
        localizedNames[locale] = translatedName || fallbackName;
    });

    return localizedNames;
};

const getLocalizedDestinationName = (
    destination: DestinationOption,
    locale?: string
): string => {
    const localeKey = normalizeDestinationLocale(locale);
    return destination.localizedNames?.[localeKey]
        || destination.localizedNames?.[DEFAULT_LOCALE]
        || destination.name;
};

const buildIslandDestination = (
    seed: IslandDestinationSeed
): DestinationOption => {
    const parent = COUNTRY_BY_CODE.get(seed.countryCode.trim().toLocaleLowerCase());
    if (!parent) {
        throw new Error(`Island destination parent not found for ${seed.name}: ${seed.countryCode}`);
    }
    const code = seed.code || buildIslandCode(parent.code, seed.name);
    const localizedNames = {
        ...buildLocalizedNamesFromDataset('island', code, seed.name),
        ...normalizeLocalizedNames(seed.localizedNames),
    };

    return {
        name: seed.name,
        code,
        flag: parent.flag,
        kind: 'island',
        parentCountryName: parent.name,
        parentCountryCode: parent.code,
        aliases: seed.aliases || [],
        localizedNames,
    };
};

const ISLAND_DESTINATION_SEEDS = popularIslandDestinationsJson as IslandDestinationSeed[];

export const ISLAND_DESTINATIONS: DestinationOption[] = ISLAND_DESTINATION_SEEDS
    .map((seed) => buildIslandDestination(seed))
    .sort((a, b) => a.name.localeCompare(b.name));

export const DESTINATION_OPTIONS: DestinationOption[] = [
    ...COUNTRIES.map((country) => ({
        ...country,
        kind: 'country' as const,
        localizedNames: buildLocalizedNamesFromDataset('country', country.code, country.name),
    })),
    ...ISLAND_DESTINATIONS,
];

const DESTINATION_BY_CODE = new Map(
    DESTINATION_OPTIONS.map((d) => [d.code.toLowerCase(), d])
);
const DESTINATION_RECOMMENDATION_PROFILE_BY_CODE = new Map(
    Object.entries(DESTINATION_RECOMMENDATION_PROFILES).map(([code, profile]) => [code.toLowerCase(), profile])
);

const normalizeDestinationKey = (value: string): string => value.trim().toLocaleLowerCase();
const normalizeMonths = (months: number[] = []): number[] => Array.from(
    new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))
).sort((left, right) => left - right);

const DESTINATION_BY_LOOKUP = new Map<string, DestinationOption>();

const addDestinationLookup = (destination: DestinationOption, candidate?: string): void => {
    if (!candidate) return;
    const normalized = normalizeDestinationKey(candidate);
    if (!normalized || DESTINATION_BY_LOOKUP.has(normalized)) return;
    DESTINATION_BY_LOOKUP.set(normalized, destination);
};

DESTINATION_OPTIONS.forEach((destination) => {
    addDestinationLookup(destination, destination.name);
    (destination.aliases || []).forEach((alias) => addDestinationLookup(destination, alias));
    Object.values(destination.localizedNames || {}).forEach((localizedName) => addDestinationLookup(destination, localizedName));
});

const getDestinationSearchTokens = (destination: DestinationOption): string[] => {
    const tokens = new Set<string>();
    tokens.add(destination.name);
    (destination.aliases || []).forEach((alias) => tokens.add(alias));
    Object.values(destination.localizedNames || {}).forEach((localizedName) => tokens.add(localizedName));

    if (destination.parentCountryName) tokens.add(destination.parentCountryName);
    if (destination.parentCountryCode) {
        const parent = DESTINATION_BY_CODE.get(destination.parentCountryCode.toLowerCase());
        if (parent) {
            tokens.add(parent.name);
            Object.values(parent.localizedNames || {}).forEach((localizedName) => tokens.add(localizedName));
        }
    }

    return Array.from(tokens)
        .map((token) => token.trim())
        .filter(Boolean);
};

export const getDestinationOptionByName = (value: string): DestinationOption | undefined => {
    const normalized = normalizeDestinationKey(value);
    if (!normalized) return undefined;
    return DESTINATION_BY_LOOKUP.get(normalized);
};

export const getDestinationOptionByCode = (code: string): DestinationOption | undefined => {
    return DESTINATION_BY_CODE.get(code.toLowerCase());
};

export const resolveDestinationCodes = (codes: string[]): string[] => {
    return codes
        .map((code) => getDestinationOptionByCode(code))
        .filter((d): d is DestinationOption => d !== undefined)
        .map((d) => d.name);
};

export const resolveDestinationName = (value: string): string => {
    const match = getDestinationOptionByName(value);
    return match?.name || value.trim();
};

export const getDestinationDisplayName = (value: string, locale?: string): string => {
    const destination = getDestinationOptionByName(value);
    if (!destination) return value.trim();
    return getLocalizedDestinationName(destination, locale);
};

export const getDestinationDisplayNameByCode = (code: string, locale?: string): string | undefined => {
    const destination = getDestinationOptionByCode(code);
    if (!destination) return undefined;
    return getLocalizedDestinationName(destination, locale);
};

export const getDestinationPromptLabel = (value: string, locale?: string): string => {
    const destination = getDestinationOptionByName(value);
    if (!destination) return value;

    const destinationName = getLocalizedDestinationName(destination, locale);
    if (destination.kind === 'island' && destination.parentCountryName) {
        const parentCountryName = destination.parentCountryCode
            ? getDestinationDisplayNameByCode(destination.parentCountryCode, locale) || destination.parentCountryName
            : destination.parentCountryName;
        return `${destinationName}, ${parentCountryName}`;
    }
    return destinationName;
};

export const getDestinationSeasonCountryName = (value: string): string => {
    const destination = getDestinationOptionByName(value);
    if (!destination) return value;
    return destination.parentCountryName || destination.name;
};

export const getDestinationMetaLabel = (value: string, locale?: string): string | undefined => {
    const destination = getDestinationOptionByName(value);
    if (!destination || destination.kind !== 'island' || !destination.parentCountryName) return undefined;
    const parentCountryName = destination.parentCountryCode
        ? getDestinationDisplayNameByCode(destination.parentCountryCode, locale) || destination.parentCountryName
        : destination.parentCountryName;
    return `Island of ${parentCountryName}`;
};

export const isIslandDestination = (value: string): boolean => {
    const destination = getDestinationOptionByName(value);
    return destination?.kind === 'island';
};

export const getRollingRecommendationMonths = (referenceDate = new Date(), count = 3): number[] => {
    const safeCount = Math.max(1, Math.min(count, 12));
    const startMonthIndex = Number.isNaN(referenceDate.getTime())
        ? new Date().getMonth()
        : referenceDate.getMonth();
    return Array.from({ length: safeCount }, (_entry, index) => ((startMonthIndex + index) % 12) + 1);
};

const getDestinationRecommendationProfile = (destination: DestinationOption) =>
    DESTINATION_RECOMMENDATION_PROFILE_BY_CODE.get(destination.code.toLowerCase());

const getSeasonCountryCode = (destination: DestinationOption): string => (
    destination.kind === 'country' ? destination.code : destination.parentCountryCode || destination.code
);

export const getDestinationRecommendationScore = (
    destination: DestinationOption,
    months: number[] = []
): number => {
    const profile = getDestinationRecommendationProfile(destination);
    const baseScore = profile?.baseScore || 0;
    const normalizedMonths = normalizeMonths(months);

    if (normalizedMonths.length === 0) return baseScore;

    const seasonEntry = getCountrySeasonByCode(getSeasonCountryCode(destination));
    const bestMonthSet = new Set(seasonEntry?.bestMonths || []);
    const shoulderMonthSet = new Set(seasonEntry?.shoulderMonths || []);
    const avoidMonthSet = new Set(seasonEntry?.avoidMonths || []);
    const eventCountsByMonth = (seasonEntry?.events || []).reduce<Record<number, number>>((acc, event) => {
        const month = typeof event.month === 'number' ? event.month : 0;
        if (month < 1 || month > 12) return acc;
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});

    const totalModifier = normalizedMonths.reduce((sum, month) => {
        let next = 0;
        if (bestMonthSet.has(month)) next += 120;
        else if (shoulderMonthSet.has(month)) next += 40;
        if (avoidMonthSet.has(month)) next -= 120;

        const profileAdjustment = profile?.monthAdjustments?.[month] || 0;
        const eventBonus = Math.min((eventCountsByMonth[month] || 0) * 30, 90);
        return sum + next + profileAdjustment + eventBonus;
    }, 0);

    return baseScore + Math.round(totalModifier / normalizedMonths.length);
};

const sortDestinationOptionsByRecommendationScore = (
    options: DestinationOption[],
    months: number[]
): DestinationOption[] => {
    const normalizedMonths = normalizeMonths(months);
    return [...options].sort((left, right) => {
        const scoreDelta = getDestinationRecommendationScore(right, normalizedMonths) - getDestinationRecommendationScore(left, normalizedMonths);
        if (scoreDelta !== 0) return scoreDelta;
        return left.name.localeCompare(right.name);
    });
};

export const getRecommendedDestinationOptions = (
    options: DestinationSearchOptions = {}
): DestinationOption[] => {
    const excluded = new Set((options.excludeNames || []).map((name) => resolveDestinationName(name).toLocaleLowerCase()));
    const source = DESTINATION_OPTIONS.filter((destination) => !excluded.has(destination.name.toLocaleLowerCase()));
    const ranked = sortDestinationOptionsByRecommendationScore(source, options.months || []);
    const limit = options.limit || ranked.length;
    return ranked.slice(0, limit);
};

export const searchDestinationOptions = (
    query: string,
    options: DestinationSearchOptions = {}
): DestinationOption[] => {
    const normalizedQuery = normalizeDestinationKey(query);
    const excluded = new Set((options.excludeNames || []).map((name) => resolveDestinationName(name).toLocaleLowerCase()));
    const source = DESTINATION_OPTIONS.filter((destination) => !excluded.has(destination.name.toLocaleLowerCase()));
    const limit = options.limit || source.length;
    const normalizedMonths = normalizeMonths(options.months || []);

    if (!normalizedQuery) {
        return getRecommendedDestinationOptions({
            excludeNames: options.excludeNames,
            limit,
            months: normalizedMonths,
        });
    }

    const startsWithMatches = source.filter((destination) => {
        const tokens = getDestinationSearchTokens(destination);
        return tokens.some((token) => token.toLocaleLowerCase().startsWith(normalizedQuery));
    });

    const includesMatches = source.filter((destination) => {
        if (startsWithMatches.includes(destination)) return false;
        const haystack = getDestinationSearchTokens(destination)
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();
        return haystack.includes(normalizedQuery);
    });

    const rankedStartsWithMatches = sortDestinationOptionsByRecommendationScore(startsWithMatches, normalizedMonths);
    const rankedIncludesMatches = sortDestinationOptionsByRecommendationScore(includesMatches, normalizedMonths);
    const merged = [...rankedStartsWithMatches, ...rankedIncludesMatches];
    return merged.slice(0, limit);
};
