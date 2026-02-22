import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Plus,
    ArrowClockwise,
    DownloadSimple,
    Trash,
    CheckCircle,
    WarningCircle,
    HourglassHigh,
    Smiley,
    SmileyMeh,
    SmileySad,
    ArrowsDownUp,
    StopCircle,
    X,
} from '@phosphor-icons/react';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';
import {
    AI_MODEL_CATALOG,
    getDefaultCreateTripModel,
    groupAiModelsByProvider,
    sortAiModels,
} from '../config/aiModelCatalog';
import { buildClassicItineraryPrompt, GenerateOptions } from '../services/aiService';
import {
    BENCHMARK_DEFAULT_MODEL_IDS,
    createSystemBenchmarkPresets,
    normalizeBenchmarkMaskScenario,
    normalizeBenchmarkPreferencesPayload,
    type BenchmarkMaskScenario,
    type BenchmarkPreferencesPayload,
    type BenchmarkPresetConfig,
} from '../services/aiBenchmarkPreferencesService';
import { dbGetAccessToken, ensureDbSession } from '../services/dbService';
import { getDaysDifference, getDefaultTripDates } from '../utils';
import { getDestinationPromptLabel, resolveDestinationName } from '../services/destinationService';
import { useAuth } from '../hooks/useAuth';
import { AdminShell } from '../components/admin/AdminShell';
import { useAppDialog } from '../components/AppDialogProvider';
import { AppModal } from '../components/ui/app-modal';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';

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

interface BenchmarkRun {
    id: string;
    session_id: string;
    provider: string;
    model: string;
    label: string | null;
    run_index: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    latency_ms: number | null;
    schema_valid: boolean | null;
    usage: Record<string, unknown> | null;
    cost_usd: number | null;
    trip_id: string | null;
    error_message: string | null;
    satisfaction_rating?: 'good' | 'medium' | 'bad' | null;
    satisfaction_updated_at?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    created_at: string;
    updated_at?: string;
    normalized_trip?: Record<string, unknown> | null;
    validation_errors?: string[] | null;
    validation_checks?: Record<string, unknown> | null;
}

