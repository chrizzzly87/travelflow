import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import countryRoutesJson from '../../data/countryRoutes.json';
import destinationGuidesJson from '../../data/destinationGuides.json';
import type { DestinationGuideDocument } from '../../shared/destinationGuides';
import {
  COUNTRY_ROUTE_TAGS,
  MAX_ROUTES_PER_COUNTRY,
  getCountryRouteCityCount,
  getCountryRouteExpectedDurationDays,
  getCountryRouteMapImagePath,
  getCountryRouteMapStops,
  getCountryRouteUnresolvedStopNames,
  normalizeCountryRouteStopName,
  validateCountryRouteDocument,
  type CountryRoute,
  type CountryRouteDocument,
} from '../../shared/countryRoutes';
import { EXAMPLE_TRIP_TAG_VOCABULARY } from '../../data/exampleTripCards';

const document = countryRoutesJson as CountryRouteDocument;
const guideDocument = destinationGuidesJson as DestinationGuideDocument;

const countrySlugByCode = new Map<string, string>();
guideDocument.guides.forEach((guide) => {
  if (guide.kind === 'country') countrySlugByCode.set(guide.countryCode.toUpperCase(), guide.slug);
});

const baseRoute = (): CountryRoute => ({
  id: 'japan-test-route',
  countryCode: 'JP',
  countrySlug: 'japan',
  featuredRank: 1,
  title: 'Test Route',
  pitch: 'A short pitch.',
  style: 'classic',
  pace: 'balanced',
  durationDays: 4,
  isRoundTrip: false,
  stops: [
    { name: 'Tokyo', nights: 2, coordinates: { lat: 35.6762, lng: 139.6503 } },
    { name: 'Kyoto', nights: 1, coordinates: { lat: 35.0116, lng: 135.7681 } },
  ],
  tags: ['Culture', 'Food'],
  bestMonths: [4, 10],
  mapColor: 'bg-rose-100',
  mapAccent: 'bg-rose-400',
  avatarColor: 'bg-rose-600',
  curator: 'travelflow',
});

const wrap = (routes: CountryRoute[]): CountryRouteDocument => ({
  schemaVersion: 1,
  updatedAt: '2026-08-18T09:00:00Z',
  routes,
});

describe('country route document', () => {
  it('ships a valid curated document', () => {
    const errors = validateCountryRouteDocument(document, {
      isKnownCountryCode: (code) => countrySlugByCode.has(code),
      getCountrySlug: (code) => countrySlugByCode.get(code),
    });
    expect(errors).toEqual([]);
  });

  it('ships at most three routes per country', () => {
    const counts = new Map<string, number>();
    document.routes.forEach((route) => {
      counts.set(route.countryCode, (counts.get(route.countryCode) || 0) + 1);
    });
    counts.forEach((count) => expect(count).toBeLessThanOrEqual(MAX_ROUTES_PER_COUNTRY));
    expect(counts.size).toBeGreaterThanOrEqual(5);
  });

  it('keeps every route tag inside the example-card tag vocabulary', () => {
    COUNTRY_ROUTE_TAGS.forEach((tag) => expect(EXAMPLE_TRIP_TAG_VOCABULARY).toContain(tag));
    document.routes.forEach((route) => {
      route.tags.forEach((tag) => expect(COUNTRY_ROUTE_TAGS).toContain(tag));
    });
  });

  it('keeps durations consistent with the sum of stop nights', () => {
    document.routes.forEach((route) => {
      expect(route.durationDays).toBe(getCountryRouteExpectedDurationDays(route));
    });
  });

  it('only uses card colors that Tailwind is told to generate', () => {
    // Route palettes live in JSON, which Tailwind never scans, so index.css
    // declares them explicitly. A palette outside that list ships unstyled.
    const css = readFileSync(resolve(import.meta.dirname, '../../index.css'), 'utf-8');
    const inlineSource = css.match(/@source inline\("([^"]+)"\)/)?.[1];
    expect(inlineSource, 'index.css must declare the route palette').toBeTruthy();

    const [, hues, shades] = inlineSource!.match(/^bg-\{([^}]+)\}-\{([^}]+)\}$/) || [];
    const generated = new Set(
      hues.split(',').flatMap((hue) => shades.split(',').map((shade) => `bg-${hue}-${shade}`)),
    );

    document.routes.forEach((route) => {
      [route.mapColor, route.mapAccent, route.avatarColor].forEach((token) => {
        expect(generated, `${route.id} uses ungenerated class ${token}`).toContain(token);
      });
    });
  });

  it('gives every stop of a route its own coordinates', () => {
    // Two stops sharing a point mean a name resolved to the wrong place.
    document.routes.forEach((route) => {
      const points = route.stops.map((stop) => `${stop.coordinates?.lat},${stop.coordinates?.lng}`);
      const distinctNames = new Set(route.stops.map((stop) => normalizeCountryRouteStopName(stop.name)));
      expect(new Set(points).size, `${route.id} has stops sharing coordinates`).toBe(distinctNames.size);
    });
  });
});

