import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The cache module keeps its Map and its "already hydrated" flag at module
// level, so every test imports a fresh copy after `vi.resetModules()`.
const storage = new Map<string, string>();

vi.mock('../../services/browserStorageService', () => ({
  readLocalStorageItem: (key: string) => storage.get(key) ?? null,
  writeLocalStorageItem: (key: string, value: string) => {
    storage.set(key, value);
    return true;
  },
}));

const loadRouteCache = async () => {
  vi.resetModules();
  return import('../../components/maps/routeCache');
};

const NOW = Date.UTC(2026, 9, 31, 12, 0, 0);

describe('components/maps/routeCache', () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('hydrates fresh entries and drops expired successes and failures', async () => {
    const cache = await loadRouteCache();
    storage.set(cache.ROUTE_STORAGE_KEY, JSON.stringify({
      freshOk: { status: 'ok', updatedAt: NOW - 1_000, path: [{ lat: 1, lng: 2 }] },
      staleOk: { status: 'ok', updatedAt: NOW - cache.ROUTE_PERSIST_TTL_MS - 1 },
      freshFailed: { status: 'failed', updatedAt: NOW - 1_000, reason: 'zero_results' },
      staleFailed: { status: 'failed', updatedAt: NOW - cache.ROUTE_FAILURE_TTL_MS - 1 },
      missingStatus: { updatedAt: NOW },
    }));

    cache.hydrateRouteCache();

    expect([...cache.ROUTE_CACHE.keys()].sort()).toEqual(['freshFailed', 'freshOk']);
    expect(cache.ROUTE_CACHE.get('freshOk')?.path).toEqual([{ lat: 1, lng: 2 }]);
  });

  it('keeps a failure exactly at its TTL and drops it one millisecond later', async () => {
    const cache = await loadRouteCache();
    const entries = {
      atTtl: { status: 'failed', updatedAt: NOW - cache.ROUTE_FAILURE_TTL_MS },
      pastTtl: { status: 'failed', updatedAt: NOW - cache.ROUTE_FAILURE_TTL_MS - 1 },
    };

    expect(cache.filterHydratedRouteCacheEntries(entries, NOW).map(([key]) => key)).toEqual(['atTtl']);
  });

  it('hydrates only once per page, even if storage changes afterwards', async () => {
    const cache = await loadRouteCache();
    storage.set(cache.ROUTE_STORAGE_KEY, JSON.stringify({
      first: { status: 'ok', updatedAt: NOW },
    }));
    cache.hydrateRouteCache();

    storage.set(cache.ROUTE_STORAGE_KEY, JSON.stringify({
      second: { status: 'ok', updatedAt: NOW },
    }));
    cache.hydrateRouteCache();

    expect([...cache.ROUTE_CACHE.keys()]).toEqual(['first']);
  });

  it('does nothing without a window and hydrates on a later call that has one', async () => {
    vi.unstubAllGlobals();
    const cache = await loadRouteCache();
    storage.set(cache.ROUTE_STORAGE_KEY, JSON.stringify({
      entry: { status: 'ok', updatedAt: NOW },
    }));

    cache.hydrateRouteCache();
    expect(cache.ROUTE_CACHE.size).toBe(0);

    vi.stubGlobal('window', {});
    cache.hydrateRouteCache();
    expect(cache.ROUTE_CACHE.size).toBe(1);
  });

  it('survives malformed stored JSON', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = await loadRouteCache();
    storage.set(cache.ROUTE_STORAGE_KEY, '{not json');

    expect(() => cache.hydrateRouteCache()).not.toThrow();
    expect(cache.ROUTE_CACHE.size).toBe(0);
    expect(warn).toHaveBeenCalledWith('Failed to hydrate route cache', expect.any(SyntaxError));
  });

  it('persists fresh entries, strips failures down to status and reason, and drops expired ones', async () => {
    const cache = await loadRouteCache();
    cache.ROUTE_CACHE.set('ok', { status: 'ok', updatedAt: NOW - 1_000, path: [{ lat: 1, lng: 2 }], distanceKm: 12 });
    cache.ROUTE_CACHE.set('staleOk', { status: 'ok', updatedAt: NOW - cache.ROUTE_PERSIST_TTL_MS - 1 });
    cache.ROUTE_CACHE.set('failed', {
      status: 'failed',
      updatedAt: NOW - 1_000,
      reason: 'zero_results',
      path: [{ lat: 9, lng: 9 }],
    });
    cache.ROUTE_CACHE.set('staleFailed', { status: 'failed', updatedAt: NOW - cache.ROUTE_FAILURE_TTL_MS - 1 });

    cache.persistRouteCache();

    expect(JSON.parse(storage.get(cache.ROUTE_STORAGE_KEY) ?? '{}')).toEqual({
      ok: { status: 'ok', updatedAt: NOW - 1_000, path: [{ lat: 1, lng: 2 }], distanceKm: 12 },
      failed: { status: 'failed', updatedAt: NOW - 1_000, reason: 'zero_results' },
    });
  });

  it('round-trips a persisted cache into a fresh page', async () => {
    const first = await loadRouteCache();
    first.ROUTE_CACHE.set('leg', { status: 'ok', updatedAt: NOW, durationHours: 2 });
    first.persistRouteCache();

    const second = await loadRouteCache();
    expect(second.ROUTE_CACHE).not.toBe(first.ROUTE_CACHE);
    expect(second.ROUTE_CACHE.size).toBe(0);
    second.hydrateRouteCache();
    expect(second.ROUTE_CACHE.get('leg')).toEqual({ status: 'ok', updatedAt: NOW, durationHours: 2 });
  });

  it('logs a route failure warning once per key, mode and reason within its TTL', async () => {
    const cache = await loadRouteCache();
    const warning = { routeKey: 'a->b', mode: 'train', reason: 'zero_results' as const };

    expect(cache.shouldLogRouteFailureWarning({ ...warning, nowMs: NOW })).toBe(true);
    expect(cache.shouldLogRouteFailureWarning({ ...warning, nowMs: NOW + 1 })).toBe(false);
    expect(cache.shouldLogRouteFailureWarning({ ...warning, mode: 'bus', nowMs: NOW + 1 })).toBe(true);
    expect(cache.shouldLogRouteFailureWarning({
      ...warning,
      nowMs: NOW + cache.ROUTE_FAILURE_WARNING_TTL_MS,
    })).toBe(true);
  });
});
