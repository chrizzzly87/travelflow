// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  acceptCurrentTermsInE2EAuthSandbox,
  clearE2EAuthSandbox,
  getE2EAuthSandboxSnapshot,
  loginWithE2EAuthSandbox,
  logoutFromE2EAuthSandbox,
  registerWithE2EAuthSandbox,
} from '../../services/e2eAuthSandboxService';

describe('services/e2eAuthSandboxService', () => {
  beforeEach(() => {
    clearE2EAuthSandbox();
  });

  it('registers a fake user and exposes an authenticated snapshot', async () => {
    const response = await registerWithE2EAuthSandbox('tester@example.com', 'password123');

    expect(response.error).toBeNull();
    const snapshot = getE2EAuthSandboxSnapshot();
    expect(snapshot.session?.user.email).toBe('tester@example.com');
    expect(snapshot.access?.email).toBe('tester@example.com');
    expect(snapshot.access?.isAnonymous).toBe(false);
  });

  it('rejects invalid fake sandbox login credentials', async () => {
    await registerWithE2EAuthSandbox('tester@example.com', 'password123');
    await logoutFromE2EAuthSandbox();

    const response = await loginWithE2EAuthSandbox('tester@example.com', 'wrong-password');
    expect(response.error?.message).toContain('Invalid login credentials');
  });

  it('clears the active fake session on logout', async () => {
    await registerWithE2EAuthSandbox('tester@example.com', 'password123');
    await logoutFromE2EAuthSandbox();

    const snapshot = getE2EAuthSandboxSnapshot();
    expect(snapshot.session).toBeNull();
    expect(snapshot.access).toBeNull();
  });

  it('returns an immediate fake terms acceptance payload', () => {
    const acceptance = acceptCurrentTermsInE2EAuthSandbox();
    expect(acceptance.termsVersion).toBe('e2e-sandbox-v1');
    expect(typeof acceptance.acceptedAt).toBe('string');
  });
});
