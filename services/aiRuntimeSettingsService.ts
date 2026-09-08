import {
    DEFAULT_CREATE_TRIP_MODEL_ID,
    getAiModelById,
    registerRuntimeAiModels,
    setRuntimeDefaultCreateTripModelId,
    type AiModelCatalogItem,
} from '../config/aiModelCatalog';
import { isMapRuntimePreset, setRuntimeMapPreset } from './mapRuntimeService';
import { setRuntimeDefaultMapStyle } from './tripViewSettingsService';
import { supabase } from './supabaseClient';
import type { MapStyle } from '../types';
import type { MapRuntimePreset } from '../shared/mapRuntime';

const MAP_STYLES: MapStyle[] = ['minimal', 'standard', 'dark', 'satellite', 'clean', 'cleanDark'];

export const isMapStyle = (value: unknown): value is MapStyle => (
    typeof value === 'string' && (MAP_STYLES as string[]).includes(value)
);

export const MAP_STYLE_OPTIONS = MAP_STYLES;

export interface AiRuntimeSettings {
    defaultModelId: string;
    approvedOpenRouterModels: string[];
    modelMaxAgeMonths: number;
    showOlderModels: boolean;
    /** Trip Agent rollout: on for everyone entitled to it. */
    tripAgentEnabled: boolean;
    /** Trip Agent rollout: administrators may use it while it is off. */
    tripAgentAdminPreview: boolean;
    /** Map style new visitors start on, before they pick one themselves. */
    mapDefaultStyle: MapStyle;
    /** Which map stack renders the planner, routes, search and static images. */
    mapRuntimePreset: MapRuntimePreset;
    /** Planner beta gate, kept here so one admin page owns every switch. */
    plannerBetaOpen: boolean;
    updatedAt: string | null;
}

const DEFAULT_AI_RUNTIME_SETTINGS: AiRuntimeSettings = {
    defaultModelId: DEFAULT_CREATE_TRIP_MODEL_ID,
    approvedOpenRouterModels: [],
    modelMaxAgeMonths: 6,
    showOlderModels: false,
    // Mirrors the column defaults, so a database that has not yet widened
    // get_public_runtime_settings keeps the server's own answer: administrators
    // preview the agent, nobody else sees it.
    tripAgentEnabled: false,
    tripAgentAdminPreview: true,
    mapDefaultStyle: 'standard',
    mapRuntimePreset: 'google_all',
    plannerBetaOpen: false,
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
        tripAgentEnabled: row.trip_agent_enabled === true,
        tripAgentAdminPreview: row.trip_agent_admin_preview !== false,
        mapDefaultStyle: isMapStyle(row.map_default_style) ? row.map_default_style : 'standard',
        mapRuntimePreset: isMapRuntimePreset(row.map_runtime_preset) ? row.map_runtime_preset : 'google_all',
        plannerBetaOpen: row.planner_beta_open === true,
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
    setRuntimeDefaultMapStyle(settings.mapDefaultStyle);
    setRuntimeMapPreset(settings.mapRuntimePreset);
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

/** Reloads the settings from the database, bypassing the boot-time cache. */
export const refreshPublicAiRuntimeSettings = async (): Promise<AiRuntimeSettings> => {
    runtimeSettingsPromise = null;
    return loadPublicAiRuntimeSettings();
};

export const resetAiRuntimeSettingsCacheForTests = (): void => {
    runtimeSettingsPromise = null;
    setRuntimeDefaultCreateTripModelId(DEFAULT_CREATE_TRIP_MODEL_ID);
    setRuntimeDefaultMapStyle('standard');
    setRuntimeMapPreset(null);
};

/**
 * Writes the app-wide switches. Every field is optional; what is not sent keeps
 * its stored value, so one section of the admin page can save on its own.
 */
export const updateAppRuntimeSettings = async (input: {
    plannerBetaOpen?: boolean;
    tripAgentEnabled?: boolean;
    tripAgentAdminPreview?: boolean;
    defaultModelId?: string;
    approvedOpenRouterModels?: string[];
    modelMaxAgeMonths?: number;
    showOlderModels?: boolean;
    mapDefaultStyle?: MapStyle;
    mapRuntimePreset?: MapRuntimePreset;
}): Promise<AiRuntimeSettings> => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('admin_update_app_runtime_settings', {
        p_planner_beta_open: input.plannerBetaOpen ?? null,
        p_trip_agent_enabled: input.tripAgentEnabled ?? null,
        p_trip_agent_admin_preview: input.tripAgentAdminPreview ?? null,
        p_ai_default_model_id: input.defaultModelId ?? null,
        p_ai_approved_openrouter_models: input.approvedOpenRouterModels ?? null,
        p_ai_model_max_age_months: input.modelMaxAgeMonths ?? null,
        p_ai_show_older_models: input.showOlderModels ?? null,
        p_map_default_style: input.mapDefaultStyle ?? null,
        p_map_runtime_preset: input.mapRuntimePreset ?? null,
    });
    if (error) throw new Error(error.message);
    const settings = normalizeAiRuntimeSettings(data);
    // The cached promise is what the rest of the app reads; replace it so a save
    // is visible without a reload.
    runtimeSettingsPromise = Promise.resolve(settings);
    applyAiRuntimeSettings(settings);
    return settings;
};
