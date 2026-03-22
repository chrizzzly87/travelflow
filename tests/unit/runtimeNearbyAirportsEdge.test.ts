import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findNearestCommercialAirports: vi.fn(),
  loadAirportReferenceMetadataFromStaticAsset: vi.fn(),
  loadCommercialAirportReferencesFromStaticAsset: vi.fn(),
}));

vi.mock('../../shared/airportReference.ts', async () => {
  const actual = await vi.importActual<typeof import('../../shared/airportReference.ts')>('../../shared/airportReference.ts');
  return {
    ...actual,
    findNearestCommercialAirports: mocks.findNearestCommercialAirports,
  };
});

vi.mock('../../netlify/edge-lib/airport-reference-static.ts', () => ({
  loadAirportReferenceMetadataFromStaticAsset: mocks.loadAirportReferenceMetadataFromStaticAsset,
  loadCommercialAirportReferencesFromStaticAsset: mocks.loadCommercialAirportReferencesFromStaticAsset,
}));

import handler, { __runtimeNearbyAirportsInternals } from '../../netlify/edge-functions/runtime-nearby-airports.ts';

describe('runtime nearby airports edge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAirportReferenceMetadataFromStaticAsset.mockResolvedValue({
      dataVersion: '2026-03-21-4086',
    });
    mocks.loadCommercialAirportReferencesFromStaticAsset.mockResolvedValue([
      {
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
    ]);
    mocks.findNearestCommercialAirports.mockReturnValue([
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
        airDistanceKm: 18.4,
        rank: 1,
      },
    ]);
    vi.unstubAllGlobals();
  });

  it('rejects non-GET requests', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/nearby-airports', {
      method: 'POST',
    }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('rejects invalid coordinates', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/nearby-airports?lat=200&lng=13.4'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Valid lat and lng query parameters are required.',
    });
  });

  it('uses the local snapshot fallback when Supabase config is unavailable', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/nearby-airports?lat=52.52&lng=13.405&limit=20'));

    expect(response.status).toBe(200);
    expect(mocks.loadCommercialAirportReferencesFromStaticAsset).toHaveBeenCalledTimes(1);
    expect(mocks.findNearestCommercialAirports).toHaveBeenCalledWith(expect.objectContaining({
      lat: 52.52,
      lng: 13.405,
      limit: 10,
      minimumServiceTier: 'local',
      countryCode: null,
    }));
    await expect(response.json()).resolves.toEqual({
      origin: { lat: 52.52, lng: 13.405 },
      airports: expect.any(Array),
      dataVersion: '2026-03-21-4086',
    });
  });

  it('uses the Supabase RPC when config is present and the response is valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          ident: 'EDDB',
          iata_code: 'BER',
          icao_code: 'EDDB',
          name: 'Berlin Brandenburg Airport',
          municipality: 'Berlin',
          subdivision_name: 'Berlin',
          region_code: 'DE-BE',
          country_code: 'DE',
          country_name: 'Germany',
          latitude: 52.362247,
          longitude: 13.500672,
          timezone: 'Europe/Berlin',
          airport_type: 'large_airport',
          scheduled_service: true,
          is_commercial: true,
          commercial_service_tier: 'major',
          is_major_commercial: true,
          air_distance_km: 18.4,
        },
      ]),
    }));
    (globalThis as typeof globalThis & {
      Deno?: { env?: { get: (key: string) => string | undefined } };
    }).Deno = {
      env: {
        get: (key: string) => {
          if (key === 'VITE_SUPABASE_URL') return 'https://supabase.example';
          if (key === 'VITE_SUPABASE_ANON_KEY') return 'anon-key';
          return undefined;
        },
      },
    };

    const response = await handler(new Request('https://travelflow.test/api/runtime/nearby-airports?lat=52.52&lng=13.405'));

    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.example/rest/v1/rpc/find_nearest_commercial_airports',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mocks.loadCommercialAirportReferencesFromStaticAsset).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      origin: { lat: 52.52, lng: 13.405 },
      dataVersion: '2026-03-21-4086',
    }));
  });

  it('parses request coordinates and clamps the limit', () => {
    expect(__runtimeNearbyAirportsInternals.parseNearbyAirportsRequest(
      new Request('https://travelflow.test/api/runtime/nearby-airports?lat=52.52&lng=13.405&limit=99&minimumServiceTier=regional&countryCode=de'),
    )).toEqual({
      lat: 52.52,
      lng: 13.405,
      limit: 10,
      minimumServiceTier: 'regional',
      countryCode: 'DE',
    });
  });

  it('passes the optional country filter through to the shared lookup', async () => {
    const response = await handler(new Request('https://travelflow.test/api/runtime/nearby-airports?lat=52.52&lng=13.405&countryCode=DE'));

    expect(response.status).toBe(200);
    expect(mocks.findNearestCommercialAirports).toHaveBeenCalledWith(expect.objectContaining({
      countryCode: 'DE',
    }));
  });
});
