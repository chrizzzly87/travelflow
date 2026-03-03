// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSupabaseAuthStorageAdapter,
  getAuthSessionPersistencePreference,
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
});

