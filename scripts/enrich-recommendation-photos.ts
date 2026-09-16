/**
 * Attaches a Google Places photo reference to each recommendation.
 *
 * The photo itself is never copied: the dataset stores the Places photo
 * resource name and the photographer's attribution, and `/api/place-photo`
 * redirects to Google at render time. That keeps us inside the Places terms,
 * which forbid rehosting, and keeps the credit with whoever took the picture.
 *
 *   pnpm tsx scripts/enrich-recommendation-photos.ts --country TW
 *   pnpm tsx scripts/enrich-recommendation-photos.ts --country TW --apply
 */

import fs from 'node:fs';
import path from 'node:path';

import type { RecommendationDataset } from '../shared/recommendations';

const readArg = (name: string): string | null => {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1) return null;
    return process.argv[index + 1] ?? null;
};

const readApiKey = (): string => {
    for (const filename of ['.env.local', '.env']) {
        try {
            const content = fs.readFileSync(path.resolve(process.cwd(), filename), 'utf-8');
            const match = content.match(/^VITE_GOOGLE_MAPS_API_KEY=(.+)$/m);
            if (match) return match[1].trim().replace(/^"|"$/g, '');
        } catch { /* not present */ }
    }
    return process.env.VITE_GOOGLE_MAPS_API_KEY || '';
};

interface PlacePhoto {
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
}

const fetchPlacePhoto = async (placeId: string, apiKey: string): Promise<PlacePhoto | null> => {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=photos&key=${encodeURIComponent(apiKey)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const body = await response.json() as { photos?: PlacePhoto[] };
        const photo = body.photos?.find((entry) => typeof entry.name === 'string');
        return photo ?? null;
    } catch {
        return null;
    }
};

const main = async (): Promise<void> => {
    const countryCode = (readArg('country') || '').toUpperCase();
    const apply = process.argv.includes('--apply');
    if (!countryCode) {
        console.error('Usage: --country <ISO2> [--apply]');
        process.exit(1);
    }

    const apiKey = readApiKey();
    if (!apiKey) {
        console.error('VITE_GOOGLE_MAPS_API_KEY is required.');
        process.exit(1);
    }

    const datasetPath = path.resolve(process.cwd(), 'data/recommendations', `${countryCode.toLowerCase()}.json`);
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as RecommendationDataset;

    let withPhoto = 0;
    let missingPlaceId = 0;
    let noPhoto = 0;

    for (const recommendation of dataset.recommendations) {
        const placeId = recommendation.location.googlePlaceId;
        if (!placeId) {
            missingPlaceId += 1;
            continue;
        }

        const photo = await fetchPlacePhoto(placeId, apiKey);
        if (!photo?.name) {
            noPhoto += 1;
            continue;
        }

        const author = photo.authorAttributions?.[0];
        recommendation.image = {
            // Resolved through our own endpoint so the API key stays server-side.
            url: `/api/place-photo?ref=${encodeURIComponent(photo.name)}`,
            provider: 'google_places',
            attribution: author?.displayName?.trim() || null,
            authorUrl: author?.uri || null,
            blurhash: null,
        };
        withPhoto += 1;
    }

    console.log(`Recommendations:   ${dataset.recommendations.length}`);
    console.log(`With a photo:      ${withPhoto}`);
    console.log(`No photo on place: ${noPhoto}`);
    console.log(`No place id:       ${missingPlaceId}`);

    if (!apply) {
        console.log('');
        console.log('Preview only. Re-run with --apply to write the dataset.');
        process.exit(2);
    }

    dataset.generatedAt = new Date().toISOString();
    fs.writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`);
    console.log('');
    console.log(`Wrote ${path.relative(process.cwd(), datasetPath)}`);
};

main().catch((error) => {
    console.error('Photo enrichment failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
