import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from './browserStorageService';
import {
  buildRuntimeLocationPayload,
  createEmptyRuntimeLocation,
  normalizeRuntimeLocationPayload,
  type RuntimeLocationPayload,
} from '../shared/runtimeLocation';

export interface RuntimeLocationStoreSnapshot extends RuntimeLocationPayload {
  loading: boolean;
}

export const RUNTIME_LOCATION_SESSION_STORAGE_KEY = 'tf_runtime_location_v1';
export const RUNTIME_LOCATION_EVENT = 'tf:runtime-location';
export const RUNTIME_LOCATION_ENDPOINT = '/api/runtime/location';

const buildDefaultSnapshot = (): RuntimeLocationStoreSnapshot => ({
  ...buildRuntimeLocationPayload({
    source: 'unavailable',
    fetchedAt: null,
    location: createEmptyRuntimeLocation(),
  }),
  loading: false,
});

const isBrowser = (): boolean => typeof window !== 'undefined';

const readStoredPayload = (): RuntimeLocationPayload | null => {
  if (!isBrowser()) return null;
  try {
    const raw = readSessionStorageItem(RUNTIME_LOCATION_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return normalizeRuntimeLocationPayload(JSON.parse(raw), 'unavailable');
  } catch {
    return null;
  }
};

const persistPayload = (payload: RuntimeLocationPayload | null): void => {
  if (!isBrowser()) return;
  try {
    if (!payload) {
      removeSessionStorageItem(RUNTIME_LOCATION_SESSION_STORAGE_KEY);
      return;
    }
    writeSessionStorageItem(RUNTIME_LOCATION_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures so runtime lookups stay non-blocking.
  }
};

let inFlightRuntimeLocationPromise: Promise<RuntimeLocationStoreSnapshot> | null = null;
let runtimeLocationSnapshot: RuntimeLocationStoreSnapshot = (() => {
  const stored = readStoredPayload();
  if (!stored) return buildDefaultSnapshot();
  return {
    ...stored,
    source: 'session-cache',
    loading: false,
  };
})();

const emitRuntimeLocationSnapshot = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<RuntimeLocationStoreSnapshot>(RUNTIME_LOCATION_EVENT, {
    detail: runtimeLocationSnapshot,
  }));
};

const setRuntimeLocationSnapshot = (
  next: RuntimeLocationStoreSnapshot,
  options?: { persist?: boolean },
): RuntimeLocationStoreSnapshot => {
  runtimeLocationSnapshot = next;
  if (options?.persist !== false) {
    if (next.source === 'error') {
      persistPayload(null);
    } else {
      persistPayload({
        available: next.available,
        source: next.source === 'session-cache' ? 'netlify-context' : next.source,
        fetchedAt: next.fetchedAt,
        location: next.location,
      });
    }
  }
  emitRuntimeLocationSnapshot();
  return runtimeLocationSnapshot;
};

const normalizeStoreSnapshot = (
  payload: unknown,
  fallbackSource: RuntimeLocationPayload['source'],
): RuntimeLocationStoreSnapshot => ({
  ...normalizeRuntimeLocationPayload(payload, fallbackSource),
  loading: false,
});

const createLoadingSnapshot = (): RuntimeLocationStoreSnapshot => ({
  ...runtimeLocationSnapshot,
  loading: true,
});

const fetchRuntimeLocation = async (
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeLocationStoreSnapshot> => {
  try {
    const response = await fetchImpl(RUNTIME_LOCATION_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return normalizeStoreSnapshot({
        available: false,
        source: 'unavailable',
        fetchedAt: new Date().toISOString(),
        location: createEmptyRuntimeLocation(),
      }, 'unavailable');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return normalizeStoreSnapshot({
        available: false,
        source: 'unavailable',
        fetchedAt: new Date().toISOString(),
        location: createEmptyRuntimeLocation(),
      }, 'unavailable');
    }

    const payload = await response.json();
    return normalizeStoreSnapshot(payload, 'error');
  } catch {
    return normalizeStoreSnapshot({
      available: false,
      source: 'error',
      fetchedAt: new Date().toISOString(),
      location: createEmptyRuntimeLocation(),
    }, 'error');
  }
};

export const getRuntimeLocationSnapshot = (): RuntimeLocationStoreSnapshot => runtimeLocationSnapshot;

export const subscribeRuntimeLocation = (
  listener: (snapshot: RuntimeLocationStoreSnapshot) => void,
): (() => void) => {
  listener(runtimeLocationSnapshot);
  if (!isBrowser()) return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<RuntimeLocationStoreSnapshot | undefined>).detail;
    listener(detail ?? runtimeLocationSnapshot);
  };

  window.addEventListener(RUNTIME_LOCATION_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(RUNTIME_LOCATION_EVENT, handler as EventListener);
  };
};

export const ensureRuntimeLocationLoaded = async (
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeLocationStoreSnapshot> => {
  if (runtimeLocationSnapshot.source === 'session-cache') return runtimeLocationSnapshot;
  if (runtimeLocationSnapshot.loading && inFlightRuntimeLocationPromise) return inFlightRuntimeLocationPromise;

  setRuntimeLocationSnapshot(createLoadingSnapshot(), { persist: false });
  inFlightRuntimeLocationPromise = fetchRuntimeLocation(fetchImpl)
    .then((next) => setRuntimeLocationSnapshot(next))
    .finally(() => {
      inFlightRuntimeLocationPromise = null;
    });

  return inFlightRuntimeLocationPromise;
};

export const refreshRuntimeLocation = async (
  fetchImpl: typeof fetch = fetch,
): Promise<RuntimeLocationStoreSnapshot> => {
  setRuntimeLocationSnapshot(createLoadingSnapshot(), { persist: false });
  inFlightRuntimeLocationPromise = fetchRuntimeLocation(fetchImpl)
    .then((next) => setRuntimeLocationSnapshot(next))
    .finally(() => {
      inFlightRuntimeLocationPromise = null;
    });

  return inFlightRuntimeLocationPromise;
};
