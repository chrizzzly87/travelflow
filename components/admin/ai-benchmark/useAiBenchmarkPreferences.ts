import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from '@/app/navigation';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import {
    normalizeBenchmarkPreferencesPayload,
    type BenchmarkPreferencesPayload,
} from '../../../services/aiBenchmarkPreferencesService';
import {
    decodeBenchmarkScenarioImportPayload,
    type BenchmarkScenarioImportPayload,
} from '../../../services/tripGenerationBenchmarkBridge';
import type { BenchmarkPreferencesApiResponse, FetchBenchmarkApi } from './aiBenchmarkApi';
import {
    CUSTOM_JSON_PRESET_ID,
    describeImportedScenario,
    findPresetOrFirst,
    resolveImportedScenario,
    resolvePersistedPresetId,
    withoutImportParam,
} from './aiBenchmarkModel';
import type { AiBenchmarkModelCatalog } from './useAiBenchmarkModelCatalog';
import type { AiBenchmarkSetup } from './useAiBenchmarkSetup';
import type { AiBenchmarkWorkspaceDispatch } from './useAiBenchmarkWorkspace';

export type SaveBenchmarkPreferences = (
    nextOverrides?: Partial<BenchmarkPreferencesPayload>,
    options?: { silent?: boolean },
) => Promise<BenchmarkPreferencesPayload | null>;

/**
 * The admin's saved model list and trip templates: loads them once the catalog
 * is known (and again whenever it changes), saves them, and applies a scenario
 * imported from trip diagnostics through `?import=` once they are loaded.
 */
