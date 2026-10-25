import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildInitialAdminAiRuntimeSettings } from '../components/admin/adminAiRuntimeSettingsDraft';
import { AdminUserFacingError, toAdminErrorMessage, toBenchmarkApiErrorSentence } from '../services/adminErrorMessages';
import { Link, useSearchParams } from '@/app/navigation';
import {
    Plus,
    ArrowClockwise,
    ArrowSquareOut,
    ArrowsDownUp,
    CheckCircle,
    DotsThree,
    DownloadSimple,
    Funnel,
    Info,
    NotePencil,
    Play,
    StopCircle,
    ToggleLeft,
    ToggleRight,
    Trash,
    X,
} from '@phosphor-icons/react';
import Prism from 'prismjs';
if (typeof window !== 'undefined') {
    (window as any).Prism = (window as any).Prism || Prism;
}
import 'prismjs/components/prism-json';
import {
    AI_MODEL_CATALOG,
    getDefaultCreateTripModel,
    registerRuntimeAiModels,
    sortAiModels,
    type AiModelCatalogItem,
} from '../config/aiModelCatalog';
import { getAiProviderMetadata, getAiProviderSortOrder } from '../config/aiProviderCatalog';
import { type GenerateOptions } from '../services/aiService';
import { buildClassicBenchmarkScenario } from '../services/aiBenchmarkClassicScenarioService';
import { buildDangerConfirmDialog } from '../services/appDialogPresets';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    BENCHMARK_DEFAULT_MODEL_IDS,
    createSystemBenchmarkPresets,
    normalizeBenchmarkMaskScenario,
    normalizeBenchmarkPreferencesPayload,
    type BenchmarkMaskScenario,
    type BenchmarkPreferencesPayload,
    type BenchmarkPresetConfig,
} from '../services/aiBenchmarkPreferencesService';
import {
    buildBenchmarkMaskScenarioFromImportedJson,
    decodeBenchmarkScenarioImportPayload,
} from '../services/tripGenerationBenchmarkBridge';
import { dbGetAccessToken, ensureDbSession } from '../services/dbService';
import { getDefaultTripDates } from '../utils';
import {
    buildRunnableBenchmarkTargets,
    getAllSelectedBenchmarkTargetIds,
    pruneInactiveBenchmarkTargetIds,
    toggleInactiveBenchmarkTargetId,
    type AiBenchmarkRunTarget,
} from '../utils/aiBenchmarkTargets';
import { useAuth } from '../hooks/useAuth';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AiModelPicker } from '../components/admin/AiModelPicker';
import { AiProviderLabel as ProviderLabel, AiProviderLogo } from '../components/admin/AiProviderLogo';
import { AiBenchmarkRunSheet, RunLatency, RunRatingButtons } from '../components/admin/AiBenchmarkRunSheet';
import {
    BENCHMARK_RUN_COMMENT_MAX_LENGTH,
    DEFAULT_BENCHMARK_RUN_FILTERS,
    buildModelComparisonRows,
    countUnratedCompletedRuns,
    filterAndSortBenchmarkRuns,
    formatDuration,
    formatRelativeTime,
    formatTimestamp,
    formatUsd,
    getRunStatusMeta,
    getRunTimestampIso,
    getRunValidationVerdict,
    getValidationCheckStats,
    getValidationWarnings,
    hasActiveBenchmarkRunFilter,
    hasRunValidationDetails,
    isOptimisticRun,
    isRunActive,
    normalizeRunCommentDraft,
    parseRunError,
    resolveAiBenchmarkWorkspaceTab,
    summarizeRunsLocal,
    type AiBenchmarkWorkspaceTab,
    type BenchmarkRun,
    type BenchmarkRunFilters,
    type BenchmarkSummary,
    type RunSortDirection,
    type SatisfactionRating,
} from '../components/admin/aiBenchmarkRuns';
import { useAppDialog } from '../components/AppDialogProvider';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AppModal } from '../components/ui/app-modal';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { SearchInput } from '../components/ui/search-input';
import { Spinner } from '../components/ui/spinner';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
    isAiModelOlderThanMonths,
    mergeAiModelCatalogs,
    type OpenRouterCatalogModel,
} from '../services/openRouterModelCatalogService';
import {
    applyAiRuntimeSettings,
    type AiRuntimeSettings,
} from '../services/aiRuntimeSettingsService';
import {
    AI_REASONING_EFFORTS,
    resolveSupportedReasoningEffort,
    type AiReasoningEffort,
} from '../shared/aiReasoning';

