import { describe, expect, it } from 'vitest';
import { __paddleConfigInternals } from '../../netlify/edge-functions/paddle-config';

describe('paddle config edge', () => {
  it('builds public Paddle config with tier availability and environment issues', () => {
    const config = __paddleConfigInternals.buildPaddlePublicConfig((name) => {
      switch (name) {
        case 'PADDLE_ENV':
          return 'sandbox';
        case 'VITE_PADDLE_CHECKOUT_ENABLED':
          return 'true';
        case 'VITE_PADDLE_CLIENT_TOKEN':
          return 'live_client_token';
        case 'PADDLE_API_KEY':
          return 'pdl_live_apikey_123';
        case 'PADDLE_WEBHOOK_SECRET':
          return 'whsec_123';
        case 'SUPABASE_SERVICE_ROLE_KEY':
          return 'service-role-key';
        case 'PADDLE_WEBHOOK_SYNC_MODE':
          return 'full';
        case 'PADDLE_PRICE_ID_TIER_MID':
          return 'pri_mid';
        default:
          return undefined;
      }
    });

    expect(config).toEqual({
      provider: 'paddle',
      environment: 'sandbox',
      checkoutEnabled: true,
      clientTokenConfigured: true,
      webhookSecretConfigured: true,
      supabaseSyncConfigured: true,
      webhookSyncMode: 'full',
      tierAvailability: {
        tier_mid: true,
        tier_premium: false,
      },
      issues: [
        {
          code: 'api_key_environment_mismatch',
          message: 'PADDLE_API_KEY appears to be a live key while PADDLE_ENV=sandbox. Create and use a sandbox API key from Paddle Developer tools -> Authentication -> API keys.',
        },
        {
          code: 'client_token_environment_mismatch',
          message: 'VITE_PADDLE_CLIENT_TOKEN appears to be a live token while PADDLE_ENV=sandbox. Use a sandbox client-side token (test_) and set Paddle.Environment.set("sandbox") before Paddle.Initialize().',
        },
      ],
    });
  });
});