describe('validateCountryRouteDocument', () => {
  it('rejects duplicate ids', () => {
    const errors = validateCountryRouteDocument(wrap([baseRoute(), baseRoute()]));
    expect(errors.some((error) => error.includes('duplicate route id'))).toBe(true);
  });

  it('rejects a fourth route for the same country', () => {
    const routes = [1, 2, 3, 1].map((rank, index) => ({
      ...baseRoute(),
      id: `japan-test-route-${index}`,
      featuredRank: rank,
    }));
    const errors = validateCountryRouteDocument(wrap(routes));
    expect(errors.some((error) => error.includes('exceed the maximum'))).toBe(true);
    expect(errors.some((error) => error.includes('featuredRank values must be unique'))).toBe(true);
  });

  it('rejects durations that disagree with stop nights', () => {
    const errors = validateCountryRouteDocument(wrap([{ ...baseRoute(), durationDays: 9 }]));
    expect(errors.some((error) => error.includes('does not match nights + 1'))).toBe(true);
  });

  it('rejects out-of-range months', () => {
    const errors = validateCountryRouteDocument(wrap([{ ...baseRoute(), bestMonths: [0, 13] }]));
    expect(errors.filter((error) => error.includes('invalid month'))).toHaveLength(2);
  });

  it('rejects a round-trip flag that disagrees with the stop list', () => {
    const errors = validateCountryRouteDocument(wrap([{ ...baseRoute(), isRoundTrip: true }]));
    expect(errors.some((error) => error.includes('isRoundTrip'))).toBe(true);
  });

  it('rejects stops that neither resolve nor carry coordinates', () => {
    const route = baseRoute();
    route.stops = [
      { name: 'Definitely Not A Place', nights: 2 },
      { name: 'Kyoto', nights: 1, coordinates: { lat: 35.0116, lng: 135.7681 } },
    ];
    const errors = validateCountryRouteDocument(wrap([route]), { isKnownPlaceName: () => false });
    expect(errors.some((error) => error.includes('does not resolve to a known destination'))).toBe(true);
  });

  it('accepts an unresolvable stop when coordinates are supplied', () => {
    const route = baseRoute();
    route.stops = [
      { name: 'Shirakawa-go', nights: 2, coordinates: { lat: 36.2578, lng: 136.9063 } },
      { name: 'Kyoto', nights: 1, coordinates: { lat: 35.0116, lng: 135.7681 } },
    ];
    const errors = validateCountryRouteDocument(wrap([route]), { isKnownPlaceName: () => false });
    expect(errors).toEqual([]);
  });

  it('rejects a subdivision code from another country', () => {
    const route = baseRoute();
    route.stops[0].subdivisionCode = 'IT-82';
    const errors = validateCountryRouteDocument(wrap([route]));
    expect(errors.some((error) => error.includes('does not belong to JP'))).toBe(true);
  });

  it('rejects tags outside the vocabulary and ids not prefixed with the country slug', () => {
    const errors = validateCountryRouteDocument(wrap([{
      ...baseRoute(),
      id: 'nippon-test-route',
      tags: ['Culture', 'Cryptocurrency'],
    }]));
    expect(errors.some((error) => error.includes('unknown tag Cryptocurrency'))).toBe(true);
    expect(errors.some((error) => error.includes('must be prefixed with countrySlug'))).toBe(true);
  });

  it('rejects localized arrays whose length does not match the source', () => {
    const errors = validateCountryRouteDocument(wrap([{
      ...baseRoute(),
      localized: { de: { tags: ['Kultur'] } },
    }]));
    expect(errors.some((error) => error.includes('localized.de.tags length'))).toBe(true);
  });
});

