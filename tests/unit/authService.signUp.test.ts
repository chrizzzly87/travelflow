import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  authGetSession: vi.fn(),
  authUpdateUser: vi.fn(),
  authSignUp: vi.fn(),
}));

vi.mock('../../services/supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supabaseClient')>();
  return {
    ...actual,
    supabase: {
      auth: {
        getSession: supabaseMocks.authGetSession,
        updateUser: supabaseMocks.authUpdateUser,
        signUp: supabaseMocks.authSignUp,
      },
    },
  };
});

import { signUpWithEmailPassword } from '../../services/authService';

describe('services/authService signUpWithEmailPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to an email-only anonymous upgrade when Supabase rejects the reused password', async () => {
    supabaseMocks.authGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'anon-1',
            email: null,
            phone: null,
            is_anonymous: true,
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
    supabaseMocks.authUpdateUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: 'same_password',
          message: 'New password should be different from the old password.',
        },
      })
      .mockResolvedValueOnce({
        data: { user: { id: 'anon-1', email: 'fixed@example.com' } },
        error: null,
      });

    const response = await signUpWithEmailPassword('fixed@example.com', 'password123');

    expect(supabaseMocks.authUpdateUser).toHaveBeenNthCalledWith(1, {
      email: 'fixed@example.com',
      password: 'password123',
    });
    expect(supabaseMocks.authUpdateUser).toHaveBeenNthCalledWith(2, {
      email: 'fixed@example.com',
    });
    expect(supabaseMocks.authSignUp).not.toHaveBeenCalled();
    expect(response.error).toBeNull();
    expect(response.data).toEqual({ user: { id: 'anon-1', email: 'fixed@example.com' } });
  });

  it('uses normal sign-up when no anonymous session is present', async () => {
    supabaseMocks.authGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-1',
            email: 'user@example.com',
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
    supabaseMocks.authSignUp.mockResolvedValue({
      data: { session: null, user: { id: 'user-2', email: 'new@example.com' } },
      error: null,
    });

    const response = await signUpWithEmailPassword('new@example.com', 'password123', {
      emailRedirectTo: 'https://example.com/login',
    });

    expect(supabaseMocks.authUpdateUser).not.toHaveBeenCalled();
    expect(supabaseMocks.authSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: {
        emailRedirectTo: 'https://example.com/login',
      },
    });
    expect(response.error).toBeNull();
  });
});
