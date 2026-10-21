/**
 * The traveller's approximate origin for distance-aware sorting.
 *
 * This is a thin, honest projection of {@link ../services/runtimeLocationService} — it adds no new
 * network call and no new precision. It exists to answer one question the explorer needs and the
 * raw runtime snapshot does not: *may we currently sort by distance, and if not, why not?*
 *
 * Design rules:
 *  - IP geolocation is approximate and is regularly wrong behind VPNs and mobile carriers, so the
 *    snapshot always carries the inferred city/country for the UI to show, and the traveller can
 *    dismiss it for the session. A dismissed origin yields `status: 'dismissed'` and **no**
 *    coordinates, so nothing downstream can quietly keep using it.
 *  - A missing or failed lookup yields `status: 'unavailable'` — never a fallback coordinate.
 *  - `getCountryOriginSnapshot()` returns a referentially stable object between changes, so it is
 *    safe to pass straight to `useSyncExternalStore`.
 */

import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from './browserStorageService';
import {
  ensureRuntimeLocationLoaded,
  getRuntimeLocationSnapshot,
  subscribeRuntimeLocation,
  type RuntimeLocationStoreSnapshot,
} from './runtimeLocationService';
import { isValidGeoPoint, type GeoPoint } from './countryDistanceService';

export const COUNTRY_ORIGIN_DISMISSED_SESSION_STORAGE_KEY = 'tf_country_origin_dismissed_v1';
export const COUNTRY_ORIGIN_EVENT = 'tf:country-origin-preference';

export type CountryOriginStatus =
  /** Nothing has asked for a location yet. */
  | 'idle'
  /** A lookup is in flight. */
  | 'loading'
  /** We have approximate coordinates and may sort by distance. */
  | 'ready'
  /** The traveller told us to ignore the inferred location this session. */
  | 'dismissed'
  /** No usable location: the lookup failed, was blocked, or returned nothing. */
  | 'unavailable';

export interface CountryOrigin extends GeoPoint {
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
}

export interface CountryOriginSnapshot {
  status: CountryOriginStatus;
  /** Coordinates to sort by. `null` for every status except `ready`. */
  origin: CountryOrigin | null;
  /**
   * What the lookup inferred, even when the traveller dismissed it — so the UI can offer
   * "not in {city}? / use it anyway" without re-running the lookup.
   */
  inferred: CountryOrigin | null;
}

const isBrowser = (): boolean => typeof window !== 'undefined';

const readDismissed = (): boolean => {
  if (!isBrowser()) return false;
  try {
    return readSessionStorageItem(COUNTRY_ORIGIN_DISMISSED_SESSION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const toCountryOrigin = (snapshot: RuntimeLocationStoreSnapshot): CountryOrigin | null => {
  const { latitude, longitude, city, countryCode, countryName } = snapshot.location;
  if (!snapshot.available) return null;
  if (!isValidGeoPoint({ latitude, longitude })) return null;
  return {
    latitude: latitude as number,
    longitude: longitude as number,
    city,
    countryCode,
    countryName,
  };
};

const deriveStatus = (
  snapshot: RuntimeLocationStoreSnapshot,
  inferred: CountryOrigin | null,
  dismissed: boolean,
): CountryOriginStatus => {
  if (snapshot.loading) return 'loading';
  if (inferred) return dismissed ? 'dismissed' : 'ready';
  // No fetch has resolved yet and none is running: nobody has asked.
  if (snapshot.fetchedAt === null && snapshot.source === 'unavailable') return 'idle';
  return 'unavailable';
};

const buildSnapshot = (
  runtime: RuntimeLocationStoreSnapshot,
  dismissed: boolean,
): CountryOriginSnapshot => {
  const inferred = toCountryOrigin(runtime);
  const status = deriveStatus(runtime, inferred, dismissed);
  return {
    status,
    origin: status === 'ready' ? inferred : null,
    inferred,
  };
};

let lastRuntime: RuntimeLocationStoreSnapshot = getRuntimeLocationSnapshot();
let lastDismissed = readDismissed();
let cachedSnapshot: CountryOriginSnapshot = buildSnapshot(lastRuntime, lastDismissed);

/**
 * Recomputes only when an input actually changed, so repeated `getSnapshot()` calls keep returning
 * the same object reference and `useSyncExternalStore` does not loop.
 */
const refreshCachedSnapshot = (): CountryOriginSnapshot => {
  const runtime = getRuntimeLocationSnapshot();
  const dismissed = readDismissed();
  if (runtime === lastRuntime && dismissed === lastDismissed) return cachedSnapshot;
  lastRuntime = runtime;
  lastDismissed = dismissed;
  cachedSnapshot = buildSnapshot(runtime, dismissed);
  return cachedSnapshot;
};

export const getCountryOriginSnapshot = (): CountryOriginSnapshot => refreshCachedSnapshot();

/** Server render has no session storage and no runtime location; always the neutral snapshot. */
export const getCountryOriginServerSnapshot = (): CountryOriginSnapshot => cachedSnapshot;

export const subscribeCountryOrigin = (
  listener: (snapshot: CountryOriginSnapshot) => void,
): (() => void) => {
  const notify = () => listener(refreshCachedSnapshot());

  const unsubscribeRuntime = subscribeRuntimeLocation(() => notify());
  if (!isBrowser()) return unsubscribeRuntime;

  window.addEventListener(COUNTRY_ORIGIN_EVENT, notify);
  return () => {
    unsubscribeRuntime();
    window.removeEventListener(COUNTRY_ORIGIN_EVENT, notify);
  };
};

const emitPreferenceChange = (): void => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(COUNTRY_ORIGIN_EVENT));
};

const writeDismissed = (dismissed: boolean): void => {
  if (!isBrowser()) return;
  try {
    if (dismissed) writeSessionStorageItem(COUNTRY_ORIGIN_DISMISSED_SESSION_STORAGE_KEY, '1');
    else removeSessionStorageItem(COUNTRY_ORIGIN_DISMISSED_SESSION_STORAGE_KEY);
  } catch {
    // Storage failures must never block the explorer; the preference is best-effort.
  }
};

/** "That's not me" — stops distance sorting from using the inferred location this session. */
export const dismissCountryOrigin = (): CountryOriginSnapshot => {
  writeDismissed(true);
  emitPreferenceChange();
  return refreshCachedSnapshot();
};

/** Undo of {@link dismissCountryOrigin}. */
export const restoreCountryOrigin = (): CountryOriginSnapshot => {
  writeDismissed(false);
  emitPreferenceChange();
  return refreshCachedSnapshot();
};

/**
 * Triggers the shared runtime-location lookup. Safe to call repeatedly: the underlying service
 * de-duplicates in-flight requests and caches the result for the session.
 */
export const ensureCountryOriginLoaded = async (): Promise<CountryOriginSnapshot> => {
  await ensureRuntimeLocationLoaded();
  return refreshCachedSnapshot();
};

/** Test-only: forgets the memoized snapshot and the session preference. */
export const resetCountryOriginForTests = (): void => {
  writeDismissed(false);
  lastRuntime = getRuntimeLocationSnapshot();
  lastDismissed = readDismissed();
  cachedSnapshot = buildSnapshot(lastRuntime, lastDismissed);
};
