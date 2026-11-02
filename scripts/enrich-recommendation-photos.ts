/**
 * Fills each recommendation in from Google Places: a photo, a price band and
 * whatever Google's own editorial line adds.
 *
 * The photo itself is never copied: the dataset stores the Places photo
 * resource name and the photographer's attribution, and `/api/place-photo`
 * redirects to Google at render time. That keeps us inside the Places terms,
 * which forbid rehosting, and keeps the credit with whoever took the picture.
 *
 * Some stored place ids come from the geocoder rather than from Places and
 * resolve to nothing, which is why a card could end up with no picture at all.
 * Those are re-resolved by name, and the working id is written back.
 *
 *   pnpm tsx scripts/enrich-recommendation-photos.ts --country TW
 *   pnpm tsx scripts/enrich-recommendation-photos.ts --country TW --apply
 */

import fs from 'node:fs';
import path from 'node:path';

import {
    buildPlaceSearchQuery,
    collectPlaceNames,
    pickBestPhoto,
    toCostBand,
    type PlacePhoto,
} from './lib/recommendationPlaceEnrichment';
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

interface PlaceRecord {
    id?: string;
    displayName?: { text?: string };
    editorialSummary?: { text?: string };
    priceLevel?: string;
    rating?: number;
    userRatingCount?: number;
    photos?: PlacePhoto[];
}

const PLACE_FIELDS = 'id,displayName,editorialSummary,priceLevel,rating,userRatingCount,photos';
/**
 * Names come back in Chinese because that is how a Taiwanese venue posts its
 * own photos; matching those attributions is the only way to tell a brand shot
 * from a diner's snapshot.
 */
const PLACE_LANGUAGE = 'zh-TW';

const fetchPlace = async (placeId: string, apiKey: string): Promise<PlaceRecord | null> => {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${PLACE_FIELDS}&languageCode=${PLACE_LANGUAGE}&key=${encodeURIComponent(apiKey)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const body = await response.json() as PlaceRecord;
        return body && Object.keys(body).length > 0 ? body : null;
    } catch {
        return null;
    }
};

const searchPlace = async (query: string, apiKey: string): Promise<PlaceRecord | null> => {
    try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': PLACE_FIELDS.split(',').map((field) => `places.${field}`).join(','),
            },
            body: JSON.stringify({
                textQuery: query,
                regionCode: 'TW',
                languageCode: PLACE_LANGUAGE,
                maxResultCount: 1,
            }),
        });
        if (!response.ok) return null;
        const body = await response.json() as { places?: PlaceRecord[] };
        return body.places?.[0] ?? null;
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
    let reResolved = 0;
    let stillNoPhoto = 0;
    let costBandsFilled = 0;

    for (const recommendation of dataset.recommendations) {
        const placeId = recommendation.location.googlePlaceId;
        let place = placeId ? await fetchPlace(placeId, apiKey) : null;

        if (!place?.photos?.length) {
            const query = buildPlaceSearchQuery(recommendation.title, recommendation.cityName);
            const found = await searchPlace(query, apiKey);
            if (found?.photos?.length) {
                place = found;
                if (found.id) {
                    recommendation.location.googlePlaceId = found.id;
                    reResolved += 1;
                }
            }
        }

        if (!place) {
            stillNoPhoto += 1;
            continue;
        }

        const costBand = toCostBand(place.priceLevel);
        if (costBand && !recommendation.costBand) {
            recommendation.costBand = costBand;
            costBandsFilled += 1;
        }

        const photo = pickBestPhoto(
            place.photos ?? [],
            collectPlaceNames(recommendation.title, place.displayName?.text),
        );
        if (!photo?.name) {
            stillNoPhoto += 1;
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
    console.log(`Re-resolved id:    ${reResolved}`);
    console.log(`Still no photo:    ${stillNoPhoto}`);
    console.log(`Cost bands filled: ${costBandsFilled}`);

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
