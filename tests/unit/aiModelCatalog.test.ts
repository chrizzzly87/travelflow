import { describe, expect, it } from 'vitest';
import {
  AI_MODEL_CATALOG,
  getCurrentRuntimeModel,
  getDefaultCreateTripModel,
  groupAiModelsByProvider,
  sortAiModels,
} from '../../config/aiModelCatalog';

describe('config/aiModelCatalog', () => {
  it('includes latest provider additions and curated openrouter alternatives', () => {
    const modelIds = new Set(AI_MODEL_CATALOG.map((item) => item.id));

    expect(modelIds.has('gemini:gemini-3.1-pro-preview')).toBe(true);
    expect(modelIds.has('openai:gpt-5.2-pro')).toBe(true);
    expect(modelIds.has('anthropic:claude-sonnet-4.6')).toBe(true);
    expect(modelIds.has('openrouter:openrouter/free')).toBe(true);
    expect(modelIds.has('openrouter:openai/gpt-oss-20b:free')).toBe(true);
    expect(modelIds.has('openrouter:z-ai/glm-5')).toBe(true);
    expect(modelIds.has('openrouter:deepseek/deepseek-v3.2')).toBe(true);
    expect(modelIds.has('openrouter:x-ai/grok-4.1-fast')).toBe(true);
    expect(modelIds.has('openrouter:minimax/minimax-m2.5')).toBe(true);
    expect(modelIds.has('openrouter:moonshotai/kimi-k2.5')).toBe(true);
    expect(modelIds.has('perplexity:perplexity/sonar')).toBe(true);
    expect(modelIds.has('perplexity:perplexity/sonar-pro')).toBe(true);
    expect(modelIds.has('qwen:qwen/qwen-3.5-plus')).toBe(true);
    expect(modelIds.has('qwen:qwen/qwen-3.5')).toBe(true);
  });

  it('keeps runtime/default model wiring intact', () => {
    const runtime = getCurrentRuntimeModel();
    const defaultModel = getDefaultCreateTripModel();

    expect(runtime?.id).toBe('gemini:gemini-3-pro-preview');
    expect(defaultModel.id).toBe('gemini:gemini-3-pro-preview');
    expect(defaultModel.isCurrentRuntime).toBe(true);
  });

  it('sorts openrouter after direct providers and new provider families', () => {
    const sorted = sortAiModels(AI_MODEL_CATALOG);
    const providerOrder = sorted.map((item) => item.provider);

    const firstOpenRouterIndex = providerOrder.indexOf('openrouter');
    const lastQwenIndex = providerOrder.lastIndexOf('qwen');

    expect(firstOpenRouterIndex).toBeGreaterThan(-1);
    expect(lastQwenIndex).toBeGreaterThan(-1);
    expect(firstOpenRouterIndex).toBeGreaterThan(lastQwenIndex);
  });

  it('groups entries by provider label', () => {
    const grouped = groupAiModelsByProvider(AI_MODEL_CATALOG);
    expect(grouped['Google Gemini']?.length).toBeGreaterThan(0);
    expect(grouped.OpenAI?.length).toBeGreaterThan(0);
    expect(grouped.Anthropic?.length).toBeGreaterThan(0);
    expect(grouped.Perplexity?.length).toBeGreaterThan(0);
    expect(grouped.Qwen?.length).toBeGreaterThan(0);
    expect(grouped.OpenRouter?.length).toBeGreaterThan(0);
    expect(grouped['OpenRouter (Free)']?.length).toBeGreaterThan(0);
  });
});
