import { describe, expect, it } from 'vitest';

import { buildTripAgentChatRequest } from '../../services/tripAgentService';
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
