/**
 * Google My Maps (KML) to Recommendation conversion.
 *
 * Kept separate from the CLI so the mapping rules are testable without a
 * network call or a file on disk. Geocoding is injected for the same reason.
 */

import type { ActivityType } from '../../shared/activityTypes';
import {
    normalizeRecommendationTag,
    type CostBand,
    type GeocodePrecision,
    type Recommendation,
    type RecommendationSource,
    type TimeOfDay,
} from '../../shared/recommendations';

export interface KmlPlacemark {
    name: string;
    data: Record<string, string>;
}

/**
 * Source categories map onto the app taxonomy lossily in both directions, so
 * the raw category is also kept as a tag rather than being thrown away.
 */
export const CATEGORY_MAPPING: Record<string, { types: ActivityType[]; tags: string[] }> = {
    'food & drink': { types: ['food'], tags: ['food-drink'] },
    'sights & landmarks': { types: ['sightseeing'], tags: ['landmark'] },
    'nature & day trips': { types: ['nature'], tags: ['day-trip'] },
    'activities & experiences': { types: ['adventure'], tags: ['experience'] },
    'night market': { types: ['food', 'shopping'], tags: ['night-market'] },
    'shopping & souvenirs': { types: ['shopping'], tags: ['souvenirs'] },
    nightlife: { types: ['nightlife'], tags: ['nightlife'] },
};

/** Areas that name the whole country rather than a city. */
const COUNTRY_WIDE_AREAS = new Set(['taiwan', 'taiwan-wide', 'nationwide', 'various']);

export const slugifyRecommendation = (value: string): string => (
    value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 72)
);

/**
 * Pairs creator handles with their post URLs.
 *
 * A pin can cite several creators: the handles and the URLs are both
 * semicolon-separated but arrive in different orders, so they are matched by
 * finding the handle inside the URL path. A handle with no matching URL is
 * kept without one; a URL with no matching handle is dropped rather than
 * attributed to the wrong person.
 */
export const parseRecommendationSources = (
    rawHandles: string | undefined,
    rawUrls: string | undefined,
    capturedAt: string,
): RecommendationSource[] => {
    const handles = (rawHandles || '')
        .split(/[;,]/)
        .map((entry) => entry.trim().replace(/^@/, ''))
        .filter(Boolean);
    const urls = (rawUrls || '')
        .split(/[;\s]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.startsWith('http'));

    if (handles.length === 0 && urls.length === 0) return [];

    const unusedUrls = new Set(urls);
    const sources: RecommendationSource[] = handles.map((handle) => {
        const match = urls.find((url) => {
            if (!unusedUrls.has(url)) return false;
            try {
                return new URL(url).pathname.toLowerCase().split('/').includes(handle.toLowerCase());
            } catch {
                return false;
            }
        }) ?? null;
        if (match) unusedUrls.delete(match);
        return {
            kind: 'instagram' as const,
            handle: `@${handle}`,
            url: match,
            capturedAt,
        };
    });

    // A URL nobody claimed is still evidence, but it gets no handle attached.
    unusedUrls.forEach((url) => {
        sources.push({ kind: 'instagram', handle: null, url, capturedAt });
    });

    return sources;
};

