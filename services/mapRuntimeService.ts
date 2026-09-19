import { getGoogleMapsApiKey } from '../utils';
import {
  MAP_RUNTIME_OVERRIDE_COOKIE_NAME,
  parseMapRuntimeOverrideCookie,
  resolveMapRuntime,
  serializeMapRuntimeOverrideCookie,
  type MapRuntimeSelection,
  type MapRuntimeOverride,
  type MapRuntimePreset,
  type MapRuntimeResolution,
} from '../shared/mapRuntime';
import type { MapRendererChoice } from '../types';
import { readCookieItem, removeCookieItem, writeCookieItem } from './cookieStorageService';

export const isMapRuntimePreset = (value: unknown): value is MapRuntimePreset => (
  value === 'mapbox_visual_google_services' || value === 'mapbox_all' || value === 'google_all'
);

/**
 * Which map stack the app runs. The administrator setting wins over the build
 * time environment default; an administrator's own cookie override still wins
 * over both, because that is a debugging tool for one browser.
 */
let runtimeMapPreset: MapRuntimePreset | null = null;

export const setRuntimeMapPreset = (preset: MapRuntimePreset | null): void => {
  runtimeMapPreset = isMapRuntimePreset(preset) ? preset : null;
};

export const getDefaultMapRuntimePreset = (): MapRuntimePreset => {
  if (runtimeMapPreset) return runtimeMapPreset;
  const rawPreset = import.meta.env.VITE_MAP_RUNTIME_PRESET;
  return isMapRuntimePreset(rawPreset) ? rawPreset : 'google_all';
};

export const getMapboxAccessToken = (): string => (
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || ''
);

export const readMapRuntimeAdminOverride = (): MapRuntimeOverride | null => (
  parseMapRuntimeOverrideCookie(readCookieItem(MAP_RUNTIME_OVERRIDE_COOKIE_NAME))
);

export const writeMapRuntimeAdminOverride = (override: MapRuntimeOverride): void => {
  writeCookieItem(
    MAP_RUNTIME_OVERRIDE_COOKIE_NAME,
    serializeMapRuntimeOverrideCookie(override),
    { path: '/', sameSite: 'Lax' },
  );
};

export const clearMapRuntimeAdminOverride = (): void => {
  removeCookieItem(MAP_RUNTIME_OVERRIDE_COOKIE_NAME, { path: '/' });
};

export const applyMapRuntimeAdminOverride = (
  override: MapRuntimeOverride | null,
  options: { reload?: boolean } = {},
): void => {
  if (override) {
    writeMapRuntimeAdminOverride(override);
  } else {
    clearMapRuntimeAdminOverride();
  }

  if (options.reload !== false && typeof window !== 'undefined') {
    window.location.reload();
  }
};

export const applyMapRuntimePresetOverride = (
  preset: MapRuntimePreset | 'default',
  options?: { reload?: boolean },
): void => {
  if (preset === 'default') {
    applyMapRuntimeAdminOverride(null, options);
    return;
  }
  applyMapRuntimeAdminOverride({ preset }, options);
};

export const applyMapRuntimeSelectionOverride = (
  selection: Partial<MapRuntimeSelection>,
  options?: { reload?: boolean; preset?: MapRuntimePreset | 'default' },
): void => {
  applyMapRuntimeAdminOverride({
    preset: options?.preset,
    selection,
  }, options);
};

export const getClientMapRuntimeResolution = ({
  override,
  overrideSource,
  defaultPreset,
}: {
  override?: MapRuntimeOverride | null;
  overrideSource?: MapRuntimeResolution['overrideSource'];
  defaultPreset?: MapRuntimePreset;
} = {}): MapRuntimeResolution => {
  const resolvedOverride = override === undefined ? readMapRuntimeAdminOverride() : override;
  return resolveMapRuntime({
    defaultPreset: defaultPreset ?? getDefaultMapRuntimePreset(),
    override: resolvedOverride,
    overrideSource: resolvedOverride ? (overrideSource ?? 'cookie') : 'default',
    availability: {
      googleMapsKeyAvailable: Boolean(getGoogleMapsApiKey().trim()),
      mapboxAccessTokenAvailable: Boolean(getMapboxAccessToken().trim()),
    },
  });
};

/**
 * The traveller's basemap choice, held outside React.
 *
 * It cannot live in the map runtime context: `TripView` *renders*
 * `<GoogleMapsLoader>` inside its own JSX while also reading the runtime in its
 * own body, and a component cannot consume a context it provides further down
 * its own tree. It silently got the default context value, whose setter is a
 * no-op — which is why choosing a provider in the customize sheet did nothing
 * at all. A module-level store is read the same way from either side of that
 * boundary, and matches how `runtimeMapPreset` above already works.
 */
let rendererChoice: MapRendererChoice = 'auto';
const rendererChoiceListeners = new Set<() => void>();

export const getMapRendererChoice = (): MapRendererChoice => rendererChoice;

export const setMapRendererChoice = (choice: MapRendererChoice): void => {
  const next: MapRendererChoice = choice === 'google' || choice === 'mapbox' ? choice : 'auto';
  if (next === rendererChoice) return;
  rendererChoice = next;
  rendererChoiceListeners.forEach((listener) => listener());
};

export const subscribeToMapRendererChoice = (listener: () => void): (() => void) => {
  rendererChoiceListeners.add(listener);
  return () => {
    rendererChoiceListeners.delete(listener);
  };
};

/** Test seam: resets the module store between cases. */
export const resetMapRendererChoiceForTests = (): void => {
  rendererChoice = 'auto';
  rendererChoiceListeners.clear();
};
