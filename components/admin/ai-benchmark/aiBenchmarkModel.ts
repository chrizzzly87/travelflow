import {
    AI_MODEL_CATALOG,
    getDefaultCreateTripModel,
    type AiModelCatalogItem,
} from '../../../config/aiModelCatalog';
import { getAiProviderMetadata, getAiProviderSortOrder } from '../../../config/aiProviderCatalog';
import { buildClassicBenchmarkScenario } from '../../../services/aiBenchmarkClassicScenarioService';
import {
    BENCHMARK_DEFAULT_MODEL_IDS,
    normalizeBenchmarkMaskScenario,
    type BenchmarkMaskScenario,
    type BenchmarkPresetConfig,
} from '../../../services/aiBenchmarkPreferencesService';
import {
    buildBenchmarkMaskScenarioFromImportedJson,
    type BenchmarkScenarioImportPayload,
} from '../../../services/tripGenerationBenchmarkBridge';
import { isAiModelOlderThanMonths } from '../../../services/openRouterModelCatalogService';
import type { AiRuntimeSettings } from '../../../services/aiRuntimeSettingsService';
import { resolveSupportedReasoningEffort, type AiReasoningEffort } from '../../../shared/aiReasoning';
import type { AiBenchmarkRunTarget } from '../../../utils/aiBenchmarkTargets';
import { formatDuration, formatUsd, isRunActive, type BenchmarkRun } from '../aiBenchmarkRuns';
import type { AiTelemetryApiResponse, AiTelemetryModelPoint } from './aiBenchmarkApi';

export const DEFAULT_SESSION_NAME = 'AI benchmark session';
export const CUSTOM_JSON_PRESET_ID = '__custom_json__';
export const CUSTOM_JSON_PRESET_NAME = 'Custom JSON import';
export const BENCHMARK_CONCURRENCY_DEFAULT = 2;
export const BENCHMARK_CONCURRENCY_MAX = 5;
export const BENCHMARK_TIMEOUT_MIN_SECONDS = 20;
export const BENCHMARK_TIMEOUT_MAX_SECONDS = 180;
export const BENCHMARK_TIMEOUT_DEFAULT_SECONDS = 60;

export type BenchmarkReasoningMode = 'provider-default' | AiReasoningEffort;

export const REASONING_MODE_LABELS: Record<BenchmarkReasoningMode, string> = {
    'provider-default': 'Model default',
    none: 'Off',
    minimal: 'Minimal',
    low: 'Low · fastest',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra high',
    max: 'Maximum',
};

export const COST_ESTIMATE_FOOTNOTE = 'Estimate for one classic itinerary generation; real cost varies by prompt/output size.';

export const BENCHMARK_BASELINE_PREFERENCE_DEFAULTS = {
    travelerSetup: 'solo',
    tripStyle: 'everything_except_remote_work',
    transportPreference: 'automatic',
};

export interface BenchmarkDefaultDates {
    startDate: string;
    endDate: string;
}

export interface CustomScenarioMeta {
    source: 'trip_info' | 'admin_trip_drawer' | 'manual';
    flow: 'classic' | 'wizard' | 'surprise' | 'unknown';
    tripId: string | null;
}

export const MANUAL_CUSTOM_SCENARIO_META: CustomScenarioMeta = {
    source: 'manual',
    flow: 'unknown',
    tripId: null,
};

export interface PresetEditorDraft {
    mode: 'edit' | 'create';
    id: string;
    kind: 'system' | 'custom';
    name: string;
    description: string;
    scenario: BenchmarkMaskScenario;
}

/* ------------------------------------------------------------------ */
/* Trip template (the mask every model receives)                       */
/* ------------------------------------------------------------------ */