describe('country route map previews', () => {
  it('derives the public image path from the route id', () => {
    expect(getCountryRouteMapImagePath('spain-andalusia-rail'))
      .toBe('/images/trip-maps/routes/spain-andalusia-rail.png');
  });

  it('returns drawable stops in itinerary order', () => {
    const route = baseRoute();
    const stops = getCountryRouteMapStops(route);

    expect(stops?.map((stop) => stop.name)).toEqual(['Tokyo', 'Kyoto']);
    expect(stops?.[0]).toMatchObject({ lat: 35.6762, lng: 139.6503 });
    expect(getCountryRouteUnresolvedStopNames(route)).toEqual([]);
  });

  it('refuses to draw a route with an unresolved stop', () => {
    const route = baseRoute();
    route.stops = [
      { name: 'Tokyo', nights: 2, coordinates: { lat: 35.6762, lng: 139.6503 } },
      { name: 'Nowhere', nights: 1 },
    ];

    expect(getCountryRouteMapStops(route)).toBeNull();
    expect(getCountryRouteUnresolvedStopNames(route)).toEqual(['Nowhere']);
  });

  it('rejects a map path that does not match the route id', () => {
    const route = baseRoute();
    route.mapImagePath = '/images/trip-maps/routes/other-route.png';

    expect(validateCountryRouteDocument(wrap([route])).some((error) => error.includes('mapImagePath must be'))).toBe(true);
  });

  it('rejects a declared map on a route that cannot be drawn', () => {
    const route = baseRoute();
    route.mapImagePath = getCountryRouteMapImagePath(route.id);
    route.stops = [
      { name: 'Tokyo', nights: 2, coordinates: { lat: 35.6762, lng: 139.6503 } },
      { name: 'Nowhere', nights: 1, coordinates: undefined },
    ];

    const errors = validateCountryRouteDocument(wrap([route]));
    expect(errors.some((error) => error.includes('mapImagePath is set but stops are missing coordinates'))).toBe(true);
  });

  it('ships a committed map for every curated route', () => {
    document.routes.forEach((route) => {
      expect(route.mapImagePath, `${route.id} has no map preview`).toBe(getCountryRouteMapImagePath(route.id));
      expect(getCountryRouteMapStops(route), `${route.id} is not drawable`).not.toBeNull();
    });
  });
});

describe('country route helpers', () => {
  it('counts a repeated round-trip stop once', () => {
    const route = baseRoute();
    route.stops = [
      { name: 'Reykjavík', nights: 2, coordinates: { lat: 64.1466, lng: -21.9426 } },
      { name: 'Vík', nights: 2, coordinates: { lat: 63.4187, lng: -19.006 } },
      { name: 'Reykjavík', nights: 1, coordinates: { lat: 64.1466, lng: -21.9426 } },
    ];
    expect(getCountryRouteCityCount(route)).toBe(2);
  });

  it('normalizes stop names for comparison', () => {
    expect(normalizeCountryRouteStopName(' Cefalù ')).toBe('cefalu');
  });
});
