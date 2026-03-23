// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeGoogleRouteLeg, loadGoogleRouteRuntime } from '../../services/routeService';

describe('services/routeService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as typeof window & { google?: unknown }).google;
  });

  it('loads the Google routes runtime from importLibrary', async () => {
    const computeRoutes = vi.fn();
    const importLibrary = vi.fn().mockResolvedValue({
      Route: {
        computeRoutes,
      },
      TransitMode: {
        BUS: 'BUS',
      },
    });

    (window as typeof window & { google?: unknown }).google = {
      maps: {
        importLibrary,
      },
    };

    const runtime = await loadGoogleRouteRuntime();
    expect(importLibrary).toHaveBeenCalledWith('routes');
    expect(runtime).not.toBeNull();
    expect(runtime?.computeRoutes).toBeTypeOf('function');
    expect(runtime?.transitModes).toEqual({ BUS: 'BUS' });
  });

  it('retries with the minimal field mask when Google rejects the primary field request', async () => {
    const computeRoutes = vi.fn()
      .mockRejectedValueOnce(new Error('Request contains invalid fields in the field mask'))
      .mockResolvedValueOnce({
        routes: [{
          path: [
            { lat: 52.52, lng: 13.405 },
            { lat: 48.8566, lng: 2.3522 },
          ],
          distanceMeters: 1_050_000,
          durationMillis: 36_000_000,
        }],
      });

    const result = await computeGoogleRouteLeg({
      origin: { lat: 52.52, lng: 13.405 },
      destination: { lat: 48.8566, lng: 2.3522 },
      travelMode: 'TRANSIT' as google.maps.TravelMode,
      transportMode: 'train',
      attemptIndex: 0,
      routeRuntime: {
        computeRoutes,
        transitModes: {
          TRAIN: 'TRAIN',
          RAIL: 'RAIL',
        },
      },
    });

    expect(computeRoutes).toHaveBeenCalledTimes(2);
    expect(computeRoutes.mock.calls[0][0]).toMatchObject({
      fields: ['path', 'distanceMeters', 'durationMillis'],
      transitPreference: {
        allowedTransitModes: ['TRAIN', 'RAIL'],
      },
    });
    expect(computeRoutes.mock.calls[1][0]).toMatchObject({
      fields: ['path'],
      transitPreference: {
        allowedTransitModes: ['TRAIN', 'RAIL'],
      },
    });
    expect(result.path).toEqual([
      { lat: 52.52, lng: 13.405 },
      { lat: 48.8566, lng: 2.3522 },
    ]);
    expect(result.distanceKm).toBeCloseTo(1050, 5);
    expect(result.durationHours).toBeCloseTo(10, 5);
  });
});
