import { describe, expect, it } from 'vitest';
// @ts-expect-error The audit helper is an executable ESM script without a declaration file.
import {
  compareOpenRouterCatalog,
  extractOpenRouterAllowlist,
  extractStaticOpenRouterIds,
  isCompatibleOpenRouterCandidate,
} from '../../scripts/check-models.mjs';

const compatibleModel = {
  id: 'openai/gpt-6-luna',
  created: Date.parse('2026-09-22T00:00:00Z') / 1000,
  context_length: 1_050_000,
  architecture: { input_modalities: ['text'], output_modalities: ['text'] },
  supported_parameters: ['reasoning_effort', 'response_format', 'structured_outputs'],
  pricing: { prompt: '0.0000001', completion: '0.0000005' },
  expiration_date: null,
};

describe('scripts/check-models', () => {
  it('extracts runtime and static OpenRouter identifiers', () => {
    expect(extractOpenRouterAllowlist(`openrouter: new Set(["openai/gpt-6-luna", "x-ai/grok-4.7"])`)).toEqual([
      'openai/gpt-6-luna',
      'x-ai/grok-4.7',
    ]);
    expect(extractStaticOpenRouterIds(`id: 'openrouter:openai/gpt-6-luna'`)).toEqual(['openai/gpt-6-luna']);
  });

  it('requires stable text-only structured-output models', () => {
    const now = new Date('2026-10-09T00:00:00Z');
    expect(isCompatibleOpenRouterCandidate(compatibleModel, now)).toBe(true);
    expect(isCompatibleOpenRouterCandidate({ ...compatibleModel, id: 'openai/gpt-latest' }, now)).toBe(false);
    expect(isCompatibleOpenRouterCandidate({
      ...compatibleModel,
      architecture: { input_modalities: ['text'], output_modalities: ['text', 'image'] },
    }, now)).toBe(false);
    expect(isCompatibleOpenRouterCandidate({
      ...compatibleModel,
      expiration_date: '2026-10-01T00:00:00Z',
    }, now)).toBe(false);
  });

  it('reports new, unavailable, and stale runtime models without exposing credentials', () => {
    const report = compareOpenRouterCatalog({
      models: [compatibleModel],
      allowlistedIds: ['missing/model'],
      staticIds: ['missing/model'],
      now: new Date('2026-10-09T00:00:00Z'),
      staleMonths: 6,
    });

    expect(report.newCompatible).toEqual([expect.objectContaining({ id: 'openai/gpt-6-luna' })]);
    expect(report.unavailableConfigured).toEqual(['missing/model']);
    expect(report.staticFallbackWithoutAllowlist).toEqual([]);
  });
});
