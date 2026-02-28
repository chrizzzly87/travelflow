// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tripSnapshotMaybeSingle = vi.fn();
  const tripSnapshotEqOwner = vi.fn(() => ({ maybeSingle: tripSnapshotMaybeSingle }));
  const tripSnapshotEqId = vi.fn(() => ({ eq: tripSnapshotEqOwner }));
  const tripSnapshotSelect = vi.fn(() => ({ eq: tripSnapshotEqId }));

  const eventRecentLimit = vi.fn();
  const eventRecentOrder = vi.fn(() => ({ limit: eventRecentLimit }));
  const eventRecentGte = vi.fn(() => ({ order: eventRecentOrder }));
  const eventRecentEqAction = vi.fn(() => ({ gte: eventRecentGte }));
  const eventRecentEqTrip = vi.fn(() => ({ eq: eventRecentEqAction }));
  const eventRecentSelect = vi.fn(() => ({ eq: eventRecentEqTrip }));
  const eventInsert = vi.fn();

  const from = vi.fn((table: string) => {
    if (table === 'trips') {
      return {
        select: tripSnapshotSelect,
      };
    }
    if (table === 'trip_user_events') {
      return {
        select: eventRecentSelect,
        insert: eventInsert,
      };
    }
    return {
      select: tripSnapshotSelect,
      insert: eventInsert,
    };
  });

  return {
    rpc: vi.fn(),
    from,
    tripSnapshotMaybeSingle,
    eventRecentLimit,
    eventInsert,
    getSession: vi.fn(),
    signInAnonymously: vi.fn(),
    setSession: vi.fn(),
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

describe('services/dbService dbUpsertTrip logging', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('writes lifecycle secondary/domain metadata for trip.updated fallback logs', async () => {
    mocks.tripSnapshotMaybeSingle
      .mockResolvedValueOnce({
        data: {
          title: 'Trip before',
          status: 'active',
          show_on_public_profile: false,
          start_date: '2026-03-01',
          trip_expires_at: null,
          source_kind: 'created',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          title: 'Trip after',
          status: 'expired',
          show_on_public_profile: true,
          start_date: '2026-03-05',
          trip_expires_at: '2026-12-01T00:00:00+00:00',
          source_kind: 'ai_benchmark',
        },
        error: null,
      });
    mocks.rpc.mockResolvedValueOnce({
      data: [{ trip_id: 'trip-1' }],
      error: null,
    });

    const { dbUpsertTrip } = await import('../../services/dbService');
    const tripId = await dbUpsertTrip({
      id: 'trip-1',
      title: 'Trip after',
      startDate: '2026-03-05',
      items: [],
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
      showOnPublicProfile: true,
      status: 'expired',
      tripExpiresAt: '2026-12-01T00:00:00+00:00',
      sourceKind: 'ai_benchmark',
    }, undefined);

    expect(tripId).toBe('trip-1');
    expect(mocks.eventInsert).toHaveBeenCalledWith(expect.objectContaining({
      trip_id: 'trip-1',
      owner_id: 'user-1',
      action: 'trip.updated',
      metadata: expect.objectContaining({
        event_schema_version: 1,
        event_kind: 'trip.updated',
        event_id: expect.any(String),
        correlation_id: expect.any(String),
        causation_id: expect.any(String),
        source_surface: 'ai_benchmark',
        start_date_before: '2026-03-01',
        start_date_after: '2026-03-05',
        show_on_public_profile_before: false,
        show_on_public_profile_after: true,
        secondary_actions: expect.arrayContaining([
          'trip.settings.updated',
          'trip.visibility.updated',
          'trip.trip_dates.updated',
        ]),
        domain_events_v1: expect.objectContaining({
          schema: 'trip_domain_events_v1',
          version: 1,
          events: expect.arrayContaining([
            expect.objectContaining({
              action: 'trip.settings.updated',
              field: 'status',
              before_value: 'active',
              after_value: 'expired',
            }),
            expect.objectContaining({
              action: 'trip.visibility.updated',
              field: 'show_on_public_profile',
              before_value: false,
              after_value: true,
            }),
            expect.objectContaining({
              action: 'trip.trip_dates.updated',
              field: 'start_date',
              before_value: '2026-03-01',
              after_value: '2026-03-05',
            }),
          ]),
        }),
      }),
    }));
  });

  it('skips fallback trip.updated logs when lifecycle fields did not change', async () => {
    mocks.tripSnapshotMaybeSingle
      .mockResolvedValueOnce({
        data: {
          title: 'Same trip',
          status: 'active',
          show_on_public_profile: true,
          start_date: '2026-03-01',
          trip_expires_at: null,
          source_kind: 'created',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          title: 'Same trip',
          status: 'active',
          show_on_public_profile: true,
          start_date: '2026-03-01',
          trip_expires_at: null,
          source_kind: 'created',
        },
        error: null,
      });
    mocks.rpc.mockResolvedValueOnce({
      data: [{ trip_id: 'trip-2' }],
      error: null,
    });

    const { dbUpsertTrip } = await import('../../services/dbService');
    const tripId = await dbUpsertTrip({
      id: 'trip-2',
      title: 'Same trip',
      startDate: '2026-03-01',
      items: [],
      createdAt: 1700000000000,
      updatedAt: 1700000005000,
      showOnPublicProfile: true,
      status: 'active',
      sourceKind: 'created',
    }, undefined);

    expect(tripId).toBe('trip-2');
    expect(mocks.eventInsert).not.toHaveBeenCalled();
  });
});
