/**
 * CLI script to generate the static map PNG previews shown on the featured
 * country route cards (`/inspirations/country/:slug`).
 *
 * Usage:
 *   pnpm maps:routes:generate              # download PNGs and update the JSON
 *   pnpm maps:routes:generate --dry-run    # print URLs only, write nothing
 *   pnpm maps:routes:generate --route=japan-golden-route
 *   pnpm maps:routes:generate --force      # re-render routes that already have a PNG
 *
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env / .env.local.
 *
 * Images are committed to the repo on purpose: the build must never call the
 * Maps API. Routes with an unresolved stop are skipped with a warning rather
 * than drawn through the wrong place.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
    COUNTRY_ROUTE_MAP_IMAGE_DIR,
    getCountryRouteMapImagePath,
    getCountryRouteMapStops,
    getCountryRouteUnresolvedStopNames,
    type CountryRoute,
    type CountryRouteDocument,
} from '../shared/countryRoutes';
import { buildCountryRouteMiniCalendar } from '../services/countryRouteService';
import {
    buildMapUrl,
    downloadImage,
    getApiKey,
    type CityCoord,
    type PreviewMapStyle,
    type PreviewRouteMode,
} from './lib/staticMapPreview';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const ROUTES_JSON = path.join(REPO_ROOT, 'data', 'countryRoutes.json');
const OUT_DIR = path.join(REPO_ROOT, 'public', ...COUNTRY_ROUTE_MAP_IMAGE_DIR.split('/').filter(Boolean));

/** Every country route uses the `clean` basemap so the three cards read as a set. */
const ROUTE_MAP_STYLE: PreviewMapStyle = 'clean';

/**
 * Island hops have no drivable geometry, so a Directions lookup would only burn
 * quota before falling back to a straight line anyway.
 */
const resolveRouteMode = (route: CountryRoute): PreviewRouteMode => (
    route.style === 'island-hopping' ? 'simple' : 'realistic'
);

/**
 * Lane colors come from the card's own mini calendar, so the markers on the map
 * match the colored city lanes underneath it.
 */
const buildRouteCoords = (route: CountryRoute): CityCoord[] | null => {
    const stops = getCountryRouteMapStops(route);
    if (!stops) return null;

    const laneColors = buildCountryRouteMiniCalendar(route).cityLanes.map((lane) => lane.color);
    return stops.map((stop, index) => ({
        lat: stop.lat,
        lng: stop.lng,
        title: stop.name,
        color: laneColors[index] || '#4f46e5',
    }));
};

const parseArgValue = (flag: string): string | undefined => {
    const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
    return match?.slice(flag.length + 1);
};

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const force = process.argv.includes('--force');
    const onlyRouteId = parseArgValue('--route');
    const apiKey = getApiKey();

    if (!apiKey && !dryRun) {
        console.error('Error: VITE_GOOGLE_MAPS_API_KEY not found in .env or environment');
        process.exit(1);
    }

    const document = JSON.parse(fs.readFileSync(ROUTES_JSON, 'utf-8')) as CountryRouteDocument;
    const routes = document.routes.filter((route) => !onlyRouteId || route.id === onlyRouteId);

    if (routes.length === 0) {
        console.error(`No routes matched${onlyRouteId ? ` --route=${onlyRouteId}` : ''}.`);
        process.exit(1);
    }

    if (!dryRun) fs.mkdirSync(OUT_DIR, { recursive: true });

    console.log(`\nGenerating country route maps for ${routes.length} route(s)...\n`);

    const skipped: string[] = [];
    let generated = 0;
    let reused = 0;

    for (const route of routes) {
        const publicPath = getCountryRouteMapImagePath(route.id);
        const filepath = path.join(REPO_ROOT, 'public', ...publicPath.split('/').filter(Boolean));
        const coords = buildRouteCoords(route);

        if (!coords) {
            const unresolved = getCountryRouteUnresolvedStopNames(route);
            console.warn(`  [SKIP] ${route.id} — unresolved stops: ${unresolved.join(', ') || 'fewer than 2 stops'}`);
            skipped.push(route.id);
            continue;
        }

        if (!force && !dryRun && fs.existsSync(filepath)) {
            route.mapImagePath = publicPath;
            reused += 1;
            console.log(`  [KEEP] ${route.id} — image already committed (use --force to re-render)`);
            continue;
        }

        const routeMode = resolveRouteMode(route);
        const url = await buildMapUrl(coords, apiKey || 'YOUR_API_KEY', ROUTE_MAP_STYLE, routeMode);

        if (dryRun) {
            console.log(`  [DRY] ${route.id} (${coords.length} stops, ${routeMode})`);
            console.log(`        ${publicPath}`);
            console.log(`        ${url.replace(apiKey || 'YOUR_API_KEY', 'REDACTED').substring(0, 140)}...`);
            console.log(`        Stops: ${coords.map((coord) => coord.title).join(' → ')}`);
            console.log();
            continue;
        }

        process.stdout.write(`  [DL]  ${route.id} (${coords.length} stops, ${routeMode})...`);
        try {
            await downloadImage(url, filepath);
            const stat = fs.statSync(filepath);
            route.mapImagePath = publicPath;
            generated += 1;
            console.log(` OK (${Math.round(stat.size / 1024)} KB)`);
        } catch (err) {
            skipped.push(route.id);
            console.log(` FAILED: ${err}`);
        }
    }

    if (dryRun) {
        console.log('Dry run complete. No files written.');
        return;
    }

    document.updatedAt = new Date().toISOString();
    fs.writeFileSync(ROUTES_JSON, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');

    console.log(`\nDone. ${generated} rendered, ${reused} kept, ${skipped.length} skipped.`);
    if (skipped.length > 0) console.log(`Skipped: ${skipped.join(', ')}`);
    console.log(`Images: ${OUT_DIR}`);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
