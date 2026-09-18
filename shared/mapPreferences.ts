import type {
  IMapCustomization,
  IUserSettings,
  IViewSettings,
  MapColorMode,
  MapHandoffTarget,
  MapRendererChoice,
  MapStyle,
  MapThemeMode,
  RouteMode,
} from '../types';

/**
 * One map look, resolved from three places.
 *
 * The customize sheet writes to two shapes at once: the flat fields that have
 * always lived on `IViewSettings` (`mapStyle`, `routeMode`, `showCityNames`)
 * and the nested `mapCustomization` object that carries everything new. Nothing
 * migrates — this module is the only place that knows about both, so every
 * reader downstream sees a single fully-populated object.
 *
 * Precedence: the trip's own settings win over the traveller's default, which
 * wins over the app's. A shared trip therefore opens looking the way its author
 * left it, which is the point of storing the look on the trip at all.
 */

export interface ResolvedMapPreferences {
  renderer: MapRendererChoice;
  handoffTarget: MapHandoffTarget;
  themeMode: MapThemeMode;
  mapStyle: MapStyle;
  routeMode: RouteMode;
  colorMode: MapColorMode;
  showCityNames: boolean;
  cityFocusMode: boolean;
  showActivityMarkers: boolean;
  showPoiLabels: boolean;
  showRoadsAndTransit: boolean;
  showAdminBoundaries: boolean;
  showTerrain: boolean;
  useGlobeProjection: boolean;
  pitch: number;
  routeLineWeight: number;
}

export const DEFAULT_MAP_PREFERENCES: ResolvedMapPreferences = {
  renderer: 'auto',
  handoffTarget: 'google',
  themeMode: 'auto',
  mapStyle: 'standard',
  routeMode: 'simple',
  colorMode: 'trip',
  showCityNames: true,
  cityFocusMode: true,
  showActivityMarkers: true,
  showPoiLabels: false,
  showRoadsAndTransit: true,
  showAdminBoundaries: false,
  showTerrain: false,
  useGlobeProjection: false,
  pitch: 0,
  routeLineWeight: 1,
};

export const MAP_PITCH_RANGE = { min: 0, max: 60 } as const;
export const MAP_ROUTE_LINE_WEIGHT_RANGE = { min: 0.5, max: 2 } as const;

const MAP_STYLES: readonly MapStyle[] = ['minimal', 'standard', 'dark', 'satellite', 'clean', 'cleanDark'];
const RENDERER_CHOICES: readonly MapRendererChoice[] = ['auto', 'google', 'mapbox'];
const HANDOFF_TARGETS: readonly MapHandoffTarget[] = ['google', 'apple'];
const THEME_MODES: readonly MapThemeMode[] = ['light', 'dark', 'auto'];
const ROUTE_MODES: readonly RouteMode[] = ['simple', 'realistic'];
const COLOR_MODES: readonly MapColorMode[] = ['brand', 'trip'];

const pickFrom = <T,>(allowed: readonly T[], value: unknown): T | undefined => (
  allowed.includes(value as T) ? (value as T) : undefined
);

const pickBoolean = (value: unknown): boolean | undefined => (
  typeof value === 'boolean' ? value : undefined
);

const pickNumberInRange = (
  value: unknown,
  { min, max }: { min: number; max: number },
): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
};

/**
 * Drops anything unrecognised. These objects round-trip through storage and
 * through a shared trip's payload, so a stale or hand-edited field must never
 * reach the map.
 */
export const normalizeMapCustomization = (value: unknown): IMapCustomization => {
  if (typeof value !== 'object' || value === null) return {};
  const raw = value as Record<string, unknown>;

  const normalized: IMapCustomization = {
    renderer: pickFrom(RENDERER_CHOICES, raw.renderer),
    handoffTarget: pickFrom(HANDOFF_TARGETS, raw.handoffTarget),
    themeMode: pickFrom(THEME_MODES, raw.themeMode),
    cityFocusMode: pickBoolean(raw.cityFocusMode),
    showActivityMarkers: pickBoolean(raw.showActivityMarkers),
    showPoiLabels: pickBoolean(raw.showPoiLabels),
    showRoadsAndTransit: pickBoolean(raw.showRoadsAndTransit),
    showAdminBoundaries: pickBoolean(raw.showAdminBoundaries),
    showTerrain: pickBoolean(raw.showTerrain),
    useGlobeProjection: pickBoolean(raw.useGlobeProjection),
    pitch: pickNumberInRange(raw.pitch, MAP_PITCH_RANGE),
    routeLineWeight: pickNumberInRange(raw.routeLineWeight, MAP_ROUTE_LINE_WEIGHT_RANGE),
  };

  // An explicit `undefined` key is not the same as an absent one once these
  // objects are merged, so the undefined entries are stripped rather than kept.
  (Object.keys(normalized) as Array<keyof IMapCustomization>).forEach((key) => {
    if (normalized[key] === undefined) delete normalized[key];
  });

  return normalized;
};

