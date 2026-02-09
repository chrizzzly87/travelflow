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
import { TRIP_TEMPLATES } from '../data/exampleTripTemplates/index';

// --- Config ---
const MAP_WIDTH = 680;
const MAP_HEIGHT = 288;
const MAP_SCALE = 2;
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'public', 'images', 'trip-maps');

const CLEAN_STYLE_PARAMS = [
    'style=element:geometry|color:0xf9f9f9',
    'style=element:labels.icon|visibility:off',
    'style=element:labels.text.fill|color:0x757575',
    'style=element:labels.text.stroke|color:0xf9f9f9|weight:2',
    'style=feature:administrative|element:geometry|visibility:off',
    'style=feature:poi|visibility:off',
    'style=feature:road|element:geometry|color:0xe0e0e0',
    'style=feature:road|element:labels|visibility:off',
    'style=feature:transit|visibility:off',
    'style=feature:water|element:geometry|color:0xc9d6e5',
    'style=feature:water|element:labels|visibility:off',
].join('&');

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
}

function extractCityCoords(templateId: string): CityCoord[] {
    const template = TRIP_TEMPLATES[templateId];
    if (!template?.items) return [];

    return template.items
        .filter(item => item.type === 'city' && item.coordinates)
        .map(item => ({
            lat: item.coordinates!.lat,
            lng: item.coordinates!.lng,
            title: item.title,
        }));
}

function buildMapUrl(coords: CityCoord[], apiKey: string): string {
    if (coords.length === 0) return '';

    // Path connecting all cities
    const pathCoords = coords.map(c => `${c.lat},${c.lng}`).join('|');
    const pathParam = `path=color:0x4f46e5cc|weight:3|${pathCoords}`;

    // Start marker (green)
    const startMarker = `markers=color:green|label:S|${coords[0].lat},${coords[0].lng}`;
    // End marker (red)
    const last = coords[coords.length - 1];
    const endMarker = `markers=color:red|label:E|${last.lat},${last.lng}`;

    // Mid markers (small blue)
    const midMarkers = coords.slice(1, -1)
        .map(c => `markers=size:small|color:0x4f46e5|${c.lat},${c.lng}`)
        .join('&');

    const params = [
        `size=${MAP_WIDTH}x${MAP_HEIGHT}`,
        `scale=${MAP_SCALE}`,
        'maptype=roadmap',
        CLEAN_STYLE_PARAMS,
        pathParam,
        startMarker,
        endMarker,
        midMarkers,
        `key=${apiKey}`,
    ].filter(Boolean).join('&');

    return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
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

        const url = buildMapUrl(coords, apiKey || 'YOUR_API_KEY');
        const filename = `${id}.png`;
        const filepath = path.join(OUT_DIR, filename);

        if (dryRun) {
            console.log(`  [DRY] ${id} (${coords.length} cities)`);
            console.log(`        ${url.substring(0, 120)}...`);
            console.log(`        Cities: ${coords.map(c => c.title).join(' → ')}`);
            console.log();
        } else {
            process.stdout.write(`  [DL]  ${id} (${coords.length} cities)...`);
            try {
                await downloadImage(url, filepath);
                const stat = fs.statSync(filepath);
                console.log(` OK (${Math.round(stat.size / 1024)} KB)`);
            } catch (err) {
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