interface BenchmarkSummary {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
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

interface AiTelemetryApiResponse extends BenchmarkApiResponse {
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

interface PresetEditorDraft {
    mode: 'edit' | 'create';
    id: string;
    kind: 'system' | 'custom';
    name: string;
    description: string;
    scenario: BenchmarkMaskScenario;
}

type SatisfactionRating = 'good' | 'medium' | 'bad';
type RunSortDirection = 'asc' | 'desc';

interface ParsedRunError {
    shortMessage: string;
    details: unknown | null;
}

interface ValidationCheckStats {
    total: number;
    passed: number;
}

const DEFAULT_SESSION_NAME = 'AI benchmark session';
const BENCHMARK_PARALLEL_CONCURRENCY = 3;
const COST_ESTIMATE_FOOTNOTE = 'Estimate for one classic itinerary generation; real cost varies by prompt/output size.';
const BENCHMARK_EFFECTIVE_DEFAULTS = {
    travelerSetup: 'solo',
    tripStyle: 'everything_except_remote_work',
    transportPreference: 'automatic',
};

const SATISFACTION_SCORE: Record<SatisfactionRating, number> = {
    good: 3,
    medium: 2,
    bad: 1,
};

const SATISFACTION_META: Record<SatisfactionRating, { label: string; icon: React.ReactNode; activeClass: string; idleClass: string }> = {
    good: {
        label: 'Good',
        icon: <Smiley size={14} weight="fill" />,
        activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
        idleClass: 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50',
    },
    medium: {
        label: 'Medium',
        icon: <SmileyMeh size={14} weight="fill" />,
        activeClass: 'border-amber-300 bg-amber-50 text-amber-700',
        idleClass: 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50',
    },
    bad: {
        label: 'Bad',
        icon: <SmileySad size={14} weight="fill" />,
        activeClass: 'border-rose-300 bg-rose-50 text-rose-700',
        idleClass: 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50',
    },
};

const parseDestinations = (value: string): string[] => {
    const seen = new Set<string>();
    return value
        .split(',')
        .map((token) => resolveDestinationName(token))
        .filter(Boolean)
        .filter((entry) => {
            const key = entry.toLocaleLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const formatDuration = (ms: number | null | undefined): string => {
    if (!Number.isFinite(ms)) return '—';
    const value = Number(ms);
    if (value < 1000) return `${value} ms`;
    return `${(value / 1000).toFixed(2)} s`;
};

const formatUsd = (value: number | null | undefined): string => {
    if (!Number.isFinite(value)) return '—';
    return `$${Number(value).toFixed(6)}`;
};

const formatTimestamp = (value?: string | null): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '—';
    return new Date(parsed).toLocaleString();
};

const getRunTimestampIso = (run: BenchmarkRun): string | null => {
    return run.started_at || run.created_at || null;
};

const isRunActive = (run: BenchmarkRun): boolean => run.status === 'queued' || run.status === 'running';

const isRunCancelledByUser = (run: BenchmarkRun): boolean => {
    if (run.status !== 'failed') return false;
    if (!run.error_message) return false;
    return run.error_message.startsWith('Cancelled by user.');
};

const truncate = (value: string, max: number): string => {
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(1, max - 1))}…`;
};

const looksLikeJsonPayload = (value: string): boolean => {
    const trimmed = value.trim();
    return (
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'))
        || (trimmed.startsWith('"') && trimmed.endsWith('"'))
    );
};

const tryParseJsonString = (value: string): unknown | null => {
    if (!looksLikeJsonPayload(value)) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const tryParsePossiblyTruncatedJson = (value: string): unknown | null => {
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null;

    const direct = tryParseJsonString(trimmed);
    if (direct !== null) return direct;

    for (let index = trimmed.length - 1; index >= 0; index -= 1) {
        const char = trimmed[index];
        if (char !== '}' && char !== ']') continue;
        const candidate = trimmed.slice(0, index + 1);
        try {
            return JSON.parse(candidate);
        } catch {
            // continue scanning backwards
        }
    }

    return null;
};

const hydrateStringifiedJson = (value: unknown, depth = 0): unknown => {
    if (depth > 6) return value;

    if (typeof value === 'string') {
        const parsed = tryParseJsonString(value) ?? tryParsePossiblyTruncatedJson(value);
        if (parsed === null) return value;
        return hydrateStringifiedJson(parsed, depth + 1);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => hydrateStringifiedJson(entry, depth + 1));
    }

    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
                key,
                hydrateStringifiedJson(entry, depth + 1),
            ])
        );
    }

    return value;
};

const parseRunError = (errorMessage: string | null | undefined): ParsedRunError => {
    if (!errorMessage || !errorMessage.trim()) {
        return {
            shortMessage: 'Unknown error',
            details: null,
        };
    }

    const trimmed = errorMessage.trim();
    const firstBrace = trimmed.indexOf('{');
    if (firstBrace < 0) {
        return {
            shortMessage: truncate(trimmed, 180),
            details: null,
        };
    }

    const prefix = trimmed.slice(0, firstBrace).replace(/[:\s-]+$/, '').trim();
    const jsonCandidate = trimmed.slice(firstBrace).trim();

    try {
        const parsed = JSON.parse(jsonCandidate);
        return {
            shortMessage: truncate(prefix || 'Detailed provider error', 180),
            details: hydrateStringifiedJson(parsed),
        };
    } catch {
        return {
            shortMessage: truncate(prefix || trimmed, 180),
            details: {
                raw: jsonCandidate,
            },
        };
    }
};

const getValidationCheckStats = (checks: Record<string, unknown> | null | undefined): ValidationCheckStats => {
    if (!checks) return { total: 0, passed: 0 };
    const boolEntries = Object.values(checks).filter((value) => typeof value === 'boolean') as boolean[];
    if (boolEntries.length === 0) return { total: 0, passed: 0 };
    return {
        total: boolEntries.length,
        passed: boolEntries.filter(Boolean).length,
    };
};

const getValidationWarnings = (checks: Record<string, unknown> | null | undefined): string[] => {
    if (!checks) return [];
    const raw = checks.validationWarnings ?? checks.warnings;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
};

const summarizeRunsLocal = (rows: BenchmarkRun[]): BenchmarkSummary => {
    const total = rows.length;
    const completed = rows.filter((run) => run.status === 'completed').length;
    const failed = rows.filter((run) => run.status === 'failed').length;
    const running = rows.filter((run) => run.status === 'running').length;
    const queued = rows.filter((run) => run.status === 'queued').length;
    const completedLatencies = rows
        .filter((run) => run.status === 'completed' && typeof run.latency_ms === 'number')
        .map((run) => Number(run.latency_ms));
    const averageLatencyMs = completedLatencies.length > 0
        ? Math.round(completedLatencies.reduce((sum, value) => sum + value, 0) / completedLatencies.length)
        : null;
    const totalCostUsd = rows.reduce((sum, run) => sum + (typeof run.cost_usd === 'number' ? run.cost_usd : 0), 0);

    return {
        total,
        completed,
        failed,
        running,
        queued,
        averageLatencyMs,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
    };
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

    const [modelFilter, setModelFilter] = useState('');
    const [modelTargetIds, setModelTargetIds] = useState<string[]>(() => {
        const defaults = BENCHMARK_DEFAULT_MODEL_IDS.filter((modelId) =>
            AI_MODEL_CATALOG.some((entry) => entry.id === modelId && entry.availability === 'active')
        );
        if (defaults.length > 0) return defaults;
        return [getDefaultCreateTripModel().id];
    });
    const [modelModalOpen, setModelModalOpen] = useState(false);
    const [modelDraftIds, setModelDraftIds] = useState<string[]>([]);
    const [presetEditor, setPresetEditor] = useState<PresetEditorDraft | null>(null);
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const [hideFailedRuns, setHideFailedRuns] = useState(false);
    const [onlyWarningRuns, setOnlyWarningRuns] = useState(false);
    const [onlyUnratedRuns, setOnlyUnratedRuns] = useState(false);
    const [providerFilter, setProviderFilter] = useState<'all' | string>('all');
    const [runSortDirection, setRunSortDirection] = useState<RunSortDirection>('desc');
    const [errorModalRun, setErrorModalRun] = useState<BenchmarkRun | null>(null);
    const [validationModalRun, setValidationModalRun] = useState<BenchmarkRun | null>(null);
    const [ratingSavingRunId, setRatingSavingRunId] = useState<string | null>(null);
    const [promptModal, setPromptModal] = useState<{ prompt: string; generatedAt: string } | null>(null);

    const [loading, setLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [liveNow, setLiveNow] = useState(() => Date.now());
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
    const resultsSectionRef = useRef<HTMLElement | null>(null);
    const hasPendingRunsRef = useRef(false);

    const sortedModels = useMemo(() => sortAiModels(AI_MODEL_CATALOG), []);
    const activeModelIdSet = useMemo(() => new Set(sortedModels.filter((model) => model.availability === 'active').map((model) => model.id)), [sortedModels]);
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
        const activeModels = sortedModels.filter((model) => model.availability === 'active');
        if (!modelFilter.trim()) return activeModels;
        const token = modelFilter.trim().toLocaleLowerCase();
        return activeModels.filter((model) => {
            return (
                model.providerLabel.toLocaleLowerCase().includes(token)
                || model.label.toLocaleLowerCase().includes(token)
                || model.model.toLocaleLowerCase().includes(token)
            );
        });
    }, [modelFilter, sortedModels]);

    const groupedModels = useMemo(() => groupAiModelsByProvider(filteredModels), [filteredModels]);

    const selectedTargets = useMemo(() => {
        const seen = new Set<string>();
        return modelTargetIds
            .map((modelId) => AI_MODEL_CATALOG.find((model) => model.id === modelId))
            .filter((model): model is NonNullable<typeof model> => Boolean(model && model.availability === 'active'))
            .filter((model) => {
                if (seen.has(model.id)) return false;
                seen.add(model.id);
                return true;
            });
    }, [modelTargetIds]);
    const selectedPreset = useMemo(
        () => presetConfigs.find((preset) => preset.id === selectedPresetId) || null,
        [presetConfigs, selectedPresetId]
    );

    const providerOptions = useMemo(() => {
        const values = Array.from(new Set(runs.map((run) => run.provider).filter(Boolean)));
        values.sort((left, right) => left.localeCompare(right));
        return values;
    }, [runs]);

    const hasPendingRuns = useMemo(() => runs.some((run) => isRunActive(run)), [runs]);
    const hasExactCostData = useMemo(() => runs.some((run) => typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd)), [runs]);

    const displayRuns = useMemo(() => {
        const filtered = runs.filter((run) => {
            if (hideFailedRuns && run.status === 'failed') return false;
            if (onlyWarningRuns && getValidationWarnings(run.validation_checks).length === 0) return false;
            if (onlyUnratedRuns && run.satisfaction_rating) return false;
            if (providerFilter !== 'all' && run.provider !== providerFilter) return false;
            return true;
        });

        return filtered.sort((left, right) => {
            const leftTs = Date.parse(getRunTimestampIso(left) || '');
            const rightTs = Date.parse(getRunTimestampIso(right) || '');
            const leftSafe = Number.isFinite(leftTs) ? leftTs : 0;
            const rightSafe = Number.isFinite(rightTs) ? rightTs : 0;
            if (runSortDirection === 'asc') return leftSafe - rightSafe;
            return rightSafe - leftSafe;
        });
    }, [runs, hideFailedRuns, onlyWarningRuns, onlyUnratedRuns, providerFilter, runSortDirection]);

    const modelDashboardRows = useMemo(() => {
        const bucket = new Map<string, {
            provider: string;
            model: string;
            totalRuns: number;
            completedRuns: number;
            latencySum: number;
            latencyCount: number;
            costSum: number;
            costCount: number;
            ratingSum: number;
            ratingCount: number;
        }>();

        runs.forEach((run) => {
            const key = `${run.provider}::${run.model}`;
            if (!bucket.has(key)) {
                bucket.set(key, {
                    provider: run.provider,
                    model: run.model,
                    totalRuns: 0,
                    completedRuns: 0,
                    latencySum: 0,
                    latencyCount: 0,
                    costSum: 0,
                    costCount: 0,
                    ratingSum: 0,
                    ratingCount: 0,
                });
            }

            const entry = bucket.get(key);
            if (!entry) return;
            entry.totalRuns += 1;
            if (run.status === 'completed') entry.completedRuns += 1;

            if (typeof run.latency_ms === 'number' && Number.isFinite(run.latency_ms)) {
                entry.latencySum += run.latency_ms;
                entry.latencyCount += 1;
            }

            if (typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd)) {
                entry.costSum += run.cost_usd;
                entry.costCount += 1;
            }

            if (run.satisfaction_rating && SATISFACTION_SCORE[run.satisfaction_rating]) {
                entry.ratingSum += SATISFACTION_SCORE[run.satisfaction_rating];
                entry.ratingCount += 1;
            }
        });

        return Array.from(bucket.values())
            .map((entry) => {
                const averageLatencyMs = entry.latencyCount > 0 ? Math.round(entry.latencySum / entry.latencyCount) : null;
                const averageCostUsd = entry.costCount > 0 ? Number((entry.costSum / entry.costCount).toFixed(6)) : null;
                const averageRatingScore = entry.ratingCount > 0 ? Number((entry.ratingSum / entry.ratingCount).toFixed(2)) : null;
                return {
                    ...entry,
                    averageLatencyMs,
                    averageCostUsd,
                    averageRatingScore,
                };
            })
            .sort((left, right) => {
                const rightScore = right.averageRatingScore ?? -1;
                const leftScore = left.averageRatingScore ?? -1;
                if (rightScore !== leftScore) return rightScore - leftScore;
                if (right.ratingCount !== left.ratingCount) return right.ratingCount - left.ratingCount;
                const leftLatency = left.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
                const rightLatency = right.averageLatencyMs ?? Number.MAX_SAFE_INTEGER;
                return leftLatency - rightLatency;
            });
    }, [runs]);

    const getDisplayLatencyMs = useCallback((run: BenchmarkRun): number | null => {
        if (typeof run.latency_ms === 'number' && run.latency_ms > 0) {
            return run.latency_ms;
        }
        if (run.status !== 'running') {
            return typeof run.latency_ms === 'number' ? run.latency_ms : null;
        }
        if (!run.started_at) return null;
        const startedMs = Date.parse(run.started_at);
        if (!Number.isFinite(startedMs)) return null;
        return Math.max(0, liveNow - startedMs);
    }, [liveNow]);

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

    const normalizePreferencesForClient = useCallback((value: unknown): BenchmarkPreferencesPayload => {
        return normalizeBenchmarkPreferencesPayload(value, {
            fallbackPresets: defaultPresets,
            defaultStartDate: defaultDates.startDate,
            defaultEndDate: defaultDates.endDate,
            fallbackModelIds: defaultModelTargetIds,
            allowedModelIds: activeModelIdSet,
        });
    }, [activeModelIdSet, defaultDates.endDate, defaultDates.startDate, defaultModelTargetIds, defaultPresets]);

    useEffect(() => {
        void import('prismjs/themes/prism-tomorrow.css');
    }, []);

    useEffect(() => {
        if (!hasPendingRuns) return;
        const timer = window.setInterval(() => setLiveNow(Date.now()), 250);
        return () => window.clearInterval(timer);
    }, [hasPendingRuns]);

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
            payload = {
                ok: response.ok,
                error: raw || undefined,
            };
        }
        if (!response.ok) {
            throw new Error(payload.error || `Benchmark API request failed (${response.status})`);
        }

        return payload;
    }, [accessToken]);

    const savePreferences = useCallback(async (
        nextOverrides?: Partial<BenchmarkPreferencesPayload>,
        options?: { silent?: boolean }
    ): Promise<BenchmarkPreferencesPayload | null> => {
        if (!accessToken) return null;

        try {
            const draft = normalizePreferencesForClient({
                modelTargets: nextOverrides?.modelTargets ?? modelTargetIds,
                presets: nextOverrides?.presets ?? presetConfigs,
                selectedPresetId: nextOverrides?.selectedPresetId ?? selectedPresetId,
            });

            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/preferences', {
                method: 'POST',
                body: JSON.stringify(draft),
            }) as BenchmarkPreferencesApiResponse;

            const normalized = normalizePreferencesForClient(payload.preferences || draft);
            setModelTargetIds(normalized.modelTargets);
            setPresetConfigs(normalized.presets);
            setSelectedPresetId(normalized.selectedPresetId);
            if (!options?.silent) {
                setMessage('Benchmark preferences saved.');
            }
            return normalized;
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save benchmark preferences.');
            return null;
        }
    }, [
        accessToken,
        fetchBenchmarkApi,
        modelTargetIds,
        normalizePreferencesForClient,
        presetConfigs,
        selectedPresetId,
    ]);

    const loadPreferences = useCallback(async () => {
        if (!accessToken) return;

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/preferences', {
                method: 'GET',
            }) as BenchmarkPreferencesApiResponse;

            const normalized = normalizePreferencesForClient(payload.preferences || {});
            setModelTargetIds(normalized.modelTargets);
            setPresetConfigs(normalized.presets);
            setSelectedPresetId(normalized.selectedPresetId);
            const preset = normalized.presets.find((entry) => entry.id === normalized.selectedPresetId) || normalized.presets[0];
            if (preset) {
                applyMaskScenario(preset.scenario);
            }
        } catch (preferencesError) {
            setError(preferencesError instanceof Error ? preferencesError.message : 'Failed to load benchmark preferences');
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
        if (!accessToken) return;
        setPreferencesLoaded(false);
        void loadPreferences();
    }, [accessToken, loadPreferences]);

    useEffect(() => {
        if (preferencesLoaded) return;
        const preset = presetConfigs.find((entry) => entry.id === selectedPresetId) || presetConfigs[0];
        if (!preset) return;
        applyMaskScenario(preset.scenario);
    }, [applyMaskScenario, preferencesLoaded, presetConfigs, selectedPresetId]);

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
            setMessage(payload.session ? `Loaded benchmark session ${payload.session.id}` : null);

            if (payload.session?.share_token && payload.session.share_token !== sessionLookup) {
                const next = new URLSearchParams(searchParams);
                next.set('session', payload.session.share_token);
                setSearchParams(next, { replace: true });
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load benchmark session');
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
                setError(pollError instanceof Error ? pollError.message : 'Failed to refresh running benchmark session');
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
            }) as AiTelemetryApiResponse;

            setSnapshotTelemetrySummary(payload.summary || null);
            const fastest = Array.isArray(payload.rankings?.fastest) ? payload.rankings?.fastest[0] || null : null;
            const cheapest = Array.isArray(payload.rankings?.cheapest) ? payload.rankings?.cheapest[0] || null : null;
            const bestValue = Array.isArray(payload.rankings?.bestValue) ? payload.rankings?.bestValue[0] || null : null;
            setSnapshotFastestModel(fastest);
            setSnapshotCheapestModel(cheapest);
            setSnapshotBestValueModel(bestValue);
        } catch (snapshotError) {
            setSnapshotTelemetryError(snapshotError instanceof Error ? snapshotError.message : 'Failed to load 7-day telemetry snapshot');
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
        const selectedDestinations = parseDestinations(destinations);
        if (selectedDestinations.length === 0) {
            throw new Error('Please provide at least one destination.');
        }

        const destinationPrompt = selectedDestinations.map((entry) => getDestinationPromptLabel(entry)).join(', ');
        const totalDays = dateInputMode === 'flex'
            ? Math.max(7, Math.round(flexWeeks) * 7)
            : getDaysDifference(startDate, endDate);

        const options: GenerateOptions = {
            budget,
            pace,
            interests: notes.split(',').map((token) => token.trim()).filter(Boolean),
            specificCities: specificCities.trim() || undefined,
            roundTrip,
            totalDays,
            numCities: typeof numCities === 'number' ? numCities : undefined,
        };

        const prompt = buildClassicItineraryPrompt(destinationPrompt, options);
        return {
            prompt,
            startDate,
            roundTrip,
            input: {
                destinations: selectedDestinations,
                dateInputMode,
                flexWeeks: dateInputMode === 'flex' ? flexWeeks : null,
                flexWindow: dateInputMode === 'flex' ? flexWindow : null,
                budget,
                pace,
                notes,
                specificCities,
                numCities: typeof numCities === 'number' ? numCities : null,
                totalDays,
                roundTrip,
                routeLock,
                previewControls: {
                    travelerSetup,
                    tripStyle: tripStyleMask,
                    transportPreference: transportMask,
                },
            },
            metadata: {
                ignored_inputs: {
                    travelerSetup,
                    tripStyle: tripStyleMask,
                    transportPreference: transportMask,
                    routeLock,
                },
                effective_defaults: BENCHMARK_EFFECTIVE_DEFAULTS,
            },
        };
    }, [
        budget,
        dateInputMode,
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
        tripStyleMask,
        transportMask,
    ]);

    const runBenchmark = useCallback(async (targetsOverride?: Array<{ provider: string; model: string; label?: string }>) => {
        if (!accessToken) {
            setError('Supabase access token missing. Refresh this page and try again.');
            return;
        }

        const selected = targetsOverride || selectedTargets.map((model) => ({
            provider: model.provider,
            model: model.model,
            label: model.label,
        }));

        if (selected.length === 0) {
            setError('Please select at least one model target.');
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
                    targets: selected,
                    runCount: 1,
                    concurrency: BENCHMARK_PARALLEL_CONCURRENCY,
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
                setMessage(`Queued ${selected.length} target(s). Running in background...`);
            } else {
                setMessage(`Executed ${selected.length} target(s).`);
                void refreshTelemetryData();
            }
        } catch (runError) {
            setError(runError instanceof Error ? runError.message : 'Benchmark run failed');
            setRuns((current) => {
                const next = current.map((run) => {
                    if (!run.id.startsWith('optimistic-')) return run;
                    return {
                        ...run,
                        status: 'failed',
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
    }, [accessToken, selectedTargets, runs, fetchBenchmarkApi, session, sessionName, buildScenario, searchParams, setSearchParams, refreshTelemetryData]);

    const rerunTarget = useCallback(async (run: BenchmarkRun) => {
        await runBenchmark([
            {
                provider: run.provider,
                model: run.model,
                label: run.label || `${run.provider}:${run.model}`,
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
            setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel benchmark run(s)');
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

    const updateRunRating = useCallback(async (run: BenchmarkRun, nextRating: SatisfactionRating | null) => {
        if (!run.id || run.id.startsWith('optimistic-') || isRunActive(run)) return;
        setError(null);
        setRatingSavingRunId(run.id);

        try {
            const payload = await fetchBenchmarkApi('/api/internal/ai/benchmark/rating', {
                method: 'POST',
                body: JSON.stringify({
                    runId: run.id,
                    rating: nextRating,
                }),
            });

            const updatedRun = payload?.run as BenchmarkRun | undefined;
            if (!updatedRun) {
                throw new Error('Run rating saved but no updated row returned.');
            }

            setRuns((current) => {
                const next = current.map((entry) => (entry.id === updatedRun.id ? { ...entry, ...updatedRun } : entry));
                setSummary(summarizeRunsLocal(next));
                return next;
            });
        } catch (ratingError) {
            setError(ratingError instanceof Error ? ratingError.message : 'Failed to save run rating');
        } finally {
            setRatingSavingRunId(null);
        }
    }, [fetchBenchmarkApi]);

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
            setError(promptError instanceof Error ? promptError.message : 'Failed to build prompt preview');
        }
    }, [buildScenario]);

    const scrollToResults = useCallback(() => {
        resultsSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
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
            setError(downloadError instanceof Error ? downloadError.message : 'Failed to export benchmark ZIP');
        } finally {
            setLoading(false);
        }
    }, [accessToken, session]);

    const cleanupSession = useCallback(async () => {
        if (!session) {
            setError('No benchmark session loaded.');
            return;
        }

        const confirmed = await confirmDialog({
            title: 'Delete benchmark session data',
            message: 'Delete benchmark trips and benchmark rows for this session? This cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
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
            setError(cleanupError instanceof Error ? cleanupError.message : 'Failed to clean benchmark session');
        } finally {
            setLoading(false);
        }
    }, [confirmDialog, fetchBenchmarkApi, searchParams, session, setSearchParams]);

    const openModelPicker = useCallback(() => {
        setModelFilter('');
        setModelDraftIds(modelTargetIds);
        setModelModalOpen(true);
    }, [modelTargetIds]);

    const toggleModelDraft = useCallback((modelId: string) => {
        setModelDraftIds((current) => {
            if (current.includes(modelId)) {
                return current.filter((entry) => entry !== modelId);
            }
            return [...current, modelId];
        });
    }, []);

    const saveModelDraft = useCallback(async () => {
        const normalized = normalizePreferencesForClient({
            modelTargets: modelDraftIds,
            presets: presetConfigs,
            selectedPresetId,
        });
        if (normalized.modelTargets.length === 0) {
            setError('Select at least one model target.');
            return;
        }
        setModelTargetIds(normalized.modelTargets);
        setModelModalOpen(false);
        await savePreferences({
            modelTargets: normalized.modelTargets,
        }, { silent: true });
    }, [modelDraftIds, normalizePreferencesForClient, presetConfigs, savePreferences, selectedPresetId]);

    const removeModelTarget = useCallback(async (modelId: string) => {
        const next = modelTargetIds.filter((entry) => entry !== modelId);
        if (next.length === 0) {
            setError('At least one model target is required.');
            return;
        }
        setModelTargetIds(next);
        await savePreferences({ modelTargets: next }, { silent: true });
    }, [modelTargetIds, savePreferences]);

    const handlePresetSelection = useCallback(async (presetId: string) => {
        const preset = presetConfigs.find((entry) => entry.id === presetId);
        if (!preset) return;
        setSelectedPresetId(preset.id);
        applyMaskScenario(preset.scenario);
        await savePreferences({
            selectedPresetId: preset.id,
        }, { silent: true });
    }, [applyMaskScenario, presetConfigs, savePreferences]);

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

    const errorModalParsed = useMemo(() => {
        if (!errorModalRun) return null;
        return parseRunError(errorModalRun.error_message);
    }, [errorModalRun]);

    const highlightedErrorJson = useMemo(() => {
        if (!errorModalRun) return '';
        const parsed = parseRunError(errorModalRun.error_message);
        const payload = hydrateStringifiedJson(parsed.details ?? { error: errorModalRun.error_message || 'Unknown error' });
        const jsonSource = JSON.stringify(payload, null, 2);
        return Prism.highlight(jsonSource, Prism.languages.json, 'json');
    }, [errorModalRun]);

    const highlightedValidationJson = useMemo(() => {
        if (!validationModalRun) return '';
        const warnings = getValidationWarnings(validationModalRun.validation_checks);
        const payload = {
            schemaValid: validationModalRun.schema_valid,
            checks: validationModalRun.validation_checks || {},
            errors: validationModalRun.validation_errors || [],
            warnings,
        };
        const jsonSource = JSON.stringify(payload, null, 2);
        return Prism.highlight(jsonSource, Prism.languages.json, 'json');
    }, [validationModalRun]);

    const validationModalWarnings = useMemo(() => {
        if (!validationModalRun) return [];
        return getValidationWarnings(validationModalRun.validation_checks);
    }, [validationModalRun]);

    return (
        <AdminShell
            title="AI Benchmark"
            description="Compare model/provider outputs for the create-trip contract with persistent benchmark sessions."
            showGlobalSearch={false}
            showDateRange={false}
        >
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Benchmark execution context</h2>
                            <p className="mt-1 max-w-3xl text-sm text-slate-600">
                                Default create-trip benchmark workspace. Configure session input on the left and compare selected model targets on the right.
                                Session identifiers and filters persist in the URL.
                            </p>
                        </div>

                        <div className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 sm:p-3 sm:text-xs">
                            <div className="font-semibold text-slate-700">Internal API auth</div>
                            <div className="text-[11px] text-slate-500">
                                Requests use your current Supabase bearer token with server-side admin validation.
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Access token state: <span className="font-semibold text-slate-700">{accessToken ? 'ready' : 'missing'}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {error && (
                    <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {error}
                    </section>
                )}

                {message && (
                    <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        {message}
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">7-day telemetry quick view</h3>
                            <p className="text-xs text-slate-500">
                                Three quick ranking cards. Open the full telemetry page for detailed charts and filters.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void refreshTelemetryData()}
                                disabled={snapshotTelemetryLoading}
                                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <ArrowClockwise size={14} className={snapshotTelemetryLoading ? 'animate-spin' : ''} />
                                Refresh snapshot
                            </button>
                            <Link
                                to="/admin/ai-benchmark/telemetry"
                                className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Open telemetry page
                            </Link>
                        </div>
                    </div>

                    {snapshotTelemetryError && (
                        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                            {snapshotTelemetryError}
                        </div>
                    )}

                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        Calls: <span className="font-semibold text-slate-800">{snapshotTelemetrySummary ? snapshotTelemetrySummary.total : '—'}</span>
                        <span className="mx-2 text-slate-400">•</span>
                        Success: <span className="font-semibold text-slate-800">{snapshotTelemetrySummary ? `${snapshotTelemetrySummary.successRate.toFixed(1)}%` : '—'}</span>
                        <span className="mx-2 text-slate-400">•</span>
                        Cost: <span className="font-semibold text-slate-800">{snapshotTelemetrySummary ? formatUsd(snapshotTelemetrySummary.totalCostUsd) : '—'}</span>
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-3">
                        {snapshotTelemetryCards.map((card) => (
                            <article key={card.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{card.title}</p>
                                <p className="mt-1 text-xl font-black text-slate-900">{card.metric}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-700">
                                    {card.model ? `${card.model.provider} / ${card.model.model}` : 'No model yet'}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">{card.detail}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(520px,1.05fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Create-trip benchmark mask</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    Pick a preset and edit in modal so the results table stays in view.
                                </p>
                            </div>
                            <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {preferencesLoaded ? 'DB sync ready' : 'Loading prefs...'}
                            </span>
                        </div>

                        <div className="mt-3 space-y-3">
                            <label className="space-y-1 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session name</span>
                                <input
                                    value={sessionName}
                                    onChange={(event) => setSessionName(event.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                />
                            </label>

                            <label className="space-y-1 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preset</span>
                                <Select value={selectedPresetId} onValueChange={(value) => void handlePresetSelection(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose benchmark preset" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {presetConfigs.map((preset) => (
                                            <SelectItem key={preset.id} value={preset.id}>
                                                {preset.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </label>

                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-800">{selectedPreset?.name || 'Preset'}</span>
                                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                        {selectedPreset?.kind || 'system'}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    {selectedPreset?.description || 'No description saved for this preset.'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5">
                                        {destinations || 'No destinations'}
                                    </span>
                                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5">
                                        {dateInputMode === 'flex' ? `${flexWeeks} week flexible` : `${startDate} → ${endDate}`}
                                    </span>
                                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5">{budget}</span>
                                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5">{pace}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => openPresetEditor('edit')}
                                    disabled={loading || cancelling}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Edit preset
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openPresetEditor('create')}
                                    disabled={loading || cancelling}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Plus size={14} />
                                    New custom preset
                                </button>
                                <button
                                    type="button"
                                    onClick={openPromptPreview}
                                    disabled={loading}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Preview prompt
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-lg font-bold text-slate-900">Model targets + execution</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        scrollToResults();
                                        void runBenchmark();
                                    }}
                                    disabled={loading || hasPendingRuns || cancelling || selectedTargets.length === 0}
                                    className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <ArrowClockwise size={14} />
                                    Test all
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelActiveRunsInSession}
                                    disabled={loading || cancelling || !session || !hasPendingRuns}
                                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <StopCircle size={14} />
                                    Abort active
                                </button>
                                <button
                                    type="button"
                                    onClick={cleanupSession}
                                    disabled={loading || cancelling || !session || hasPendingRuns}
                                    className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Trash size={14} />
                                    Cleanup session
                                </button>
                            </div>
                        </div>

                        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-700">Parallel workers:</span> {BENCHMARK_PARALLEL_CONCURRENCY}. Additional selected models are queued automatically.
                            {selectedTargets.length > BENCHMARK_PARALLEL_CONCURRENCY && (
                                <span className="ml-1">
                                    ({selectedTargets.length - BENCHMARK_PARALLEL_CONCURRENCY} queued with current selection)
                                </span>
                            )}
                        </div>

                        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model targets</div>
                                <button
                                    type="button"
                                    onClick={openModelPicker}
                                    disabled={loading || cancelling || hasPendingRuns}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Plus size={14} />
                                    Add models
                                </button>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                                {selectedTargets.length === 0 && (
                                    <div className="text-xs text-slate-500">No model target selected.</div>
                                )}
                                {selectedTargets.map((model) => (
                                    <span
                                        key={model.id}
                                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                                    >
                                        <span className="font-semibold">{model.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => void removeModelTarget(model.id)}
                                            disabled={loading || cancelling || hasPendingRuns || selectedTargets.length <= 1}
                                            className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            aria-label={`Remove ${model.label}`}
                                            title={`Remove ${model.label}`}
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="mt-2 text-[11px] text-slate-500">
                            {COST_ESTIMATE_FOOTNOTE}
                        </div>
                    </div>
                </section>

                <section ref={resultsSectionRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Benchmark runs</h3>
                            <p className="text-xs text-slate-500">
                                Session: {session ? `${session.name || 'Unnamed'} (${session.share_token})` : 'No session loaded'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => downloadAllZip(false)}
                                disabled={loading || !session || runs.length === 0}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <DownloadSimple size={14} />
                                Download all
                            </button>
                            <button
                                type="button"
                                onClick={() => downloadAllZip(true)}
                                disabled={loading || !session || runs.length === 0}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <DownloadSimple size={14} />
                                Download all + logs
                            </button>
                            <Select value={providerFilter} onValueChange={setProviderFilter}>
                                <SelectTrigger className="h-8 w-[180px] text-xs">
                                    <SelectValue placeholder="All providers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All providers</SelectItem>
                                    {providerOptions.map((provider) => (
                                        <SelectItem key={provider} value={provider}>
                                            {provider}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <label className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={hideFailedRuns}
                                    onChange={(event) => setHideFailedRuns(event.target.checked)}
                                />
                                Hide failed
                            </label>
                            <label className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={onlyWarningRuns}
                                    onChange={(event) => setOnlyWarningRuns(event.target.checked)}
                                />
                                Only warnings
                            </label>
                            <label className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={onlyUnratedRuns}
                                    onChange={(event) => setOnlyUnratedRuns(event.target.checked)}
                                />
                                Only unrated
                            </label>
                        </div>
                    </div>

                    {summary && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-4">
                            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className="font-semibold text-slate-700">Completed:</span> {summary.completed}/{summary.total}
                            </div>
                            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className="font-semibold text-slate-700">Failed:</span> {summary.failed}
                            </div>
                            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className="font-semibold text-slate-700">Avg latency:</span> {formatDuration(summary.averageLatencyMs)}
                            </div>
                            <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                                <span className="font-semibold text-slate-700">Total est.:</span> {hasExactCostData ? formatUsd(summary.totalCostUsd) : '—'}
                            </div>
                        </div>
                    )}

                    <p className="mt-2 text-[11px] text-slate-500">
                        Cost column uses exact provider cost when returned; otherwise it falls back to the catalog estimate for that model.
                    </p>

                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <th className="px-3 py-2">Model</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => setRunSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
                                            className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                                        >
                                            Run at
                                            <ArrowsDownUp size={12} />
                                        </button>
                                    </th>
                                    <th className="px-3 py-2">Latency</th>
                                    <th className="px-3 py-2">Structure</th>
                                    <th className="px-3 py-2">Cost</th>
                                    <th className="px-3 py-2">Trip</th>
                                    <th className="px-3 py-2">Rank</th>
                                    <th className="px-3 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRuns.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                                            {loading ? 'Loading benchmark runs...' : 'No runs yet. Configure targets and click Test all.'}
                                        </td>
                                    </tr>
                                )}

                                {displayRuns.map((run) => {
                                    const isFailed = run.status === 'failed';
                                    const isCompleted = run.status === 'completed';
                                    const isPending = isRunActive(run);
                                    const isCancelled = isRunCancelledByUser(run);
                                    const statusIcon = isCancelled
                                        ? <StopCircle size={15} className="text-amber-700" />
                                        : isFailed
                                            ? <WarningCircle size={15} className="text-rose-600" />
                                        : isCompleted
                                            ? <CheckCircle size={15} className="text-emerald-600" />
                                            : <HourglassHigh size={15} className="text-amber-600" />;
                                    const statusLabel = isCancelled ? 'cancelled' : run.status;
                                    const parsedError = parseRunError(run.error_message);
                                    const hasErrorDetails = Boolean(run.error_message);
                                    const validationStats = getValidationCheckStats(run.validation_checks);
                                    const validationWarnings = getValidationWarnings(run.validation_checks);
                                    const warningCount = validationWarnings.length;
                                    const hasValidationDetails = validationStats.total > 0 || (run.validation_errors?.length || 0) > 0 || warningCount > 0 || run.schema_valid !== null;
                                    const costEstimateLabel = getModelCostEstimateLabel(run.provider, run.model);

                                    return (
                                        <tr key={run.id} className="border-b border-slate-100 align-top">
                                            <td className="px-3 py-2">
                                                <div className="font-semibold text-slate-800">{run.provider} / {run.model}</div>
                                                <div className="text-xs text-slate-500">run #{run.run_index}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                                                    {statusIcon}
                                                    {statusLabel}
                                                </div>
                                                {run.error_message && (
                                                    <div className="mt-1 max-w-[320px] space-y-1 text-xs text-rose-700">
                                                        <div>{parsedError.shortMessage}</div>
                                                        {hasErrorDetails && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setErrorModalRun(run)}
                                                                className="rounded border border-rose-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-50"
                                                            >
                                                                Details
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-slate-600">{formatTimestamp(getRunTimestampIso(run))}</td>
                                            <td className="px-3 py-2 text-sm text-slate-700">{formatDuration(getDisplayLatencyMs(run))}</td>
                                            <td className="px-3 py-2 text-sm text-slate-700">
                                                <div className="space-y-1">
                                                    <div>
                                                        {run.schema_valid === null ? '—' : run.schema_valid ? 'Valid' : 'Invalid'}
                                                        {validationStats.total > 0 && (
                                                            <span className="ml-1 text-xs text-slate-500">({validationStats.passed}/{validationStats.total})</span>
                                                        )}
                                                    </div>
                                                    {warningCount > 0 && (
                                                        <div className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                                                            {warningCount} warning{warningCount === 1 ? '' : 's'}
                                                        </div>
                                                    )}
                                                    {hasValidationDetails && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setValidationModalRun(run)}
                                                            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                                                        >
                                                            Checks
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-slate-700">
                                                {typeof run.cost_usd === 'number' && Number.isFinite(run.cost_usd) ? (
                                                    formatUsd(run.cost_usd)
                                                ) : costEstimateLabel ? (
                                                    <div className="space-y-0.5">
                                                        <div>{costEstimateLabel}</div>
                                                        <div className="text-[10px] uppercase tracking-wide text-slate-500">catalog est.</div>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                                {run.trip_id ? (
                                                    <a
                                                        href={`/trip/${encodeURIComponent(run.trip_id)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="font-semibold text-accent-700 hover:underline"
                                                    >
                                                        Open trip
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    {(Object.keys(SATISFACTION_META) as SatisfactionRating[]).map((rating) => {
                                                        const isActive = run.satisfaction_rating === rating;
                                                        const isDisabled = loading || isPending || ratingSavingRunId === run.id;
                                                        const meta = SATISFACTION_META[rating];
                                                        return (
                                                            <button
                                                                key={rating}
                                                                type="button"
                                                                aria-label={`Mark run ${run.id} as ${meta.label}`}
                                                                title={meta.label}
                                                                onClick={() => updateRunRating(run, isActive ? null : rating)}
                                                                disabled={isDisabled}
                                                                className={[
                                                                    'inline-flex items-center justify-center rounded-md border px-1.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                                                    isActive ? meta.activeClass : meta.idleClass,
                                                                ].join(' ')}
                                                            >
                                                                {meta.icon}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => rerunTarget(run)}
                                                        disabled={loading || cancelling || isPending}
                                                        className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        Rerun
                                                    </button>
                                                    {isPending && (
                                                        <button
                                                            type="button"
                                                            onClick={() => cancelRun(run)}
                                                            disabled={cancelling}
                                                            className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            Abort
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => downloadRow(run)}
                                                        disabled={isPending}
                                                        className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        JSON
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <h4 className="text-sm font-bold text-slate-800">Model dashboard</h4>
                        <p className="text-[11px] text-slate-500">Averages are computed from persisted runs in the loaded session.</p>

                        <div className="mt-2 overflow-x-auto">
                            <table className="min-w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                                        <th className="px-2 py-1.5">Model</th>
                                        <th className="px-2 py-1.5">Avg time</th>
                                        <th className="px-2 py-1.5">Avg cost</th>
                                        <th className="px-2 py-1.5">Avg satisfaction</th>
                                        <th className="px-2 py-1.5">Votes</th>
                                        <th className="px-2 py-1.5">Runs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modelDashboardRows.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
                                                No model metrics yet.
                                            </td>
                                        </tr>
                                    )}

                                    {modelDashboardRows.map((row) => {
                                        const satisfactionClass = row.averageRatingScore === null
                                            ? 'text-slate-500'
                                            : row.averageRatingScore >= 2.5
                                                ? 'text-emerald-700'
                                                : row.averageRatingScore >= 1.75
                                                    ? 'text-amber-700'
                                                    : 'text-rose-700';
                                        return (
                                            <tr key={`${row.provider}-${row.model}`} className="border-b border-slate-200/70">
                                                <td className="px-2 py-1.5 font-semibold text-slate-800">{row.provider} / {row.model}</td>
                                                <td className="px-2 py-1.5 text-slate-700">{formatDuration(row.averageLatencyMs)}</td>
                                                <td className="px-2 py-1.5 text-slate-700">{formatUsd(row.averageCostUsd)}</td>
                                                <td className={`px-2 py-1.5 font-semibold ${satisfactionClass}`}>
                                                    {row.averageRatingScore === null ? 'No votes' : `${row.averageRatingScore.toFixed(2)} / 3`}
                                                </td>
                                                <td className="px-2 py-1.5 text-slate-700">{row.ratingCount}</td>
                                                <td className="px-2 py-1.5 text-slate-700">{row.totalRuns}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <AppModal
                    isOpen={modelModalOpen}
                    onClose={() => setModelModalOpen(false)}
                    title="Add model targets"
                    description="Select the models to include in benchmark execution."
                    size="lg"
                    mobileSheet={false}
                    footer={(
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setModelModalOpen(false)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void saveModelDraft()}
                                className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                            >
                                Save models
                            </button>
                        </div>
                    )}
                >
                    <div className="space-y-3">
                        <input
                            value={modelFilter}
                            onChange={(event) => setModelFilter(event.target.value)}
                            placeholder="Search provider, label, or model id"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                        />
                        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                            {Object.entries(groupedModels).map(([providerLabel, models]) => (
                                <div key={providerLabel} className="space-y-1">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{providerLabel}</div>
                                    <div className="space-y-1">
                                        {models.map((model) => {
                                            const selected = modelDraftIds.includes(model.id);
                                            const disabled = model.availability !== 'active';
                                            return (
                                                <button
                                                    key={model.id}
                                                    type="button"
                                                    disabled={disabled}
                                                    onClick={() => toggleModelDraft(model.id)}
                                                    className={[
                                                        'flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-xs',
                                                        selected
                                                            ? 'border-accent-300 bg-accent-50 text-accent-900'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                                                        disabled ? 'cursor-not-allowed opacity-50' : '',
                                                    ].join(' ')}
                                                >
                                                    <span className="min-w-0 truncate font-semibold">{model.label}</span>
                                                    <span className="ml-2 shrink-0 text-[10px] text-slate-500">{model.estimatedCostPerQueryLabel}</span>
                                                </button>
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
                    title={presetEditor?.mode === 'create' ? 'Create custom preset' : 'Edit preset'}
                    description="Compact benchmark mask editor. Saved presets are owner-scoped in DB."
                    size="lg"
                    mobileSheet={false}
                    footer={(
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPresetEditor(null)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void savePresetDraft()}
                                className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                            >
                                Save preset
                            </button>
                        </div>
                    )}
                >
                    {presetEditor && (
                        <div className="grid grid-cols-1 gap-3">
                            <label className="space-y-1 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
                                <input
                                    value={presetEditor.name}
                                    onChange={(event) => setPresetEditor((current) => current ? { ...current, name: event.target.value } : current)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                />
                            </label>

                            <label className="space-y-1 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                                <input
                                    value={presetEditor.description}
                                    onChange={(event) => setPresetEditor((current) => current ? { ...current, description: event.target.value } : current)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                />
                            </label>

                            <label className="space-y-1 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destinations</span>
                                <input
                                    value={presetEditor.scenario.destinations}
                                    onChange={(event) => updatePresetDraftScenario('destinations', event.target.value)}
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                />
                            </label>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date mode</span>
                                    <Select
                                        value={presetEditor.scenario.dateInputMode}
                                        onValueChange={(value) => updatePresetDraftScenario('dateInputMode', value as BenchmarkMaskScenario['dateInputMode'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Date mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="exact">Exact dates</SelectItem>
                                            <SelectItem value="flex">Flexible window</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>

                                {presetEditor.scenario.dateInputMode === 'flex' ? (
                                    <label className="space-y-1 text-sm">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flex weeks</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={12}
                                            value={presetEditor.scenario.flexWeeks}
                                            onChange={(event) => {
                                                const next = Number(event.target.value);
                                                const normalized = Number.isFinite(next) ? Math.min(12, Math.max(1, Math.round(next))) : 1;
                                                updatePresetDraftScenario('flexWeeks', normalized);
                                            }}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                        />
                                    </label>
                                ) : (
                                    <label className="space-y-1 text-sm">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</span>
                                        <input
                                            type="date"
                                            value={presetEditor.scenario.startDate || defaultDates.startDate}
                                            onChange={(event) => updatePresetDraftScenario('startDate', event.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                        />
                                    </label>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {presetEditor.scenario.dateInputMode === 'exact' ? (
                                    <label className="space-y-1 text-sm">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">End date</span>
                                        <input
                                            type="date"
                                            value={presetEditor.scenario.endDate || defaultDates.endDate}
                                            onChange={(event) => updatePresetDraftScenario('endDate', event.target.value)}
                                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                        />
                                    </label>
                                ) : (
                                    <label className="space-y-1 text-sm">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flex window</span>
                                        <Select
                                            value={presetEditor.scenario.flexWindow}
                                            onValueChange={(value) => updatePresetDraftScenario('flexWindow', value as BenchmarkMaskScenario['flexWindow'])}
                                        >
                                            <SelectTrigger>
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
                                    </label>
                                )}

                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Round trip</span>
                                    <Select
                                        value={presetEditor.scenario.roundTrip ? 'yes' : 'no'}
                                        onValueChange={(value) => updatePresetDraftScenario('roundTrip', value === 'yes')}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Round trip" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</span>
                                    <Select value={presetEditor.scenario.budget} onValueChange={(value) => updatePresetDraftScenario('budget', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Budget" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Luxury">Luxury</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pace</span>
                                    <Select value={presetEditor.scenario.pace} onValueChange={(value) => updatePresetDraftScenario('pace', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pace" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Relaxed">Relaxed</SelectItem>
                                            <SelectItem value="Balanced">Balanced</SelectItem>
                                            <SelectItem value="Fast">Fast</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Specific cities</span>
                                    <input
                                        value={presetEditor.scenario.specificCities}
                                        onChange={(event) => updatePresetDraftScenario('specificCities', event.target.value)}
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                    />
                                </label>
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stops</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={presetEditor.scenario.numCities ?? ''}
                                        onChange={(event) => {
                                            const next = event.target.value ? Number(event.target.value) : null;
                                            updatePresetDraftScenario('numCities', Number.isFinite(next as number) ? (next as number) : null);
                                        }}
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Traveler setup</span>
                                    <Select
                                        value={presetEditor.scenario.travelerSetup}
                                        onValueChange={(value) => updatePresetDraftScenario('travelerSetup', value as BenchmarkMaskScenario['travelerSetup'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Traveler setup" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="solo">Solo</SelectItem>
                                            <SelectItem value="couple">Couple</SelectItem>
                                            <SelectItem value="friends">Friends</SelectItem>
                                            <SelectItem value="family">Family</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trip style</span>
                                    <Select
                                        value={presetEditor.scenario.tripStyleMask}
                                        onValueChange={(value) => updatePresetDraftScenario('tripStyleMask', value as BenchmarkMaskScenario['tripStyleMask'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Trip style" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="everything_except_remote_work">Everything except remote work</SelectItem>
                                            <SelectItem value="culture_focused">Culture focused</SelectItem>
                                            <SelectItem value="food_focused">Food focused</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                                <label className="space-y-1 text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Transport</span>
                                    <Select
                                        value={presetEditor.scenario.transportMask}
                                        onValueChange={(value) => updatePresetDraftScenario('transportMask', value as BenchmarkMaskScenario['transportMask'])}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Transport" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="automatic">Automatic</SelectItem>
                                            <SelectItem value="plane">Plane</SelectItem>
                                            <SelectItem value="train">Train</SelectItem>
                                            <SelectItem value="camper">Camper</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                            </div>

                            <label className="space-y-1 text-sm">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes/interests</span>
                                <textarea
                                    rows={3}
                                    value={presetEditor.scenario.notes}
                                    onChange={(event) => updatePresetDraftScenario('notes', event.target.value)}
                                    className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                />
                            </label>

                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={presetEditor.scenario.routeLock}
                                    onChange={(event) => updatePresetDraftScenario('routeLock', event.target.checked)}
                                />
                                Route lock (metadata only)
                            </label>
                        </div>
                    )}
                </AppModal>

                {promptModal && (
                    <div
                        className="fixed inset-0 z-[1990] flex items-center justify-center bg-slate-950/45 p-4"
                        onClick={() => setPromptModal(null)}
                    >
                        <div
                            className="w-full max-w-4xl rounded-xl border border-slate-300 bg-white shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900">Generated benchmark prompt</h4>
                                    <p className="text-xs text-slate-500">{formatTimestamp(promptModal.generatedAt)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={copyPromptToClipboard}
                                        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Copy
                                    </button>
                                    <button
                                        type="button"
                                        onClick={downloadPromptText}
                                        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Download .txt
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPromptModal(null)}
                                        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <textarea
                                    value={promptModal.prompt}
                                    readOnly
                                    rows={18}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {errorModalRun && (
                    <div
                        className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/45 p-4"
                        onClick={() => setErrorModalRun(null)}
                    >
                        <div
                            className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-100">Run error details</h4>
                                    <p className="text-xs text-slate-400">
                                        {errorModalRun.provider} / {errorModalRun.model} · run #{errorModalRun.run_index}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setErrorModalRun(null)}
                                    className="rounded border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="space-y-2 p-4">
                                <div className="text-xs font-semibold text-rose-300">
                                    {errorModalParsed?.shortMessage || 'Detailed provider error'}
                                </div>
                                <pre className="max-h-[56vh] overflow-auto rounded-lg bg-[#1f2937] p-3 text-xs leading-relaxed">
                                    <code className="language-json" dangerouslySetInnerHTML={{ __html: highlightedErrorJson }} />
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {validationModalRun && (
                    <div
                        className="fixed inset-0 z-[1995] flex items-center justify-center bg-slate-950/45 p-4"
                        onClick={() => setValidationModalRun(null)}
                    >
                        <div
                            className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-100">Validation details</h4>
                                    <p className="text-xs text-slate-400">
                                        {validationModalRun.provider} / {validationModalRun.model} · run #{validationModalRun.run_index}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setValidationModalRun(null)}
                                    className="rounded border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="space-y-2 p-4">
                                <div className="text-xs font-semibold text-sky-300">
                                    {validationModalRun.schema_valid
                                        ? (validationModalWarnings.length > 0
                                            ? `Validation passed with ${validationModalWarnings.length} warning${validationModalWarnings.length === 1 ? '' : 's'}`
                                            : 'Validation passed')
                                        : 'Validation failed'}
                                </div>
                                <pre className="max-h-[56vh] overflow-auto rounded-lg bg-[#1f2937] p-3 text-xs leading-relaxed">
                                    <code className="language-json" dangerouslySetInnerHTML={{ __html: highlightedValidationJson }} />
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <div className="font-semibold">Important implementation note</div>
                    <div className="mt-1">
                        This benchmark page now mirrors the default create-trip mask while preserving the existing classic prompt contract for comparable results across runs.
                    </div>
                </section>
            </div>
        </AdminShell>
    );
};