export const resolveMapPreferences = ({
  viewSettings,
  userSettings,
  tripColorMode,
}: {
  viewSettings?: Partial<IViewSettings> | null;
  userSettings?: Partial<IUserSettings> | null;
  /** Lives on the trip itself rather than on its view settings. */
  tripColorMode?: MapColorMode | null;
} = {}): ResolvedMapPreferences => {
  const tripCustomization = normalizeMapCustomization(viewSettings?.mapCustomization);
  const userCustomization = normalizeMapCustomization(userSettings?.mapCustomization);

  const nested = <K extends keyof IMapCustomization>(key: K): IMapCustomization[K] => (
    tripCustomization[key] ?? userCustomization[key]
  );

  return {
    renderer: nested('renderer') ?? DEFAULT_MAP_PREFERENCES.renderer,
    handoffTarget: nested('handoffTarget') ?? DEFAULT_MAP_PREFERENCES.handoffTarget,
    themeMode: nested('themeMode') ?? DEFAULT_MAP_PREFERENCES.themeMode,
    cityFocusMode: nested('cityFocusMode') ?? DEFAULT_MAP_PREFERENCES.cityFocusMode,
    showActivityMarkers: nested('showActivityMarkers') ?? DEFAULT_MAP_PREFERENCES.showActivityMarkers,
    showPoiLabels: nested('showPoiLabels') ?? DEFAULT_MAP_PREFERENCES.showPoiLabels,
    showRoadsAndTransit: nested('showRoadsAndTransit') ?? DEFAULT_MAP_PREFERENCES.showRoadsAndTransit,
    showAdminBoundaries: nested('showAdminBoundaries') ?? DEFAULT_MAP_PREFERENCES.showAdminBoundaries,
    showTerrain: nested('showTerrain') ?? DEFAULT_MAP_PREFERENCES.showTerrain,
    useGlobeProjection: nested('useGlobeProjection') ?? DEFAULT_MAP_PREFERENCES.useGlobeProjection,
    pitch: nested('pitch') ?? DEFAULT_MAP_PREFERENCES.pitch,
    routeLineWeight: nested('routeLineWeight') ?? DEFAULT_MAP_PREFERENCES.routeLineWeight,

    // The flat fields keep their existing homes and their existing precedence.
    mapStyle: pickFrom(MAP_STYLES, viewSettings?.mapStyle)
      ?? pickFrom(MAP_STYLES, userSettings?.mapStyle)
      ?? DEFAULT_MAP_PREFERENCES.mapStyle,
    routeMode: pickFrom(ROUTE_MODES, viewSettings?.routeMode)
      ?? pickFrom(ROUTE_MODES, userSettings?.routeMode)
      ?? DEFAULT_MAP_PREFERENCES.routeMode,
    colorMode: pickFrom(COLOR_MODES, tripColorMode) ?? DEFAULT_MAP_PREFERENCES.colorMode,
    showCityNames: pickBoolean(viewSettings?.showCityNames)
      ?? pickBoolean(userSettings?.showCityNames)
      ?? DEFAULT_MAP_PREFERENCES.showCityNames,
  };
};

/**
 * The customize sheet's current state as a storable object, with anything still
 * at its default left out. Storing only what was actually chosen keeps a trip
 * following the app's defaults as they change, rather than freezing today's.
 */
export const toStoredMapCustomization = (
  preferences: ResolvedMapPreferences,
): IMapCustomization => {
  const stored: IMapCustomization = {};
  const keys: Array<keyof IMapCustomization> = [
    'renderer',
    'handoffTarget',
    'themeMode',
    'cityFocusMode',
    'showActivityMarkers',
    'showPoiLabels',
    'showRoadsAndTransit',
    'showAdminBoundaries',
    'showTerrain',
    'useGlobeProjection',
    'pitch',
    'routeLineWeight',
  ];

  keys.forEach((key) => {
    const value = preferences[key as keyof ResolvedMapPreferences];
    if (value === DEFAULT_MAP_PREFERENCES[key as keyof ResolvedMapPreferences]) return;
    (stored as Record<string, unknown>)[key] = value;
  });

  return stored;
};

/** Round-trips a look between trips and between people, for copy/paste. */
export const serializeMapPreset = (preferences: ResolvedMapPreferences): string => (
  JSON.stringify({ version: 1, preset: toStoredMapCustomization(preferences) }, null, 2)
);

export const parseMapPreset = (value: string): IMapCustomization | null => {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const preset = normalizeMapCustomization(parsed.preset ?? parsed);
    return Object.keys(preset).length > 0 ? preset : null;
  } catch {
    return null;
  }
};

/**
 * Light and dark counterparts of each style.
 *
 * Satellite is its own pair: imagery has no dark variant, and swapping it for a
 * vector style because the device is in dark mode would silently discard the
 * thing the traveller actually picked.
 */
const MAP_STYLE_DARK_COUNTERPART: Record<MapStyle, MapStyle> = {
  standard: 'dark',
  minimal: 'dark',
  clean: 'cleanDark',
  dark: 'dark',
  cleanDark: 'cleanDark',
  satellite: 'satellite',
};

const MAP_STYLE_LIGHT_COUNTERPART: Record<MapStyle, MapStyle> = {
  standard: 'standard',
  minimal: 'minimal',
  clean: 'clean',
  dark: 'standard',
  cleanDark: 'clean',
  satellite: 'satellite',
};

/**
 * The style actually handed to the renderer, once the light/dark preference has
 * had its say. `auto` follows the device; the explicit modes override it.
 */
export const resolveEffectiveMapStyle = ({
  mapStyle,
  themeMode,
  prefersDarkScheme,
}: {
  mapStyle: MapStyle;
  themeMode: MapThemeMode;
  prefersDarkScheme: boolean;
}): MapStyle => {
  const wantsDark = themeMode === 'dark' || (themeMode === 'auto' && prefersDarkScheme);
  return wantsDark
    ? MAP_STYLE_DARK_COUNTERPART[mapStyle]
    : MAP_STYLE_LIGHT_COUNTERPART[mapStyle];
};