/** The mask as the setup holds it: missing dates fall back to the defaults. */
export const toMaskState = (scenario: BenchmarkMaskScenario, defaultDates: BenchmarkDefaultDates): BenchmarkMaskScenario => ({
    destinations: scenario.destinations,
    dateInputMode: scenario.dateInputMode,
    startDate: scenario.startDate || defaultDates.startDate,
    endDate: scenario.endDate || defaultDates.endDate,
    flexWeeks: scenario.flexWeeks,
    flexWindow: scenario.flexWindow,
    budget: scenario.budget,
    pace: scenario.pace,
    specificCities: scenario.specificCities,
    notes: scenario.notes,
    numCities: typeof scenario.numCities === 'number' ? scenario.numCities : null,
    roundTrip: scenario.roundTrip,
    routeLock: scenario.routeLock,
    travelerSetup: scenario.travelerSetup,
    tripStyleMask: scenario.tripStyleMask,
    transportMask: scenario.transportMask,
});

export const readMaskScenario = (mask: BenchmarkMaskScenario, defaultDates: BenchmarkDefaultDates): BenchmarkMaskScenario => (
    normalizeBenchmarkMaskScenario({
        ...mask,
        numCities: typeof mask.numCities === 'number' ? mask.numCities : null,
    }, {
        defaultStartDate: defaultDates.startDate,
        defaultEndDate: defaultDates.endDate,
    })
);

export interface CustomScenarioDraftParse {
    scenario: BenchmarkMaskScenario | null;
    flow: CustomScenarioMeta['flow'];
    error: string | null;
}

export const parseCustomScenarioDraft = (
    draft: string,
    flowHint: CustomScenarioMeta['flow'],
    defaultDates: BenchmarkDefaultDates,
): CustomScenarioDraftParse => {
    if (!draft.trim()) {
        return { scenario: null, flow: flowHint, error: null };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(draft);
    } catch {
        return { scenario: null, flow: flowHint, error: 'Custom JSON is not valid JSON.' };
    }

    const mapped = buildBenchmarkMaskScenarioFromImportedJson(parsed, {
        flowHint,
        defaultStartDate: defaultDates.startDate,
        defaultEndDate: defaultDates.endDate,
    });
    if (!mapped.scenario) {
        return {
            scenario: null,
            flow: mapped.flow,
            error: 'Custom JSON could not be mapped to a benchmark mask. Use a scenario object or a trip generation payload.',
        };
    }
    return { scenario: mapped.scenario, flow: mapped.flow, error: null };
};

const describeCustomScenarioSource = (source: CustomScenarioMeta['source']): string => (
    source === 'trip_info' ? 'Trip Info' : source === 'admin_trip_drawer' ? 'Admin Trip Drawer' : 'manual input'
);

/** The selected template, including the synthetic "Custom JSON import" entry. */
export const resolveSelectedPreset = (params: {
    selectedPresetId: string;
    presetConfigs: BenchmarkPresetConfig[];
    customScenarioMeta: CustomScenarioMeta | null;
    customScenario: BenchmarkMaskScenario | null;
    defaultDates: BenchmarkDefaultDates;
}): BenchmarkPresetConfig | null => {
    const { selectedPresetId, presetConfigs, customScenarioMeta, customScenario, defaultDates } = params;
    if (selectedPresetId === CUSTOM_JSON_PRESET_ID) {
        return {
            id: CUSTOM_JSON_PRESET_ID,
            kind: 'custom',
            name: CUSTOM_JSON_PRESET_NAME,
            description: customScenarioMeta
                ? `Imported from ${describeCustomScenarioSource(customScenarioMeta.source)}`
                : 'Paste a benchmark scenario JSON payload and apply it to the mask.',
            scenario: customScenario || normalizeBenchmarkMaskScenario({}, {
                defaultStartDate: defaultDates.startDate,
                defaultEndDate: defaultDates.endDate,
            }),
        } as BenchmarkPresetConfig;
    }
    return presetConfigs.find((preset) => preset.id === selectedPresetId) || null;
};

export const buildTemplateJson = (
    selectedPresetId: string,
    customScenarioJsonDraft: string,
    selectedScenario: BenchmarkMaskScenario | undefined,
): string => (
    selectedPresetId === CUSTOM_JSON_PRESET_ID && customScenarioJsonDraft.trim()
        ? customScenarioJsonDraft
        : JSON.stringify(selectedScenario || {}, null, 2)
);

