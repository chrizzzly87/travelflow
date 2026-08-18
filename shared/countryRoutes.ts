import type { AppLanguage } from '../types';

export type CountryRoutePace = 'relaxed' | 'balanced' | 'fast';

export type CountryRouteStyle =
  | 'classic'
  | 'off-the-beaten-path'
  | 'road-trip'
  | 'island-hopping'
  | 'beach-and-culture'
  | 'nature-and-hiking'
  | 'food-and-wine'
  | 'city-break';

export interface CountryRouteStopCoordinates {
  lat: number;
  lng: number;
}

export interface CountryRouteStop {
  /** Canonical English display name of the stop. */
  name: string;
  /** Nights spent at this stop. Half nights are allowed for short hops. */
  nights: number;
  /** ISO 3166-2 subdivision code, prefixed with the route country code. */
  subdivisionCode?: string;
  coordinates?: CountryRouteStopCoordinates;
  /** Curator-only note. Never rendered. */
  note?: string;
}

export interface CountryRouteLocalization {
  title?: string;
  pitch?: string;
  tags?: string[];
  stops?: string[];
}

export interface CountryRoute {
  id: string;
  countryCode: string;
  countrySlug: string;
  featuredRank: number;
  title: string;
  pitch: string;
  style: CountryRouteStyle;
  pace: CountryRoutePace;
  durationDays: number;
  isRoundTrip: boolean;
  stops: CountryRouteStop[];
  tags: string[];
  bestMonths: number[];
  mapColor: string;
  mapAccent: string;
  avatarColor: string;
  curator: string;
  templateId?: string;
  localized?: Partial<Record<AppLanguage, CountryRouteLocalization>>;
}

export interface CountryRouteDocument {
  schemaVersion: 1;
  updatedAt: string;
  routes: CountryRoute[];
}

export interface CountryRouteValidationResolvers {
  /** Returns true when the ISO 3166-1 code maps to a known country guide. */
  isKnownCountryCode?: (countryCode: string) => boolean;
  /** Returns the destination guide slug for a country code, when known. */
  getCountrySlug?: (countryCode: string) => string | undefined;
  /** Returns true when a stop name maps to a known destination or guide entry. */
  isKnownPlaceName?: (name: string, countryCode: string) => boolean;
}

export const MAX_ROUTES_PER_COUNTRY = 3;
export const MIN_STOP_NIGHTS = 0.5;
export const MIN_ROUTE_TAGS = 2;
export const MAX_ROUTE_TAGS = 4;

export const COUNTRY_ROUTE_STYLES: CountryRouteStyle[] = [
  'classic',
  'off-the-beaten-path',
  'road-trip',
  'island-hopping',
  'beach-and-culture',
  'nature-and-hiking',
  'food-and-wine',
  'city-break',
];

export const COUNTRY_ROUTE_PACES: CountryRoutePace[] = ['relaxed', 'balanced', 'fast'];

/**
 * Allowed route tags. Deliberately a subset of the homepage example-card tag
 * vocabulary so route tags translate through the existing tag map for free.
 */
export const COUNTRY_ROUTE_TAGS: string[] = [
  'Surf',
  'Culture',
  'Wine',
  'Food',
  'Art',
  'History',
  'Beach',
  'Adventure',
  'Nature',
  'Hiking',
  'Road Trip',
  'Desert',
  'Photography',
];

const APP_LANGUAGES: AppLanguage[] = ['en', 'es', 'de', 'fr', 'pt', 'ru', 'it', 'pl', 'ko', 'fa', 'ur'];

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const SUBDIVISION_PATTERN = /^[A-Z]{2}-[A-Za-z0-9]{1,3}$/;
const TAILWIND_BG_PATTERN = /^bg-[a-z]+-\d{2,3}$/;

export const normalizeCountryRouteStopName = (value: string): string => value
  .trim()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

export const getCountryRouteTotalNights = (route: CountryRoute): number => (
  route.stops.reduce((total, stop) => total + (Number.isFinite(stop.nights) ? stop.nights : 0), 0)
);

export const getCountryRouteExpectedDurationDays = (route: CountryRoute): number => (
  Math.round(getCountryRouteTotalNights(route)) + 1
);

