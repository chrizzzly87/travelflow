// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The origin service is the honesty boundary for distance sorting, so these tests are about what
 * it *refuses* to do: never expose coordinates for a dismissed or failed lookup, never invent a
 * fallback location, and never let a storage failure take the explorer down with it.
 *
 * `runtimeLocationService` is mocked because the real one talks to `/api/runtime/location`, which
 * is a Netlify edge function — it does not exist in a unit-test process, and it also does not
 * exist on CLI alias deploys, which is exactly why this behaviour has to be pinned down here.
 */

type RuntimeSnapshot = {
  available: boolean;
  loading: boolean;
  fetchedAt: number | null;
  source: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    countryCode: string | null;
    countryName: string | null;
  };
};

const UNRESOLVED: RuntimeSnapshot = {
  available: false,
  loading: false,
  fetchedAt: null,
  source: 'unavailable',
  location: { latitude: null, longitude: null, city: null, countryCode: null, countryName: null },
};

const BERLIN: RuntimeSnapshot = {
  available: true,
  loading: false,
  fetchedAt: 1_700_000_000_000,
  source: 'edge',
  location: {
    latitude: 52.52,
    longitude: 13.405,
    city: 'Berlin',
    countryCode: 'DE',
    countryName: 'Germany',
  },
};

let runtimeSnapshot: RuntimeSnapshot = UNRESOLVED;
const runtimeListeners = new Set<() => void>();
const ensureRuntimeLocationLoaded = vi.fn(async () => runtimeSnapshot);

const setRuntimeSnapshot = (next: RuntimeSnapshot): void => {
  // A new object identity every time, mirroring the real store — the service memoizes on it.
  runtimeSnapshot = { ...next, location: { ...next.location } };
  runtimeListeners.forEach((listener) => listener());
};

vi.mock('../../services/runtimeLocationService', () => ({
  getRuntimeLocationSnapshot: () => runtimeSnapshot,
  subscribeRuntimeLocation: (listener: () => void) => {
    runtimeListeners.add(listener);
    return () => runtimeListeners.delete(listener);
  },
  ensureRuntimeLocationLoaded: () => ensureRuntimeLocationLoaded(),
  RUNTIME_LOCATION_SESSION_STORAGE_KEY: 'tf_runtime_location_v1',
  RUNTIME_LOCATION_EVENT: 'tf:runtime-location',
  RUNTIME_LOCATION_ENDPOINT: '/api/runtime/location',
}));

const importService = async () => import('../../services/countryOriginService');

beforeEach(async () => {
  window.sessionStorage.clear();
  runtimeListeners.clear();
  setRuntimeSnapshot(UNRESOLVED);
  const service = await importService();
  service.resetCountryOriginForTests();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe('countryOriginService', () => {
  it('starts idle, with no coordinates and nothing inferred', async () => {
    const { getCountryOriginSnapshot } = await importService();
    const snapshot = getCountryOriginSnapshot();
    expect(snapshot.status).toBe('idle');
    expect(snapshot.origin).toBeNull();
    expect(snapshot.inferred).toBeNull();
  });

  it('reports loading while a lookup is in flight, without leaking a coordinate', async () => {
    const { getCountryOriginSnapshot } = await importService();
    setRuntimeSnapshot({ ...UNRESOLVED, loading: true });
    const snapshot = getCountryOriginSnapshot();
    expect(snapshot.status).toBe('loading');
    expect(snapshot.origin).toBeNull();
  });

  it('exposes the inferred place alongside the coordinates once ready', async () => {
    const { getCountryOriginSnapshot } = await importService();
    setRuntimeSnapshot(BERLIN);
    const snapshot = getCountryOriginSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.origin).toMatchObject({ latitude: 52.52, longitude: 13.405, city: 'Berlin' });
    expect(snapshot.inferred?.countryName).toBe('Germany');
  });

  it('goes unavailable — not ready — when the lookup resolved with nothing usable', async () => {
    const { getCountryOriginSnapshot } = await importService();
    setRuntimeSnapshot({ ...UNRESOLVED, fetchedAt: 1_700_000_000_000, source: 'edge' });
    const snapshot = getCountryOriginSnapshot();
    expect(snapshot.status).toBe('unavailable');
    expect(snapshot.origin).toBeNull();
  });

  it('treats an incomplete payload as unavailable rather than half-placing the traveller', async () => {
    const { getCountryOriginSnapshot } = await importService();
    setRuntimeSnapshot({
      ...BERLIN,
      location: { ...BERLIN.location, latitude: null },
    });
    expect(getCountryOriginSnapshot().status).toBe('unavailable');
    expect(getCountryOriginSnapshot().origin).toBeNull();
  });

  it('rejects an out-of-range coordinate instead of sorting the world from it', async () => {
    const { getCountryOriginSnapshot } = await importService();
    setRuntimeSnapshot({ ...BERLIN, location: { ...BERLIN.location, latitude: 991 } });
    expect(getCountryOriginSnapshot().status).toBe('unavailable');
  });

  describe('dismissal', () => {
    it('drops the coordinates but keeps the guess visible so it can be undone', async () => {
      const service = await importService();
      setRuntimeSnapshot(BERLIN);
      const dismissed = service.dismissCountryOrigin();

      expect(dismissed.status).toBe('dismissed');
      expect(dismissed.origin).toBeNull();
      expect(dismissed.inferred?.city).toBe('Berlin');
    });

    it('survives as a session preference and is reversible', async () => {
      const service = await importService();
      setRuntimeSnapshot(BERLIN);
      service.dismissCountryOrigin();

      expect(window.sessionStorage.getItem(service.COUNTRY_ORIGIN_DISMISSED_SESSION_STORAGE_KEY)).toBe('1');
      expect(service.getCountryOriginSnapshot().status).toBe('dismissed');

      const restored = service.restoreCountryOrigin();
      expect(restored.status).toBe('ready');
      expect(restored.origin?.city).toBe('Berlin');
    });

    it('notifies subscribers so the grid re-sorts immediately', async () => {
      const service = await importService();
      setRuntimeSnapshot(BERLIN);

      const seen: string[] = [];
      const unsubscribe = service.subscribeCountryOrigin((snapshot) => seen.push(snapshot.status));
      service.dismissCountryOrigin();
      service.restoreCountryOrigin();
      unsubscribe();

      expect(seen).toEqual(['dismissed', 'ready']);
    });

    it('stops notifying once unsubscribed', async () => {
      const service = await importService();
      const listener = vi.fn();
      const unsubscribe = service.subscribeCountryOrigin(listener);
      unsubscribe();
      setRuntimeSnapshot(BERLIN);
      service.dismissCountryOrigin();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('returns a stable object reference between changes, so useSyncExternalStore cannot loop', async () => {
    const { getCountryOriginSnapshot } = await importService();
    setRuntimeSnapshot(BERLIN);
    expect(getCountryOriginSnapshot()).toBe(getCountryOriginSnapshot());
  });

  it('delegates the actual fetch to the shared runtime-location service', async () => {
    const service = await importService();
    setRuntimeSnapshot(BERLIN);
    const snapshot = await service.ensureCountryOriginLoaded();
    expect(ensureRuntimeLocationLoaded).toHaveBeenCalled();
    expect(snapshot.status).toBe('ready');
  });
});
