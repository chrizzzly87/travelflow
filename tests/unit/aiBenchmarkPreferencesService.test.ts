import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_DEFAULT_MODEL_IDS,
  createSystemBenchmarkPresets,
  normalizeBenchmarkPreferencesPayload,
  normalizeBenchmarkPresetConfigs,
  normalizeModelTargetIds,
} from '../../services/aiBenchmarkPreferencesService';

describe('services/aiBenchmarkPreferencesService', () => {
  it('builds three system presets with injected default dates', () => {
    const presets = createSystemBenchmarkPresets('2026-03-01', '2026-03-15');

    expect(presets).toHaveLength(3);
    expect(presets.map((preset) => preset.id)).toEqual([
      'system-southeast-asia-loop',
      'system-northern-germany',
      'system-japan-classic',
    ]);
    expect(presets.every((preset) => preset.scenario.startDate === '2026-03-01')).toBe(true);
    expect(presets.every((preset) => preset.scenario.endDate === '2026-03-15')).toBe(true);
  });

  it('normalizes model target IDs with dedupe, filtering, and fallback', () => {
    const allowed = new Set([
      'gemini:gemini-3.1-pro-preview',
      'openai:gpt-5.2-pro',
    ]);

    const normalized = normalizeModelTargetIds(
      ['gemini:gemini-3.1-pro-preview', 'invalid:model', 'gemini:gemini-3.1-pro-preview', 'openai:gpt-5.2-pro'],
      {
        allowedModelIds: allowed,
        fallbackModelIds: ['openai:gpt-5.2-pro'],
      },
    );

    expect(normalized).toEqual(['gemini:gemini-3.1-pro-preview', 'openai:gpt-5.2-pro']);

    const fallbackOnly = normalizeModelTargetIds(['invalid:model'], {
      allowedModelIds: allowed,
      fallbackModelIds: ['openai:gpt-5.2-pro'],
    });
    expect(fallbackOnly).toEqual(['openai:gpt-5.2-pro']);
  });

  it('normalizes preset configs and falls back when payload is invalid', () => {
    const fallback = createSystemBenchmarkPresets('2026-04-01', '2026-04-20');
    const normalized = normalizeBenchmarkPresetConfigs(
      [
        {
          id: 'custom-one',
          name: 'Custom One',
          description: 'saved preset',
          kind: 'custom',
          scenario: {
            destinations: 'Lisbon, Porto',
            dateInputMode: 'flex',
            flexWeeks: 2,
            flexWindow: 'autumn',
            budget: 'Medium',
            pace: 'Balanced',
            roundTrip: true,
            routeLock: false,
            travelerSetup: 'friends',
            tripStyleMask: 'culture_focused',
            transportMask: 'train',
          },
        },
      ],
      {
        fallbackPresets: fallback,
        defaultStartDate: '2026-04-01',
        defaultEndDate: '2026-04-20',
      },
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.id).toBe('custom-one');
    expect(normalized[0]?.scenario.destinations).toBe('Lisbon, Porto');
    expect(normalized[0]?.scenario.startDate).toBe('2026-04-01');
    expect(normalized[0]?.scenario.endDate).toBe('2026-04-20');

    const fallbackResult = normalizeBenchmarkPresetConfigs('not-an-array', { fallbackPresets: fallback });
    expect(fallbackResult).toEqual(fallback);
  });

  it('normalizes full preference payload and repairs missing selected preset', () => {
    const fallbackPresets = createSystemBenchmarkPresets('2026-05-10', '2026-05-24');
    const allowed = new Set(BENCHMARK_DEFAULT_MODEL_IDS);

    const payload = normalizeBenchmarkPreferencesPayload(
      {
        modelTargets: ['openai:gpt-5.2-pro', 'invalid:model'],
        presets: fallbackPresets,
        selectedPresetId: 'unknown-id',
      },
      {
        fallbackPresets,
        fallbackModelIds: ['gemini:gemini-3.1-pro-preview'],
        allowedModelIds: allowed,
      },
    );

    expect(payload.modelTargets).toEqual(['openai:gpt-5.2-pro']);
    expect(payload.selectedPresetId).toBe(fallbackPresets[0]?.id);
    expect(payload.presets).toEqual(fallbackPresets);
  });
});
