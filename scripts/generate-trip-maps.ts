/**
 * CLI script to generate static map PNG images for homepage trip cards.
 *
 * Usage:
 *   npx tsx scripts/generate-trip-maps.ts           # download all PNGs
 *   npx tsx scripts/generate-trip-maps.ts --dry-run  # print URLs only
 *
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env
 */

import fs from 'node:fs';
import path from 'node:path';
import { getExampleTripTemplateConfig, TRIP_TEMPLATES } from '../data/exampleTripTemplates/index';
import { getHexFromColorClass } from '../utils';

// --- Config ---
const MAP_WIDTH = 680;
const MAP_HEIGHT = 288;
const MAP_SCALE = 2;
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'public', 'images', 'trip-maps');

type PreviewMapStyle = 'clean' | 'minimal' | 'standard' | 'dark' | 'satellite';
type PreviewRouteMode = 'simple' | 'realistic';
const MAX_REALISTIC_DIRECTION_LEGS = 8;

const STYLE_TOKENS: Record<Exclude<PreviewMapStyle, 'standard' | 'satellite'>, string[]> = {
    clean: [
        'element:geometry|color:0xf9f9f9',
        'element:labels.icon|visibility:off',
        'element:labels.text.fill|color:0x757575',
        'element:labels.text.stroke|color:0xf9f9f9|weight:2',
        'feature:administrative|element:geometry|visibility:off',
        'feature:administrative.country|element:geometry.stroke|color:0xa8a8a8|weight:1.6|visibility:on',
        'feature:administrative.province|element:geometry|visibility:off',
        'feature:administrative.province|element:labels|visibility:off',
        'feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd',
        'feature:poi|visibility:off',
        'feature:road|visibility:off',
        'feature:transit|visibility:off',
        'feature:water|element:geometry|color:0xdcefff',
        'feature:water|element:geometry.stroke|color:0x8fb6d9|weight:2.2|visibility:on',
        'feature:landscape.natural|element:geometry.stroke|color:0xa7c9e6|weight:1.4|visibility:on',
        'feature:water|element:labels.text.fill|color:0x9e9e9e',
    ],
    minimal: [
        'element:geometry|color:0xf5f5f5',
        'element:labels.icon|visibility:off',
        'element:labels.text.fill|color:0x616161',
        'element:labels.text.stroke|color:0xf5f5f5',
        'feature:administrative.country|element:geometry.stroke|color:0x9aa6b2|weight:1.4|visibility:on',
        'feature:administrative.province|element:geometry.stroke|color:0xd5dce3|weight:0.5',
        'feature:administrative.land_parcel|element:labels.text.fill|color:0xbdbdbd',
        'feature:poi|element:geometry|color:0xeeeeee',
        'feature:poi|element:labels.text.fill|color:0x757575',
        'feature:poi.park|element:geometry|color:0xe5e5e5',
        'feature:poi.park|element:labels.text.fill|color:0x9e9e9e',
        'feature:road|element:geometry|color:0xffffff',
        'feature:road.arterial|element:labels.text.fill|color:0x757575',
        'feature:road.highway|element:geometry|color:0xdadada',
        'feature:road.highway|element:labels.text.fill|color:0x616161',
        'feature:road.local|element:labels.text.fill|color:0x9e9e9e',
        'feature:transit.line|element:geometry|color:0xe5e5e5',
        'feature:transit.station|element:geometry|color:0xeeeeee',
        'feature:water|element:geometry|color:0xc9c9c9',
        'feature:water|element:labels.text.fill|color:0x9e9e9e',
    ],
    dark: [
        'element:geometry|color:0x1b2230',
        'element:labels.text.stroke|color:0x1b2230',
        'element:labels.text.fill|color:0xd0d8e2',
        'feature:administrative.locality|element:labels.text.fill|color:0xf3c98b',
        'feature:administrative.country|element:geometry.stroke|color:0x9fb3c8|weight:1.2|visibility:on',
        'feature:poi|element:labels.text.fill|color:0x8fb3c0',
        'feature:poi.park|element:geometry|color:0x1a3b3a',
        'feature:poi.park|element:labels.text.fill|color:0x8bc2b3',
        'feature:road|element:geometry|color:0x3a4558',
        'feature:road|element:geometry.stroke|color:0x243246',
        'feature:road|element:labels.text.fill|color:0xd5dde8',
        'feature:road.highway|element:geometry|color:0x566579',
        'feature:road.highway|element:geometry.stroke|color:0x2f3c4f',
        'feature:road.highway|element:labels.text.fill|color:0xf7ddb0',
        'feature:transit|element:geometry|color:0x34506b',
        'feature:transit.station|element:labels.text.fill|color:0x9fc6e5',
        'feature:water|element:geometry|color:0x0b3f5f',
        'feature:water|element:labels.text.fill|color:0xb7d5ea',
        'feature:water|element:labels.text.stroke|color:0x0b3f5f',
    ],
};

