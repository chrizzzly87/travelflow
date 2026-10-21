/**
 * CLI script that fills in `coordinates` for the stops of every featured
 * country route (`data/countryRoutes.json`).
 *
 * Usage:
 *   pnpm routes:stops:resolve                # report what resolves, write nothing
 *   pnpm routes:stops:resolve --apply        # write resolved coordinates back
 *   pnpm routes:stops:resolve --apply --geocode   # also use the Geocoding API
 *
 * Coordinates are never invented. They are resolved, in order, from:
 *   1. stops already carrying coordinates in `data/countryRoutes.json`
 *   2. city entries in `data/exampleTripTemplates/`
 *   3. `public/data/airports/commercialAirports.generated.json` (municipality)
 *   4. optionally the Google Geocoding API, when `--geocode` is passed
 *
 * Anything that stays unresolved is reported and left alone, so the map
 * generator skips that route instead of drawing a line through a guess.
 */

import fs from 'node:fs';
import path from 'node:path';
import { TRIP_TEMPLATES } from '../data/exampleTripTemplates';
import destinationGuidesJson from '../data/destinationGuides.json';
import type { DestinationGuideDocument } from '../shared/destinationGuides';
import {
  normalizeCountryRouteStopName,
  type CountryRouteDocument,
  type CountryRouteStopCoordinates,
} from '../shared/countryRoutes';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const ROUTES_JSON = path.join(REPO_ROOT, 'data', 'countryRoutes.json');
const AIRPORTS_JSON = path.join(REPO_ROOT, 'public', 'data', 'airports', 'commercialAirports.generated.json');

type ResolutionSource = 'routes' | 'template' | 'airport' | 'geocode';

interface Resolution {
  coordinates: CountryRouteStopCoordinates;
  source: ResolutionSource;
  detail: string;
}

interface AirportRecord {
  name?: string;
  municipality?: string | null;
  countryCode?: string;
  countryName?: string;
  latitude?: number;
  longitude?: number;
  airportType?: string;
  isMajorCommercial?: boolean;
}

const guideDocument = destinationGuidesJson as DestinationGuideDocument;

const countryNameByCode = new Map<string, string>();
guideDocument.guides.forEach((guide) => {
  if (guide.kind === 'country') countryNameByCode.set(guide.countryCode.toUpperCase(), guide.name);
});

const key = (countryCode: string, name: string): string => (
  `${countryCode.toUpperCase()}::${normalizeCountryRouteStopName(name)}`
);

/** Airport municipalities carry disambiguating suffixes such as `Kaohsiung (Xiaogang)`. */
const municipalityAliases = (municipality: string): string[] => {
  const aliases = new Set<string>([municipality]);
  const withoutParens = municipality.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (withoutParens) aliases.add(withoutParens);
  const withoutCitySuffix = withoutParens.replace(/\s+City$/i, '').trim();
  if (withoutCitySuffix) aliases.add(withoutCitySuffix);
  return [...aliases];
};

const loadRouteDocument = (): CountryRouteDocument => (
  JSON.parse(fs.readFileSync(ROUTES_JSON, 'utf-8')) as CountryRouteDocument
);

/** Stops that are already resolved are the most trustworthy source we have. */
const buildRouteIndex = (document: CountryRouteDocument): Map<string, Resolution> => {
  const index = new Map<string, Resolution>();
  document.routes.forEach((route) => {
    route.stops.forEach((stop) => {
      if (!stop.coordinates) return;
      const mapKey = key(route.countryCode, stop.name);
      if (index.has(mapKey)) return;
      index.set(mapKey, { coordinates: stop.coordinates, source: 'routes', detail: route.id });
    });
  });
  return index;
};

const buildTemplateIndex = (): Map<string, Resolution> => {
  const index = new Map<string, Resolution>();
  const countryCodeByName = new Map<string, string>();
  countryNameByCode.forEach((name, code) => countryCodeByName.set(normalizeCountryRouteStopName(name), code));

  Object.entries(TRIP_TEMPLATES).forEach(([templateId, template]) => {
    (template.items || []).forEach((item) => {
      if (item.type !== 'city' || !item.coordinates) return;
      const name = (item.title || '').trim();
      const location = (item.location || '').trim();
      if (!name || !location.includes(',')) return;
      const countryLabel = location.slice(location.lastIndexOf(',') + 1).trim();
      const countryCode = countryCodeByName.get(normalizeCountryRouteStopName(countryLabel));
      if (!countryCode) return;
      const mapKey = key(countryCode, name);
      if (index.has(mapKey)) return;
      index.set(mapKey, {
        coordinates: { lat: item.coordinates.lat, lng: item.coordinates.lng },
        source: 'template',
        detail: templateId,
      });
    });
  });
  return index;
};

