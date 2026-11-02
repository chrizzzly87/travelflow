import { describe, expect, it } from 'vitest';

import { tripAgentBodySchema } from '../../netlify/edge-lib/trip-agent-handler.ts';

const TRIP_ID = 'trip-1';
const THREAD_ID = '6f9a4a8e-2b3c-4d5e-8f90-1a2b3c4d5e6f';

describe('tripAgentBodySchema thread actions', () => {
  it('lets a draft name its own thread id when it is saved', () => {
    const parsed = tripAgentBodySchema.parse({ action: 'createThread', tripId: TRIP_ID, threadId: THREAD_ID });
    expect(parsed).toEqual({ action: 'createThread', tripId: TRIP_ID, threadId: THREAD_ID });
  });

  it('still accepts a create without an id', () => {
    expect(tripAgentBodySchema.parse({ action: 'createThread', tripId: TRIP_ID }).action).toBe('createThread');
  });

  it('rejects a draft id that is not a uuid', () => {
    expect(tripAgentBodySchema.safeParse({ action: 'createThread', tripId: TRIP_ID, threadId: 'draft-1' }).success)
      .toBe(false);
  });

  it('accepts restoring an archived chat', () => {
    expect(tripAgentBodySchema.parse({ action: 'restoreThread', tripId: TRIP_ID, threadId: THREAD_ID }).action)
      .toBe('restoreThread');
  });
});
