/**
 * Reads the recommendation library.
 *
 * The library lives in Supabase and is maintained in the admin, so a
 * correction is a save rather than a deploy. The repo dataset is still here as
 * a seed and a fallback: if the endpoint is unreachable — a preview without
 * environment variables, an outage, a country not yet migrated — the deck
 * shows yesterday's copy instead of nothing.
 *
 * `docs/RECOMMENDATIONS_CONTENT_RUNBOOK.md` is the operational side of this.
 */

import type { ActivityType } from '../shared/activityTypes';
import type { Recommendation, RecommendationDataset } from '../shared/recommendations';

/** Countries with a bundled fallback copy. The database may hold more. */
const DATASET_LOADERS: Record<string, () => Promise<RecommendationDataset>> = {
    TW: () => import('../data/recommendations/tw.json').then((module) => module.default as RecommendationDataset),
};

const datasetCache = new Map<string, Promise<RecommendationDataset | null>>();

export const hasRecommendationsForCountry = (countryCode: string | null | undefined): boolean => (
    Boolean(countryCode) && countryCode!.toUpperCase() in DATASET_LOADERS
);

const loadBundledDataset = (countryCode: string): Promise<RecommendationDataset | null> => {
    const loader = DATASET_LOADERS[countryCode];
    return loader ? loader().catch(() => null) : Promise.resolve(null);
};

/**
 * Asks the API first, and only reaches for the bundled copy when it cannot
 * answer. An empty published list is a real answer — a country whose rows are
 * all still drafts has no ideas yet, and falling back there would show a
 * traveller entries an editor deliberately unpublished.
 */
const fetchPublishedDataset = async (countryCode: string): Promise<RecommendationDataset | null> => {
    if (typeof fetch !== 'function') return null;
    try {
        const response = await fetch(`/api/recommendations?country=${encodeURIComponent(countryCode)}`, {
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) return null;
        const payload = await response.json() as {
            ok?: boolean;
            recommendations?: Recommendation[];
        };
        if (!payload?.ok || !Array.isArray(payload.recommendations)) return null;
        return {
            countryCode,
            countryName: '',
            generatedAt: new Date().toISOString(),
            sourceName: 'supabase',
            recommendations: payload.recommendations,
        };
    } catch {
        return null;
    }
};

export const loadRecommendationDataset = (
    countryCode: string,
): Promise<RecommendationDataset | null> => {
    const key = countryCode.toUpperCase();
    const cached = datasetCache.get(key);
    if (cached) return cached;

    const promise = fetchPublishedDataset(key)
        .then((dataset) => dataset ?? loadBundledDataset(key))
        .catch(() => loadBundledDataset(key));
    datasetCache.set(key, promise);
    return promise;
};

/** Testing seam: the module-level cache would otherwise leak between cases. */
export const __resetRecommendationDatasetCache = (): void => {
    datasetCache.clear();
};

export interface RecommendationDeckFilters {
    /** Only these cities; empty means every city in the dataset. */
    cityNames?: string[];
    activityTypes?: ActivityType[];
    /** Recommendation ids the traveller has already saved or dismissed. */
    excludeIds?: Iterable<string>;
}

const matchesCity = (recommendation: Recommendation, cityNames: string[]): boolean => {
    // A country-wide entry is relevant to every trip in that country.
    if (!recommendation.cityName) return true;
    if (cityNames.length === 0) return true;
    const city = recommendation.cityName.toLowerCase();
    return cityNames.some((name) => {
        const candidate = name.toLowerCase();
        return candidate === city || candidate.includes(city) || city.includes(candidate);
    });
};

/**
 * Orders the deck.
 *
 * A card the traveller can act on comes first: something with coordinates can
 * be placed on the map, and something matching one of their cities is relevant
 * now. Everything else is a tiebreak, kept stable so the order does not shuffle
 * between renders.
 */
const scoreRecommendation = (recommendation: Recommendation, cityNames: string[]): number => {
    let score = recommendation.qualityScore ?? 0;
    if (recommendation.location.lat !== null) score += 6;
    if (recommendation.location.geocodePrecision === 'rooftop') score += 2;
    if (recommendation.cityName && matchesCity(recommendation, cityNames)) score += 5;
    if (recommendation.description) score += 2;
    if (recommendation.costBand) score += 1;
    if (recommendation.sources.length > 1) score += 1;
    score += Math.min(recommendation.likeCount, 10) * 0.1;
    return score;
};

export const buildRecommendationDeck = (
    dataset: RecommendationDataset | null,
    filters: RecommendationDeckFilters = {},
): Recommendation[] => {
    if (!dataset) return [];

    const cityNames = (filters.cityNames ?? []).filter(Boolean);
    const activityTypes = filters.activityTypes ?? [];
    const excluded = new Set(filters.excludeIds ?? []);

    return dataset.recommendations
        .filter((recommendation) => recommendation.status !== 'rejected' && recommendation.status !== 'retired')
        .filter((recommendation) => !excluded.has(recommendation.id))
        .filter((recommendation) => matchesCity(recommendation, cityNames))
        .filter((recommendation) => (
            activityTypes.length === 0
            || recommendation.activityTypes.some((type) => activityTypes.includes(type))
        ))
        .map((recommendation, index) => ({ recommendation, index }))
        .sort((left, right) => {
            const delta = scoreRecommendation(right.recommendation, cityNames)
                - scoreRecommendation(left.recommendation, cityNames);
            return delta !== 0 ? delta : left.index - right.index;
        })
        .map((entry) => entry.recommendation);
};

export const collectDeckActivityTypes = (recommendations: Recommendation[]): ActivityType[] => {
    const seen = new Set<ActivityType>();
    recommendations.forEach((recommendation) => {
        recommendation.activityTypes.forEach((type) => seen.add(type));
    });
    return Array.from(seen);
};
