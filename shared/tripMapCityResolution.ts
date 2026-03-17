import type { ICoordinates, ITimelineItem, ITrip } from '../types';

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const dedupeCaseInsensitive = (values: string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(trimmed);
  });

  return unique;
};

const splitQueryList = (value?: string | null): string[] => (
  normalizeText(value)
    .split(/\s*\|\|\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const asStringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map((entry) => normalizeText(entry)).filter(Boolean)
    : []
);

const extractLocationSuffixes = (value: string): string[] => {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return [];

  const suffixes: string[] = [];
  for (let index = 1; index < parts.length; index += 1) {
    const suffix = parts.slice(index).join(', ');
    if (suffix) {
      suffixes.push(suffix);
    }
  }

  return suffixes;
};

const collectLocationContextQueries = (
  items: ITimelineItem[],
  cityId?: string,
): string[] => {
  const queries = items.flatMap((item) => {
    if (item.type !== 'city' || item.id === cityId) return [];
    const location = normalizeText(item.location || item.title);
    if (!location) return [];
    return extractLocationSuffixes(location);
  });

  return dedupeCaseInsensitive(queries);
};

const shouldAppendContext = (location: string, context: string): boolean => {
  const normalizedLocation = location.toLocaleLowerCase();
  const normalizedContext = context.toLocaleLowerCase();
  return normalizedContext.length > 0 && !normalizedLocation.includes(normalizedContext);
};

export const buildTripMapLocationContextQueries = (
  trip: ITrip,
  initialMapFocusQuery?: string | null,
): string[] => {
  const queries: string[] = [...splitQueryList(initialMapFocusQuery)];
  const snapshot = trip.aiMeta?.generation?.inputSnapshot;

  if (snapshot?.destinationLabel) {
    queries.push(snapshot.destinationLabel);
  }

  const payload = asRecord(snapshot?.payload);
  const options = asRecord(payload?.options);
  if (options) {
    queries.push(...asStringArray(options.countries));
    queries.push(...asStringArray(options.destinationOrder));
    queries.push(...asStringArray(options.selectedIslandNames));
    queries.push(...asStringArray(options.specificCities));

    const startDestination = normalizeText(options.startDestination);
    if (startDestination) {
      queries.push(startDestination);
    }
  }

  return dedupeCaseInsensitive(queries);
};

export const buildCityGeocodeQueryCandidates = ({
  city,
  items,
  focusLocationQuery,
}: {
  city: ITimelineItem;
  items: ITimelineItem[];
  focusLocationQuery?: string | null;
}): string[] => {
  const baseLocation = normalizeText(city.location || city.title);
  if (!baseLocation) return [];

  const queries: string[] = [];
  const hasExplicitContext = baseLocation.includes(',');
  if (hasExplicitContext) {
    queries.push(baseLocation);
  }

  const contextQueries = dedupeCaseInsensitive([
    ...splitQueryList(focusLocationQuery),
    ...collectLocationContextQueries(items, city.id),
  ]);

  if (!hasExplicitContext) {
    contextQueries.forEach((contextQuery) => {
      if (!shouldAppendContext(baseLocation, contextQuery)) return;
      queries.push(`${baseLocation}, ${contextQuery}`);
    });
  }

  queries.push(baseLocation);
  return dedupeCaseInsensitive(queries);
};

export const mergeResolvedCityCoordinatesIntoItems = (
  items: ITimelineItem[],
  resolvedCoordinatesByCityId: Record<string, ICoordinates>,
): ITimelineItem[] => (
  items.map((item) => {
    if (item.type !== 'city' || item.coordinates) return item;
    const resolvedCoordinates = resolvedCoordinatesByCityId[item.id];
    if (!resolvedCoordinates) return item;
    return {
      ...item,
      coordinates: resolvedCoordinates,
    };
  })
);

export const resolveMissingCityCoordinatesForItems = async ({
  items,
  focusLocationQuery,
  existingResolvedCoordinatesByCityId,
  resolver,
  cache,
}: {
  items: ITimelineItem[];
  focusLocationQuery?: string | null;
  existingResolvedCoordinatesByCityId?: Record<string, ICoordinates>;
  resolver: (query: string) => Promise<ICoordinates | null>;
  cache?: Map<string, ICoordinates | null>;
}): Promise<Record<string, ICoordinates>> => {
  const resolved: Record<string, ICoordinates> = {};
  const cityItems = items.filter((item): item is ITimelineItem => item.type === 'city');

  for (const city of cityItems) {
    if (city.coordinates) continue;
    if (existingResolvedCoordinatesByCityId?.[city.id]) continue;

    const candidates = buildCityGeocodeQueryCandidates({
      city,
      items: cityItems,
      focusLocationQuery,
    });

    for (const candidate of candidates) {
      const cacheKey = candidate.toLocaleLowerCase();
      let coordinates = cache?.get(cacheKey);
      if (coordinates === undefined) {
        coordinates = await resolver(candidate);
        cache?.set(cacheKey, coordinates ?? null);
      }

      if (!coordinates) continue;
      resolved[city.id] = coordinates;
      break;
    }
  }

  return resolved;
};