const DURATION_PATTERN = /(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*(min|minute|hour|hr|h)\b/i;

/**
 * Reads what the free-text note actually says.
 *
 * The source category alone mis-types entries — a pin filed under "Sights &
 * Landmarks" whose note reads "Free 20-min hike" is a hike, and it is free.
 * These are proposals: the importer marks every row `in_review`.
 */
export const enrichFromNote = (note: string): {
    types: ActivityType[];
    tags: string[];
    costBand: CostBand | null;
    costNote: string | null;
    durationMinutes: number | null;
    bestTimeOfDay: TimeOfDay[] | null;
} => {
    const text = note.toLowerCase();
    const types: ActivityType[] = [];
    const tags: string[] = [];

    const addType = (type: ActivityType) => { if (!types.includes(type)) types.push(type); };
    const addTag = (tag: string) => { if (!tags.includes(tag)) tags.push(tag); };

    if (/\bhik(e|ing)\b|\btrail\b|\bsummit\b/.test(text)) addType('hiking');
    if (/\bbeach\b|\bsnorkel|\bdiving\b/.test(text)) addType('beach');
    if (/\bhot spring|\bspa\b|\bonsen\b/.test(text)) addType('relaxation');
    if (/\btemple\b|\bshrine\b|\bmuseum\b|\bheritage\b|\bhistoric/.test(text)) addType('culture');
    if (/\bwaterfall|\bmountain\b|\bforest\b|\bpark\b|\bgorge\b/.test(text)) addType('nature');
    if (/\bmichelin\b/.test(text)) addTag('michelin');
    if (/\bnight market\b/.test(text)) addTag('night-market');
    if (/\bsunrise\b/.test(text)) addTag('sunrise');
    if (/\bsunset\b|\bskyline\b|\bviewpoint\b|\bview of\b/.test(text)) addTag('viewpoint');
    if (/\bday trip\b/.test(text)) addTag('day-trip');

    let costBand: CostBand | null = null;
    let costNote: string | null = null;
    // "Free" has to be checked before the generic budget words, or a note
    // reading "Free 20-min hike" is filed as cheap rather than as free.
    if (/\bfree\b(?!\s*(wifi|wi-fi))/.test(text)) {
        costBand = 'free';
    } else if (/\bbudget|\bcheap\b|\baffordable\b|<\s*\$?\s*\d/.test(text)) {
        costBand = '$';
    } else if (/\bexpensive\b|\bupscale\b|\bfine dining\b|\bluxury\b/.test(text)) {
        costBand = '$$$';
    }
    const costMatch = note.match(/(?:NT\$|US\$|\$)\s?\d[\d,.]*(?:\s*(?:-|–|to)\s*(?:NT\$|US\$|\$)?\s?\d[\d,.]*)?/);
    if (costMatch) costNote = costMatch[0].trim();

    let durationMinutes: number | null = null;
    const durationMatch = note.match(DURATION_PATTERN);
    if (durationMatch) {
        const low = Number(durationMatch[1]);
        const high = durationMatch[2] ? Number(durationMatch[2]) : low;
        const unit = durationMatch[3].toLowerCase();
        const factor = unit.startsWith('h') ? 60 : 1;
        const value = Math.round(((low + high) / 2) * factor);
        if (Number.isFinite(value) && value > 0 && value <= 24 * 60) durationMinutes = value;
    }

    const bestTimeOfDay: TimeOfDay[] = [];
    if (/\bsunrise\b|\bbreakfast\b|\bmorning\b/.test(text)) bestTimeOfDay.push('morning');
    if (/\bsunset\b|\bevening\b/.test(text)) bestTimeOfDay.push('evening');
    if (/\bnight market\b|\bnightlife\b|\bbar\b|\bclub\b|\bnight\b/.test(text)) bestTimeOfDay.push('night');

    return {
        types,
        tags,
        costBand,
        costNote,
        durationMinutes,
        bestTimeOfDay: bestTimeOfDay.length > 0 ? bestTimeOfDay : null,
    };
};

const buildSummary = (note: string, title: string): string => {
    const trimmed = note.trim();
    if (!trimmed) return title;
    const firstClause = trimmed.split(/(?<=[.!?])\s|,\s(?=[A-Z])/)[0] || trimmed;
    return firstClause.length > 110 ? `${firstClause.slice(0, 107).trimEnd()}…` : firstClause;
};

export interface GeocodeResult {
    lat: number;
    lng: number;
    formattedAddress: string;
    precision: GeocodePrecision;
    googlePlaceId: string | null;
}

export const buildRecommendationFromPlacemark = ({
    placemark,
    countryCode,
    capturedAt,
    geocode,
    existingSlugs,
}: {
    placemark: KmlPlacemark;
    countryCode: string;
    capturedAt: string;
    geocode: GeocodeResult | null;
    existingSlugs: Set<string>;
}): Recommendation => {
    const title = placemark.name.trim();
    const note = (placemark.data.Notes || '').trim();
    const area = (placemark.data.Area || '').trim();
    const category = (placemark.data.Category || '').trim();

    const mapping = CATEGORY_MAPPING[category.toLowerCase()] ?? { types: ['general' as ActivityType], tags: [] };
    const enrichment = enrichFromNote(note);

    const activityTypes = Array.from(new Set([...mapping.types, ...enrichment.types]));
    const isCountryWide = COUNTRY_WIDE_AREAS.has(area.toLowerCase()) || !area;
    const tags = Array.from(new Set(
        [...mapping.tags, ...enrichment.tags, ...(isCountryWide ? [] : [area])]
            .map(normalizeRecommendationTag)
            .filter(Boolean),
    ));

    let slug = slugifyRecommendation(title) || slugifyRecommendation(`${category}-${area}`);
    if (existingSlugs.has(slug)) {
        let suffix = 2;
        while (existingSlugs.has(`${slug}-${suffix}`)) suffix += 1;
        slug = `${slug}-${suffix}`;
    }
    existingSlugs.add(slug);

    return {
        id: `rec_${countryCode.toLowerCase()}_${slug}`,
        slug,
        countryCode: countryCode.toUpperCase(),
        cityName: isCountryWide ? null : area,
        citySlug: isCountryWide ? null : slugifyRecommendation(area),
        location: {
            lat: geocode?.lat ?? null,
            lng: geocode?.lng ?? null,
            address: placemark.data.Location || null,
            formattedAddress: geocode?.formattedAddress ?? null,
            geocodePrecision: geocode?.precision ?? 'unknown',
            googlePlaceId: geocode?.googlePlaceId ?? null,
            geocodedAt: geocode ? capturedAt : null,
        },
        locale: 'en',
        title,
        summary: buildSummary(note, title),
        description: note || null,
        activityTypes,
        tags,
        costBand: enrichment.costBand,
        costNote: enrichment.costNote,
        typicalDurationMinutes: enrichment.durationMinutes,
        bestTimeOfDay: enrichment.bestTimeOfDay,
        // Instagram and Google Places imagery cannot be rehosted, so an imported
        // row carries attribution and no image until the media decision lands.
        image: null,
        origin: 'import',
        sources: parseRecommendationSources(placemark.data.Source, placemark.data.PostURL, capturedAt),
        likeCount: 0,
        qualityScore: null,
        // Nothing imported is published without a human pass.
        status: 'in_review',
    };
};

/** Minimal KML reader: the export is flat and regular, so a parser is enough. */
export const parseKmlPlacemarks = (kml: string): KmlPlacemark[] => {
    const placemarks: KmlPlacemark[] = [];
    const blocks = kml.split(/<Placemark>/).slice(1);

    blocks.forEach((block) => {
        const body = block.split('</Placemark>')[0] ?? '';
        const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
        const name = decodeXmlText(nameMatch?.[1] ?? '').trim();
        if (!name) return;

        const data: Record<string, string> = {};
        const dataPattern = /<Data name="([^"]+)">\s*<value>([\s\S]*?)<\/value>\s*<\/Data>/g;
        let match: RegExpExecArray | null = dataPattern.exec(body);
        while (match) {
            data[match[1]] = decodeXmlText(match[2]).trim();
            match = dataPattern.exec(body);
        }

        placemarks.push({ name, data });
    });

    return placemarks;
};

const decodeXmlText = (value: string): string => (
    value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
);
