import { describe, expect, it } from 'vitest';

import {
  buildCountryRouteExampleCard,
  buildCountryRouteMiniCalendar,
  buildCountryRoutePrefill,
  buildCountryRoutePrefillUrl,
  getCountryRouteById,
  getCountryRoutes,
  getLocalizedCountryRoute,
  hasCountryRoutes,
} from '../../services/countryRouteService';
import { decodeTripPrefill } from '../../services/tripPrefillDecoder';

describe('countryRouteService lookups', () => {
  it('finds routes by ISO code, guide slug and country name', () => {
    const byCode = getCountryRoutes('JP');
    const bySlug = getCountryRoutes('japan');
    const byName = getCountryRoutes('Japan');

    expect(byCode).toHaveLength(3);
    expect(bySlug.map((route) => route.id)).toEqual(byCode.map((route) => route.id));
    expect(byName.map((route) => route.id)).toEqual(byCode.map((route) => route.id));
  });

  it('returns routes ordered by featured rank', () => {
    expect(getCountryRoutes('italy').map((route) => route.featuredRank)).toEqual([1, 2, 3]);
  });

  it('returns an empty list for countries without curated routes', () => {
    expect(getCountryRoutes('Germany')).toEqual([]);
    expect(getCountryRoutes('')).toEqual([]);
    expect(hasCountryRoutes('Germany')).toBe(false);
    expect(hasCountryRoutes('thailand')).toBe(true);
  });

  it('looks a route up by id', () => {
    expect(getCountryRouteById('iceland-ring-road')?.countryCode).toBe('IS');
    expect(getCountryRouteById('nope')).toBeUndefined();
  });
});

describe('countryRouteService localization', () => {
  it('uses the requested locale and falls back to English', () => {
    const route = getCountryRouteById('japan-golden-route');
    expect(route).toBeDefined();

    const german = getLocalizedCountryRoute(route!, 'de-DE');
    expect(german.title).toBe('Klassische Goldene Route');
    expect(german.pitch).not.toBe(route!.pitch);

    const korean = getLocalizedCountryRoute(route!, 'ko');
    expect(korean.title).toBe(route!.title);
    expect(korean.stops).toEqual(route!.stops.map((stop) => stop.name));
  });
});

describe('countryRouteService card adapter', () => {
  it('maps a route onto the example trip card contract', () => {
    const route = getCountryRouteById('iceland-ring-road')!;
    const card = buildCountryRouteExampleCard(route);

    expect(card.id).toBe(route.id);
    expect(card.countries).toEqual([{ name: 'Iceland', flag: 'IS' }]);
    expect(card.durationDays).toBe(route.durationDays);
    // Reykjavík appears twice in the stop list but counts once.
    expect(card.cityCount).toBe(5);
    expect(card.isRoundTrip).toBe(true);
    expect(card.username).toBe('travelflow');
    expect(card.mapImagePath).toBeUndefined();
  });

  it('builds mini calendar lanes that reuse a colour for repeated stops', () => {
    const route = getCountryRouteById('iceland-ring-road')!;
    const { cityLanes, routeLanes } = buildCountryRouteMiniCalendar(route);

    expect(cityLanes).toHaveLength(route.stops.length);
    expect(routeLanes).toHaveLength(route.stops.length - 1);
    expect(cityLanes[0].color).toBe(cityLanes[cityLanes.length - 1].color);
    expect(cityLanes[0].color).not.toBe(cityLanes[1].color);
    expect(cityLanes.map((lane) => lane.title)).toEqual(route.stops.map((stop) => stop.name));
  });
});

describe('countryRouteService prefill', () => {
  it('emits both the structured and legacy city representations in order', () => {
    const route = getCountryRouteById('japan-golden-route')!;
    const prefill = buildCountryRoutePrefill(route);

    expect(prefill.cityList).toEqual(['Tokyo', 'Hakone', 'Kyoto', 'Osaka']);
    expect(prefill.cities).toBe('Tokyo, Hakone, Kyoto, Osaka');
    expect(prefill.countries).toEqual(['Japan']);
    expect(prefill.pace).toBe('Balanced');
    expect(prefill.meta).toMatchObject({ source: 'country_route', routeId: 'japan-golden-route' });
  });

  it('round-trips the full ordered city list through the create-trip URL', () => {
    const route = getCountryRouteById('italy-sicily-loop')!;
    const url = buildCountryRoutePrefillUrl(route);
    const encoded = new URL(url, 'https://travelflow.test').searchParams.get('prefill');

    expect(encoded).toBeTruthy();
    const decoded = decodeTripPrefill(encoded!);

    expect(decoded?.cityList).toEqual(['Palermo', 'Cefalù', 'Catania', 'Taormina', 'Syracuse', 'Palermo']);
    expect(decoded?.cities).toBe('Palermo, Cefalù, Catania, Taormina, Syracuse, Palermo');
    expect(decoded?.countries).toEqual(['Italy']);
    expect(decoded?.roundTrip).toBe(true);
  });
});
