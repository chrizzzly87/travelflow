// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearE2EAuthSandbox,
  getE2EAuthSandboxSnapshot,
  registerWithE2EAuthSandbox,
} from '../../services/e2eAuthSandboxService';

// Regression: the sandbox access context omitted the required `billing`
// summary, so billing UI under the e2e sandbox read `undefined` instead of the
// free-user "no subscription" state every real access context carries.
describe('services/e2eAuthSandboxService billing summary', () => {
  beforeEach(() => {
    clearE2EAuthSandbox();
  });

  it('gives a sandbox user the empty billing summary of a free account', async () => {
    await registerWithE2EAuthSandbox('billing@example.com', 'password123');

    const { access } = getE2EAuthSandboxSnapshot();
    expect(access?.tierKey).toBe('tier_free');
    expect(access?.billing).toEqual({
      providerSubscriptionId: null,
      providerStatus: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAt: null,
      canceledAt: null,
      graceEndsAt: null,
      accessUntil: null,
      lifecycleState: 'none',
    });
  });
});
