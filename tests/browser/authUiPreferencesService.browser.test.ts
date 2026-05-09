// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  clearPendingOAuthProvider,
  consumePendingOAuthProvider,
  getLastUsedOAuthProvider,
  setLastUsedOAuthProvider,
  setPendingOAuthProvider,
  subscribeLastUsedOAuthProvider,
} from '../../services/authUiPreferencesService';
import { setFixedSystemTime } from '../helpers/time';

describe('services/authUiPreferencesService', () => {
  it('stores and reads last used oauth provider', () => {
    expect(getLastUsedOAuthProvider()).toBeNull();

    setLastUsedOAuthProvider('google');
    expect(getLastUsedOAuthProvider()).toBe('google');
  });

  it('notifies subscribers when the last used oauth provider changes in the same tab', () => {
    let notificationCount = 0;
    const unsubscribe = subscribeLastUsedOAuthProvider(() => {
      notificationCount += 1;
    });

    setLastUsedOAuthProvider('apple');

    expect(notificationCount).toBe(1);
    unsubscribe();

    setLastUsedOAuthProvider('google');
    expect(notificationCount).toBe(1);
  });

  it('returns null for malformed stored last-used payload', () => {
    window.localStorage.setItem('tf_auth_last_oauth_provider_v1', 'not-json');
    expect(getLastUsedOAuthProvider()).toBeNull();
  });

  it('consumes pending oauth provider once', () => {
    setPendingOAuthProvider('apple');
    expect(consumePendingOAuthProvider()).toBe('apple');
    expect(consumePendingOAuthProvider()).toBeNull();
  });

  it('expires pending oauth provider after ttl', () => {
    setFixedSystemTime('2026-01-01T00:00:00Z');
    setPendingOAuthProvider('facebook');

    setFixedSystemTime('2026-01-01T00:16:00Z');
    expect(consumePendingOAuthProvider()).toBeNull();
  });

  it('clears pending provider explicitly', () => {
    setPendingOAuthProvider('kakao');
    clearPendingOAuthProvider();
    expect(consumePendingOAuthProvider()).toBeNull();
  });

  it('drops malformed pending payloads safely', () => {
    window.localStorage.setItem('tf_auth_pending_oauth_provider_v1', JSON.stringify({ provider: 'unknown', updatedAt: Date.now() }));
    expect(consumePendingOAuthProvider()).toBeNull();

    window.localStorage.setItem('tf_auth_pending_oauth_provider_v1', 'invalid-json');
    expect(consumePendingOAuthProvider()).toBeNull();

    window.localStorage.setItem('tf_auth_pending_oauth_provider_v1', JSON.stringify({ provider: 'google' }));
    expect(consumePendingOAuthProvider()).toBeNull();
  });
});
