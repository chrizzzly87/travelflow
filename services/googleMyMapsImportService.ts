import type { AppLanguage, ICoordinates, ITimelineItem } from '../types';
import type { SavedRecommendation } from '../shared/recommendations';
import {
    buildMyMapsKmlUrl,
    buildMyMapsViewerUrl,
    hasIdeaCoordinates,
    myMapsPlacemarkToSavedIdea,
    parseMyMapsId,
    parseMyMapsKml,
    MyMapsParseError,
    type MyMapsDocument,
} from '../shared/googleMyMaps';
import { searchPlaceLocation } from './locationSearchService';

/**
 * The browser half of the My Maps import: getting the KML (from a link or a
 * file), and looking up positions for pins that arrive with an address only.
 */

export type MyMapsImportErrorCode =
    | 'invalid_link'
    | 'not_shared'
    | 'network'
    | 'not_kml'
    | 'empty'
    | 'unsupported_file';

export class MyMapsImportError extends Error {
    constructor(public readonly code: MyMapsImportErrorCode) {
        super(code);
        this.name = 'MyMapsImportError';
    }
}

export interface LoadedMyMap {
    document: MyMapsDocument;
    ideas: SavedRecommendation[];
    /** Where the map came from, for analytics only. */
    origin: 'link' | 'file';
}

const toIdeas = (
    document: MyMapsDocument,
    mapUrl: string | null,
): SavedRecommendation[] => {
    const savedAt = new Date().toISOString();
    const seen = new Set<string>();
    return document.placemarks
        .map((placemark) => myMapsPlacemarkToSavedIdea(placemark, {
            mapName: document.name,
            mapUrl,
            savedAt,
        }))
        // The same pin twice in one map (two layers, a copy-paste) is one idea.
        .filter((idea) => {
            if (seen.has(idea.recommendationId)) return false;
            seen.add(idea.recommendationId);
            return true;
        });
};

const parseOrThrow = (xml: string): MyMapsDocument => {
    try {
        return parseMyMapsKml(xml);
    } catch (error) {
        if (error instanceof MyMapsParseError) throw new MyMapsImportError(error.code);
        throw new MyMapsImportError('not_kml');
    }
};

/**
 * Google answers a map that is not shared with its sign-in page (HTML, 200),
 * not with an error status, so the body is what tells the two apart.
 */
const looksLikeKml = (text: string): boolean => /<kml[\s>]/i.test(text.slice(0, 2000));

export const loadMyMapFromLink = async (
    input: string,
    fetchImpl: typeof fetch = fetch,
): Promise<LoadedMyMap> => {
    const mapId = parseMyMapsId(input);
    if (!mapId) throw new MyMapsImportError('invalid_link');

    let text: string;
    try {
        const response = await fetchImpl(buildMyMapsKmlUrl(mapId), { credentials: 'omit' });
        if (response.status === 401 || response.status === 403 || response.status === 404) {
            throw new MyMapsImportError('not_shared');
        }
        if (!response.ok) throw new MyMapsImportError('network');
        text = await response.text();
    } catch (error) {
        if (error instanceof MyMapsImportError) throw error;
        throw new MyMapsImportError('network');
    }
    if (!looksLikeKml(text)) throw new MyMapsImportError('not_shared');

    const document = parseOrThrow(text);
    return {
        document,
        ideas: toIdeas(document, buildMyMapsViewerUrl(mapId)),
        origin: 'link',
    };
};

// ---------------------------------------------------------------------------
// KMZ: a zip holding `doc.kml` (and the layer icons, which are not needed).
// Read with the platform's own inflater instead of shipping a zip library.
// ---------------------------------------------------------------------------

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;

