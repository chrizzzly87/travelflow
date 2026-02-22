import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureModelAllowed,
  generateProviderItinerary,
} from '../../netlify/edge-lib/ai-provider-runtime.ts';

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const stubDenoEnv = (values: Record<string, string | undefined>) => {
  vi.stubGlobal('Deno', {
    env: {
      get: (key: string) => values[key],
    },
  });
};

describe('netlify/edge-lib/ai-provider-runtime', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('validates provider/model allowlists including openrouter', () => {
    expect(ensureModelAllowed('openrouter', 'openrouter/free')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'z-ai/glm-5')).toBeNull();
    expect(ensureModelAllowed('anthropic', 'claude-sonnet-4.6')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'missing-model')?.code).toBe('MODEL_NOT_ALLOWED');
    expect(ensureModelAllowed('unknown-provider', 'x')?.code).toBe('PROVIDER_NOT_SUPPORTED');
  });

  it('maps anthropic sonnet 4.6 to provider model id', async () => {
    stubDenoEnv({
      ANTHROPIC_API_KEY: 'anthropic-key',
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        content: [
          {
            type: 'text',
            text: '{"tripTitle":"Anthropic test","cities":[],"travelSegments":[],"activities":[]}',
          },
        ],
        usage: {
          input_tokens: 111,
          output_tokens: 222,
        },
      }),
    );

    const result = await generateProviderItinerary({
      prompt: '{"request":"anthropic-test"}',
      provider: 'anthropic',
      model: 'claude-sonnet-4.6',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('claude-sonnet-4-6');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.meta.provider).toBe('anthropic');
    expect(result.value.meta.model).toBe('claude-sonnet-4.6');
    expect(result.value.meta.providerModel).toBe('claude-sonnet-4-6');
  });

  it('falls back to OpenAI responses endpoint for non-chat models', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'This is not a chat model and thus not supported in the v1/chat/completions endpoint. Did you mean to use v1/completions?',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          output_text: '{"tripTitle":"OpenAI fallback","cities":[],"travelSegments":[],"activities":[]}',
          usage: {
            input_tokens: 321,
            output_tokens: 654,
            total_tokens: 975,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-fallback"}',
      provider: 'openai',
      model: 'gpt-5.2',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://api.openai.com/v1/responses');
    const responsesInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const responsesBody = JSON.parse(String(responsesInit.body));
    expect(responsesBody).not.toHaveProperty('temperature');
    expect(responsesBody.max_output_tokens).toBe(8192);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.tripTitle).toBe('OpenAI fallback');
    expect(result.value.meta.provider).toBe('openai');
    expect(result.value.meta.model).toBe('gpt-5.2');
    expect(result.value.meta.usage).toEqual({
      promptTokens: 321,
      completionTokens: 654,
      totalTokens: 975,
    });
  });

  it('returns key-missing error for openrouter requests without api key', async () => {
    stubDenoEnv({});
    const result = await generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 30_000,
    });

    expect(result.ok).toBe(false);
    if (!('status' in result)) return;

    expect(result.status).toBe(500);
    expect(result.value.code).toBe('OPENROUTER_KEY_MISSING');
  });

  it('parses successful openrouter responses with usage/cost metadata', async () => {
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
      SITE_URL: 'https://travelflow.example',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        model: 'openrouter/free',
        choices: [{ message: { content: '{"title":"Test itinerary"}' } }],
        usage: {
          prompt_tokens: 123,
          completion_tokens: 456,
          total_tokens: 579,
          cost: 0.000321,
        },
      }),
    );

    const result = await generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.title).toBe('Test itinerary');
    expect(result.value.meta.provider).toBe('openrouter');
    expect(result.value.meta.providerModel).toBe('openrouter/free');
    expect(result.value.meta.usage).toEqual({
      promptTokens: 123,
      completionTokens: 456,
      totalTokens: 579,
      estimatedCostUsd: 0.000321,
    });
  });

  it('retries openrouter once on transient provider failure', async () => {
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
    });

    fetchMock
      .mockResolvedValueOnce(new Response('temporarily overloaded', { status: 503 }))
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'openrouter/free',
          choices: [{ message: { content: '{"title":"Recovered"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.title).toBe('Recovered');
  });

  it('retries openrouter once on parse failure and succeeds on strict-json retry', async () => {
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'openrouter/free',
          choices: [{ message: { content: 'not-json' } }],
          usage: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'openrouter/free',
          choices: [{ message: { content: '{"title":"Recovered after parse retry"}' } }],
          usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body));
    expect(retryBody.messages[0].content).toContain('Return exactly one minified JSON object');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.title).toBe('Recovered after parse retry');
  });

  it('returns parse failure when openrouter content is not valid json object', async () => {
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'openrouter/free',
          choices: [{ message: { content: 'not-json' } }],
          usage: {},
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'openrouter/free',
          choices: [{ message: { content: 'still-not-json' } }],
          usage: {},
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (!('status' in result)) return;
    expect(result.status).toBe(502);
    expect(result.value.code).toBe('OPENROUTER_PARSE_FAILED');
  });

  it('returns timeout when response parsing stalls after headers', async () => {
    vi.useFakeTimers();
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    } as unknown as Response);

    const resultPromise = generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 1_000,
    });

    let result: Awaited<ReturnType<typeof generateProviderItinerary>>;
    try {
      await vi.advanceTimersByTimeAsync(1_000);
      result = await resultPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(result.ok).toBe(false);
    if (!('status' in result)) return;
    expect(result.status).toBe(504);
    expect(result.value.code).toBe('OPENROUTER_REQUEST_TIMEOUT');
  });
});