/** The custom template is never persisted; the first saved template stands in for it. */
export const resolvePersistedPresetId = (
    requestedPresetId: string,
    presetConfigs: BenchmarkPresetConfig[],
    defaultPresets: BenchmarkPresetConfig[],
): string => (
    requestedPresetId === CUSTOM_JSON_PRESET_ID
        ? (presetConfigs[0]?.id || defaultPresets[0]?.id || '')
        : requestedPresetId
);

export const findPresetOrFirst = (
    presets: BenchmarkPresetConfig[],
    presetId: string,
): BenchmarkPresetConfig | undefined => presets.find((entry) => entry.id === presetId) || presets[0];

export const describeImportedScenario = (imported: BenchmarkScenarioImportPayload): string => {
    const sourceLabel = imported.source === 'trip_info' ? 'Trip Info' : 'Admin Trip Drawer';
    return `Imported benchmark scenario (${imported.flow}) from ${sourceLabel}${imported.tripId ? ` for trip ${imported.tripId}` : ''}.`;
};

/** What an import from trip diagnostics puts into the setup. */
export const resolveImportedScenario = (
    imported: BenchmarkScenarioImportPayload,
    defaultDates: BenchmarkDefaultDates,
): { scenario: BenchmarkMaskScenario; json: string; meta: CustomScenarioMeta } => {
    const sourcePayload = imported.inputSnapshot || imported.inputPayload || imported.scenario;
    const mapped = buildBenchmarkMaskScenarioFromImportedJson(sourcePayload, {
        flowHint: imported.flow,
        defaultStartDate: defaultDates.startDate,
        defaultEndDate: defaultDates.endDate,
    });
    return {
        scenario: mapped.scenario || imported.scenario,
        json: JSON.stringify(sourcePayload, null, 2),
        meta: {
            source: imported.source,
            flow: imported.flow,
            tripId: imported.tripId || null,
        },
    };
};

export const buildPresetFromEditor = (
    editor: PresetEditorDraft,
    defaultDates: BenchmarkDefaultDates,
): BenchmarkPresetConfig => ({
    id: editor.id,
    name: editor.name.trim() || 'Custom benchmark preset',
    description: editor.description.trim(),
    kind: editor.mode === 'create' ? 'custom' : editor.kind,
    scenario: normalizeBenchmarkMaskScenario(editor.scenario, {
        defaultStartDate: defaultDates.startDate,
        defaultEndDate: defaultDates.endDate,
    }),
});

export const upsertPreset = (
    presets: BenchmarkPresetConfig[],
    preset: BenchmarkPresetConfig,
    mode: PresetEditorDraft['mode'],
): BenchmarkPresetConfig[] => (
    mode === 'create'
        ? [...presets, preset]
        : presets.map((entry) => (entry.id === preset.id ? preset : entry))
);

/* ------------------------------------------------------------------ */
/* Execution settings and the request                                  */
/* ------------------------------------------------------------------ */

export interface BenchmarkExecutionSettings {
    sessionName: string;
    timeoutSeconds: number;
    reasoningMode: BenchmarkReasoningMode;
    concurrency: number;
    modelReasoningModes: Record<string, BenchmarkReasoningMode>;
    compactOutput: boolean;
}

const clampTimeoutSeconds = (value: number): number => (
    Math.max(BENCHMARK_TIMEOUT_MIN_SECONDS, Math.min(BENCHMARK_TIMEOUT_MAX_SECONDS, value))
);

/** The time limit a run request carries; zero or garbage falls back to the default. */
export const resolveRunTimeoutSeconds = (value: unknown): number => (
    clampTimeoutSeconds(Math.round(Number(value) || BENCHMARK_TIMEOUT_DEFAULT_SECONDS))
);

/** What the "Time limit" field stores for what the admin typed. */
export const parseTimeoutInput = (raw: string): number => {
    const parsed = Number(raw);
    return Number.isFinite(parsed)
        ? clampTimeoutSeconds(Math.round(parsed))
        : BENCHMARK_TIMEOUT_DEFAULT_SECONDS;
};

export const setModelReasoningOverride = (
    current: Record<string, BenchmarkReasoningMode>,
    modelId: string,
    value: BenchmarkReasoningMode | undefined,
): Record<string, BenchmarkReasoningMode> => {
    if (value === undefined) {
        const next = { ...current };
        delete next[modelId];
        return next;
    }
    return { ...current, [modelId]: value };
};

