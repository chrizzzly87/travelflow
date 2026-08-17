import { describe, expect, it } from 'vitest';
import {
  AI_MODEL_CATALOG,
  CREATE_TRIP_PREFERRED_MODEL_IDS,
  getCurrentRuntimeModel,
  getCreateTripModelOptions,
  getDefaultCreateTripModel,
  groupAiModelsByProvider,
  sortAiModels,
} from '../../config/aiModelCatalog';
import { BENCHMARK_DEFAULT_MODEL_IDS } from '../../services/aiBenchmarkPreferencesService';
import { PROVIDER_ALLOWLIST } from '../../netlify/edge-lib/ai-provider-runtime';

describe('config/aiModelCatalog', () => {
  it('includes latest provider additions and curated openrouter alternatives', () => {
    const modelIds = new Set(AI_MODEL_CATALOG.map((item) => item.id));

    expect(modelIds.has('gemini:gemini-3.1-pro-preview')).toBe(true);
    expect(modelIds.has('gemini:gemini-3.1-flash-lite-preview')).toBe(true);
    expect(modelIds.has('openai:gpt-5.2-pro')).toBe(true);
    expect(modelIds.has('openai:gpt-5.4')).toBe(true);
    expect(modelIds.has('openai:gpt-5.4-pro')).toBe(true);
    expect(modelIds.has('anthropic:claude-sonnet-4.6')).toBe(true);
    expect(modelIds.has('openrouter:openrouter/free')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-oss-20b:free')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.4-nano')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.4-mini')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.5')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.6-sol')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.6-sol-pro')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.6-terra')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.6-terra-pro')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.6-luna')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-5.6-luna-pro')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-chat-latest')).toBe(true);
    expect(modelIds.has('openrouter:anthropic/claude-opus-4.8')).toBe(true);
    expect(modelIds.has('openrouter:anthropic/claude-opus-4.8-fast')).toBe(true);
    expect(modelIds.has('openrouter:anthropic/claude-opus-5')).toBe(true);
    expect(modelIds.has('openrouter:anthropic/claude-sonnet-5')).toBe(true);
    expect(modelIds.has('openrouter:google/gemini-3.5-flash')).toBe(true);
    expect(modelIds.has('openrouter:google/gemini-3.1-flash-lite')).toBe(true);
    expect(modelIds.has('openrouter:nvidia/nemotron-3-super-120b-a12b:free')).toBe(true);
    expect(modelIds.has('openrouter:z-ai/glm-5')).toBe(true);
    expect(modelIds.has('openrouter:z-ai/glm-5.2')).toBe(true);
    expect(modelIds.has('openrouter:deepseek/deepseek-v3.2')).toBe(true);
    expect(modelIds.has('openrouter:deepseek/deepseek-v4-pro-0813')).toBe(true);
    expect(modelIds.has('openrouter:deepseek/deepseek-v4-flash-0731')).toBe(true);
    expect(modelIds.has('openrouter:x-ai/grok-4.3')).toBe(true);
    expect(modelIds.has('openrouter:x-ai/grok-4.5')).toBe(true);
    expect(modelIds.has('openrouter:x-ai/grok-4.6')).toBe(true);
    expect(modelIds.has('openrouter:x-ai/grok-4.20')).toBe(true);
    expect(modelIds.has('openrouter:x-ai/grok-4.1-fast')).toBe(false);
    expect(modelIds.has('openrouter:x-ai/grok-4.20-beta')).toBe(false);
    expect(modelIds.has('openrouter:minimax/minimax-m2.5')).toBe(true);
    expect(modelIds.has('openrouter:moonshotai/kimi-k2.5')).toBe(true);
    expect(modelIds.has('openrouter:qwen/qwen3.5-9b')).toBe(true);
    expect(modelIds.has('openrouter:qwen/qwen3.5-plus-20260420')).toBe(true);
    expect(modelIds.has('perplexity:perplexity/sonar')).toBe(true);
    expect(modelIds.has('perplexity:perplexity/sonar-pro')).toBe(true);
    expect(modelIds.has('qwen:qwen/qwen3.5-plus-02-15')).toBe(true);
    expect(modelIds.has('qwen:qwen/qwen3.5-397b-a17b')).toBe(true);
  });

  it('keeps runtime/default model wiring intact', () => {
    const runtime = getCurrentRuntimeModel();
    const defaultModel = getDefaultCreateTripModel();

    expect(runtime?.id).toBe('openai:gpt-5.4');
    expect(defaultModel.id).toBe('openai:gpt-5.4');
    expect(defaultModel.isCurrentRuntime).toBe(true);
  });

  it('sorts model families with OpenAI first even when a model is served through OpenRouter', () => {
    const sorted = sortAiModels(AI_MODEL_CATALOG);
    const providerLabelOrder = sorted.map((item) => item.providerLabel);

    expect(providerLabelOrder[0]).toBe('OpenAI');
    expect(sorted.find((item) => item.id === 'openrouter:openai/gpt-5.5')?.providerLabel).toBe('OpenAI');
    expect(sorted.findIndex((item) => item.id === 'openrouter:openai/gpt-5.6-sol')).toBeLessThan(
      sorted.findIndex((item) => item.id === 'openrouter:openai/gpt-5.5')
    );
    expect(sorted.findIndex((item) => item.id === 'openrouter:anthropic/claude-opus-4.8')).toBeLessThan(
      sorted.findIndex((item) => item.id === 'anthropic:claude-opus-4.6')
    );
    expect(sorted.findIndex((item) => item.id === 'openrouter:anthropic/claude-opus-5')).toBeLessThan(
      sorted.findIndex((item) => item.id === 'openrouter:anthropic/claude-opus-4.8')
    );
    expect(sorted.find((item) => item.id === 'openrouter:google/gemini-3.5-flash')?.providerLabel).toBe('Google Gemini');
    expect(sorted.find((item) => item.id === 'openrouter:x-ai/grok-4.3')?.providerLabel).toBe('xAI');
    expect(sorted.find((item) => item.id === 'openrouter:qwen/qwen3.5-plus-20260420')?.providerLabel).toBe('Qwen');

    expect(providerLabelOrder.indexOf('OpenAI')).toBeLessThan(providerLabelOrder.indexOf('Google Gemini'));
  });

  it('groups entries by model family label instead of routing gateway label', () => {
    const grouped = groupAiModelsByProvider(AI_MODEL_CATALOG);
    expect(grouped['Google Gemini']?.length).toBeGreaterThan(0);
    expect(grouped.OpenAI?.length).toBeGreaterThan(0);
    expect(grouped.Anthropic?.length).toBeGreaterThan(0);
    expect(grouped.Perplexity?.length).toBeGreaterThan(0);
    expect(grouped.Qwen?.length).toBeGreaterThan(0);
    expect(grouped.xAI?.map((item) => item.id)).toContain('openrouter:x-ai/grok-4.3');
    expect(grouped['OpenRouter (Free)']?.length).toBeGreaterThan(0);
    expect(grouped['OpenRouter (Free)']?.map((item) => item.id)).toEqual(['openrouter:openrouter/free']);
    expect(grouped.OpenAI?.map((item) => item.id)).toContain('openrouter:openai/gpt-5.5');
    expect(grouped['Google Gemini']?.map((item) => item.id)).toEqual(expect.arrayContaining([
      'openrouter:google/gemini-3.5-flash',
      'openrouter:google/gemini-3.1-flash-lite',
    ]));
    expect(grouped.Qwen?.map((item) => item.id)).toContain('openrouter:qwen/qwen3.5-plus-20260420');
    expect(grouped.OpenRouter).toBeUndefined();
  });

  it('prioritizes create-trip preferred models and keeps full active coverage', () => {
    const options = getCreateTripModelOptions(AI_MODEL_CATALOG);
    const activeIds = AI_MODEL_CATALOG
      .filter((item) => item.availability === 'active')
      .map((item) => item.id);
    const uniqueActiveIds = new Set(activeIds);

    expect(options.slice(0, CREATE_TRIP_PREFERRED_MODEL_IDS.length).map((item) => item.id)).toEqual(
      [...CREATE_TRIP_PREFERRED_MODEL_IDS]
    );
    expect([...CREATE_TRIP_PREFERRED_MODEL_IDS]).toEqual(expect.arrayContaining([
      'openrouter:openai/gpt-5.5',
      'openrouter:openai/gpt-5.6-sol',
      'openrouter:openai/gpt-5.6-luna-pro',
      'openrouter:openai/gpt-5.6-terra-pro',
      'openrouter:openai/gpt-5.6-sol-pro',
      'openrouter:anthropic/claude-opus-4.8',
      'openrouter:anthropic/claude-opus-5',
      'openrouter:anthropic/claude-sonnet-5',
      'openrouter:openai/gpt-chat-latest',
      'openrouter:x-ai/grok-4.5',
      'openrouter:x-ai/grok-4.6',
      'openrouter:z-ai/glm-5.2',
      'openrouter:deepseek/deepseek-v4-pro-0813',
      'openrouter:deepseek/deepseek-v4-flash-0731',
      'openrouter:google/gemini-3.5-flash',
      'openrouter:google/gemini-3.1-flash-lite',
      'openrouter:x-ai/grok-4.3',
      'openrouter:qwen/qwen3.5-plus-20260420',
    ]));
    expect(new Set(options.map((item) => item.id))).toEqual(uniqueActiveIds);
    expect(options).toHaveLength(uniqueActiveIds.size);
  });

  it('keeps default benchmark targets aligned with catalog entries', () => {
    const activeIds = new Set(
      AI_MODEL_CATALOG
        .filter((item) => item.availability === 'active')
        .map((item) => item.id)
    );

    expect(BENCHMARK_DEFAULT_MODEL_IDS.every((modelId) => activeIds.has(modelId))).toBe(true);
  });

  it('keeps active OpenRouter picker models aligned with the server allowlist', () => {
    const activeOpenRouterModels = AI_MODEL_CATALOG
      .filter((item) => item.provider === 'openrouter' && item.availability === 'active')
      .map((item) => item.model);

    expect(activeOpenRouterModels.every((model) => PROVIDER_ALLOWLIST.openrouter.has(model))).toBe(true);
  });
});
