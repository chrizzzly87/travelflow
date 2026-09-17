/**
 * Place recommendations: a shared library of "worth going" entries that a
 * traveller triages onto a trip.
 *
 * A recommendation is a library row — editorially owned, published or retired
 * centrally. A timeline item is a copy owned by one trip. Assigning copies the
 * content across; a trip never points at a library row an editor can retire.
 *
 * The full model, its storage plan and the open questions live in
 * `docs/RECOMMENDATIONS_MODEL_PLAN.md`.
 */

import type { ActivityType } from './activityTypes';

export type RecommendationStatus = 'draft' | 'in_review' | 'published' | 'rejected' | 'retired';
export type RecommendationOrigin = 'import' | 'manual' | 'ai' | 'user_submission';
export type CostBand = 'free' | '$' | '$$' | '$$$' | '$$$$';
export type GeocodePrecision = 'rooftop' | 'exact' | 'approximate' | 'city' | 'country' | 'unknown';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type RecommendationReactionKind = 'save' | 'dismiss';

export const COST_BAND_VALUES: readonly CostBand[] = ['free', '$', '$$', '$$$', '$$$$'];

export interface RecommendationLocation {
    lat: number | null;
    lng: number | null;
    /** The address exactly as the source gave it. */
    address: string | null;
    /** What the geocoder resolved it to, kept so a bad match is auditable. */
    formattedAddress: string | null;
    geocodePrecision: GeocodePrecision;
    /** Provider id kept as a mapping, never as a canonical identity. */
    googlePlaceId: string | null;
    geocodedAt: string | null;
}

export interface RecommendationSource {
    kind: 'instagram' | 'google_maps' | 'web' | 'editorial' | 'ai' | 'user';
    handle: string | null;
    url: string | null;
    capturedAt: string | null;
}

export interface RecommendationImage {
    url: string;
    provider: 'google_places' | 'instagram' | 'generated' | 'upload' | 'stock';
    attribution: string | null;
    authorUrl: string | null;
    blurhash: string | null;
}

export interface Recommendation {
    id: string;
    slug: string;

    countryCode: string;
    cityName: string | null;
    citySlug: string | null;
    location: RecommendationLocation;

    locale: string;
    title: string;
    summary: string;
    description: string | null;
    /**
     * Short "what to do here" lines — the dishes worth ordering, the viewpoint
     * worth the detour. Rendered as bullets under the description, which is why
     * they are kept apart from it rather than being prose.
     */
    highlights?: string[];
    activityTypes: ActivityType[];
    tags: string[];

    costBand: CostBand | null;
    costNote: string | null;
    typicalDurationMinutes: number | null;
    bestTimeOfDay: TimeOfDay[] | null;

    image: RecommendationImage | null;

    origin: RecommendationOrigin;
    sources: RecommendationSource[];

    likeCount: number;
    qualityScore: number | null;

    status: RecommendationStatus;
}

/**
 * A recommendation the traveller kept, before it has a day.
 *
 * Stored on the trip rather than in a separate table: a trip already persists
 * as a JSON document, and the pool is worthless without the trip it belongs to.
 * The content is copied, not referenced, so retiring the library row leaves a
 * saved idea intact.
 */
export interface SavedRecommendation {
    recommendationId: string;
    savedAt: string;
    title: string;
    summary: string;
    description: string | null;
    highlights?: string[];
    activityTypes: ActivityType[];
    tags: string[];
    cityName: string | null;
    image?: RecommendationImage | null;
    location: { lat: number | null; lng: number | null; address: string | null };
    costBand: CostBand | null;
    typicalDurationMinutes: number | null;
    sources: RecommendationSource[];
}

export interface RecommendationDataset {
    countryCode: string;
    countryName: string;
    generatedAt: string;
    sourceName: string | null;
    recommendations: Recommendation[];
}

const COST_BAND_SET = new Set<string>(COST_BAND_VALUES);

export const parseCostBand = (value: unknown): CostBand | null => (
    typeof value === 'string' && COST_BAND_SET.has(value) ? value as CostBand : null
);

