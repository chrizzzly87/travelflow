export const MAP_RUNTIME_OVERRIDE_COOKIE_NAME = 'tf_debug_map_runtime_override_v1';
export const MAP_RUNTIME_CACHE_KEY_QUERY_PARAM = 'mr';

export type MapImplementation = 'google' | 'mapbox';
export type MapSubsystem = 'renderer' | 'routes' | 'locationSearch' | 'staticMaps';
export type MapRuntimePreset = 'google_all' | 'mapbox_visual_google_services' | 'mapbox_all';

export interface MapRuntimeSelection {
  renderer: MapImplementation;
  routes: MapImplementation;
  locationSearch: MapImplementation;
  staticMaps: MapImplementation;
}

export interface MapRuntimeAvailability {
  googleMapsKeyAvailable: boolean;
  mapboxAccessTokenAvailable: boolean;
}

export interface MapRuntimeOverride {
  preset?: MapRuntimePreset | 'default';
  selection?: Partial<MapRuntimeSelection>;
}

export interface MapRuntimeResolution {
  defaultPreset: MapRuntimePreset;
  requestedPreset: MapRuntimePreset;
  requestedSelection: MapRuntimeSelection;
  effectiveSelection: MapRuntimeSelection;
  effectivePresetMatch: MapRuntimePreset | null;
  override: MapRuntimeOverride | null;
  overrideSource: 'default' | 'cookie' | 'query';
  warnings: string[];
  availability: MapRuntimeAvailability;
  activeSelectionKey: string;
  implementationCapabilities: Record<MapImplementation, Record<MapSubsystem, boolean>>;
}

export const MAP_RUNTIME_SUBSYSTEMS: readonly MapSubsystem[] = [
  'renderer',
  'routes',
  'locationSearch',
  'staticMaps',
] as const;

export const MAP_RUNTIME_PRESET_TO_SELECTION: Record<MapRuntimePreset, MapRuntimeSelection> = {
  google_all: {
    renderer: 'google',
    routes: 'google',
    locationSearch: 'google',
    staticMaps: 'google',
  },
  mapbox_visual_google_services: {
    renderer: 'mapbox',
    routes: 'google',
    locationSearch: 'google',
    staticMaps: 'mapbox',
  },
  mapbox_all: {
    renderer: 'mapbox',
    routes: 'mapbox',
    locationSearch: 'mapbox',
    staticMaps: 'mapbox',
  },
};

export const MAP_IMPLEMENTATION_CAPABILITIES: Record<MapImplementation, Record<MapSubsystem, boolean>> = {
  google: {
    renderer: true,
    routes: true,
    locationSearch: true,
    staticMaps: true,
  },
  mapbox: {
    renderer: true,
    routes: false,
    locationSearch: false,
    staticMaps: true,
  },
};

const MAP_IMPLEMENTATION_CACHE_CODES: Record<MapImplementation, string> = {
  google: 'g',
  mapbox: 'm',
};

const MAP_IMPLEMENTATION_FROM_CACHE_CODE: Record<string, MapImplementation> = {
  g: 'google',
  m: 'mapbox',
};

export const isMapImplementation = (value: unknown): value is MapImplementation =>
  value === 'google' || value === 'mapbox';

export const isMapRuntimePreset = (value: unknown): value is MapRuntimePreset =>
  value === 'google_all'
  || value === 'mapbox_visual_google_services'
  || value === 'mapbox_all';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeMapRuntimePreset = (value: unknown): MapRuntimePreset => (
  isMapRuntimePreset(value) ? value : 'google_all'
);

export const getSelectionForMapRuntimePreset = (preset: MapRuntimePreset): MapRuntimeSelection => ({
  ...MAP_RUNTIME_PRESET_TO_SELECTION[preset],
});

