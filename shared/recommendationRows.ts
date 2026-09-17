/**
 * The boundary between the `recommendations` table and the app's own shape.
 *
 * Kept in one place because four callers cross it — the public read endpoint,
 * the admin endpoint, the seeding script and the client — and a column renamed
 * in only three of them is a silent data loss rather than a type error.
 *
 * Reading is deliberately forgiving: a row written by hand in the SQL editor,
 * or by an older version of the admin, must still render. Writing is strict.
 */

import {
    COST_BAND_VALUES,
    type CostBand,
    type GeocodePrecision,
    type Recommendation,
    type RecommendationImage,
    type RecommendationOrigin,
    type RecommendationSource,
    type RecommendationStatus,
    type TimeOfDay,
} from './recommendations';
import type { ActivityType } from './activityTypes';

export interface RecommendationRow {
    id: string;
    slug: string;
    country_code: string;
    city_name: string | null;
    city_slug: string | null;
    lat: number | null;
    lng: number | null;
    address: string | null;
    formatted_address: string | null;
    geocode_precision: string | null;
    google_place_id: string | null;
    geocoded_at: string | null;
    locale: string | null;
    title: string;
    summary: string | null;
    description: string | null;
    highlights: unknown;
    activity_types: unknown;
    tags: unknown;
    cost_band: string | null;
    cost_note: string | null;
    typical_duration_minutes: number | null;
    best_time_of_day: unknown;
    image: unknown;
    origin: string | null;
    sources: unknown;
    like_count: number | null;
    quality_score: number | null;
    status: string | null;
}

export const RECOMMENDATION_ROW_COLUMNS = [
    'id', 'slug', 'country_code', 'city_name', 'city_slug',
    'lat', 'lng', 'address', 'formatted_address', 'geocode_precision', 'google_place_id', 'geocoded_at',
    'locale', 'title', 'summary', 'description', 'highlights', 'activity_types', 'tags',
    'cost_band', 'cost_note', 'typical_duration_minutes', 'best_time_of_day',
    'image', 'origin', 'sources', 'like_count', 'quality_score', 'status',
] as const;

const STATUS_VALUES: readonly RecommendationStatus[] = ['draft', 'in_review', 'published', 'rejected', 'retired'];
const ORIGIN_VALUES: readonly RecommendationOrigin[] = ['import', 'manual', 'ai', 'user_submission'];
const PRECISION_VALUES: readonly GeocodePrecision[] = ['rooftop', 'exact', 'approximate', 'city', 'country', 'unknown'];
const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
const SOURCE_KINDS = ['instagram', 'google_maps', 'web', 'editorial', 'ai', 'user'] as const;
const IMAGE_PROVIDERS = ['google_places', 'instagram', 'generated', 'upload', 'stock'] as const;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback
);

/** A jsonb column can arrive as an array, as a JSON string, or as null. */
const toArray = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }
    return [];
};

const toObject = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, unknown>
                : null;
        } catch { return null; }
    }
    return null;
};

const toStrings = (value: unknown): string[] => toArray(value)
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());

const toNumberOrNull = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    // PostgREST returns `numeric` as a string, which would otherwise become NaN.
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const toSources = (value: unknown): RecommendationSource[] => toArray(value)
    .map((entry) => toObject(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
        kind: oneOf(entry.kind, SOURCE_KINDS, 'web'),
        handle: typeof entry.handle === 'string' ? entry.handle : null,
        url: typeof entry.url === 'string' ? entry.url : null,
        capturedAt: typeof entry.capturedAt === 'string' ? entry.capturedAt : null,
    }));

const toImage = (value: unknown): RecommendationImage | null => {
    const raw = toObject(value);
    if (!raw || typeof raw.url !== 'string' || !raw.url.trim()) return null;
    return {
        url: raw.url,
        provider: oneOf(raw.provider, IMAGE_PROVIDERS, 'google_places'),
        attribution: typeof raw.attribution === 'string' ? raw.attribution : null,
        authorUrl: typeof raw.authorUrl === 'string' ? raw.authorUrl : null,
        blurhash: typeof raw.blurhash === 'string' ? raw.blurhash : null,
    };
};

export const rowToRecommendation = (row: RecommendationRow): Recommendation => {
    const highlights = toStrings(row.highlights);
    const bestTimeOfDay = toArray(row.best_time_of_day)
        .filter((entry): entry is TimeOfDay => (
            typeof entry === 'string' && (TIME_OF_DAY_VALUES as readonly string[]).includes(entry)
        ));

    return {
        id: row.id,
        slug: row.slug,
        countryCode: (row.country_code || '').toUpperCase(),
        cityName: row.city_name ?? null,
        citySlug: row.city_slug ?? null,
        location: {
            lat: toNumberOrNull(row.lat),
            lng: toNumberOrNull(row.lng),
            address: row.address ?? null,
            formattedAddress: row.formatted_address ?? null,
            geocodePrecision: oneOf(row.geocode_precision, PRECISION_VALUES, 'unknown'),
            googlePlaceId: row.google_place_id ?? null,
            geocodedAt: row.geocoded_at ?? null,
        },
        locale: row.locale || 'en',
        title: row.title,
        summary: row.summary ?? '',
        description: row.description ?? null,
        highlights: highlights.length > 0 ? highlights : undefined,
        activityTypes: toStrings(row.activity_types) as ActivityType[],
        tags: toStrings(row.tags),
        costBand: oneOfOrNull(row.cost_band, COST_BAND_VALUES),
        costNote: row.cost_note ?? null,
        typicalDurationMinutes: toNumberOrNull(row.typical_duration_minutes),
        bestTimeOfDay: bestTimeOfDay.length > 0 ? bestTimeOfDay : null,
        image: toImage(row.image),
        origin: oneOf(row.origin, ORIGIN_VALUES, 'manual'),
        sources: toSources(row.sources),
        likeCount: toNumberOrNull(row.like_count) ?? 0,
        qualityScore: toNumberOrNull(row.quality_score),
        status: oneOf(row.status, STATUS_VALUES, 'draft'),
    };
};

