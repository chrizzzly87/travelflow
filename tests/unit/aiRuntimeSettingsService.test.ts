import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultCreateTripModel } from '../../config/aiModelCatalog';
import {
  applyAiRuntimeSettings,
  createRuntimeModelPlaceholder,
  normalizeAiRuntimeSettings,
  resetAiRuntimeSettingsCacheForTests,
} from '../../services/aiRuntimeSettingsService';

describe('aiRuntimeSettingsService', () => {
  afterEach(() => resetAiRuntimeSettingsCacheForTests());

  it('normalizes the public runtime settings row and clamps the age threshold', () => {
    expect(normalizeAiRuntimeSettings([{
      ai_default_model_id: 'openrouter:google/gemini-3.7-flash',
      ai_approved_openrouter_models: ['google/gemini-3.7-flash', 'google/gemini-3.7-flash', ''],
      ai_model_max_age_months: 99,
      ai_show_older_models: true,
      updated_at: '2026-08-17T12:00:00Z',
    }])).toEqual({
      defaultModelId: 'openrouter:google/gemini-3.7-flash',
      approvedOpenRouterModels: ['google/gemini-3.7-flash'],
      modelMaxAgeMonths: 36,
      showOlderModels: true,
      updatedAt: '2026-08-17T12:00:00Z',
    });
  });

  it('registers an approved live OpenRouter default for frontend trip creation', () => {
    const settings = normalizeAiRuntimeSettings({
      ai_default_model_id: 'openrouter:moonshotai/kimi-k3',
      ai_approved_openrouter_models: ['moonshotai/kimi-k3'],
      ai_model_max_age_months: 6,
    });

    applyAiRuntimeSettings(settings, [createRuntimeModelPlaceholder(settings.defaultModelId)!]);

    expect(getDefaultCreateTripModel().id).toBe('openrouter:moonshotai/kimi-k3');
  });

  it('rejects placeholders for non-OpenRouter providers', () => {
    expect(createRuntimeModelPlaceholder('openai:gpt-5.4')).toBeNull();
    expect(createRuntimeModelPlaceholder('not-an-id')).toBeNull();
  });
});