export const identifyMapRuntimePreset = (
  selection: MapRuntimeSelection,
): MapRuntimePreset | null => {
  const entries = Object.entries(MAP_RUNTIME_PRESET_TO_SELECTION) as Array<[MapRuntimePreset, MapRuntimeSelection]>;
  const match = entries.find(([, candidate]) => (
    MAP_RUNTIME_SUBSYSTEMS.every((subsystem) => candidate[subsystem] === selection[subsystem])
  ));
  return match?.[0] ?? null;
};

export const buildMapRuntimeSelectionCacheKey = (selection: MapRuntimeSelection): string => (
  MAP_RUNTIME_SUBSYSTEMS
    .map((subsystem) => MAP_IMPLEMENTATION_CACHE_CODES[selection[subsystem]])
    .join('')
);

export const parseMapRuntimeSelectionCacheKey = (
  value: string | null | undefined,
): MapRuntimeSelection | null => {
  if (!value || value.length !== MAP_RUNTIME_SUBSYSTEMS.length) return null;
  const implementations = value
    .split('')
    .map((entry) => MAP_IMPLEMENTATION_FROM_CACHE_CODE[entry] ?? null);
  if (implementations.some((entry) => entry === null)) return null;

  return {
    renderer: implementations[0] as MapImplementation,
    routes: implementations[1] as MapImplementation,
    locationSearch: implementations[2] as MapImplementation,
    staticMaps: implementations[3] as MapImplementation,
  };
};

export const serializeMapRuntimeOverrideCookie = (override: MapRuntimeOverride): string => {
  const payload: Record<string, unknown> = {
    version: 1,
  };

  if (override.preset === 'default' || isMapRuntimePreset(override.preset)) {
    payload.preset = override.preset;
  }

  if (override.selection && isRecord(override.selection)) {
    const normalizedSelection: Partial<MapRuntimeSelection> = {};
    MAP_RUNTIME_SUBSYSTEMS.forEach((subsystem) => {
      const value = override.selection?.[subsystem];
      if (isMapImplementation(value)) {
        normalizedSelection[subsystem] = value;
      }
    });
    if (Object.keys(normalizedSelection).length > 0) {
      payload.selection = normalizedSelection;
    }
  }

  return JSON.stringify(payload);
};

export const parseMapRuntimeOverrideCookie = (
  rawValue: string | null | undefined,
): MapRuntimeOverride | null => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (!isRecord(parsed)) return null;

    const parsedPreset = parsed.preset;
    const preset = parsedPreset === 'default'
      ? 'default'
      : isMapRuntimePreset(parsedPreset)
      ? parsedPreset
      : undefined;

    const parsedSelection = isRecord(parsed.selection) ? parsed.selection : null;
    const selection = parsedSelection
      ? MAP_RUNTIME_SUBSYSTEMS.reduce<Partial<MapRuntimeSelection>>((accumulator, subsystem) => {
        const value = parsedSelection[subsystem];
        if (isMapImplementation(value)) {
          accumulator[subsystem] = value;
        }
        return accumulator;
      }, {})
      : undefined;

    if (!preset && (!selection || Object.keys(selection).length === 0)) {
      return null;
    }

    return {
      preset,
      selection,
    };
  } catch {
    return null;
  }
};

const isImplementationAvailableForSubsystem = (
  implementation: MapImplementation,
  subsystem: MapSubsystem,
  availability: MapRuntimeAvailability,
): boolean => {
  if (!MAP_IMPLEMENTATION_CAPABILITIES[implementation][subsystem]) return false;
  if (implementation === 'google') return availability.googleMapsKeyAvailable;
  return availability.mapboxAccessTokenAvailable;
};

