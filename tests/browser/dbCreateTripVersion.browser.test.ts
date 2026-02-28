// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const versionMaybeSingle = vi.fn();
  const versionLimit = vi.fn(() => ({ maybeSingle: versionMaybeSingle }));
  const versionOrder = vi.fn(() => ({ limit: versionLimit }));
  const versionEqTrip = vi.fn(() => ({ order: versionOrder }));
  const versionSelect = vi.fn(() => ({ eq: versionEqTrip }));

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
      if (table === 'trip_versions') {
        return {
          select: versionSelect,
        };
      }
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
    versionSelect,
    versionEqTrip,
    versionOrder,
    versionLimit,
    versionMaybeSingle,
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
    mocks.versionMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('writes fallback trip.updated event for version commits', async () => {
    mocks.versionMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'version-prev',
        label: 'Data: Previous',
        data: {
          id: 'trip-1',
          title: 'Trip One',
          startDate: '2026-02-01',
          items: [],
          createdAt: 90,
          updatedAt: 150,
          sourceKind: 'created',
        },
      },
      error: null,
    });
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
        correlation_id: expect.any(String),
        trip_id: 'trip-1',
        version_id: 'version-1',
        previous_version_id: 'version-prev',
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

  it('includes timeline diff details for transport changes and deleted activities', async () => {
    mocks.versionMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'version-prev',
        label: 'Data: Previous',
        data: {
          id: 'trip-transport',
          title: 'Transport Trip',
          startDate: '2026-02-01',
          items: [
            {
              id: 'travel-1',
              type: 'travel',
              title: 'Segment',
              startDateOffset: 0,
              duration: 1,
              color: '#000',
              transportMode: 'bus',
            },
            {
              id: 'activity-1',
              type: 'activity',
              title: 'Street market',
              startDateOffset: 1,
              duration: 1,
              color: '#111',
            },
          ],
          createdAt: 80,
          updatedAt: 120,
          sourceKind: 'created',
        },
      },
      error: null,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: [{ version_id: 'version-next' }],
      error: null,
    });

    const { dbCreateTripVersion } = await import('../../services/dbService');
    await dbCreateTripVersion({
      id: 'trip-transport',
      title: 'Transport Trip',
      startDate: '2026-02-01',
      items: [
        {
          id: 'travel-1',
          type: 'travel',
          title: 'Segment',
          startDateOffset: 0,
          duration: 1,
          color: '#000',
          transportMode: 'train',
        },
      ],
      createdAt: 80,
      updatedAt: 220,
      sourceKind: 'created',
    }, undefined, 'Data: Changed transport type');

    expect(mocks.eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        correlation_id: expect.any(String),
        timeline_diff_v1: expect.objectContaining({
          schema: 'timeline_diff_v1',
          version: 1,
          counts: expect.objectContaining({
            deleted_items: 1,
            transport_mode_changes: 1,
            visual_changes: 0,
          }),
        }),
      }),
    }));
  });

  it('captures visual-only version commits in typed timeline diff metadata', async () => {
    mocks.versionMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'version-prev-visual',
        label: 'Data: Previous',
        data: {
          id: 'trip-visual',
          title: 'Visual Trip',
          startDate: '2026-02-01',
          items: [],
          createdAt: 80,
          updatedAt: 120,
          sourceKind: 'created',
        },
      },
      error: null,
    });
    mocks.rpc.mockResolvedValueOnce({
      data: [{ version_id: 'version-visual-next' }],
      error: null,
    });

    const { dbCreateTripVersion } = await import('../../services/dbService');
    await dbCreateTripVersion({
      id: 'trip-visual',
      title: 'Visual Trip',
      startDate: '2026-02-01',
      items: [],
      createdAt: 80,
      updatedAt: 220,
      sourceKind: 'created',
    }, undefined, 'Visual: Map view: minimal → clean · Timeline layout: vertical → horizontal');

    expect(mocks.eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        correlation_id: expect.any(String),
        timeline_diff_v1: expect.objectContaining({
          schema: 'timeline_diff_v1',
          version: 1,
          counts: expect.objectContaining({
            visual_changes: 2,
          }),
          visual_changes: expect.arrayContaining([
            expect.objectContaining({
              field: 'map_view',
              before_value: 'minimal',
              after_value: 'clean',
            }),
            expect.objectContaining({
              field: 'timeline_layout',
              before_value: 'vertical',
              after_value: 'horizontal',
            }),
          ]),
        }),
      }),
    }));
  });
});
