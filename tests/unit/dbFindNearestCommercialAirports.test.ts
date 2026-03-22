// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
  isSupabaseEnabled: true,
  supabase: {
    rpc: mockState.rpc,
  },
}));

vi.mock('../../services/clientErrorLogger', () => ({
  appendClientErrorLog: vi.fn(),
}));

vi.mock('../../services/supabaseHealthMonitor', () => ({
  markConnectivityFailure: vi.fn(),
  markConnectivitySuccess: vi.fn(),
}));

vi.mock('../../services/simulatedLoginService', () => ({
  isSimulatedLoggedIn: () => false,
  setSimulatedLoggedIn: vi.fn(),
  toggleSimulatedLogin: vi.fn(),
}));

import { dbFindNearestCommercialAirports } from '../../services/dbService';

describe('services/dbService dbFindNearestCommercialAirports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps RPC rows into ranked nearby-airport results', async () => {
    mockState.rpc.mockResolvedValue({
      data: [
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
      ],
      error: null,
    });

    const result = await dbFindNearestCommercialAirports({
      lat: 52.52,
      lng: 13.405,
      limit: 99,
      minimumServiceTier: 'regional',
    });

    expect(mockState.rpc).toHaveBeenCalledWith('find_nearest_commercial_airports', {
      p_lat: 52.52,
      p_lng: 13.405,
      p_limit: 10,
      p_min_service_tier: 'regional',
    });
    expect(result).toEqual([
      {
        airport: expect.objectContaining({
          ident: 'EDDB',
          iataCode: 'BER',
          countryCode: 'DE',
          commercialServiceTier: 'major',
          isMajorCommercial: true,
        }),
        airDistanceKm: 18.4,
        rank: 1,
      },
    ]);
  });

  it('short-circuits invalid coordinates without calling the RPC', async () => {
    await expect(dbFindNearestCommercialAirports({
      lat: Number.NaN,
      lng: 13.405,
    })).resolves.toEqual([]);

    expect(mockState.rpc).not.toHaveBeenCalled();
  });
});
