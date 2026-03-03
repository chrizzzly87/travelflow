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

import { acceptCurrentTerms, getCurrentAccessContext } from '../../services/authService';

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
    expect(access.termsCurrentVersion).toBeNull();
    expect(access.termsRequiresReaccept).toBe(true);
    expect(access.termsAcceptedVersion).toBeNull();
    expect(access.termsAcceptedAt).toBeNull();
    expect(access.termsAcceptanceRequired).toBe(false);
    expect(access.termsNoticeRequired).toBe(false);
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
        terms_current_version: '2026-03-03',
        terms_requires_reaccept: true,
        terms_accepted_version: '2026-03-03',
        terms_accepted_at: '2026-03-03T10:20:30Z',
        terms_acceptance_required: false,
        terms_notice_required: false,
      }],
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_current_user_access');
    expect(access.userId).toBe('user-1');
    expect(access.isAnonymous).toBe(false);
    expect(access.tierKey).toBe('tier_mid');
    expect(access.termsCurrentVersion).toBe('2026-03-03');
    expect(access.termsRequiresReaccept).toBe(true);
    expect(access.termsAcceptedVersion).toBe('2026-03-03');
    expect(access.termsAcceptedAt).toBe('2026-03-03T10:20:30Z');
    expect(access.termsAcceptanceRequired).toBe(false);
    expect(access.termsNoticeRequired).toBe(false);
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
        terms_current_version: '2026-03-03',
        terms_requires_reaccept: true,
        terms_accepted_version: null,
        terms_accepted_at: null,
        terms_acceptance_required: true,
        terms_notice_required: false,
      }],
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_current_user_access');
    expect(access.userId).toBe('user-1');
    expect(access.isAnonymous).toBe(false);
    expect(access.termsCurrentVersion).toBe('2026-03-03');
    expect(access.termsRequiresReaccept).toBe(true);
    expect(access.termsAcceptedVersion).toBeNull();
    expect(access.termsAcceptedAt).toBeNull();
    expect(access.termsAcceptanceRequired).toBe(true);
    expect(access.termsNoticeRequired).toBe(false);
  });

  it('marks users for re-acceptance when current terms version differs from accepted version', async () => {
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
        terms_current_version: '2026-04-01',
        terms_requires_reaccept: true,
        terms_accepted_version: '2026-03-03',
        terms_accepted_at: '2026-03-03T10:20:30Z',
        terms_acceptance_required: true,
        terms_notice_required: false,
      }],
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(access.termsCurrentVersion).toBe('2026-04-01');
    expect(access.termsAcceptedVersion).toBe('2026-03-03');
    expect(access.termsRequiresReaccept).toBe(true);
    expect(access.termsAcceptanceRequired).toBe(true);
    expect(access.termsNoticeRequired).toBe(false);
  });

  it('returns an inform-only notice state when current terms changed without forced re-acceptance', async () => {
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
        terms_current_version: '2026-05-01',
        terms_requires_reaccept: false,
        terms_accepted_version: '2026-03-03',
        terms_accepted_at: '2026-03-03T10:20:30Z',
        terms_acceptance_required: false,
        terms_notice_required: true,
      }],
      error: null,
    });

    const access = await getCurrentAccessContext();

    expect(access.termsCurrentVersion).toBe('2026-05-01');
    expect(access.termsAcceptedVersion).toBe('2026-03-03');
    expect(access.termsRequiresReaccept).toBe(false);
    expect(access.termsAcceptanceRequired).toBe(false);
    expect(access.termsNoticeRequired).toBe(true);
  });

  it('accepts the current terms and returns the accepted version metadata', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{
        terms_version: '2026-03-03',
        accepted_at: '2026-03-03T11:12:13Z',
      }],
      error: null,
    });

    const response = await acceptCurrentTerms({
      locale: 'de',
      source: 'signup_login_page',
    });

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('accept_current_terms', {
      p_locale: 'de',
      p_source: 'signup_login_page',
    });
    expect(response.error).toBeNull();
    expect(response.data).toEqual({
      termsVersion: '2026-03-03',
      acceptedAt: '2026-03-03T11:12:13Z',
    });
  });

  it('returns an error when accept_current_terms payload is incomplete', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{
        terms_version: '',
        accepted_at: null,
      }],
      error: null,
    });

    const response = await acceptCurrentTerms({
      locale: 'en',
      source: 'terms_page',
    });

    expect(response.data).toBeNull();
    expect(response.error).toBeInstanceOf(Error);
  });
});
