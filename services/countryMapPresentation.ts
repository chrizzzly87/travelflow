/**
 * Pure view-model for the countries explorer map.
 *
 * The map is a *second view of the same state*, never a second source of truth: it takes the
 * already-filtered result list and paints it. Keeping the decision logic here (rather than inside
 * the SVG component) means the map's behaviour is testable without a DOM, and the component that
 * ships in the lazy chunk stays a thin renderer.
 *
 * Tone vocabulary:
 *  - `ideal` / `shoulder` / `avoid` — a guide country that matches the current filters while a
 *    month is selected; the tone is the curated seasonality band for that month.
 *  - `match`  — a guide country that matches the current filters, no month selected.
 *  - `muted`  — a guide country filtered out by the current search/filters. Still reachable, but
 *    visually receded so the map agrees with the grid.
 *  - `land`   — a country we have no guide for. Rendered, but never interactive.
 */

import type { CountryExplorerEntry, CountrySeasonBand } from './countryExplorerService';
import { getSeasonBand } from './countryExplorerService';

export type CountryMapTone = CountrySeasonBand | 'match' | 'muted' | 'land';

export interface CountryMapNode {
  countryCode: string;
  /** Localized or editorial country name when we have a guide, otherwise the atlas name. */
  name: string;
  tone: CountryMapTone;
  /** True only for countries that have a guide; drives pointer/keyboard affordances. */
  hasGuide: boolean;
  /** True when the country survives the current search + filters. */
  inResults: boolean;
}

export interface CountryMapProjection {
  width: number;
  height: number;
  minLatitude: number;
  maxLatitude: number;
}

export interface BuildCountryMapNodesInput {
  /** Country codes that have drawable geometry, in render order. */
  geometryCodes: Iterable<{ countryCode: string; name: string }>;
  /** Every country that has a guide, keyed by ISO alpha-2. */
  guidesByCountryCode: ReadonlyMap<string, CountryExplorerEntry>;
  /** Country codes currently surviving the filters. */
  visibleCountryCodes: ReadonlySet<string>;
  month: number | null;
}

export const resolveCountryMapTone = (
  entry: CountryExplorerEntry | undefined,
  inResults: boolean,
  month: number | null,
): CountryMapTone => {
  if (!entry) return 'land';
  if (!inResults) return 'muted';
  if (month === null) return 'match';
  return getSeasonBand(entry, month);
};

export const buildCountryMapNodes = ({
  geometryCodes,
  guidesByCountryCode,
  visibleCountryCodes,
  month,
}: BuildCountryMapNodesInput): CountryMapNode[] => {
  const nodes: CountryMapNode[] = [];
  for (const geometry of geometryCodes) {
    const entry = guidesByCountryCode.get(geometry.countryCode);
    const inResults = visibleCountryCodes.has(geometry.countryCode);
    nodes.push({
      countryCode: geometry.countryCode,
      name: entry?.name || geometry.name,
      tone: resolveCountryMapTone(entry, inResults, month),
      hasGuide: Boolean(entry),
      inResults: Boolean(entry) && inResults,
    });
  }
  return nodes;
};

/**
 * Guide countries that the 1:110m atlas is too coarse to draw (Singapore, Maldives, Barbados,
 * Seychelles, Mauritius, …). Without this they would be invisible on the map even though they
 * appear in the grid, so they are rendered as anchor dots instead of being dropped.
 */
export const listCountriesNeedingMarker = (
  guidesByCountryCode: ReadonlyMap<string, CountryExplorerEntry>,
  geometryCountryCodes: ReadonlySet<string>,
): string[] => (
  Array.from(guidesByCountryCode.keys())
    .filter((countryCode) => !geometryCountryCodes.has(countryCode))
    .sort()
);

/**
 * Plate-carrée projection matching the one baked into `data/countryMapGeometry.generated.json`.
 * Returns `null` outside the rendered latitude band so a marker can never be pinned to the edge
 * of the map at a latitude the map does not actually cover.
 */
export const projectToMapPoint = (
  latitude: number,
  longitude: number,
  projection: CountryMapProjection,
): { x: number; y: number } | null => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude > projection.maxLatitude || latitude < projection.minLatitude) return null;
  if (longitude < -180 || longitude > 180) return null;
  return {
    x: ((longitude + 180) / 360) * projection.width,
    y: (
      (projection.maxLatitude - latitude) / (projection.maxLatitude - projection.minLatitude)
    ) * projection.height,
  };
};

/**
 * Tab order for the map's roving-tabindex keyboard navigation: west to east, then north to south.
 * Reading the world left-to-right is the least surprising order for a map, and it is stable, so
 * the focus ring never jumps around when filters change.
 */
export const sortCountryCodesForKeyboardNavigation = (
  countryCodes: Iterable<string>,
  pointByCountryCode: ReadonlyMap<string, { x: number; y: number }>,
): string[] => (
  Array.from(countryCodes).sort((left, right) => {
    const leftPoint = pointByCountryCode.get(left);
    const rightPoint = pointByCountryCode.get(right);
    if (!leftPoint && !rightPoint) return left.localeCompare(right);
    if (!leftPoint) return 1;
    if (!rightPoint) return -1;
    if (leftPoint.x !== rightPoint.x) return leftPoint.x - rightPoint.x;
    if (leftPoint.y !== rightPoint.y) return leftPoint.y - rightPoint.y;
    return left.localeCompare(right);
  })
);
