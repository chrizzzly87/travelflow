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
import { readCookieItem, removeCookieItem, writeCookieItem } from './cookieStorageService';

export const getDefaultMapRuntimePreset = (): MapRuntimePreset => {
  const rawPreset = import.meta.env.VITE_MAP_RUNTIME_PRESET;
  return rawPreset === 'mapbox_visual_google_services'
    || rawPreset === 'mapbox_all'
    || rawPreset === 'google_all'
    ? rawPreset
    : 'google_all';
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
