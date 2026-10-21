/**
 * Google My Maps, in and out.
 *
 * My Maps has no public API. What it does have is KML: every map shared as
 * "anyone with the link" is downloadable from a stable URL, and every map can
 * import a KML file. Both directions of the feature are built on that and
 * nothing else.
 *
 * Import lands pins in the trip's kept ideas rather than on days. A map is a
 * wish list — dozens of places with no dates — and dropping them all onto the
 * calendar would bury the plan.
 *
 * Read `docs/GOOGLE_MY_MAPS.md` before changing the mapping.
 */

import { normalizeActivityTypes, type ActivityType } from './activityTypes';
import {
    normalizeRecommendationTag,
    type RecommendationSource,
    type SavedRecommendation,
} from './recommendations';

export interface MyMapsPlacemark {
    name: string;
    address: string | null;
    /** Plain text: the HTML My Maps writes into descriptions is flattened. */
    description: string | null;
    coordinates: { lat: number; lng: number } | null;
    /** The layer the pin sits in, which My Maps writes as a KML folder. */
    folder: string | null;
    /** The table columns of the layer, as written to `ExtendedData`. */
    data: Record<string, string>;
}

export interface MyMapsDocument {
    name: string | null;
    placemarks: MyMapsPlacemark[];
    /** Lines and shapes. A trip has nowhere to keep them, so they are counted and left out. */
    skippedShapeCount: number;
}

export class MyMapsParseError extends Error {
    constructor(public readonly code: 'not_kml' | 'empty') {
        super(code);
        this.name = 'MyMapsParseError';
    }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** My Maps ids are long URL-safe tokens; this rejects a stray word or a pasted title. */
const MAP_ID_PATTERN = /^[A-Za-z0-9_-]{16,}$/;

/**
 * The map id from anything a traveller is likely to paste: the edit, viewer or
 * embed link, a link with a `/u/0/` account segment, or the bare id.
 *
 * Returns null for a Google Maps list or place link. Those are a different
 * product whose data Google does not export.
 */
export const parseMyMapsId = (input: string): string | null => {
    const value = input.trim();
    if (!value) return null;
    if (MAP_ID_PATTERN.test(value)) return value;

    let url: URL;
    try {
        url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase();
    const isGoogleHost = host === 'google.com' || host.endsWith('.google.com') || /(^|\.)google\.[a-z.]+$/.test(host);
    if (!isGoogleHost || !url.pathname.startsWith('/maps/d/')) return null;

    const mid = url.searchParams.get('mid');
    return mid && MAP_ID_PATTERN.test(mid) ? mid : null;
};

/** Where Google serves a shared map as plain KML. It answers any origin, so the browser can read it directly. */
export const buildMyMapsKmlUrl = (mapId: string): string => (
    `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(mapId)}&forcekml=1`
);

export const buildMyMapsViewerUrl = (mapId: string): string => (
    `https://www.google.com/maps/d/viewer?mid=${encodeURIComponent(mapId)}`
);

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Folder id a TravelFlow export gives its stops layer. My Maps ignores folder ids. */
export const TRAVELFLOW_STOPS_FOLDER_ID = 'tf-stops';

const HTML_ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

const decodeEntities = (value: string): string => value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
        if (entity[0] === '#') {
            const code = entity[1] === 'x' || entity[1] === 'X'
                ? Number.parseInt(entity.slice(2), 16)
                : Number.parseInt(entity.slice(1), 10);
            return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
        return HTML_ENTITIES[entity.toLowerCase()] ?? match;
    },
);

/** My Maps descriptions are HTML fragments (`<br>`, links). A trip stores plain text. */
export const flattenMyMapsHtml = (value: string): string => decodeEntities(
    value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li)>/gi, '\n')
        .replace(/<[^>]*>/g, ''),
)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

const childrenByLocalName = (parent: Element, localName: string): Element[] => (
    Array.from(parent.children).filter((child) => child.localName === localName)
);

const firstChildText = (parent: Element, localName: string): string | null => {
    const child = childrenByLocalName(parent, localName)[0];
    const text = child?.textContent?.trim();
    return text ? text : null;
};

/** KML writes `lng,lat[,alt]`, in that order. */
const parsePointCoordinates = (placemark: Element): { lat: number; lng: number } | null => {
    const point = placemark.getElementsByTagNameNS('*', 'Point')[0];
    const raw = point ? firstChildText(point, 'coordinates') : null;
    if (!raw) return null;
    const [lngRaw, latRaw] = raw.split(/\s+/)[0].split(',');
    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
};

const readExtendedData = (placemark: Element): Record<string, string> => {
    const data: Record<string, string> = {};
    Array.from(placemark.getElementsByTagNameNS('*', 'Data')).forEach((entry) => {
        const key = entry.getAttribute('name')?.trim();
        const value = firstChildText(entry, 'value');
        if (key && value) data[key] = decodeEntities(value);
    });
    return data;
};

const hasShapeGeometry = (placemark: Element): boolean => (
    ['LineString', 'Polygon', 'LinearRing', 'MultiGeometry']
        .some((name) => placemark.getElementsByTagNameNS('*', name).length > 0)
);

