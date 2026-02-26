import { describe, expect, it } from 'vitest';
import {
  shouldAutoClearSimulatedLoginOnRealAdminSession,
  shouldEnableDevAdminBypass,
} from '../../contexts/AuthContext';

describe('contexts/AuthContext dev admin bypass', () => {
  it('enables bypass only when explicitly configured in dev and on admin routes', () => {
    expect(shouldEnableDevAdminBypass(true, 'true', false, '/admin/dashboard')).toBe(true);
    expect(shouldEnableDevAdminBypass(true, 'true', false, '/u/traveler')).toBe(false);
    expect(shouldEnableDevAdminBypass(true, 'false', false, '/admin/dashboard')).toBe(false);
    expect(shouldEnableDevAdminBypass(false, 'true', false, '/admin/dashboard')).toBe(false);
  });

  it('disables bypass after explicit bypass logout', () => {
    expect(shouldEnableDevAdminBypass(true, 'true', true, '/admin/dashboard')).toBe(false);
  });
});

describe('contexts/AuthContext simulated-login cleanup', () => {
  it('clears simulated-login for real admin sessions', () => {
    expect(shouldAutoClearSimulatedLoginOnRealAdminSession(
      { role: 'admin', isAnonymous: false },
      'real-admin-user-id',
    )).toBe(true);
  });

  it('does not clear for non-admin, anonymous, or dev-bypass sessions', () => {
    expect(shouldAutoClearSimulatedLoginOnRealAdminSession(
      { role: 'user', isAnonymous: false },
      'user-id',
    )).toBe(false);
    expect(shouldAutoClearSimulatedLoginOnRealAdminSession(
      { role: 'admin', isAnonymous: true },
      'admin-id',
    )).toBe(false);
    expect(shouldAutoClearSimulatedLoginOnRealAdminSession(
      { role: 'admin', isAnonymous: false },
      'dev-admin-id',
    )).toBe(false);
    expect(shouldAutoClearSimulatedLoginOnRealAdminSession(
      { role: 'admin', isAnonymous: false },
      null,
    )).toBe(false);
  });
});
