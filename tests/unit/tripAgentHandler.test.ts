import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { classifyTripAgentFailure } from '../../netlify/edge-lib/trip-agent-handler.ts';

describe('classifyTripAgentFailure', () => {
  it('maps a failed pre-stream persistence write to a coded gateway failure', () => {
    expect(classifyTripAgentFailure(new Error('TRIP_AGENT_PERSISTENCE_FAILED: Unexpected end of JSON input'))).toEqual({
      status: 502,
      code: 'TRIP_AGENT_PERSISTENCE_FAILED',
      error: 'Your message could not be saved, so nothing was sent.',
    });
  });

  it('maps missing model configuration and archived threads to distinct codes', () => {
    expect(classifyTripAgentFailure(new Error('TRIP_AGENT_MODEL_NOT_CONFIGURED')).status).toBe(503);
    expect(classifyTripAgentFailure(new Error('Trip Agent thread not found or archived.')).code)
      .toBe('TRIP_AGENT_THREAD_NOT_FOUND');
  });

  it('maps schema failures to a request-shape code instead of a generic failure', () => {
    const parsed = z.object({ tripId: z.string() }).safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(classifyTripAgentFailure(parsed.error).code).toBe('TRIP_AGENT_INVALID_REQUEST');
  });

  it('never leaks a raw provider message through the user-facing error text', () => {
    const failure = classifyTripAgentFailure(new Error('gateway said: api key sk-live-123 rejected'));
    expect(failure.code).toBe('TRIP_AGENT_REQUEST_FAILED');
    expect(failure.error).not.toContain('sk-live-123');
  });
});
