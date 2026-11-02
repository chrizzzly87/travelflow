import { useCallback } from 'react';
import { useAppDialog } from '../../AppDialogProvider';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import { buildDangerConfirmDialog } from '../../../services/appDialogPresets';
import { trackEvent } from '../../../services/analyticsService';
import type { BenchmarkMaskScenario, BenchmarkPreferencesPayload } from '../../../services/aiBenchmarkPreferencesService';
import { getAllSelectedBenchmarkTargetIds } from '../../../utils/aiBenchmarkTargets';
import { downloadBlob } from './aiBenchmarkApi';
import {
    CUSTOM_JSON_PRESET_ID,
    buildPresetFromEditor,
    listNewlyApprovedLiveModels,
    mergeApprovedOpenRouterModels,
    upsertPreset,
    type CustomScenarioMeta,
    type ModelCatalogFilters,
} from './aiBenchmarkModel';
import type { AiBenchmarkModelCatalog } from './useAiBenchmarkModelCatalog';
import type { SaveBenchmarkPreferences } from './useAiBenchmarkPreferences';
import type { AiBenchmarkSetup } from './useAiBenchmarkSetup';
import type { AiBenchmarkWorkspaceDispatch } from './useAiBenchmarkWorkspace';
import type { PromptPreview } from './aiBenchmarkWorkspaceState';

/**
 * Setup-tab actions: choosing and editing trip templates, the custom JSON,
 * the prompt preview, the model list and picker, and the app default model.
 */