export const formatCostBandLabel = (band: CostBand | null): string | null => {
    if (!band) return null;
    return band === 'free' ? 'Free' : band;
};

/** Normalizes a tag for storage and search: lowercase, hyphenated, deduped by caller. */
export const normalizeRecommendationTag = (value: string): string => (
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48)
);

const DEFAULT_ACTIVITY_MINUTES = 90;
const MINUTES_PER_DAY = 60 * 24;

/**
 * Turns a kept recommendation into the timeline item a day will own.
 *
 * The content is copied rather than referenced: a library row can be retired
 * centrally, and a trip that already planned around it must not change.
 */
export const buildActivityFromSavedRecommendation = (
    saved: SavedRecommendation,
    dayOffset: number,
): {
    title: string;
    description: string;
    startDateOffset: number;
    duration: number;
    activityType: ActivityType[];
    location?: string;
    coordinates?: { lat: number; lng: number };
} => {
    const minutes = saved.typicalDurationMinutes && saved.typicalDurationMinutes > 0
        ? saved.typicalDurationMinutes
        : DEFAULT_ACTIVITY_MINUTES;
    const hasCoordinates = typeof saved.location.lat === 'number'
        && typeof saved.location.lng === 'number'
        && Number.isFinite(saved.location.lat)
        && Number.isFinite(saved.location.lng);

    return {
        title: saved.title,
        description: saved.description || saved.summary || '',
        startDateOffset: dayOffset,
        duration: minutes / MINUTES_PER_DAY,
        activityType: [...saved.activityTypes],
        location: saved.location.address || saved.cityName || undefined,
        coordinates: hasCoordinates
            ? { lat: saved.location.lat as number, lng: saved.location.lng as number }
            : undefined,
    };
};

export const toSavedRecommendation = (
    recommendation: Recommendation,
    savedAt: string,
): SavedRecommendation => ({
    recommendationId: recommendation.id,
    savedAt,
    title: recommendation.title,
    summary: recommendation.summary,
    description: recommendation.description,
    highlights: recommendation.highlights ? [...recommendation.highlights] : undefined,
    activityTypes: [...recommendation.activityTypes],
    tags: [...recommendation.tags],
    cityName: recommendation.cityName,
    // Kept so the pool still shows a picture when the library is not loaded.
    image: recommendation.image,
    location: {
        lat: recommendation.location.lat,
        lng: recommendation.location.lng,
        address: recommendation.location.formattedAddress ?? recommendation.location.address,
    },
    costBand: recommendation.costBand,
    typicalDurationMinutes: recommendation.typicalDurationMinutes,
    sources: recommendation.sources.map((source) => ({ ...source })),
});

/**
 * Rebuilds a card-shaped record from what a trip kept.
 *
 * The kept pool stores a copy, not a reference, so a saved idea has to be
 * displayable on its own — the library row may be retired, or simply not
 * loaded yet. Everything the copy does not carry degrades to empty.
 */
export const savedToRecommendation = (saved: SavedRecommendation): Recommendation => ({
    id: saved.recommendationId,
    slug: saved.recommendationId,
    countryCode: '',
    cityName: saved.cityName,
    citySlug: null,
    location: {
        lat: saved.location.lat,
        lng: saved.location.lng,
        address: saved.location.address,
        formattedAddress: saved.location.address,
        geocodePrecision: 'unknown',
        googlePlaceId: null,
        geocodedAt: null,
    },
    locale: 'en',
    title: saved.title,
    summary: saved.summary,
    description: saved.description,
    highlights: saved.highlights,
    activityTypes: [...saved.activityTypes],
    tags: [...saved.tags],
    costBand: saved.costBand,
    costNote: null,
    typicalDurationMinutes: saved.typicalDurationMinutes,
    bestTimeOfDay: null,
    image: saved.image ?? null,
    origin: 'import',
    sources: saved.sources.map((source) => ({ ...source })),
    likeCount: 0,
    qualityScore: null,
    status: 'published',
});
