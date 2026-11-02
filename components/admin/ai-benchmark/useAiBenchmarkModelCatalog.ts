import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
    AI_MODEL_CATALOG,
    getDefaultCreateTripModel,
    registerRuntimeAiModels,
    sortAiModels,
} from '../../../config/aiModelCatalog';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import { mergeAiModelCatalogs } from '../../../services/openRouterModelCatalogService';
import { applyAiRuntimeSettings, type AiRuntimeSettings } from '../../../services/aiRuntimeSettingsService';
import { buildRunnableBenchmarkTargets } from '../../../utils/aiBenchmarkTargets';
import { buildInitialAdminAiRuntimeSettings } from '../adminAiRuntimeSettingsDraft';
import type { BenchmarkModelsApiResponse, FetchBenchmarkApi } from './aiBenchmarkApi';
import {
    filterCatalogModels,
    getInitialBenchmarkModelTargetIds,
    groupModelsByProviderLabel,
    listActiveModelIds,
    listModelProviderLabels,
    resolveDefaultBenchmarkModelTargetIds,
    resolveSelectedTargets,
} from './aiBenchmarkModel';
import { aiBenchmarkModelsReducer, createInitialAiBenchmarkModelsState } from './aiBenchmarkModelsState';
import type { AiBenchmarkWorkspaceDispatch } from './useAiBenchmarkWorkspace';

export type AiRuntimeSettingsOverrides = Partial<Pick<AiRuntimeSettings, 'defaultModelId' | 'approvedOpenRouterModels' | 'modelMaxAgeMonths' | 'showOlderModels'>>;

const createInitialModelsState = () => createInitialAiBenchmarkModelsState({
    // Start from the service defaults: saving before the server answers posts the
    // whole object, so map style and runtime preset must never be undefined.
    runtimeSettings: buildInitialAdminAiRuntimeSettings(getDefaultCreateTripModel().id),
    modelTargetIds: getInitialBenchmarkModelTargetIds(),
});

/**
 * The model catalog (bundled plus live OpenRouter models), the app's AI runtime
 * settings, the benchmark's model list and the picker, with loading and saving.
 */
