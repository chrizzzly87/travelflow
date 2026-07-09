import { describe, expect, it } from 'vitest';
import { hasTripGenerationSessionAccess } from '../../services/tripGenerationAccessService';

describe('hasTripGenerationSessionAccess', () => {
  it('allows anonymous Supabase sessions to generate trips', () => {
    expect(hasTripGenerationSessionAccess({
      isAuthenticated: false,
      isAnonymous: true,
    })).toBe(true);
  });

  it('allows a session created during the current generate action before auth context catches up', () => {
    expect(hasTripGenerationSessionAccess({
      isAuthenticated: false,
      isAnonymous: false,
      sessionUserId: 'fresh-anonymous-user',
    })).toBe(true);
  });

  it('allows signed-in users and rejects visitors without a session', () => {
    expect(hasTripGenerationSessionAccess({
      isAuthenticated: true,
      isAnonymous: false,
    })).toBe(true);
    expect(hasTripGenerationSessionAccess({
      isAuthenticated: false,
      isAnonymous: false,
    })).toBe(false);
  });
});
