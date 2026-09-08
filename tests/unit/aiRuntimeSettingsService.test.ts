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
      tripAgentEnabled: false,
      tripAgentAdminPreview: true,
      mapDefaultStyle: 'standard',
      mapRuntimePreset: 'google_all',
      plannerBetaOpen: false,
      updatedAt: '2026-08-17T12:00:00Z',
    });
  });

  it('reads the admin map default and rejects an unknown style', () => {
    expect(normalizeAiRuntimeSettings([{ map_default_style: 'cleanDark' }])).toMatchObject({ mapDefaultStyle: 'cleanDark' });
    expect(normalizeAiRuntimeSettings([{ map_default_style: 'google' }])).toMatchObject({ mapDefaultStyle: 'standard' });
  });

  it('reads the map provider preset and rejects an unknown one', () => {
    expect(normalizeAiRuntimeSettings([{ map_runtime_preset: 'mapbox_visual_google_services' }]))
      .toMatchObject({ mapRuntimePreset: 'mapbox_visual_google_services' });
    expect(normalizeAiRuntimeSettings([{ map_runtime_preset: 'osm' }]))
      .toMatchObject({ mapRuntimePreset: 'google_all' });
  });

  it('reads the Trip Agent rollout flags, and falls back to admin-only when the row predates them', () => {
    expect(normalizeAiRuntimeSettings([{ trip_agent_enabled: true, trip_agent_admin_preview: false }]))
      .toMatchObject({ tripAgentEnabled: true, tripAgentAdminPreview: false });
    expect(normalizeAiRuntimeSettings([{}]))
      .toMatchObject({ tripAgentEnabled: false, tripAgentAdminPreview: true });
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
