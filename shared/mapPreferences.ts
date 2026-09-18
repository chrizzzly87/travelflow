import type {
  IMapCustomization,
  IUserSettings,
  IViewSettings,
  MapBaseSurface,
  MapColorMode,
  MapColorTheme,
  MapHandoffTarget,
  MapLightPreset,
  MapRendererChoice,
  MapRouteThickness,
  MapStyle,
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

  base: MapBaseSurface;
  colorTheme: MapColorTheme;
  lightPreset: MapLightPreset;

  routeMode: RouteMode;
  colorMode: MapColorMode;
  cityFocusMode: boolean;

  showCityNames: boolean;
  showPlaceLabels: boolean;
  showRoadLabels: boolean;
  showTransitLabels: boolean;
  showPoiLabels: boolean;
  showRoadsAndTransit: boolean;
  showPedestrianRoads: boolean;
  showAdminBoundaries: boolean;
  show3dObjects: boolean;
  showTerrain: boolean;
  showTraffic: boolean;
  showTransitLines: boolean;

  showActivityMarkers: boolean;
  dimPastDays: boolean;
  routeThickness: MapRouteThickness;
  showRouteArrows: boolean;
  dashedRoutes: boolean;

  useGlobeProjection: boolean;
  pitch: number;
}

export const DEFAULT_MAP_PREFERENCES: ResolvedMapPreferences = {
  renderer: 'auto',
  handoffTarget: 'google',

  base: 'map',
  colorTheme: 'default',
  lightPreset: 'auto',

  routeMode: 'simple',
  colorMode: 'trip',
  cityFocusMode: true,

  showCityNames: true,
  showPlaceLabels: true,
  showRoadLabels: false,
  showTransitLabels: false,
  showPoiLabels: false,
  showRoadsAndTransit: true,
  showPedestrianRoads: true,
  showAdminBoundaries: false,
  show3dObjects: false,
  showTerrain: false,
  showTraffic: false,
  showTransitLines: false,

  showActivityMarkers: true,
  dimPastDays: false,
  routeThickness: 'normal',
  showRouteArrows: true,
  dashedRoutes: false,

  useGlobeProjection: false,
  pitch: 0,
};

/** Tilt steps, rather than a slider: nobody wants 37 degrees. */
export const MAP_PITCH_STEPS = [0, 30, 45, 60] as const;

export const MAP_ROUTE_THICKNESS_MULTIPLIER: Record<MapRouteThickness, number> = {
  thin: 0.7,
  normal: 1,
  thick: 1.5,
};

const BASE_SURFACES: readonly MapBaseSurface[] = ['map', 'satellite'];
const COLOR_THEMES: readonly MapColorTheme[] = ['default', 'faded', 'monochrome'];
const LIGHT_PRESETS: readonly MapLightPreset[] = ['auto', 'dawn', 'day', 'dusk', 'night'];
const ROUTE_THICKNESSES: readonly MapRouteThickness[] = ['thin', 'normal', 'thick'];
const RENDERER_CHOICES: readonly MapRendererChoice[] = ['auto', 'google', 'mapbox'];
const HANDOFF_TARGETS: readonly MapHandoffTarget[] = ['google', 'apple'];
const ROUTE_MODES: readonly RouteMode[] = ['simple', 'realistic'];
const COLOR_MODES: readonly MapColorMode[] = ['brand', 'trip'];
const MAP_STYLES: readonly MapStyle[] = ['minimal', 'standard', 'dark', 'satellite', 'clean', 'cleanDark'];

const pickFrom = <T,>(allowed: readonly T[], value: unknown): T | undefined => (
  allowed.includes(value as T) ? (value as T) : undefined
);

const pickBoolean = (value: unknown): boolean | undefined => (
  typeof value === 'boolean' ? value : undefined
);

const pickPitch = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(60, Math.max(0, value));
};

/**
 * The axes a legacy `MapStyle` stands for. Old trips carry only the named
 * style, so this is how they open in the new sheet without a migration.
 */
