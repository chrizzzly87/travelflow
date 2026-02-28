// @vitest-environment jsdom
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const updateMaybeSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));
  return {
    rpc: vi.fn(),
    from: vi.fn(() => ({ update })),
    update,
    updateEq,
    updateSelect,
    updateMaybeSingle,
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
    mocks.updateMaybeSingle.mockResolvedValue({ data: { id: 'trip-2', status: 'archived' }, error: null });
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
      p_metadata: { tab: 'all' },
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
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function public.archive_trip_for_user(text,text,jsonb) does not exist' },
    });
    mocks.updateMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-noop', { source: 'my_trips' });

    expect(archived).toBe(false);
  });

  it('returns false when archive fails', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function public.archive_trip_for_user(text,text,jsonb) does not exist' },
    });
    mocks.updateMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } });

    const { dbArchiveTrip } = await import('../../services/dbService');
    const archived = await dbArchiveTrip('trip-3', { source: 'profile_batch' });

    expect(archived).toBe(false);
  });
});