/**
 * Reads a KML document the way My Maps writes it. The parser is injectable so
 * the same function runs in the browser and in tests.
 */
export const parseMyMapsKml = (
    xml: string,
    createParser: () => DOMParser = () => new DOMParser(),
): MyMapsDocument => {
    const doc = createParser().parseFromString(xml, 'application/xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'kml' || doc.getElementsByTagName('parsererror').length > 0) {
        throw new MyMapsParseError('not_kml');
    }

    const documentElement = root.getElementsByTagNameNS('*', 'Document')[0] ?? root;
    const placemarks: MyMapsPlacemark[] = [];
    let skippedShapeCount = 0;

    Array.from(root.getElementsByTagNameNS('*', 'Placemark')).forEach((placemark) => {
        const coordinates = parsePointCoordinates(placemark);
        const address = firstChildText(placemark, 'address');
        if (!coordinates && hasShapeGeometry(placemark)) {
            skippedShapeCount += 1;
            return;
        }

        const name = firstChildText(placemark, 'name');
        // A pin without a position still counts when it has an address: maps
        // built from a spreadsheet export only the address, never the point.
        if (!coordinates && !address) {
            skippedShapeCount += 1;
            return;
        }

        const rawDescription = firstChildText(placemark, 'description');
        const folderElement = placemark.parentElement?.localName === 'Folder' ? placemark.parentElement : null;
        // A TravelFlow export marks its stops; they are the trip, not ideas for one.
        if (folderElement?.getAttribute('id') === TRAVELFLOW_STOPS_FOLDER_ID) return;

        placemarks.push({
            name: name ? decodeEntities(name) : '',
            address: address ? decodeEntities(address) : null,
            description: rawDescription ? flattenMyMapsHtml(rawDescription) || null : null,
            coordinates,
            folder: folderElement ? firstChildText(folderElement, 'name') : null,
            data: readExtendedData(placemark),
        });
    });

    if (placemarks.length === 0 && skippedShapeCount === 0) {
        throw new MyMapsParseError('empty');
    }

    return {
        name: firstChildText(documentElement, 'name'),
        placemarks,
        skippedShapeCount,
    };
};

// ---------------------------------------------------------------------------
// Mapping onto kept ideas
// ---------------------------------------------------------------------------

/**
 * Column names people give their layers. Matched case-insensitively and
 * without punctuation, so "Post URL", "post_url" and "PostURL" are one key.
 */
const FIELD_ALIASES = {
    notes: ['notes', 'note', 'description', 'details', 'comment', 'comments', 'tips'],
    category: ['category', 'type', 'kind', 'group'],
    area: ['area', 'city', 'town', 'region', 'neighbourhood', 'neighborhood', 'district'],
    location: ['location', 'address', 'place'],
    link: ['posturl', 'url', 'link', 'website', 'source url', 'sourceurl'],
    source: ['source', 'via', 'author', 'credit'],
} as const;

const normalizeFieldKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]+/g, '');

const readField = (data: Record<string, string>, field: keyof typeof FIELD_ALIASES): string | null => {
    const aliases = new Set(FIELD_ALIASES[field].map(normalizeFieldKey));
    const entry = Object.entries(data).find(([key]) => aliases.has(normalizeFieldKey(key)));
    const value = entry?.[1]?.trim();
    return value ? value : null;
};

/**
 * A few category names that the general activity-type rules would read wrongly:
 * a night market is dinner and browsing, not a bar crawl.
 */
const CATEGORY_OVERRIDES: Record<string, ActivityType[]> = {
    'night market': ['food', 'shopping'],
    'night markets': ['food', 'shopping'],
    cafe: ['food'],
    cafes: ['food'],
    temple: ['culture'],
    temples: ['culture'],
    viewpoint: ['sightseeing'],
    viewpoints: ['sightseeing'],
};

export const mapMyMapsCategoryToActivityTypes = (category: string | null): ActivityType[] => {
    if (!category) return ['general'];
    const key = category.trim().toLowerCase();
    if (CATEGORY_OVERRIDES[key]) return [...CATEGORY_OVERRIDES[key]];
    // "Food & Drink", "Sights and Landmarks": each half is its own hint.
    const parts = key.split(/\s*(?:&|\band\b|\+)\s*/).filter(Boolean);
    return normalizeActivityTypes(parts.join(','), ['general']);
};

/**
 * Stable across re-imports, so importing the same map twice adds nothing twice.
 * It depends on the pin alone, not on the map, so the same place arriving by
 * link and again by file is still one idea.
 */
const hashString = (value: string): string => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
};

export const buildMyMapsPlacemarkId = (placemark: MyMapsPlacemark): string => {
    // The address wins over the position when there is one: an address-only
    // pin gains a position once it is looked up, and a TravelFlow export
    // writes both, so the position would make the same place a new idea.
    const address = (placemark.address ?? '').trim().toLowerCase();
    const where = address || (placemark.coordinates
        ? `${placemark.coordinates.lat.toFixed(5)},${placemark.coordinates.lng.toFixed(5)}`
        : '');
    return `gmm-${hashString(`${placemark.name.trim().toLowerCase()}|${where}`)}`;
};

