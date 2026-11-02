import { describe, expect, it } from 'vitest';

import { buildTripAgentChatRequest, readTripAgentError } from '../../services/tripAgentService';
import type { TripAgentContextRef, TripAgentMessage } from '../../shared/tripAgent';

describe('tripAgentService', () => {
  it('sends only the newest user message while the server reloads canonical history', () => {
    const messages: TripAgentMessage[] = [
      { id: 'old-message', role: 'assistant', parts: [{ type: 'text', text: 'Old answer' }] },
      { id: 'new-message', role: 'user', parts: [{ type: 'text', text: 'Relax this stop' }] },
    ];
    const contextRefs: TripAgentContextRef[] = [{
      id: 'city-lisbon',
      kind: 'city',
      label: 'Lisbon',
      tripUpdatedAt: 123,
    }];

    const request = buildTripAgentChatRequest({
      tripId: 'trip-1',
      threadId: 'd04ab4ee-7476-45b5-b93f-07a38cb67c87',
      messages,
      contextRefs,
    });

    expect(request.body.action).toBe('chat');
    expect(request.body.message).toEqual(messages[1]);
    expect(JSON.stringify(request.body)).not.toContain('Old answer');
    expect(request.body.contextRefs).toEqual(contextRefs);
    expect(request.body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('readTripAgentError', () => {
  it('keeps the server code, detail, and request id for the in-chat error card', () => {
    const error = Object.assign(new Error('Your message could not be saved, so nothing was sent.'), {
      code: 'TRIP_AGENT_PERSISTENCE_FAILED',
      status: 502,
      detail: 'Unexpected end of JSON input',
      requestId: 'b3f1c0de-0000-4000-8000-000000000000',
    });

    expect(readTripAgentError(error)).toEqual({
      code: 'TRIP_AGENT_PERSISTENCE_FAILED',
      message: 'Your message could not be saved, so nothing was sent.',
      detail: 'Unexpected end of JSON input',
      requestId: 'b3f1c0de-0000-4000-8000-000000000000',
      status: 502,
    });
  });

  it('falls back to a generic code for stream failures without a coded response', () => {
    const info = readTripAgentError(new Error('The Trip Agent could not finish this response. Please try again.'));

    expect(info.code).toBe('TRIP_AGENT_REQUEST_FAILED');
    expect(info.detail).toBeUndefined();
  });
});
