import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  authGetUser: vi.fn(),
  authSignOut: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../services/supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supabaseClient')>();
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: supabaseMocks.authGetSession,
        getUser: supabaseMocks.authGetUser,
        signOut: supabaseMocks.authSignOut,
      },
      from: supabaseMocks.from,
      rpc: supabaseMocks.rpc,
    },
  };
});

import { getCurrentAccessContext } from '../../services/authService';

describe('services/authService getCurrentAccessContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.authSignOut.mockResolvedValue({ error: null });
    supabaseMocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: 'user-1' }, error: null }),
        }),
      }),
    });
  });

  it('short-circuits for anonymous sessions without calling access RPC', async () => {
    const anonymousUser = {
      id: 'anon-1',
      email: null,
      phone: null,
      app_metadata: {
        provider: 'anonymous',
        providers: ['anonymous'],
        is_anonymous: true,
      },
      identities: [{ provider: 'anonymous' }],
      user_metadata: {},
    };

    supabaseMocks.authGetSession.mockResolvedValue({
      data: { session: { user: anonymousUser } },
      error: null,
    });
    supabaseMocks.authGetUser.mockResolvedValue({
      data: { user: anonymousUser },
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(access.userId).toBe('anon-1');
    expect(access.isAnonymous).toBe(true);
    expect(access.role).toBe('user');
    expect(access.tierKey).toBe('tier_free');
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it('resolves authenticated sessions through access RPC', async () => {
    const authenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      phone: null,
      app_metadata: {
        provider: 'email',
        providers: ['email'],
      },
      identities: [{ provider: 'email' }],
      user_metadata: {},
    };

    supabaseMocks.authGetSession.mockResolvedValue({
      data: { session: { user: authenticatedUser } },
      error: null,
    });
    supabaseMocks.authGetUser.mockResolvedValue({
      data: { user: authenticatedUser },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: [{
        user_id: 'user-1',
        email: 'user@example.com',
        is_anonymous: false,
        system_role: 'user',
        tier_key: 'tier_mid',
        entitlements: {},
        onboarding_completed: true,
        account_status: 'active',
      }],
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_current_user_access');
    expect(access.userId).toBe('user-1');
    expect(access.isAnonymous).toBe(false);
    expect(access.tierKey).toBe('tier_mid');
  });

  it('treats sessions with an email as authenticated even when anonymous metadata is still present', async () => {
    const upgradedUser = {
      id: 'user-1',
      email: 'user@example.com',
      phone: null,
      is_anonymous: true,
      app_metadata: {
        provider: 'anonymous',
        providers: ['anonymous'],
        is_anonymous: true,
      },
      identities: [{ provider: 'anonymous' }],
      user_metadata: {},
    };

    supabaseMocks.authGetSession.mockResolvedValue({
      data: { session: { user: upgradedUser } },
      error: null,
    });
    supabaseMocks.authGetUser.mockResolvedValue({
      data: { user: upgradedUser },
      error: null,
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: [{
        user_id: 'user-1',
        email: 'user@example.com',
        is_anonymous: false,
        system_role: 'user',
        tier_key: 'tier_free',
        entitlements: {},
        onboarding_completed: true,
        account_status: 'active',
      }],
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_current_user_access');
    expect(access.userId).toBe('user-1');
    expect(access.isAnonymous).toBe(false);
  });
});