export const MAP_STYLE_TO_AXES: Record<MapStyle, {
  base: MapBaseSurface;
  colorTheme: MapColorTheme;
  lightPreset: MapLightPreset;
}> = {
  standard: { base: 'map', colorTheme: 'default', lightPreset: 'day' },
  minimal: { base: 'map', colorTheme: 'monochrome', lightPreset: 'day' },
  clean: { base: 'map', colorTheme: 'faded', lightPreset: 'day' },
  dark: { base: 'map', colorTheme: 'default', lightPreset: 'dusk' },
  cleanDark: { base: 'map', colorTheme: 'monochrome', lightPreset: 'night' },
  satellite: { base: 'satellite', colorTheme: 'default', lightPreset: 'day' },
};

/**
 * The nearest named style for a set of axes.
 *
 * Google renders from the six hand-tuned style arrays and has no equivalent of
 * the axes, so every combination has to land on one of them. Dawn has no Google
 * counterpart and reads closest to day; dusk and night both go dark.
 */
export const resolveMapStyleFromAxes = ({
  base,
  colorTheme,
  lightPreset,
  prefersDarkScheme = false,
}: {
  base: MapBaseSurface;
  colorTheme: MapColorTheme;
  lightPreset: MapLightPreset;
  prefersDarkScheme?: boolean;
}): MapStyle => {
  if (base === 'satellite') return 'satellite';

  const effectiveLight = lightPreset === 'auto'
    ? (prefersDarkScheme ? 'night' : 'day')
    : lightPreset;
  const isDark = effectiveLight === 'dusk' || effectiveLight === 'night';

  if (isDark) return colorTheme === 'default' ? 'dark' : 'cleanDark';
  if (colorTheme === 'monochrome') return 'minimal';
  if (colorTheme === 'faded') return 'clean';
  return 'standard';
};