/**
 * The scenario body of a run request. Throws when the template has no destination.
 * The preference signals come from the setup's mask as held, before normalizing.
 */
export const buildBenchmarkScenarioPayload = (
    mask: BenchmarkMaskScenario,
    execution: Pick<BenchmarkExecutionSettings, 'timeoutSeconds' | 'compactOutput' | 'reasoningMode'>,
    signals: Pick<BenchmarkMaskScenario, 'travelerSetup' | 'tripStyleMask' | 'transportMask' | 'routeLock'> = mask,
) => {
    const runtimeScenario = buildClassicBenchmarkScenario(mask, {
        compactOutput: execution.compactOutput,
    });
    const executionPayload = {
        timeoutSeconds: execution.timeoutSeconds,
        compactOutput: execution.compactOutput,
        reasoning: execution.reasoningMode,
    };

    return {
        prompt: runtimeScenario.prompt,
        startDate: runtimeScenario.startDate,
        roundTrip: runtimeScenario.roundTrip,
        input: {
            ...runtimeScenario.input,
            execution: { ...executionPayload },
        },
        metadata: {
            preference_signals: {
                travelerSetup: signals.travelerSetup,
                tripStyle: signals.tripStyleMask,
                transportPreference: signals.transportMask,
                routeLock: signals.routeLock,
            },
            baseline_defaults: BENCHMARK_BASELINE_PREFERENCE_DEFAULTS,
            execution: { ...executionPayload },
        },
    };
};

/** Each target with the reasoning effort its catalog model supports, when one applies. */
export const buildBenchmarkRequestTargets = (
    selected: AiBenchmarkRunTarget[],
    sortedModels: AiModelCatalogItem[],
    modelReasoningModes: Record<string, BenchmarkReasoningMode>,
    runReasoningMode: BenchmarkReasoningMode,
) => selected.map((target) => {
    const catalogModel = sortedModels.find((model) => (
        model.provider === target.provider && model.model === target.model
    ));
    const requestedReasoningMode = catalogModel
        ? modelReasoningModes[catalogModel.id] ?? runReasoningMode
        : runReasoningMode;
    const shouldConfigureReasoning = target.provider === 'openrouter'
        && catalogModel?.supportsReasoning === true
        && requestedReasoningMode !== 'provider-default';
    const reasoningEffort = shouldConfigureReasoning
        ? resolveSupportedReasoningEffort(
            requestedReasoningMode as AiReasoningEffort,
            catalogModel.reasoningEfforts,
            catalogModel.reasoningMandatory,
        )
        : undefined;
    return {
        ...target,
        ...(reasoningEffort ? { reasoningEffort } : {}),
    };
});

/** Placeholder rows shown while the request is in flight; ids start with `optimistic-`. */
export const buildOptimisticRuns = (
    targets: AiBenchmarkRunTarget[],
    existingRuns: BenchmarkRun[],
    options: { sessionId: string | undefined; startedAtIso: string; nowMs: number; createId: () => string },
): BenchmarkRun[] => targets.map((target, index) => {
    const nextRunIndex = existingRuns
        .filter((run) => run.provider === target.provider && run.model === target.model)
        .reduce((max, run) => Math.max(max, Number(run.run_index) || 0), 0) + 1;

    return {
        id: `optimistic-${options.createId()}`,
        session_id: options.sessionId || 'pending',
        provider: target.provider,
        model: target.model,
        label: target.label || `${target.provider}:${target.model}`,
        run_index: nextRunIndex,
        status: 'running',
        latency_ms: 0,
        schema_valid: null,
        usage: null,
        cost_usd: null,
        trip_id: null,
        error_message: null,
        satisfaction_rating: null,
        satisfaction_updated_at: null,
        run_comment: null,
        run_comment_updated_at: null,
        started_at: options.startedAtIso,
        finished_at: null,
        created_at: new Date(options.nowMs + index).toISOString(),
    };
});

