// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  setSession: vi.fn(),
  getAllTrips: vi.fn(),
  isSimulatedLoggedIn: vi.fn(),
  setSimulatedLoggedIn: vi.fn(),
  toggleSimulatedLogin: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
  isSupabaseEnabled: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
      setSession: mocks.setSession,
    },
    rpc: mocks.rpc,
    from: vi.fn(),
  },
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
  setAllTrips: vi.fn(),
}));

vi.mock('../../services/simulatedLoginService', () => ({
  isSimulatedLoggedIn: mocks.isSimulatedLoggedIn,
  setSimulatedLoggedIn: mocks.setSimulatedLoggedIn,
  toggleSimulatedLogin: mocks.toggleSimulatedLogin,
}));

describe('services/dbService dbCanCreateTrip', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isSimulatedLoggedIn.mockReturnValue(false);
    mocks.getAllTrips.mockReturnValue([
      {
        id: 'trip-1',
        title: 'Trip 1',
        items: [],
        startDate: '2026-02-01',
        createdAt: 1,
        updatedAt: 1,
        status: 'active',
      },
    ]);
  });

  it('uses fallback limits without creating an anonymous session when no DB session exists', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Not authenticated' },
    });

    const { dbCanCreateTrip } = await import('../../services/dbService');
    const result = await dbCanCreateTrip();

    expect(result).toEqual({
      allowCreate: true,
      activeTripCount: 1,
      maxTripCount: 5,
    });
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });
});
