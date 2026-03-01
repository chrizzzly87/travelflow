// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  authSignInAnonymously: vi.fn(),
  authSetSession: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
  isSupabaseEnabled: true,
  supabase: {
    auth: {
      getSession: mockState.authGetSession,
      signInAnonymously: mockState.authSignInAnonymously,
      setSession: mockState.authSetSession,
    },
    rpc: mockState.rpc,
    from: mockState.from,
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

import { dbUpsertTrip } from '../../services/dbService';
import { makeTrip } from '../helpers/tripFixtures';

describe('services/dbService dbUpsertTrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockState.authGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-1' },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });

    mockState.authSignInAnonymously.mockResolvedValue({ data: null, error: null });
    mockState.authSetSession.mockResolvedValue(undefined);

    mockState.maybeSingle.mockResolvedValue({
      data: { id: 'trip-fallback' },
      error: null,
    });
    const eqOwner = vi.fn().mockReturnValue({
      maybeSingle: mockState.maybeSingle,
    });
    const eqTrip = vi.fn().mockReturnValue({
      eq: eqOwner,
    });
    mockState.select.mockReturnValue({
      eq: eqTrip,
    });
    mockState.upsert.mockReturnValue({
      select: mockState.select,
    });
    mockState.from.mockReturnValue({
      upsert: mockState.upsert,
      select: mockState.select,
    });
  });

  it('falls back through legacy RPC signatures when overload resolution returns PGRST203', async () => {
    const overloadError = {
      code: 'PGRST203',
      details: null,
      hint: 'Try renaming the parameters or the function itself in the database so function overloading can be resolved',
      message: 'Could not choose the best candidate function between: public.upsert_trip(...)',
    };

    mockState.rpc
      .mockResolvedValueOnce({ data: null, error: overloadError })
      .mockResolvedValueOnce({ data: null, error: overloadError })
      .mockResolvedValueOnce({ data: { id: 'trip-fallback' }, error: null });

    const trip = makeTrip({ id: 'trip-fallback', title: 'Fallback Trip' });
    const result = await dbUpsertTrip(trip, null);

    expect(result).toBe('trip-fallback');
    expect(mockState.rpc).toHaveBeenCalledTimes(3);
    expect(mockState.from).toHaveBeenCalledWith('trips');
    expect(mockState.upsert).not.toHaveBeenCalled();
  });
});
