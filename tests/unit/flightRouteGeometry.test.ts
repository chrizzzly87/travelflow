import { describe, expect, it } from 'vitest';

import { buildCurvedFlightPath, buildFlightRouteVisualPaths } from '../../components/maps/flightRouteGeometry';

describe('components/maps/flightRouteGeometry', () => {
  it('builds a visibly curved flight path between distant cities', () => {
    const start = { lat: 14.5995, lng: 120.9842 };
    const end = { lat: 6.9214, lng: 122.079 };
    const path = buildCurvedFlightPath(start, end);

    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(end);
    expect(path[Math.floor(path.length / 2)].lat).toBeGreaterThan((start.lat + end.lat) / 2);
  });

  it('returns both the arced flight path and a straight ground shadow path', () => {
    const start = { lat: 13.7563, lng: 100.5018 };
    const end = { lat: 10.8231, lng: 106.6297 };
    const visualPaths = buildFlightRouteVisualPaths(start, end);

    expect(visualPaths.groundPath).toEqual([start, end]);
    expect(visualPaths.airPath.length).toBeGreaterThan(visualPaths.groundPath.length);
  });

  it('accepts provider-specific curve options so providers can tune flight arcs independently', () => {
    const start = { lat: 13.7563, lng: 100.5018 };
    const end = { lat: 10.8231, lng: 106.6297 };

    const defaultPath = buildCurvedFlightPath(start, end);
    const tunedPath = buildCurvedFlightPath(start, end, {
      samples: 32,
      liftRatio: 0.24,
      minLift: 0.3,
      maxLift: 5,
    });

    expect(tunedPath.length).toBeGreaterThan(defaultPath.length);
    expect(tunedPath[Math.floor(tunedPath.length / 2)].lat).toBeGreaterThan(
      defaultPath[Math.floor(defaultPath.length / 2)].lat,
    );
  });
});
