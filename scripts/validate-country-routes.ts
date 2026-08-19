import fs from 'node:fs';
import path from 'node:path';
import countryRoutesJson from '../data/countryRoutes.json';
import destinationGuidesJson from '../data/destinationGuides.json';
import type { DestinationGuideDocument } from '../shared/destinationGuides';
import {
  MAX_ROUTES_PER_COUNTRY,
  normalizeCountryRouteStopName,
  validateCountryRouteDocument,
  type CountryRouteDocument,
} from '../shared/countryRoutes';
import { DESTINATION_OPTIONS } from '../services/destinationService';

const guideDocument = destinationGuidesJson as DestinationGuideDocument;
const routeDocument = countryRoutesJson as CountryRouteDocument;

const countrySlugByCode = new Map<string, string>();
const guideNamesByCountryCode = new Map<string, Set<string>>();

guideDocument.guides.forEach((guide) => {
  if (guide.kind === 'country') countrySlugByCode.set(guide.countryCode.toUpperCase(), guide.slug);
  const key = guide.countryCode.toUpperCase();
  const names = guideNamesByCountryCode.get(key) || new Set<string>();
  names.add(normalizeCountryRouteStopName(guide.name));
  guideNamesByCountryCode.set(key, names);
});

const destinationNames = new Set<string>();
DESTINATION_OPTIONS.forEach((option) => {
  destinationNames.add(normalizeCountryRouteStopName(option.name));
  (option.aliases || []).forEach((alias) => destinationNames.add(normalizeCountryRouteStopName(alias)));
});

const errors = validateCountryRouteDocument(routeDocument, {
  isKnownCountryCode: (countryCode) => countrySlugByCode.has(countryCode),
  getCountrySlug: (countryCode) => countrySlugByCode.get(countryCode),
  isKnownPlaceName: (name, countryCode) => {
    const normalized = normalizeCountryRouteStopName(name);
    if (guideNamesByCountryCode.get(countryCode)?.has(normalized)) return true;
    return destinationNames.has(normalized);
  },
});

// A declared map preview must exist in the repo: the build never calls the Maps API.
routeDocument.routes.forEach((route) => {
  if (!route.mapImagePath) return;
  const filePath = path.resolve(import.meta.dirname, '..', 'public', ...route.mapImagePath.split('/').filter(Boolean));
  if (!fs.existsSync(filePath)) {
    errors.push(`${route.id}: mapImagePath ${route.mapImagePath} has no committed image (run pnpm maps:routes:generate)`);
  }
});

if (errors.length > 0) {
  console.error(`Country route validation failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const countries = new Set(routeDocument.routes.map((route) => route.countryCode));
  const stops = routeDocument.routes.reduce((total, route) => total + route.stops.length, 0);
  const withMaps = routeDocument.routes.filter((route) => Boolean(route.mapImagePath)).length;
  console.log(
    `Country route validation passed (${routeDocument.routes.length} routes across ${countries.size} countries, `
    + `${stops} stops, ${withMaps} with map previews, max ${MAX_ROUTES_PER_COUNTRY} per country).`,
  );
}
