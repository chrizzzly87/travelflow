// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSupabaseAuthStorage } from '../../services/authService';
import {
  readLocalStorageItem,
  readSessionStorageItem,
  writeLocalStorageItem,
  writeSessionStorageItem,
} from '../../services/browserStorageService';

describe('services/authService clearSupabaseAuthStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('clears wildcard Supabase auth keys from both local and session storage', () => {
    expect(writeLocalStorageItem('sb-demo-auth-token', 'local-auth')).toBe(true);
    expect(writeLocalStorageItem('sb-demo-refresh-token', 'local-refresh')).toBe(true);
    expect(writeLocalStorageItem('sb-demo-code-verifier', 'local-code')).toBe(true);
    expect(writeSessionStorageItem('sb-demo-auth-token', 'session-auth')).toBe(true);
    expect(writeSessionStorageItem('sb-demo-refresh-token', 'session-refresh')).toBe(true);
    expect(writeSessionStorageItem('sb-demo-code-verifier', 'session-code')).toBe(true);
    expect(writeLocalStorageItem('tf_map_style', 'standard')).toBe(true);
    window.sessionStorage.setItem('sb-demo-provider-state', 'keep');

    clearSupabaseAuthStorage();

    expect(readLocalStorageItem('sb-demo-auth-token')).toBeNull();
    expect(readLocalStorageItem('sb-demo-refresh-token')).toBeNull();
    expect(readLocalStorageItem('sb-demo-code-verifier')).toBeNull();
    expect(readSessionStorageItem('sb-demo-auth-token')).toBeNull();
    expect(readSessionStorageItem('sb-demo-refresh-token')).toBeNull();
    expect(readSessionStorageItem('sb-demo-code-verifier')).toBeNull();
    expect(readLocalStorageItem('tf_map_style')).toBe('standard');
    expect(window.sessionStorage.getItem('sb-demo-provider-state')).toBe('keep');
  });
});
