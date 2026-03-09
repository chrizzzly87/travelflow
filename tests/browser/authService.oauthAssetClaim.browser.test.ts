// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  authSignInWithOAuth: vi.fn(),
  rpc: vi.fn(),
  dbCreateAnonymousAssetClaim: vi.fn(),
  trackEvent: vi.fn(),
  appendAuthTraceEntry: vi.fn(),
}));

vi.mock('../../services/supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supabaseClient')>();
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: mocks.authGetSession,
        signInWithOAuth: mocks.authSignInWithOAuth,
      },
      rpc: mocks.rpc,
    },
  };
});

vi.mock('../../services/dbApi', () => ({
  dbCreateAnonymousAssetClaim: mocks.dbCreateAnonymousAssetClaim,
}));

vi.mock('../../services/analyticsService', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('../../services/authTraceService', () => ({
  appendAuthTraceEntry: mocks.appendAuthTraceEntry,
}));

import { signInWithOAuth } from '../../services/authService';

describe('services/authService signInWithOAuth anonymous asset claim handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.authSignInWithOAuth.mockResolvedValue({ data: { provider: 'google' }, error: null });
  });

  it('appends an asset claim id to redirect URL for anonymous sessions', async () => {
    mocks.authGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'anon-1',
            email: null,
            phone: null,
            app_metadata: {
              provider: 'anonymous',
              providers: ['anonymous'],
              is_anonymous: true,
            },
            identities: [{ provider: 'anonymous' }],
          },
        },
      },
      error: null,
    });
    mocks.dbCreateAnonymousAssetClaim.mockResolvedValue({
      claimId: '6ee54f0d-7ca6-481e-8f27-5d18896993d8',
      status: 'pending',
      expiresAtIso: '2026-02-28T12:00:00.000Z',
    });

    await signInWithOAuth('google', { redirectTo: 'https://travelflow.app/login?next=%2Fcreate-trip' });

    expect(mocks.dbCreateAnonymousAssetClaim).toHaveBeenCalledWith(60);
    const redirectTo = mocks.authSignInWithOAuth.mock.calls[0][0].options.redirectTo as string;
    const redirectUrl = new URL(redirectTo);
    expect(redirectUrl.searchParams.get('next')).toBe('/create-trip');
    expect(redirectUrl.searchParams.get('asset_claim')).toBe('6ee54f0d-7ca6-481e-8f27-5d18896993d8');
  });

  it('keeps redirect URL unchanged for non-anonymous sessions', async () => {
    mocks.authGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'user@example.com',
            phone: null,
            app_metadata: {
              provider: 'email',
              providers: ['email'],
            },
            identities: [{ provider: 'email' }],
          },
        },
      },
      error: null,
    });

    await signInWithOAuth('google', { redirectTo: 'https://travelflow.app/login?next=%2Fcreate-trip' });

    expect(mocks.dbCreateAnonymousAssetClaim).not.toHaveBeenCalled();
    expect(mocks.authSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://travelflow.app/login?next=%2Fcreate-trip' },
    });
  });
});
