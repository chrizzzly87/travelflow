import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbServiceMocks = vi.hoisted(() => ({
  DB_ENABLED: true,
  ensureExistingDbSession: vi.fn(),
  dbGetAccessToken: vi.fn(),
}));

vi.mock('../../services/dbService', () => dbServiceMocks);

import { startPaddleCheckoutSession } from '../../services/billingService';

describe('billingService startPaddleCheckoutSession', () => {
  beforeEach(() => {
    dbServiceMocks.DB_ENABLED = true;
    dbServiceMocks.ensureExistingDbSession.mockReset();
    dbServiceMocks.dbGetAccessToken.mockReset();
    vi.restoreAllMocks();
  });

  it('fails when there is no authenticated DB session', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue(null);

    await expect(startPaddleCheckoutSession({ tierKey: 'tier_mid' })).rejects.toThrow(
      'No active user session found for checkout.',
    );
  });

  it('creates a checkout session when API returns a complete payload', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue('123e4567-e89b-12d3-a456-426614174000');
    dbServiceMocks.dbGetAccessToken.mockResolvedValue('token-123');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        provider: 'paddle',
        environment: 'sandbox',
        transactionId: 'txn_123',
        checkoutUrl: 'https://sandbox-checkout.paddle.com/transaction/txn_123',
        tierKey: 'tier_mid',
      },
    }), { status: 200 })));

    const session = await startPaddleCheckoutSession({ tierKey: 'tier_mid', source: 'pricing_page' });

    expect(session).toEqual({
      provider: 'paddle',
      environment: 'sandbox',
      transactionId: 'txn_123',
      checkoutUrl: 'https://sandbox-checkout.paddle.com/transaction/txn_123',
      tierKey: 'tier_mid',
    });

    expect(fetch).toHaveBeenCalledWith('/api/billing/paddle/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
      },
      body: JSON.stringify({
        tierKey: 'tier_mid',
        source: 'pricing_page',
      }),
    });
  });

  it('throws when checkout endpoint returns an error payload', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue('123e4567-e89b-12d3-a456-426614174000');
    dbServiceMocks.dbGetAccessToken.mockResolvedValue('token-123');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: 'No Paddle price ID configured for tier_mid.',
    }), { status: 400 })));

    await expect(startPaddleCheckoutSession({ tierKey: 'tier_mid' })).rejects.toThrow(
      'No Paddle price ID configured for tier_mid.',
    );
  });
});
