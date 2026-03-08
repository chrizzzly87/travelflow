import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/simulatedLoginService', () => ({
  isSimulatedLoggedIn: () => false,
}));

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('../../services/dbService', () => ({
  ensureExistingDbSession: vi.fn().mockResolvedValue(undefined),
  dbGetAccessToken: vi.fn().mockResolvedValue('access-token-123'),
}));

describe('services/adminService billing reconcile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the Paddle billing reconcile internal API and returns the summary payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        data: {
          summary: {
            fetched: 5,
            eligible: 4,
            processed: 3,
            ignored: 1,
            duplicates: 0,
            failed: 0,
            resolvedUsers: 3,
            unresolved: 1,
          },
          results: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { adminReconcilePaddleSubscriptions } = await import('../../services/adminService');
    const result = await adminReconcilePaddleSubscriptions(120);

    expect(fetchMock).toHaveBeenCalledWith('/api/internal/admin/billing/paddle/reconcile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token-123',
      },
      body: JSON.stringify({ maxSubscriptions: 120 }),
    });
    expect(result.summary.processed).toBe(3);
    expect(result.summary.unresolved).toBe(1);
  });
});
