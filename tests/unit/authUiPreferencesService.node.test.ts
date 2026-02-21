import { describe, expect, it } from 'vitest';
import {
  clearPendingOAuthProvider,
  consumePendingOAuthProvider,
  getLastUsedOAuthProvider,
  setLastUsedOAuthProvider,
  setPendingOAuthProvider,
} from '../../services/authUiPreferencesService';

describe('services/authUiPreferencesService (node environment)', () => {
  it('returns null without browser storage', () => {
    expect(getLastUsedOAuthProvider()).toBeNull();
    expect(consumePendingOAuthProvider()).toBeNull();
  });

  it('setters/clearers are safe no-ops without window', () => {
    expect(() => setLastUsedOAuthProvider('google')).not.toThrow();
    expect(() => setPendingOAuthProvider('apple')).not.toThrow();
    expect(() => clearPendingOAuthProvider()).not.toThrow();
  });
});
