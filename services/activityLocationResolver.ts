import type { ICoordinates, ITimelineItem } from '../types';
import { searchPlaceLocation } from './locationSearchService';
import type { AppLanguage } from '../types';

/**
 * Resolves and caches the position of a timeline item's location.
 *
 * The point of the stored `coordinatesQuery` is that the location service is
 * called once per distinct query and never again: the item carries the query it
 * was resolved from, so reopening the same activity is free, while renaming its
 * location makes the stored position stale and triggers exactly one new lookup.
 *
 * Failures are deliberately not written back to the trip — a network hiccup
 * should not become persisted state — so they live in a session-scoped negative
 * cache that keeps a broken query from retrying on every panel open.
 */

export interface ResolvedItemLocation {
  coordinates: ICoordinates;
  placeId?: string;
}

export type ItemCoordinateUpdate = Pick<
  ITimelineItem,
  'coordinates' | 'coordinatesSource' | 'coordinatesQuery' | 'placeId'
>;

export interface ResolveItemCoordinatesInput {
  item: Pick<
    ITimelineItem,
    'title' | 'location' | 'coordinates' | 'coordinatesSource' | 'coordinatesQuery' | 'placeId'
  >;
  /** City (or other) name used to disambiguate an activity with a bare location. */
  contextLabel?: string;
  /** Owner city position, used to bias the search toward the right part of the world. */
  bias?: ICoordinates | null;
  language?: AppLanguage;
}

const inFlight = new Map<string, Promise<ResolvedItemLocation | null>>();
const failedQueries = new Set<string>();

/** Exposed for tests; a page load starts with empty caches anyway. */
export const resetActivityLocationResolverCache = (): void => {
  inFlight.clear();
  failedQueries.clear();
};

const trimmed = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const normalizeLocationQuery = (query: string): string => (
  query.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
);

const hasFiniteCoordinates = (
  coordinates: ICoordinates | null | undefined,
): coordinates is ICoordinates => (
  Boolean(coordinates)
  && Number.isFinite(coordinates.lat)
  && Number.isFinite(coordinates.lng)
);

/** Word-aware tokens, so "Paris" does not match inside "Parisian". */
const tokenize = (value: string): string[] => (
  value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
);

/**
 * Whether `haystack` already says `needle` as whole words. A plain substring
 * test would drop the owner city from "Parisian Bistro" in Paris and, worse,
 * keep it out of every query for a city whose name is a common word.
 */
const containsPhrase = (haystack: string, needle: string): boolean => {
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return true;
  const haystackTokens = tokenize(haystack);
  return haystackTokens.some((_, index) => (
    needleTokens.every((token, offset) => haystackTokens[index + offset] === token)
  ));
};

/**
 * The text handed to the location service. Title and location together, plus
 * the owner city when the location alone would be ambiguous.
 */
export const buildItemLocationQuery = (input: ResolveItemCoordinatesInput): string => {
  const title = trimmed(input.item.title);
  const location = trimmed(input.item.location);
  const context = trimmed(input.contextLabel);
  const parts: string[] = [];
  if (title) parts.push(title);
  if (location && location.toLocaleLowerCase() !== title.toLocaleLowerCase()) parts.push(location);
  if (context && !parts.some((part) => containsPhrase(part, context))) {
    parts.push(context);
  }
  return parts.join(', ');
};

/**
 * Whether a lookup is worth doing at all. A hand-picked position is never
 * second-guessed, and a position already resolved from the same query stands.
 */
export const needsCoordinateResolution = (input: ResolveItemCoordinatesInput): boolean => {
  const query = buildItemLocationQuery(input);
  if (!query) return false;
  if (input.item.coordinatesSource === 'user') return false;
  if (!hasFiniteCoordinates(input.item.coordinates)) return true;
  return normalizeLocationQuery(query) !== trimmed(input.item.coordinatesQuery);
};

/**
 * Returns the fields to merge into the item, or null when nothing should
 * change. Callers persist the result through the normal item-update path.
 */
export const resolveItemCoordinates = async (
  input: ResolveItemCoordinatesInput,
): Promise<ItemCoordinateUpdate | null> => {
  if (!needsCoordinateResolution(input)) return null;

  const query = buildItemLocationQuery(input);
  const normalizedQuery = normalizeLocationQuery(query);
  if (failedQueries.has(normalizedQuery)) return null;

  let pending = inFlight.get(normalizedQuery);
  if (!pending) {
    pending = searchPlaceLocation(query, { language: input.language, bias: input.bias ?? null })
      .catch(() => null);
    inFlight.set(normalizedQuery, pending);
    // Concurrent callers share the request; the entry is dropped afterwards so
    // the stored query on the item — not this map — is the lasting cache.
    void pending.finally(() => {
      inFlight.delete(normalizedQuery);
    });
  }

  const match = await pending;
  if (!match) {
    failedQueries.add(normalizedQuery);
    return null;
  }

  return {
    coordinates: match.coordinates,
    coordinatesSource: 'places',
    coordinatesQuery: normalizedQuery,
    placeId: match.placeId,
  };
};