export const markOptimisticRunsFailed = (runs: BenchmarkRun[], finishedAtIso: string): BenchmarkRun[] => runs.map((run) => {
    if (!run.id.startsWith('optimistic-')) return run;
    return {
        ...run,
        status: 'failed' as const,
        finished_at: finishedAtIso,
        error_message: 'Benchmark request failed before run completion.',
    };
});

export const describeRunRequest = (params: {
    targetCount: number;
    concurrency: number;
    timeoutSeconds: number;
    compactOutput: boolean;
    hasPending: boolean;
}): string => {
    const output = params.compactOutput ? 'compact' : 'standard';
    return params.hasPending
        ? `Queued ${params.targetCount} target(s) with up to ${params.concurrency} parallel (${params.timeoutSeconds}s timeout, ${output} output).`
        : `Executed ${params.targetCount} target(s) (${params.timeoutSeconds}s timeout, ${output} output).`;
};

export const describeCancelledRuns = (cancelledCount: number): string => (
    `Cancelled ${cancelledCount} active run${cancelledCount === 1 ? '' : 's'}.`
);

export const runToTarget = (run: BenchmarkRun): AiBenchmarkRunTarget => ({
    provider: run.provider,
    model: run.model,
    label: run.label || `${run.provider}:${run.model}`,
});

/* ------------------------------------------------------------------ */
/* Runs list                                                           */
/* ------------------------------------------------------------------ */

export const listRunProviders = (runs: BenchmarkRun[]): string[] => {
    const values = Array.from(new Set<string>(runs.flatMap((run) => (run.provider ? [run.provider] : []))));
    values.sort((left, right) => {
        const orderDelta = getAiProviderSortOrder(left) - getAiProviderSortOrder(right);
        if (orderDelta !== 0) return orderDelta;
        return getAiProviderMetadata(left).shortName.localeCompare(getAiProviderMetadata(right).shortName);
    });
    return values;
};

export const hasPendingBenchmarkRuns = (runs: BenchmarkRun[]): boolean => runs.some((run) => isRunActive(run));

export const hasExactRunCost = (runs: BenchmarkRun[]): boolean => (
    runs.some((run) => typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd))
);

/**
 * Keeps a note draft for every saved run: an existing draft survives a reload,
 * a new run starts from its saved note. Returns `current` when nothing changed.
 */
export const syncRunCommentDrafts = (
    current: Record<string, string>,
    runs: BenchmarkRun[],
): Record<string, string> => {
    const next: Record<string, string> = {};
    runs.forEach((run) => {
        if (!run.id || run.id.startsWith('optimistic-')) return;
        if (Object.prototype.hasOwnProperty.call(current, run.id)) {
            next[run.id] = current[run.id];
            return;
        }
        next[run.id] = run.run_comment || '';
    });

    const currentKeys = Object.keys(current);
    const nextKeys = Object.keys(next);
    if (
        currentKeys.length === nextKeys.length
        && currentKeys.every((key) => next[key] === current[key])
    ) {
        return current;
    }
    return next;
};

export const getModelCostEstimateLabel = (provider: string, model: string): string | null => {
    const match = AI_MODEL_CATALOG.find((entry) => entry.provider === provider && entry.model === model);
    return match?.estimatedCostPerQueryLabel || null;
};

export const buildRunJsonFileName = (run: BenchmarkRun): string => (
    `${run.provider}__${run.model}__run-${run.run_index}.json`.replace(/[^a-zA-Z0-9._-]+/g, '-')
);

export const buildSessionExportUrl = (sessionId: string, includeLogs: boolean): string => (
    includeLogs
        ? `/api/internal/ai/benchmark/export?session=${encodeURIComponent(sessionId)}&includeLogs=1`
        : `/api/internal/ai/benchmark/export?session=${encodeURIComponent(sessionId)}`
);

export const buildSessionExportFileName = (sessionName: string | null): string => (
    `${(sessionName || 'benchmark-session').replace(/[^a-zA-Z0-9._-]+/g, '-')}-exports.zip`
);

/** Tailwind classes for an average rating in the comparison table. */
export const getComparisonRatingClass = (averageRatingScore: number | null): string => (
    averageRatingScore === null
        ? 'text-muted-foreground'
        : averageRatingScore >= 2.5
            ? 'text-emerald-700 dark:text-emerald-200'
            : averageRatingScore >= 1.75
                ? 'text-amber-700 dark:text-amber-200'
                : 'text-rose-700 dark:text-rose-200'
);