export const useAiBenchmarkPreferences = (params: {
    accessToken: string | null;
    fetchBenchmarkApi: FetchBenchmarkApi;
    catalog: AiBenchmarkModelCatalog;
    setup: AiBenchmarkSetup;
    notify: AiBenchmarkWorkspaceDispatch;
}) => {
    const { accessToken, fetchBenchmarkApi, catalog, setup, notify } = params;
    const [searchParams, setSearchParams] = useSearchParams();
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const handledImportTokenRef = useRef<string | null>(null);
    const pendingImportedScenarioRef = useRef<BenchmarkScenarioImportPayload | null>(null);

    const { activeModelIdSet, defaultModelTargetIds } = catalog;
    const { modelTargetIds, catalogLoaded } = catalog.state;
    const modelsDispatch = catalog.dispatch;
    const { defaultDates, defaultPresets } = setup;
    const { presetConfigs, selectedPresetId } = setup.state;
    const setupDispatch = setup.dispatch;

    const normalizePreferencesForClient = useCallback((
        value: unknown,
        options?: { mergeFallbackModelIds?: boolean },
    ): BenchmarkPreferencesPayload => normalizeBenchmarkPreferencesPayload(value, {
        fallbackPresets: defaultPresets,
        defaultStartDate: defaultDates.startDate,
        defaultEndDate: defaultDates.endDate,
        fallbackModelIds: defaultModelTargetIds,
        allowedModelIds: activeModelIdSet,
        mergeFallbackModelIds: options?.mergeFallbackModelIds,
    }), [activeModelIdSet, defaultDates.endDate, defaultDates.startDate, defaultModelTargetIds, defaultPresets]);

    const applyImportedScenario = useCallback((imported: BenchmarkScenarioImportPayload) => {
        const resolved = resolveImportedScenario(imported, defaultDates);
        setupDispatch({ type: 'importScenario', scenario: resolved.scenario, json: resolved.json, meta: resolved.meta });
        notify({ type: 'setError', error: null });
        notify({ type: 'setMessage', message: describeImportedScenario(imported) });
    }, [defaultDates, notify, setupDispatch]);

    const applyPreferences = useCallback((preferences: BenchmarkPreferencesPayload) => {
        modelsDispatch({ type: 'setModelTargets', modelIds: preferences.modelTargets });
        setupDispatch({ type: 'replacePresets', presets: preferences.presets, selectedPresetId: preferences.selectedPresetId });
        const preset = findPresetOrFirst(preferences.presets, preferences.selectedPresetId);
        if (preset) {
            setupDispatch({ type: 'applyMask', scenario: preset.scenario });
        }
    }, [modelsDispatch, setupDispatch]);

    const savePreferences = useCallback<SaveBenchmarkPreferences>(async (nextOverrides, options) => {
        if (!accessToken) return null;

        try {
            const requestedSelectedPresetId = nextOverrides?.selectedPresetId ?? selectedPresetId;
            const draft = normalizePreferencesForClient({
                modelTargets: nextOverrides?.modelTargets ?? modelTargetIds,
                presets: nextOverrides?.presets ?? presetConfigs,
                selectedPresetId: resolvePersistedPresetId(requestedSelectedPresetId, presetConfigs, defaultPresets),
            });

            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/preferences', {
                method: 'POST',
                body: JSON.stringify(draft),
            }) as BenchmarkPreferencesApiResponse;

            const normalized = normalizePreferencesForClient(payload.preferences || draft);
            modelsDispatch({ type: 'setModelTargets', modelIds: normalized.modelTargets });
            setupDispatch({
                type: 'replacePresets',
                presets: normalized.presets,
                selectedPresetId: requestedSelectedPresetId === CUSTOM_JSON_PRESET_ID ? CUSTOM_JSON_PRESET_ID : normalized.selectedPresetId,
            });
            if (!options?.silent) {
                notify({ type: 'setMessage', message: 'Benchmark preferences saved.' });
            }
            return normalized;
        } catch (saveError) {
            notify({ type: 'setError', error: toAdminErrorMessage(saveError, 'Failed to save benchmark preferences.', 'admin-ai-benchmark') });
            return null;
        }
    }, [
        accessToken,
        defaultPresets,
        fetchBenchmarkApi,
        modelTargetIds,
        modelsDispatch,
        normalizePreferencesForClient,
        notify,
        presetConfigs,
        selectedPresetId,
        setupDispatch,
    ]);

    const loadPreferences = useCallback(async () => {
        if (!accessToken) return;

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/preferences', {
                method: 'GET',
            }) as BenchmarkPreferencesApiResponse;

            applyPreferences(normalizePreferencesForClient(payload.preferences || {}, {
                mergeFallbackModelIds: true,
            }));
        } catch (preferencesError) {
            notify({ type: 'setError', error: toAdminErrorMessage(preferencesError, 'Failed to load benchmark preferences', 'admin-ai-benchmark') });
            applyPreferences(normalizePreferencesForClient({}));
        } finally {
            setPreferencesLoaded(true);
        }
    }, [accessToken, applyPreferences, fetchBenchmarkApi, normalizePreferencesForClient, notify]);

    // Reads `?import=` once per payload, strips it from the URL, and applies it after preferences load.
    useEffect(() => {
        const encodedImport = (searchParams.get('import') || '').trim();
        if (!encodedImport) return;
        if (handledImportTokenRef.current === encodedImport) return;
        handledImportTokenRef.current = encodedImport;

        const imported = decodeBenchmarkScenarioImportPayload(encodedImport);
        setSearchParams(withoutImportParam(searchParams), { replace: true });

        if (!imported) {
            notify({ type: 'setError', error: 'Could not import benchmark scenario from trip diagnostics. The payload is invalid.' });
            return;
        }
        if (!preferencesLoaded) {
            pendingImportedScenarioRef.current = imported;
            return;
        }
        applyImportedScenario(imported);
    }, [applyImportedScenario, notify, preferencesLoaded, searchParams, setSearchParams]);

    useEffect(() => {
        if (!preferencesLoaded) return;
        const pendingImport = pendingImportedScenarioRef.current;
        if (!pendingImport) return;
        pendingImportedScenarioRef.current = null;
        applyImportedScenario(pendingImport);
    }, [applyImportedScenario, preferencesLoaded]);

    // Loads preferences from the API once the catalog is known, and again when it changes.
    useEffect(() => {
        if (!accessToken) {
            setPreferencesLoaded(false);
            return;
        }
        if (!catalogLoaded) return;
        setPreferencesLoaded(false);
        void loadPreferences();
    }, [accessToken, catalogLoaded, loadPreferences]);

    // Until preferences load, the mask follows the selected template.
    useEffect(() => {
        if (preferencesLoaded) return;
        if (selectedPresetId === CUSTOM_JSON_PRESET_ID) return;
        const preset = findPresetOrFirst(presetConfigs, selectedPresetId);
        if (!preset) return;
        setupDispatch({ type: 'applyMask', scenario: preset.scenario });
    }, [preferencesLoaded, presetConfigs, selectedPresetId, setupDispatch]);

    return { preferencesLoaded, normalizePreferencesForClient, savePreferences };
};
