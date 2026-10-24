import { describe, expect, it } from 'vitest';

import { buildInitialAdminAiRuntimeSettings } from '../../components/admin/adminAiRuntimeSettingsDraft';

describe('components/admin/adminAiRuntimeSettingsDraft', () => {
  it('starts every runtime setting at a defined default so an early save cannot apply undefined map settings', () => {
    const settings = buildInitialAdminAiRuntimeSettings('openai:gpt-test');

    expect(settings).toEqual({
      defaultModelId: 'openai:gpt-test',
      approvedOpenRouterModels: [],
      modelMaxAgeMonths: 6,
      showOlderModels: false,
      tripAgentEnabled: false,
      tripAgentAdminPreview: true,
      mapDefaultStyle: 'standard',
      mapRuntimePreset: 'google_all',
      plannerBetaOpen: false,
      updatedAt: null,
    });
  });
});