/** Distinct stop names — a round trip's repeated start/end counts once. */
export const getCountryRouteCityCount = (route: CountryRoute): number => (
  new Set(route.stops.map((stop) => normalizeCountryRouteStopName(stop.name))).size
);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const validateStop = (
  route: CountryRoute,
  stop: CountryRouteStop,
  index: number,
  resolvers: CountryRouteValidationResolvers,
  errors: string[],
): void => {
  const label = `${route.id}: stop ${index + 1}`;

  if (typeof stop.name !== 'string' || !stop.name.trim()) {
    errors.push(`${label} has an empty name`);
    return;
  }

  if (typeof stop.nights !== 'number' || !Number.isFinite(stop.nights) || stop.nights < MIN_STOP_NIGHTS) {
    errors.push(`${label} (${stop.name}) must have nights >= ${MIN_STOP_NIGHTS}`);
  }

  if (stop.subdivisionCode !== undefined) {
    if (!SUBDIVISION_PATTERN.test(stop.subdivisionCode)) {
      errors.push(`${label} (${stop.name}) has invalid subdivisionCode ${stop.subdivisionCode}`);
    } else if (!stop.subdivisionCode.startsWith(`${route.countryCode}-`)) {
      errors.push(`${label} (${stop.name}) subdivisionCode ${stop.subdivisionCode} does not belong to ${route.countryCode}`);
    }
  }

  const coordinates = stop.coordinates;
  if (coordinates !== undefined) {
    if (!isPlainObject(coordinates)
      || typeof coordinates.lat !== 'number' || !Number.isFinite(coordinates.lat)
      || typeof coordinates.lng !== 'number' || !Number.isFinite(coordinates.lng)) {
      errors.push(`${label} (${stop.name}) has malformed coordinates`);
    } else if (coordinates.lat < -90 || coordinates.lat > 90 || coordinates.lng < -180 || coordinates.lng > 180) {
      errors.push(`${label} (${stop.name}) has out-of-range coordinates`);
    }
  }

  const hasCoordinates = isPlainObject(coordinates)
    && typeof coordinates.lat === 'number'
    && typeof coordinates.lng === 'number';
  const resolvesToKnownPlace = resolvers.isKnownPlaceName
    ? resolvers.isKnownPlaceName(stop.name, route.countryCode)
    : true;

  if (!hasCoordinates && !resolvesToKnownPlace) {
    errors.push(`${label} (${stop.name}) does not resolve to a known destination and has no coordinates`);
  }
};

const validateLocalized = (route: CountryRoute, errors: string[]): void => {
  if (route.localized === undefined) return;
  if (!isPlainObject(route.localized)) {
    errors.push(`${route.id}: localized must be an object`);
    return;
  }

  Object.entries(route.localized).forEach(([locale, entry]) => {
    if (!APP_LANGUAGES.includes(locale as AppLanguage)) {
      errors.push(`${route.id}: localized has unsupported locale ${locale}`);
      return;
    }
    if (!isPlainObject(entry)) {
      errors.push(`${route.id}: localized.${locale} must be an object`);
      return;
    }
    const localized = entry as CountryRouteLocalization;
    if (localized.tags !== undefined && localized.tags.length !== route.tags.length) {
      errors.push(`${route.id}: localized.${locale}.tags length must match tags (${route.tags.length})`);
    }
    if (localized.stops !== undefined && localized.stops.length !== route.stops.length) {
      errors.push(`${route.id}: localized.${locale}.stops length must match stops (${route.stops.length})`);
    }
  });
};

