// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ROUTE_FAILURE_TTL_MS,
  ROUTE_PERSIST_TTL_MS,
  buildRoutePolylinePairOptions,
  buildPersistedRouteCachePayload,
  filterHydratedRouteCacheEntries,
  getRouteOutlineColor,
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

  it('maps route outline colors by map style', () => {
    expect(getRouteOutlineColor('standard')).toBe('#0f172a');
    expect(getRouteOutlineColor('minimal')).toBe('#0f172a');
    expect(getRouteOutlineColor('clean')).toBe('#0f172a');
    expect(getRouteOutlineColor('dark')).toBe('#f8fafc');
    expect(getRouteOutlineColor('satellite')).toBe('#f8fafc');
  });

  it('keeps icon-only fallback routes dashed while still applying outline icons', () => {
    const dashedIcons = [{
      icon: { path: 'M 0,-1 0,1', strokeColor: '#22c55e', strokeOpacity: 0.9, scale: 2.5 },
      offset: '0',
      repeat: '12px',
    }];

    const { outlineOptions, mainOptions } = buildRoutePolylinePairOptions({
      geodesic: true,
      strokeColor: '#22c55e',
      strokeOpacity: 0,
      strokeWeight: 2,
      clickable: false,
      icons: dashedIcons,
      zIndex: 35,
    } as any, 'minimal');

    expect(mainOptions.strokeOpacity).toBe(0);
    expect(mainOptions.icons).toEqual(dashedIcons);
    expect(outlineOptions.strokeOpacity).toBe(0);
    expect(outlineOptions.strokeColor).toBe('#0f172a');
    expect(outlineOptions.zIndex).toBe(34);

    const outlineIcon = outlineOptions.icons?.[0]?.icon as { strokeColor?: string; scale?: number; strokeOpacity?: number } | undefined;
    expect(outlineIcon?.strokeColor).toBe('#0f172a');
    expect(outlineIcon?.scale).toBe(3.5);
    expect(outlineIcon?.strokeOpacity).toBeGreaterThanOrEqual(0.95);
  });
});
