/**
 * Turning a Google Places record into what a recommendation card needs.
 *
 * Kept out of the script so the choices that decide what a traveller actually
 * sees — which photo, which price band — are testable rather than buried in a
 * one-off CLI.
 */

import type { CostBand } from '../../shared/recommendations';

export interface PlacePhoto {
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
}

/**
 * The widest aspect that still crops well into a card hero, and the narrowest
 * that is not a portrait phone snap. A card shows a 16:9-ish band, so a tall
 * photo arrives as a centre crop of somebody's ceiling.
 */
const MIN_ASPECT = 1.1;
const MAX_ASPECT = 2.6;
const PREFERRED_MIN_WIDTH = 1200;

/**
 * Google returns a place's photos in its own order, and the first one is the
 * representative shot — the night market's lit arch rather than a stranger's
 * picture of a temple two streets away. Ordering therefore carries more weight
 * than anything measurable about the file, and the rest only breaks ties.
 */
const POSITION_WEIGHT = 90;
const POSITION_DECAY = 12;

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '');

/**
 * Does this photo come from the business itself?
 *
 * A merchant's own photos are the dish and the storefront it wants to be known
 * for — the soup dumplings rather than a stranger's picture of the queue. It is
 * the single best signal available without looking at the pixels.
 */
export const isMerchantPhoto = (photo: PlacePhoto, placeNames: string[]): boolean => {
    const author = photo.authorAttributions?.[0]?.displayName;
    if (!author) return false;
    const a = normalize(author);
    if (!a) return false;
    // Several spellings, because the venue posts under its Chinese name while
    // the dataset carries the English one, and neither contains the other.
    return placeNames.some((name) => {
        const b = normalize(name);
        if (!b || b.length < 3) return false;
        return a.includes(b) || b.includes(a);
    });
};

export const scorePhoto = (photo: PlacePhoto, placeNames: string[], index = 0): number => {
    if (!photo.name) return -Infinity;
    const width = photo.widthPx ?? 0;
    const height = photo.heightPx ?? 0;
    if (width <= 0 || height <= 0) return -Infinity;

    let score = POSITION_WEIGHT - index * POSITION_DECAY;

    // A card crops to a wide band, so a portrait arrives as a centre slice of
    // somebody's ceiling. That is worth avoiding even at the top of the list.
    const aspect = width / height;
    if (aspect >= MIN_ASPECT && aspect <= MAX_ASPECT) score += 20;
    else if (aspect < MIN_ASPECT) score -= 60 * (MIN_ASPECT - aspect);
    else score -= 15 * (aspect - MAX_ASPECT);

    if (width >= PREFERRED_MIN_WIDTH) score += 20;
    // Beyond a point more pixels buy nothing, so resolution is a tiebreak only.
    score += Math.min(width, 4000) / 400;

    // The strongest signal available without looking at the pixels, and the
    // one that decides between a brand shot of the dish and a diner's snapshot
    // of their own table, timestamp and all.
    if (isMerchantPhoto(photo, placeNames)) score += 45;

    return score;
};

export const pickBestPhoto = (photos: PlacePhoto[], placeNames: string[]): PlacePhoto | null => {
    let best: PlacePhoto | null = null;
    let bestScore = -Infinity;
    photos.forEach((photo, index) => {
        const score = scorePhoto(photo, placeNames, index);
        if (score > bestScore) {
            bestScore = score;
            best = photo;
        }
    });
    return bestScore === -Infinity ? null : best;
};

const PRICE_LEVEL_TO_BAND: Record<string, CostBand> = {
    PRICE_LEVEL_FREE: 'free',
    PRICE_LEVEL_INEXPENSIVE: '$',
    PRICE_LEVEL_MODERATE: '$$',
    PRICE_LEVEL_EXPENSIVE: '$$$',
    PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

export const toCostBand = (priceLevel: string | undefined): CostBand | null => (
    priceLevel ? PRICE_LEVEL_TO_BAND[priceLevel] ?? null : null
);

/**
 * The search term used when the stored place id no longer resolves.
 *
 * The titles carry a Chinese name in brackets, which is the strongest part of
 * the query in Taiwan; the English transliteration alone matches the wrong
 * branch or nothing at all.
 */
export const buildPlaceSearchQuery = (title: string, cityName: string | null): string => {
    const bracketed = title.match(/[（(]([^）)]+)[）)]/)?.[1]?.trim();
    const plain = title.replace(/[（(][^）)]*[）)]/g, '').trim();
    const name = bracketed && /[一-鿿]/.test(bracketed) ? `${plain} ${bracketed}` : plain;
    return [name, cityName, 'Taiwan'].filter(Boolean).join(' ');
};

/** Every spelling a photo's attribution might match: English, Chinese, bare. */
export const collectPlaceNames = (title: string, placeDisplayName: string | undefined): string[] => {
    const bracketed = title.match(/[（(]([^）)]+)[）)]/)?.[1]?.trim();
    const plain = title.replace(/[（(][^）)]*[）)]/g, '').trim();
    return [placeDisplayName, title, plain, bracketed]
        .filter((value): value is string => Boolean(value && value.trim()));
};