function oneOfOrNull<T extends string>(value: unknown, allowed: readonly T[]): T | null {
    return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : null;
}

export const recommendationToRow = (recommendation: Recommendation): Omit<RecommendationRow, 'id'> & { id: string } => ({
    id: recommendation.id,
    slug: recommendation.slug,
    country_code: recommendation.countryCode.toUpperCase(),
    city_name: recommendation.cityName,
    city_slug: recommendation.citySlug,
    lat: recommendation.location.lat,
    lng: recommendation.location.lng,
    address: recommendation.location.address,
    formatted_address: recommendation.location.formattedAddress,
    geocode_precision: recommendation.location.geocodePrecision,
    google_place_id: recommendation.location.googlePlaceId,
    geocoded_at: recommendation.location.geocodedAt,
    locale: recommendation.locale,
    title: recommendation.title,
    summary: recommendation.summary,
    description: recommendation.description,
    highlights: recommendation.highlights ?? [],
    activity_types: recommendation.activityTypes,
    tags: recommendation.tags,
    cost_band: recommendation.costBand,
    cost_note: recommendation.costNote,
    typical_duration_minutes: recommendation.typicalDurationMinutes,
    best_time_of_day: recommendation.bestTimeOfDay,
    image: recommendation.image,
    origin: recommendation.origin,
    sources: recommendation.sources,
    like_count: recommendation.likeCount,
    quality_score: recommendation.qualityScore,
    status: recommendation.status,
});

export interface RecommendationDraftError { error: string }

/**
 * Validates what an editor typed before it reaches the table.
 *
 * The check constraints would catch most of this, but a Postgres constraint
 * violation reaches the editor as an opaque string. The point here is to say
 * which field is wrong, in a sentence.
 */
export const validateRecommendationDraft = (
    input: unknown,
): { row: Omit<RecommendationRow, 'id'> & { id: string } } | RecommendationDraftError => {
    const body = toObject(input);
    if (!body) return { error: 'A recommendation object is required.' };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return { error: 'A title is required.' };

    const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(countryCode)) return { error: 'A two-letter country code is required.' };

    const slug = (typeof body.slug === 'string' && body.slug.trim() ? body.slug : title)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    if (!slug) return { error: 'The title must contain at least one letter or digit.' };

    const status = oneOfOrNull(body.status, STATUS_VALUES);
    if (body.status !== undefined && !status) return { error: 'Status must be one of draft, in review, published, rejected or retired.' };

    const costBand = body.costBand === null || body.costBand === undefined
        ? null
        : oneOfOrNull(body.costBand, COST_BAND_VALUES);
    if (body.costBand && !costBand) return { error: 'Cost must be free, $, $$, $$$ or $$$$.' };

    const lat = toNumberOrNull(body.lat ?? toObject(body.location)?.lat);
    const lng = toNumberOrNull(body.lng ?? toObject(body.location)?.lng);
    if (lat !== null && (lat < -90 || lat > 90)) return { error: 'Latitude must be between -90 and 90.' };
    if (lng !== null && (lng < -180 || lng > 180)) return { error: 'Longitude must be between -180 and 180.' };

    const duration = toNumberOrNull(body.typicalDurationMinutes);
    if (duration !== null && (duration < 0 || duration > 60 * 24 * 14)) {
        return { error: 'Typical duration must be between 0 minutes and two weeks.' };
    }

    const id = typeof body.id === 'string' && body.id.trim()
        ? body.id.trim()
        : `rec_${countryCode.toLowerCase()}_${slug}`;

    return {
        row: {
            id,
            slug,
            country_code: countryCode,
            city_name: typeof body.cityName === 'string' && body.cityName.trim() ? body.cityName.trim() : null,
            city_slug: typeof body.citySlug === 'string' && body.citySlug.trim() ? body.citySlug.trim() : null,
            lat,
            lng,
            address: typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null,
            formatted_address: typeof body.formattedAddress === 'string' && body.formattedAddress.trim()
                ? body.formattedAddress.trim()
                : null,
            geocode_precision: oneOf(body.geocodePrecision, PRECISION_VALUES, 'unknown'),
            google_place_id: typeof body.googlePlaceId === 'string' && body.googlePlaceId.trim()
                ? body.googlePlaceId.trim()
                : null,
            geocoded_at: typeof body.geocodedAt === 'string' && body.geocodedAt.trim() ? body.geocodedAt.trim() : null,
            locale: typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : 'en',
            title,
            summary: typeof body.summary === 'string' ? body.summary.trim() : '',
            description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
            highlights: toStrings(body.highlights),
            activity_types: toStrings(body.activityTypes),
            tags: toStrings(body.tags),
            cost_band: costBand,
            cost_note: typeof body.costNote === 'string' && body.costNote.trim() ? body.costNote.trim() : null,
            typical_duration_minutes: duration === null ? null : Math.round(duration),
            best_time_of_day: toStrings(body.bestTimeOfDay).filter(
                (entry) => (TIME_OF_DAY_VALUES as readonly string[]).includes(entry),
            ),
            image: toImage(body.image),
            origin: oneOf(body.origin, ORIGIN_VALUES, 'manual'),
            sources: toSources(body.sources),
            like_count: Math.max(0, Math.round(toNumberOrNull(body.likeCount) ?? 0)),
            quality_score: toNumberOrNull(body.qualityScore),
            status: status ?? 'draft',
        },
    };
};
