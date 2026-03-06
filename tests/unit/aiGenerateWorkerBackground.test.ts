import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../netlify/edge-functions/ai-generate-worker.ts', () => ({
  handleGenerationWorkerRequest: vi.fn(async () => (
    new Response(JSON.stringify({ ok: true, processed: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )),
}));

import { handler } from '../../netlify/functions/ai-generate-worker-background.js';
import { handleGenerationWorkerRequest } from '../../netlify/edge-functions/ai-generate-worker.ts';

const mockedWorker = vi.mocked(handleGenerationWorkerRequest);
const ORIGINAL_ENV = { ...process.env };

describe('netlify/functions/ai-generate-worker-background', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects unauthorized invocations', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'expected-key';

    const response = await handler({
      headers: { 'x-tf-admin-key': 'wrong-key' },
      body: '{}',
    } as unknown as Parameters<typeof handler>[0]);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(String(response.body))).toMatchObject({
      ok: false,
      code: 'WORKER_UNAUTHORIZED',
    });
    expect(mockedWorker).not.toHaveBeenCalled();
  });

  it('proxies authorized invocations to the shared worker handler', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'expected-key';
    process.env.URL = 'https://travelflowapp.netlify.app';

    const response = await handler({
      headers: { 'x-tf-admin-key': 'expected-key' },
      body: JSON.stringify({ limit: 2 }),
    } as unknown as Parameters<typeof handler>[0]);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(response.body))).toEqual({ ok: true, processed: 1 });
    expect(mockedWorker).toHaveBeenCalledTimes(1);
    const [request] = mockedWorker.mock.calls[0] as [Request];
    expect(request.url).toContain('/api/internal/ai/generation-worker?limit=2');
  });
});
