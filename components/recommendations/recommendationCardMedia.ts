import type { Recommendation } from '../../shared/recommendations';

/**
 * Builds the static map shown on every card.
 *
 * Reuses the trip map preview endpoint, which already keeps the provider key
 * server-side and caches at the edge; a single coordinate renders as one
 * marker on a clean basemap.
 */
export const buildRecommendationMapUrl = (
    recommendation: Recommendation,
    options: { width?: number; height?: number; scale?: 1 | 2 } = {},
): string | null => {
    const { lat, lng } = recommendation.location;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const params = new URLSearchParams();
    params.set('coords', `${lat.toFixed(6)},${lng.toFixed(6)}`);
    params.set('style', 'clean');
    params.set('routeMode', 'simple');
    params.set('colorMode', 'brand');
    params.set('w', String(options.width ?? 320));
    params.set('h', String(options.height ?? 320));
    params.set('scale', String(options.scale ?? 2));

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
