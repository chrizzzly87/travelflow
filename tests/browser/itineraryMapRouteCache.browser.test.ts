// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ROUTE_FAILURE_TTL_MS,
  ROUTE_PERSIST_TTL_MS,
  buildPersistedRouteCachePayload,
  filterHydratedRouteCacheEntries,
} from '../../components/ItineraryMap';

describe('components/ItineraryMap route cache helpers', () => {
  it('filters persisted route entries by status and ttl', () => {
    const now = Date.now();
    const filtered = filterHydratedRouteCacheEntries({
      freshOk: { status: 'ok', updatedAt: now - 1000, path: [] },
      staleOk: { status: 'ok', updatedAt: now - ROUTE_PERSIST_TTL_MS - 10, path: [] },
      freshFailed: { status: 'failed', updatedAt: now - 1000 },
      staleFailed: { status: 'failed', updatedAt: now - ROUTE_FAILURE_TTL_MS - 10 },
      invalid: { status: 'ok' } as unknown,
    }, now);

    expect(filtered.map(([key]) => key).sort()).toEqual(['freshFailed', 'freshOk']);
  });

  it('serializes route cache payload with ttl-aware filtering', () => {
    const now = Date.now();
    const routeCache = new Map<string, { status: 'ok' | 'failed'; updatedAt: number; path?: Array<{ lat: number; lng: number }> }>();
    routeCache.set('freshOk', { status: 'ok', updatedAt: now - 2000, path: [{ lat: 1, lng: 2 }] });
    routeCache.set('staleOk', { status: 'ok', updatedAt: now - ROUTE_PERSIST_TTL_MS - 1, path: [{ lat: 2, lng: 3 }] });
    routeCache.set('freshFailed', { status: 'failed', updatedAt: now - 1000, path: [{ lat: 3, lng: 4 }] });
    routeCache.set('staleFailed', { status: 'failed', updatedAt: now - ROUTE_FAILURE_TTL_MS - 1 });

    const payload = buildPersistedRouteCachePayload(routeCache, now);

    expect(payload).toEqual({
      freshOk: { status: 'ok', updatedAt: now - 2000, path: [{ lat: 1, lng: 2 }] },
      freshFailed: { status: 'failed', updatedAt: now - 1000 },
    });
  });
});
