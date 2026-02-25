import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistAiGenerationTelemetry } from '../../netlify/edge-lib/ai-generation-telemetry';

const stubDenoEnv = (values: Record<string, string | undefined>) => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => values[key],
    },
  });
};

describe('netlify/edge-lib/ai-generation-telemetry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns false without service role supabase config', async () => {
    stubDenoEnv({});

    const persisted = await persistAiGenerationTelemetry({
      source: 'create_trip',
      requestId: 'req-1',
      provider: 'gemini',
      model: 'gemini-3-pro-preview',
      status: 'success',
      latencyMs: 100,
      httpStatus: 200,
    });

    expect(persisted).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts normalized payload to ai_generation_events', async () => {
    stubDenoEnv({
      VITE_SUPABASE_URL: 'https://supabase.example/',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));

    const longError = 'x'.repeat(1000);
    const persisted = await persistAiGenerationTelemetry({
      source: 'benchmark',
      requestId: '',
      provider: 'openrouter',
      model: 'openrouter/free',
      providerModel: 'openrouter/free',
      status: 'failed',
      latencyMs: 1234.8,
      httpStatus: 502.2,
      errorCode: 'OPENROUTER_REQUEST_FAILED',
      errorMessage: longError,
      estimatedCostUsd: 0.000321,
      promptTokens: 120,
      completionTokens: 230,
      totalTokens: 350,
      benchmarkSessionId: '11111111-1111-4111-8111-111111111111',
      benchmarkRunId: '22222222-2222-4222-8222-222222222222',
      metadata: { endpoint: '/api/internal/ai/benchmark' },
    });

    expect(persisted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://supabase.example/rest/v1/ai_generation_events');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('service-role-secret');
    expect(headers.Authorization).toBe('Bearer service-role-secret');
    expect(headers.Prefer).toBe('return=minimal');

    const payload = JSON.parse(String(init.body));
    expect(payload.source).toBe('benchmark');
    expect(payload.request_id).toEqual(expect.any(String));
    expect(payload.request_id.length).toBeGreaterThan(0);
    expect(payload.provider).toBe('openrouter');
    expect(payload.model).toBe('openrouter/free');
    expect(payload.provider_model).toBe('openrouter/free');
    expect(payload.status).toBe('failed');
    expect(payload.latency_ms).toBe(1235);
    expect(payload.http_status).toBe(502);
    expect(payload.error_code).toBe('OPENROUTER_REQUEST_FAILED');
    expect(payload.error_message.length).toBe(800);
    expect(payload.estimated_cost_usd).toBe(0.000321);
    expect(payload.prompt_tokens).toBe(120);
    expect(payload.completion_tokens).toBe(230);
    expect(payload.total_tokens).toBe(350);
    expect(payload.benchmark_session_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.benchmark_run_id).toBe('22222222-2222-4222-8222-222222222222');
    expect(payload.metadata).toEqual({ endpoint: '/api/internal/ai/benchmark' });
  });

  it('returns false when network call throws', async () => {
    stubDenoEnv({
      VITE_SUPABASE_URL: 'https://supabase.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    });
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const persisted = await persistAiGenerationTelemetry({
      source: 'create_trip',
      requestId: 'req-2',
      provider: 'gemini',
      model: 'gemini-3-pro-preview',
      status: 'failed',
      latencyMs: 999,
      httpStatus: 500,
      errorCode: 'AI_GENERATION_UNEXPECTED_ERROR',
      errorMessage: 'network down',
    });

    expect(persisted).toBe(false);
  });
});
