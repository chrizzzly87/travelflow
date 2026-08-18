import { describe, expect, it, vi } from 'vitest';
import {
  fetchOpenRouterCatalog,
  isAiModelOlderThanMonths,
  isTravelFlowCompatibleOpenRouterModel,
  mergeAiModelCatalogs,
  normalizeOpenRouterCatalogResponse,
} from '../../services/openRouterModelCatalogService';

const compatibleModel = {
  id: 'google/gemini-3.7-flash',
  name: 'Google: Gemini 3.7 Flash',
  created: 1786640581,
  context_length: 1_048_576,
  expiration_date: null,
  architecture: { output_modalities: ['text'] },
  supported_parameters: ['response_format', 'structured_outputs', 'tools', 'tool_choice', 'reasoning'],
  reasoning: {
    mandatory: true,
    default_enabled: true,
    supported_efforts: ['high', 'medium', 'low'],
    default_effort: 'medium',
  },
  pricing: { prompt: '0.000000375', completion: '0.000001875' },
};

describe('openRouterModelCatalogService', () => {
  it('normalizes compatible live models with capabilities and per-million pricing', () => {
    const models = normalizeOpenRouterCatalogResponse({ data: [compatibleModel] });

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: 'openrouter:google/gemini-3.7-flash',
      providerLabel: 'Google Gemini',
      model: 'google/gemini-3.7-flash',
      label: 'Gemini 3.7 Flash',
      supportsStructuredOutput: true,
      supportsTools: true,
      supportsReasoning: true,
      reasoningEfforts: ['high', 'medium', 'low'],
      defaultReasoningEffort: 'medium',
      reasoningMandatory: true,
      inputPricePerMillion: 0.375,
      outputPricePerMillion: 1.875,
    });
  });

  it('rejects batch, image-output, expired, and non-structured models', () => {
    expect(isTravelFlowCompatibleOpenRouterModel({ ...compatibleModel, id: 'google/gemini-3.7-flash:batch' })).toBe(false);
    expect(isTravelFlowCompatibleOpenRouterModel({
      ...compatibleModel,
      architecture: { output_modalities: ['text', 'image'] },
    })).toBe(false);
    expect(isTravelFlowCompatibleOpenRouterModel({
      ...compatibleModel,
      expiration_date: '2026-01-01T00:00:00Z',
    }, new Date('2026-08-17T00:00:00Z'))).toBe(false);
    expect(isTravelFlowCompatibleOpenRouterModel({
      ...compatibleModel,
      supported_parameters: ['response_format'],
    })).toBe(false);
  });

  it('lets static metadata override matching live metadata while preserving new live models', () => {
    const live = normalizeOpenRouterCatalogResponse({ data: [compatibleModel] });
    const merged = mergeAiModelCatalogs([{
      ...live[0],
      label: 'Reviewed Gemini label',
      catalogSource: undefined,
    }], live);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.label).toBe('Reviewed Gemini label');
  });

  it('applies a calendar-month freshness threshold', () => {
    const now = new Date('2026-08-17T00:00:00Z');
    expect(isAiModelOlderThanMonths({ releasedAt: '2026-02-16' }, 6, now)).toBe(true);
    expect(isAiModelOlderThanMonths({ releasedAt: '2026-02-17' }, 6, now)).toBe(false);
  });

  it('uses the authenticated user catalog when an API key is available', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [compatibleModel] }), { status: 200 }));
    const models = await fetchOpenRouterCatalog('secret', fetchMock as typeof fetch);

    expect(models).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models/user',
      { headers: { Authorization: 'Bearer secret' } },
    );
  });
});
