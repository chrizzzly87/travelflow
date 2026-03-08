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
      body: JSON.stringify({
        maxSubscriptions: 120,
        subscriptionId: null,
      }),
    });
    expect(result.summary.processed).toBe(3);
    expect(result.summary.unresolved).toBe(1);
  });

  it('forwards an optional targeted Paddle subscription id to the internal reconcile API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        data: {
          summary: {
            fetched: 1,
            eligible: 1,
            processed: 1,
            ignored: 0,
            duplicates: 0,
            failed: 0,
            resolvedUsers: 1,
            unresolved: 0,
          },
          results: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { adminReconcilePaddleSubscriptions } = await import('../../services/adminService');
    await adminReconcilePaddleSubscriptions({
      maxSubscriptions: 1,
      subscriptionId: 'sub_01kk6fcs5t4f75tddavgjx1rtz',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/internal/admin/billing/paddle/reconcile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token-123',
      },
      body: JSON.stringify({
        maxSubscriptions: 1,
        subscriptionId: 'sub_01kk6fcs5t4f75tddavgjx1rtz',
      }),
    });
  });
});
