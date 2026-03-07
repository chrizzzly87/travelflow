import { describe, expect, it } from 'vitest';

import { getRouteDistanceText } from '../../components/DetailsPanel';

describe('components/DetailsPanel route distance text', () => {
  it('returns the distance label when available', () => {
    expect(getRouteDistanceText({
      routeDistanceLabel: '422 km',
      canRoute: true,
      routeStatus: 'ready',
    })).toBe('422 km');
  });

  it('shows calculating only while route status is calculating', () => {
    expect(getRouteDistanceText({
      routeDistanceLabel: null,
      canRoute: true,
      routeStatus: 'calculating',
    })).toBe('Calculating…');

    expect(getRouteDistanceText({
      routeDistanceLabel: null,
      canRoute: true,
      routeStatus: undefined,
    })).toBe('N/A');
  });

  it('shows N/A when routing is unavailable or complete without route distance', () => {
    expect(getRouteDistanceText({
      routeDistanceLabel: null,
      canRoute: false,
      routeStatus: undefined,
    })).toBe('N/A');

    expect(getRouteDistanceText({
      routeDistanceLabel: null,
      canRoute: true,
      routeStatus: 'ready',
    })).toBe('N/A');

    expect(getRouteDistanceText({
      routeDistanceLabel: null,
      canRoute: true,
      routeStatus: 'failed',
    })).toBe('N/A');
  });
});
