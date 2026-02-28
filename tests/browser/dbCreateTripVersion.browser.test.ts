// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const eventRecentLimit = vi.fn();
  const eventRecentOrder = vi.fn(() => ({ limit: eventRecentLimit }));
  const eventRecentGte = vi.fn(() => ({ order: eventRecentOrder }));
  const eventRecentEqAction = vi.fn(() => ({ gte: eventRecentGte }));
  const eventRecentEqTrip = vi.fn(() => ({ eq: eventRecentEqAction }));
  const eventRecentSelect = vi.fn(() => ({ eq: eventRecentEqTrip }));
  const eventInsert = vi.fn();

  return {
    rpc: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === 'trip_user_events') {
        return {
          select: eventRecentSelect,
          insert: eventInsert,
        };
      }
      return {
        select: eventRecentSelect,
        insert: eventInsert,
      };
    }),
    eventRecentSelect,
    eventRecentEqTrip,
    eventRecentEqAction,
    eventRecentGte,
    eventRecentOrder,
    eventRecentLimit,
    eventInsert,
    getSession: vi.fn(),
    signInAnonymously: vi.fn(),
    setSession: vi.fn(),
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
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

vi.mock('../../services/simulatedLoginService', () => ({
  isSimulatedLoggedIn: mocks.isSimulatedLoggedIn,
  setSimulatedLoggedIn: mocks.setSimulatedLoggedIn,
  toggleSimulatedLogin: mocks.toggleSimulatedLogin,
}));

describe('services/dbService dbCreateTripVersion', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isSimulatedLoggedIn.mockReturnValue(false);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            app_metadata: { provider: 'email', providers: ['email'] },
          },
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: 9999999999,
        },
      },
      error: null,
    });
    mocks.eventRecentLimit.mockResolvedValue({ data: [], error: null });
    mocks.eventInsert.mockResolvedValue({ data: null, error: null });
  });

  it('writes fallback trip.updated event for version commits', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ version_id: 'version-1' }],
      error: null,
    });

    const { dbCreateTripVersion } = await import('../../services/dbService');
    const result = await dbCreateTripVersion({
      id: 'trip-1',
      title: 'Trip One',
      startDate: '2026-02-01',
      items: [],
      createdAt: 100,
      updatedAt: 200,
      sourceKind: 'created',
    }, undefined, 'Data: Updated trip');

    expect(result).toBe('version-1');
    expect(mocks.eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      trip_id: 'trip-1',
      owner_id: 'user-1',
      action: 'trip.updated',
    }));
    expect(mocks.eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        trip_id: 'trip-1',
        version_id: 'version-1',
        version_label: 'Data: Updated trip',
      }),
    }));
  });

  it('does not write version fallback log for creation labels', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ version_id: 'version-created' }],
      error: null,
    });

    const { dbCreateTripVersion } = await import('../../services/dbService');
    const result = await dbCreateTripVersion({
      id: 'trip-created',
      title: 'Created Trip',
      startDate: '2026-02-02',
      items: [],
      createdAt: 100,
      updatedAt: 210,
      sourceKind: 'created',
    }, undefined, 'Data: Created trip');

    expect(result).toBe('version-created');
    expect(mocks.eventInsert).not.toHaveBeenCalled();
  });
});
