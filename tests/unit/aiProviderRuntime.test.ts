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

const testStructuredOutputSchema = {
  name: 'travelflow_test_trip',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      tripTitle: { type: 'string' },
    },
    required: ['tripTitle'],
  },
} as const;

describe('netlify/edge-lib/ai-provider-runtime', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('SITE_URL', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('validates provider/model allowlists including openrouter', () => {
    expect(ensureModelAllowed('gemini', 'gemini-3.1-flash-lite-preview')).toBeNull();
    expect(ensureModelAllowed('openai', 'gpt-5.4')).toBeNull();
    expect(ensureModelAllowed('openai', 'gpt-5.4-pro')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'openrouter/free')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'openai/gpt-5.4-nano')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'openai/gpt-5.4-mini')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'nvidia/nemotron-3-super-120b-a12b:free')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'z-ai/glm-5')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'x-ai/grok-4.20-beta')).toBeNull();
    expect(ensureModelAllowed('openrouter', 'qwen/qwen3.5-9b')).toBeNull();
    expect(ensureModelAllowed('openai', 'gpt-5.4')).toBeNull();
    expect(ensureModelAllowed('anthropic', 'claude-sonnet-4.6')).toBeNull();
    expect(ensureModelAllowed('perplexity', 'perplexity/sonar')).toBeNull();
    expect(ensureModelAllowed('qwen', 'qwen/qwen3.5-plus-02-15')).toBeNull();
    expect(ensureModelAllowed('qwen', 'qwen/qwen-3.5-plus')).toBeNull();
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

  it('retries gemini once with strict JSON instructions after parse failure', async () => {
    stubDenoEnv({
      GEMINI_API_KEY: 'gemini-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'not-json' }] } }],
          usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22, totalTokenCount: 33 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: '{"tripTitle":"Gemini retry","cities":[],"travelSegments":[],"activities":[]}' }] } }],
          usageMetadata: { promptTokenCount: 44, candidatesTokenCount: 55, totalTokenCount: 99 },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"gemini-retry"}',
      provider: 'gemini',
      model: 'gemini-3-pro-preview',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstInit = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    const firstBody = JSON.parse(String(firstInit.body));
    expect(firstBody.generationConfig.responseMimeType).toBe('application/json');
    expect(firstBody.generationConfig.temperature).toBe(0);
    expect(firstBody.generationConfig).not.toHaveProperty('responseSchema');
    const retryInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const retryBody = JSON.parse(String(retryInit.body));
    expect(retryBody.generationConfig.temperature).toBe(0);
    expect(retryBody.generationConfig).not.toHaveProperty('responseSchema');
    expect(retryBody.contents?.[0]?.parts?.[0]?.text).toContain('IMPORTANT RETRY INSTRUCTIONS');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.tripTitle).toBe('Gemini retry');
  });

  it('includes gemini finishReason metadata on repeated parse failures and enables ultra-compact retry mode', async () => {
    stubDenoEnv({
      GEMINI_API_KEY: 'gemini-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"tripTitle":"Cut' }] } }],
          usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 22, totalTokenCount: 33 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"tripTitle":"Still cut' }] } }],
          usageMetadata: { promptTokenCount: 44, candidatesTokenCount: 55, totalTokenCount: 99 },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"gemini-truncation"}',
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const retryBody = JSON.parse(String(retryInit.body));
    expect(retryBody.contents?.[0]?.parts?.[0]?.text).toContain('TRUNCATION RECOVERY MODE');
    expect(retryBody.contents?.[0]?.parts?.[0]?.text).toContain('Use at most 8 cities and at most 16 activities');

    expect(result.ok).toBe(false);
    if (!('status' in result)) return;
    expect(result.status).toBe(502);
    expect(result.value.code).toBe('GEMINI_PARSE_FAILED');
    expect(result.value.details).toContain('Gemini finishReason=MAX_TOKENS');
    expect(result.value.details).toContain('Likely truncated output');
  });

  it('retries anthropic once with strict JSON instructions after parse failure', async () => {
    stubDenoEnv({
      ANTHROPIC_API_KEY: 'anthropic-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          content: [{ type: 'text', text: 'not-json' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          content: [{ type: 'text', text: '{"tripTitle":"Anthropic retry","cities":[],"travelSegments":[],"activities":[]}' }],
          usage: { input_tokens: 30, output_tokens: 40 },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"anthropic-retry"}',
      provider: 'anthropic',
      model: 'claude-sonnet-4.6',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const retryBody = JSON.parse(String(retryInit.body));
    expect(retryBody.temperature).toBe(0);
    expect(String(retryBody.system)).toContain('exactly one minified JSON object');
    expect(retryBody.messages?.[0]?.content).toContain('IMPORTANT RETRY INSTRUCTIONS');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.tripTitle).toBe('Anthropic retry');
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
      jsonSchema: testStructuredOutputSchema,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://api.openai.com/v1/responses');
    const chatInit = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    const chatBody = JSON.parse(String(chatInit.body));
    expect(chatBody.temperature).toBe(0);
    expect(chatBody.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'travelflow_test_trip',
        strict: true,
        schema: testStructuredOutputSchema.schema,
      },
    });
    const responsesInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const responsesBody = JSON.parse(String(responsesInit.body));
    expect(responsesBody).not.toHaveProperty('temperature');
    expect(responsesBody.max_output_tokens).toBe(12288);
    expect(responsesBody.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'travelflow_test_trip',
        strict: true,
        schema: testStructuredOutputSchema.schema,
      },
    });

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

  it('falls back to OpenAI responses endpoint when chat completions rejects custom temperature', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported.",
              type: 'invalid_request_error',
              param: 'temperature',
              code: 'unsupported_value',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          output_text: '{"tripTitle":"OpenAI temp fallback","cities":[],"travelSegments":[],"activities":[]}',
          usage: {
            input_tokens: 111,
            output_tokens: 222,
            total_tokens: 333,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-temperature-fallback"}',
      provider: 'openai',
      model: 'gpt-5.4',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://api.openai.com/v1/responses');
    const chatInit = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    const chatBody = JSON.parse(String(chatInit.body));
    expect(chatBody.temperature).toBe(0);
    const responsesInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const responsesBody = JSON.parse(String(responsesInit.body));
    expect(responsesBody).not.toHaveProperty('temperature');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.tripTitle).toBe('OpenAI temp fallback');
    expect(result.value.meta.provider).toBe('openai');
    expect(result.value.meta.model).toBe('gpt-5.4');
    expect(result.value.meta.usage).toEqual({
      promptTokens: 111,
      completionTokens: 222,
      totalTokens: 333,
    });
  });

  it('returns an explicit refusal when OpenAI chat completions refuses structured output', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              refusal: "I'm sorry, I cannot assist with that request.",
            },
          },
        ],
        usage: {
          prompt_tokens: 40,
          completion_tokens: 5,
          total_tokens: 45,
        },
      }),
    );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-chat-refusal"}',
      provider: 'openai',
      model: 'gpt-5-nano',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(result.ok).toBe(false);
    if (!('status' in result)) return;
    expect(result.status).toBe(422);
    expect(result.value.code).toBe('OPENAI_REFUSAL');
    expect(result.value.details).toContain('cannot assist');
  });

  it('returns an explicit refusal when OpenAI responses content is a refusal block', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported.",
              type: 'invalid_request_error',
              param: 'temperature',
              code: 'unsupported_value',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'refusal',
                  refusal: "I'm sorry, I cannot assist with that request.",
                },
              ],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 4,
            total_tokens: 14,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-responses-refusal"}',
      provider: 'openai',
      model: 'gpt-5.4',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(result.ok).toBe(false);
    if (!('status' in result)) return;
    expect(result.status).toBe(422);
    expect(result.value.code).toBe('OPENAI_REFUSAL');
    expect(result.value.details).toContain('cannot assist');
  });

  it('returns an explicit incomplete error when OpenAI responses ends before any text content arrives', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported.",
              type: 'invalid_request_error',
              param: 'temperature',
              code: 'unsupported_value',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'incomplete',
          incomplete_details: {
            reason: 'max_output_tokens',
          },
          output: [],
          usage: {
            input_tokens: 100,
            output_tokens: 0,
            total_tokens: 100,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'incomplete',
          incomplete_details: {
            reason: 'max_output_tokens',
          },
          output: [],
          usage: {
            input_tokens: 120,
            output_tokens: 0,
            total_tokens: 120,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-incomplete"}',
      provider: 'openai',
      model: 'gpt-5-mini',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryResponsesInit = (fetchMock.mock.calls[2] as [string, RequestInit])[1];
    const retryResponsesBody = JSON.parse(String(retryResponsesInit.body));
    expect(retryResponsesBody.input[0].content).toContain('exactly one minified JSON object');
    expect(retryResponsesBody.input[1].content).toContain('IMPORTANT RETRY INSTRUCTIONS');
    expect(retryResponsesBody.input[1].content).toContain('TRUNCATION RECOVERY MODE');

    expect(result.ok).toBe(false);
    if (!('status' in result)) return;
    expect(result.status).toBe(502);
    expect(result.value.code).toBe('OPENAI_RESPONSE_INCOMPLETE');
    expect(result.value.details).toContain('max_output_tokens');
  });

  it('retries OpenAI responses with compact strict instructions after incomplete output and then succeeds', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported.",
              type: 'invalid_request_error',
              param: 'temperature',
              code: 'unsupported_value',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'incomplete',
          incomplete_details: {
            reason: 'max_output_tokens',
          },
          output: [],
          usage: {
            input_tokens: 100,
            output_tokens: 0,
            total_tokens: 100,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          output_text: '{"tripTitle":"OpenAI recovered","cities":[],"travelSegments":[],"activities":[]}',
          usage: {
            input_tokens: 90,
            output_tokens: 120,
            total_tokens: 210,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-incomplete-then-success"}',
      provider: 'openai',
      model: 'gpt-5-nano',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryResponsesInit = (fetchMock.mock.calls[2] as [string, RequestInit])[1];
    const retryResponsesBody = JSON.parse(String(retryResponsesInit.body));
    expect(retryResponsesBody.input[0].content).toContain('exactly one minified JSON object');
    expect(retryResponsesBody.input[1].content).toContain('IMPORTANT RETRY INSTRUCTIONS');
    expect(retryResponsesBody.input[1].content).toContain('TRUNCATION RECOVERY MODE');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.tripTitle).toBe('OpenAI recovered');
    expect(result.value.meta.usage).toEqual({
      promptTokens: 90,
      completionTokens: 120,
      totalTokens: 210,
    });
  });

  it('accepts structured objects already parsed on the OpenAI responses payload', async () => {
    stubDenoEnv({
      OPENAI_API_KEY: 'openai-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported.",
              type: 'invalid_request_error',
              param: 'temperature',
              code: 'unsupported_value',
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          status: 'completed',
          output_parsed: {
            tripTitle: 'Parsed object itinerary',
            cities: [],
            travelSegments: [],
            activities: [],
          },
          usage: {
            input_tokens: 12,
            output_tokens: 34,
            total_tokens: 46,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-output-parsed"}',
      provider: 'openai',
      model: 'gpt-5-mini',
      timeoutMs: 30_000,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.tripTitle).toBe('Parsed object itinerary');
    expect(result.value.meta.usage).toEqual({
      promptTokens: 12,
      completionTokens: 34,
      totalTokens: 46,
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

  it('routes perplexity and qwen providers via openrouter while preserving provider id', async () => {
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'perplexity/sonar',
          choices: [{ message: { content: '{"title":"Perplexity"}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          model: 'qwen/qwen3.5-plus-02-15',
          choices: [{ message: { content: '{"title":"Qwen"}' } }],
          usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
        }),
      );

    const perplexityResult = await generateProviderItinerary({
      prompt: '{"request":"perplexity"}',
      provider: 'perplexity',
      model: 'perplexity/sonar',
      timeoutMs: 30_000,
    });
    const qwenResult = await generateProviderItinerary({
      prompt: '{"request":"qwen"}',
      provider: 'qwen',
      model: 'qwen/qwen-3.5-plus',
      timeoutMs: 30_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    const perplexityRequest = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    const perplexityBody = JSON.parse(String(perplexityRequest.body));
    expect(perplexityBody.model).toBe('perplexity/sonar');
    expect(perplexityBody.response_format?.type).toBe('text');
    const qwenRequest = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const qwenBody = JSON.parse(String(qwenRequest.body));
    expect(qwenBody.model).toBe('qwen/qwen3.5-plus-02-15');
    expect(qwenBody.response_format?.type).toBe('text');

    expect(perplexityResult.ok).toBe(true);
    if (perplexityResult.ok) {
      expect(perplexityResult.value.meta.provider).toBe('perplexity');
      expect(perplexityResult.value.meta.model).toBe('perplexity/sonar');
    }

    expect(qwenResult.ok).toBe(true);
    if (qwenResult.ok) {
      expect(qwenResult.value.meta.provider).toBe('qwen');
      expect(qwenResult.value.meta.model).toBe('qwen/qwen3.5-plus-02-15');
    }
  });

  it('passes maxOutputTokens override through to provider requests', async () => {
    stubDenoEnv({
      OPENROUTER_API_KEY: 'test-key',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        model: 'openrouter/free',
        choices: [{ message: { content: '{"title":"Token override"}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    );

    const result = await generateProviderItinerary({
      prompt: '{"request":"demo"}',
      provider: 'openrouter',
      model: 'openrouter/free',
      timeoutMs: 30_000,
      maxOutputTokens: 2048,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    const body = JSON.parse(String(init.body));
    expect(body.max_tokens).toBe(2048);
    expect(result.ok).toBe(true);
  });

  it('preserves explicit maxOutputTokens for OpenAI structured output requests', async () => {
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
          output_text: '{"tripTitle":"Explicit override","cities":[],"travelSegments":[],"activities":[]}',
          usage: {
            input_tokens: 12,
            output_tokens: 34,
            total_tokens: 46,
          },
        }),
      );

    const result = await generateProviderItinerary({
      prompt: '{"request":"openai-explicit-override"}',
      provider: 'openai',
      model: 'gpt-5.2',
      timeoutMs: 30_000,
      maxOutputTokens: 2_048,
      jsonSchema: testStructuredOutputSchema,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const responsesInit = (fetchMock.mock.calls[1] as [string, RequestInit])[1];
    const responsesBody = JSON.parse(String(responsesInit.body));
    expect(responsesBody.max_output_tokens).toBe(2048);
    expect(result.ok).toBe(true);
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
