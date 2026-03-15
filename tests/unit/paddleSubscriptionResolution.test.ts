import { describe, expect, it } from 'vitest';
import { pickBestFallbackSubscription } from '../../netlify/edge-lib/paddle-subscription-resolution';

describe('paddle subscription resolution', () => {
  it('prefers the newest higher-tier active subscription when duplicates exist', () => {
    const resolved = pickBestFallbackSubscription([
      {
        id: 'sub_mid_old',
        status: 'active',
        updated_at: '2026-03-08T10:00:00.000Z',
        items: [{ price: { id: 'pri_mid' } }],
      },
      {
        id: 'sub_premium_new',
        status: 'active',
        updated_at: '2026-03-10T10:00:00.000Z',
        items: [{ price: { id: 'pri_premium' } }],
      },
    ], {
      tier_mid: 'pri_mid',
      tier_premium: 'pri_premium',
    });

    expect(resolved?.id).toBe('sub_premium_new');
  });
});
