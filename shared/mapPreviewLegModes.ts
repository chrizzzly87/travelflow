/**
 * `legModes` is the per-leg transport mode carried by static map preview URLs.
 *
 * Preview cards used to send coordinates only, so the renderer had no way to
 * tell a flight from a road trip and asked a routing provider for driving
 * directions on every leg. Flights have no driving route, so they silently
 * degraded to straight lines while the planner map drew an arc.
 */

import { normalizeTransportMode, type TransportMode } from './transportModes.ts';

export const MAP_PREVIEW_LEG_MODES_PARAM = 'legModes';

/** Legs with no known mode stay `na` and keep the provider-routed geometry. */
export const serializeMapPreviewLegModes = (modes: Array<TransportMode | null | undefined>): string =>
  modes.map((mode) => (mode ? normalizeTransportMode(mode) : 'na')).join('|');

export const parseMapPreviewLegModes = (value: string | null): TransportMode[] => {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeTransportMode(entry));
};

export const isFlightLegMode = (modes: TransportMode[], index: number): boolean =>
  modes[index] === 'plane';
