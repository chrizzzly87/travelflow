/**
 * The traveller's own position on the trip map.
 *
 * A small external store around `navigator.geolocation.watchPosition`, read through
 * `useSyncExternalStore`. It exists for one job: put a "you are here" dot on the map of a trip
 * the traveller is on right now, and keep it there across visits.
 *
 * Design rules:
 *  - Nothing prompts on its own. The browser permission prompt only ever follows a tap on the
 *    locate control (`enableUserLocation`). A site that already holds the permission starts
 *    silently, unless the traveller switched the dot off here — that choice wins.
 *  - Only this device remembers it: the on/off choice and the last fix live in one localStorage
 *    key. Nothing is sent to a server.
 *  - The watch only runs while a map is mounted (`acquireUserLocationWatch`) and the tab is
 *    visible, so a backgrounded tab does not keep the GPS awake.
 *  - A remembered fix is shown straight away but marked `isLive: false` until a fresh one
 *    arrives, so the map never presents yesterday's position as current.
 */

import { readLocalStorageItem, writeLocalStorageItem } from './browserStorageService';

export const USER_LOCATION_STORAGE_KEY = 'tf_user_location_v1';

export type UserLocationStatus = 'off' | 'locating' | 'active' | 'denied' | 'unsupported';

export interface UserLocationFix {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  recordedAt: number;
  /** False for a fix restored from storage, until the watch delivers a fresh one. */
  isLive: boolean;
}

export interface UserLocationSnapshot {
  /** Null until the traveller has chosen either way on this device. */
  enabled: boolean | null;
  status: UserLocationStatus;
  fix: UserLocationFix | null;
}

interface StoredUserLocation {
  enabled: boolean | null;
  fix: Omit<UserLocationFix, 'isLive'> | null;
}

/** Re-persist a moving fix at most this often, or sooner once it has moved this far. */
const PERSIST_MIN_INTERVAL_MS = 60_000;
const PERSIST_MIN_DISTANCE_METERS = 50;
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 30_000,
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const parseStoredUserLocation = (raw: string | null): StoredUserLocation => {
  const empty: StoredUserLocation = { enabled: null, fix: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUserLocation> | null;
    if (!parsed || typeof parsed !== 'object') return empty;
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : null;
    const fix = parsed.fix;
    const validFix = fix
      && isFiniteNumber(fix.lat) && Math.abs(fix.lat) <= 90
      && isFiniteNumber(fix.lng) && Math.abs(fix.lng) <= 180
      && isFiniteNumber(fix.recordedAt)
      ? {
        lat: fix.lat,
        lng: fix.lng,
        accuracyMeters: isFiniteNumber(fix.accuracyMeters) ? fix.accuracyMeters : null,
        recordedAt: fix.recordedAt,
      }
      : null;
    return { enabled, fix: validFix };
  } catch {
    return empty;
  }
};

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const getGeolocation = (): Geolocation | null => {
  if (typeof navigator === 'undefined') return null;
  return navigator.geolocation ?? null;
};

const readInitialSnapshot = (): UserLocationSnapshot => {
  if (typeof window === 'undefined') return { enabled: null, status: 'off', fix: null };
  const stored = parseStoredUserLocation(readLocalStorageItem(USER_LOCATION_STORAGE_KEY));
  return {
    enabled: stored.enabled,
    status: getGeolocation() ? 'off' : 'unsupported',
    fix: stored.fix ? { ...stored.fix, isLive: false } : null,
  };
};

let snapshot: UserLocationSnapshot = readInitialSnapshot();
const listeners = new Set<() => void>();
let watchId: number | null = null;
let watchRefCount = 0;
let lastPersisted: { lat: number; lng: number; at: number } | null = null;
let visibilityListenerAttached = false;
let permissionProbeStarted = false;

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setSnapshot = (next: UserLocationSnapshot) => {
  if (
    next.enabled === snapshot.enabled
    && next.status === snapshot.status
    && next.fix === snapshot.fix
  ) {
    return;
  }
  snapshot = next;
  emit();
};

const persist = (force = false) => {
  const fix = snapshot.fix;
  if (!force && fix && lastPersisted) {
    const movedFar = distanceMeters(lastPersisted, fix) >= PERSIST_MIN_DISTANCE_METERS;
    const waitedLong = fix.recordedAt - lastPersisted.at >= PERSIST_MIN_INTERVAL_MS;
    if (!movedFar && !waitedLong) return;
  }
  const stored: StoredUserLocation = {
    enabled: snapshot.enabled,
    fix: fix
      ? { lat: fix.lat, lng: fix.lng, accuracyMeters: fix.accuracyMeters, recordedAt: fix.recordedAt }
      : null,
  };
  if (writeLocalStorageItem(USER_LOCATION_STORAGE_KEY, JSON.stringify(stored)) && fix) {
    lastPersisted = { lat: fix.lat, lng: fix.lng, at: fix.recordedAt };
  }
};

