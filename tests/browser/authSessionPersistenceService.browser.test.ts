// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSupabaseAuthStorageAdapter,
  getAuthSessionPersistencePreference,
  readPersistedSupabaseSessionHint,
  setAuthSessionPersistencePreference,
  setRememberLoginEnabled,
} from '../../services/authSessionPersistenceService';
import { readLocalStorageItem, readSessionStorageItem } from '../../services/browserStorageService';

const SUPABASE_AUTH_KEY = 'sb-demo-auth-token';

const clearAllCookies = (): void => {
  const cookieParts = document.cookie ? document.cookie.split(';') : [];
  for (const cookiePart of cookieParts) {
    const [name] = cookiePart.trim().split('=');
    if (!name) continue;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
};

describe('services/authSessionPersistenceService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAllCookies();
    setAuthSessionPersistencePreference('persistent');
  });

  it('stores remember-login preference in localStorage', () => {
    expect(getAuthSessionPersistencePreference()).toBe('persistent');

    setRememberLoginEnabled(false);
    expect(getAuthSessionPersistencePreference()).toBe('session');

    setRememberLoginEnabled(true);
    expect(getAuthSessionPersistencePreference()).toBe('persistent');
  });

  it('uses persistent localStorage mode and restores from localhost bridge cookie', () => {
    const storage = createSupabaseAuthStorageAdapter();
    storage.setItem(SUPABASE_AUTH_KEY, 'persistent-token');

    expect(readLocalStorageItem(SUPABASE_AUTH_KEY)).toBe('persistent-token');
    expect(readSessionStorageItem(SUPABASE_AUTH_KEY)).toBeNull();

    window.localStorage.removeItem(SUPABASE_AUTH_KEY);

    expect(storage.getItem(SUPABASE_AUTH_KEY)).toBe('persistent-token');
    expect(readLocalStorageItem(SUPABASE_AUTH_KEY)).toBe('persistent-token');
  });

  it('uses sessionStorage mode without reading localhost bridge cookies', () => {
    const storage = createSupabaseAuthStorageAdapter();
    storage.setItem(SUPABASE_AUTH_KEY, 'persistent-token');

    setAuthSessionPersistencePreference('session');
    window.localStorage.removeItem(SUPABASE_AUTH_KEY);

    expect(storage.getItem(SUPABASE_AUTH_KEY)).toBeNull();

    storage.setItem(SUPABASE_AUTH_KEY, 'session-token');
    expect(readSessionStorageItem(SUPABASE_AUTH_KEY)).toBe('session-token');
    expect(readLocalStorageItem(SUPABASE_AUTH_KEY)).toBeNull();
  });

  it('reads a persisted signed-in session hint from auth token storage', () => {
    window.localStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 2_000_000_000,
      user: {
        id: 'user-123',
        email: 'traveler@example.com',
        app_metadata: { provider: 'email', providers: ['email'] },
      },
    }));

    expect(readPersistedSupabaseSessionHint()).toEqual({
      userId: 'user-123',
      email: 'traveler@example.com',
      expiresAt: 2_000_000_000,
    });
  });

  it('ignores anonymous or malformed persisted auth session payloads', () => {
    window.localStorage.setItem(SUPABASE_AUTH_KEY, JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_at: 2_000_000_000,
      user: {
        id: 'anon-user',
        app_metadata: { provider: 'anonymous', providers: ['anonymous'] },
        identities: [{ provider: 'anonymous' }],
      },
    }));

    expect(readPersistedSupabaseSessionHint()).toBeNull();

    window.localStorage.setItem(SUPABASE_AUTH_KEY, '{bad-json');
    expect(readPersistedSupabaseSessionHint()).toBeNull();
  });
});
