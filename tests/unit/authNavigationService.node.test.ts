import { describe, expect, it } from 'vitest';
import {
  buildPasswordResetRedirectUrl,
  clearPendingAuthRedirect,
  clearRememberedAuthReturnPath,
  getPendingAuthRedirect,
  getRememberedAuthReturnPath,
  rememberAuthReturnPath,
  setPendingAuthRedirect,
} from '../../services/authNavigationService';

describe('services/authNavigationService (node environment)', () => {
  it('returns null/undefined without window and performs safe no-ops', () => {
    expect(getRememberedAuthReturnPath()).toBeNull();
    expect(getPendingAuthRedirect()).toBeNull();
    expect(buildPasswordResetRedirectUrl('/trip/1')).toBeUndefined();

    expect(() => rememberAuthReturnPath('/trip/1')).not.toThrow();
    expect(() => clearRememberedAuthReturnPath()).not.toThrow();
    expect(() => setPendingAuthRedirect('/trip/1', 'node')).not.toThrow();
    expect(() => clearPendingAuthRedirect()).not.toThrow();
  });
});
