import { describe, expect, it } from 'vitest';
import {
  collectPaddleEnvironmentIssues,
  computePaddleSignature,
  detectPaddleApiKeyEnvironment,
  detectPaddleClientTokenEnvironment,
  extractPaddleUserIdFromCustomData,
  extractSubscriptionSnapshot,
  extractTransactionSnapshot,
  normalizePaddleEnvironment,
  parsePaddleSignatureHeader,
  readPaddlePriceMapFromEnv,
  resolvePriceIdForTier,
  resolveTierFromPriceId,
  shouldGrantPaidTier,
  verifyPaddleSignature,
} from '../../netlify/edge-lib/paddle-billing';

describe('paddle billing internals', () => {
  it('parses signature header with timestamp + h1 signatures', () => {
    const parsed = parsePaddleSignatureHeader('ts=1700000000;h1=abc123;h1=def456');
    expect(parsed).toEqual({
      timestamp: 1700000000,
      signatures: ['abc123', 'def456'],
    });
  });

  it('verifies Paddle webhook signatures using timestamp and raw body', async () => {
    const secret = 'webhook_secret_123';
    const timestamp = 1700001000;
    const rawBody = JSON.stringify({ event_id: 'evt_1' });
    const signature = await computePaddleSignature(secret, timestamp, rawBody);

    const valid = await verifyPaddleSignature({
      secret,
      rawBody,
      headerValue: `ts=${timestamp};h1=${signature}`,
      nowMs: timestamp * 1000,
    });
    expect(valid).toEqual({ ok: true });

    const invalid = await verifyPaddleSignature({
      secret,
      rawBody,
      headerValue: `ts=${timestamp};h1=deadbeef`,
      nowMs: timestamp * 1000,
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.reason).toBe('invalid_signature');

    const stale = await verifyPaddleSignature({
      secret,
      rawBody,
      headerValue: `ts=${timestamp};h1=${signature}`,
      nowMs: (timestamp * 1000) + (10 * 60 * 1000),
      maxAgeSeconds: 300,
    });
    expect(stale.ok).toBe(false);
    expect(stale.reason).toBe('timestamp_out_of_range');
  });

  it('maps internal tiers to Paddle price IDs and back', () => {
    const priceMap = readPaddlePriceMapFromEnv((name) => {
      if (name === 'PADDLE_PRICE_ID_TIER_MID') return 'pri_mid';
      if (name === 'PADDLE_PRICE_ID_TIER_PREMIUM') return 'pri_premium';
      return undefined;
    });

    expect(resolvePriceIdForTier('tier_mid', priceMap)).toBe('pri_mid');
    expect(resolvePriceIdForTier('tier_premium', priceMap)).toBe('pri_premium');
    expect(resolvePriceIdForTier('tier_free', priceMap)).toBeNull();

    expect(resolveTierFromPriceId('pri_mid', priceMap)).toBe('tier_mid');
    expect(resolveTierFromPriceId('pri_premium', priceMap)).toBe('tier_premium');
    expect(resolveTierFromPriceId('pri_unknown', priceMap)).toBeNull();
  });

  it('normalizes Paddle environments and detects credential mismatches', () => {
    expect(normalizePaddleEnvironment('sandbox')).toBe('sandbox');
    expect(normalizePaddleEnvironment('live')).toBe('live');
    expect(normalizePaddleEnvironment('unexpected')).toBe('live');

    expect(detectPaddleApiKeyEnvironment('pdl_sdbx_apikey_123')).toBe('sandbox');
    expect(detectPaddleApiKeyEnvironment('pdl_live_apikey_123')).toBe('live');
    expect(detectPaddleClientTokenEnvironment('test_123')).toBe('sandbox');
    expect(detectPaddleClientTokenEnvironment('live_123')).toBe('live');

    expect(collectPaddleEnvironmentIssues({
      declaredEnvironment: 'sandbox',
      apiKey: 'pdl_live_apikey_123',
      clientToken: 'live_123',
    })).toEqual([
      {
        code: 'api_key_environment_mismatch',
        message: 'PADDLE_API_KEY appears to be a live key while PADDLE_ENV=sandbox. Create and use a sandbox API key from Paddle Developer tools -> Authentication -> API keys.',
      },
      {
        code: 'client_token_environment_mismatch',
        message: 'VITE_PADDLE_CLIENT_TOKEN appears to be a live token while PADDLE_ENV=sandbox. Use a sandbox client-side token (test_) and set Paddle.Environment.set("sandbox") before Paddle.Initialize().',
      },
    ]);
  });

  it('extracts Paddle user id from custom_data only when UUID is valid', () => {
    const valid = extractPaddleUserIdFromCustomData({
      tf_user_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(valid).toBe('123e4567-e89b-12d3-a456-426614174000');

    expect(extractPaddleUserIdFromCustomData({ tf_user_id: 'not-a-uuid' })).toBeNull();
    expect(extractPaddleUserIdFromCustomData(null)).toBeNull();
  });

  it('extracts subscription snapshots and computes grace window for cancellation events', () => {
    const snapshot = extractSubscriptionSnapshot(
      'subscription.canceled',
      {
        id: 'sub_123',
        customer_id: 'ctm_123',
        status: 'canceled',
        items: [
          {
            price: {
              id: 'pri_mid',
              product_id: 'pro_mid',
            },
          },
        ],
        current_billing_period: {
          starts_at: '2026-03-01T10:00:00Z',
          ends_at: '2026-04-01T10:00:00Z',
        },
        scheduled_change: {
          action: 'cancel',
          effective_at: '2026-04-01T10:00:00Z',
        },
        canceled_at: '2026-03-25T09:00:00Z',
        custom_data: {
          tf_user_id: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
      '2026-03-25T09:00:00Z',
    );

    expect(snapshot.providerSubscriptionId).toBe('sub_123');
    expect(snapshot.providerCustomerId).toBe('ctm_123');
    expect(snapshot.providerStatus).toBe('canceled');
    expect(snapshot.providerPriceId).toBe('pri_mid');
    expect(snapshot.providerProductId).toBe('pro_mid');
    expect(snapshot.currentPeriodStart).toBe('2026-03-01T10:00:00.000Z');
    expect(snapshot.currentPeriodEnd).toBe('2026-04-01T10:00:00.000Z');
    expect(snapshot.cancelAt).toBe('2026-04-01T10:00:00.000Z');
    expect(snapshot.canceledAt).toBe('2026-03-25T09:00:00.000Z');
    expect(snapshot.graceEndsAt).toBe('2026-04-01T09:00:00.000Z');

    expect(shouldGrantPaidTier('active', null, Date.parse('2026-03-26T00:00:00Z'))).toBe(true);
    expect(shouldGrantPaidTier('canceled', snapshot.graceEndsAt, Date.parse('2026-03-30T00:00:00Z'))).toBe(true);
    expect(shouldGrantPaidTier('canceled', snapshot.graceEndsAt, Date.parse('2026-04-02T00:00:00Z'))).toBe(false);
  });

  it('extracts currency and amount from transaction totals payload', () => {
    const snapshot = extractTransactionSnapshot({
      customer_id: 'ctm_123',
      subscription_id: 'sub_123',
      details: {
        totals: {
          total: '1299',
          currency_code: 'EUR',
        },
      },
      custom_data: {
        tf_user_id: '123e4567-e89b-12d3-a456-426614174000',
      },
    });

    expect(snapshot.providerCustomerId).toBe('ctm_123');
    expect(snapshot.providerSubscriptionId).toBe('sub_123');
    expect(snapshot.currency).toBe('EUR');
    expect(snapshot.amount).toBe(1299);
  });
});
