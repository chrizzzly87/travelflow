// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  ROUTE_FAILURE_TTL_MS,
  ROUTE_PERSIST_TTL_MS,
  buildRoutePolylinePairOptions,
  buildPersistedRouteCachePayload,
  filterHydratedRouteCacheEntries,
  getRouteOuterOutlineColor,
  getRouteOutlineColor,
  resolveItineraryCenter,
  resolveMapResizeCameraStrategy,
  shouldRefitItineraryOnResize,
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

  it('uses dual-contrast outline colors', () => {
    expect(getRouteOutlineColor('standard')).toBe('#0f172a');
    expect(getRouteOutlineColor('minimal')).toBe('#0f172a');
    expect(getRouteOutlineColor('clean')).toBe('#0f172a');
    expect(getRouteOutlineColor('dark')).toBe('#0f172a');
    expect(getRouteOutlineColor('satellite')).toBe('#0f172a');
    expect(getRouteOuterOutlineColor('standard')).toBe('#f8fafc');
    expect(getRouteOuterOutlineColor('satellite')).toBe('#f8fafc');
  });

  it('keeps route outlines disabled while preserving the main stroke weight boost', () => {
    const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions({
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.7,
      strokeWeight: 3,
      clickable: false,
      zIndex: 40,
    } as any, 'satellite');

    expect(mainOptions.strokeWeight).toBe(4);
    expect(outlineOptions.strokeWeight).toBe(4);
    expect(outerOutlineOptions.strokeWeight).toBe(4);
    expect(outlineOptions.strokeOpacity).toBe(0);
    expect(outerOutlineOptions.strokeOpacity).toBe(0);
    expect(outlineOptions.icons).toBeUndefined();
    expect(outerOutlineOptions.icons).toBeUndefined();
    expect(mainOptions.zIndex).toBe(40);
    expect(outlineOptions.zIndex).toBe(39);
    expect(outerOutlineOptions.zIndex).toBe(38);
  });

  it('keeps icon-only fallback routes dashed without rendering outline icons', () => {
    const dashedIcons = [{
      icon: { path: 'M 0,-1 0,1', strokeColor: '#22c55e', strokeOpacity: 0.9, scale: 2.5 },
      offset: '0',
      repeat: '12px',
    }];

    const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions({
      geodesic: true,
      strokeColor: '#22c55e',
      strokeOpacity: 0,
      strokeWeight: 2,
      clickable: false,
      icons: dashedIcons,
      zIndex: 35,
    } as any, 'minimal');

    expect(mainOptions.strokeOpacity).toBe(0);
    expect(mainOptions.strokeWeight).toBe(3);
    expect(mainOptions.icons).toEqual(dashedIcons);
    expect(outlineOptions.strokeOpacity).toBe(0);
    expect(outerOutlineOptions.strokeOpacity).toBe(0);
    expect(outerOutlineOptions.strokeColor).toBe('#f8fafc');
    expect(outerOutlineOptions.strokeWeight).toBe(3);
    expect(outerOutlineOptions.zIndex).toBe(33);
    expect(outlineOptions.strokeColor).toBe('#0f172a');
    expect(outlineOptions.strokeWeight).toBe(3);
    expect(outlineOptions.zIndex).toBe(34);
    expect(outerOutlineOptions.icons).toBeUndefined();
    expect(outlineOptions.icons).toBeUndefined();
  });

  it('uses preserve-camera strategy while a city is actively focused or the map was manually moved', () => {
    expect(resolveMapResizeCameraStrategy({
      hasSelectedCity: true,
      hasManualViewportChange: false,
    })).toBe('preserve_camera');
    expect(resolveMapResizeCameraStrategy({
      hasSelectedCity: false,
      hasManualViewportChange: true,
    })).toBe('preserve_camera');
  });

  it('centers the itinerary on resize only when no active city is selected and no manual viewport changes exist', () => {
    expect(resolveMapResizeCameraStrategy({
      hasSelectedCity: false,
      hasManualViewportChange: false,
    })).toBe('center_itinerary');
  });

  it('resolves itinerary center from available city coordinates', () => {
    const center = resolveItineraryCenter([
      {
        id: 'city-a',
        type: 'city',
        title: 'A',
        location: 'A',
        startDateOffset: 0,
        duration: 1,
        color: 'bg-blue-500',
        coordinates: { lat: 10, lng: 20 },
      } as any,
      {
        id: 'city-b',
        type: 'city',
        title: 'B',
        location: 'B',
        startDateOffset: 2,
        duration: 1,
        color: 'bg-pink-500',
        coordinates: { lat: 20, lng: 40 },
      } as any,
    ]);

    expect(center).toEqual({ lat: 15, lng: 30 });
    expect(resolveItineraryCenter([] as any)).toBeNull();
    expect(resolveItineraryCenter([{
      id: 'x',
      type: 'activity',
      title: 'X',
      location: 'X',
      startDateOffset: 0,
      duration: 1,
    }] as any)).toBeNull();
  });

  it('triggers itinerary refit when viewport area shrinks significantly', () => {
    expect(shouldRefitItineraryOnResize({
      previousWidth: 300,
      previousHeight: 450,
      nextWidth: 220,
      nextHeight: 330,
    })).toBe(true);
  });

  it('triggers itinerary refit when viewport aspect ratio changes heavily (portrait/landscape flip)', () => {
    expect(shouldRefitItineraryOnResize({
      previousWidth: 220,
      previousHeight: 360,
      nextWidth: 360,
      nextHeight: 220,
    })).toBe(true);
  });

  it('does not refit on minor resize deltas', () => {
    expect(shouldRefitItineraryOnResize({
      previousWidth: 320,
      previousHeight: 480,
      nextWidth: 326,
      nextHeight: 478,
    })).toBe(false);
  });
});