const inflateRaw = async (bytes: Uint8Array): Promise<Uint8Array> => {
    if (typeof DecompressionStream === 'undefined') throw new MyMapsImportError('unsupported_file');
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    }).pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const extractKmlFromKmz = async (buffer: ArrayBuffer): Promise<string> => {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder();

    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
        if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
            eocd = offset;
            break;
        }
    }
    if (eocd < 0) throw new MyMapsImportError('unsupported_file');

    const entryCount = view.getUint16(eocd + 10, true);
    let cursor = view.getUint32(eocd + 16, true);
    const entries: Array<{ name: string; method: number; compressedSize: number; localOffset: number }> = [];
    for (let index = 0; index < entryCount; index += 1) {
        if (view.getUint32(cursor, true) !== ZIP_CENTRAL_SIGNATURE) break;
        const method = view.getUint16(cursor + 10, true);
        const compressedSize = view.getUint32(cursor + 20, true);
        const nameLength = view.getUint16(cursor + 28, true);
        const extraLength = view.getUint16(cursor + 30, true);
        const commentLength = view.getUint16(cursor + 32, true);
        const localOffset = view.getUint32(cursor + 42, true);
        const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        entries.push({ name, method, compressedSize, localOffset });
        cursor += 46 + nameLength + extraLength + commentLength;
    }

    const kmlEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.kml'));
    const entry = kmlEntries.find((candidate) => candidate.name.toLowerCase() === 'doc.kml') ?? kmlEntries[0];
    if (!entry || view.getUint32(entry.localOffset, true) !== ZIP_LOCAL_SIGNATURE) {
        throw new MyMapsImportError('unsupported_file');
    }

    const dataStart = entry.localOffset + 30
        + view.getUint16(entry.localOffset + 26, true)
        + view.getUint16(entry.localOffset + 28, true);
    const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);
    if (entry.method === 0) return decoder.decode(compressed);
    if (entry.method === 8) return decoder.decode(await inflateRaw(compressed));
    throw new MyMapsImportError('unsupported_file');
};

/** Files larger than this are not a pin list; refusing them keeps the tab responsive. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const loadMyMapFromFile = async (file: File): Promise<LoadedMyMap> => {
    if (file.size > MAX_FILE_BYTES) throw new MyMapsImportError('unsupported_file');
    const buffer = await file.arrayBuffer();
    const head = new Uint8Array(buffer.slice(0, 2));
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // "PK"
    const text = isZip ? await extractKmlFromKmz(buffer) : new TextDecoder().decode(buffer);
    if (!looksLikeKml(text)) throw new MyMapsImportError('not_kml');

    const document = parseOrThrow(text);
    return {
        document,
        ideas: toIdeas(document, null),
        origin: 'file',
    };
};

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

const normalize = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/**
 * Pulls a lookup toward the stay the idea names ("Area: Taipei"), falling back
 * to the first stay, so "Din Tai Fung" finds the branch in the right country.
 */
const pickBias = (idea: SavedRecommendation, cities: ITimelineItem[]): ICoordinates | null => {
    const area = normalize(idea.cityName);
    const named = area
        ? cities.find((city) => normalize(city.title) === area || normalize(city.location).startsWith(area))
        : null;
    return named?.coordinates ?? cities.find((city) => city.coordinates)?.coordinates ?? null;
};

const LOOKUP_CONCURRENCY = 4;

/**
 * Looks up a position for every idea that arrived without one. Runs a few at a
 * time and reports progress; an idea that cannot be found keeps its address,
 * and the details panel tries again once it is planned onto a day.
 */
export const resolveMissingIdeaPositions = async (
    ideas: SavedRecommendation[],
    options: {
        cities: ITimelineItem[];
        language?: AppLanguage;
        onProgress?: (done: number, total: number) => void;
        signal?: AbortSignal;
        search?: typeof searchPlaceLocation;
    },
): Promise<SavedRecommendation[]> => {
    const search = options.search ?? searchPlaceLocation;
    const pending = ideas
        .map((idea, index) => ({ idea, index }))
        .filter(({ idea }) => !hasIdeaCoordinates(idea) && (idea.location.address || idea.title));
    const result = [...ideas];
    let done = 0;
    options.onProgress?.(0, pending.length);

    let next = 0;
    const worker = async () => {
        while (next < pending.length) {
            if (options.signal?.aborted) return;
            const { idea, index } = pending[next];
            next += 1;
            const address = idea.location.address;
            const query = address && !normalize(address).includes(normalize(idea.title))
                ? `${idea.title}, ${address}`
                : (address || idea.title);
            try {
                const match = await search(query, {
                    language: options.language,
                    bias: pickBias(idea, options.cities),
                });
                if (match) {
                    result[index] = {
                        ...idea,
                        location: { ...idea.location, lat: match.coordinates.lat, lng: match.coordinates.lng },
                    };
                }
            } catch {
                // Kept without a position.
            }
            done += 1;
            options.onProgress?.(done, pending.length);
        }
    };

    await Promise.all(Array.from({ length: Math.min(LOOKUP_CONCURRENCY, pending.length) }, worker));
    return result;
};
