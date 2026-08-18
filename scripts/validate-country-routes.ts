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

if (errors.length > 0) {
  console.error(`Country route validation failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const countries = new Set(routeDocument.routes.map((route) => route.countryCode));
  const stops = routeDocument.routes.reduce((total, route) => total + route.stops.length, 0);
  console.log(
    `Country route validation passed (${routeDocument.routes.length} routes across ${countries.size} countries, `
    + `${stops} stops, max ${MAX_ROUTES_PER_COUNTRY} per country).`,
  );
}
