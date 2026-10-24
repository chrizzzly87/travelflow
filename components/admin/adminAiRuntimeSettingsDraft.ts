import { normalizeAiRuntimeSettings, type AiRuntimeSettings } from '../../services/aiRuntimeSettingsService';

/**
 * Settings the AI benchmark page holds before the server answers. Saving from
 * here posts and applies the whole object, so every field — map style and
 * runtime preset included — starts at the service defaults instead of
 * `undefined`.
 */
export const buildInitialAdminAiRuntimeSettings = (defaultModelId: string): AiRuntimeSettings => ({
    ...normalizeAiRuntimeSettings(null),
    defaultModelId,
});
