import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbServiceMocks = vi.hoisted(() => ({
  DB_ENABLED: true,
  ensureExistingDbSession: vi.fn(),
  dbGetAccessToken: vi.fn(),
}));

vi.mock('../../services/dbService', () => dbServiceMocks);

import {
  applyPaddleSubscriptionUpgrade,
  buildBillingCheckoutPath,
  getPaddleSubscriptionManagementUrls,
  lookupPaddleDiscount,
  previewPaddleSubscriptionUpgrade,
  readBillingDiscountCodeFromSearch,
  startPaddleCheckoutSession,
  syncPaddleTransaction,
} from '../../services/billingService';

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
      'No active user session found for billing request.',
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
        claimId: null,
        returnTo: null,
        tripId: null,
        discountCode: null,
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

  it('builds the dedicated checkout route with optional trip and claim metadata', () => {
    expect(buildBillingCheckoutPath({
      tierKey: 'tier_mid',
      source: 'trip_paywall_strip',
      claimId: '123e4567-e89b-12d3-a456-426614174000',
      returnTo: '/trip/trip_123?view=map',
      tripId: 'trip_123',
      discountCode: 'SPRING20',
    })).toBe('/checkout?tier=tier_mid&source=trip_paywall_strip&claim=123e4567-e89b-12d3-a456-426614174000&return_to=%2Ftrip%2Ftrip_123%3Fview%3Dmap&trip_id=trip_123&discount=SPRING20');
  });

  it('reads voucher codes from canonical and legacy URL query keys', () => {
    expect(readBillingDiscountCodeFromSearch('?discount=SPRING20')).toBe('SPRING20');
    expect(readBillingDiscountCodeFromSearch('?voucher=VIP50')).toBe('VIP50');
  });

  it('previews a Paddle subscription upgrade for paid users', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue('123e4567-e89b-12d3-a456-426614174000');
    dbServiceMocks.dbGetAccessToken.mockResolvedValue('token-123');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        mode: 'upgrade',
        currentTierKey: 'tier_mid',
        targetTierKey: 'tier_premium',
        providerSubscriptionId: 'sub_123',
        providerStatus: 'active',
        currentAmount: 900,
        currentCurrency: 'USD',
        recurringAmount: 1900,
        recurringCurrency: 'USD',
        immediateAmount: 1000,
        immediateCurrency: 'USD',
        prorationMessage: 'Upgrade now',
      },
    }), { status: 200 })));

    await expect(previewPaddleSubscriptionUpgrade('tier_premium')).resolves.toMatchObject({
      mode: 'upgrade',
      providerSubscriptionId: 'sub_123',
      recurringAmount: 1900,
      immediateAmount: 1000,
    });
  });

  it('applies a Paddle subscription upgrade and returns local sync state', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue('123e4567-e89b-12d3-a456-426614174000');
    dbServiceMocks.dbGetAccessToken.mockResolvedValue('token-123');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        mode: 'upgrade_applied',
        currentTierKey: 'tier_mid',
        targetTierKey: 'tier_premium',
        providerSubscriptionId: 'sub_123',
        providerStatus: 'active',
        recurringAmount: 1900,
        recurringCurrency: 'USD',
        localSync: {
          status: 'processed',
          duplicate: false,
          reason: null,
        },
      },
    }), { status: 200 })));

    await expect(applyPaddleSubscriptionUpgrade({
      tierKey: 'tier_premium',
      source: 'pricing_page',
      returnTo: '/pricing',
    })).resolves.toMatchObject({
      mode: 'upgrade_applied',
      providerSubscriptionId: 'sub_123',
      localSync: {
        status: 'processed',
        duplicate: false,
        reason: null,
      },
    });
  });

  it('loads Paddle billing management URLs for the current user', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue('123e4567-e89b-12d3-a456-426614174000');
    dbServiceMocks.dbGetAccessToken.mockResolvedValue('token-123');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        provider: 'paddle',
        providerSubscriptionId: 'sub_123',
        cancelUrl: 'https://paddle.test/cancel',
        updatePaymentMethodUrl: 'https://paddle.test/payment-method',
        providerStatus: 'active',
        currentPeriodEnd: '2026-04-01T00:00:00.000Z',
        cancelAt: null,
        canceledAt: null,
        graceEndsAt: null,
      },
    }), { status: 200 })));

    await expect(getPaddleSubscriptionManagementUrls()).resolves.toEqual({
      provider: 'paddle',
      providerSubscriptionId: 'sub_123',
      cancelUrl: 'https://paddle.test/cancel',
      updatePaymentMethodUrl: 'https://paddle.test/payment-method',
      providerStatus: 'active',
      currentPeriodEnd: '2026-04-01T00:00:00.000Z',
      cancelAt: null,
      canceledAt: null,
      graceEndsAt: null,
    });
  });

  it('syncs a Paddle transaction into the local billing store', async () => {
    dbServiceMocks.ensureExistingDbSession.mockResolvedValue('123e4567-e89b-12d3-a456-426614174000');
    dbServiceMocks.dbGetAccessToken.mockResolvedValue('token-123');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        provider: 'paddle',
        transactionId: 'txn_123',
        providerSubscriptionId: 'sub_123',
        providerStatus: 'active',
        localSync: {
          status: 'processed',
          duplicate: false,
          reason: null,
        },
      },
    }), { status: 200 })));

    await expect(syncPaddleTransaction('txn_123')).resolves.toEqual({
      provider: 'paddle',
      transactionId: 'txn_123',
      providerSubscriptionId: 'sub_123',
      providerStatus: 'active',
      localSync: {
        status: 'processed',
        duplicate: false,
        reason: null,
      },
    });
  });

  it('looks up Paddle voucher estimates for a supported tier', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        code: 'SPRING20',
        type: 'percentage',
        amount: 20,
        currencyCode: 'USD',
        description: 'Spring 20% off',
        appliesToAllRecurring: true,
        maximumRecurringIntervals: null,
        applicableToTier: true,
        estimate: {
          originalAmount: 900,
          discountedAmount: 720,
          savingsAmount: 180,
          currencyCode: 'USD',
        },
      },
    }), { status: 200 })));

    await expect(lookupPaddleDiscount('SPRING20', 'tier_mid')).resolves.toEqual({
      code: 'SPRING20',
      type: 'percentage',
      amount: 20,
      currencyCode: 'USD',
      description: 'Spring 20% off',
      appliesToAllRecurring: true,
      maximumRecurringIntervals: null,
      applicableToTier: true,
      estimate: {
        originalAmount: 900,
        discountedAmount: 720,
        savingsAmount: 180,
        currencyCode: 'USD',
      },
    });
  });
});
