import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleGenerationWorkerRequest } from '../../netlify/edge-functions/ai-generate-worker.ts';

const stubDenoEnv = (values: Record<string, string | undefined>) => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => values[key],
    },
  });
};

describe('ai-generate-worker claim handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns explicit claim failure payload when claim RPC fails', async () => {
    stubDenoEnv({
      AI_GENERATION_ASYNC_WORKER_ENABLED: 'true',
      TF_ADMIN_API_KEY: 'expected-key',
      VITE_SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'trip_generation_job_claim failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://travelflowapp.netlify.app/api/internal/ai/generation-worker?limit=2', {
      method: 'POST',
      headers: {
        'x-tf-admin-key': 'expected-key',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const response = await handleGenerationWorkerRequest(request);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      ok: false,
      code: 'WORKER_JOB_CLAIM_FAILED',
      error: 'trip_generation_job_claim failed',
      status: 500,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
