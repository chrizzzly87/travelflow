// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  MAX_BICYCLE_ROUTE_CHECK_KM,
  MAX_DRIVING_ROUTE_CHECK_KM,
  MAX_TRANSIT_ROUTE_CHECK_KM,
  MAX_WALK_ROUTE_CHECK_KM,
  TRANSIT_DRIVING_RETRY_MAX_KM,
  buildRouteAttemptPolicy,
  ROUTE_FAILURE_TTL_MS,
  ROUTE_PERSIST_TTL_MS,
  buildRoutePolylinePairOptions,
  buildPersistedRouteCachePayload,
  estimateGreatCircleDistanceKm,
  filterHydratedRouteCacheEntries,
  getRouteOuterOutlineColor,
  getRouteOutlineColor,
  resolveItineraryCenter,
  resolveMapResizeCameraStrategy,
  shouldIgnoreManualViewportEventTarget,
  shouldRecordManualViewportChange,
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

  it('keeps non-dark route outlines disabled while preserving the main stroke weight boost', () => {
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

  it('renders a visible outer white route outline for dark style', () => {
    const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions({
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.7,
      strokeWeight: 3,
      clickable: false,
      zIndex: 40,
    } as any, 'dark');

    expect(mainOptions.strokeWeight).toBe(4);
    expect(outlineOptions.strokeWeight).toBe(5);
    expect(outerOutlineOptions.strokeWeight).toBe(6);
    expect(outlineOptions.strokeOpacity).toBe(0);
    expect(outerOutlineOptions.strokeOpacity).toBe(0.95);
    expect(outerOutlineOptions.strokeColor).toBe('#f8fafc');
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

  it('estimates great-circle distance between two points', () => {
    const berlin = { lat: 52.52, lng: 13.405 };
    const munich = { lat: 48.137154, lng: 11.576124 };
    const km = estimateGreatCircleDistanceKm(berlin, munich);
    expect(Math.round(km)).toBe(504);
  });

  it('skips impossible route checks by mode and distance caps', () => {
    expect(buildRouteAttemptPolicy('walk', MAX_WALK_ROUTE_CHECK_KM + 1)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'distance_cap_exceeded',
    });
    expect(buildRouteAttemptPolicy('bicycle', MAX_BICYCLE_ROUTE_CHECK_KM + 1)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'distance_cap_exceeded',
    });
    expect(buildRouteAttemptPolicy('train', MAX_TRANSIT_ROUTE_CHECK_KM + 1)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'distance_cap_exceeded',
    });
    expect(buildRouteAttemptPolicy('car', MAX_DRIVING_ROUTE_CHECK_KM + 1)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'distance_cap_exceeded',
    });
  });

  it('returns retry order by mode for better quality at bounded cost', () => {
    expect(buildRouteAttemptPolicy('walk', 12)).toEqual({
      shouldAttempt: true,
      modes: ['WALKING'],
    });
    expect(buildRouteAttemptPolicy('bicycle', 45)).toEqual({
      shouldAttempt: true,
      modes: ['BICYCLING'],
    });
    expect(buildRouteAttemptPolicy('train', TRANSIT_DRIVING_RETRY_MAX_KM - 1)).toEqual({
      shouldAttempt: true,
      modes: ['TRANSIT', 'DRIVING'],
    });
    expect(buildRouteAttemptPolicy('bus', TRANSIT_DRIVING_RETRY_MAX_KM + 1)).toEqual({
      shouldAttempt: true,
      modes: ['TRANSIT'],
    });
    expect(buildRouteAttemptPolicy('motorcycle', 120)).toEqual({
      shouldAttempt: true,
      modes: ['DRIVING'],
    });
    expect(buildRouteAttemptPolicy('plane', 120)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'unsupported_mode',
    });
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

  it('triggers itinerary refit when viewport area grows significantly', () => {
    expect(shouldRefitItineraryOnResize({
      previousWidth: 220,
      previousHeight: 330,
      nextWidth: 300,
      nextHeight: 450,
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

  it('ignores manual-viewport recording while suppression window is active', () => {
    expect(shouldRecordManualViewportChange({
      nowMs: 100,
      suppressUntilMs: 160,
    })).toBe(false);
    expect(shouldRecordManualViewportChange({
      nowMs: 200,
      suppressUntilMs: 160,
    })).toBe(true);
  });

  it('ignores manual intent detection when interaction starts from map controls', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div data-floating-map-control="true">
        <button id="map-control-btn">Resize</button>
      </div>
      <button id="outside-btn">Outside</button>
    `;
    const mapControlButton = wrapper.querySelector('#map-control-btn');
    const outsideButton = wrapper.querySelector('#outside-btn');

    expect(shouldIgnoreManualViewportEventTarget(mapControlButton)).toBe(true);
    expect(shouldIgnoreManualViewportEventTarget(outsideButton)).toBe(false);
    expect(shouldIgnoreManualViewportEventTarget(null)).toBe(false);
  });
});
