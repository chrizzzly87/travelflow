// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeLocationStoreSnapshot } from '../../services/runtimeLocationService';

const buildResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
  },
});

const makeRuntimeSnapshot = (overrides?: Partial<RuntimeLocationStoreSnapshot>): RuntimeLocationStoreSnapshot => ({
  loading: false,
  available: true,
  source: 'netlify-context',
  fetchedAt: '2026-03-21T18:00:00.000Z',
  location: {
    city: 'Berlin',
    countryCode: 'DE',
    countryName: 'Germany',
    subdivisionCode: 'BE',
    subdivisionName: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    timezone: 'Europe/Berlin',
    postalCode: '10115',
  },
  ...overrides,
});

describe('services/nearbyAirportsService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('fetches nearby airports and clamps the requested limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({
      origin: { lat: 52.52, lng: 13.405 },
      dataVersion: '2026-03-21-4086',
      airports: [
        {
          airport: {
            ident: 'EDDB',
            iataCode: 'BER',
            icaoCode: 'EDDB',
            name: 'Berlin Brandenburg Airport',
            municipality: 'Berlin',
            subdivisionName: 'Berlin',
            regionCode: 'DE-BE',
            countryCode: 'DE',
            countryName: 'Germany',
            latitude: 52.362247,
            longitude: 13.500672,
            timezone: 'Europe/Berlin',
            airportType: 'large_airport',
            scheduledService: true,
            isCommercial: true,
            commercialServiceTier: 'major',
            isMajorCommercial: true,
          },
          airDistanceKm: 18.9,
          rank: 1,
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/nearbyAirportsService');
    const response = await service.fetchNearbyAirports({
      lat: 52.52,
      lng: 13.405,
      limit: 99,
      minimumServiceTier: 'regional',
    });

    expect(response.airports).toHaveLength(1);
    const requestUrl = new URL(fetchMock.mock.calls[0][0], 'https://travelflow.test');
    expect(requestUrl.pathname).toBe('/api/runtime/nearby-airports');
    expect(requestUrl.searchParams.get('limit')).toBe('10');
    expect(requestUrl.searchParams.get('minimumServiceTier')).toBe('regional');
  });

  it('includes an optional country code filter in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({
      origin: { lat: 52.52, lng: 13.405 },
      dataVersion: '2026-03-21-4086',
      airports: [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/nearbyAirportsService');
    await service.fetchNearbyAirports({
      lat: 52.52,
      lng: 13.405,
      countryCode: 'de',
      fetchImpl: fetchMock,
    });

    const requestUrl = new URL(fetchMock.mock.calls[0][0], 'https://travelflow.test');
    expect(requestUrl.searchParams.get('countryCode')).toBe('DE');
    expect(requestUrl.searchParams.get('minimumServiceTier')).toBe('major');
  });

  it('uses provided runtime coordinates without requiring another runtime-location fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildResponse({
      origin: { lat: 52.52, lng: 13.405 },
      dataVersion: '2026-03-21-4086',
      airports: [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/nearbyAirportsService');
    const response = await service.fetchNearbyAirportsForRuntimeLocation({
      snapshot: makeRuntimeSnapshot(),
      fetchImpl: fetchMock,
    });

    expect(response?.origin).toEqual({ lat: 52.52, lng: 13.405 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(fetchMock.mock.calls[0][0], 'https://travelflow.test');
    expect(requestUrl.searchParams.get('minimumServiceTier')).toBe('major');
  });

  it('returns null when runtime coordinates are unavailable', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = await import('../../services/nearbyAirportsService');
    const response = await service.fetchNearbyAirportsForRuntimeLocation({
      snapshot: makeRuntimeSnapshot({
        available: false,
        source: 'unavailable',
        location: {
          city: null,
          countryCode: null,
          countryName: null,
          subdivisionCode: null,
          subdivisionName: null,
          latitude: null,
          longitude: null,
          timezone: null,
          postalCode: null,
        },
      }),
      fetchImpl: fetchMock,
    });

    expect(response).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
