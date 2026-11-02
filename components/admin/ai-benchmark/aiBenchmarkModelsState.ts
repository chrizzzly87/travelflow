import type { OpenRouterCatalogModel } from '../../../services/openRouterModelCatalogService';
import type { AiRuntimeSettings } from '../../../services/aiRuntimeSettingsService';
import {
    pruneInactiveBenchmarkTargetIds,
    toggleInactiveBenchmarkTargetId,
} from '../../../utils/aiBenchmarkTargets';
import {
    DEFAULT_MODEL_CATALOG_FILTERS,
    toggleModelId,
    type ModelCatalogFilters,
} from './aiBenchmarkModel';

/**
 * The model catalog: live OpenRouter models, the app's AI runtime settings,
 * the benchmark's model list with the models switched off, and the picker.
 */
export interface AiBenchmarkModelsState {
    liveOpenRouterModels: OpenRouterCatalogModel[];
    runtimeSettings: AiRuntimeSettings;
    catalogLoading: boolean;
    catalogLoaded: boolean;
    modelTargetIds: string[];
    inactiveModelTargetIds: string[];
    picker: {
        open: boolean;
        draftIds: string[];
        filters: ModelCatalogFilters;
    };
}

export type AiBenchmarkModelsAction =
    | { type: 'catalogRequested' }
    | { type: 'catalogReceived'; models: OpenRouterCatalogModel[]; settings?: AiRuntimeSettings }
    | { type: 'catalogSettled' }
    | { type: 'catalogReset' }
    | { type: 'patchRuntimeSettings'; patch: Partial<AiRuntimeSettings> }
    | { type: 'setModelTargets'; modelIds: string[] }
    | { type: 'removeModelTarget'; modelId: string }
    | { type: 'clearModelTargets' }
    | { type: 'pickerSaved'; modelIds: string[] }
    | { type: 'pruneInactiveTargets'; selectedIds: Iterable<string> }
    | { type: 'toggleTargetActive'; modelId: string }
    | { type: 'activateAllTargets' }
    | { type: 'deactivateTargets'; modelIds: string[] }
    | { type: 'openPicker' }
    | { type: 'closePicker' }
    | { type: 'toggleDraftModel'; modelId: string }
    | { type: 'setPickerFilters'; patch: Partial<ModelCatalogFilters> };

export const createInitialAiBenchmarkModelsState = (params: {
    runtimeSettings: AiRuntimeSettings;
    modelTargetIds: string[];
}): AiBenchmarkModelsState => ({
    liveOpenRouterModels: [],
    runtimeSettings: params.runtimeSettings,
    catalogLoading: false,
    catalogLoaded: false,
    modelTargetIds: params.modelTargetIds,
    inactiveModelTargetIds: [],
    picker: {
        open: false,
        draftIds: [],
        filters: DEFAULT_MODEL_CATALOG_FILTERS,
    },
});

const sameIds = (left: string[], right: string[]): boolean => (
    left.length === right.length && left.every((entry, index) => entry === right[index])
);

export const aiBenchmarkModelsReducer = (
    state: AiBenchmarkModelsState,
    action: AiBenchmarkModelsAction,
): AiBenchmarkModelsState => {
    switch (action.type) {
        case 'catalogRequested':
            return { ...state, catalogLoading: true };
        case 'catalogReceived':
            return {
                ...state,
                liveOpenRouterModels: action.models,
                runtimeSettings: action.settings ?? state.runtimeSettings,
            };
        case 'catalogSettled':
            return { ...state, catalogLoading: false, catalogLoaded: true };
        case 'catalogReset':
            return state.catalogLoaded ? { ...state, catalogLoaded: false } : state;
        case 'patchRuntimeSettings':
            return { ...state, runtimeSettings: { ...state.runtimeSettings, ...action.patch } };
        case 'setModelTargets':
            return { ...state, modelTargetIds: action.modelIds };
        case 'removeModelTarget':
            return {
                ...state,
                modelTargetIds: state.modelTargetIds.filter((entry) => entry !== action.modelId),
                inactiveModelTargetIds: state.inactiveModelTargetIds.filter((entry) => entry !== action.modelId),
            };
        case 'clearModelTargets':
            return { ...state, modelTargetIds: [], inactiveModelTargetIds: [] };
        case 'pickerSaved':
            return {
                ...state,
                modelTargetIds: action.modelIds,
                inactiveModelTargetIds: pruneInactiveBenchmarkTargetIds(state.inactiveModelTargetIds, action.modelIds),
                picker: { ...state.picker, open: false },
            };
        case 'pruneInactiveTargets': {
            const next = pruneInactiveBenchmarkTargetIds(state.inactiveModelTargetIds, action.selectedIds);
            return sameIds(next, state.inactiveModelTargetIds) ? state : { ...state, inactiveModelTargetIds: next };
        }
        case 'toggleTargetActive':
            return {
                ...state,
                inactiveModelTargetIds: toggleInactiveBenchmarkTargetId(state.inactiveModelTargetIds, action.modelId),
            };
        case 'activateAllTargets':
            return { ...state, inactiveModelTargetIds: [] };
        case 'deactivateTargets':
            return { ...state, inactiveModelTargetIds: action.modelIds };
        case 'openPicker':
            return {
                ...state,
                picker: { open: true, draftIds: state.modelTargetIds, filters: DEFAULT_MODEL_CATALOG_FILTERS },
            };
        case 'closePicker':
            return { ...state, picker: { ...state.picker, open: false } };
        case 'toggleDraftModel':
            return { ...state, picker: { ...state.picker, draftIds: toggleModelId(state.picker.draftIds, action.modelId) } };
        case 'setPickerFilters':
            return { ...state, picker: { ...state.picker, filters: { ...state.picker.filters, ...action.patch } } };
        default:
            return state;
    }
};
