import type { Recommendation } from '../../shared/recommendations';

/** Neighbourhood-level: streets and a district name, not a single roof. */
export const DEFAULT_CARD_MAP_ZOOM = 14;

/**
 * Builds the static map shown on every card.
 *
 * Reuses the trip map preview endpoint, which already keeps the provider key
 * server-side and caches at the edge; a single coordinate renders as one
 * marker on a clean basemap.
 */
export const buildRecommendationMapUrl = (
    recommendation: Recommendation,
    options: { width?: number; height?: number; scale?: 1 | 2; zoom?: number } = {},
): string | null => {
    const { lat, lng } = recommendation.location;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const params = new URLSearchParams();
    params.set('coords', `${lat.toFixed(6)},${lng.toFixed(6)}`);
    params.set('style', 'standard');
    params.set('routeMode', 'simple');
    params.set('colorMode', 'brand');
    params.set('w', String(options.width ?? 320));
    params.set('h', String(options.height ?? 320));
    params.set('scale', String(options.scale ?? 2));
    // A single pin fitted automatically frames the rooftop and nothing else.
    // Around 14 shows the surrounding blocks, which is what makes the map
    // answer "where is this" rather than "what shape is this building".
    params.set('zoom', String(options.zoom ?? DEFAULT_CARD_MAP_ZOOM));

    return `/api/trip-map-preview?${params.toString()}`;
};

export const buildRecommendationPhotoUrl = (
    recommendation: Recommendation,
    width = 800,
): string | null => {
    const image = recommendation.image;
    if (!image?.url) return null;
    if (!image.url.startsWith('/api/place-photo')) return image.url;
    return `${image.url}&w=${width}`;
};
