import { describe, expect, it } from 'vitest';
import {
  buildPasswordResetRedirectUrl,
  buildPathFromLocationParts,
  clearPendingAuthRedirect,
  clearRememberedAuthReturnPath,
  getPendingAuthRedirect,
  getRememberedAuthReturnPath,
  isLoginPathname,
  isSafeAuthReturnPath,
  rememberAuthReturnPath,
  resolvePreferredNextPath,
  setPendingAuthRedirect,
} from '../../services/authNavigationService';
import { setFixedSystemTime } from '../helpers/time';

describe('services/authNavigationService', () => {
  it('builds paths from location parts', () => {
    expect(buildPathFromLocationParts({ pathname: '/trip/1', search: '?v=2', hash: '#map' })).toBe('/trip/1?v=2#map');
    expect(buildPathFromLocationParts({ pathname: '' as unknown as string })).toBe('/');
  });

  it('classifies login and safe auth return paths', () => {
    expect(isLoginPathname('/login')).toBe(true);
    expect(isLoginPathname('/de/login')).toBe(true);
    expect(isLoginPathname('/create-trip')).toBe(false);

    expect(isSafeAuthReturnPath('/trip/abc')).toBe(true);
    expect(isSafeAuthReturnPath('/de/trip/abc')).toBe(true);
    expect(isSafeAuthReturnPath('/login')).toBe(false);
    expect(isSafeAuthReturnPath('//evil.example')).toBe(false);
    expect(isSafeAuthReturnPath('https://evil.example')).toBe(false);
  });

  it('remembers and clears auth return paths only when safe', () => {
    rememberAuthReturnPath('/trip/abc?v=1');
    expect(getRememberedAuthReturnPath()).toBe('/trip/abc?v=1');

    rememberAuthReturnPath('/login');
    expect(getRememberedAuthReturnPath()).toBe('/trip/abc?v=1');

    clearRememberedAuthReturnPath();
    expect(getRememberedAuthReturnPath()).toBeNull();
  });

  it('stores pending redirects with TTL validation', () => {
    setFixedSystemTime('2026-01-01T00:00:00Z');
    setPendingAuthRedirect('/trip/abc', 'login-gate');

    expect(getPendingAuthRedirect()).toMatchObject({
      nextPath: '/trip/abc',
      source: 'login-gate',
    });

    setFixedSystemTime('2026-01-01T00:31:00Z');
    expect(getPendingAuthRedirect()).toBeNull();

    clearPendingAuthRedirect();
    expect(getPendingAuthRedirect()).toBeNull();
  });

  it('clears invalid pending redirect payloads', () => {
    window.localStorage.setItem('tf_auth_pending_redirect_v1', 'not-json');
    expect(getPendingAuthRedirect()).toBeNull();

    window.localStorage.setItem('tf_auth_pending_redirect_v1', JSON.stringify({
      nextPath: '//evil.example',
      source: 'bad',
      createdAt: Date.now(),
    }));
    expect(getPendingAuthRedirect()).toBeNull();

    window.localStorage.setItem('tf_auth_pending_redirect_v1', JSON.stringify({
      nextPath: '/trip/ok',
      source: '',
      createdAt: Date.now(),
    }));
    expect(getPendingAuthRedirect()).toBeNull();
  });

  it('resolves preferred next path and builds reset redirect url', () => {
    expect(resolvePreferredNextPath(null, '/login', '/trip/ok')).toBe('/trip/ok');
    expect(resolvePreferredNextPath(undefined, null)).toBe('/create-trip');

    const redirect = buildPasswordResetRedirectUrl('/trip/123');
    expect(redirect).toContain('/auth/reset-password');
    expect(redirect).toContain('next=%2Ftrip%2F123');

    const withoutNext = buildPasswordResetRedirectUrl('/login');
    expect(withoutNext).not.toContain('next=');
  });
});
