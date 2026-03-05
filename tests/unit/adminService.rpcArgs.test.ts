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
});