const handlePosition = (position: GeolocationPosition) => {
  const { latitude, longitude, accuracy } = position.coords;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return;
  setSnapshot({
    ...snapshot,
    status: 'active',
    fix: {
      lat: latitude,
      lng: longitude,
      accuracyMeters: isFiniteNumber(accuracy) ? accuracy : null,
      recordedAt: isFiniteNumber(position.timestamp) ? position.timestamp : Date.now(),
      isLive: true,
    },
  });
  persist();
};

const handlePositionError = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) {
    stopWatch();
    // Denied is the browser's answer, not a choice made here, so `enabled` stays as it was:
    // granting the permission later in the browser brings the dot straight back.
    setSnapshot({ ...snapshot, status: 'denied' });
    return;
  }
  // Timeouts and "position unavailable" are transient (a tunnel, a building). Keep watching
  // and keep the last fix on screen, marked as no longer live.
  if (snapshot.fix?.isLive) {
    setSnapshot({ ...snapshot, fix: { ...snapshot.fix, isLive: false } });
  }
};

const isDocumentVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

const startWatch = () => {
  const geolocation = getGeolocation();
  if (!geolocation || watchId !== null) return;
  if (snapshot.status !== 'active') {
    setSnapshot({ ...snapshot, status: 'locating' });
  }
  watchId = geolocation.watchPosition(handlePosition, handlePositionError, WATCH_OPTIONS);
};

function stopWatch() {
  const geolocation = getGeolocation();
  if (watchId !== null && geolocation) {
    geolocation.clearWatch(watchId);
  }
  watchId = null;
}

const syncWatch = () => {
  const shouldWatch = watchRefCount > 0
    && snapshot.enabled === true
    && snapshot.status !== 'denied'
    && snapshot.status !== 'unsupported'
    && isDocumentVisible();
  if (shouldWatch) {
    startWatch();
    return;
  }
  stopWatch();
  if (snapshot.status === 'active' || snapshot.status === 'locating') {
    setSnapshot({
      ...snapshot,
      status: 'off',
      fix: snapshot.fix?.isLive ? { ...snapshot.fix, isLive: false } : snapshot.fix,
    });
  }
};

const ensureVisibilityListener = () => {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  visibilityListenerAttached = true;
  document.addEventListener('visibilitychange', syncWatch);
};

/**
 * A site that already holds the permission needs no tap: start as if the traveller had turned it
 * on. An explicit "off" on this device is never overridden.
 */
const probeExistingPermission = () => {
  if (permissionProbeStarted || snapshot.enabled !== null) return;
  permissionProbeStarted = true;
  const permissions = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
  if (!permissions?.query) return;
  permissions
    .query({ name: 'geolocation' as PermissionName })
    .then((result) => {
      if (result.state !== 'granted' || snapshot.enabled !== null) return;
      setSnapshot({ ...snapshot, enabled: true });
      persist(true);
      syncWatch();
    })
    .catch(() => undefined);
};

export const getUserLocationSnapshot = (): UserLocationSnapshot => snapshot;

export const subscribeUserLocation = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Keeps the position watch alive while the caller is mounted. Returns the release function. */
export const acquireUserLocationWatch = (): (() => void) => {
  watchRefCount += 1;
  ensureVisibilityListener();
  probeExistingPermission();
  syncWatch();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    watchRefCount = Math.max(0, watchRefCount - 1);
    syncWatch();
  };
};

/**
 * Turns the dot on. Must be called from a tap: this is what raises the browser prompt, and
 * browsers (Safari especially) only show it reliably inside a user gesture.
 */
export const enableUserLocation = (): void => {
  const geolocation = getGeolocation();
  if (!geolocation) {
    setSnapshot({ ...snapshot, status: 'unsupported' });
    return;
  }
  setSnapshot({
    ...snapshot,
    enabled: true,
    status: snapshot.status === 'active' ? 'active' : 'locating',
  });
  persist(true);
  // Ask inside the gesture even if no map currently holds the watch.
  geolocation.getCurrentPosition(handlePosition, handlePositionError, WATCH_OPTIONS);
  syncWatch();
};

/** Turns the dot off on this device and forgets the last position. */
export const disableUserLocation = (): void => {
  stopWatch();
  lastPersisted = null;
  setSnapshot({
    enabled: false,
    status: getGeolocation() ? 'off' : 'unsupported',
    fix: null,
  });
  persist(true);
};

/** Test-only: forget module state and re-read storage. */
export const resetUserLocationServiceForTests = (): void => {
  stopWatch();
  watchRefCount = 0;
  lastPersisted = null;
  permissionProbeStarted = false;
  if (visibilityListenerAttached && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', syncWatch);
  }
  visibilityListenerAttached = false;
  listeners.clear();
  snapshot = readInitialSnapshot();
};
