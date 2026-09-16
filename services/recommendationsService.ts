/**
 * Reads the bundled recommendation datasets.
 *
 * The datasets ship in the repo the same way `destinationGuides.json` does, so
 * the deck works without a Supabase round trip. When the recommendation tables
 * land (see `docs/RECOMMENDATIONS_MODEL_PLAN.md`), this module becomes the
 * place where the fetch replaces the import — nothing above it needs to know.
 */

import type { ActivityType } from '../shared/activityTypes';
import type { Recommendation, RecommendationDataset } from '../shared/recommendations';

const DATASET_LOADERS: Record<string, () => Promise<RecommendationDataset>> = {
    TW: () => import('../data/recommendations/tw.json').then((module) => module.default as RecommendationDataset),
};

const datasetCache = new Map<string, Promise<RecommendationDataset | null>>();

export const hasRecommendationsForCountry = (countryCode: string | null | undefined): boolean => (
    Boolean(countryCode) && countryCode!.toUpperCase() in DATASET_LOADERS
);

export const loadRecommendationDataset = (
    countryCode: string,
): Promise<RecommendationDataset | null> => {
    const key = countryCode.toUpperCase();
    const cached = datasetCache.get(key);
    if (cached) return cached;

    const loader = DATASET_LOADERS[key];
    const promise: Promise<RecommendationDataset | null> = loader
        ? loader().catch(() => null)
        : Promise.resolve(null);
    datasetCache.set(key, promise);
    return promise;
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
