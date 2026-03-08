import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../../services/simulatedLoginService', () => ({
  isSimulatedLoggedIn: () => false,
}));

vi.mock('../../services/supabaseClient', () => ({
  isSupabaseEnabled: true,
  supabase: {
    rpc: rpcMock,
  },
}));

describe('services/adminService RPC argument guards', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it('always sends p_generation_state for admin_list_trips when no filter is selected', async () => {
    const { adminListTrips } = await import('../../services/adminService');
    await adminListTrips({ generationState: 'all' });

    expect(rpcMock).toHaveBeenCalledWith('admin_list_trips', expect.objectContaining({
      p_generation_state: '',
    }));
  });

  it('always sends p_generation_state for admin_list_user_trips when no filter is selected', async () => {
    const { adminListUserTrips } = await import('../../services/adminService');
    await adminListUserTrips('00000000-0000-0000-0000-000000000001', { generationState: 'all' });

    expect(rpcMock).toHaveBeenCalledWith('admin_list_user_trips', expect.objectContaining({
      p_generation_state: '',
    }));
  });

  it('falls back to legacy admin_list_trips signature when PostgREST cannot choose a candidate', async () => {
    const { adminListTrips } = await import('../../services/adminService');
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Could not choose the best candidate function between overloaded signatures.',
        },
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await adminListTrips({ generationState: 'all' });

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'admin_list_trips', expect.objectContaining({
      p_generation_state: '',
    }));
    const fallbackArgs = rpcMock.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(fallbackArgs.p_generation_state).toBeUndefined();
  });

  it('falls back to legacy admin_list_user_trips signature when PostgREST cannot choose a candidate', async () => {
    const { adminListUserTrips } = await import('../../services/adminService');
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Could not choose the best candidate function between overloaded signatures.',
        },
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await adminListUserTrips('00000000-0000-0000-0000-000000000001', { generationState: 'all' });

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'admin_list_user_trips', expect.objectContaining({
      p_generation_state: '',
    }));
    const fallbackArgs = rpcMock.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(fallbackArgs.p_generation_state).toBeUndefined();
  });

  it('passes search and pagination args to admin_list_billing_subscriptions', async () => {
    const { adminListBillingSubscriptions } = await import('../../services/adminService');

    await adminListBillingSubscriptions({ limit: 50, offset: 10, search: 'explorer@example.com' });

    expect(rpcMock).toHaveBeenCalledWith('admin_list_billing_subscriptions', {
      p_limit: 50,
      p_offset: 10,
      p_search: 'explorer@example.com',
    });
  });

  it('passes search and pagination args to admin_list_billing_webhook_events', async () => {
    const { adminListBillingWebhookEvents } = await import('../../services/adminService');

    await adminListBillingWebhookEvents({ limit: 25, offset: 5, search: 'evt_123' });

    expect(rpcMock).toHaveBeenCalledWith('admin_list_billing_webhook_events', {
      p_limit: 25,
      p_offset: 5,
      p_search: 'evt_123',
    });
  });
});