export const validateCountryRouteDocument = (
  document: CountryRouteDocument,
  resolvers: CountryRouteValidationResolvers = {},
): string[] => {
  const errors: string[] = [];

  if (!isPlainObject(document)) return ['country route document must be an object'];
  if (document.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (typeof document.updatedAt !== 'string' || Number.isNaN(Date.parse(document.updatedAt))) {
    errors.push('updatedAt must be an ISO timestamp');
  }
  if (!Array.isArray(document.routes)) return [...errors, 'routes must be an array'];

  const seenIds = new Set<string>();
  const routesByCountry = new Map<string, CountryRoute[]>();

  document.routes.forEach((route, routeIndex) => {
    if (!isPlainObject(route)) {
      errors.push(`route ${routeIndex + 1} must be an object`);
      return;
    }

    if (typeof route.id !== 'string' || !ID_PATTERN.test(route.id)) {
      errors.push(`route ${routeIndex + 1} has an invalid id (${String(route.id)})`);
      return;
    }
    if (seenIds.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    seenIds.add(route.id);

    if (typeof route.countryCode !== 'string' || !COUNTRY_CODE_PATTERN.test(route.countryCode)) {
      errors.push(`${route.id}: countryCode must be an uppercase ISO 3166-1 alpha-2 code`);
    } else if (resolvers.isKnownCountryCode && !resolvers.isKnownCountryCode(route.countryCode)) {
      errors.push(`${route.id}: countryCode ${route.countryCode} has no country guide`);
    }

    if (typeof route.countrySlug !== 'string' || !ID_PATTERN.test(route.countrySlug)) {
      errors.push(`${route.id}: countrySlug must be kebab-case`);
    } else {
      if (!route.id.startsWith(`${route.countrySlug}-`)) {
        errors.push(`${route.id}: id must be prefixed with countrySlug (${route.countrySlug})`);
      }
      const expectedSlug = resolvers.getCountrySlug?.(route.countryCode);
      if (expectedSlug && expectedSlug !== route.countrySlug) {
        errors.push(`${route.id}: countrySlug ${route.countrySlug} does not match guide slug ${expectedSlug}`);
      }
    }

    if (typeof route.title !== 'string' || !route.title.trim()) errors.push(`${route.id}: title is required`);
    if (typeof route.pitch !== 'string' || !route.pitch.trim()) errors.push(`${route.id}: pitch is required`);
    if (typeof route.curator !== 'string' || !route.curator.trim()) errors.push(`${route.id}: curator is required`);

    if (!COUNTRY_ROUTE_STYLES.includes(route.style)) errors.push(`${route.id}: unknown style ${String(route.style)}`);
    if (!COUNTRY_ROUTE_PACES.includes(route.pace)) errors.push(`${route.id}: unknown pace ${String(route.pace)}`);

    if (!Number.isInteger(route.featuredRank) || route.featuredRank < 1 || route.featuredRank > MAX_ROUTES_PER_COUNTRY) {
      errors.push(`${route.id}: featuredRank must be an integer between 1 and ${MAX_ROUTES_PER_COUNTRY}`);
    }

    [
      ['mapColor', route.mapColor],
      ['mapAccent', route.mapAccent],
      ['avatarColor', route.avatarColor],
    ].forEach(([field, value]) => {
      if (typeof value !== 'string' || !TAILWIND_BG_PATTERN.test(value)) {
        errors.push(`${route.id}: ${field} must be a tailwind background class (got ${String(value)})`);
      }
    });

    if (!Array.isArray(route.tags) || route.tags.length < MIN_ROUTE_TAGS || route.tags.length > MAX_ROUTE_TAGS) {
      errors.push(`${route.id}: tags must contain between ${MIN_ROUTE_TAGS} and ${MAX_ROUTE_TAGS} entries`);
    } else {
      route.tags.forEach((tag) => {
        if (!COUNTRY_ROUTE_TAGS.includes(tag)) errors.push(`${route.id}: unknown tag ${tag}`);
      });
      if (new Set(route.tags).size !== route.tags.length) errors.push(`${route.id}: tags contain duplicates`);
    }

    if (!Array.isArray(route.bestMonths) || route.bestMonths.length === 0) {
      errors.push(`${route.id}: bestMonths must contain at least one month`);
    } else {
      route.bestMonths.forEach((month) => {
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          errors.push(`${route.id}: bestMonths contains invalid month ${month}`);
        }
      });
      if (new Set(route.bestMonths).size !== route.bestMonths.length) {
        errors.push(`${route.id}: bestMonths contains duplicates`);
      }
    }

    if (!Array.isArray(route.stops) || route.stops.length < 2) {
      errors.push(`${route.id}: stops must contain at least 2 entries`);
    } else {
      route.stops.forEach((stop, index) => validateStop(route, stop, index, resolvers, errors));

      const expectedDuration = getCountryRouteExpectedDurationDays(route);
      if (route.durationDays !== expectedDuration) {
        errors.push(`${route.id}: durationDays ${route.durationDays} does not match nights + 1 (${expectedDuration})`);
      }

      const first = normalizeCountryRouteStopName(route.stops[0]?.name || '');
      const last = normalizeCountryRouteStopName(route.stops[route.stops.length - 1]?.name || '');
      const loops = Boolean(first) && first === last;
      if (route.isRoundTrip !== loops) {
        errors.push(`${route.id}: isRoundTrip (${route.isRoundTrip}) disagrees with the stop list`);
      }
    }

    validateLocalized(route, errors);

    const bucket = routesByCountry.get(route.countryCode) || [];
    bucket.push(route);
    routesByCountry.set(route.countryCode, bucket);
  });

  routesByCountry.forEach((routes, countryCode) => {
    if (routes.length > MAX_ROUTES_PER_COUNTRY) {
      errors.push(`${countryCode}: ${routes.length} routes exceed the maximum of ${MAX_ROUTES_PER_COUNTRY}`);
    }
    const ranks = routes.map((route) => route.featuredRank);
    if (new Set(ranks).size !== ranks.length) {
      errors.push(`${countryCode}: featuredRank values must be unique within a country`);
    }
  });

  return errors;
};
