// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tripSnapshotMaybeSingle = vi.fn();
  const tripSnapshotEqOwner = vi.fn(() => ({ maybeSingle: tripSnapshotMaybeSingle }));
  const tripSnapshotEqId = vi.fn(() => ({ eq: tripSnapshotEqOwner }));
  const tripSnapshotSelect = vi.fn(() => ({ eq: tripSnapshotEqId }));

  const updateMaybeSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const eventRecentLimit = vi.fn();
  const eventRecentOrder = vi.fn(() => ({ limit: eventRecentLimit }));
  const eventRecentGte = vi.fn(() => ({ order: eventRecentOrder }));
  const eventRecentEqAction = vi.fn(() => ({ gte: eventRecentGte }));
  const eventRecentEqTrip = vi.fn(() => ({ eq: eventRecentEqAction }));
  const eventRecentSelect = vi.fn(() => ({ eq: eventRecentEqTrip }));
  const eventInsert = vi.fn();

  const from = vi.fn((table: string) => {
    if (table === 'trip_user_events') {
      return {
        select: eventRecentSelect,
        insert: eventInsert,
      };
    }
    if (table === 'trips') {
      return {
        select: tripSnapshotSelect,
        update,
      };
    }
    return {
      select: tripSnapshotSelect,
      update,
      insert: eventInsert,
    };
  });

  return {
    rpc: vi.fn(),
    from,
    tripSnapshotMaybeSingle,
    tripSnapshotEqOwner,
    tripSnapshotEqId,
    tripSnapshotSelect,
    update,
    updateEq,
    updateSelect,
    updateMaybeSingle,
    eventRecentLimit,
    eventRecentOrder,
    eventRecentGte,
    eventRecentEqAction,
    eventRecentEqTrip,
    eventRecentSelect,
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

describe('services/dbService dbArchiveTrip', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
          access_token: 'token',
          refresh_token: 'refresh',
          expires_at: 9999999999,
        },
      },
      error: null,
    });
    mocks.signInAnonymously.mockResolvedValue({ data: null, error: null });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.tripSnapshotMaybeSingle.mockResolvedValue({
      data: {
        title: 'Trip title',
        status: 'active',
        show_on_public_profile: true,
        trip_expires_at: null,
        source_kind: 'trip.editor',
      },
      error: null,
    });
    mocks.updateMaybeSingle.mockResolvedValue({ data: { id: 'trip-2', status: 'archived' }, error: null });
    mocks.eventRecentLimit.mockResolvedValue({ data: [], error: null });
    mocks.eventInsert.mockResolvedValue({ data: null, error: null });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('archives trip through archive_trip_for_user RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ trip_id: 'trip-1' }], error: null });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-1', {
      source: 'profile_single',
      metadata: { tab: 'all' },
    });

    expect(archived).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('archive_trip_for_user', {
      p_trip_id: 'trip-1',
      p_source: 'profile_single',
      p_metadata: expect.objectContaining({
        tab: 'all',
        correlation_id: expect.any(String),
      }),
    });
  });

  it('falls back to status update when RPC is missing', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function public.archive_trip_for_user(text,text,jsonb) does not exist' },
    });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-2', { source: 'my_trips' });

    expect(archived).toBe(true);
    expect(mocks.from).toHaveBeenCalledWith('trips');
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'trip-2');
    expect(mocks.updateSelect).toHaveBeenCalledWith('id, status');
    expect(mocks.updateMaybeSingle).toHaveBeenCalled();
  });

  it('returns false when fallback update affects no row', async () => {
    const correlationId = 'corr-archive-noop-1';
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function public.archive_trip_for_user(text,text,jsonb) does not exist' },
    });
    mocks.rpc.mockResolvedValueOnce({ data: 'event-1', error: null });
    mocks.updateMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-noop', {
      source: 'my_trips',
      metadata: { correlation_id: correlationId },
    });

    expect(archived).toBe(false);
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'archive_trip_for_user', {
      p_trip_id: 'trip-noop',
      p_source: 'my_trips',
      p_metadata: expect.objectContaining({
        correlation_id: correlationId,
      }),
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'log_user_action_failure', {
      p_action: 'trip.archive_failed',
      p_target_type: 'trip',
      p_target_id: 'trip-noop',
      p_source: 'my_trips',
      p_error_code: null,
      p_error_message: 'Archive did not update any row',
      p_metadata: expect.objectContaining({
        trip_id: 'trip-noop',
        source: 'my_trips',
        archive_metadata: { correlation_id: correlationId },
        correlation_id: correlationId,
      }),
    });
  });

  it('returns false when archive fails', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function public.archive_trip_for_user(text,text,jsonb) does not exist' },
    });
    mocks.rpc.mockResolvedValueOnce({ data: 'event-2', error: null });
    mocks.updateMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-3', { source: 'profile_batch' });

    expect(archived).toBe(false);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'log_user_action_failure', {
      p_action: 'trip.archive_failed',
      p_target_type: 'trip',
      p_target_id: 'trip-3',
      p_source: 'profile_batch',
      p_error_code: null,
      p_error_message: 'update failed',
      p_metadata: expect.objectContaining({
        trip_id: 'trip-3',
        source: 'profile_batch',
        archive_metadata: {},
        correlation_id: expect.any(String),
      }),
    });
  });

  it('does not write duplicate failure events when archive_trip_for_user already logged ownership failure', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'Trip not found or not owned by current user',
      },
    });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-ownership-fail', { source: 'profile_single' });

    expect(archived).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('archive_trip_for_user', {
      p_trip_id: 'trip-ownership-fail',
      p_source: 'profile_single',
      p_metadata: expect.objectContaining({
        correlation_id: expect.any(String),
      }),
    });
  });
});