interface BenchmarkSession {
    id: string;
    share_token: string;
    name: string | null;
    flow: string;
    scenario: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

interface BenchmarkApiResponse {
    ok: boolean;
    async?: boolean;
    cancelled?: number;
    session?: BenchmarkSession;
    runs?: BenchmarkRun[];
    run?: BenchmarkRun;
    summary?: BenchmarkSummary;
    sessions?: BenchmarkSession[];
    error?: string;
    code?: string;
    details?: string;
}

interface AiTelemetrySummary {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
    averageCostUsd: number | null;
}

interface AiTelemetryModelPoint {
    provider: string;
    model: string;
    key: string;
    total: number;
    success: number;
    failed: number;
    successRate: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
    averageCostUsd: number | null;
    costPerSecondUsd: number | null;
}

interface AiTelemetryApiResponse {
    ok: boolean;
    error?: string;
    summary?: AiTelemetrySummary;
    rankings?: {
        fastest?: AiTelemetryModelPoint[];
        cheapest?: AiTelemetryModelPoint[];
        bestValue?: AiTelemetryModelPoint[];
    };
}

interface BenchmarkPreferencesApiResponse extends BenchmarkApiResponse {
    preferences?: BenchmarkPreferencesPayload;
    updatedAt?: string | null;
}

interface BenchmarkModelsApiResponse extends BenchmarkApiResponse {
    models?: OpenRouterCatalogModel[];
    settings?: AiRuntimeSettings;
}

interface PresetEditorDraft {
    mode: 'edit' | 'create';
    id: string;
    kind: 'system' | 'custom';
    name: string;
    description: string;
    scenario: BenchmarkMaskScenario;
}

const DEFAULT_SESSION_NAME = 'AI benchmark session';
const CUSTOM_JSON_PRESET_ID = '__custom_json__';
const CUSTOM_JSON_PRESET_NAME = 'Custom JSON import';
const BENCHMARK_CONCURRENCY_DEFAULT = 2;
const BENCHMARK_CONCURRENCY_MAX = 5;
const BENCHMARK_TIMEOUT_MIN_SECONDS = 20;
const BENCHMARK_TIMEOUT_MAX_SECONDS = 180;
const BENCHMARK_TIMEOUT_DEFAULT_SECONDS = 60;
type BenchmarkReasoningMode = 'provider-default' | AiReasoningEffort;
const REASONING_MODE_LABELS: Record<BenchmarkReasoningMode, string> = {
    'provider-default': 'Model default',
    none: 'Off',
    minimal: 'Minimal',
    low: 'Low · fastest',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Extra high',
    max: 'Maximum',
};
const COST_ESTIMATE_FOOTNOTE = 'Estimate for one classic itinerary generation; real cost varies by prompt/output size.';
const BENCHMARK_BASELINE_PREFERENCE_DEFAULTS = {
    travelerSetup: 'solo',
    tripStyle: 'everything_except_remote_work',
    transportPreference: 'automatic',
};

const ModelReasoningSelect: React.FC<{
    model: AiModelCatalogItem;
    runDefault: BenchmarkReasoningMode;
    value?: BenchmarkReasoningMode;
    onChange: (value: BenchmarkReasoningMode | undefined) => void;
}> = ({ model, runDefault, value, onChange }) => {
    const isConfigurable = model.provider === 'openrouter' && model.supportsReasoning === true;
    if (!isConfigurable) {
        return <span className="text-xs text-muted-foreground">Not configurable</span>;
    }

    const supportedEfforts = (model.reasoningEfforts?.length ? model.reasoningEfforts : AI_REASONING_EFFORTS)
        .filter((effort) => !model.reasoningMandatory || effort !== 'none');

    return (
        <Select value={value || 'inherit'} onValueChange={(nextValue) => onChange(nextValue === 'inherit' ? undefined : nextValue as BenchmarkReasoningMode)}>
            <SelectTrigger aria-label={`${model.label} reasoning`} className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectItem value="inherit">Run default · {REASONING_MODE_LABELS[runDefault]}</SelectItem>
                    <SelectItem value="provider-default">Model default</SelectItem>
                    {supportedEfforts.map((effort) => (
                        <SelectItem key={effort} value={effort}>{REASONING_MODE_LABELS[effort]}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

export const AdminAiBenchmarkPage: React.FC = () => {
    const defaultDates = useMemo(() => getDefaultTripDates(), []);
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated } = useAuth();
    const { confirm: confirmDialog } = useAppDialog();

    const [accessToken, setAccessToken] = useState<string | null>(null);

    const [destinations, setDestinations] = useState('Japan');
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [dateInputMode, setDateInputMode] = useState<'exact' | 'flex'>('exact');
    const [flexWeeks, setFlexWeeks] = useState(2);
    const [flexWindow, setFlexWindow] = useState<'spring' | 'summer' | 'autumn' | 'winter' | 'shoulder'>('shoulder');
    const [budget, setBudget] = useState('Medium');
    const [pace, setPace] = useState('Balanced');
    const [specificCities, setSpecificCities] = useState('');
    const [notes, setNotes] = useState('');
    const [numCities, setNumCities] = useState<number | ''>('');
    const [roundTrip, setRoundTrip] = useState(true);
    const [routeLock, setRouteLock] = useState(false);
    const [travelerSetup, setTravelerSetup] = useState<'solo' | 'couple' | 'friends' | 'family'>('solo');
    const [tripStyleMask, setTripStyleMask] = useState<'everything_except_remote_work' | 'culture_focused' | 'food_focused'>('everything_except_remote_work');
    const [transportMask, setTransportMask] = useState<'automatic' | 'plane' | 'train' | 'camper'>('automatic');
    const [sessionName, setSessionName] = useState(DEFAULT_SESSION_NAME);
    const [benchmarkTimeoutSeconds, setBenchmarkTimeoutSeconds] = useState(BENCHMARK_TIMEOUT_DEFAULT_SECONDS);
    const [benchmarkReasoningMode, setBenchmarkReasoningMode] = useState<BenchmarkReasoningMode>('low');
    const [benchmarkConcurrency, setBenchmarkConcurrency] = useState(BENCHMARK_CONCURRENCY_DEFAULT);
    const [modelReasoningModes, setModelReasoningModes] = useState<Record<string, BenchmarkReasoningMode>>({});
    const [compactBenchmarkOutput, setCompactBenchmarkOutput] = useState(true);
    // null until the admin picks a tab: then a loaded session opens on its results.
    const [workspaceTab, setWorkspaceTab] = useState<AiBenchmarkWorkspaceTab | null>(null);

    const [modelFilter, setModelFilter] = useState('');
    const [modelProviderFilter, setModelProviderFilter] = useState('all');
    const [modelCapabilityFilter, setModelCapabilityFilter] = useState('all');
    const [modelPriceFilter, setModelPriceFilter] = useState('all');
    const [liveOpenRouterModels, setLiveOpenRouterModels] = useState<OpenRouterCatalogModel[]>([]);
    // Start from the service defaults: saving before the server answers posts the
    // whole object, so map style and runtime preset must never be undefined.
    const [aiRuntimeSettings, setAiRuntimeSettings] = useState<AiRuntimeSettings>(
        () => buildInitialAdminAiRuntimeSettings(getDefaultCreateTripModel().id),
    );
    const [modelCatalogLoading, setModelCatalogLoading] = useState(false);
    const [modelCatalogLoaded, setModelCatalogLoaded] = useState(false);
    const [modelTargetIds, setModelTargetIds] = useState<string[]>(() => {
        const defaults = BENCHMARK_DEFAULT_MODEL_IDS.filter((modelId) =>
            AI_MODEL_CATALOG.some((entry) => entry.id === modelId && entry.availability === 'active')
        );
        if (defaults.length > 0) return defaults;
        return [getDefaultCreateTripModel().id];
    });
    const [inactiveModelTargetIds, setInactiveModelTargetIds] = useState<string[]>([]);
    const [modelModalOpen, setModelModalOpen] = useState(false);
    const [modelDraftIds, setModelDraftIds] = useState<string[]>([]);
    const [templateDetailsOpen, setTemplateDetailsOpen] = useState(false);
    const [presetEditor, setPresetEditor] = useState<PresetEditorDraft | null>(null);
    const [customScenarioJsonDraft, setCustomScenarioJsonDraft] = useState('');
    const [customScenarioMeta, setCustomScenarioMeta] = useState<{
        source: 'trip_info' | 'admin_trip_drawer' | 'manual';
        flow: 'classic' | 'wizard' | 'surprise' | 'unknown';
        tripId: string | null;
    } | null>(null);
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const [runFilters, setRunFilters] = useState<BenchmarkRunFilters>(DEFAULT_BENCHMARK_RUN_FILTERS);
    const [runSortDirection, setRunSortDirection] = useState<RunSortDirection>('desc');
    const [inspectedRunId, setInspectedRunId] = useState<string | null>(null);
    const [ratingSavingRunId, setRatingSavingRunId] = useState<string | null>(null);
    const [commentSavingRunId, setCommentSavingRunId] = useState<string | null>(null);
    const [runCommentDrafts, setRunCommentDrafts] = useState<Record<string, string>>({});
    const [promptModal, setPromptModal] = useState<{ prompt: string; generatedAt: string } | null>(null);

    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [session, setSession] = useState<BenchmarkSession | null>(null);
    const [runs, setRuns] = useState<BenchmarkRun[]>([]);
    const [summary, setSummary] = useState<BenchmarkSummary | null>(null);
    const [snapshotTelemetryLoading, setSnapshotTelemetryLoading] = useState(false);
    const [snapshotTelemetryError, setSnapshotTelemetryError] = useState<string | null>(null);
    const [snapshotTelemetrySummary, setSnapshotTelemetrySummary] = useState<AiTelemetrySummary | null>(null);
    const [snapshotFastestModel, setSnapshotFastestModel] = useState<AiTelemetryModelPoint | null>(null);
    const [snapshotCheapestModel, setSnapshotCheapestModel] = useState<AiTelemetryModelPoint | null>(null);
    const [snapshotBestValueModel, setSnapshotBestValueModel] = useState<AiTelemetryModelPoint | null>(null);
    const [presetConfigs, setPresetConfigs] = useState<BenchmarkPresetConfig[]>(() => createSystemBenchmarkPresets(defaultDates.startDate, defaultDates.endDate));
    const [selectedPresetId, setSelectedPresetId] = useState(() => {
        const presets = createSystemBenchmarkPresets(defaultDates.startDate, defaultDates.endDate);
        return presets[0]?.id || '';
    });
    const latestSessionBootstrapRef = useRef(false);
    const resultsSectionRef = useRef<HTMLDivElement | null>(null);
    const hasPendingRunsRef = useRef(false);
    const handledImportTokenRef = useRef<string | null>(null);
    const pendingImportedScenarioRef = useRef<ReturnType<typeof decodeBenchmarkScenarioImportPayload> | null>(null);

    const sortedModels = useMemo(
        () => sortAiModels(mergeAiModelCatalogs(AI_MODEL_CATALOG, liveOpenRouterModels)),
        [liveOpenRouterModels],
    );
    const activeModelIdSet = useMemo(
        () => new Set(sortedModels.flatMap((model) => (model.availability === 'active' ? [model.id] : []))),
        [sortedModels],
    );
    const defaultPresets = useMemo(
        () => createSystemBenchmarkPresets(defaultDates.startDate, defaultDates.endDate),
        [defaultDates.endDate, defaultDates.startDate]
    );
    const defaultModelTargetIds = useMemo(() => {
        const defaults = BENCHMARK_DEFAULT_MODEL_IDS.filter((modelId) => activeModelIdSet.has(modelId));
        if (defaults.length > 0) return defaults;
        const runtimeDefault = getDefaultCreateTripModel().id;
        return activeModelIdSet.has(runtimeDefault) ? [runtimeDefault] : Array.from(activeModelIdSet).slice(0, 1);
    }, [activeModelIdSet]);

    const filteredModels = useMemo(() => {
        const token = modelFilter.trim().toLocaleLowerCase();
        return sortedModels.filter((model) => {
            if (model.availability !== 'active') return false;
            if (!aiRuntimeSettings.showOlderModels && isAiModelOlderThanMonths(model, aiRuntimeSettings.modelMaxAgeMonths)) return false;
            if (modelProviderFilter !== 'all' && model.providerLabel !== modelProviderFilter) return false;
            if (modelCapabilityFilter === 'structured' && model.supportsStructuredOutput !== true) return false;
            if (modelCapabilityFilter === 'tools' && model.supportsTools !== true) return false;
            if (modelCapabilityFilter === 'reasoning' && model.supportsReasoning !== true) return false;
            if (modelPriceFilter === 'free' && model.isFree !== true) return false;
            if (modelPriceFilter === 'budget' && (model.outputPricePerMillion === null || model.outputPricePerMillion === undefined || model.outputPricePerMillion > 5)) return false;
            if (modelPriceFilter === 'premium' && (model.outputPricePerMillion === null || model.outputPricePerMillion === undefined || model.outputPricePerMillion <= 5)) return false;
            if (!token) return true;
            return (
                model.providerLabel.toLocaleLowerCase().includes(token)
                || model.label.toLocaleLowerCase().includes(token)
                || model.model.toLocaleLowerCase().includes(token)
            );
        });
    }, [
        aiRuntimeSettings.modelMaxAgeMonths,
        aiRuntimeSettings.showOlderModels,
        modelCapabilityFilter,
        modelFilter,
        modelPriceFilter,
        modelProviderFilter,
        sortedModels,
    ]);

    const groupedModels = useMemo(() => filteredModels.reduce<Record<string, AiModelCatalogItem[]>>((groups, model) => {
        (groups[model.providerLabel] ||= []).push(model);
        return groups;
    }, {}), [filteredModels]);
    const modelProviderOptions = useMemo(
        () => Array.from(new Set<string>(sortedModels.map((model) => model.providerLabel))).sort((left, right) => left.localeCompare(right)),
        [sortedModels],
    );

    const selectedTargets = useMemo(() => {
        const seen = new Set<string>();
        return modelTargetIds.flatMap((modelId) => {
            const model = sortedModels.find((entry) => entry.id === modelId);
            if (!model || model.availability !== 'active') return [];
            if (seen.has(model.id)) return [];
            seen.add(model.id);
            return [model];
        });
    }, [modelTargetIds, sortedModels]);
    const selectedTargetIdSet = useMemo(() => new Set(selectedTargets.map((target) => target.id)), [selectedTargets]);
    const inactiveTargetIdSet = useMemo(() => new Set(inactiveModelTargetIds), [inactiveModelTargetIds]);
    const runnableTargets = useMemo(
        () => buildRunnableBenchmarkTargets(selectedTargets, inactiveModelTargetIds),
        [inactiveModelTargetIds, selectedTargets]
    );
    const allTargetsActive = selectedTargets.length > 0 && runnableTargets.length === selectedTargets.length;
    const allTargetsInactive = selectedTargets.length > 0 && runnableTargets.length === 0;
    const reasoningTargets = useMemo(
        () => selectedTargets.filter((model) => model.supportsReasoning === true),
        [selectedTargets],
    );
    const customScenarioDraftParse = useMemo(() => {
        const flowHint = customScenarioMeta?.flow || 'unknown';
        if (!customScenarioJsonDraft.trim()) {
            return {
                scenario: null as BenchmarkMaskScenario | null,
                flow: flowHint,
                error: null as string | null,
            };
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(customScenarioJsonDraft);
        } catch {
            return {
                scenario: null as BenchmarkMaskScenario | null,
                flow: flowHint,
                error: 'Custom JSON is not valid JSON.',
            };
        }

        const mapped = buildBenchmarkMaskScenarioFromImportedJson(parsed, {
            flowHint,
            defaultStartDate: defaultDates.startDate,
            defaultEndDate: defaultDates.endDate,
        });
        if (!mapped.scenario) {
            return {
                scenario: null as BenchmarkMaskScenario | null,
                flow: mapped.flow,
                error: 'Custom JSON could not be mapped to a benchmark mask. Use a scenario object or a trip generation payload.',
            };
        }
        return {
            scenario: mapped.scenario,
            flow: mapped.flow,
            error: null as string | null,
        };
    }, [customScenarioJsonDraft, customScenarioMeta?.flow, defaultDates.endDate, defaultDates.startDate]);

    const selectedPreset = useMemo(() => {
        if (selectedPresetId === CUSTOM_JSON_PRESET_ID) {
            return {
                id: CUSTOM_JSON_PRESET_ID,
                kind: 'custom',
                name: CUSTOM_JSON_PRESET_NAME,
                description: customScenarioMeta
                    ? `Imported from ${customScenarioMeta.source === 'trip_info' ? 'Trip Info' : customScenarioMeta.source === 'admin_trip_drawer' ? 'Admin Trip Drawer' : 'manual input'}`
                    : 'Paste a benchmark scenario JSON payload and apply it to the mask.',
                scenario: customScenarioDraftParse.scenario || normalizeBenchmarkMaskScenario({}, {
                    defaultStartDate: defaultDates.startDate,
                    defaultEndDate: defaultDates.endDate,
                }),
            } as BenchmarkPresetConfig;
        }
        return presetConfigs.find((preset) => preset.id === selectedPresetId) || null;
    }, [
        customScenarioDraftParse.scenario,
        customScenarioMeta,
        defaultDates.endDate,
        defaultDates.startDate,
        presetConfigs,
        selectedPresetId,
    ]);
    const selectedTemplateJson = useMemo(() => (
        selectedPresetId === CUSTOM_JSON_PRESET_ID && customScenarioJsonDraft.trim()
            ? customScenarioJsonDraft
            : JSON.stringify(selectedPreset?.scenario || {}, null, 2)
    ), [customScenarioJsonDraft, selectedPreset?.scenario, selectedPresetId]);
    const selectedTemplateJsonHtml = useMemo(() => Prism.highlight(
        selectedTemplateJson,
        Prism.languages.json,
        'json',
    ), [selectedTemplateJson]);

    const providerOptions = useMemo(() => {
        const values = Array.from(new Set<string>(runs.flatMap((run) => (run.provider ? [run.provider] : []))));
        values.sort((left, right) => {
            const orderDelta = getAiProviderSortOrder(left) - getAiProviderSortOrder(right);
            if (orderDelta !== 0) return orderDelta;
            return getAiProviderMetadata(left).shortName.localeCompare(getAiProviderMetadata(right).shortName);
        });
        return values;
    }, [runs]);

    const hasPendingRuns = useMemo(() => runs.some((run) => isRunActive(run)), [runs]);
    const hasExactCostData = useMemo(() => runs.some((run) => typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd)), [runs]);

    useEffect(() => {
        setRunCommentDrafts((current) => {
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
        });
    }, [runs]);

    const displayRuns = useMemo(
        () => filterAndSortBenchmarkRuns(runs, runFilters, runSortDirection),
        [runs, runFilters, runSortDirection],
    );
    const runFiltersActive = hasActiveBenchmarkRunFilter(runFilters);
    const unratedRunCount = useMemo(() => countUnratedCompletedRuns(runs), [runs]);
    const inspectedRun = useMemo(
        () => (inspectedRunId ? runs.find((run) => run.id === inspectedRunId) ?? null : null),
        [inspectedRunId, runs],
    );

    const modelComparisonRows = useMemo(() => buildModelComparisonRows(runs), [runs]);

    const benchmarkSessionParam = (searchParams.get('session') || '').trim();

    const applyMaskScenario = useCallback((scenario: BenchmarkMaskScenario) => {
        setDestinations(scenario.destinations);
        setDateInputMode(scenario.dateInputMode);
        setStartDate(scenario.startDate || defaultDates.startDate);
        setEndDate(scenario.endDate || defaultDates.endDate);
        setFlexWeeks(scenario.flexWeeks);
        setFlexWindow(scenario.flexWindow);
        setBudget(scenario.budget);
        setPace(scenario.pace);
        setSpecificCities(scenario.specificCities);
        setNotes(scenario.notes);
        setNumCities(typeof scenario.numCities === 'number' ? scenario.numCities : '');
        setRoundTrip(scenario.roundTrip);
        setRouteLock(scenario.routeLock);
        setTravelerSetup(scenario.travelerSetup);
        setTripStyleMask(scenario.tripStyleMask);
        setTransportMask(scenario.transportMask);
    }, [defaultDates.endDate, defaultDates.startDate]);

    const readMaskScenario = useCallback((): BenchmarkMaskScenario => {
        return normalizeBenchmarkMaskScenario({
            destinations,
            dateInputMode,
            startDate,
            endDate,
            flexWeeks,
            flexWindow,
            budget,
            pace,
            specificCities,
            notes,
            numCities: typeof numCities === 'number' ? numCities : null,
            roundTrip,
            routeLock,
            travelerSetup,
            tripStyleMask,
            transportMask,
        }, {
            defaultStartDate: defaultDates.startDate,
            defaultEndDate: defaultDates.endDate,
        });
    }, [
        budget,
        dateInputMode,
        defaultDates.endDate,
        defaultDates.startDate,
        destinations,
        endDate,
        flexWeeks,
        flexWindow,
        notes,
        numCities,
        pace,
        routeLock,
        roundTrip,
        specificCities,
        startDate,
        travelerSetup,
        transportMask,
        tripStyleMask,
    ]);

    const loadCurrentMaskIntoCustomJson = useCallback((meta?: {
        source: 'trip_info' | 'admin_trip_drawer' | 'manual';
        flow: 'classic' | 'wizard' | 'surprise' | 'unknown';
        tripId: string | null;
    }) => {
        const scenario = readMaskScenario();
        setCustomScenarioJsonDraft(JSON.stringify(scenario, null, 2));
        setCustomScenarioMeta(meta || {
            source: 'manual',
            flow: 'unknown',
            tripId: null,
        });
    }, [readMaskScenario]);

    const applyImportedScenario = useCallback((imported: NonNullable<ReturnType<typeof decodeBenchmarkScenarioImportPayload>>) => {
        const sourcePayload = imported.inputSnapshot || imported.inputPayload || imported.scenario;
        const mapped = buildBenchmarkMaskScenarioFromImportedJson(sourcePayload, {
            flowHint: imported.flow,
            defaultStartDate: defaultDates.startDate,
            defaultEndDate: defaultDates.endDate,
        });
        const scenarioToApply = mapped.scenario || imported.scenario;
        applyMaskScenario(scenarioToApply);
        setCustomScenarioJsonDraft(JSON.stringify(sourcePayload, null, 2));
        setCustomScenarioMeta({
            source: imported.source,
            flow: imported.flow,
            tripId: imported.tripId || null,
        });
        setSelectedPresetId(CUSTOM_JSON_PRESET_ID);
        setError(null);
        const sourceLabel = imported.source === 'trip_info' ? 'Trip Info' : 'Admin Trip Drawer';
        setMessage(
            `Imported benchmark scenario (${imported.flow}) from ${sourceLabel}${imported.tripId ? ` for trip ${imported.tripId}` : ''}.`
        );
    }, [applyMaskScenario, defaultDates.endDate, defaultDates.startDate]);

    const applyCustomJsonToMask = useCallback(() => {
        if (!customScenarioDraftParse.scenario) {
            setError(customScenarioDraftParse.error || 'Custom JSON could not be mapped to a benchmark mask.');
            return;
        }
        applyMaskScenario(customScenarioDraftParse.scenario);
        setError(null);
        setMessage(`Custom JSON applied to benchmark mask (${customScenarioDraftParse.flow}).`);
    }, [applyMaskScenario, customScenarioDraftParse.error, customScenarioDraftParse.flow, customScenarioDraftParse.scenario]);

    const normalizePreferencesForClient = useCallback((
        value: unknown,
        options?: { mergeFallbackModelIds?: boolean },
    ): BenchmarkPreferencesPayload => {
        return normalizeBenchmarkPreferencesPayload(value, {
            fallbackPresets: defaultPresets,
            defaultStartDate: defaultDates.startDate,
            defaultEndDate: defaultDates.endDate,
            fallbackModelIds: defaultModelTargetIds,
            allowedModelIds: activeModelIdSet,
            mergeFallbackModelIds: options?.mergeFallbackModelIds,
        });
    }, [activeModelIdSet, defaultDates.endDate, defaultDates.startDate, defaultModelTargetIds, defaultPresets]);

    useEffect(() => {
        void import('prismjs/themes/prism-tomorrow.css');
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            setAccessToken(null);
            setPreferencesLoaded(false);
            return;
        }
        let cancelled = false;

        const bootstrapAuth = async () => {
            await ensureDbSession();
            const token = await dbGetAccessToken();
            if (!cancelled) {
                setAccessToken(token);
            }
        };

        bootstrapAuth();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    const fetchBenchmarkApi = useCallback(async (path: string, init?: RequestInit): Promise<BenchmarkApiResponse> => {
        if (!accessToken) {
            throw new Error('No Supabase session access token found. Refresh and try again.');
        }

        const headers = new Headers(init?.headers || {});
        headers.set('Content-Type', 'application/json');
        headers.set('Authorization', `Bearer ${accessToken}`);

        const response = await fetch(path, {
            ...init,
            headers,
        });

        const raw = await response.text();
        let payload: BenchmarkApiResponse;
        try {
            payload = (raw ? JSON.parse(raw) : { ok: response.ok }) as BenchmarkApiResponse;
        } catch {
            // A non-JSON body is a gateway or timeout page, never an authored message.
            payload = { ok: response.ok };
        }
        if (!response.ok) {
            if (response.status === 404 && path.startsWith('/api/internal/ai/benchmark')) {
                throw new AdminUserFacingError(
                    'AI Benchmark API is unavailable (404). Start the app with `pnpm dev:netlify` and open the benchmark from http://localhost:8888.'
                );
            }
            throw new AdminUserFacingError(toBenchmarkApiErrorSentence(payload.error, response.status));
        }

        return payload;
    }, [accessToken]);

    const loadModelCatalog = useCallback(async (options?: { silent?: boolean }) => {
        if (!accessToken) return;
        setModelCatalogLoading(true);
        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/models', { method: 'GET' }) as BenchmarkModelsApiResponse;
            const models = Array.isArray(payload.models) ? payload.models : [];
            setLiveOpenRouterModels(models);
            registerRuntimeAiModels(models);
            if (payload.settings) {
                setAiRuntimeSettings(payload.settings);
                applyAiRuntimeSettings(payload.settings, models);
            }
            if (!options?.silent) {
                setMessage(`OpenRouter catalog refreshed: ${models.length} compatible models available.`);
            }
        } catch (catalogError) {
            if (!options?.silent) {
                setError(toAdminErrorMessage(catalogError, 'Could not refresh the OpenRouter model catalog.', 'admin-ai-benchmark'));
            }
        } finally {
            setModelCatalogLoading(false);
            setModelCatalogLoaded(true);
        }
    }, [accessToken, fetchBenchmarkApi]);

    useEffect(() => {
        if (!accessToken) {
            setModelCatalogLoaded(false);
            return;
        }
        void loadModelCatalog({ silent: true });
    }, [accessToken, loadModelCatalog]);

    useEffect(() => {
        const encodedImport = (searchParams.get('import') || '').trim();
        if (!encodedImport) return;
        if (handledImportTokenRef.current === encodedImport) return;
        handledImportTokenRef.current = encodedImport;

        const imported = decodeBenchmarkScenarioImportPayload(encodedImport);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('import');
        setSearchParams(nextParams, { replace: true });

        if (!imported) {
            setError('Could not import benchmark scenario from trip diagnostics. The payload is invalid.');
            return;
        }
        if (!preferencesLoaded) {
            pendingImportedScenarioRef.current = imported;
            return;
        }
        applyImportedScenario(imported);
    }, [applyImportedScenario, preferencesLoaded, searchParams, setSearchParams]);

    useEffect(() => {
        if (!preferencesLoaded) return;
        const pendingImport = pendingImportedScenarioRef.current;
        if (!pendingImport) return;
        pendingImportedScenarioRef.current = null;
        applyImportedScenario(pendingImport);
    }, [applyImportedScenario, preferencesLoaded]);

    const savePreferences = useCallback(async (
        nextOverrides?: Partial<BenchmarkPreferencesPayload>,
        options?: { silent?: boolean }
    ): Promise<BenchmarkPreferencesPayload | null> => {
        if (!accessToken) return null;

        try {
            const requestedSelectedPresetId = nextOverrides?.selectedPresetId ?? selectedPresetId;
            const persistedSelectedPresetId = requestedSelectedPresetId === CUSTOM_JSON_PRESET_ID
                ? (presetConfigs[0]?.id || defaultPresets[0]?.id || '')
                : requestedSelectedPresetId;
            const draft = normalizePreferencesForClient({
                modelTargets: nextOverrides?.modelTargets ?? modelTargetIds,
                presets: nextOverrides?.presets ?? presetConfigs,
                selectedPresetId: persistedSelectedPresetId,
            });

            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/preferences', {
                method: 'POST',
                body: JSON.stringify(draft),
            }) as BenchmarkPreferencesApiResponse;

            const normalized = normalizePreferencesForClient(payload.preferences || draft);
            setModelTargetIds(normalized.modelTargets);
            setPresetConfigs(normalized.presets);
            setSelectedPresetId(requestedSelectedPresetId === CUSTOM_JSON_PRESET_ID ? CUSTOM_JSON_PRESET_ID : normalized.selectedPresetId);
            if (!options?.silent) {
                setMessage('Benchmark preferences saved.');
            }
            return normalized;
        } catch (saveError) {
            setError(toAdminErrorMessage(saveError, 'Failed to save benchmark preferences.', 'admin-ai-benchmark'));
            return null;
        }
    }, [
        accessToken,
        fetchBenchmarkApi,
        modelTargetIds,
        normalizePreferencesForClient,
        presetConfigs,
        defaultPresets,
        selectedPresetId,
    ]);

    const loadPreferences = useCallback(async () => {
        if (!accessToken) return;

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/preferences', {
                method: 'GET',
            }) as BenchmarkPreferencesApiResponse;

            const normalized = normalizePreferencesForClient(payload.preferences || {}, {
                mergeFallbackModelIds: true,
            });
            setModelTargetIds(normalized.modelTargets);
            setPresetConfigs(normalized.presets);
            setSelectedPresetId(normalized.selectedPresetId);
            const preset = normalized.presets.find((entry) => entry.id === normalized.selectedPresetId) || normalized.presets[0];
            if (preset) {
                applyMaskScenario(preset.scenario);
            }
        } catch (preferencesError) {
            setError(toAdminErrorMessage(preferencesError, 'Failed to load benchmark preferences', 'admin-ai-benchmark'));
            const fallback = normalizePreferencesForClient({});
            setModelTargetIds(fallback.modelTargets);
            setPresetConfigs(fallback.presets);
            setSelectedPresetId(fallback.selectedPresetId);
            const preset = fallback.presets.find((entry) => entry.id === fallback.selectedPresetId) || fallback.presets[0];
            if (preset) {
                applyMaskScenario(preset.scenario);
            }
        } finally {
            setPreferencesLoaded(true);
        }
    }, [accessToken, applyMaskScenario, fetchBenchmarkApi, normalizePreferencesForClient]);

    useEffect(() => {
        if (!accessToken || !modelCatalogLoaded) return;
        setPreferencesLoaded(false);
        void loadPreferences();
    }, [accessToken, loadPreferences, modelCatalogLoaded]);

    useEffect(() => {
        if (preferencesLoaded) return;
        if (selectedPresetId === CUSTOM_JSON_PRESET_ID) return;
        const preset = presetConfigs.find((entry) => entry.id === selectedPresetId) || presetConfigs[0];
        if (!preset) return;
        applyMaskScenario(preset.scenario);
    }, [applyMaskScenario, preferencesLoaded, presetConfigs, selectedPresetId]);

    useEffect(() => {
        setInactiveModelTargetIds((current) => {
            const next = pruneInactiveBenchmarkTargetIds(current, selectedTargetIdSet);
            if (next.length === current.length && next.every((entry, index) => entry === current[index])) {
                return current;
            }
            return next;
        });
    }, [selectedTargetIdSet]);

    const loadSession = useCallback(async (sessionLookup: string) => {
        if (!sessionLookup) return;
        setError(null);
        setLoading(true);

        try {
            const payload = await fetchBenchmarkApi(`/api/internal/ai/benchmark?session=${encodeURIComponent(sessionLookup)}`, {
                method: 'GET',
            });

            setSession(payload.session || null);
            const nextRuns = payload.runs || [];
            setRuns(nextRuns);
            setSummary(payload.summary || summarizeRunsLocal(nextRuns));
            // Loading is visible in the table; a success banner on every visit is noise.
            setMessage(null);

            if (payload.session?.share_token && payload.session.share_token !== sessionLookup) {
                const next = new URLSearchParams(searchParams);
                next.set('session', payload.session.share_token);
                setSearchParams(next, { replace: true });
            }
        } catch (loadError) {
            setError(toAdminErrorMessage(loadError, 'Failed to load benchmark session', 'admin-ai-benchmark'));
            setSession(null);
            setRuns([]);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [fetchBenchmarkApi, searchParams, setSearchParams]);

    useEffect(() => {
        if (!benchmarkSessionParam || !accessToken) return;
        loadSession(benchmarkSessionParam);
    }, [benchmarkSessionParam, accessToken, loadSession]);

    useEffect(() => {
        if (!accessToken) return;
        if (benchmarkSessionParam) return;
        if (latestSessionBootstrapRef.current) return;
        latestSessionBootstrapRef.current = true;

        let cancelled = false;

        const bootstrapLatestSession = async () => {
            try {
                const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark', {
                    method: 'GET',
                });
                const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
                const latest = sessions.find((entry) => !entry.deleted_at) || sessions[0];
                if (!latest || cancelled) return;

                const lookup = (latest.share_token || latest.id || '').trim();
                if (!lookup) return;
                await loadSession(lookup);
            } catch {
                // Keep first-load bootstrap silent; explicit actions surface detailed errors.
            }
        };

        bootstrapLatestSession();

        return () => {
            cancelled = true;
        };
    }, [accessToken, benchmarkSessionParam, fetchBenchmarkApi, loadSession]);

    const sessionLookup = session?.share_token || session?.id || '';

    useEffect(() => {
        if (!accessToken) return;
        if (!sessionLookup) return;
        if (!hasPendingRuns) return;

        let cancelled = false;
        let timeoutId: number | null = null;

        const pollSession = async () => {
            try {
                const latest = await fetchBenchmarkApi(`/api/internal/ai/benchmark?session=${encodeURIComponent(sessionLookup)}`, {
                    method: 'GET',
                });
                if (cancelled) return;

                const latestRuns = latest.runs || [];
                setRuns(latestRuns);
                setSummary(latest.summary || summarizeRunsLocal(latestRuns));

                const stillPending = latestRuns.some((run) => isRunActive(run));
                if (!stillPending) {
                    setMessage((current) => {
                        if (!current || !current.startsWith('Queued')) return current;
                        return 'All queued runs finished.';
                    });
                    return;
                }

                timeoutId = window.setTimeout(() => {
                    void pollSession();
                }, 2000);
            } catch (pollError) {
                if (cancelled) return;
                setError(toAdminErrorMessage(pollError, 'Failed to refresh running benchmark session', 'admin-ai-benchmark'));
            }
        };

        timeoutId = window.setTimeout(() => {
            void pollSession();
        }, 2000);

        return () => {
            cancelled = true;
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [accessToken, sessionLookup, hasPendingRuns, fetchBenchmarkApi]);

    const loadTelemetrySnapshot = useCallback(async () => {
        setSnapshotTelemetryLoading(true);
        setSnapshotTelemetryError(null);
        try {
            const params = new URLSearchParams();
            params.set('windowHours', String(24 * 7));
            params.set('source', 'all');

            const payload = await fetchBenchmarkApi(`/api/internal/ai/benchmark/telemetry?${params.toString()}`, {
                method: 'GET',
            }) as unknown as AiTelemetryApiResponse;

            setSnapshotTelemetrySummary(payload.summary as unknown as AiTelemetrySummary || null);
            const fastest = Array.isArray(payload.rankings?.fastest) ? payload.rankings?.fastest[0] || null : null;
            const cheapest = Array.isArray(payload.rankings?.cheapest) ? payload.rankings?.cheapest[0] || null : null;
            const bestValue = Array.isArray(payload.rankings?.bestValue) ? payload.rankings?.bestValue[0] || null : null;
            setSnapshotFastestModel(fastest);
            setSnapshotCheapestModel(cheapest);
            setSnapshotBestValueModel(bestValue);
        } catch (snapshotError) {
            setSnapshotTelemetryError(toAdminErrorMessage(snapshotError, 'Failed to load 7-day telemetry snapshot', 'admin-ai-benchmark'));
            setSnapshotTelemetrySummary(null);
            setSnapshotFastestModel(null);
            setSnapshotCheapestModel(null);
            setSnapshotBestValueModel(null);
        } finally {
            setSnapshotTelemetryLoading(false);
        }
    }, [fetchBenchmarkApi]);

    const refreshTelemetryData = useCallback(async () => {
        await loadTelemetrySnapshot();
    }, [loadTelemetrySnapshot]);

    useEffect(() => {
        if (!accessToken) return;
        void loadTelemetrySnapshot();
    }, [accessToken, loadTelemetrySnapshot]);

    const snapshotTelemetryCards = useMemo(() => ([
        {
            id: 'fastest' as const,
            title: 'Fastest model',
            model: snapshotFastestModel,
            metric: snapshotFastestModel ? formatDuration(snapshotFastestModel.averageLatencyMs) : '—',
            detail: snapshotFastestModel ? `${snapshotFastestModel.successRate.toFixed(1)}% success` : 'No ranking data yet',
        },
        {
            id: 'cheapest' as const,
            title: 'Lowest cost model',
            model: snapshotCheapestModel,
            metric: snapshotCheapestModel ? `${formatUsd(snapshotCheapestModel.averageCostUsd)} / call` : '—',
            detail: snapshotCheapestModel ? `${snapshotCheapestModel.successRate.toFixed(1)}% success` : 'No ranking data yet',
        },
        {
            id: 'value' as const,
            title: 'Best cost-speed value',
            model: snapshotBestValueModel,
            metric: snapshotBestValueModel ? `${formatUsd(snapshotBestValueModel.costPerSecondUsd)} / sec` : '—',
            detail: snapshotBestValueModel
                ? `${formatDuration(snapshotBestValueModel.averageLatencyMs)} avg duration`
                : 'No ranking data yet',
        },
    ]), [snapshotBestValueModel, snapshotCheapestModel, snapshotFastestModel]);

    useEffect(() => {
        if (!accessToken) return;
        if (hasPendingRunsRef.current && !hasPendingRuns) {
            void refreshTelemetryData();
        }
        hasPendingRunsRef.current = hasPendingRuns;
    }, [accessToken, hasPendingRuns, refreshTelemetryData]);

    const buildScenario = useCallback(() => {
        const runtimeScenario = buildClassicBenchmarkScenario(readMaskScenario(), {
            compactOutput: compactBenchmarkOutput,
        });
        const options: GenerateOptions = runtimeScenario.generationOptions;

        return {
            prompt: runtimeScenario.prompt,
            startDate: runtimeScenario.startDate,
            roundTrip: runtimeScenario.roundTrip,
            input: {
                ...runtimeScenario.input,
                execution: {
                    timeoutSeconds: benchmarkTimeoutSeconds,
                    compactOutput: compactBenchmarkOutput,
                    reasoning: benchmarkReasoningMode,
                },
            },
            metadata: {
                preference_signals: {
                    travelerSetup,
                    tripStyle: tripStyleMask,
                    transportPreference: transportMask,
                    routeLock,
                },
                baseline_defaults: BENCHMARK_BASELINE_PREFERENCE_DEFAULTS,
                execution: {
                    timeoutSeconds: benchmarkTimeoutSeconds,
                    compactOutput: compactBenchmarkOutput,
                    reasoning: benchmarkReasoningMode,
                },
            },
        };
    }, [
        benchmarkTimeoutSeconds,
        benchmarkReasoningMode,
        compactBenchmarkOutput,
        routeLock,
        readMaskScenario,
        travelerSetup,
        tripStyleMask,
        transportMask,
    ]);

    const runBenchmark = useCallback(async (targetsOverride?: AiBenchmarkRunTarget[]) => {
        if (!accessToken) {
            setError('Supabase access token missing. Refresh this page and try again.');
            return;
        }

        const selected = targetsOverride || runnableTargets;

        const timeoutSeconds = Math.max(
            BENCHMARK_TIMEOUT_MIN_SECONDS,
            Math.min(BENCHMARK_TIMEOUT_MAX_SECONDS, Math.round(Number(benchmarkTimeoutSeconds) || BENCHMARK_TIMEOUT_DEFAULT_SECONDS))
        );
        const timeoutMs = timeoutSeconds * 1000;

        if (selected.length === 0) {
            setError('Enable at least one model target before running benchmark.');
            return;
        }

        const startedAtIso = new Date().toISOString();
        const optimisticRuns: BenchmarkRun[] = selected.map((target, index) => {
            const nextRunIndex = runs
                .filter((run) => run.provider === target.provider && run.model === target.model)
                .reduce((max, run) => Math.max(max, Number(run.run_index) || 0), 0) + 1;

            return {
                id: `optimistic-${crypto.randomUUID()}`,
                session_id: session?.id || 'pending',
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
                started_at: startedAtIso,
                finished_at: null,
                created_at: new Date(Date.now() + index).toISOString(),
            };
        });

        setError(null);
        setMessage(null);
        const optimisticAllRuns = [...optimisticRuns, ...runs];
        setRuns(optimisticAllRuns);
        setSummary(summarizeRunsLocal(optimisticAllRuns));
        setLoading(true);

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: session?.id,
                    sessionName: sessionName.trim() || DEFAULT_SESSION_NAME,
                    flow: 'classic',
                    scenario: buildScenario(),
                    targets: selected.map((target) => {
                        const catalogModel = sortedModels.find((model) => (
                            model.provider === target.provider && model.model === target.model
                        ));
                        const requestedReasoningMode = catalogModel
                            ? modelReasoningModes[catalogModel.id] ?? benchmarkReasoningMode
                            : benchmarkReasoningMode;
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
                    }),
                    runCount: 1,
                    concurrency: benchmarkConcurrency,
                    timeoutMs,
                }),
            });

            if (payload.session) {
                setSession(payload.session);
                const next = new URLSearchParams(searchParams);
                next.set('session', payload.session.share_token || payload.session.id);
                setSearchParams(next, { replace: true });
            }
            const nextRuns = payload.runs || [];
            setRuns(nextRuns);
            setSummary(payload.summary || summarizeRunsLocal(nextRuns));

            const hasPending = nextRuns.some((run) => isRunActive(run));
            if (hasPending) {
                setMessage(
                    `Queued ${selected.length} target(s) with up to ${benchmarkConcurrency} parallel (${timeoutSeconds}s timeout, ${compactBenchmarkOutput ? 'compact' : 'standard'} output).`
                );
            } else {
                setMessage(
                    `Executed ${selected.length} target(s) (${timeoutSeconds}s timeout, ${compactBenchmarkOutput ? 'compact' : 'standard'} output).`
                );
                void refreshTelemetryData();
            }
        } catch (runError) {
            setError(toAdminErrorMessage(runError, 'Benchmark run failed', 'admin-ai-benchmark'));
            setRuns((current) => {
                const next: BenchmarkRun[] = current.map((run) => {
                    if (!run.id.startsWith('optimistic-')) return run;
                    return {
                        ...run,
                        status: 'failed' as const,
                        finished_at: new Date().toISOString(),
                        error_message: 'Benchmark request failed before run completion.',
                    };
                });
                setSummary(summarizeRunsLocal(next));
                return next;
            });
        } finally {
            setLoading(false);
        }
    }, [
        accessToken,
        benchmarkTimeoutSeconds,
        benchmarkReasoningMode,
        benchmarkConcurrency,
        compactBenchmarkOutput,
        modelReasoningModes,
        runnableTargets,
        runs,
        fetchBenchmarkApi,
        session,
        sessionName,
        buildScenario,
        searchParams,
        setSearchParams,
        sortedModels,
        refreshTelemetryData,
    ]);

    const rerunTarget = useCallback(async (run: BenchmarkRun) => {
        await runBenchmark([
            {
                provider: run.provider,
                model: run.model,
                label: run.label || `${run.provider}:${run.model}`,
            },
        ]);
    }, [runBenchmark]);

    const runSingleTarget = useCallback((target: AiBenchmarkRunTarget) => {
        void runBenchmark([
            {
                provider: target.provider,
                model: target.model,
                label: target.label,
            },
        ]);
    }, [runBenchmark]);

    const cancelRuns = useCallback(async (target: { runId?: string; sessionId?: string }) => {
        if (!target.runId && !target.sessionId) return;
        setError(null);
        setCancelling(true);

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/cancel', {
                method: 'POST',
                body: JSON.stringify(target),
            });

            if (payload.session) {
                setSession(payload.session);
            }

            const nextRuns = payload.runs || runs;
            setRuns(nextRuns);
            setSummary(payload.summary || summarizeRunsLocal(nextRuns));

            const cancelledCount = typeof payload.cancelled === 'number' ? payload.cancelled : 0;
            setMessage(`Cancelled ${cancelledCount} active run${cancelledCount === 1 ? '' : 's'}.`);
        } catch (cancelError) {
            setError(toAdminErrorMessage(cancelError, 'Failed to cancel benchmark run(s)', 'admin-ai-benchmark'));
        } finally {
            setCancelling(false);
        }
    }, [fetchBenchmarkApi, runs]);

    const cancelRun = useCallback((run: BenchmarkRun) => {
        if (!run.id || run.id.startsWith('optimistic-')) return;
        void cancelRuns({ runId: run.id });
    }, [cancelRuns]);

    const cancelActiveRunsInSession = useCallback(() => {
        if (!session?.id) return;
        void cancelRuns({ sessionId: session.id });
    }, [cancelRuns, session?.id]);

    const updateRunFeedback = useCallback(async (
        run: BenchmarkRun,
        payload: { rating?: SatisfactionRating | null; comment?: string | null }
    ): Promise<BenchmarkRun> => {
        const response = await fetchBenchmarkApi('/api/internal/ai/benchmark/rating', {
            method: 'POST',
            body: JSON.stringify({
                runId: run.id,
                ...(Object.prototype.hasOwnProperty.call(payload, 'rating') ? { rating: payload.rating } : {}),
                ...(Object.prototype.hasOwnProperty.call(payload, 'comment') ? { comment: payload.comment } : {}),
            }),
        });

        const updatedRun = response?.run as BenchmarkRun | undefined;
        if (!updatedRun) {
            throw new Error('Run feedback saved but no updated row returned.');
        }

        setRuns((current) => {
            const next = current.map((entry) => (entry.id === updatedRun.id ? { ...entry, ...updatedRun } : entry));
            setSummary(summarizeRunsLocal(next));
            return next;
        });
        setRunCommentDrafts((current) => ({
            ...current,
            [updatedRun.id]: updatedRun.run_comment || '',
        }));
        return updatedRun;
    }, [fetchBenchmarkApi]);

    const updateRunRating = useCallback(async (run: BenchmarkRun, nextRating: SatisfactionRating | null) => {
        if (!run.id || run.id.startsWith('optimistic-') || isRunActive(run)) return;
        setError(null);
        setRatingSavingRunId(run.id);

        try {
            await updateRunFeedback(run, { rating: nextRating });
        } catch (ratingError) {
            setError(toAdminErrorMessage(ratingError, 'Failed to save run rating', 'admin-ai-benchmark'));
        } finally {
            setRatingSavingRunId(null);
        }
    }, [updateRunFeedback]);

    const saveRunComment = useCallback(async (run: BenchmarkRun) => {
        if (!run.id || run.id.startsWith('optimistic-') || isRunActive(run)) return;
        const draft = normalizeRunCommentDraft(runCommentDrafts[run.id] || '');
        if (draft.length > BENCHMARK_RUN_COMMENT_MAX_LENGTH) {
            setError(`Comment too long (max ${BENCHMARK_RUN_COMMENT_MAX_LENGTH} characters).`);
            return;
        }

        const persisted = normalizeRunCommentDraft(run.run_comment || '');
        if (draft === persisted) return;

        setError(null);
        setCommentSavingRunId(run.id);
        try {
            await updateRunFeedback(run, { comment: draft || null });
        } catch (commentError) {
            setError(toAdminErrorMessage(commentError, 'Failed to save run comment', 'admin-ai-benchmark'));
        } finally {
            setCommentSavingRunId(null);
        }
    }, [runCommentDrafts, updateRunFeedback]);

    const downloadRow = useCallback((run: BenchmarkRun) => {
        const payload = {
            run,
            exportedAt: new Date().toISOString(),
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const fileName = `${run.provider}__${run.model}__run-${run.run_index}.json`.replace(/[^a-zA-Z0-9._-]+/g, '-');
        downloadBlob(blob, fileName);
    }, []);

    const openPromptPreview = useCallback(() => {
        try {
            const scenario = buildScenario();
            setPromptModal({
                prompt: scenario.prompt,
                generatedAt: new Date().toISOString(),
            });
        } catch (promptError) {
            setError(toAdminErrorMessage(promptError, 'Failed to build prompt preview', 'admin-ai-benchmark'));
        }
    }, [buildScenario]);

    const scrollToResults = useCallback(() => {
        setWorkspaceTab('results');
        window.requestAnimationFrame(() => {
            resultsSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    }, []);

    const getModelCostEstimateLabel = useCallback((provider: string, model: string): string | null => {
        const match = AI_MODEL_CATALOG.find((entry) => entry.provider === provider && entry.model === model);
        return match?.estimatedCostPerQueryLabel || null;
    }, []);

    const copyPromptToClipboard = useCallback(async () => {
        if (!promptModal?.prompt) return;
        try {
            await navigator.clipboard.writeText(promptModal.prompt);
            setMessage('Prompt copied to clipboard.');
        } catch {
            setError('Failed to copy prompt to clipboard.');
        }
    }, [promptModal]);

    const downloadPromptText = useCallback(() => {
        if (!promptModal?.prompt) return;
        const blob = new Blob([promptModal.prompt], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, 'benchmark-prompt.txt');
    }, [promptModal]);

    const downloadAllZip = useCallback(async (includeLogs: boolean) => {
        if (!session) {
            setError('No benchmark session selected. Run at least one benchmark first.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (!accessToken) {
                throw new Error('Supabase access token missing.');
            }

            const headers = new Headers();
            headers.set('Authorization', `Bearer ${accessToken}`);

            const exportUrl = includeLogs
                ? `/api/internal/ai/benchmark/export?session=${encodeURIComponent(session.id)}&includeLogs=1`
                : `/api/internal/ai/benchmark/export?session=${encodeURIComponent(session.id)}`;

            const response = await fetch(exportUrl, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || `Export failed (${response.status})`);
            }

            const blob = await response.blob();
            const fileName = `${(session.name || 'benchmark-session').replace(/[^a-zA-Z0-9._-]+/g, '-')}-exports.zip`;
            downloadBlob(blob, fileName);
        } catch (downloadError) {
            setError(toAdminErrorMessage(downloadError, 'Failed to export benchmark ZIP', 'admin-ai-benchmark'));
        } finally {
            setLoading(false);
        }
    }, [accessToken, session]);

    const cleanupSession = useCallback(async () => {
        if (!session) {
            setError('No benchmark session loaded.');
            return;
        }

        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Delete benchmark session data',
            message: 'Delete benchmark trips and benchmark rows for this session? This cannot be undone.',
            confirmLabel: 'Delete',
        }));
        if (!confirmed) return;

        setLoading(true);
        setError(null);

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/cleanup', {
                method: 'POST',
                body: JSON.stringify({
                    sessionId: session.id,
                    mode: 'both',
                }),
            });

            setMessage(`Cleanup complete for session ${session.id}.`);
            setRuns([]);
            setSummary(null);
            setSession(null);

            const next = new URLSearchParams(searchParams);
            next.delete('session');
            setSearchParams(next, { replace: true });

            if (!payload.ok) {
                setError(payload.error || 'Cleanup may be incomplete.');
            }
        } catch (cleanupError) {
            setError(toAdminErrorMessage(cleanupError, 'Failed to clean benchmark session', 'admin-ai-benchmark'));
        } finally {
            setLoading(false);
        }
    }, [confirmDialog, fetchBenchmarkApi, searchParams, session, setSearchParams]);

    const openModelPicker = useCallback(() => {
        setModelFilter('');
        setModelProviderFilter('all');
        setModelCapabilityFilter('all');
        setModelPriceFilter('all');
        setModelDraftIds(modelTargetIds);
        setModelModalOpen(true);
    }, [modelTargetIds]);

    const persistAiRuntimeSettings = useCallback(async (
        overrides: Partial<Pick<AiRuntimeSettings, 'defaultModelId' | 'approvedOpenRouterModels' | 'modelMaxAgeMonths' | 'showOlderModels'>>,
        options?: { silent?: boolean },
    ): Promise<AiRuntimeSettings | null> => {
        try {
            const draft: AiRuntimeSettings = { ...aiRuntimeSettings, ...overrides };
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/models', {
                method: 'POST',
                body: JSON.stringify(draft),
            }) as BenchmarkModelsApiResponse;
            const models = Array.isArray(payload.models) ? payload.models : liveOpenRouterModels;
            const settings = payload.settings || draft;
            setLiveOpenRouterModels(models);
            setAiRuntimeSettings(settings);
            applyAiRuntimeSettings(settings, models);
            if (!options?.silent) setMessage('Frontend AI model settings saved.');
            return settings;
        } catch (settingsError) {
            setError(toAdminErrorMessage(settingsError, 'Could not save frontend AI model settings.', 'admin-ai-benchmark'));
            return null;
        }
    }, [aiRuntimeSettings, fetchBenchmarkApi, liveOpenRouterModels]);

    const toggleModelDraft = useCallback((modelId: string) => {
        setModelDraftIds((current) => {
            if (current.includes(modelId)) {
                return current.filter((entry) => entry !== modelId);
            }
            return [...current, modelId];
        });
    }, []);

    const toggleModelTargetActive = useCallback((modelId: string) => {
        setInactiveModelTargetIds((current) => toggleInactiveBenchmarkTargetId(current, modelId));
    }, []);

    const activateAllModelTargets = useCallback(() => {
        setInactiveModelTargetIds([]);
    }, []);

    const deactivateAllModelTargets = useCallback(() => {
        setInactiveModelTargetIds(getAllSelectedBenchmarkTargetIds(selectedTargets));
    }, [selectedTargets]);

    const saveModelDraft = useCallback(async () => {
        const normalized = normalizePreferencesForClient({
            modelTargets: modelDraftIds,
            presets: presetConfigs,
            selectedPresetId,
        });
        const liveModelIdSet = new Set(liveOpenRouterModels.map((model) => model.id));
        const newlyApproved = normalized.modelTargets.flatMap((modelId) => (
            liveModelIdSet.has(modelId) ? [modelId.slice('openrouter:'.length)] : []
        ));
        await persistAiRuntimeSettings({
            approvedOpenRouterModels: Array.from(new Set([
                ...aiRuntimeSettings.approvedOpenRouterModels,
                ...newlyApproved,
            ])),
        }, { silent: true });
        setModelTargetIds(normalized.modelTargets);
        setInactiveModelTargetIds((current) => pruneInactiveBenchmarkTargetIds(current, normalized.modelTargets));
        setModelModalOpen(false);
        await savePreferences({
            modelTargets: normalized.modelTargets,
        }, { silent: true });
    }, [
        aiRuntimeSettings.approvedOpenRouterModels,
        liveOpenRouterModels,
        modelDraftIds,
        normalizePreferencesForClient,
        persistAiRuntimeSettings,
        presetConfigs,
        savePreferences,
        selectedPresetId,
    ]);

    const removeModelTarget = useCallback(async (modelId: string) => {
        const next = modelTargetIds.filter((entry) => entry !== modelId);
        setModelTargetIds(next);
        setInactiveModelTargetIds((current) => current.filter((entry) => entry !== modelId));
        await savePreferences({ modelTargets: next }, { silent: true });
    }, [modelTargetIds, savePreferences]);

    const removeAllModelTargets = useCallback(async () => {
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Remove all benchmark models?',
            message: 'This clears the selected benchmark model list. You can add models again at any time.',
            confirmLabel: 'Remove all',
        }));
        if (!confirmed) return;
        setModelTargetIds([]);
        setInactiveModelTargetIds([]);
        await savePreferences({ modelTargets: [] }, { silent: true });
        setMessage('All benchmark models removed.');
    }, [confirmDialog, savePreferences]);

    const handlePresetSelection = useCallback(async (presetId: string) => {
        if (presetId === CUSTOM_JSON_PRESET_ID) {
            setSelectedPresetId(CUSTOM_JSON_PRESET_ID);
            if (!customScenarioJsonDraft.trim()) {
                loadCurrentMaskIntoCustomJson();
            } else if (!customScenarioMeta) {
                setCustomScenarioMeta({
                    source: 'manual',
                    flow: 'unknown',
                    tripId: null,
                });
            }
            setError(null);
            return;
        }
        const preset = presetConfigs.find((entry) => entry.id === presetId);
        if (!preset) return;
        setSelectedPresetId(preset.id);
        applyMaskScenario(preset.scenario);
        await savePreferences({
            selectedPresetId: preset.id,
        }, { silent: true });
    }, [applyMaskScenario, customScenarioJsonDraft, customScenarioMeta, loadCurrentMaskIntoCustomJson, presetConfigs, savePreferences]);

    const openPresetEditor = useCallback((mode: 'edit' | 'create') => {
        if (mode === 'create') {
            const scenario = readMaskScenario();
            setPresetEditor({
                mode,
                id: `custom-${crypto.randomUUID()}`,
                kind: 'custom',
                name: 'Custom benchmark preset',
                description: 'Saved custom mask for repeat benchmark runs.',
                scenario,
            });
            return;
        }

        const basePreset = selectedPreset || presetConfigs[0];
        if (!basePreset) return;
        setPresetEditor({
            mode,
            id: basePreset.id,
            kind: basePreset.kind,
            name: basePreset.name,
            description: basePreset.description,
            scenario: basePreset.scenario,
        });
    }, [presetConfigs, readMaskScenario, selectedPreset]);

    const updatePresetDraftScenario = useCallback(<K extends keyof BenchmarkMaskScenario>(key: K, value: BenchmarkMaskScenario[K]) => {
        setPresetEditor((current) => {
            if (!current) return current;
            return {
                ...current,
                scenario: {
                    ...current.scenario,
                    [key]: value,
                },
            };
        });
    }, []);

    const savePresetDraft = useCallback(async () => {
        if (!presetEditor) return;
        const normalizedScenario = normalizeBenchmarkMaskScenario(presetEditor.scenario, {
            defaultStartDate: defaultDates.startDate,
            defaultEndDate: defaultDates.endDate,
        });
        const normalizedName = presetEditor.name.trim() || 'Custom benchmark preset';
        const normalizedDescription = presetEditor.description.trim();
        const nextPreset: BenchmarkPresetConfig = {
            id: presetEditor.id,
            name: normalizedName,
            description: normalizedDescription,
            kind: presetEditor.mode === 'create' ? 'custom' : presetEditor.kind,
            scenario: normalizedScenario,
        };

        const nextPresets = presetEditor.mode === 'create'
            ? [...presetConfigs, nextPreset]
            : presetConfigs.map((entry) => (entry.id === nextPreset.id ? nextPreset : entry));
        setPresetConfigs(nextPresets);
        setSelectedPresetId(nextPreset.id);
        applyMaskScenario(nextPreset.scenario);
        setPresetEditor(null);
        await savePreferences({
            presets: nextPresets,
            selectedPresetId: nextPreset.id,
        }, { silent: true });
    }, [applyMaskScenario, defaultDates.endDate, defaultDates.startDate, presetConfigs, presetEditor, savePreferences]);

    const presetFieldLabelClass = 'text-xs font-medium text-muted-foreground';

    const activeTab = resolveAiBenchmarkWorkspaceTab(workspaceTab, Boolean(session));
    const runningCount = summary?.running ?? 0;
    const queuedCount = summary?.queued ?? 0;
    const runDisabled = loading || hasPendingRuns || cancelling || runnableTargets.length === 0;
    const runButtonLabel = `Run ${runnableTargets.length} model${runnableTargets.length === 1 ? '' : 's'}`;
    const queuedBehindConcurrency = Math.max(0, runnableTargets.length - benchmarkConcurrency);
    const activeModels = useMemo(
        () => sortedModels.filter((model) => model.availability === 'active'),
        [sortedModels],
    );

    const startBenchmark = (source: 'header' | 'empty_state') => {
        trackEvent('admin__ai_benchmark--run', { source, models: runnableTargets.length });
        scrollToResults();
        void runBenchmark();
    };

    const startNewSession = () => {
        trackEvent('admin__ai_benchmark--new_session');
        setSession(null);
        setRuns([]);
        setSummary(null);
        setInspectedRunId(null);
        setMessage(null);
        setError(null);
        const next = new URLSearchParams(searchParams);
        next.delete('session');
        setSearchParams(next, { replace: true });
        setWorkspaceTab('setup');
    };

    const openRunDetails = (run: BenchmarkRun, source: 'model' | 'status' | 'note' | 'menu') => {
        if (isOptimisticRun(run)) return;
        trackEvent('admin__ai_benchmark--open_run', { source });
        setInspectedRunId(run.id);
    };

    const updateRunFilters = (patch: Partial<BenchmarkRunFilters>) => {
        setRunFilters((current) => ({ ...current, ...patch }));
    };

    return (
        <AdminShell
            title="AI benchmark"
            description="Compare trip quality, latency and cost across models."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <>
                    {hasPendingRuns && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                trackEvent('admin__ai_benchmark--stop');
                                cancelActiveRunsInSession();
                            }}
                            disabled={cancelling || !session}
                            {...getAnalyticsDebugAttributes('admin__ai_benchmark--stop')}
                        >
                            <StopCircle />
                            {cancelling ? 'Stopping…' : 'Stop runs'}
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={() => startBenchmark('header')}
                        disabled={runDisabled}
                        {...getAnalyticsDebugAttributes('admin__ai_benchmark--run', { source: 'header' })}
                    >
                        <Play weight="fill" />
                        {runButtonLabel}
                    </Button>
                </>
            )}
        >
            <div className="flex w-full flex-col gap-4">

                {error && <AdminErrorAlert message={error} />}

                {message && (
                    <Alert variant="success" role="status">
                        <CheckCircle weight="fill" />
                        <AlertDescription>{message}</AlertDescription>
                    </Alert>
                )}

                <Tabs
                    value={activeTab}
                    onValueChange={(value) => setWorkspaceTab(value as AiBenchmarkWorkspaceTab)}
                    className="flex flex-col gap-4"
                >
                    {/* top-16 clears the shell's sticky 56px top bar; top-2 slid under it. */}
                    <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/95 p-2 backdrop-blur">
                        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                            <TabsTrigger value="results">Runs · <span className="tabular-nums">{runs.length}</span></TabsTrigger>
                            <TabsTrigger value="compare">Compare</TabsTrigger>
                            <TabsTrigger value="setup">Setup</TabsTrigger>
                        </TabsList>
                        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {!accessToken && (
                                <AdminStatusBadge tone={isAuthenticated ? 'neutral' : 'danger'}>
                                    {isAuthenticated ? 'Connecting…' : 'Sign in again to run'}
                                </AdminStatusBadge>
                            )}
                            {hasPendingRuns && (
                                <span role="status">
                                    <AdminStatusBadge tone="info">
                                        <span className="tabular-nums">{runningCount} running · {queuedCount} queued</span>
                                    </AdminStatusBadge>
                                </span>
                            )}
                            <span className="tabular-nums">{runnableTargets.length} of {selectedTargets.length} models active</span>
                        </div>
                    </div>

                    <TabsContent value="results" className="mt-0 flex flex-col gap-4">
                        {summary && runs.length > 0 && (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <AdminStatCard
                                    label="Completed"
                                    value={<span className="tabular-nums">{summary.completed}/{summary.total}</span>}
                                    hint={summary.failed > 0 ? `${summary.failed} failed · open a run for the error` : 'No failed runs'}
                                    hintTone={summary.failed > 0 ? 'negative' : 'neutral'}
                                />
                                <AdminStatCard
                                    label="Avg latency"
                                    value={<span className="tabular-nums">{formatDuration(summary.averageLatencyMs)}</span>}
                                    hint="Completed runs only"
                                />
                                <AdminStatCard
                                    label="Total cost"
                                    value={<span className="tabular-nums">{hasExactCostData ? formatUsd(summary.totalCostUsd) : '—'}</span>}
                                    hint={hasExactCostData ? 'As reported by the providers' : 'No provider has reported a cost yet'}
                                />
                                <AdminStatCard
                                    label="To rate"
                                    value={<span className="tabular-nums">{unratedRunCount}</span>}
                                    hint={unratedRunCount > 0 ? 'Completed runs without a rating' : 'Every completed run is rated'}
                                    hintTone={unratedRunCount > 0 ? 'warning' : 'positive'}
                                >
                                    {unratedRunCount > 0 && !runFilters.onlyUnrated && (
                                        <Button
                                            type="button"
                                            variant="link"
                                            size="xs"
                                            className="h-auto self-start p-0"
                                            onClick={() => {
                                                trackEvent('admin__ai_benchmark--show_unrated');
                                                updateRunFilters({ onlyUnrated: true });
                                            }}
                                            {...getAnalyticsDebugAttributes('admin__ai_benchmark--show_unrated')}
                                        >
                                            Show unrated runs
                                        </Button>
                                    )}
                                </AdminStatCard>
                            </div>
                        )}

                        <AdminSurfaceCard ref={resultsSectionRef} className="flex flex-col gap-4">
                            <AdminSectionHeader
                                title="Runs"
                                description={session ? (
                                    <>
                                        {session.name || 'Unnamed session'}
                                        <span aria-hidden="true"> · </span>
                                        <span className="select-all font-mono text-xs">{session.share_token}</span>
                                    </>
                                ) : 'No session loaded. Your next run starts a new one.'}
                                actions={(
                                    <>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild disabled={loading || !session || runs.length === 0}>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={loading || !session || runs.length === 0}
                                                >
                                                    <DownloadSimple />
                                                    Export
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[220px]">
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        trackEvent('admin__ai_benchmark--export', { include_logs: false });
                                                        void downloadAllZip(false);
                                                    }}
                                                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--export', { include_logs: false })}
                                                >
                                                    All runs (ZIP)
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        trackEvent('admin__ai_benchmark--export', { include_logs: true });
                                                        void downloadAllZip(true);
                                                    }}
                                                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--export', { include_logs: true })}
                                                >
                                                    All runs with logs (ZIP)
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild disabled={!session}>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    disabled={!session}
                                                    aria-label="Session actions"
                                                    data-tooltip="Session actions"
                                                >
                                                    <DotsThree weight="bold" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[220px]">
                                                <DropdownMenuItem
                                                    disabled={loading || cancelling || hasPendingRuns}
                                                    onSelect={startNewSession}
                                                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--new_session')}
                                                >
                                                    <Plus />
                                                    Start a new session
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    disabled={loading || cancelling || hasPendingRuns}
                                                    onSelect={() => {
                                                        trackEvent('admin__ai_benchmark--delete_session');
                                                        void cleanupSession();
                                                    }}
                                                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--delete_session')}
                                                >
                                                    <Trash />
                                                    Delete session data…
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                )}
                            />

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <Select value={runFilters.provider} onValueChange={(provider) => updateRunFilters({ provider })}>
                                    <SelectTrigger aria-label="Filter runs by provider" className="h-8 w-[180px] text-xs">
                                        <SelectValue placeholder="All providers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All providers</SelectItem>
                                        {providerOptions.map((provider) => (
                                            <SelectItem key={provider} value={provider}>
                                                <ProviderLabel
                                                    provider={provider}
                                                    providerClassName="text-foreground"
                                                    logoSize={12}
                                                />
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                                    <Checkbox
                                        aria-label="Hide failed"
                                        checked={runFilters.hideFailed}
                                        onCheckedChange={(checked) => updateRunFilters({ hideFailed: checked === true })}
                                    />
                                    Hide failed
                                </label>
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                                    <Checkbox
                                        aria-label="Only warnings"
                                        checked={runFilters.onlyWarnings}
                                        onCheckedChange={(checked) => updateRunFilters({ onlyWarnings: checked === true })}
                                    />
                                    Only warnings
                                </label>
                                <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                                    <Checkbox
                                        aria-label="Only unrated"
                                        checked={runFilters.onlyUnrated}
                                        onCheckedChange={(checked) => updateRunFilters({ onlyUnrated: checked === true })}
                                    />
                                    Only unrated
                                </label>
                                {runFiltersActive && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            trackEvent('admin__ai_benchmark--reset_filters');
                                            setRunFilters(DEFAULT_BENCHMARK_RUN_FILTERS);
                                        }}
                                        {...getAnalyticsDebugAttributes('admin__ai_benchmark--reset_filters')}
                                    >
                                        Reset
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="ms-auto text-muted-foreground"
                                    onClick={() => setRunSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                                    aria-label={runSortDirection === 'desc' ? 'Newest first. Switch to oldest first' : 'Oldest first. Switch to newest first'}
                                >
                                    <ArrowsDownUp />
                                    {runSortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
                                </Button>
                            </div>

                            {displayRuns.length === 0 ? (
                                loading && runs.length === 0 ? (
                                    <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground">
                                        <Spinner className="size-4" />
                                        Loading runs…
                                    </div>
                                ) : runs.length === 0 ? (
                                    <AdminEmptyState
                                        title={session ? 'No runs in this session yet' : 'No benchmark session yet'}
                                        description="Pick a trip template and models in Setup, then run them."
                                        action={(
                                            <Button type="button" variant="outline" size="sm" onClick={() => setWorkspaceTab('setup')}>
                                                Go to setup
                                            </Button>
                                        )}
                                    />
                                ) : (
                                    <AdminEmptyState
                                        title="No runs match these filters"
                                        description="Reset the filters to see every run in this session."
                                        action={(
                                            <Button type="button" variant="outline" size="sm" onClick={() => setRunFilters(DEFAULT_BENCHMARK_RUN_FILTERS)}>
                                                Reset filters
                                            </Button>
                                        )}
                                    />
                                )
                            ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <Table>
                                        <TableHeader className="bg-secondary">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="ps-3" aria-sort={runSortDirection === 'asc' ? 'ascending' : 'descending'}>Model</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Latency</TableHead>
                                                <TableHead>Checks</TableHead>
                                                <TableHead>
                                                    <span
                                                        className="inline-flex items-center gap-1"
                                                        data-tooltip="Exact provider cost when returned, otherwise the catalog estimate for that model."
                                                        tabIndex={0}
                                                    >
                                                        Cost
                                                        <Info aria-hidden="true" className="size-3.5" />
                                                    </span>
                                                </TableHead>
                                                <TableHead>Rating</TableHead>
                                                <TableHead>Note</TableHead>
                                                <TableHead className="w-10 pe-3"><span className="sr-only">Actions</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {displayRuns.map((run) => {
                                                const isPending = isRunActive(run);
                                                const isOptimistic = isOptimisticRun(run);
                                                const statusMeta = getRunStatusMeta(run);
                                                const parsedError = run.error_message ? parseRunError(run.error_message) : null;
                                                const validationStats = getValidationCheckStats(run.validation_checks);
                                                const warningCount = getValidationWarnings(run.validation_checks).length;
                                                const verdict = getRunValidationVerdict(run);
                                                const costEstimateLabel = getModelCostEstimateLabel(run.provider, run.model);
                                                const persistedComment = normalizeRunCommentDraft(run.run_comment || '');
                                                const canEditComment = !isPending && !isOptimistic;
                                                const runTimestamp = getRunTimestampIso(run);

                                                return (
                                                    <TableRow key={run.id} className="[&>td]:align-top">
                                                        <TableCell className="ps-3">
                                                            <Button
                                                                type="button"
                                                                variant="link"
                                                                className="h-auto max-w-[260px] justify-start p-0 font-medium text-foreground"
                                                                onClick={() => openRunDetails(run, 'model')}
                                                                disabled={isOptimistic}
                                                                aria-label={`Open run #${run.run_index} of ${run.label || run.model}`}
                                                            >
                                                                <ProviderLabel provider={run.provider} model={run.model} />
                                                            </Button>
                                                            <div className="text-xs tabular-nums text-muted-foreground">
                                                                Run #{run.run_index}
                                                                <span aria-hidden="true"> · </span>
                                                                <span data-tooltip={formatTimestamp(runTimestamp)}>{formatRelativeTime(runTimestamp)}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <AdminStatusBadge tone={statusMeta.tone}>{statusMeta.label}</AdminStatusBadge>
                                                            {parsedError && (
                                                                <div className="mt-1.5 flex max-w-[280px] flex-col items-start gap-1 whitespace-normal text-xs text-rose-700 dark:text-rose-200">
                                                                    <div className="line-clamp-2 break-words">{parsedError.shortMessage}</div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        size="xs"
                                                                        className="h-auto p-0 text-xs"
                                                                        onClick={() => openRunDetails(run, 'status')}
                                                                        disabled={isOptimistic}
                                                                        aria-label={`Error details for run #${run.run_index}`}
                                                                    >
                                                                        Details
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-foreground"><RunLatency run={run} /></TableCell>
                                                        <TableCell className="text-sm">
                                                            {hasRunValidationDetails(run) && run.schema_valid !== null ? (
                                                                <div className="flex flex-col items-start gap-1">
                                                                    <AdminStatusBadge tone={verdict.tone}>
                                                                        <span className="tabular-nums">
                                                                            {run.schema_valid ? 'Valid' : 'Invalid'}
                                                                            {validationStats.total > 0 && ` ${validationStats.passed}/${validationStats.total}`}
                                                                        </span>
                                                                    </AdminStatusBadge>
                                                                    {warningCount > 0 && (
                                                                        <span className="text-xs tabular-nums text-amber-700 dark:text-amber-200">
                                                                            {warningCount} warning{warningCount === 1 ? '' : 's'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : <span className="text-muted-foreground">—</span>}
                                                        </TableCell>
                                                        <TableCell className="text-sm tabular-nums text-foreground">
                                                            {typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd) ? (
                                                                formatUsd(run.cost_usd)
                                                            ) : costEstimateLabel ? (
                                                                <span data-tooltip="Catalog estimate; the provider returned no cost.">
                                                                    {costEstimateLabel}
                                                                    <span className="ms-1 text-xs text-muted-foreground">est.</span>
                                                                </span>
                                                            ) : <span className="text-muted-foreground">—</span>}
                                                        </TableCell>
                                                        <TableCell>
                                                            <RunRatingButtons
                                                                run={run}
                                                                disabled={loading || isPending || ratingSavingRunId === run.id || commentSavingRunId === run.id}
                                                                onRate={(rating) => void updateRunRating(run, rating)}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="xs"
                                                                className={persistedComment ? 'max-w-[200px] justify-start font-normal text-foreground' : 'text-muted-foreground'}
                                                                onClick={() => openRunDetails(run, 'note')}
                                                                disabled={!canEditComment}
                                                                data-tooltip={persistedComment || undefined}
                                                                aria-label={persistedComment ? `Edit note for run #${run.run_index}` : `Add note for run #${run.run_index}`}
                                                            >
                                                                {persistedComment ? (
                                                                    <span className="truncate">{persistedComment}</span>
                                                                ) : (
                                                                    <>
                                                                        <NotePencil />
                                                                        Add note
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell className="pe-3 text-end">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        aria-label={`Actions for run #${run.run_index} of ${run.label || run.model}`}
                                                                        data-tooltip="Run actions"
                                                                    >
                                                                        <DotsThree weight="bold" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="min-w-[190px]">
                                                                    <DropdownMenuItem disabled={isOptimistic} onSelect={() => openRunDetails(run, 'menu')}>
                                                                        Open details
                                                                    </DropdownMenuItem>
                                                                    {run.trip_id && (
                                                                        <DropdownMenuItem asChild>
                                                                            <a
                                                                                href={`/trip/${encodeURIComponent(run.trip_id)}`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                onClick={() => trackEvent('admin__ai_benchmark_run--open_trip')}
                                                                            >
                                                                                <ArrowSquareOut />
                                                                                Open trip
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuItem
                                                                        disabled={loading || cancelling || isPending}
                                                                        onSelect={() => {
                                                                            trackEvent('admin__ai_benchmark_run--rerun', { source: 'menu' });
                                                                            void rerunTarget(run);
                                                                        }}
                                                                    >
                                                                        <ArrowClockwise />
                                                                        Rerun model
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        disabled={isPending}
                                                                        onSelect={() => {
                                                                            trackEvent('admin__ai_benchmark_run--download', { source: 'menu' });
                                                                            downloadRow(run);
                                                                        }}
                                                                    >
                                                                        <DownloadSimple />
                                                                        Download JSON
                                                                    </DropdownMenuItem>
                                                                    {isPending && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                variant="destructive"
                                                                                disabled={cancelling || isOptimistic}
                                                                                onSelect={() => {
                                                                                    trackEvent('admin__ai_benchmark_run--abort', { source: 'menu' });
                                                                                    cancelRun(run);
                                                                                }}
                                                                            >
                                                                                <StopCircle />
                                                                                Abort run
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </AdminSurfaceCard>
                    </TabsContent>

                    <TabsContent value="compare" className="mt-0 flex flex-col gap-4">
                        <AdminSurfaceCard className="flex flex-col gap-4">
                            <AdminSectionHeader
                                title="Model comparison"
                                description="Averages per model in this session, best rated first. Rate runs to rank them."
                            />

                            {modelComparisonRows.length === 0 ? (
                                <AdminEmptyState
                                    title="Nothing to compare yet"
                                    description="Run at least one model, then rate its trips in Runs."
                                    action={(
                                        <Button type="button" variant="outline" size="sm" onClick={() => setWorkspaceTab('setup')}>
                                            Go to setup
                                        </Button>
                                    )}
                                />
                            ) : (
                                <div className="overflow-x-auto rounded-md border border-border">
                                    <Table className="text-xs">
                                        <TableHeader className="bg-secondary">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="ps-3">Model</TableHead>
                                                <TableHead>Rating</TableHead>
                                                <TableHead>Success</TableHead>
                                                <TableHead>Avg time</TableHead>
                                                <TableHead>Avg cost</TableHead>
                                                <TableHead>Avg tokens</TableHead>
                                                <TableHead>
                                                    <span data-tooltip="Share of runs where the semantic repair pass ran." tabIndex={0}>Repair</span>
                                                </TableHead>
                                                <TableHead className="pe-3">Runs</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {modelComparisonRows.map((row) => {
                                                const satisfactionClass = row.averageRatingScore === null
                                                    ? 'text-muted-foreground'
                                                    : row.averageRatingScore >= 2.5
                                                        ? 'text-emerald-700 dark:text-emerald-200'
                                                        : row.averageRatingScore >= 1.75
                                                            ? 'text-amber-700 dark:text-amber-200'
                                                            : 'text-rose-700 dark:text-rose-200';
                                                return (
                                                    <TableRow key={`${row.provider}-${row.model}`}>
                                                        <TableCell className="ps-3 font-medium text-foreground">
                                                            <ProviderLabel provider={row.provider} model={row.model} logoSize={13} />
                                                        </TableCell>
                                                        <TableCell className="tabular-nums">
                                                            {row.averageRatingScore === null ? (
                                                                <span className="text-muted-foreground">No votes</span>
                                                            ) : (
                                                                <>
                                                                    <span className={`font-medium ${satisfactionClass}`}>{row.averageRatingScore.toFixed(2)} / 3</span>
                                                                    <span className="ms-1 text-muted-foreground">· {row.ratingCount} vote{row.ratingCount === 1 ? '' : 's'}</span>
                                                                </>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="tabular-nums text-foreground">{Math.round(row.successRate * 100)}%</TableCell>
                                                        <TableCell className="tabular-nums text-foreground">{formatDuration(row.averageLatencyMs)}</TableCell>
                                                        <TableCell className="tabular-nums text-foreground">{formatUsd(row.averageCostUsd)}</TableCell>
                                                        <TableCell className="tabular-nums text-foreground">{row.averageTotalTokens?.toLocaleString() ?? '—'}</TableCell>
                                                        <TableCell className="tabular-nums text-foreground">{Math.round(row.repairRate * 100)}%</TableCell>
                                                        <TableCell className="pe-3 tabular-nums text-foreground">{row.totalRuns}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </AdminSurfaceCard>

                        <AdminSurfaceCard className="flex flex-col gap-4">
                            <AdminSectionHeader
                                title="Last 7 days, all AI calls"
                                description={snapshotTelemetrySummary ? (
                                    <span className="tabular-nums">
                                        {snapshotTelemetrySummary.total.toLocaleString()} calls · {snapshotTelemetrySummary.successRate.toFixed(1)}% success · {formatUsd(snapshotTelemetrySummary.totalCostUsd)}
                                    </span>
                                ) : 'Benchmark and live planner calls together. Leaders across the whole week.'}
                                actions={(
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void refreshTelemetryData()}
                                            disabled={snapshotTelemetryLoading}
                                            aria-busy={snapshotTelemetryLoading || undefined}
                                        >
                                            <ArrowClockwise className={snapshotTelemetryLoading ? 'animate-spin' : ''} />
                                            Reload
                                        </Button>
                                        <Button asChild variant="ghost" size="sm">
                                            <Link
                                                to="/admin/ai-benchmark/telemetry"
                                                onClick={() => trackEvent('admin__ai_benchmark--open_telemetry')}
                                                {...getAnalyticsDebugAttributes('admin__ai_benchmark--open_telemetry')}
                                            >
                                                Open AI telemetry
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            />

                            {snapshotTelemetryError && <AdminErrorAlert message={snapshotTelemetryError} />}

                            <div className="grid gap-4 xl:grid-cols-3">
                                {snapshotTelemetryCards.map((card) => (
                                    <AdminStatCard
                                        key={card.id}
                                        label={card.title}
                                        value={<span className="tabular-nums">{card.metric}</span>}
                                        hint={card.detail}
                                        isLoading={snapshotTelemetryLoading}
                                    >
                                        <div className="text-sm">
                                            {card.model ? (
                                                <ProviderLabel
                                                    provider={card.model.provider}
                                                    model={card.model.model}
                                                    providerClassName="font-medium text-foreground"
                                                    modelClassName="truncate text-muted-foreground"
                                                    logoSize={14}
                                                />
                                            ) : <span className="text-muted-foreground">No model yet</span>}
                                        </div>
                                    </AdminStatCard>
                                ))}
                            </div>
                        </AdminSurfaceCard>
                    </TabsContent>

                    <TabsContent value="setup" className="mt-0">
                        <AdminSurfaceCard className="p-0">
                            <div className="divide-y divide-border">
                                <section className="flex flex-col gap-3 p-4 md:p-6">
                                    <AdminSectionHeader
                                        title="Trip template"
                                        description="The trip request every model receives."
                                        actions={(
                                            <Button type="button" variant="outline" size="sm" onClick={() => setTemplateDetailsOpen(true)}>
                                                Details and prompt
                                            </Button>
                                        )}
                                    />
                                    <div className="grid gap-3 md:grid-cols-[minmax(220px,0.8fr)_minmax(300px,1.6fr)]">
                                        <Select value={selectedPresetId} onValueChange={(value) => void handlePresetSelection(value)}>
                                            <SelectTrigger aria-label="Trip template" className="h-9">
                                                <SelectValue placeholder="Choose a template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {presetConfigs.map((preset) => (
                                                        <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                                                    ))}
                                                    <SelectItem value={CUSTOM_JSON_PRESET_ID}>{CUSTOM_JSON_PRESET_NAME}</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                <Badge variant="outline">{selectedPreset?.kind === 'custom' ? 'Custom' : 'System'}</Badge>
                                                <Badge variant="secondary" className="max-w-full truncate">{destinations || 'No destination'}</Badge>
                                                <Badge variant="outline">{dateInputMode === 'flex' ? `${flexWeeks} week flexible` : `${startDate} → ${endDate}`}</Badge>
                                                <Badge variant="outline">{budget}</Badge>
                                                <Badge variant="outline">{pace}</Badge>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                                                {selectedPreset?.description || 'No description saved for this template.'}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="flex flex-col gap-3 p-4 md:p-6">
                                    <AdminSectionHeader
                                        title="Models"
                                        description="Switch a model off to skip it without removing it."
                                        actions={(
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        trackEvent('admin__ai_benchmark--add_models');
                                                        openModelPicker();
                                                    }}
                                                    disabled={loading || cancelling || hasPendingRuns}
                                                    {...getAnalyticsDebugAttributes('admin__ai_benchmark--add_models')}
                                                >
                                                    <Plus />
                                                    Add models
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild disabled={loading || cancelling || hasPendingRuns || selectedTargets.length === 0}>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            disabled={loading || cancelling || hasPendingRuns || selectedTargets.length === 0}
                                                            aria-label="Model list actions"
                                                            data-tooltip="Model list actions"
                                                        >
                                                            <DotsThree weight="bold" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-[200px]">
                                                        <DropdownMenuItem disabled={allTargetsActive} onSelect={activateAllModelTargets}>
                                                            <ToggleRight />
                                                            Activate all
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem disabled={allTargetsInactive} onSelect={deactivateAllModelTargets}>
                                                            <ToggleLeft />
                                                            Deactivate all
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem variant="destructive" onSelect={() => void removeAllModelTargets()}>
                                                            <Trash />
                                                            Remove all…
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </>
                                        )}
                                    />

                                    {selectedTargets.length === 0 ? (
                                        <AdminEmptyState
                                            title="No benchmark models selected"
                                            description="Add models to build a comparison set."
                                        />
                                    ) : (
                                        <div className="overflow-x-auto rounded-md border border-border">
                                            <Table>
                                                <TableHeader className="bg-secondary">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="ps-4">Model</TableHead>
                                                        <TableHead className="w-[120px]">
                                                            <span className="inline-flex items-center gap-1" data-tooltip={COST_ESTIMATE_FOOTNOTE} tabIndex={0}>
                                                                Est. cost
                                                                <Info aria-hidden="true" className="size-3.5" />
                                                            </span>
                                                        </TableHead>
                                                        <TableHead className="w-[220px]">Reasoning</TableHead>
                                                        <TableHead className="w-[90px]">Active</TableHead>
                                                        <TableHead className="w-[90px] pe-4"><span className="sr-only">Actions</span></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedTargets.map((model) => {
                                                        const isActive = !inactiveTargetIdSet.has(model.id);
                                                        const singleTarget: AiBenchmarkRunTarget = { provider: model.provider, model: model.model, label: model.label };
                                                        return (
                                                            <TableRow key={model.id} className={!isActive ? 'bg-secondary/70 text-muted-foreground' : undefined}>
                                                                <TableCell className="ps-4">
                                                                    <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                                                        <AiProviderLogo provider={model.provider} model={model.model} size={20} />
                                                                        <span className="min-w-0 truncate">{model.label}</span>
                                                                        {aiRuntimeSettings.defaultModelId === model.id && <Badge variant="secondary">App default</Badge>}
                                                                    </div>
                                                                    <div className="select-all ps-7 font-mono text-xs text-muted-foreground">{model.providerShortName} · {model.model}</div>
                                                                </TableCell>
                                                                <TableCell className="text-sm tabular-nums text-foreground">
                                                                    {model.estimatedCostPerQueryLabel || <span className="text-muted-foreground">—</span>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <ModelReasoningSelect
                                                                        model={model}
                                                                        runDefault={benchmarkReasoningMode}
                                                                        value={modelReasoningModes[model.id]}
                                                                        onChange={(value) => setModelReasoningModes((current) => {
                                                                            if (value === undefined) {
                                                                                const next = { ...current };
                                                                                delete next[model.id];
                                                                                return next;
                                                                            }
                                                                            return { ...current, [model.id]: value };
                                                                        })}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Switch
                                                                        checked={isActive}
                                                                        onCheckedChange={() => toggleModelTargetActive(model.id)}
                                                                        disabled={loading || cancelling || hasPendingRuns}
                                                                        aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${model.label}`}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="pe-4">
                                                                    <div className="flex justify-end gap-1">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon-sm"
                                                                            onClick={() => {
                                                                                trackEvent('admin__ai_benchmark--run_single');
                                                                                scrollToResults();
                                                                                runSingleTarget(singleTarget);
                                                                            }}
                                                                            disabled={loading || cancelling || hasPendingRuns}
                                                                            aria-label={`Run ${model.label} only`}
                                                                            data-tooltip={`Run ${model.label} only`}
                                                                            {...getAnalyticsDebugAttributes('admin__ai_benchmark--run_single')}
                                                                        >
                                                                            <Play weight="fill" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon-sm"
                                                                            onClick={() => void removeModelTarget(model.id)}
                                                                            disabled={loading || cancelling || hasPendingRuns}
                                                                            aria-label={`Remove ${model.label}`}
                                                                            data-tooltip={`Remove ${model.label}`}
                                                                        >
                                                                            <X />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}

                                    <div className="grid gap-1.5 border-t border-border pt-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,380px)] md:items-center">
                                        <div>
                                            <div className="text-sm font-medium text-foreground">App default model</div>
                                            <p className="text-xs text-muted-foreground">What the planner and the Trip Agent use for real trips. Picking a model here also approves it.</p>
                                        </div>
                                        <AiModelPicker
                                            value={aiRuntimeSettings.defaultModelId}
                                            models={activeModels}
                                            onChange={(value) => {
                                                trackEvent('admin__ai_benchmark--app_default_model');
                                                void persistAiRuntimeSettings({
                                                    defaultModelId: value,
                                                    approvedOpenRouterModels: Array.from(new Set([
                                                        ...aiRuntimeSettings.approvedOpenRouterModels,
                                                        ...(value.startsWith('openrouter:') ? [value.slice('openrouter:'.length)] : []),
                                                    ])),
                                                });
                                            }}
                                        />
                                    </div>
                                </section>

                                <section className="flex flex-col gap-3 p-4 md:p-6">
                                    <AdminSectionHeader
                                        title="Execution"
                                        description="Applies to the next run. A model's own reasoning setting wins over the run default."
                                    />
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                                            New session name
                                            <Input
                                                aria-label="Session name"
                                                value={sessionName}
                                                onChange={(event) => setSessionName(event.target.value)}
                                                className="h-9"
                                            />
                                            <span className="font-normal text-muted-foreground">
                                                {session
                                                    ? `Runs join “${session.name || 'Unnamed session'}”. Start a new session from the Runs menu to use this name.`
                                                    : 'Names the session your next run creates.'}
                                            </span>
                                        </label>

                                        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                                            Run default reasoning
                                            <Select value={benchmarkReasoningMode} onValueChange={(value) => setBenchmarkReasoningMode(value as BenchmarkReasoningMode)}>
                                                <SelectTrigger aria-label="Run default reasoning" className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        <SelectItem value="provider-default">Model default</SelectItem>
                                                        {AI_REASONING_EFFORTS.map((effort) => (
                                                            <SelectItem key={effort} value={effort}>{REASONING_MODE_LABELS[effort]}</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            <span className="font-normal text-muted-foreground">Used by {reasoningTargets.length} compatible model{reasoningTargets.length === 1 ? '' : 's'}.</span>
                                        </label>

                                        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                                            Parallel requests
                                            <Select value={String(benchmarkConcurrency)} onValueChange={(value) => setBenchmarkConcurrency(Number(value))}>
                                                <SelectTrigger aria-label="Parallel requests" className="h-9"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectGroup>
                                                        {Array.from({ length: BENCHMARK_CONCURRENCY_MAX }, (_, index) => index + 1).map((count) => (
                                                            <SelectItem key={count} value={String(count)}>{count} at a time</SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                </SelectContent>
                                            </Select>
                                            <span className="font-normal text-muted-foreground">
                                                {queuedBehindConcurrency > 0
                                                    ? `${queuedBehindConcurrency} model${queuedBehindConcurrency === 1 ? '' : 's'} will wait in the queue. Lower reduces timeout risk.`
                                                    : 'Lower reduces provider contention and timeout risk.'}
                                            </span>
                                        </label>

                                        <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                                            Time limit
                                            <Input
                                                type="number"
                                                aria-label="Timeout seconds"
                                                min={BENCHMARK_TIMEOUT_MIN_SECONDS}
                                                max={BENCHMARK_TIMEOUT_MAX_SECONDS}
                                                step={5}
                                                value={benchmarkTimeoutSeconds}
                                                className="h-9 tabular-nums"
                                                onChange={(event) => {
                                                    const parsed = Number(event.target.value);
                                                    setBenchmarkTimeoutSeconds(Number.isFinite(parsed)
                                                        ? Math.max(BENCHMARK_TIMEOUT_MIN_SECONDS, Math.min(BENCHMARK_TIMEOUT_MAX_SECONDS, Math.round(parsed)))
                                                        : BENCHMARK_TIMEOUT_DEFAULT_SECONDS);
                                                }}
                                            />
                                            <span className="font-normal text-muted-foreground">Seconds per model; actual latency stays visible.</span>
                                        </label>

                                        <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-secondary p-3">
                                            <div>
                                                <div className="text-xs font-medium text-foreground">Compact output</div>
                                                <p className="mt-1 text-xs text-muted-foreground">Shorter JSON, faster comparisons.</p>
                                            </div>
                                            <Switch aria-label="Compact output" checked={compactBenchmarkOutput} onCheckedChange={setCompactBenchmarkOutput} />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </AdminSurfaceCard>
                    </TabsContent>
                </Tabs>

                <AiBenchmarkRunSheet
                    run={inspectedRun}
                    onOpenChange={(open) => { if (!open) setInspectedRunId(null); }}
                    costEstimateLabel={inspectedRun ? getModelCostEstimateLabel(inspectedRun.provider, inspectedRun.model) : null}
                    commentDraft={inspectedRun ? (runCommentDrafts[inspectedRun.id] ?? inspectedRun.run_comment ?? '') : ''}
                    onCommentDraftChange={(value) => {
                        if (!inspectedRun) return;
                        setRunCommentDrafts((current) => ({ ...current, [inspectedRun.id]: value }));
                    }}
                    onSaveComment={() => { if (inspectedRun) void saveRunComment(inspectedRun); }}
                    commentSaving={Boolean(inspectedRun && commentSavingRunId === inspectedRun.id)}
                    onRate={(rating) => { if (inspectedRun) void updateRunRating(inspectedRun, rating); }}
                    ratingSaving={Boolean(inspectedRun && ratingSavingRunId === inspectedRun.id)}
                    busy={loading}
                    cancelling={cancelling}
                    onRerun={() => { if (inspectedRun) void rerunTarget(inspectedRun); }}
                    onAbort={() => { if (inspectedRun) cancelRun(inspectedRun); }}
                    onDownload={() => { if (inspectedRun) downloadRow(inspectedRun); }}
                />

                <AppModal
                    isOpen={templateDetailsOpen}
                    onClose={() => setTemplateDetailsOpen(false)}
                    title={selectedPreset?.name || 'Trip template details'}
                    description="Review the benchmark input without losing the run configuration."
                    size="xl"
                    mobileSheet={false}
                    contentClassName="sm:rounded-lg"
                    footer={(
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={openPromptPreview}>Preview prompt</Button>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => { setTemplateDetailsOpen(false); openPresetEditor('create'); }}>
                                    Save as new template
                                </Button>
                                {selectedPresetId !== CUSTOM_JSON_PRESET_ID && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => { setTemplateDetailsOpen(false); openPresetEditor('edit'); }}>
                                        Edit template
                                    </Button>
                                )}
                                <Button type="button" size="sm" onClick={() => setTemplateDetailsOpen(false)}>Done</Button>
                            </div>
                        </div>
                    )}
                >
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-2 sm:grid-cols-4">
                            {[
                                { label: 'Route', value: destinations || 'Not set' },
                                { label: 'Dates', value: dateInputMode === 'flex' ? `${flexWeeks} weeks · ${flexWindow}` : `${startDate} → ${endDate}` },
                                { label: 'Budget', value: budget },
                                { label: 'Pace', value: pace },
                            ].map((item) => (
                                <div key={item.label} className="min-w-0 rounded-md border border-border bg-secondary p-3">
                                    <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
                                    <div className="mt-1 truncate text-sm font-semibold text-foreground" data-tooltip={item.value}>{item.value}</div>
                                </div>
                            ))}
                        </div>

                        <div>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground">Scenario JSON</h4>
                                    <p className="text-xs text-muted-foreground">The normalized input sent through the classic benchmark contract.</p>
                                </div>
                                {selectedPresetId === CUSTOM_JSON_PRESET_ID && (
                                    <AdminStatusBadge tone={customScenarioDraftParse.error ? 'danger' : 'neutral'} className="max-w-full truncate">
                                        {customScenarioDraftParse.error || `Mapped as ${customScenarioDraftParse.flow}`}
                                    </AdminStatusBadge>
                                )}
                            </div>

                            {selectedPresetId === CUSTOM_JSON_PRESET_ID ? (
                                <div className="flex flex-col gap-2">
                                    <textarea
                                        aria-label="Custom scenario JSON"
                                        value={customScenarioJsonDraft}
                                        onChange={(event) => {
                                            setCustomScenarioJsonDraft(event.target.value);
                                            setCustomScenarioMeta((current) => current || { source: 'manual', flow: 'unknown', tripId: null });
                                        }}
                                        rows={16}
                                        spellCheck={false}
                                        className="min-h-[320px] w-full rounded-md border border-slate-700 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 outline-none focus-visible:border-accent-400 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                        placeholder='{"destinationPrompt":"Berlin, Germany","options":{"budget":"Medium"}}'
                                    />
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => loadCurrentMaskIntoCustomJson()}>Load current setup</Button>
                                        <Button type="button" size="sm" onClick={applyCustomJsonToMask} disabled={!customScenarioJsonDraft.trim() || Boolean(customScenarioDraftParse.error)}>Apply JSON</Button>
                                    </div>
                                </div>
                            ) : (
                                <pre className="max-h-[420px] overflow-auto rounded-md border border-slate-800 bg-slate-950 p-4 text-xs leading-6">
                                    <code
                                        className="language-json"
                                        dangerouslySetInnerHTML={{ __html: selectedTemplateJsonHtml }}
                                    />
                                </pre>
                            )}
                        </div>
                    </div>
                </AppModal>

                <AppModal
                    isOpen={modelModalOpen}
                    onClose={() => setModelModalOpen(false)}
                    title="Choose benchmark models"
                    description="Tick the models to compare. Saving also approves new OpenRouter models for the app."
                    size="lg"
                    mobileSheet={false}
                    footer={(
                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setModelModalOpen(false)}>Cancel</Button>
                            <Button type="button" size="sm" onClick={() => void saveModelDraft()}>Save {modelDraftIds.length} model{modelDraftIds.length === 1 ? '' : 's'}</Button>
                        </div>
                    )}
                >
                    <div className="flex flex-col gap-4">
                        <div className="rounded-lg border border-border bg-secondary p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="inline-flex items-center gap-2 text-xs font-medium text-foreground"><Funnel size={15} aria-hidden="true" /> Catalog filters</div>
                                <Button type="button" variant="ghost" size="sm" onClick={() => void loadModelCatalog()} disabled={modelCatalogLoading} aria-busy={modelCatalogLoading || undefined}>
                                    <ArrowClockwise className={modelCatalogLoading ? 'animate-spin' : ''} /> Refresh OpenRouter
                                </Button>
                            </div>
                            <SearchInput
                                aria-label="Search provider, label, or model id"
                                value={modelFilter}
                                onChange={(event) => setModelFilter(event.currentTarget.value)}
                                onClear={() => setModelFilter('')}
                                placeholder="Search provider, model, or exact OpenRouter ID"
                            />
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                <Select value={modelProviderFilter} onValueChange={setModelProviderFilter}>
                                    <SelectTrigger aria-label="Filter model provider"><SelectValue placeholder="All providers" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All providers</SelectItem>{modelProviderOptions.map((provider) => <SelectItem key={provider} value={provider}>{provider}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={modelCapabilityFilter} onValueChange={setModelCapabilityFilter}>
                                    <SelectTrigger aria-label="Filter model capability"><SelectValue placeholder="All capabilities" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All capabilities</SelectItem><SelectItem value="structured">Structured output</SelectItem><SelectItem value="tools">Tool support</SelectItem><SelectItem value="reasoning">Reasoning</SelectItem></SelectContent>
                                </Select>
                                <Select value={modelPriceFilter} onValueChange={setModelPriceFilter}>
                                    <SelectTrigger aria-label="Filter model price"><SelectValue placeholder="Any price" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">Any price</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="budget">Budget (≤ $5/M output)</SelectItem><SelectItem value="premium">Premium (&gt; $5/M output)</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                                <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                                    Newer than
                                    <Select value={String(aiRuntimeSettings.modelMaxAgeMonths)} onValueChange={(value) => {
                                        const modelMaxAgeMonths = Number(value);
                                        setAiRuntimeSettings((current) => ({ ...current, modelMaxAgeMonths }));
                                        void persistAiRuntimeSettings({ modelMaxAgeMonths }, { silent: true });
                                    }}>
                                        <SelectTrigger aria-label="Model age threshold" className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{[3, 6, 12, 24].map((months) => <SelectItem key={months} value={String(months)}>{months} months</SelectItem>)}</SelectContent>
                                    </Select>
                                </label>
                                <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                                    <Switch checked={aiRuntimeSettings.showOlderModels} onCheckedChange={(showOlderModels) => {
                                        setAiRuntimeSettings((current) => ({ ...current, showOlderModels }));
                                        void persistAiRuntimeSettings({ showOlderModels }, { silent: true });
                                    }} aria-label="Show older models" />
                                    Show older models
                                </label>
                                <span className="text-xs tabular-nums text-muted-foreground">{filteredModels.length} compatible models</span>
                            </div>
                        </div>
                        <div className="max-h-[55vh] space-y-3 overflow-y-auto pe-1">
                            {filteredModels.length === 0 && (
                                <AdminEmptyState
                                    title="No compatible models match these filters"
                                    description="Try showing older models or clearing a filter."
                                />
                            )}
                            {Object.entries(groupedModels).map(([providerLabel, models]: [string, AiModelCatalogItem[]]) => (
                                <div key={providerLabel} className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <AiProviderLogo provider={models[0]?.provider || providerLabel} model={models[0]?.model} size={12} />
                                        <span>{providerLabel}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {models.map((model) => {
                                            const selected = modelDraftIds.includes(model.id);
                                            const disabled = model.availability !== 'active';
                                            return (
                                                <label
                                                    key={model.id}
                                                    className={[
                                                        'flex w-full cursor-pointer items-center gap-3 rounded-md border p-2 text-start text-xs transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                                                        selected
                                                            ? 'border-accent-300 bg-accent-50 text-accent-900 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200'
                                                            : 'border-border bg-card text-foreground hover:bg-secondary',
                                                        disabled ? 'cursor-not-allowed opacity-50' : '',
                                                    ].join(' ')}
                                                >
                                                    <Checkbox
                                                        checked={selected}
                                                        disabled={disabled}
                                                        onCheckedChange={() => toggleModelDraft(model.id)}
                                                        aria-label={`Include ${model.label}`}
                                                    />
                                                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                        <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                                                            <AiProviderLogo provider={model.provider} model={model.model} size={12} />
                                                            <span className="min-w-0 truncate font-semibold">{model.label}</span>
                                                            {aiRuntimeSettings.defaultModelId === model.id && <Badge variant="secondary">App default</Badge>}
                                                            {model.catalogSource === 'openrouter-live' && <Badge variant="outline">Live</Badge>}
                                                            {model.isFree && <Badge variant="outline">Free</Badge>}
                                                        </span>
                                                        <span className="truncate text-xs font-normal text-muted-foreground">
                                                            {model.contextLength ? `${Math.round(model.contextLength / 1000)}k context · ` : ''}
                                                            {model.supportsReasoning
                                                                ? `Reasoning ${model.reasoningMandatory ? 'required' : 'optional'} · ${model.reasoningEfforts?.join(', ') || 'provider controlled'}${model.defaultReasoningEffort ? ` · default ${model.defaultReasoningEffort}` : ''}`
                                                                : 'No configurable reasoning'}
                                                        </span>
                                                    </span>
                                                    <span className="ms-2 shrink-0 text-xs tabular-nums text-muted-foreground">{model.estimatedCostPerQueryLabel}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </AppModal>

                <AppModal
                    isOpen={Boolean(presetEditor)}
                    onClose={() => setPresetEditor(null)}
                    title={presetEditor?.mode === 'create' ? 'New trip template' : 'Edit trip template'}
                    description="Templates are saved to your admin account and reused for every run."
                    size="lg"
                    mobileSheet={false}
                    footer={(
                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setPresetEditor(null)}>
                                Cancel
                            </Button>
                            <Button type="button" size="sm" onClick={() => void savePresetDraft()}>
                                Save template
                            </Button>
                        </div>
                    )}
                >
                    {presetEditor && (
                        <div className="grid grid-cols-1 gap-3">
                            <label className="flex flex-col gap-1.5">
                                <span className={presetFieldLabelClass}>Name</span>
                                <Input
                                    aria-label="Name"
                                    value={presetEditor.name}
                                    onChange={(event) => setPresetEditor((current) => current ? { ...current, name: event.target.value } : current)}
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className={presetFieldLabelClass}>Description</span>
                                <Input
                                    aria-label="Description"
                                    value={presetEditor.description}
                                    onChange={(event) => setPresetEditor((current) => current ? { ...current, description: event.target.value } : current)}
                                />
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className={presetFieldLabelClass}>Destinations</span>
                                <Input
                                    aria-label="Destinations"
                                    value={presetEditor.scenario.destinations}
                                    onChange={(event) => updatePresetDraftScenario('destinations', event.target.value)}
                                />
                            </label>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Date mode</span>
                                    <Select
                                        value={presetEditor.scenario.dateInputMode}
                                        onValueChange={(value) => updatePresetDraftScenario('dateInputMode', value as BenchmarkMaskScenario['dateInputMode'])}
                                    >
                                        <SelectTrigger aria-label="Date mode">
                                            <SelectValue placeholder="Date mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="exact">Exact dates</SelectItem>
                                            <SelectItem value="flex">Flexible window</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {presetEditor.scenario.dateInputMode === 'flex' ? (
                                    <label className="flex flex-col gap-1.5">
                                        <span className={presetFieldLabelClass}>Flex weeks</span>
                                        <Input
                                            type="number"
                                            aria-label="Flex weeks"
                                            min={1}
                                            max={12}
                                            value={presetEditor.scenario.flexWeeks}
                                            onChange={(event) => {
                                                const next = Number(event.target.value);
                                                const normalized = Number.isFinite(next) ? Math.min(12, Math.max(1, Math.round(next))) : 1;
                                                updatePresetDraftScenario('flexWeeks', normalized);
                                            }}
                                        />
                                    </label>
                                ) : (
                                    <label className="flex flex-col gap-1.5">
                                        <span className={presetFieldLabelClass}>Start date</span>
                                        <Input
                                            type="date"
                                            aria-label="Start date"
                                            value={presetEditor.scenario.startDate || defaultDates.startDate}
                                            onChange={(event) => updatePresetDraftScenario('startDate', event.target.value)}
                                        />
                                    </label>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {presetEditor.scenario.dateInputMode === 'exact' ? (
                                    <label className="flex flex-col gap-1.5">
                                        <span className={presetFieldLabelClass}>End date</span>
                                        <Input
                                            type="date"
                                            aria-label="End date"
                                            value={presetEditor.scenario.endDate || defaultDates.endDate}
                                            onChange={(event) => updatePresetDraftScenario('endDate', event.target.value)}
                                        />
                                    </label>
                                ) : (
                                    <div className="flex flex-col gap-1.5">
                                        <span className={presetFieldLabelClass}>Flex window</span>
                                        <Select
                                            value={presetEditor.scenario.flexWindow}
                                            onValueChange={(value) => updatePresetDraftScenario('flexWindow', value as BenchmarkMaskScenario['flexWindow'])}
                                        >
                                            <SelectTrigger aria-label="Flex window">
                                                <SelectValue placeholder="Preferred time range" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="spring">Spring</SelectItem>
                                                <SelectItem value="summer">Summer</SelectItem>
                                                <SelectItem value="autumn">Autumn</SelectItem>
                                                <SelectItem value="winter">Winter</SelectItem>
                                                <SelectItem value="shoulder">Shoulder</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Round trip</span>
                                    <Select
                                        value={presetEditor.scenario.roundTrip ? 'yes' : 'no'}
                                        onValueChange={(value) => updatePresetDraftScenario('roundTrip', value === 'yes')}
                                    >
                                        <SelectTrigger aria-label="Round trip">
                                            <SelectValue placeholder="Round trip" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Budget</span>
                                    <Select value={presetEditor.scenario.budget} onValueChange={(value) => updatePresetDraftScenario('budget', value)}>
                                        <SelectTrigger aria-label="Budget">
                                            <SelectValue placeholder="Budget" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Luxury">Luxury</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Pace</span>
                                    <Select value={presetEditor.scenario.pace} onValueChange={(value) => updatePresetDraftScenario('pace', value)}>
                                        <SelectTrigger aria-label="Pace">
                                            <SelectValue placeholder="Pace" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Relaxed">Relaxed</SelectItem>
                                            <SelectItem value="Balanced">Balanced</SelectItem>
                                            <SelectItem value="Fast">Fast</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Specific cities</span>
                                    <Input
                                        aria-label="Specific cities"
                                        value={presetEditor.scenario.specificCities}
                                        onChange={(event) => updatePresetDraftScenario('specificCities', event.target.value)}
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Stops</span>
                                    <Input
                                        type="number"
                                        aria-label="Stops"
                                        min={1}
                                        max={20}
                                        value={presetEditor.scenario.numCities ?? ''}
                                        onChange={(event) => {
                                            const next = event.target.value ? Number(event.target.value) : null;
                                            updatePresetDraftScenario('numCities', Number.isFinite(next as number) ? (next as number) : null);
                                        }}
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Traveler setup</span>
                                    <Select
                                        value={presetEditor.scenario.travelerSetup}
                                        onValueChange={(value) => updatePresetDraftScenario('travelerSetup', value as BenchmarkMaskScenario['travelerSetup'])}
                                    >
                                        <SelectTrigger aria-label="Traveler setup">
                                            <SelectValue placeholder="Traveler setup" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="solo">Solo</SelectItem>
                                            <SelectItem value="couple">Couple</SelectItem>
                                            <SelectItem value="friends">Friends</SelectItem>
                                            <SelectItem value="family">Family</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Trip style</span>
                                    <Select
                                        value={presetEditor.scenario.tripStyleMask}
                                        onValueChange={(value) => updatePresetDraftScenario('tripStyleMask', value as BenchmarkMaskScenario['tripStyleMask'])}
                                    >
                                        <SelectTrigger aria-label="Trip style">
                                            <SelectValue placeholder="Trip style" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="everything_except_remote_work">Everything except remote work</SelectItem>
                                            <SelectItem value="culture_focused">Culture focused</SelectItem>
                                            <SelectItem value="food_focused">Food focused</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className={presetFieldLabelClass}>Transport</span>
                                    <Select
                                        value={presetEditor.scenario.transportMask}
                                        onValueChange={(value) => updatePresetDraftScenario('transportMask', value as BenchmarkMaskScenario['transportMask'])}
                                    >
                                        <SelectTrigger aria-label="Transport">
                                            <SelectValue placeholder="Transport" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="automatic">Automatic</SelectItem>
                                            <SelectItem value="plane">Plane</SelectItem>
                                            <SelectItem value="train">Train</SelectItem>
                                            <SelectItem value="camper">Camper</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className={presetFieldLabelClass}>Notes/interests</span>
                                <Textarea
                                    aria-label="Notes/interests"
                                    rows={3}
                                    value={presetEditor.scenario.notes}
                                    onChange={(event) => updatePresetDraftScenario('notes', event.target.value)}
                                    className="resize-y"
                                />
                            </label>

                            <label className="inline-flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                    aria-label="Route lock"
                                    checked={presetEditor.scenario.routeLock}
                                    onCheckedChange={(checked) => updatePresetDraftScenario('routeLock', checked === true)}
                                />
                                Route lock (metadata only)
                            </label>
                        </div>
                    )}
                </AppModal>

                <AppModal
                    isOpen={Boolean(promptModal)}
                    onClose={() => setPromptModal(null)}
                    title="Generated benchmark prompt"
                    description={promptModal ? formatTimestamp(promptModal.generatedAt) : undefined}
                    closeLabel="Close generated benchmark prompt"
                    size="xl"
                    mobileSheet={false}
                    footer={(
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={copyPromptToClipboard}>
                                Copy
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={downloadPromptText}>
                                <DownloadSimple />
                                Download .txt
                            </Button>
                            <Button type="button" size="sm" onClick={() => setPromptModal(null)}>
                                Close
                            </Button>
                        </div>
                    )}
                >
                    {promptModal && (
                        <Textarea
                            aria-label="Prompt"
                            value={promptModal.prompt}
                            readOnly
                            rows={18}
                            className="bg-secondary font-mono text-xs md:text-xs"
                        />
                    )}
                </AppModal>

            </div>
        </AdminShell>
    );
};