export const useAiBenchmarkSetupActions = (params: {
    setup: AiBenchmarkSetup;
    catalog: AiBenchmarkModelCatalog;
    savePreferences: SaveBenchmarkPreferences;
    normalizePreferencesForClient: (value: unknown) => BenchmarkPreferencesPayload;
    promptPreview: PromptPreview | null;
    workspace: AiBenchmarkWorkspaceDispatch;
}) => {
    const { setup, catalog, savePreferences, normalizePreferencesForClient, promptPreview, workspace } = params;
    const { confirm: confirmDialog } = useAppDialog();
    const setupDispatch = setup.dispatch;
    const modelsDispatch = catalog.dispatch;
    const { presetConfigs, selectedPresetId, customScenarioJsonDraft, customScenarioMeta, presetEditor, defaultDates } = setup.state;
    const { maskScenario, selectedPreset, customScenarioDraftParse, buildScenario } = setup;
    const { modelTargetIds, picker, liveOpenRouterModels, runtimeSettings } = catalog.state;
    const { persistAiRuntimeSettings, selectedTargets } = catalog;

    const loadCurrentMaskIntoCustomJson = useCallback((meta?: CustomScenarioMeta) => {
        setupDispatch({
            type: 'loadCustomJson',
            json: JSON.stringify(maskScenario, null, 2),
            meta: meta || { source: 'manual', flow: 'unknown', tripId: null },
        });
    }, [maskScenario, setupDispatch]);

    const applyCustomJsonToMask = useCallback(() => {
        if (!customScenarioDraftParse.scenario) {
            workspace({ type: 'setError', error: customScenarioDraftParse.error || 'Custom JSON could not be mapped to a benchmark mask.' });
            return;
        }
        setupDispatch({ type: 'applyMask', scenario: customScenarioDraftParse.scenario });
        workspace({ type: 'setError', error: null });
        workspace({ type: 'setMessage', message: `Custom JSON applied to benchmark mask (${customScenarioDraftParse.flow}).` });
    }, [customScenarioDraftParse.error, customScenarioDraftParse.flow, customScenarioDraftParse.scenario, setupDispatch, workspace]);

    const selectPreset = useCallback(async (presetId: string) => {
        if (presetId === CUSTOM_JSON_PRESET_ID) {
            setupDispatch({ type: 'selectPreset', presetId: CUSTOM_JSON_PRESET_ID });
            if (!customScenarioJsonDraft.trim()) {
                loadCurrentMaskIntoCustomJson();
            } else if (!customScenarioMeta) {
                setupDispatch({ type: 'ensureCustomMeta' });
            }
            workspace({ type: 'setError', error: null });
            return;
        }
        const preset = presetConfigs.find((entry) => entry.id === presetId);
        if (!preset) return;
        setupDispatch({ type: 'selectPreset', presetId: preset.id });
        setupDispatch({ type: 'applyMask', scenario: preset.scenario });
        await savePreferences({
            selectedPresetId: preset.id,
        }, { silent: true });
    }, [customScenarioJsonDraft, customScenarioMeta, loadCurrentMaskIntoCustomJson, presetConfigs, savePreferences, setupDispatch, workspace]);

    const openPresetEditor = useCallback((mode: 'edit' | 'create') => {
        setupDispatch({ type: 'setTemplateDetailsOpen', open: false });
        if (mode === 'create') {
            setupDispatch({
                type: 'openPresetEditor',
                draft: {
                    mode,
                    id: `custom-${crypto.randomUUID()}`,
                    kind: 'custom',
                    name: 'Custom benchmark preset',
                    description: 'Saved custom mask for repeat benchmark runs.',
                    scenario: maskScenario,
                },
            });
            return;
        }

        const basePreset = selectedPreset || presetConfigs[0];
        if (!basePreset) return;
        setupDispatch({
            type: 'openPresetEditor',
            draft: {
                mode,
                id: basePreset.id,
                kind: basePreset.kind,
                name: basePreset.name,
                description: basePreset.description,
                scenario: basePreset.scenario,
            },
        });
    }, [maskScenario, presetConfigs, selectedPreset, setupDispatch]);

    const editPresetScenario = useCallback(<K extends keyof BenchmarkMaskScenario>(key: K, value: BenchmarkMaskScenario[K]) => {
        setupDispatch({ type: 'editPresetDraftScenario', patch: { [key]: value } as Partial<BenchmarkMaskScenario> });
    }, [setupDispatch]);

    const savePresetDraft = useCallback(async () => {
        if (!presetEditor) return;
        const nextPreset = buildPresetFromEditor(presetEditor, defaultDates);
        const nextPresets = upsertPreset(presetConfigs, nextPreset, presetEditor.mode);
        setupDispatch({ type: 'presetSaved', presets: nextPresets, preset: nextPreset });
        await savePreferences({
            presets: nextPresets,
            selectedPresetId: nextPreset.id,
        }, { silent: true });
    }, [defaultDates, presetConfigs, presetEditor, savePreferences, setupDispatch]);

    const openPromptPreview = useCallback(() => {
        try {
            const scenario = buildScenario();
            workspace({
                type: 'setPromptPreview',
                preview: {
                    prompt: scenario.prompt,
                    generatedAt: new Date().toISOString(),
                },
            });
        } catch (promptError) {
            workspace({ type: 'setError', error: toAdminErrorMessage(promptError, 'Failed to build prompt preview', 'admin-ai-benchmark') });
        }
    }, [buildScenario, workspace]);

    const copyPrompt = useCallback(async () => {
        if (!promptPreview?.prompt) return;
        try {
            await navigator.clipboard.writeText(promptPreview.prompt);
            workspace({ type: 'setMessage', message: 'Prompt copied to clipboard.' });
        } catch {
            workspace({ type: 'setError', error: 'Failed to copy prompt to clipboard.' });
        }
    }, [promptPreview, workspace]);

    const downloadPrompt = useCallback(() => {
        if (!promptPreview?.prompt) return;
        const blob = new Blob([promptPreview.prompt], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, 'benchmark-prompt.txt');
    }, [promptPreview]);

    const openModelPicker = useCallback(() => {
        trackEvent('admin__ai_benchmark--add_models');
        modelsDispatch({ type: 'openPicker' });
    }, [modelsDispatch]);

    const setPickerFilters = useCallback((patch: Partial<ModelCatalogFilters>) => {
        modelsDispatch({ type: 'setPickerFilters', patch });
    }, [modelsDispatch]);

    const saveModelPicker = useCallback(async () => {
        const normalized = normalizePreferencesForClient({
            modelTargets: picker.draftIds,
            presets: presetConfigs,
            selectedPresetId,
        });
        const liveModelIdSet = new Set(liveOpenRouterModels.map((model) => model.id));
        await persistAiRuntimeSettings({
            approvedOpenRouterModels: Array.from(new Set([
                ...runtimeSettings.approvedOpenRouterModels,
                ...listNewlyApprovedLiveModels(normalized.modelTargets, liveModelIdSet),
            ])),
        }, { silent: true });
        modelsDispatch({ type: 'pickerSaved', modelIds: normalized.modelTargets });
        await savePreferences({
            modelTargets: normalized.modelTargets,
        }, { silent: true });
    }, [
        liveOpenRouterModels,
        modelsDispatch,
        normalizePreferencesForClient,
        persistAiRuntimeSettings,
        picker.draftIds,
        presetConfigs,
        runtimeSettings.approvedOpenRouterModels,
        savePreferences,
        selectedPresetId,
    ]);

    const removeModelTarget = useCallback(async (modelId: string) => {
        const next = modelTargetIds.filter((entry) => entry !== modelId);
        modelsDispatch({ type: 'removeModelTarget', modelId });
        await savePreferences({ modelTargets: next }, { silent: true });
    }, [modelTargetIds, modelsDispatch, savePreferences]);

    const removeAllModelTargets = useCallback(async () => {
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Remove all benchmark models?',
            message: 'This clears the selected benchmark model list. You can add models again at any time.',
            confirmLabel: 'Remove all',
        }));
        if (!confirmed) return;
        modelsDispatch({ type: 'clearModelTargets' });
        await savePreferences({ modelTargets: [] }, { silent: true });
        workspace({ type: 'setMessage', message: 'All benchmark models removed.' });
    }, [confirmDialog, modelsDispatch, savePreferences, workspace]);

    const deactivateAllModelTargets = useCallback(() => {
        modelsDispatch({ type: 'deactivateTargets', modelIds: getAllSelectedBenchmarkTargetIds(selectedTargets) });
    }, [modelsDispatch, selectedTargets]);

    const setAppDefaultModel = useCallback((value: string) => {
        trackEvent('admin__ai_benchmark--app_default_model');
        void persistAiRuntimeSettings({
            defaultModelId: value,
            approvedOpenRouterModels: mergeApprovedOpenRouterModels(runtimeSettings.approvedOpenRouterModels, [value]),
        });
    }, [persistAiRuntimeSettings, runtimeSettings.approvedOpenRouterModels]);

    const setModelMaxAgeMonths = useCallback((modelMaxAgeMonths: number) => {
        modelsDispatch({ type: 'patchRuntimeSettings', patch: { modelMaxAgeMonths } });
        void persistAiRuntimeSettings({ modelMaxAgeMonths }, { silent: true });
    }, [modelsDispatch, persistAiRuntimeSettings]);

    const setShowOlderModels = useCallback((showOlderModels: boolean) => {
        modelsDispatch({ type: 'patchRuntimeSettings', patch: { showOlderModels } });
        void persistAiRuntimeSettings({ showOlderModels }, { silent: true });
    }, [modelsDispatch, persistAiRuntimeSettings]);

    return {
        loadCurrentMaskIntoCustomJson,
        applyCustomJsonToMask,
        selectPreset,
        openPresetEditor,
        editPresetScenario,
        savePresetDraft,
        openPromptPreview,
        copyPrompt,
        downloadPrompt,
        openModelPicker,
        setPickerFilters,
        saveModelPicker,
        removeModelTarget,
        removeAllModelTargets,
        deactivateAllModelTargets,
        setAppDefaultModel,
        setModelMaxAgeMonths,
        setShowOlderModels,
    };
};

export type AiBenchmarkSetupActions = ReturnType<typeof useAiBenchmarkSetupActions>;
