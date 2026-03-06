import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processGenerationWorkerRequest: vi.fn(),
}));

vi.mock('../../netlify/edge-functions/ai-generate-worker.ts', () => ({
  processGenerationWorkerRequest: (...args: unknown[]) => mocks.processGenerationWorkerRequest(...args),
}));

import { handler } from '../../netlify/functions/ai-generate-worker-background.js';

const ORIGINAL_ENV = { ...process.env };

describe('netlify/functions/ai-generate-worker-background', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    mocks.processGenerationWorkerRequest.mockReset();
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
  });

  it('processes authorized invocations by calling the worker processor directly', async () => {
    process.env.AI_GENERATION_ASYNC_WORKER_ENABLED = 'true';
    process.env.TF_ADMIN_API_KEY = 'expected-key';
    process.env.URL = 'https://travelflowapp.netlify.app';
    mocks.processGenerationWorkerRequest.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, processed: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const response = await handler({
      headers: { 'x-tf-admin-key': 'expected-key' },
      body: JSON.stringify({ limit: 2 }),
    } as unknown as Parameters<typeof handler>[0]);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(response.body))).toEqual({ ok: true, processed: 1 });
    expect(mocks.processGenerationWorkerRequest).toHaveBeenCalledTimes(1);
    const [request] = mocks.processGenerationWorkerRequest.mock.calls[0] as [Request];
    expect(request.url).toBe('https://travelflowapp.netlify.app/api/internal/ai/generation-worker?limit=2');
    expect(request.method).toBe('POST');
    expect(Object.fromEntries(request.headers.entries())).toMatchObject({
      'x-tf-admin-key': 'expected-key',
    });
  });
});
