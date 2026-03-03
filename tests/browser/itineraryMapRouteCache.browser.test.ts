// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  MAP_VIEWPORT_READY_MIN_DIMENSION_PX,
  MAX_BICYCLE_ROUTE_CHECK_KM,
  MAX_DRIVING_ROUTE_CHECK_KM,
  MAX_TRANSIT_ROUTE_CHECK_KM,
  MAX_WALK_ROUTE_CHECK_KM,
  ROUTES_COMPUTE_FIELDS,
  TRANSIT_SECOND_PASS_MAX_KM,
  buildOverlappingMarkerPosition,
  buildRouteAttemptPolicy,
  classifyRouteComputationError,
  mapRouteAttemptPolicyReasonToFailureReason,
  computeMaxPathDeviationMeters,
  ROUTE_FAILURE_TTL_MS,
  ROUTE_PERSIST_TTL_MS,
  shouldLogRouteFailureWarning,
  buildRoutePolylinePairOptions,
  buildPersistedRouteCachePayload,
  estimateGreatCircleDistanceKm,
  filterHydratedRouteCacheEntries,
  getRouteOuterOutlineColor,
  getRouteOutlineColor,
  getMapLabelCityName,
  resolveActivityMarkerPositions,
  resolveSelectedMapFocusPosition,
  resolveCityLabelAnchor,
  isRoutePathLikelyStraight,
  isMapViewportReady,
  offsetLatLngByMeters,
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
    const routeCache = new Map<string, {
      status: 'ok' | 'failed';
      updatedAt: number;
      path?: Array<{ lat: number; lng: number }>;
      reason?: string;
    }>();
    routeCache.set('freshOk', { status: 'ok', updatedAt: now - 2000, path: [{ lat: 1, lng: 2 }] });
    routeCache.set('staleOk', { status: 'ok', updatedAt: now - ROUTE_PERSIST_TTL_MS - 1, path: [{ lat: 2, lng: 3 }] });
    routeCache.set('freshFailed', {
      status: 'failed',
      updatedAt: now - 1000,
      path: [{ lat: 3, lng: 4 }],
      reason: 'zero_results',
    });
    routeCache.set('staleFailed', { status: 'failed', updatedAt: now - ROUTE_FAILURE_TTL_MS - 1 });

    const payload = buildPersistedRouteCachePayload(routeCache, now);

    expect(payload).toEqual({
      freshOk: { status: 'ok', updatedAt: now - 2000, path: [{ lat: 1, lng: 2 }] },
      freshFailed: { status: 'failed', updatedAt: now - 1000, reason: 'zero_results' },
    });
  });

  it('maps route-attempt policy reasons to route failure reasons', () => {
    expect(mapRouteAttemptPolicyReasonToFailureReason('unsupported_mode')).toBe('unsupported_mode');
    expect(mapRouteAttemptPolicyReasonToFailureReason('distance_cap_exceeded')).toBe('distance_cap_exceeded');
    expect(mapRouteAttemptPolicyReasonToFailureReason('invalid_distance')).toBe('invalid_distance');
    expect(mapRouteAttemptPolicyReasonToFailureReason(undefined)).toBe('request_error');
  });

  it('classifies route computation errors into stable failure reasons', () => {
    expect(classifyRouteComputationError('MapsRequestError: ZERO_RESULTS')).toBe('zero_results');
    expect(classifyRouteComputationError(new Error('No route path returned'))).toBe('no_route_path');
    expect(classifyRouteComputationError(new Error('Route path is straight'))).toBe('straight_path');
    expect(classifyRouteComputationError(new Error('Routes API unavailable'))).toBe('api_unavailable');
    expect(classifyRouteComputationError(new Error('Something else'))).toBe('request_error');
  });

  it('deduplicates repeated route failure warnings per leg/mode/reason for a short window', () => {
    const params = { routeKey: 'leg-a', mode: 'train', reason: 'zero_results' as const };
    expect(shouldLogRouteFailureWarning({ ...params, nowMs: 1_000 })).toBe(true);
    expect(shouldLogRouteFailureWarning({ ...params, nowMs: 61_000 })).toBe(false);
    expect(shouldLogRouteFailureWarning({ ...params, nowMs: 121_000 })).toBe(true);
  });

  it('uses city-only names for map labels when titles include country segments', () => {
    expect(getMapLabelCityName('Bangkok, Thailand')).toBe('Bangkok');
    expect(getMapLabelCityName('Hoi An')).toBe('Hoi An');
    expect(getMapLabelCityName('')).toBe('');
  });

  it('chooses label anchors that reduce overlap with adjacent route segments', () => {
    const city = { lat: 13.75, lng: 100.5 };
    const west = { lat: 13.75, lng: 100.2 };
    const east = { lat: 13.75, lng: 100.8 };
    const north = { lat: 14.05, lng: 100.5 };
    const south = { lat: 13.45, lng: 100.5 };

    expect(resolveCityLabelAnchor(city, west, east)).toBe('below');
    expect(resolveCityLabelAnchor(city, south, north)).toBe('right');
    expect(resolveCityLabelAnchor(city, null, null)).toBe('right');
  });

  it('uses dual-contrast outline colors', () => {
    expect(getRouteOutlineColor('standard')).toBe('#eef2f7');
    expect(getRouteOutlineColor('minimal')).toBe('#f5f5f5');
    expect(getRouteOutlineColor('clean')).toBe('#ffffff');
    expect(getRouteOutlineColor('dark')).toBe('#1b2230');
    expect(getRouteOutlineColor('cleanDark')).toBe('#1b2230');
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

  it('uses route-colored outer outlines for dark styles', () => {
    const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions({
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.7,
      strokeWeight: 3,
      clickable: false,
      zIndex: 40,
    } as any, 'dark');

    expect(mainOptions.strokeWeight).toBe(4);
    expect(outlineOptions.strokeWeight).toBe(7);
    expect(outerOutlineOptions.strokeWeight).toBe(9);
    expect(outlineOptions.strokeOpacity).toBe(1);
    expect(outerOutlineOptions.strokeOpacity).toBe(0.5);
    expect(outlineOptions.strokeColor).toBe('#1b2230');
    expect(outerOutlineOptions.strokeColor).toBe('#2563eb');
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
    expect(outlineOptions.strokeColor).toBe('#f5f5f5');
    expect(outlineOptions.strokeWeight).toBe(3);
    expect(outlineOptions.zIndex).toBe(34);
    expect(outerOutlineOptions.icons).toBeUndefined();
    expect(outlineOptions.icons).toBeUndefined();
  });

  it('keeps dashed dark fallback routes without an outer border', () => {
    const dashedIcons = [{
      icon: { path: 'M 0,-1 0,1', strokeColor: '#f43f5e', strokeOpacity: 0.9, scale: 2.5 },
      offset: '0',
      repeat: '12px',
    }];

    const { outerOutlineOptions, outlineOptions, mainOptions } = buildRoutePolylinePairOptions({
      geodesic: true,
      strokeColor: '#f43f5e',
      strokeOpacity: 0,
      strokeWeight: 2,
      clickable: false,
      icons: dashedIcons,
      zIndex: 35,
    } as any, 'cleanDark');

    expect(mainOptions.strokeOpacity).toBe(0);
    expect(mainOptions.icons).toEqual(dashedIcons);
    expect(outlineOptions.strokeOpacity).toBe(1);
    expect(outerOutlineOptions.strokeOpacity).toBe(0);
    expect(outlineOptions.strokeColor).toBe('#1b2230');
    expect(outerOutlineOptions.strokeColor).toBe('#f43f5e');
  });

  it('estimates great-circle distance between two points', () => {
    const berlin = { lat: 52.52, lng: 13.405 };
    const munich = { lat: 48.137154, lng: 11.576124 };
    const km = estimateGreatCircleDistanceKm(berlin, munich);
    expect(Math.round(km)).toBe(504);
  });

  it('measures path deviation from a straight leg', () => {
    const start = { lat: 13.7563, lng: 100.5018 };
    const end = { lat: 13.3633, lng: 103.8564 };
    const straightPath = [start, end];
    const bentPath = [
      start,
      { lat: 13.95, lng: 101.7 },
      { lat: 13.7, lng: 102.8 },
      end,
    ];

    expect(computeMaxPathDeviationMeters(straightPath, start, end)).toBe(0);
    expect(computeMaxPathDeviationMeters(bentPath, start, end)).toBeGreaterThan(1000);
  });

  it('flags low-fidelity transit paths as straight-like', () => {
    const start = { lat: 13.7563, lng: 100.5018 };
    const end = { lat: 13.3633, lng: 103.8564 };
    const nearStraightTransitPath = [
      start,
      { lat: 13.62, lng: 101.65 },
      { lat: 13.53, lng: 102.72 },
      end,
    ];

    expect(isRoutePathLikelyStraight([start, end], start, end, 'bus')).toBe(true);
    expect(isRoutePathLikelyStraight(nearStraightTransitPath, start, end, 'bus')).toBe(true);
  });

  it('accepts sufficiently curved transit paths', () => {
    const start = { lat: 13.7563, lng: 100.5018 };
    const end = { lat: 13.3633, lng: 103.8564 };
    const curvedTransitPath = [
      start,
      { lat: 14.48, lng: 101.05 },
      { lat: 14.61, lng: 102.24 },
      { lat: 14.16, lng: 103.18 },
      end,
    ];

    expect(isRoutePathLikelyStraight(curvedTransitPath, start, end, 'bus')).toBe(false);
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
    expect(buildRouteAttemptPolicy('train', TRANSIT_SECOND_PASS_MAX_KM - 1)).toEqual({
      shouldAttempt: true,
      modes: ['TRANSIT', 'TRANSIT'],
    });
    expect(buildRouteAttemptPolicy('bus', TRANSIT_SECOND_PASS_MAX_KM + 1)).toEqual({
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

  it('offsets coordinates by meter deltas for overlapping markers', () => {
    const origin = { lat: 52.52, lng: 13.405 };
    const shifted = offsetLatLngByMeters(origin, 500, 500);
    expect(shifted.lat).toBeGreaterThan(origin.lat);
    expect(shifted.lng).toBeGreaterThan(origin.lng);
  });

  it('spreads overlapping markers around the origin', () => {
    const origin = { lat: 34.5553, lng: 69.2075 };
    const first = buildOverlappingMarkerPosition(origin, 0, 2);
    const second = buildOverlappingMarkerPosition(origin, 1, 2);
    expect(first).not.toEqual(second);
    expect(first.lat).toBeLessThan(origin.lat);
    expect(second.lat).toBeGreaterThan(origin.lat);
  });

  it('builds activity marker positions using city fallback coordinates with offsets', () => {
    const items = [
      {
        id: 'city-1',
        type: 'city',
        title: 'Bangkok',
        startDateOffset: 0,
        duration: 2,
        color: 'bg-blue-100 border-blue-300 text-blue-800',
        coordinates: { lat: 13.7563, lng: 100.5018 },
      },
      {
        id: 'activity-1',
        type: 'activity',
        title: 'Food walk',
        startDateOffset: 0.3,
        duration: 0.2,
        color: 'bg-amber-100 border-amber-300 text-amber-800',
        activityType: ['food'],
      },
      {
        id: 'activity-2',
        type: 'activity',
        title: 'Temple stop',
        startDateOffset: 0.6,
        duration: 0.2,
        color: 'bg-sky-100 border-sky-300 text-sky-800',
        activityType: ['culture'],
      },
    ] as any;

    const markers = resolveActivityMarkerPositions(items);
    expect(markers).toHaveLength(2);
    expect(markers[0].coordinateSource).toBe('city');
    expect(markers[1].coordinateSource).toBe('city');
    expect(markers[0].position).not.toEqual(markers[0].baseCoordinates);
    expect(markers[1].position).not.toEqual(markers[1].baseCoordinates);
    expect(markers[0].position).not.toEqual(markers[1].position);
  });

  it('prefers selected activity marker position over selected city position for map focus', () => {
    const activityPositions = new Map<string, { lat: number; lng: number }>();
    activityPositions.set('activity-1', { lat: 50.11, lng: 8.67 });
    const cities = [{
      id: 'city-1',
      type: 'city',
      title: 'Frankfurt',
      startDateOffset: 0,
      duration: 2,
      color: 'bg-blue-100 border-blue-300 text-blue-800',
      coordinates: { lat: 50.1109, lng: 8.6821 },
    }] as any;

    const focusTarget = resolveSelectedMapFocusPosition({
      selectedActivityId: 'activity-1',
      selectedCityId: 'city-1',
      activityMarkerPositions: activityPositions as any,
      cities,
    });

    expect(focusTarget).toEqual({
      position: { lat: 50.11, lng: 8.67 },
      zoom: 13,
    });
  });

  it('provides an explicit field mask for computeRoutes requests', () => {
    expect(ROUTES_COMPUTE_FIELDS).toEqual([
      'path',
      'distanceMeters',
      'durationMillis',
    ]);
  });

  it('detects when the map viewport is large enough for reliable fit bounds', () => {
    expect(isMapViewportReady(null)).toBe(false);
    expect(isMapViewportReady({ width: MAP_VIEWPORT_READY_MIN_DIMENSION_PX - 1, height: 220 })).toBe(false);
    expect(isMapViewportReady({ width: 240, height: MAP_VIEWPORT_READY_MIN_DIMENSION_PX - 1 })).toBe(false);
    expect(isMapViewportReady({
      width: MAP_VIEWPORT_READY_MIN_DIMENSION_PX,
      height: MAP_VIEWPORT_READY_MIN_DIMENSION_PX,
    })).toBe(true);
  });
});
