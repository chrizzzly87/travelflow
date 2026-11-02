import { describe, expect, it } from 'vitest';

import { isTripAgentRolledOut } from '../../hooks/useTripAgentAvailability';

describe('isTripAgentRolledOut', () => {
  // The launcher used to render for every signed-in editor while the server
  // refused everyone but administrators, so the button opened an error.
  it('hides the agent from ordinary accounts while the rollout is off', () => {
    expect(isTripAgentRolledOut({ tripAgentEnabled: false, tripAgentAdminPreview: true }, false)).toBe(false);
  });

  it('lets an administrator preview it while the rollout is off', () => {
    expect(isTripAgentRolledOut({ tripAgentEnabled: false, tripAgentAdminPreview: true }, true)).toBe(true);
  });

  it('honours a disabled admin preview', () => {
    expect(isTripAgentRolledOut({ tripAgentEnabled: false, tripAgentAdminPreview: false }, true)).toBe(false);
  });

  it('shows it to everyone once the rollout is on', () => {
    expect(isTripAgentRolledOut({ tripAgentEnabled: true, tripAgentAdminPreview: false }, false)).toBe(true);
  });
});