/* ------------------------------------------------------------------ */
/* Model catalog                                                       */
/* ------------------------------------------------------------------ */

export interface ModelCatalogFilters {
    query: string;
    provider: string;
    capability: string;
    price: string;
}

export const DEFAULT_MODEL_CATALOG_FILTERS: ModelCatalogFilters = {
    query: '',
    provider: 'all',
    capability: 'all',
    price: 'all',
};

export const listActiveModelIds = (models: AiModelCatalogItem[]): Set<string> => (
    new Set(models.flatMap((model) => (model.availability === 'active' ? [model.id] : [])))
);

/** The benchmark defaults that are active, else the app default, else any active model. */
export const resolveDefaultBenchmarkModelTargetIds = (activeModelIdSet: Set<string>): string[] => {
    const defaults = BENCHMARK_DEFAULT_MODEL_IDS.filter((modelId) => activeModelIdSet.has(modelId));
    if (defaults.length > 0) return defaults;
    const runtimeDefault = getDefaultCreateTripModel().id;
    return activeModelIdSet.has(runtimeDefault) ? [runtimeDefault] : Array.from(activeModelIdSet).slice(0, 1);
};

/** The model list before preferences load: active bundled defaults, else the app default. */
export const getInitialBenchmarkModelTargetIds = (): string[] => {
    const defaults = BENCHMARK_DEFAULT_MODEL_IDS.filter((modelId) =>
        AI_MODEL_CATALOG.some((entry) => entry.id === modelId && entry.availability === 'active')
    );
    if (defaults.length > 0) return defaults;
    return [getDefaultCreateTripModel().id];
};

export const filterCatalogModels = (
    models: AiModelCatalogItem[],
    filters: ModelCatalogFilters,
    settings: Pick<AiRuntimeSettings, 'showOlderModels' | 'modelMaxAgeMonths'>,
): AiModelCatalogItem[] => {
    const token = filters.query.trim().toLocaleLowerCase();
    return models.filter((model) => {
        if (model.availability !== 'active') return false;
        if (!settings.showOlderModels && isAiModelOlderThanMonths(model, settings.modelMaxAgeMonths)) return false;
        if (filters.provider !== 'all' && model.providerLabel !== filters.provider) return false;
        if (filters.capability === 'structured' && model.supportsStructuredOutput !== true) return false;
        if (filters.capability === 'tools' && model.supportsTools !== true) return false;
        if (filters.capability === 'reasoning' && model.supportsReasoning !== true) return false;
        if (filters.price === 'free' && model.isFree !== true) return false;
        if (filters.price === 'budget' && (model.outputPricePerMillion === null || model.outputPricePerMillion === undefined || model.outputPricePerMillion > 5)) return false;
        if (filters.price === 'premium' && (model.outputPricePerMillion === null || model.outputPricePerMillion === undefined || model.outputPricePerMillion <= 5)) return false;
        if (!token) return true;
        return (
            model.providerLabel.toLocaleLowerCase().includes(token)
            || model.label.toLocaleLowerCase().includes(token)
            || model.model.toLocaleLowerCase().includes(token)
        );
    });
};

export const groupModelsByProviderLabel = (models: AiModelCatalogItem[]): Record<string, AiModelCatalogItem[]> => (
    models.reduce<Record<string, AiModelCatalogItem[]>>((groups, model) => {
        (groups[model.providerLabel] ||= []).push(model);
        return groups;
    }, {})
);

export const listModelProviderLabels = (models: AiModelCatalogItem[]): string[] => (
    Array.from(new Set<string>(models.map((model) => model.providerLabel))).sort((left, right) => left.localeCompare(right))
);

/** The selected ids that resolve to an active catalog model, de-duplicated, in order. */
export const resolveSelectedTargets = (modelTargetIds: string[], sortedModels: AiModelCatalogItem[]): AiModelCatalogItem[] => {
    const seen = new Set<string>();
    return modelTargetIds.flatMap((modelId) => {
        const model = sortedModels.find((entry) => entry.id === modelId);
        if (!model || model.availability !== 'active') return [];
        if (seen.has(model.id)) return [];
        seen.add(model.id);
        return [model];
    });
};

