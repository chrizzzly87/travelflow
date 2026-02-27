import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  authGetUser: vi.fn(),
  fullMaybeSingle: vi.fn(),
  legacyMaybeSingle: vi.fn(),
  minimalMaybeSingle: vi.fn(),
  lookupMaybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../services/supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supabaseClient')>();
  const resolveSelectMaybeSingle = (query: string) => {
    const compact = query.replace(/\s+/g, '');
    if (query.includes('passport_sticker_selection')) {
      return supabaseMocks.fullMaybeSingle();
    }
    if (compact === 'id,username') {
      return supabaseMocks.lookupMaybeSingle();
    }
    if (query.includes('username_changed_at')) {
      return supabaseMocks.legacyMaybeSingle();
    }
    return supabaseMocks.minimalMaybeSingle();
  };

  return {
    ...actual,
    supabase: {
      auth: {
        getUser: supabaseMocks.authGetUser,
      },
      from: () => ({
        select: (query: string) => ({
          eq: () => ({
            maybeSingle: () => resolveSelectMaybeSingle(query),
          }),
          ilike: () => ({
            maybeSingle: () => resolveSelectMaybeSingle(query),
          }),
        }),
      }),
      rpc: supabaseMocks.rpc,
    },
  };
});

import {
  checkUsernameAvailability,
  getCurrentUserProfile,
  resolvePublicProfileByHandle,
} from '../../services/profileService';

describe('services/profileService username cooldown fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
    vi.clearAllMocks();

    supabaseMocks.authGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
        },
      },
      error: null,
    });

    supabaseMocks.fullMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        message: 'column "passport_sticker_selection" does not exist',
      },
    });

    supabaseMocks.legacyMaybeSingle.mockResolvedValue({
      data: {
        id: 'user-1',
        display_name: 'Chris',
        first_name: 'Chris',
        last_name: 'W',
        username: 'traveler',
        bio: '',
        gender: '',
        country: 'DE',
        city: 'Hamburg',
        preferred_language: 'en',
        onboarding_completed_at: '2026-01-01T00:00:00Z',
        account_status: 'active',
        username_changed_at: '2026-01-15T00:00:00Z',
      },
      error: null,
    });

    supabaseMocks.minimalMaybeSingle.mockResolvedValue({
      data: {
        id: 'user-1',
        display_name: 'Chris',
        first_name: 'Chris',
        last_name: 'W',
        username: 'traveler',
        bio: '',
        gender: '',
        country: 'DE',
        city: 'Hamburg',
        preferred_language: 'en',
        onboarding_completed_at: '2026-01-01T00:00:00Z',
        account_status: 'active',
      },
      error: null,
    });

    supabaseMocks.lookupMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps username_changed_at when profile query falls back to legacy select', async () => {
    const profile = await getCurrentUserProfile();
    expect(profile?.usernameChangedAt).toBe('2026-01-15T00:00:00Z');
  });

  it('returns cooldown for @-prefixed candidate when changed recently', async () => {
    const result = await checkUsernameAvailability('@new_handle');

    expect(result.normalizedUsername).toBe('new_handle');
    expect(result.availability).toBe('cooldown');
    expect(result.reason).toBe('cooldown');
    expect(result.cooldownEndsAt).toBeTruthy();
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
    expect(supabaseMocks.lookupMaybeSingle).not.toHaveBeenCalled();
  });

  it('still returns profile data when username_changed_at is unavailable in legacy fallback', async () => {
    supabaseMocks.legacyMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'column "username_changed_at" does not exist',
      },
    });

    const profile = await getCurrentUserProfile();
    expect(profile?.id).toBe('user-1');
    expect(profile?.username).toBe('traveler');
    expect(profile?.usernameChangedAt).toBeNull();
  });

  it('resolves public profile from RPC rows when optional passport fields are absent', async () => {
    supabaseMocks.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_current_user_access') {
        return {
          data: null,
          error: {
            message: 'Not authenticated',
          },
        };
      }

      if (fn === 'profile_resolve_public_handle') {
        return {
          data: [
            {
              status: 'found',
              canonical_username: 'traveler',
              id: 'user-1',
              display_name: 'Chris',
              first_name: 'Chris',
              last_name: 'W',
              username: 'traveler',
              bio: '',
              country: 'DE',
              city: 'Hamburg',
              preferred_language: 'en',
              public_profile_enabled: true,
              account_status: 'active',
              username_changed_at: '2026-01-15T00:00:00Z',
            },
          ],
          error: null,
        };
      }

      return {
        data: null,
        error: null,
      };
    });

    const result = await resolvePublicProfileByHandle('traveler');

    expect(result.status).toBe('found');
    expect(result.profile?.id).toBe('user-1');
    expect(result.profile?.username).toBe('traveler');
    expect(result.canonicalUsername).toBe('traveler');
  });
});
