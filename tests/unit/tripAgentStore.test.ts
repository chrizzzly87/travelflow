import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { persistTripAgentMessage } from '../../netlify/edge-lib/trip-agent-store.ts';

describe('tripAgentStore', () => {
  beforeEach(() => {
    vi.stubGlobal('Netlify', {
      env: {
        get: (key: string) => ({
          VITE_SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
        })[key as 'VITE_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'],
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('accepts successful PostgREST writes with an empty 201 response body', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(persistTripAgentMessage({
      message: { id: 'message-1', role: 'user', parts: [{ type: 'text', text: 'Relax this route' }] },
      threadId: 'thread-1',
      tripId: 'trip-1',
      authorId: 'user-1',
    })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
