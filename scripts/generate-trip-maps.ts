/**
 * CLI script to generate static map PNG images for homepage trip cards.
 *
 * Usage:
 *   npx tsx scripts/generate-trip-maps.ts           # download all PNGs
 *   npx tsx scripts/generate-trip-maps.ts --dry-run  # print URLs only
 *
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env
 *
 * Country route previews live in scripts/generate-country-route-maps.ts and
 * share the URL builder in scripts/lib/staticMapPreview.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getExampleTripTemplateConfig, TRIP_TEMPLATES } from '../data/exampleTripTemplates/index';
import {
    buildMapUrl,
    downloadImage,
    getApiKey,
    type CityCoord,
    type PreviewMapStyle,
    type PreviewRouteMode,
} from './lib/staticMapPreview';

const OUT_DIR = path.resolve(import.meta.dirname, '..', 'public', 'images', 'trip-maps');

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
