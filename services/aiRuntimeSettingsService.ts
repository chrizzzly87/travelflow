import {
    DEFAULT_CREATE_TRIP_MODEL_ID,
    getAiModelById,
    registerRuntimeAiModels,
    setRuntimeDefaultCreateTripModelId,
    type AiModelCatalogItem,
} from '../config/aiModelCatalog';
import { supabase } from './supabaseClient';

export interface AiRuntimeSettings {
    defaultModelId: string;
    approvedOpenRouterModels: string[];
    modelMaxAgeMonths: number;
    showOlderModels: boolean;
    updatedAt: string | null;
}

const DEFAULT_AI_RUNTIME_SETTINGS: AiRuntimeSettings = {
    defaultModelId: DEFAULT_CREATE_TRIP_MODEL_ID,
    approvedOpenRouterModels: [],
    modelMaxAgeMonths: 6,
    showOlderModels: false,
    updatedAt: null,
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const firstRecord = (value: unknown): UnknownRecord => {
    if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : {};
    return isRecord(value) ? value : {};
};

const normalizeModelIdList = (value: unknown): string[] => {
    const list = Array.isArray(value) ? value : [];
    return list
        .flatMap((entry) => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []))
        .filter((entry, index, array) => array.indexOf(entry) === index);
};

export const normalizeAiRuntimeSettings = (value: unknown): AiRuntimeSettings => {
    const row = firstRecord(value);
    const defaultModelId = typeof row.ai_default_model_id === 'string' && row.ai_default_model_id.includes(':')
        ? row.ai_default_model_id.trim()
        : DEFAULT_AI_RUNTIME_SETTINGS.defaultModelId;
    const rawAge = Number(row.ai_model_max_age_months);

    return {
        defaultModelId,
        approvedOpenRouterModels: normalizeModelIdList(row.ai_approved_openrouter_models),
        modelMaxAgeMonths: Number.isFinite(rawAge) ? Math.max(1, Math.min(36, Math.round(rawAge))) : 6,
        showOlderModels: row.ai_show_older_models === true,
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
    };
};

const humanizeModelId = (model: string): string => model
    .split('/').pop()
    ?.replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    || model;

export const createRuntimeModelPlaceholder = (id: string): AiModelCatalogItem | null => {
    const separatorIndex = id.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === id.length - 1) return null;
    const provider = id.slice(0, separatorIndex) as AiModelCatalogItem['provider'];
    const model = id.slice(separatorIndex + 1);
    if (provider !== 'openrouter') return null;
    return {
        id,
        provider,
        providerLabel: model.split('/')[0] || 'OpenRouter',
        providerShortName: 'OpenRouter',
        model,
        label: humanizeModelId(model),
        availability: 'active',
        releasedAt: new Date().toISOString().slice(0, 10),
        estimatedCostPerQueryLabel: 'Live pricing',
        costNote: 'Loaded from the approved OpenRouter runtime settings.',
    };
};

export const applyAiRuntimeSettings = (
    settings: AiRuntimeSettings,
    catalogModels: AiModelCatalogItem[] = [],
): AiRuntimeSettings => {
    registerRuntimeAiModels(catalogModels);
    if (!getAiModelById(settings.defaultModelId)) {
        const placeholder = createRuntimeModelPlaceholder(settings.defaultModelId);
        if (placeholder) registerRuntimeAiModels([placeholder]);
    }
    setRuntimeDefaultCreateTripModelId(settings.defaultModelId);
    return settings;
};

let runtimeSettingsPromise: Promise<AiRuntimeSettings> | null = null;

export const loadPublicAiRuntimeSettings = async (): Promise<AiRuntimeSettings> => {
    if (runtimeSettingsPromise) return runtimeSettingsPromise;
    runtimeSettingsPromise = (async () => {
        if (!supabase) return applyAiRuntimeSettings(DEFAULT_AI_RUNTIME_SETTINGS);
        const { data, error } = await supabase.rpc('get_public_runtime_settings');
        if (error) {
            console.warn('Could not load public AI runtime settings; using the code default.', error);
            return applyAiRuntimeSettings(DEFAULT_AI_RUNTIME_SETTINGS);
        }
        return applyAiRuntimeSettings(normalizeAiRuntimeSettings(data));
    })();
    return runtimeSettingsPromise;
};

export const resetAiRuntimeSettingsCacheForTests = (): void => {
    runtimeSettingsPromise = null;
    setRuntimeDefaultCreateTripModelId(DEFAULT_CREATE_TRIP_MODEL_ID);
};