const buildAirportIndex = (): Map<string, Resolution> => {
  const index = new Map<string, Resolution>();
  const airports = JSON.parse(fs.readFileSync(AIRPORTS_JSON, 'utf-8')) as AirportRecord[];

  airports.forEach((airport) => {
    const municipality = (airport.municipality || '').trim();
    const countryCode = (airport.countryCode || '').trim().toUpperCase();
    if (!municipality || !countryCode) return;
    if (typeof airport.latitude !== 'number' || typeof airport.longitude !== 'number') return;

    municipalityAliases(municipality).forEach((alias) => {
      const mapKey = key(countryCode, alias);
      const existing = index.get(mapKey);
      // Prefer the largest airport serving a municipality: it sits closest to the city it names.
      if (existing && !airport.isMajorCommercial) return;
      index.set(mapKey, {
        coordinates: {
          lat: Number(airport.latitude.toFixed(4)),
          lng: Number(airport.longitude.toFixed(4)),
        },
        source: 'airport',
        detail: airport.name || municipality,
      });
    });
  });
  return index;
};

const readEnvValue = (name: string): string | undefined => {
  if (process.env[name]) return process.env[name];
  for (const filename of ['.env.local', '.env']) {
    const filePath = path.join(REPO_ROOT, filename);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (match && match[1] === name) return match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
};

const geocode = async (
  name: string,
  countryCode: string,
  apiKey: string,
): Promise<Resolution | null> => {
  const params = new URLSearchParams({
    address: `${name}, ${countryNameByCode.get(countryCode) || countryCode}`,
    components: `country:${countryCode}`,
    key: apiKey,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  if (!response.ok) return null;
  const payload = await response.json() as {
    status?: string;
    results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[];
  };
  const location = payload.results?.[0]?.geometry?.location;
  if (payload.status !== 'OK' || !location) return null;
  return {
    coordinates: { lat: Number(location.lat.toFixed(4)), lng: Number(location.lng.toFixed(4)) },
    source: 'geocode',
    detail: payload.results?.[0]?.formatted_address || name,
  };
};

async function main() {
  const apply = process.argv.includes('--apply');
  const useGeocode = process.argv.includes('--geocode');
  const document = loadRouteDocument();

  const indexes: { source: ResolutionSource; index: Map<string, Resolution> }[] = [
    { source: 'routes', index: buildRouteIndex(document) },
    { source: 'template', index: buildTemplateIndex() },
    { source: 'airport', index: buildAirportIndex() },
  ];

  const apiKey = useGeocode ? readEnvValue('VITE_GOOGLE_MAPS_API_KEY') : undefined;
  if (useGeocode && !apiKey) {
    console.error('Error: --geocode needs VITE_GOOGLE_MAPS_API_KEY in .env or .env.local');
    process.exit(1);
  }

  const counts: Record<ResolutionSource, number> = { routes: 0, template: 0, airport: 0, geocode: 0 };
  const unresolved: string[] = [];
  let changed = 0;

  for (const route of document.routes) {
    for (const stop of route.stops) {
      if (stop.coordinates) continue;
      const mapKey = key(route.countryCode, stop.name);
      let resolution = indexes.map(({ index }) => index.get(mapKey)).find(Boolean) || null;

      if (!resolution && apiKey) {
        resolution = await geocode(stop.name, route.countryCode, apiKey);
        if (resolution) indexes[0].index.set(mapKey, resolution);
      }

      if (!resolution) {
        unresolved.push(`${route.id}: ${stop.name} (${route.countryCode})`);
        continue;
      }

      counts[resolution.source] += 1;
      changed += 1;
      console.log(
        `  [${resolution.source.toUpperCase().padEnd(8)}] ${route.id} — ${stop.name} `
        + `→ ${resolution.coordinates.lat}, ${resolution.coordinates.lng} (${resolution.detail})`,
      );
      if (apply) stop.coordinates = resolution.coordinates;
    }
  }

  console.log(
    `\n${changed} stop(s) resolved `
    + `(routes ${counts.routes}, templates ${counts.template}, airports ${counts.airport}, geocode ${counts.geocode}).`,
  );

  if (unresolved.length > 0) {
    console.warn(`\n${unresolved.length} stop(s) could not be resolved:`);
    unresolved.forEach((entry) => console.warn(`  - ${entry}`));
    console.warn('Those routes will be skipped by pnpm maps:routes:generate.');
  }

  if (!apply) {
    console.log('\nDry run. Pass --apply to write data/countryRoutes.json.');
    return;
  }

  if (changed === 0) {
    console.log('Nothing to write.');
    return;
  }

  document.updatedAt = new Date().toISOString();
  fs.writeFileSync(ROUTES_JSON, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${ROUTES_JSON}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
