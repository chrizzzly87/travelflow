import countryRoutesJson from '../data/countryRoutes.json';
import {
  getCountryRouteCityCount,
  normalizeCountryRouteStopName,
  type CountryRoute,
  type CountryRouteDocument,
  type CountryRouteLocalization,
} from '../shared/countryRoutes';
import type { AppLanguage, TripPrefillData } from '../types';
import type { ExampleTripCard } from '../data/exampleTripCards';
import type {
  ExampleTemplateMiniCalendar,
  ExampleTemplateMiniCalendarCityLane,
  ExampleTemplateMiniCalendarRouteLane,
} from '../data/exampleTripTemplates';
import { buildCreateTripUrl, getHexFromColorClass, getRandomCityColor } from '../utils';
import { getCountryDestinationGuide } from './destinationGuideService';
import { getDestinationOptionByCode } from './destinationService';

export const COUNTRY_ROUTE_DOCUMENT = countryRoutesJson as CountryRouteDocument;

/** Synthetic travel-leg length between two stops, in days. Purely visual. */
const ROUTE_LANE_DAYS = 0.2;

const normalizeLookup = (value: string): string => value
  .trim()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const sortByRank = (left: CountryRoute, right: CountryRoute): number => left.featuredRank - right.featuredRank;

const routesById = new Map<string, CountryRoute>();
const routesByLookup = new Map<string, CountryRoute[]>();

COUNTRY_ROUTE_DOCUMENT.routes.forEach((route) => {
  routesById.set(route.id, route);
  [route.countryCode, route.countrySlug].forEach((key) => {
    const lookup = normalizeLookup(key);
    const bucket = routesByLookup.get(lookup) || [];
    bucket.push(route);
    routesByLookup.set(lookup, bucket);
  });
});

routesByLookup.forEach((routes) => routes.sort(sortByRank));

/** Featured routes for a country, by ISO 3166-1 code, guide slug or country name. */
export const getCountryRoutes = (countryValue: string): CountryRoute[] => {
  if (!countryValue) return [];
  const direct = routesByLookup.get(normalizeLookup(countryValue));
  if (direct) return [...direct];

  const guide = getCountryDestinationGuide(countryValue);
  if (!guide) return [];
  return [...(routesByLookup.get(normalizeLookup(guide.countryCode)) || [])];
};

export const getCountryRouteById = (routeId: string): CountryRoute | undefined => routesById.get(routeId);

export const hasCountryRoutes = (countryValue: string): boolean => getCountryRoutes(countryValue).length > 0;

const resolveLocalization = (
  route: CountryRoute,
  locale?: string,
): CountryRouteLocalization | undefined => {
  const base = (locale || '').trim().toLocaleLowerCase().split('-')[0] as AppLanguage;
  return route.localized?.[base] || route.localized?.en;
};

export interface LocalizedCountryRoute {
  title: string;
  pitch: string;
  tags: string[];
  stops: string[];
}

export const getLocalizedCountryRoute = (route: CountryRoute, locale?: string): LocalizedCountryRoute => {
  const localized = resolveLocalization(route, locale);
  return {
    title: localized?.title || route.title,
    pitch: localized?.pitch || route.pitch,
    tags: localized?.tags && localized.tags.length === route.tags.length ? localized.tags : route.tags,
    stops: localized?.stops && localized.stops.length === route.stops.length
      ? localized.stops
      : route.stops.map((stop) => stop.name),
  };
};

/** Ordered stop names, as shown on the card and sent into the create-trip prefill. */
export const getCountryRouteStopNames = (route: CountryRoute): string[] => route.stops.map((stop) => stop.name);

/**
 * Lane colors reuse the shared city palette, and repeated stop names reuse the
 * same color so a round trip visually closes — matching `normalizeCityColors`.
 */
export const buildCountryRouteMiniCalendar = (route: CountryRoute): ExampleTemplateMiniCalendar => {
  const colorByStop = new Map<string, string>();
  let paletteIndex = 0;

  const cityLanes: ExampleTemplateMiniCalendarCityLane[] = route.stops.map((stop, index) => {
    const key = normalizeCountryRouteStopName(stop.name);
    if (!colorByStop.has(key)) {
      colorByStop.set(key, getHexFromColorClass(getRandomCityColor(paletteIndex)));
      paletteIndex += 1;
    }
    return {
      id: `${route.id}-stop-${index + 1}`,
      title: stop.name,
      nights: Math.max(0.5, stop.nights),
      color: colorByStop.get(key) as string,
    };
  });

  const routeLanes: ExampleTemplateMiniCalendarRouteLane[] = cityLanes.slice(0, -1).map((lane, index) => ({
    id: `${route.id}-leg-${index + 1}`,
    durationDays: ROUTE_LANE_DAYS,
    color: lane.color,
  }));

  return { cityLanes, routeLanes };
};

const toExampleCardLocalization = (
  route: CountryRoute,
): ExampleTripCard['localized'] => {
  if (!route.localized) return undefined;
  const entries = Object.entries(route.localized).map(([locale, value]) => [
    locale,
    {
      title: value?.title,
      tags: value?.tags,
      cities: value?.stops,
    },
  ] as const);
  return Object.fromEntries(entries) as ExampleTripCard['localized'];
};

export const getCountryRouteCountryName = (route: CountryRoute): string => (
  getDestinationOptionByCode(route.countryCode)?.name
  || getCountryDestinationGuide(route.countryCode)?.name
  || route.countryCode
);

/** Adapts a curated route onto the homepage example-trip card contract. */
export const buildCountryRouteExampleCard = (route: CountryRoute): ExampleTripCard => ({
  id: route.id,
  title: route.title,
  countries: [{ name: getCountryRouteCountryName(route), flag: route.countryCode }],
  durationDays: route.durationDays,
  cityCount: getCountryRouteCityCount(route),
  mapColor: route.mapColor,
  mapAccent: route.mapAccent,
  username: route.curator,
  avatarColor: route.avatarColor,
  tags: route.tags,
  templateId: route.templateId,
  isRoundTrip: route.isRoundTrip,
  localized: toExampleCardLocalization(route),
});

export const buildCountryRoutePrefill = (route: CountryRoute): TripPrefillData => {
  const cityList = getCountryRouteStopNames(route);
  return {
    countries: [getCountryRouteCountryName(route)],
    cities: cityList.join(', '),
    cityList,
    roundTrip: route.isRoundTrip,
    pace: route.pace === 'relaxed' ? 'Relaxed' : route.pace === 'fast' ? 'Fast' : 'Balanced',
    meta: {
      source: 'country_route',
      label: route.title,
      routeId: route.id,
    },
  };
};

export const buildCountryRoutePrefillUrl = (route: CountryRoute): string => (
  buildCreateTripUrl(buildCountryRoutePrefill(route))
);