export const toggleModelId = (current: string[], modelId: string): string[] => (
    current.includes(modelId)
        ? current.filter((entry) => entry !== modelId)
        : [...current, modelId]
);

const OPENROUTER_PREFIX = 'openrouter:';

/** Approved OpenRouter slugs plus any newly picked live models. */
export const mergeApprovedOpenRouterModels = (approved: string[], modelIds: string[]): string[] => (
    Array.from(new Set([
        ...approved,
        ...modelIds.flatMap((modelId) => (modelId.startsWith(OPENROUTER_PREFIX) ? [modelId.slice(OPENROUTER_PREFIX.length)] : [])),
    ]))
);

/** The OpenRouter slugs of the picked ids that came from the live catalog. */
export const listNewlyApprovedLiveModels = (modelIds: string[], liveModelIds: Set<string>): string[] => (
    modelIds.flatMap((modelId) => (liveModelIds.has(modelId) ? [modelId.slice(OPENROUTER_PREFIX.length)] : []))
);

/* ------------------------------------------------------------------ */
/* Telemetry snapshot                                                  */
/* ------------------------------------------------------------------ */

export interface TelemetryLeaders {
    fastest: AiTelemetryModelPoint | null;
    cheapest: AiTelemetryModelPoint | null;
    bestValue: AiTelemetryModelPoint | null;
}

export const EMPTY_TELEMETRY_LEADERS: TelemetryLeaders = { fastest: null, cheapest: null, bestValue: null };

export const pickTelemetryLeaders = (payload: AiTelemetryApiResponse): TelemetryLeaders => ({
    fastest: Array.isArray(payload.rankings?.fastest) ? payload.rankings?.fastest[0] || null : null,
    cheapest: Array.isArray(payload.rankings?.cheapest) ? payload.rankings?.cheapest[0] || null : null,
    bestValue: Array.isArray(payload.rankings?.bestValue) ? payload.rankings?.bestValue[0] || null : null,
});

export interface TelemetrySnapshotCard {
    id: 'fastest' | 'cheapest' | 'value';
    title: string;
    model: AiTelemetryModelPoint | null;
    metric: string;
    detail: string;
}

export const buildTelemetrySnapshotCards = ({ fastest, cheapest, bestValue }: TelemetryLeaders): TelemetrySnapshotCard[] => ([
    {
        id: 'fastest',
        title: 'Fastest model',
        model: fastest,
        metric: fastest ? formatDuration(fastest.averageLatencyMs) : '—',
        detail: fastest ? `${fastest.successRate.toFixed(1)}% success` : 'No ranking data yet',
    },
    {
        id: 'cheapest',
        title: 'Lowest cost model',
        model: cheapest,
        metric: cheapest ? `${formatUsd(cheapest.averageCostUsd)} / call` : '—',
        detail: cheapest ? `${cheapest.successRate.toFixed(1)}% success` : 'No ranking data yet',
    },
    {
        id: 'value',
        title: 'Best cost-speed value',
        model: bestValue,
        metric: bestValue ? `${formatUsd(bestValue.costPerSecondUsd)} / sec` : '—',
        detail: bestValue
            ? `${formatDuration(bestValue.averageLatencyMs)} avg duration`
            : 'No ranking data yet',
    },
]);

/* ------------------------------------------------------------------ */
/* URL                                                                 */
/* ------------------------------------------------------------------ */

/** The query with `session` set to the lookup, or removed for null. Other keys keep their order. */
export const withSessionParam = (searchParams: URLSearchParams, sessionLookup: string | null): URLSearchParams => {
    const next = new URLSearchParams(searchParams);
    if (sessionLookup === null) {
        next.delete('session');
    } else {
        next.set('session', sessionLookup);
    }
    return next;
};

export const withoutImportParam = (searchParams: URLSearchParams): URLSearchParams => {
    const next = new URLSearchParams(searchParams);
    next.delete('import');
    return next;
};
