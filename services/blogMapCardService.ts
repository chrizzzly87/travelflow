export interface BlogMapSpot {
    id: string;
    name: string;
    query: string;
    note?: string;
}

export interface BlogMapCategory {
    id: string;
    label: string;
    icon?: string;
    spots: BlogMapSpot[];
}

export interface BlogMapCenter {
    lat: number;
    lng: number;
}

export interface BlogMapCardConfig {
    title: string;
    description?: string;
    defaultCategoryId?: string;
    defaultSpotId?: string;
    regionContext?: string;
    mapCenter?: BlogMapCenter;
    mapZoom?: number;
    categories: BlogMapCategory[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => {
    return typeof value === 'object' && value !== null;
};

const toNonEmptyString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const toOptionalString = (value: unknown): string | undefined => {
    const parsed = toNonEmptyString(value);
    return parsed ?? undefined;
};

const toOptionalFiniteNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return value;
};

const parseMapCenter = (value: unknown): BlogMapCenter | undefined => {
    if (!isRecord(value)) return undefined;
    const lat = toOptionalFiniteNumber(value.lat);
    const lng = toOptionalFiniteNumber(value.lng);
    if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
    return { lat, lng };
};

const toSlug = (value: string): string => {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

const buildUniqueId = (preferred: string | undefined, fallbackLabel: string, usedIds: Set<string>): string => {
    const rawBase = preferred && preferred.length > 0 ? preferred : toSlug(fallbackLabel);
    const base = rawBase || 'item';

    if (!usedIds.has(base)) {
        usedIds.add(base);
        return base;
    }

    let attempt = 2;
    let candidate = `${base}-${attempt}`;
    while (usedIds.has(candidate)) {
        attempt += 1;
        candidate = `${base}-${attempt}`;
    }
    usedIds.add(candidate);
    return candidate;
};

const parseSpot = (value: unknown, usedIds: Set<string>, fallbackIndex: number): BlogMapSpot | null => {
    if (!isRecord(value)) return null;

    const name = toNonEmptyString(value.name);
    const query = toNonEmptyString(value.query);
    if (!name || !query) return null;

    const explicitId = toOptionalString(value.id);
    const id = buildUniqueId(explicitId ? toSlug(explicitId) : undefined, `${name}-${fallbackIndex}`, usedIds);

    return {
        id,
        name,
        query,
        note: toOptionalString(value.note),
    };
};

const parseCategory = (value: unknown, usedIds: Set<string>, fallbackIndex: number): BlogMapCategory | null => {
    if (!isRecord(value)) return null;

    const label = toNonEmptyString(value.label);
    if (!label) return null;

    const rawSpots = Array.isArray(value.spots) ? value.spots : [];
    const spotIds = new Set<string>();
    const spots = rawSpots
        .map((spot, index) => parseSpot(spot, spotIds, index))
        .filter((spot): spot is BlogMapSpot => Boolean(spot));

    if (spots.length === 0) return null;

    const explicitId = toOptionalString(value.id);
    const id = buildUniqueId(explicitId ? toSlug(explicitId) : undefined, `${label}-${fallbackIndex}`, usedIds);

    return {
        id,
        label,
        icon: toOptionalString(value.icon),
        spots,
    };
};

const includesCategoryId = (categories: BlogMapCategory[], targetId?: string): boolean => {
    if (!targetId) return false;
    return categories.some((category) => category.id === targetId);
};

const includesSpotId = (categories: BlogMapCategory[], targetId?: string): boolean => {
    if (!targetId) return false;
    return categories.some((category) => category.spots.some((spot) => spot.id === targetId));
};

export const parseBlogMapCardConfig = (rawJson: string): BlogMapCardConfig | null => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return null;
    }

    if (!isRecord(parsed)) return null;
    const title = toNonEmptyString(parsed.title);
    if (!title) return null;

    const rawCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
    const categoryIds = new Set<string>();
    const categories = rawCategories
        .map((category, index) => parseCategory(category, categoryIds, index))
        .filter((category): category is BlogMapCategory => Boolean(category));

    if (categories.length === 0) return null;

    const defaultCategoryCandidate = toOptionalString(parsed.defaultCategoryId);
    const defaultSpotCandidate = toOptionalString(parsed.defaultSpotId);

    return {
        title,
        description: toOptionalString(parsed.description),
        defaultCategoryId: includesCategoryId(categories, defaultCategoryCandidate) ? defaultCategoryCandidate : undefined,
        defaultSpotId: includesSpotId(categories, defaultSpotCandidate) ? defaultSpotCandidate : undefined,
        regionContext: toOptionalString(parsed.regionContext),
        mapCenter: parseMapCenter(parsed.mapCenter),
        mapZoom: toOptionalFiniteNumber(parsed.mapZoom),
        categories,
    };
};

interface GoogleMapsEmbedOptions {
    center?: BlogMapCenter;
    zoom?: number;
}

export const buildGoogleMapsEmbedUrl = (query: string, locale: string, options: GoogleMapsEmbedOptions = {}): string => {
    const params = new URLSearchParams({
        q: query,
        output: 'embed',
        hl: locale,
    });
    const center = options.center;
    if (center) {
        params.set('ll', `${center.lat},${center.lng}`);
    }
    if (typeof options.zoom === 'number' && Number.isFinite(options.zoom)) {
        params.set('z', String(Math.max(1, Math.min(20, Math.round(options.zoom)))));
    }
    return `https://maps.google.com/maps?${params.toString()}`;
};

export const buildGoogleMapsCategoryQuery = (spots: BlogMapSpot[], regionContext?: string): string => {
    const suffix = (regionContext || '').trim();
    const spotQueries = spots
        .map((spot) => {
            const query = spot.query.trim();
            if (!query) return '';
            return suffix.length > 0 ? `${query}, ${suffix}` : query;
        })
        .filter((query) => query.length > 0);

    if (spotQueries.length === 0) return '';
    if (spotQueries.length === 1) return spotQueries[0];

    return spotQueries.map((query) => `(${query})`).join(' OR ');
};

export const buildGoogleMapsSearchUrl = (query: string): string => {
    const params = new URLSearchParams({
        api: '1',
        query,
    });
    return `https://www.google.com/maps/search/?${params.toString()}`;
};