const shiftHexColor = (hexColor: string, amount: number): string => {
    const normalized = hexColor.replace('#', '');
    const channels = [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
    return channels
        .map((channel) => Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, '0'))
        .join('');
};

// --- Helpers ---

function getApiKey(): string {
    // Try .env files manually (tsx doesn't load dotenv by default)
    // Check .env.local first (higher priority), then .env
    for (const filename of ['.env.local', '.env']) {
        try {
            const envPath = path.resolve(import.meta.dirname, '..', filename);
            const envContent = fs.readFileSync(envPath, 'utf-8');
            const match = envContent.match(/^VITE_GOOGLE_MAPS_API_KEY=(.+)$/m);
            if (match) return match[1].trim();
        } catch { /* file not found */ }
    }

    return process.env.VITE_GOOGLE_MAPS_API_KEY || '';
}

interface CityCoord {
    lat: number;
    lng: number;
    title: string;
    color: string;
}

const formatCoord = (coord: Pick<CityCoord, 'lat' | 'lng'>): string =>
    `${coord.lat.toFixed(6)},${coord.lng.toFixed(6)}`;

function extractCityCoords(templateId: string): CityCoord[] {
    const template = TRIP_TEMPLATES[templateId];
    if (!template?.items) return [];

    return template.items
        .filter(item => item.type === 'city' && item.coordinates)
        .map(item => ({
            lat: item.coordinates!.lat,
            lng: item.coordinates!.lng,
            title: item.title,
            color: item.color || '#4f46e5',
        }));
}

const fetchDirectionsPolyline = async (
    from: Pick<CityCoord, 'lat' | 'lng'>,
    to: Pick<CityCoord, 'lat' | 'lng'>,
    apiKey: string
): Promise<string | null> => {
    const directionsUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
    directionsUrl.searchParams.set('origin', formatCoord(from));
    directionsUrl.searchParams.set('destination', formatCoord(to));
    directionsUrl.searchParams.set('mode', 'driving');
    directionsUrl.searchParams.set('alternatives', 'false');
    directionsUrl.searchParams.set('key', apiKey);

    try {
        const response = await fetch(directionsUrl.toString());
        if (!response.ok) return null;
        const data = await response.json();
        const encoded = data?.routes?.[0]?.overview_polyline?.points;
        return typeof encoded === 'string' && encoded.length > 0 ? encoded : null;
    } catch {
        return null;
    }
};

const buildSimplePath = (coords: Pick<CityCoord, 'lat' | 'lng'>[], color: string): string | null => {
    if (coords.length < 2) return null;
    return `color:0x${color}|weight:4|${coords.map(formatCoord).join('|')}`;
};

const resolveLegColor = (legColors: string[], index: number, fallback: string): string => {
    if (legColors.length === 0) return fallback;
    return legColors[index] || legColors[legColors.length - 1] || fallback;
};

const buildSimpleSegmentPaths = (
    coords: CityCoord[],
    legColors: string[],
    fallbackColor: string
): string[] => {
    if (coords.length < 2) return [];

    const paths: string[] = [];
    for (let i = 0; i < coords.length - 1; i += 1) {
        const color = resolveLegColor(legColors, i, fallbackColor);
        const segment = buildSimplePath([coords[i], coords[i + 1]], color);
        if (segment) paths.push(segment);
    }
    return paths;
};

const buildRealisticPaths = async (
    coords: CityCoord[],
    legColors: string[],
    fallbackColor: string,
    apiKey: string
): Promise<string[]> => {
    if (coords.length < 2) return [];

    const paths: string[] = [];
    let calls = 0;

    for (let i = 0; i < coords.length - 1; i += 1) {
        const from = coords[i];
        const to = coords[i + 1];
        const color = resolveLegColor(legColors, i, fallbackColor);

        let encodedPolyline: string | null = null;
        if (calls < MAX_REALISTIC_DIRECTION_LEGS) {
            encodedPolyline = await fetchDirectionsPolyline(from, to, apiKey);
            calls += 1;
        }

        if (encodedPolyline) {
            paths.push(`color:0x${color}|weight:4|enc:${encodedPolyline}`);
            continue;
        }

        const fallbackSegment = buildSimplePath([from, to], color);
        if (fallbackSegment) paths.push(fallbackSegment);
    }

    return paths;
};

