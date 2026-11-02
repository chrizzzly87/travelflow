import { useCallback, useMemo, useReducer } from 'react';
import { createSystemBenchmarkPresets } from '../../../services/aiBenchmarkPreferencesService';
import {
    buildBenchmarkScenarioPayload,
    buildTemplateJson,
    parseCustomScenarioDraft,
    readMaskScenario,
    resolveSelectedPreset,
    type BenchmarkDefaultDates,
} from './aiBenchmarkModel';
import { aiBenchmarkSetupReducer, createInitialAiBenchmarkSetupState } from './aiBenchmarkSetupState';

/**
 * Run setup state (trip template, custom JSON, template editor, execution
 * settings) and what follows from it: the parsed custom JSON, the selected
 * template, its JSON and the scenario a run sends.
 */
export const useAiBenchmarkSetup = (defaultDates: BenchmarkDefaultDates) => {
    const [state, dispatch] = useReducer(aiBenchmarkSetupReducer, defaultDates, createInitialAiBenchmarkSetupState);
    const { mask, execution, customScenarioJsonDraft, customScenarioMeta, presetConfigs, selectedPresetId } = state;

    const defaultPresets = useMemo(
        () => createSystemBenchmarkPresets(defaultDates.startDate, defaultDates.endDate),
        [defaultDates.endDate, defaultDates.startDate],
    );
    const maskScenario = useMemo(() => readMaskScenario(mask, defaultDates), [defaultDates, mask]);
    const customScenarioDraftParse = useMemo(
        () => parseCustomScenarioDraft(customScenarioJsonDraft, customScenarioMeta?.flow || 'unknown', defaultDates),
        [customScenarioJsonDraft, customScenarioMeta?.flow, defaultDates],
    );
    const selectedPreset = useMemo(() => resolveSelectedPreset({
        selectedPresetId,
        presetConfigs,
        customScenarioMeta,
        customScenario: customScenarioDraftParse.scenario,
        defaultDates,
    }), [customScenarioDraftParse.scenario, customScenarioMeta, defaultDates, presetConfigs, selectedPresetId]);
    const selectedTemplateJson = useMemo(
        () => buildTemplateJson(selectedPresetId, customScenarioJsonDraft, selectedPreset?.scenario),
        [customScenarioJsonDraft, selectedPreset?.scenario, selectedPresetId],
    );

    /** Throws when the template has no destination; callers report it. */
    const buildScenario = useCallback(() => buildBenchmarkScenarioPayload(maskScenario, {
        timeoutSeconds: execution.timeoutSeconds,
        compactOutput: execution.compactOutput,
        reasoningMode: execution.reasoningMode,
    }, mask), [execution.compactOutput, execution.reasoningMode, execution.timeoutSeconds, mask, maskScenario]);

    return {
        state,
        dispatch,
        defaultDates,
        defaultPresets,
        maskScenario,
        customScenarioDraftParse,
        selectedPreset,
        selectedTemplateJson,
        buildScenario,
    };
};

export type AiBenchmarkSetup = ReturnType<typeof useAiBenchmarkSetup>;
