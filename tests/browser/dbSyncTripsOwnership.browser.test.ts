// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const order = vi.fn();
  const neq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ neq }));
  return {
    from: vi.fn(() => ({ select })),
    order,
    getSession: vi.fn(),
    signInAnonymously: vi.fn(),
    setSession: vi.fn(),
    getAllTrips: vi.fn(),
    setAllTrips: vi.fn(),
    isSimulatedLoggedIn: vi.fn(),
    setSimulatedLoggedIn: vi.fn(),
    toggleSimulatedLogin: vi.fn(),
  };
});

vi.mock('../../services/supabaseClient', () => ({
  isSupabaseEnabled: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
      setSession: mocks.setSession,
    },
    from: mocks.from,
  },
}));

vi.mock('../../services/storageService', () => ({
  getAllTrips: mocks.getAllTrips,
  setAllTrips: mocks.setAllTrips,
}));

vi.mock('../../services/simulatedLoginService', () => ({
  isSimulatedLoggedIn: mocks.isSimulatedLoggedIn,
  setSimulatedLoggedIn: mocks.setSimulatedLoggedIn,
  toggleSimulatedLogin: mocks.toggleSimulatedLogin,
}));

const DB_ROW = {
  id: 'trip-db-1',
  data: {
    id: 'trip-db-1',
    title: 'DB Trip',
    items: [],
    createdAt: 10,
    updatedAt: 100,
  },
  status: 'active',
  trip_expires_at: null,
  source_kind: null,
  source_template_id: null,
  show_on_public_profile: true,
};

describe('services/dbService syncTripsFromDb', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.order.mockResolvedValue({ data: [DB_ROW], error: null });
    mocks.signInAnonymously.mockResolvedValue({ data: null, error: null });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.getAllTrips.mockReturnValue([
      {
        id: 'trip-local-1',
        title: 'Local Trip',
        items: [],
        createdAt: 20,
        updatedAt: 200,
        status: 'active',
      },
    ]);
  });

  it('replaces local storage with DB trips when simulated login is off', async () => {
    mocks.isSimulatedLoggedIn.mockReturnValue(false);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'real-user-id',
            app_metadata: { provider: 'email', providers: ['email'] },
          },
        },
      },
      error: null,
    });

    const { syncTripsFromDb } = await import('../../services/dbService');
    await syncTripsFromDb();

    expect(mocks.setAllTrips).toHaveBeenCalledTimes(1);
    const [tripsArg] = mocks.setAllTrips.mock.calls[0];
    expect(tripsArg.map((trip: { id: string }) => trip.id)).toEqual(['trip-db-1']);
  });

  it('keeps local-only trips when simulated login is active for anonymous session', async () => {
    mocks.isSimulatedLoggedIn.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'anon-user-id',
            is_anonymous: true,
            app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
          },
        },
      },
      error: null,
    });

    const { syncTripsFromDb } = await import('../../services/dbService');
    await syncTripsFromDb();

    expect(mocks.setAllTrips).toHaveBeenCalledTimes(1);
    const [tripsArg] = mocks.setAllTrips.mock.calls[0];
    expect(tripsArg.map((trip: { id: string }) => trip.id)).toEqual(['trip-local-1', 'trip-db-1']);
  });

  it('does not keep local-only trips when simulated login is active but session is real user', async () => {
    mocks.isSimulatedLoggedIn.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'real-user-id',
            app_metadata: { provider: 'email', providers: ['email'] },
          },
        },
      },
      error: null,
    });

    const { syncTripsFromDb } = await import('../../services/dbService');
    await syncTripsFromDb();

    expect(mocks.setAllTrips).toHaveBeenCalledTimes(1);
    const [tripsArg] = mocks.setAllTrips.mock.calls[0];
    expect(tripsArg.map((trip: { id: string }) => trip.id)).toEqual(['trip-db-1']);
  });

  it('treats upgraded sessions with both email and anonymous providers as real-user sessions', async () => {
    mocks.isSimulatedLoggedIn.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'real-user-id',
            app_metadata: { provider: 'email', providers: ['email', 'anonymous'] },
            identities: [
              { provider: 'anonymous' },
              { provider: 'email' },
            ],
          },
        },
      },
      error: null,
    });

    const { syncTripsFromDb } = await import('../../services/dbService');
    await syncTripsFromDb();

    expect(mocks.setAllTrips).toHaveBeenCalledTimes(1);
    const [tripsArg] = mocks.setAllTrips.mock.calls[0];
    expect(tripsArg.map((trip: { id: string }) => trip.id)).toEqual(['trip-db-1']);
  });

  it('treats sessions with an email as real-user sessions even when provider metadata is anonymous', async () => {
    mocks.isSimulatedLoggedIn.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'real-user-id',
            email: 'real-user@example.com',
            is_anonymous: true,
            app_metadata: { provider: 'anonymous', providers: ['anonymous'], is_anonymous: true },
            identities: [{ provider: 'anonymous' }],
          },
        },
      },
      error: null,
    });

    const { syncTripsFromDb } = await import('../../services/dbService');
    await syncTripsFromDb();

    expect(mocks.setAllTrips).toHaveBeenCalledTimes(1);
    const [tripsArg] = mocks.setAllTrips.mock.calls[0];
    expect(tripsArg.map((trip: { id: string }) => trip.id)).toEqual(['trip-db-1']);
  });
});