const mergeMapRuntimeSelection = (
  baseSelection: MapRuntimeSelection,
  overrides?: Partial<MapRuntimeSelection>,
): MapRuntimeSelection => ({
  renderer: isMapImplementation(overrides?.renderer) ? overrides.renderer : baseSelection.renderer,
  routes: isMapImplementation(overrides?.routes) ? overrides.routes : baseSelection.routes,
  locationSearch: isMapImplementation(overrides?.locationSearch) ? overrides.locationSearch : baseSelection.locationSearch,
  staticMaps: isMapImplementation(overrides?.staticMaps) ? overrides.staticMaps : baseSelection.staticMaps,
});

const resolveMapImplementationForSubsystem = ({
  requestedImplementation,
  subsystem,
  availability,
  warnings,
}: {
  requestedImplementation: MapImplementation;
  subsystem: MapSubsystem;
  availability: MapRuntimeAvailability;
  warnings: string[];
}): MapImplementation => {
  if (isImplementationAvailableForSubsystem(requestedImplementation, subsystem, availability)) {
    return requestedImplementation;
  }

  const implementationHasCapability = MAP_IMPLEMENTATION_CAPABILITIES[requestedImplementation][subsystem];
  if (!implementationHasCapability) {
    warnings.push(`Map runtime fallback: ${requestedImplementation} does not support ${subsystem} in v1, using Google instead.`);
  } else if (requestedImplementation === 'google') {
    warnings.push(`Map runtime fallback: Google ${subsystem} is unavailable in this environment, using the nearest available implementation.`);
  } else {
    warnings.push(`Map runtime fallback: Mapbox ${subsystem} is unavailable in this environment, using Google instead.`);
  }

  const fallbackImplementations: MapImplementation[] = requestedImplementation === 'google'
    ? ['mapbox', 'google']
    : ['google', 'mapbox'];

  const fallback = fallbackImplementations.find((implementation) => (
    isImplementationAvailableForSubsystem(implementation, subsystem, availability)
  ));

  return fallback ?? requestedImplementation;
};

export const resolveMapRuntime = ({
  defaultPreset,
  override,
  availability,
  overrideSource = 'default',
}: {
  defaultPreset?: MapRuntimePreset | null;
  override?: MapRuntimeOverride | null;
  availability?: Partial<MapRuntimeAvailability>;
  overrideSource?: MapRuntimeResolution['overrideSource'];
} = {}): MapRuntimeResolution => {
  const normalizedDefaultPreset = normalizeMapRuntimePreset(defaultPreset);
  const normalizedAvailability: MapRuntimeAvailability = {
    googleMapsKeyAvailable: Boolean(availability?.googleMapsKeyAvailable),
    mapboxAccessTokenAvailable: Boolean(availability?.mapboxAccessTokenAvailable),
  };
  const requestedPreset = override?.preset && override.preset !== 'default'
    ? normalizeMapRuntimePreset(override.preset)
    : normalizedDefaultPreset;
  const requestedSelection = mergeMapRuntimeSelection(
    getSelectionForMapRuntimePreset(requestedPreset),
    override?.selection,
  );
  const warnings: string[] = [];
  const effectiveSelection = MAP_RUNTIME_SUBSYSTEMS.reduce<MapRuntimeSelection>((accumulator, subsystem) => {
    accumulator[subsystem] = resolveMapImplementationForSubsystem({
      requestedImplementation: requestedSelection[subsystem],
      subsystem,
      availability: normalizedAvailability,
      warnings,
    });
    return accumulator;
  }, {
    renderer: 'google',
    routes: 'google',
    locationSearch: 'google',
    staticMaps: 'google',
  });

  return {
    defaultPreset: normalizedDefaultPreset,
    requestedPreset,
    requestedSelection,
    effectiveSelection,
    effectivePresetMatch: identifyMapRuntimePreset(effectiveSelection),
    override: override ?? null,
    overrideSource: override ? overrideSource : 'default',
    warnings,
    availability: normalizedAvailability,
    activeSelectionKey: buildMapRuntimeSelectionCacheKey(effectiveSelection),
    implementationCapabilities: MAP_IMPLEMENTATION_CAPABILITIES,
  };
};
