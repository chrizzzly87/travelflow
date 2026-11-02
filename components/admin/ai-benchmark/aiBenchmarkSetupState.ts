import {
    createSystemBenchmarkPresets,
    type BenchmarkMaskScenario,
    type BenchmarkPresetConfig,
} from '../../../services/aiBenchmarkPreferencesService';
import {
    BENCHMARK_CONCURRENCY_DEFAULT,
    BENCHMARK_TIMEOUT_DEFAULT_SECONDS,
    CUSTOM_JSON_PRESET_ID,
    DEFAULT_SESSION_NAME,
    MANUAL_CUSTOM_SCENARIO_META,
    setModelReasoningOverride,
    toMaskState,
    type BenchmarkDefaultDates,
    type BenchmarkExecutionSettings,
    type BenchmarkReasoningMode,
    type CustomScenarioMeta,
    type PresetEditorDraft,
} from './aiBenchmarkModel';

/**
 * Run setup: the trip template every model receives (the mask, the saved
 * templates and a pasted custom JSON), the template editor and details modal,
 * and the execution settings of the next run.
 */
export interface AiBenchmarkSetupState {
    defaultDates: BenchmarkDefaultDates;
    mask: BenchmarkMaskScenario;
    presetConfigs: BenchmarkPresetConfig[];
    selectedPresetId: string;
    customScenarioJsonDraft: string;
    customScenarioMeta: CustomScenarioMeta | null;
    presetEditor: PresetEditorDraft | null;
    templateDetailsOpen: boolean;
    execution: BenchmarkExecutionSettings;
}

export type AiBenchmarkSetupAction =
    | { type: 'applyMask'; scenario: BenchmarkMaskScenario }
    | { type: 'replacePresets'; presets: BenchmarkPresetConfig[]; selectedPresetId: string }
    | { type: 'selectPreset'; presetId: string }
    | { type: 'editCustomJson'; value: string }
    | { type: 'loadCustomJson'; json: string; meta: CustomScenarioMeta }
    | { type: 'ensureCustomMeta' }
    | { type: 'importScenario'; scenario: BenchmarkMaskScenario; json: string; meta: CustomScenarioMeta }
    | { type: 'openPresetEditor'; draft: PresetEditorDraft }
    | { type: 'editPresetDraft'; patch: Partial<Pick<PresetEditorDraft, 'name' | 'description'>> }
    | { type: 'editPresetDraftScenario'; patch: Partial<BenchmarkMaskScenario> }
    | { type: 'closePresetEditor' }
    | { type: 'presetSaved'; presets: BenchmarkPresetConfig[]; preset: BenchmarkPresetConfig }
    | { type: 'setTemplateDetailsOpen'; open: boolean }
    | { type: 'setExecution'; patch: Partial<Omit<BenchmarkExecutionSettings, 'modelReasoningModes'>> }
    | { type: 'setModelReasoningMode'; modelId: string; value: BenchmarkReasoningMode | undefined };

const FALLBACK_MASK: Omit<BenchmarkMaskScenario, 'startDate' | 'endDate'> = {
    destinations: 'Japan',
    dateInputMode: 'exact',
    flexWeeks: 2,
    flexWindow: 'shoulder',
    budget: 'Medium',
    pace: 'Balanced',
    specificCities: '',
    notes: '',
    numCities: null,
    roundTrip: true,
    routeLock: false,
    travelerSetup: 'solo',
    tripStyleMask: 'everything_except_remote_work',
    transportMask: 'automatic',
};

export const DEFAULT_EXECUTION_SETTINGS: BenchmarkExecutionSettings = {
    sessionName: DEFAULT_SESSION_NAME,
    timeoutSeconds: BENCHMARK_TIMEOUT_DEFAULT_SECONDS,
    reasoningMode: 'low',
    concurrency: BENCHMARK_CONCURRENCY_DEFAULT,
    modelReasoningModes: {},
    compactOutput: true,
};

/** Starts on the first system template, the one the setup applies before preferences load. */
export const createInitialAiBenchmarkSetupState = (defaultDates: BenchmarkDefaultDates): AiBenchmarkSetupState => {
    const presets = createSystemBenchmarkPresets(defaultDates.startDate, defaultDates.endDate);
    const firstPreset = presets[0];
    return {
        defaultDates,
        mask: firstPreset
            ? toMaskState(firstPreset.scenario, defaultDates)
            : { ...FALLBACK_MASK, startDate: defaultDates.startDate, endDate: defaultDates.endDate },
        presetConfigs: presets,
        selectedPresetId: firstPreset?.id || '',
        customScenarioJsonDraft: '',
        customScenarioMeta: null,
        presetEditor: null,
        templateDetailsOpen: false,
        execution: DEFAULT_EXECUTION_SETTINGS,
    };
};

export const aiBenchmarkSetupReducer = (
    state: AiBenchmarkSetupState,
    action: AiBenchmarkSetupAction,
): AiBenchmarkSetupState => {
    switch (action.type) {
        case 'applyMask':
            return { ...state, mask: toMaskState(action.scenario, state.defaultDates) };
        case 'replacePresets':
            return { ...state, presetConfigs: action.presets, selectedPresetId: action.selectedPresetId };
        case 'selectPreset':
            return { ...state, selectedPresetId: action.presetId };
        case 'editCustomJson':
            return {
                ...state,
                customScenarioJsonDraft: action.value,
                customScenarioMeta: state.customScenarioMeta || MANUAL_CUSTOM_SCENARIO_META,
            };
        case 'loadCustomJson':
            return { ...state, customScenarioJsonDraft: action.json, customScenarioMeta: action.meta };
        case 'ensureCustomMeta':
            return state.customScenarioMeta ? state : { ...state, customScenarioMeta: MANUAL_CUSTOM_SCENARIO_META };
        case 'importScenario':
            return {
                ...state,
                mask: toMaskState(action.scenario, state.defaultDates),
                customScenarioJsonDraft: action.json,
                customScenarioMeta: action.meta,
                selectedPresetId: CUSTOM_JSON_PRESET_ID,
            };
        case 'openPresetEditor':
            return { ...state, presetEditor: action.draft };
        case 'editPresetDraft':
            return state.presetEditor ? { ...state, presetEditor: { ...state.presetEditor, ...action.patch } } : state;
        case 'editPresetDraftScenario':
            return state.presetEditor
                ? {
                    ...state,
                    presetEditor: {
                        ...state.presetEditor,
                        scenario: { ...state.presetEditor.scenario, ...action.patch },
                    },
                }
                : state;
        case 'closePresetEditor':
            return { ...state, presetEditor: null };
        case 'presetSaved':
            return {
                ...state,
                presetConfigs: action.presets,
                selectedPresetId: action.preset.id,
                mask: toMaskState(action.preset.scenario, state.defaultDates),
                presetEditor: null,
            };
        case 'setTemplateDetailsOpen':
            return { ...state, templateDetailsOpen: action.open };
        case 'setExecution':
            return { ...state, execution: { ...state.execution, ...action.patch } };
        case 'setModelReasoningMode':
            return {
                ...state,
                execution: {
                    ...state.execution,
                    modelReasoningModes: setModelReasoningOverride(state.execution.modelReasoningModes, action.modelId, action.value),
                },
            };
        default:
            return state;
    }
};
