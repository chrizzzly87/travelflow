/**
 * Imports a Google My Maps export into a recommendation dataset.
 *
 * Preview by default, `--apply` to write, mirroring the destination importers.
 * Every row lands as `in_review`: nothing a map or a model produced is
 * published without a human pass.
 *
 *   pnpm tsx scripts/import-recommendations-kml.ts --mid <mapId> --country TW
 *   pnpm tsx scripts/import-recommendations-kml.ts --mid <mapId> --country TW --apply
 */

import fs from 'node:fs';
import path from 'node:path';

import {
    buildRecommendationFromPlacemark,
    parseKmlPlacemarks,
    type GeocodeResult,
} from './lib/recommendationKmlImport';
import type { GeocodePrecision, Recommendation, RecommendationDataset } from '../shared/recommendations';

const GEOCODE_PRECISION_BY_LOCATION_TYPE: Record<string, GeocodePrecision> = {
    ROOFTOP: 'rooftop',
    RANGE_INTERPOLATED: 'exact',
    GEOMETRIC_CENTER: 'approximate',
    APPROXIMATE: 'approximate',
};

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

const geocodeAddress = async (
    query: string,
    countryCode: string,
    apiKey: string,
): Promise<GeocodeResult | null> => {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', query);
    url.searchParams.set('components', `country:${countryCode.toUpperCase()}`);
    url.searchParams.set('key', apiKey);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const body = await response.json() as {
            status?: string;
            results?: Array<{
                formatted_address?: string;
                place_id?: string;
                geometry?: { location?: { lat: number; lng: number }; location_type?: string };
            }>;
        };
        if (body.status !== 'OK' || !body.results?.length) return null;

        const first = body.results[0];
        const location = first.geometry?.location;
        if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;

        return {
            lat: Number(location.lat.toFixed(6)),
            lng: Number(location.lng.toFixed(6)),
            formattedAddress: first.formatted_address ?? query,
            precision: GEOCODE_PRECISION_BY_LOCATION_TYPE[first.geometry?.location_type ?? ''] ?? 'approximate',
            googlePlaceId: first.place_id ?? null,
        };
    } catch {
        return null;
    }
};

const main = async (): Promise<void> => {
    const mapId = readArg('mid');
    const countryCode = (readArg('country') || '').toUpperCase();
    const countryName = readArg('country-name') || countryCode;
    const apply = process.argv.includes('--apply');

    if (!mapId || !countryCode) {
        console.error('Usage: --mid <googleMyMapsId> --country <ISO2> [--country-name <name>] [--apply]');
        process.exit(1);
    }

    const apiKey = readApiKey();
    if (!apiKey) {
        console.error('VITE_GOOGLE_MAPS_API_KEY is required to geocode. No pin in a My Maps export carries coordinates.');
        process.exit(1);
    }

    const kmlUrl = `https://www.google.com/maps/d/kml?mid=${encodeURIComponent(mapId)}&forcekml=1`;
    const response = await fetch(kmlUrl);
    if (!response.ok) {
        console.error(`Could not read the map (HTTP ${response.status}). It has to be shared publicly to export.`);
        process.exit(1);
    }
    const kml = await response.text();
    const mapName = kml.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim() ?? null;
    const placemarks = parseKmlPlacemarks(kml);

    console.log(`Map: ${mapName ?? 'unnamed'}`);
    console.log(`Placemarks: ${placemarks.length}`);

    const capturedAt = new Date().toISOString().slice(0, 10);
    const existingSlugs = new Set<string>();
    const recommendations: Recommendation[] = [];
    const precisionCounts: Record<string, number> = {};
    let geocoded = 0;

    for (const placemark of placemarks) {
        const area = placemark.data.Area?.trim();
        const query = [placemark.data.Location?.trim(), area].filter(Boolean).join(', ')
            || `${placemark.name}, ${countryName}`;
        const geocode = await geocodeAddress(query, countryCode, apiKey);
        if (geocode) geocoded += 1;

        const recommendation = buildRecommendationFromPlacemark({
            placemark,
            countryCode,
            capturedAt,
            geocode,
            existingSlugs,
        });
        precisionCounts[recommendation.location.geocodePrecision] =
            (precisionCounts[recommendation.location.geocodePrecision] ?? 0) + 1;
        recommendations.push(recommendation);
    }

    const withTypes = recommendations.filter((entry) => entry.activityTypes.length > 0).length;
    const withCost = recommendations.filter((entry) => entry.costBand !== null).length;
    const withSources = recommendations.filter((entry) => entry.sources.length > 0).length;
    const multiSource = recommendations.filter((entry) => entry.sources.length > 1).length;

    console.log('');
    console.log(`Geocoded:        ${geocoded}/${recommendations.length}`);
    console.log(`Precision:       ${JSON.stringify(precisionCounts)}`);
    console.log(`With types:      ${withTypes}`);
    console.log(`With cost band:  ${withCost}`);
    console.log(`With sources:    ${withSources} (${multiSource} cite more than one creator)`);

    const ungeocoded = recommendations.filter((entry) => entry.location.lat === null);
    if (ungeocoded.length > 0) {
        console.log('');
        console.log(`Needs review (no coordinates): ${ungeocoded.length}`);
        ungeocoded.slice(0, 10).forEach((entry) => console.log(`  - ${entry.title}`));
    }

    const dataset: RecommendationDataset = {
        countryCode: countryCode.toUpperCase(),
        countryName,
        generatedAt: new Date().toISOString(),
        sourceName: mapName,
        recommendations,
    };

    const outputPath = path.resolve(
        process.cwd(),
        'data/recommendations',
        `${countryCode.toLowerCase()}.json`,
    );

    if (!apply) {
        console.log('');
        console.log(`Preview only. Re-run with --apply to write ${path.relative(process.cwd(), outputPath)}.`);
        process.exit(2);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
    console.log('');
    console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
};

main().catch((error) => {
    console.error('Recommendation import failed:', error instanceof Error ? error.message : error);
    process.exit(1);
});