const INSTAGRAM_HOST = /(^|\.)instagram\.com$/i;

const hostOf = (value: string): string | null => {
    try {
        return new URL(value).hostname;
    } catch {
        return null;
    }
};

const SUMMARY_LIMIT = 140;

const summarize = (text: string | null): string => {
    if (!text) return '';
    const firstLine = text.split('\n')[0].trim();
    return firstLine.length > SUMMARY_LIMIT ? `${firstLine.slice(0, SUMMARY_LIMIT - 1).trimEnd()}…` : firstLine;
};

export interface MyMapsImportContext {
    mapName: string | null;
    /** Link back to the map, shown as the idea's source. Null for an uploaded file. */
    mapUrl: string | null;
    savedAt: string;
}

export const myMapsPlacemarkToSavedIdea = (
    placemark: MyMapsPlacemark,
    context: MyMapsImportContext,
): SavedRecommendation => {
    const notes = readField(placemark.data, 'notes');
    const category = readField(placemark.data, 'category') ?? placemark.folder;
    const area = readField(placemark.data, 'area');
    const link = readField(placemark.data, 'link');
    const sourceLabel = readField(placemark.data, 'source');
    const address = readField(placemark.data, 'location') ?? placemark.address;

    // With a table behind the layer, My Maps repeats every column in the
    // description ("Category: …<br>Area: …"). The notes column is the part
    // worth keeping; the rest is already mapped onto fields.
    const hasTable = Object.keys(placemark.data).length > 0;
    const description = notes ?? (hasTable ? null : placemark.description);

    const sources: RecommendationSource[] = [];
    if (link && /^https?:\/\//i.test(link)) {
        const host = hostOf(link);
        sources.push({
            kind: host && INSTAGRAM_HOST.test(host) ? 'instagram' : 'web',
            handle: sourceLabel ?? host,
            url: link,
            capturedAt: null,
        });
    } else if (sourceLabel) {
        sources.push({ kind: 'web', handle: sourceLabel, url: null, capturedAt: null });
    }
    sources.push({
        kind: 'google_maps',
        handle: context.mapName ?? 'Google My Maps',
        url: context.mapUrl,
        capturedAt: context.savedAt,
    });

    const tags = category ? [normalizeRecommendationTag(category)].filter(Boolean) : [];

    return {
        recommendationId: buildMyMapsPlacemarkId(placemark),
        savedAt: context.savedAt,
        title: placemark.name || address || 'Untitled place',
        summary: summarize(description) || category || '',
        description,
        activityTypes: mapMyMapsCategoryToActivityTypes(category),
        tags,
        cityName: area,
        image: null,
        location: {
            lat: placemark.coordinates?.lat ?? null,
            lng: placemark.coordinates?.lng ?? null,
            address,
        },
        costBand: null,
        typicalDurationMinutes: null,
        sources,
        // An import is a list somebody else may have made; nothing is decided yet.
        review: 'pending',
    };
};

export const isMyMapsIdeaId = (id: string): boolean => id.startsWith('gmm-');

const normalizeTitle = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The imported ideas the trip does not have yet: neither kept as an idea nor
 * already planned onto a day. Planning an idea removes it from the kept list,
 * so without the title check a re-import of an updated map would offer every
 * planned place again.
 */
export const selectNewIdeas = (
    ideas: SavedRecommendation[],
    trip: { keptIdeaIds: string[]; activityTitles: string[] },
): SavedRecommendation[] => {
    const kept = new Set(trip.keptIdeaIds);
    const planned = new Set(trip.activityTitles.map(normalizeTitle));
    return ideas.filter((idea) => !kept.has(idea.recommendationId) && !planned.has(normalizeTitle(idea.title)));
};

export const hasIdeaCoordinates = (idea: Pick<SavedRecommendation, 'location'>): boolean => (
    typeof idea.location.lat === 'number'
    && typeof idea.location.lng === 'number'
    && Number.isFinite(idea.location.lat)
    && Number.isFinite(idea.location.lng)
);

/**
 * Adds imported ideas to what the trip already has. Anything already there —
 * kept, still to review, or skipped — wins, because the traveller may have
 * edited it or decided against it since.
 */
export const mergeImportedIdeas = (
    current: { saved: SavedRecommendation[]; dismissedIds: string[] },
    imported: SavedRecommendation[],
): { next: { saved: SavedRecommendation[]; dismissedIds: string[] }; addedCount: number } => {
    const existing = new Set(current.saved.map((entry) => entry.recommendationId));
    const added: SavedRecommendation[] = [];
    imported.forEach((idea) => {
        if (existing.has(idea.recommendationId)) return;
        existing.add(idea.recommendationId);
        added.push(idea);
    });
    return {
        next: { saved: [...current.saved, ...added], dismissedIds: current.dismissedIds },
        addedCount: added.length,
    };
};