export const useAiBenchmarkModelCatalog = (params: {
    accessToken: string | null;
    fetchBenchmarkApi: FetchBenchmarkApi;
    notify: AiBenchmarkWorkspaceDispatch;
}) => {
    const { accessToken, fetchBenchmarkApi, notify } = params;
    const [state, dispatch] = useReducer(aiBenchmarkModelsReducer, undefined, createInitialModelsState);
    const { liveOpenRouterModels, runtimeSettings, modelTargetIds, inactiveModelTargetIds, picker } = state;

    const sortedModels = useMemo(
        () => sortAiModels(mergeAiModelCatalogs(AI_MODEL_CATALOG, liveOpenRouterModels)),
        [liveOpenRouterModels],
    );
    const activeModelIdSet = useMemo(() => listActiveModelIds(sortedModels), [sortedModels]);
    const defaultModelTargetIds = useMemo(() => resolveDefaultBenchmarkModelTargetIds(activeModelIdSet), [activeModelIdSet]);
    const activeModels = useMemo(
        () => sortedModels.filter((model) => model.availability === 'active'),
        [sortedModels],
    );

    const { modelMaxAgeMonths, showOlderModels } = runtimeSettings;
    const filteredModels = useMemo(
        () => filterCatalogModels(sortedModels, picker.filters, { modelMaxAgeMonths, showOlderModels }),
        [modelMaxAgeMonths, picker.filters, showOlderModels, sortedModels],
    );
    const groupedModels = useMemo(() => groupModelsByProviderLabel(filteredModels), [filteredModels]);
    const modelProviderOptions = useMemo(() => listModelProviderLabels(sortedModels), [sortedModels]);

    const selectedTargets = useMemo(() => resolveSelectedTargets(modelTargetIds, sortedModels), [modelTargetIds, sortedModels]);
    const selectedTargetIdSet = useMemo(() => new Set(selectedTargets.map((target) => target.id)), [selectedTargets]);
    const inactiveTargetIdSet = useMemo(() => new Set(inactiveModelTargetIds), [inactiveModelTargetIds]);
    const runnableTargets = useMemo(
        () => buildRunnableBenchmarkTargets(selectedTargets, inactiveModelTargetIds),
        [inactiveModelTargetIds, selectedTargets],
    );
    const reasoningTargetCount = useMemo(
        () => selectedTargets.filter((model) => model.supportsReasoning === true).length,
        [selectedTargets],
    );

    const loadModelCatalog = useCallback(async (options?: { silent?: boolean }) => {
        if (!accessToken) return;
        dispatch({ type: 'catalogRequested' });
        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/models', { method: 'GET' }) as BenchmarkModelsApiResponse;
            const models = Array.isArray(payload.models) ? payload.models : [];
            registerRuntimeAiModels(models);
            dispatch({ type: 'catalogReceived', models, settings: payload.settings });
            if (payload.settings) {
                applyAiRuntimeSettings(payload.settings, models);
            }
            if (!options?.silent) {
                notify({ type: 'setMessage', message: `OpenRouter catalog refreshed: ${models.length} compatible models available.` });
            }
        } catch (catalogError) {
            if (!options?.silent) {
                notify({ type: 'setError', error: toAdminErrorMessage(catalogError, 'Could not refresh the OpenRouter model catalog.', 'admin-ai-benchmark') });
            }
        } finally {
            dispatch({ type: 'catalogSettled' });
        }
    }, [accessToken, fetchBenchmarkApi, notify]);

    // Loads the catalog from the API once a token exists.
    useEffect(() => {
        if (!accessToken) {
            dispatch({ type: 'catalogReset' });
            return;
        }
        void loadModelCatalog({ silent: true });
    }, [accessToken, loadModelCatalog]);

    // A model that left the selection (removed, or gone from the catalog) can't stay switched off.
    useEffect(() => {
        dispatch({ type: 'pruneInactiveTargets', selectedIds: selectedTargetIdSet });
    }, [selectedTargetIdSet]);

    const persistAiRuntimeSettings = useCallback(async (
        overrides: AiRuntimeSettingsOverrides,
        options?: { silent?: boolean },
    ): Promise<AiRuntimeSettings | null> => {
        try {
            const draft: AiRuntimeSettings = { ...runtimeSettings, ...overrides };
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/models', {
                method: 'POST',
                body: JSON.stringify(draft),
            }) as BenchmarkModelsApiResponse;
            const models = Array.isArray(payload.models) ? payload.models : liveOpenRouterModels;
            const settings = payload.settings || draft;
            dispatch({ type: 'catalogReceived', models, settings });
            applyAiRuntimeSettings(settings, models);
            if (!options?.silent) notify({ type: 'setMessage', message: 'Frontend AI model settings saved.' });
            return settings;
        } catch (settingsError) {
            notify({ type: 'setError', error: toAdminErrorMessage(settingsError, 'Could not save frontend AI model settings.', 'admin-ai-benchmark') });
            return null;
        }
    }, [fetchBenchmarkApi, liveOpenRouterModels, notify, runtimeSettings]);

    return {
        state,
        dispatch,
        sortedModels,
        activeModels,
        activeModelIdSet,
        defaultModelTargetIds,
        filteredModels,
        groupedModels,
        modelProviderOptions,
        selectedTargets,
        inactiveTargetIdSet,
        runnableTargets,
        allTargetsActive: selectedTargets.length > 0 && runnableTargets.length === selectedTargets.length,
        allTargetsInactive: selectedTargets.length > 0 && runnableTargets.length === 0,
        reasoningTargetCount,
        loadModelCatalog,
        persistAiRuntimeSettings,
    };
};

export type AiBenchmarkModelCatalog = ReturnType<typeof useAiBenchmarkModelCatalog>;