async function buildMapUrl(
    coords: CityCoord[],
    apiKey: string,
    style: PreviewMapStyle,
    routeMode: PreviewRouteMode
): Promise<string> {
    if (coords.length === 0) return '';
    const firstColor = getHexFromColorClass(coords[0].color || '#4f46e5').replace('#', '');
    const cityColors = coords.map((coord) => getHexFromColorClass(coord.color || '#4f46e5').replace('#', ''));
    const legColors = cityColors.slice(0, -1);
    const startColor = shiftHexColor(cityColors[0] || firstColor, -24);
    const endColor = shiftHexColor(cityColors[cityColors.length - 1] || firstColor, 40);
    const mapType = style === 'satellite' ? 'satellite' : 'roadmap';
    const startMarker = `size:mid|color:0x${startColor}|label:S|${formatCoord(coords[0])}`;
    const last = coords[coords.length - 1];
    const endMarker = `size:mid|color:0x${endColor}|label:E|${formatCoord(last)}`;

    const params = new URLSearchParams();
    params.set('size', `${MAP_WIDTH}x${MAP_HEIGHT}`);
    params.set('scale', String(MAP_SCALE));
    params.set('maptype', mapType);

    if (style !== 'standard' && style !== 'satellite') {
        STYLE_TOKENS[style].forEach((token) => params.append('style', token));
    }

    const simplePathParams = buildSimpleSegmentPaths(coords, legColors, firstColor);
    let pathParams: string[] = [];
    const canUseRealistic = routeMode === 'realistic' && Boolean(apiKey) && apiKey !== 'YOUR_API_KEY';
    if (canUseRealistic) {
        pathParams = await buildRealisticPaths(coords, legColors, firstColor, apiKey);
    }
    if (pathParams.length === 0) {
        pathParams = simplePathParams;
    }
    if (pathParams.length === 0) {
        const simplePath = buildSimplePath(coords, firstColor);
        if (simplePath) pathParams.push(simplePath);
    }
    pathParams.forEach((pathParam) => params.append('path', pathParam));

    params.append('markers', startMarker);
    params.append('markers', endMarker);
    coords.slice(1, -1).forEach((coord, index) => {
        const waypointColor = cityColors[Math.min(index + 1, cityColors.length - 1)] || firstColor;
        params.append('markers', `size:tiny|color:0x${waypointColor}|${formatCoord(coord)}`);
    });
    params.set('key', apiKey);

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

async function downloadImage(url: string, filepath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch map: ${res.status} ${res.statusText}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
}

// --- Main ---

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const apiKey = getApiKey();

    if (!apiKey && !dryRun) {
        console.error('Error: VITE_GOOGLE_MAPS_API_KEY not found in .env or environment');
        process.exit(1);
    }

    // Ensure output directory exists
    if (!dryRun) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    const templateIds = Object.keys(TRIP_TEMPLATES);
    console.log(`\nGenerating maps for ${templateIds.length} trips...\n`);

    for (const id of templateIds) {
        const coords = extractCityCoords(id);
        if (coords.length === 0) {
            console.log(`  [SKIP] ${id} — no city coordinates`);
            continue;
        }

        const config = getExampleTripTemplateConfig(id);
        const primaryStyle = config.mapStyle as PreviewMapStyle;
        const routeMode: PreviewRouteMode = config.routeMode === 'realistic' ? 'realistic' : 'simple';
        const url = await buildMapUrl(coords, apiKey || 'YOUR_API_KEY', primaryStyle, routeMode);
        const filename = `${id}.png`;
        const filepath = path.join(OUT_DIR, filename);

        if (dryRun) {
            console.log(`  [DRY] ${id} (${coords.length} cities)`);
            console.log(`        ${url.substring(0, 120)}...`);
            console.log(`        Route: ${routeMode}`);
            console.log(`        Cities: ${coords.map(c => c.title).join(' → ')}`);
            console.log();
        } else {
            process.stdout.write(`  [DL]  ${id} (${coords.length} cities)...`);
            try {
                await downloadImage(url, filepath);
                const stat = fs.statSync(filepath);
                console.log(` OK (${Math.round(stat.size / 1024)} KB)`);
            } catch (err) {
                // Some style combinations can be rejected by Static Maps depending on key restrictions.
                if (primaryStyle !== 'clean') {
                    try {
                        const fallbackUrl = await buildMapUrl(coords, apiKey || 'YOUR_API_KEY', 'clean', routeMode);
                        await downloadImage(fallbackUrl, filepath);
                        const stat = fs.statSync(filepath);
                        console.log(` OK via clean fallback (${Math.round(stat.size / 1024)} KB)`);
                        continue;
                    } catch (fallbackErr) {
                        console.log(` FAILED: ${fallbackErr}`);
                        continue;
                    }
                }
                console.log(` FAILED: ${err}`);
            }
        }
    }

    if (!dryRun) {
        console.log(`\nDone! Images saved to ${OUT_DIR}`);
    } else {
        console.log('Dry run complete. No files written.');
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