/** The light preset actually handed to Mapbox, with `auto` resolved. */
export const resolveEffectiveLightPreset = (
  lightPreset: MapLightPreset,
  prefersDarkScheme: boolean,
): Exclude<MapLightPreset, 'auto'> => {
  if (lightPreset !== 'auto') return lightPreset;
  return prefersDarkScheme ? 'night' : 'day';
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

    base: pickFrom(BASE_SURFACES, raw.base),
    colorTheme: pickFrom(COLOR_THEMES, raw.colorTheme),
    lightPreset: pickFrom(LIGHT_PRESETS, raw.lightPreset),

    cityFocusMode: pickBoolean(raw.cityFocusMode),

    showPlaceLabels: pickBoolean(raw.showPlaceLabels),
    showRoadLabels: pickBoolean(raw.showRoadLabels),
    showTransitLabels: pickBoolean(raw.showTransitLabels),
    showPoiLabels: pickBoolean(raw.showPoiLabels),
    showRoadsAndTransit: pickBoolean(raw.showRoadsAndTransit),
    showPedestrianRoads: pickBoolean(raw.showPedestrianRoads),
    showAdminBoundaries: pickBoolean(raw.showAdminBoundaries),
    show3dObjects: pickBoolean(raw.show3dObjects),
    showTerrain: pickBoolean(raw.showTerrain),
    showTraffic: pickBoolean(raw.showTraffic),
    showTransitLines: pickBoolean(raw.showTransitLines),

    showActivityMarkers: pickBoolean(raw.showActivityMarkers),
    dimPastDays: pickBoolean(raw.dimPastDays),
    routeThickness: pickFrom(ROUTE_THICKNESSES, raw.routeThickness),
    showRouteArrows: pickBoolean(raw.showRouteArrows),
    dashedRoutes: pickBoolean(raw.dashedRoutes),

    useGlobeProjection: pickBoolean(raw.useGlobeProjection),
    pitch: pickPitch(raw.pitch),
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

  // A trip saved before the axes existed carries only a named style. Decomposing
  // it here is what lets it open in the new sheet without a migration.
  const legacyStyle = pickFrom(MAP_STYLES, viewSettings?.mapStyle)
    ?? pickFrom(MAP_STYLES, userSettings?.mapStyle);
  const legacyAxes = legacyStyle ? MAP_STYLE_TO_AXES[legacyStyle] : null;

  return {
    renderer: nested('renderer') ?? DEFAULT_MAP_PREFERENCES.renderer,
    handoffTarget: nested('handoffTarget') ?? DEFAULT_MAP_PREFERENCES.handoffTarget,

    base: nested('base') ?? legacyAxes?.base ?? DEFAULT_MAP_PREFERENCES.base,
    colorTheme: nested('colorTheme') ?? legacyAxes?.colorTheme ?? DEFAULT_MAP_PREFERENCES.colorTheme,
    lightPreset: nested('lightPreset') ?? legacyAxes?.lightPreset ?? DEFAULT_MAP_PREFERENCES.lightPreset,

    cityFocusMode: nested('cityFocusMode') ?? DEFAULT_MAP_PREFERENCES.cityFocusMode,

    showPlaceLabels: nested('showPlaceLabels') ?? DEFAULT_MAP_PREFERENCES.showPlaceLabels,
    showRoadLabels: nested('showRoadLabels') ?? DEFAULT_MAP_PREFERENCES.showRoadLabels,
    showTransitLabels: nested('showTransitLabels') ?? DEFAULT_MAP_PREFERENCES.showTransitLabels,
    showPoiLabels: nested('showPoiLabels') ?? DEFAULT_MAP_PREFERENCES.showPoiLabels,
    showRoadsAndTransit: nested('showRoadsAndTransit') ?? DEFAULT_MAP_PREFERENCES.showRoadsAndTransit,
    showPedestrianRoads: nested('showPedestrianRoads') ?? DEFAULT_MAP_PREFERENCES.showPedestrianRoads,
    showAdminBoundaries: nested('showAdminBoundaries') ?? DEFAULT_MAP_PREFERENCES.showAdminBoundaries,
    show3dObjects: nested('show3dObjects') ?? DEFAULT_MAP_PREFERENCES.show3dObjects,
    showTerrain: nested('showTerrain') ?? DEFAULT_MAP_PREFERENCES.showTerrain,
    showTraffic: nested('showTraffic') ?? DEFAULT_MAP_PREFERENCES.showTraffic,
    showTransitLines: nested('showTransitLines') ?? DEFAULT_MAP_PREFERENCES.showTransitLines,

    showActivityMarkers: nested('showActivityMarkers') ?? DEFAULT_MAP_PREFERENCES.showActivityMarkers,
    dimPastDays: nested('dimPastDays') ?? DEFAULT_MAP_PREFERENCES.dimPastDays,
    routeThickness: nested('routeThickness') ?? DEFAULT_MAP_PREFERENCES.routeThickness,
    showRouteArrows: nested('showRouteArrows') ?? DEFAULT_MAP_PREFERENCES.showRouteArrows,
    dashedRoutes: nested('dashedRoutes') ?? DEFAULT_MAP_PREFERENCES.dashedRoutes,

    useGlobeProjection: nested('useGlobeProjection') ?? DEFAULT_MAP_PREFERENCES.useGlobeProjection,
    pitch: nested('pitch') ?? DEFAULT_MAP_PREFERENCES.pitch,

    // The flat fields keep their existing homes and their existing precedence.
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
 * Named shortcuts over the axes. The sheet keeps these as one-tap presets so
 * nothing got harder for someone who just wants "the clean dark one".
 */
export const MAP_STYLE_PRESETS: Array<{
  id: MapStyle;
  base: MapBaseSurface;
  colorTheme: MapColorTheme;
  lightPreset: MapLightPreset;
}> = (Object.keys(MAP_STYLE_TO_AXES) as MapStyle[]).map((id) => ({
  id,
  ...MAP_STYLE_TO_AXES[id],
}));

export const matchMapStylePreset = (
  preferences: Pick<ResolvedMapPreferences, 'base' | 'colorTheme' | 'lightPreset'>,
): MapStyle | null => (
  MAP_STYLE_PRESETS.find((preset) => (
    preset.base === preferences.base
    && preset.colorTheme === preferences.colorTheme
    && preset.lightPreset === preferences.lightPreset
  ))?.id ?? null
);

/**
 * The sheet's current state as a storable object, with anything still at its
 * default left out. Storing only what was actually chosen keeps a trip
 * following the app's defaults as they change, rather than freezing today's.
 */
export const toStoredMapCustomization = (
  preferences: ResolvedMapPreferences,
): IMapCustomization => {
  const stored: IMapCustomization = {};
  const keys = Object.keys(DEFAULT_MAP_PREFERENCES) as Array<keyof ResolvedMapPreferences>;

  keys.forEach((key) => {
    // These three live on `IViewSettings`, not in this object.
    if (key === 'routeMode' || key === 'colorMode' || key === 'showCityNames') return;
    if (preferences[key] === DEFAULT_MAP_PREFERENCES[key]) return;
    (stored as Record<string, unknown>)[key] = preferences[key];
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
