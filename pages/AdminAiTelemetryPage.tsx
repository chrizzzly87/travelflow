import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { ArrowRight, X } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { AdminBarList } from '../components/admin/charts/AdminBarList';
import { AdminAreaChart } from '../components/admin/charts/AdminAreaChart';
import type { AdminChartColor } from '../components/admin/charts/chartPalette';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminBarChart } from '../components/admin/charts/AdminBarChart';
import { AdminPagination } from '../components/admin/AdminPagination';
import { AdminFilterMenu } from '../components/admin/AdminFilterMenu';
import { AdminSortHeaderButton } from '../components/admin/AdminDataTable';
import { ADMIN_TABLE_SORTED_CELL_CLASS, ADMIN_TABLE_SORTED_HEADER_CLASS } from '../components/admin/AdminDataTableUtils';
import { formatAdminAbsoluteTime, formatAdminRelativeTime } from '../components/admin/adminRelativeTime';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../lib/utils';
import { AiProviderLogo } from '../components/admin/AiProviderLogo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getAiProviderMetadata, getAiProviderSortOrder } from '../config/aiProviderCatalog';
import { dbGetAccessToken, ensureDbSession } from '../services/dbService';
import { useAuth } from '../hooks/useAuth';
import {
    buildFailureCodeBarListData,
    buildCurrentMonthDailyCostHistory,
    buildProviderTableRows,
    formatTelemetryUsd,
    pickTelemetryLeaders,
    sortTelemetryModels,
    type TelemetryLeaderKind,
    type TelemetryModelSortColumn,
    type TelemetrySortDirection,
} from '../services/adminAiTelemetryChartData';

type TelemetrySourceFilter = 'all' | 'create_trip' | 'benchmark';

interface BenchmarkApiResponse {
    ok: boolean;
    error?: string;
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

interface AiTelemetrySeriesPoint {
    bucketStart: string;
    total: number;
    success: number;
    failed: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
}

interface AiTelemetryProviderPoint {
    provider: string;
    total: number;
    success: number;
    failed: number;
    averageLatencyMs: number | null;
    totalCostUsd: number;
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

interface AiTelemetryRecentRow {
    id: string;
    created_at: string;
    source: 'create_trip' | 'benchmark';
    provider: string;
    model: string;
    status: 'success' | 'failed';
    latency_ms: number | null;
    estimated_cost_usd: number | null;
    error_code: string | null;
}

interface AiTelemetryRunComment {
    runId: string;
    provider: string;
    model: string;
    comment: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | null;
    satisfactionRating: 'good' | 'medium' | 'bad' | null;
    createdAt: string;
    updatedAt: string;
}

interface AiTelemetryRunCommentGroup {
    provider: string;
    model: string;
    key: string;
    total: number;
    latestCommentAt: string;
    comments: AiTelemetryRunComment[];
}

interface AiTelemetryApiResponse extends BenchmarkApiResponse {
    summary?: AiTelemetrySummary;
    series?: AiTelemetrySeriesPoint[];
    monthlyCostSeries?: Array<{ date: string; cost: number }>;
    providers?: AiTelemetryProviderPoint[];
    models?: AiTelemetryModelPoint[];
    rankings?: {
        fastest?: AiTelemetryModelPoint[];
        cheapest?: AiTelemetryModelPoint[];
        bestValue?: AiTelemetryModelPoint[];
    };
    comments?: {
        total?: number;
        groups?: AiTelemetryRunCommentGroup[];
    };
    recent?: AiTelemetryRecentRow[];
    availableProviders?: string[];
}

const TELEMETRY_WINDOW_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 24, label: 'Last 24h' },
    { value: 24 * 7, label: 'Last 7d' },
    { value: 24 * 30, label: 'Last 30d' },
];

const DEFAULT_WINDOW_HOURS = 24 * 7;
// The telemetry endpoint reads at most this many rows per request (ai-benchmark.ts).
const TELEMETRY_ROW_CAP = 2000;
const MODEL_PAGE_SIZE = 10;
const RECENT_PAGE_SIZE = 20;

const CALL_TREND_COLORS: readonly AdminChartColor[] = ['emerald', 'rose'];

type TrendTab = 'calls' | 'success' | 'latency' | 'cost';
type BreakdownTab = 'models' | 'providers';

const formatDuration = (ms: number | null | undefined): string => {
    if (!Number.isFinite(ms)) return '—';
    const value = Number(ms);
    if (value < 1000) return `${value} ms`;
    return `${(value / 1000).toFixed(2)} s`;
};

const formatUsd = formatTelemetryUsd;

const formatPercent = (value: number | null | undefined): string => {
    if (!Number.isFinite(value)) return '—';
    return `${Number(value).toFixed(1)}%`;
};

const formatCallCount = (value: number | null | undefined): string => {
    if (!Number.isFinite(value)) return '0 calls';
    const count = Math.max(0, Math.round(Number(value)));
    return `${count.toLocaleString()} ${count === 1 ? 'call' : 'calls'}`;
};


const ProviderLabel: React.FC<{
    provider: string;
    model?: string | null;
    providerClassName?: string;
    modelClassName?: string;
    logoSize?: number;
}> = ({
    provider,
    model,
    providerClassName,
    modelClassName,
    logoSize = 14,
}) => {
    const metadata = getAiProviderMetadata(provider);
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            <AiProviderLogo provider={provider} model={model} size={logoSize} />
            <span className={providerClassName || 'font-semibold text-foreground'} title={`${metadata.label} (${provider})`}>
                {metadata.shortName}
            </span>
            {model ? (
                <span className={modelClassName || 'truncate text-muted-foreground'}>
                    / {model}
                </span>
            ) : null}
        </span>
    );
};

/** Short USD for a dense axis: "$0.00012", "$1.25". Tooltips keep the full `formatUsd`. */
const formatUsdTick = (value: number): string => {
    if (!Number.isFinite(value) || value === 0) return '$0';
    if (Math.abs(value) < 0.01) return `$${Number(value.toPrecision(2))}`;
    return `$${value.toFixed(2)}`;
};

/** "2026-10-12" as a local "Oct 12" (parsing the bare date as UTC shifted it a day west of UTC). */
const formatIsoDayTick = (value: unknown): string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return String(value ?? '');
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const TelemetryEmpty: React.FC<{ children: React.ReactNode; description?: React.ReactNode }> = ({ children, description }) => (
    <AdminEmptyState className="py-6" title={children} description={description} />
);

const LEADER_LABELS: Record<TelemetryLeaderKind, string> = {
    fastest: 'Fastest',
    cheapest: 'Cheapest',
    bestValue: 'Best value',
    mostReliable: 'Most reliable',
};

const MODEL_COLUMNS: ReadonlyArray<{ column: TelemetryModelSortColumn; label: string; numeric: boolean; tooltip?: string }> = [
    { column: 'model', label: 'Model', numeric: false },
    { column: 'total', label: 'Calls', numeric: true },
    { column: 'successRate', label: 'Success', numeric: true },
    { column: 'averageLatencyMs', label: 'Avg duration', numeric: true, tooltip: 'Mean duration of successful calls.' },
    { column: 'averageCostUsd', label: 'Cost / success', numeric: true, tooltip: 'Mean estimated cost of a successful call.' },
    { column: 'costPerSecondUsd', label: 'Cost / sec', numeric: true, tooltip: 'Cost per second of generation. Lower is better value.' },
    { column: 'totalCostUsd', label: 'Total cost', numeric: true },
];

const RECENT_STATUS_OPTIONS = [
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
] as const;

const formatLeaderValue = (kind: TelemetryLeaderKind, model: AiTelemetryModelPoint): string => {
    switch (kind) {
    case 'fastest': return formatDuration(model.averageLatencyMs);
    case 'cheapest': return formatUsd(model.averageCostUsd);
    case 'bestValue': return `${formatUsd(model.costPerSecondUsd)} / sec`;
    case 'mostReliable': return formatPercent(model.successRate);
    default: return '';
    }
};

export const AdminAiTelemetryPage: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [telemetryWindowHours, setTelemetryWindowHours] = useState<number>(DEFAULT_WINDOW_HOURS);
    const [telemetrySource, setTelemetrySource] = useState<TelemetrySourceFilter>('all');
    const [telemetryProviderFilter, setTelemetryProviderFilter] = useState<string>('all');

    const [telemetryLoading, setTelemetryLoading] = useState(false);
    const [telemetryError, setTelemetryError] = useState<string | null>(null);
    const [telemetrySummary, setTelemetrySummary] = useState<AiTelemetrySummary | null>(null);
    const [telemetrySeries, setTelemetrySeries] = useState<AiTelemetrySeriesPoint[]>([]);
    const [monthlyCostSeries, setMonthlyCostSeries] = useState<Array<{ date: string; cost: number }>>([]);
    const [telemetryProviders, setTelemetryProviders] = useState<AiTelemetryProviderPoint[]>([]);
    const [telemetryModels, setTelemetryModels] = useState<AiTelemetryModelPoint[]>([]);
    const [telemetryRecent, setTelemetryRecent] = useState<AiTelemetryRecentRow[]>([]);
    const [telemetryCommentTotal, setTelemetryCommentTotal] = useState(0);
    const [telemetryCommentGroups, setTelemetryCommentGroups] = useState<AiTelemetryRunCommentGroup[]>([]);
    const [telemetryProviderOptions, setTelemetryProviderOptions] = useState<string[]>([]);

    const [trendTab, setTrendTab] = useState<TrendTab>('calls');
    const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('models');
    const [modelSortColumn, setModelSortColumn] = useState<TelemetryModelSortColumn>('total');
    const [modelSortDirection, setModelSortDirection] = useState<TelemetrySortDirection>('desc');
    const [modelPage, setModelPage] = useState(1);
    const [recentStatusFilters, setRecentStatusFilters] = useState<string[]>([]);
    const [recentPage, setRecentPage] = useState(1);

    useEffect(() => {
        if (!isAuthenticated) {
            setAccessToken(null);
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
        void bootstrapAuth();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    const fetchTelemetryApi = useCallback(async (path: string, init?: RequestInit): Promise<BenchmarkApiResponse> => {
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
            payload = { ok: response.ok, error: raw || undefined };
        }

        if (!response.ok) {
            throw new Error(payload.error || `Telemetry API request failed (${response.status})`);
        }

        return payload;
    }, [accessToken]);

    const loadTelemetry = useCallback(async () => {
        setTelemetryLoading(true);
        setTelemetryError(null);

        try {
            const params = new URLSearchParams();
            params.set('windowHours', String(telemetryWindowHours));
            params.set('source', telemetrySource);
            if (telemetryProviderFilter !== 'all') {
                params.set('provider', telemetryProviderFilter);
            }

            const payload = await fetchTelemetryApi(`/api/internal/ai/benchmark/telemetry?${params.toString()}`, {
                method: 'GET',
            }) as AiTelemetryApiResponse;

            setTelemetrySummary(payload.summary || null);
            setTelemetrySeries(Array.isArray(payload.series) ? payload.series : []);
            setMonthlyCostSeries(Array.isArray(payload.monthlyCostSeries) ? payload.monthlyCostSeries : []);
            setTelemetryProviders(Array.isArray(payload.providers) ? payload.providers : []);
            setTelemetryModels(Array.isArray(payload.models) ? payload.models : []);
            setTelemetryRecent(Array.isArray(payload.recent) ? payload.recent : []);
            setTelemetryCommentTotal(Number(payload.comments?.total) || 0);
            setTelemetryCommentGroups(Array.isArray(payload.comments?.groups) ? payload.comments?.groups : []);
            setModelPage(1);
            setRecentPage(1);

            const providerOptions = Array.isArray(payload.availableProviders) ? [...payload.availableProviders] : [];
            providerOptions.sort((left, right) => {
                const orderDelta = getAiProviderSortOrder(left) - getAiProviderSortOrder(right);
                if (orderDelta !== 0) return orderDelta;
                return getAiProviderMetadata(left).shortName.localeCompare(getAiProviderMetadata(right).shortName);
            });
            setTelemetryProviderOptions(providerOptions);
            if (telemetryProviderFilter !== 'all' && !providerOptions.includes(telemetryProviderFilter)) {
                setTelemetryProviderFilter('all');
            }
        } catch (telemetryLoadError) {
            setTelemetryError(toAdminErrorMessage(telemetryLoadError, 'Failed to load AI telemetry', 'admin-ai-telemetry'));
            setTelemetrySummary(null);
            setTelemetrySeries([]);
            setMonthlyCostSeries([]);
            setTelemetryProviders([]);
            setTelemetryModels([]);
            setTelemetryRecent([]);
            setTelemetryCommentTotal(0);
            setTelemetryCommentGroups([]);
        } finally {
            setTelemetryLoading(false);
        }
    }, [fetchTelemetryApi, telemetryProviderFilter, telemetrySource, telemetryWindowHours]);

    useEffect(() => {
        if (!accessToken) return;
        void loadTelemetry();
    }, [accessToken, loadTelemetry]);

    const hasActiveFilters = telemetryWindowHours !== DEFAULT_WINDOW_HOURS
        || telemetrySource !== 'all'
        || telemetryProviderFilter !== 'all';

    const resetFilters = () => {
        trackEvent('admin__ai_telemetry--reset_filters');
        setTelemetryWindowHours(DEFAULT_WINDOW_HOURS);
        setTelemetrySource('all');
        setTelemetryProviderFilter('all');
    };

    const trendChartData = useMemo(() => telemetrySeries.map((point) => ({
        Time: new Date(point.bucketStart).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
        }),
        Success: point.success,
        Failed: point.failed,
        'Success rate': point.total > 0 ? Number(((point.success / point.total) * 100).toFixed(1)) : 0,
        'Avg latency': point.averageLatencyMs || 0,
        Cost: point.totalCostUsd,
    })), [telemetrySeries]);

    const monthlyCostHistorySeries = useMemo(
        () => buildCurrentMonthDailyCostHistory(monthlyCostSeries),
        [monthlyCostSeries],
    );

    const monthlyCostChartData = useMemo(() => {
        // Format the ISO day locally (formatIsoDayTick), so it never shifts west of UTC.
        return monthlyCostHistorySeries.map((point) => ({
            Date: formatIsoDayTick(point.date),
            'Cost (USD)': point.cost,
        }));
    }, [monthlyCostHistorySeries]);

    const currentMonthCostTotal = useMemo(() => {
        return monthlyCostHistorySeries.reduce((sum, item) => sum + item.cost, 0);
    }, [monthlyCostHistorySeries]);

    const failureCodeBarListData = useMemo(
        () => buildFailureCodeBarListData(telemetryRecent, 8),
        [telemetryRecent],
    );

    const leaders = useMemo(() => pickTelemetryLeaders(telemetryModels), [telemetryModels]);

    const sortedModels = useMemo(
        () => sortTelemetryModels(telemetryModels, modelSortColumn, modelSortDirection),
        [modelSortColumn, modelSortDirection, telemetryModels],
    );
    const modelPageCount = Math.max(1, Math.ceil(sortedModels.length / MODEL_PAGE_SIZE));
    const safeModelPage = Math.min(modelPage, modelPageCount);
    const pagedModels = sortedModels.slice((safeModelPage - 1) * MODEL_PAGE_SIZE, safeModelPage * MODEL_PAGE_SIZE);
    const totalModelCalls = useMemo(() => telemetryModels.reduce((sum, row) => sum + row.total, 0), [telemetryModels]);

    const providerRows = useMemo(() => buildProviderTableRows(telemetryProviders), [telemetryProviders]);

    const filteredRecent = useMemo(
        () => (recentStatusFilters.length === 0
            ? telemetryRecent
            : telemetryRecent.filter((row) => recentStatusFilters.includes(row.status))),
        [recentStatusFilters, telemetryRecent],
    );
    const recentPageCount = Math.max(1, Math.ceil(filteredRecent.length / RECENT_PAGE_SIZE));
    const safeRecentPage = Math.min(recentPage, recentPageCount);
    const pagedRecent = filteredRecent.slice((safeRecentPage - 1) * RECENT_PAGE_SIZE, safeRecentPage * RECENT_PAGE_SIZE);
    const recentStatusOptions = useMemo(() => RECENT_STATUS_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: telemetryRecent.filter((row) => row.status === option.value).length,
    })), [telemetryRecent]);

    const handleModelSort = (column: TelemetryModelSortColumn) => {
        if (modelSortColumn === column) {
            setModelSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
        } else {
            setModelSortColumn(column);
            // Counts and rates read best high-to-low; durations and costs low-to-high.
            setModelSortDirection(column === 'total' || column === 'successRate' || column === 'totalCostUsd' ? 'desc' : 'asc');
        }
        setModelPage(1);
    };

    const focusLeader = (kind: TelemetryLeaderKind, column: TelemetryModelSortColumn, direction: TelemetrySortDirection) => {
        trackEvent('admin__ai_telemetry--leader', { leader: kind });
        setBreakdownTab('models');
        setModelSortColumn(column);
        setModelSortDirection(direction);
        setModelPage(1);
    };

    const focusProvider = (provider: string) => {
        trackEvent('admin__ai_telemetry--focus_provider', { provider });
        setTelemetryProviderFilter(provider);
        setBreakdownTab('models');
    };

    const isCapped = Boolean(telemetrySummary && telemetrySummary.total >= TELEMETRY_ROW_CAP);
    const windowLabel = TELEMETRY_WINDOW_OPTIONS.find((option) => option.value === telemetryWindowHours)?.label || 'Selected window';
    const nowMs = Date.now();

    return (
        <AdminShell
            title="AI telemetry"
            description="Is AI generation healthy, how fast is it, and what does it cost? Runtime and benchmark calls."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <>
                    <Button asChild variant="ghost">
                        <Link
                            to="/admin/ai-benchmark/worker-health"
                            onClick={() => trackEvent('admin__ai_telemetry--worker_health')}
                            {...getAnalyticsDebugAttributes('admin__ai_telemetry--worker_health')}
                        >
                            Worker health
                            <ArrowRight className="rtl:rotate-180" />
                        </Link>
                    </Button>
                    <AdminReloadButton onClick={() => void loadTelemetry()} isLoading={telemetryLoading} />
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                {/* One toolbar scopes everything below; it is the first thing an admin changes. */}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Telemetry filters">
                    <Select value={String(telemetryWindowHours)} onValueChange={(value) => setTelemetryWindowHours(Number(value))}>
                        <SelectTrigger className="h-8 w-auto min-w-32 text-sm" aria-label="Window">
                            <SelectValue placeholder="Window" />
                        </SelectTrigger>
                        <SelectContent>
                            {TELEMETRY_WINDOW_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={String(option.value)}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={telemetrySource} onValueChange={(value) => setTelemetrySource(value as TelemetrySourceFilter)}>
                        <SelectTrigger className="h-8 w-auto min-w-36 text-sm" aria-label="Source">
                            <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All sources</SelectItem>
                            <SelectItem value="create_trip">Trip generation</SelectItem>
                            <SelectItem value="benchmark">Benchmark runs</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={telemetryProviderFilter} onValueChange={setTelemetryProviderFilter}>
                        <SelectTrigger className="h-8 w-auto min-w-36 text-sm" aria-label="Provider">
                            <SelectValue placeholder="Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All providers</SelectItem>
                            {telemetryProviderOptions.map((provider) => (
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
                    {hasActiveFilters ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            {...getAnalyticsDebugAttributes('admin__ai_telemetry--reset_filters')}
                        >
                            <X />
                            Reset
                        </Button>
                    ) : null}
                </div>

                {telemetryError && <AdminErrorAlert title="Could not load AI telemetry" message={telemetryError} />}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard
                        label="Calls"
                        value={telemetrySummary ? telemetrySummary.total.toLocaleString() : '—'}
                        hint={isCapped
                            ? `Capped at the latest ${TELEMETRY_ROW_CAP.toLocaleString()}; narrow the window for exact totals`
                            : windowLabel}
                        hintTone={isCapped ? 'warning' : 'neutral'}
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Success rate"
                        value={telemetrySummary ? formatPercent(telemetrySummary.successRate) : '—'}
                        hint={telemetrySummary
                            ? (telemetrySummary.failed > 0
                                ? `${telemetrySummary.failed.toLocaleString()} failed; see failure codes`
                                : 'No failed calls')
                            : undefined}
                        hintTone={telemetrySummary && telemetrySummary.failed > 0 ? 'warning' : 'neutral'}
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Avg duration"
                        value={telemetrySummary ? formatDuration(telemetrySummary.averageLatencyMs) : '—'}
                        hint="Mean across all calls"
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Cost (est.)"
                        value={telemetrySummary ? formatUsd(telemetrySummary.totalCostUsd) : '—'}
                        hint={telemetrySummary ? `${formatUsd(telemetrySummary.averageCostUsd)} per call` : undefined}
                        isLoading={telemetryLoading}
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                        <Tabs
                            value={trendTab}
                            onValueChange={(value) => {
                                setTrendTab(value as TrendTab);
                                trackEvent('admin__ai_telemetry--trend_tab', { tab: value });
                            }}
                        >
                            <AdminSectionHeader
                                title="Over time"
                                description="Hourly buckets across the selected window."
                                actions={(
                                    <TabsList aria-label="Trend metric">
                                        <TabsTrigger value="calls">Calls</TabsTrigger>
                                        <TabsTrigger value="success">Success rate</TabsTrigger>
                                        <TabsTrigger value="latency">Latency</TabsTrigger>
                                        <TabsTrigger value="cost">Cost</TabsTrigger>
                                    </TabsList>
                                )}
                            />
                            {trendChartData.length === 0 ? (
                                <TelemetryEmpty description="Widen the window or clear the source and provider filters.">
                                    No calls in this scope
                                </TelemetryEmpty>
                            ) : (
                                <>
                                    <TabsContent value="calls">
                                        <AdminBarChart
                                            data={trendChartData}
                                            index="Time"
                                            categories={['Success', 'Failed']}
                                            colors={CALL_TREND_COLORS}
                                            stack
                                            className="h-64"
                                            ariaLabel="Stacked bar chart of successful and failed calls per time bucket"
                                        />
                                    </TabsContent>
                                    <TabsContent value="success">
                                        <AdminAreaChart
                                            className="h-64"
                                            data={trendChartData}
                                            index="Time"
                                            categories={['Success rate']}
                                            colors={['emerald']}
                                            minValue={0}
                                            maxValue={100}
                                            showLegend={false}
                                            connectNulls
                                            valueFormatter={(value) => formatPercent(value)}
                                            yAxisWidth={52}
                                            ariaLabel="Area chart of success rate per time bucket"
                                        />
                                    </TabsContent>
                                    <TabsContent value="latency">
                                        <AdminAreaChart
                                            className="h-64"
                                            data={trendChartData}
                                            index="Time"
                                            categories={['Avg latency']}
                                            colors={['violet']}
                                            showLegend={false}
                                            connectNulls
                                            valueFormatter={(value) => formatDuration(value)}
                                            ariaLabel="Area chart of average latency per time bucket"
                                        />
                                    </TabsContent>
                                    <TabsContent value="cost">
                                        <AdminAreaChart
                                            className="h-64"
                                            data={trendChartData}
                                            index="Time"
                                            categories={['Cost']}
                                            colors={['amber']}
                                            showLegend={false}
                                            connectNulls
                                            valueFormatter={formatUsdTick}
                                            yAxisWidth={64}
                                            ariaLabel="Area chart of total estimated cost per time bucket"
                                        />
                                    </TabsContent>
                                </>
                            )}
                        </Tabs>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader
                            title="Top failure codes"
                            description={`Among the latest ${telemetryRecent.length.toLocaleString()} calls in this scope.`}
                        />
                        {failureCodeBarListData.length > 0 ? (
                            <AdminBarList
                                data={failureCodeBarListData.map((row) => ({
                                    key: row.key,
                                    name: <span className="font-mono text-xs text-foreground">{row.name}</span>,
                                    value: row.value,
                                }))}
                                sortOrder="descending"
                                valueFormatter={(value) => formatCallCount(value)}
                                color="rose"
                                ariaLabel="Recent failures by error code"
                            />
                        ) : (
                            <TelemetryEmpty>No recent failures</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>
                </div>

                <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                    <AdminSectionHeader
                        title="Spend this month"
                        description="Estimated API cost per day for the current calendar month (UTC), across every source and provider."
                        actions={(
                            <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                                {formatUsd(currentMonthCostTotal)}
                            </span>
                        )}
                    />
                    {monthlyCostChartData.length > 0 ? (
                        <AdminBarChart
                            data={monthlyCostChartData}
                            index="Date"
                            categories={['Cost (USD)']}
                            colors={['emerald']}
                            showLegend={false}
                            valueFormatter={formatUsdTick}
                            yAxisWidth={64}
                            className="h-64"
                            ariaLabel="Bar chart of API cost per day this month"
                        />
                    ) : (
                        <TelemetryEmpty>No cost data available for the current month</TelemetryEmpty>
                    )}
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex min-w-0 flex-col gap-4 p-0">
                    <Tabs
                        value={breakdownTab}
                        onValueChange={(value) => {
                            setBreakdownTab(value as BreakdownTab);
                            trackEvent('admin__ai_telemetry--breakdown_tab', { tab: value });
                        }}
                    >
                        <AdminSectionHeader
                            className="px-4 pt-4"
                            title="Compare"
                            description={breakdownTab === 'models'
                                ? 'Every model in this scope. Sort a column, or pick a leader, to rank them.'
                                : 'Call share, reliability and cost per provider. Focus one to scope the whole page.'}
                            actions={(
                                <TabsList aria-label="Breakdown">
                                    <TabsTrigger value="models">Models</TabsTrigger>
                                    <TabsTrigger value="providers">Providers</TabsTrigger>
                                </TabsList>
                            )}
                        />

                        <TabsContent value="models" className="flex flex-col gap-3">
                            {leaders.length > 0 ? (
                                <div className="flex flex-wrap gap-2 px-4" aria-label="Model leaders" role="group">
                                    {leaders.map((leader) => {
                                        const isActive = modelSortColumn === leader.sortColumn && modelSortDirection === leader.sortDirection;
                                        return (
                                            <Button
                                                key={leader.kind}
                                                type="button"
                                                variant={isActive ? 'secondary' : 'outline'}
                                                size="sm"
                                                aria-pressed={isActive}
                                                className="h-auto min-h-8 max-w-full justify-start py-1 text-start"
                                                onClick={() => focusLeader(leader.kind, leader.sortColumn, leader.sortDirection)}
                                                {...getAnalyticsDebugAttributes('admin__ai_telemetry--leader', { leader: leader.kind })}
                                            >
                                                <span className="text-muted-foreground">{LEADER_LABELS[leader.kind]}</span>
                                                <AiProviderLogo provider={leader.model.provider} model={leader.model.model} size={12} />
                                                <span className="truncate font-medium">{leader.model.model}</span>
                                                <span className="tabular-nums text-muted-foreground">{formatLeaderValue(leader.kind, leader.model)}</span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {sortedModels.length === 0 ? (
                                <div className="px-4 pb-4">
                                    <TelemetryEmpty description="Widen the window or clear the source and provider filters.">
                                        No model activity in this scope
                                    </TelemetryEmpty>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto border-t border-border">
                                        <Table className="text-xs">
                                            <TableHeader>
                                                <TableRow>
                                                    {MODEL_COLUMNS.map(({ column, label, numeric, tooltip }) => {
                                                        const isActive = modelSortColumn === column;
                                                        return (
                                                            <TableHead
                                                                key={column}
                                                                className={cn('px-4', numeric && 'text-end', isActive && ADMIN_TABLE_SORTED_HEADER_CLASS)}
                                                                aria-sort={isActive ? (modelSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                                data-tooltip={tooltip}
                                                            >
                                                                <AdminSortHeaderButton
                                                                    label={label}
                                                                    isActive={isActive}
                                                                    direction={modelSortDirection}
                                                                    onClick={() => handleModelSort(column)}
                                                                />
                                                            </TableHead>
                                                        );
                                                    })}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pagedModels.map((row) => {
                                                    const cellClass = (column: TelemetryModelSortColumn) => cn(
                                                        'px-4 py-2 tabular-nums',
                                                        column !== 'model' && 'text-end',
                                                        modelSortColumn === column && ADMIN_TABLE_SORTED_CELL_CLASS,
                                                    );
                                                    const share = totalModelCalls > 0 ? (row.total / totalModelCalls) * 100 : null;
                                                    return (
                                                        <TableRow key={row.key} className="hover:bg-muted/50">
                                                            <TableCell className={cellClass('model')}>
                                                                <span className="inline-flex min-w-0 max-w-[280px] items-center gap-2">
                                                                    <AiProviderLogo provider={row.provider} model={row.model} size={14} />
                                                                    <span className="min-w-0">
                                                                        <span className="block truncate font-medium text-foreground">{row.model}</span>
                                                                        <span className="block truncate text-muted-foreground">{getAiProviderMetadata(row.provider).shortName}</span>
                                                                    </span>
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className={cellClass('total')}>
                                                                <div className="text-foreground">{row.total.toLocaleString()}</div>
                                                                <div className="text-muted-foreground">{formatPercent(share)} of calls</div>
                                                            </TableCell>
                                                            <TableCell className={cellClass('successRate')}>
                                                                <div className={row.failed > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}>
                                                                    {formatPercent(row.successRate)}
                                                                </div>
                                                                {row.failed > 0 ? <div className="text-muted-foreground">{row.failed.toLocaleString()} failed</div> : null}
                                                            </TableCell>
                                                            <TableCell className={cellClass('averageLatencyMs')}>{formatDuration(row.averageLatencyMs)}</TableCell>
                                                            <TableCell className={cellClass('averageCostUsd')}>{formatUsd(row.averageCostUsd)}</TableCell>
                                                            <TableCell className={cellClass('costPerSecondUsd')}>{formatUsd(row.costPerSecondUsd)}</TableCell>
                                                            <TableCell className={cellClass('totalCostUsd')}>{formatUsd(row.totalCostUsd)}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <AdminPagination
                                        className="px-4 pb-4"
                                        page={safeModelPage}
                                        pageSize={MODEL_PAGE_SIZE}
                                        totalItems={sortedModels.length}
                                        onPageChange={setModelPage}
                                        noun="models"
                                    />
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="providers">
                            {providerRows.length === 0 ? (
                                <div className="px-4 pb-4">
                                    <TelemetryEmpty>No provider activity in this scope</TelemetryEmpty>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border-t border-border">
                                    <Table className="text-xs">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="ps-4 text-muted-foreground">Provider</TableHead>
                                                <TableHead className="text-muted-foreground">Call share</TableHead>
                                                <TableHead className="text-end text-muted-foreground">Success</TableHead>
                                                <TableHead className="text-end text-muted-foreground">Avg duration</TableHead>
                                                <TableHead className="text-end text-muted-foreground">Cost / success</TableHead>
                                                <TableHead className="pe-4 text-end text-muted-foreground">Total cost</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {providerRows.map((row) => {
                                                const isFocused = telemetryProviderFilter === row.provider;
                                                return (
                                                    <TableRow key={row.provider} className="hover:bg-muted/50">
                                                        <TableCell className="ps-4">
                                                            {isFocused ? (
                                                                <ProviderLabel provider={row.provider} logoSize={14} />
                                                            ) : (
                                                                <Button
                                                                    type="button"
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="h-auto p-0 text-xs"
                                                                    data-tooltip="Scope the whole page to this provider"
                                                                    onClick={() => focusProvider(row.provider)}
                                                                    {...getAnalyticsDebugAttributes('admin__ai_telemetry--focus_provider', { provider: row.provider })}
                                                                >
                                                                    <ProviderLabel provider={row.provider} logoSize={14} />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="min-w-40">
                                                            <div className="flex items-center gap-2 tabular-nums">
                                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                                                    <div className="h-full rounded-full bg-[var(--admin-chart-indigo)]" style={{ width: `${row.sharePercent}%` }} />
                                                                </div>
                                                                <span className="w-24 shrink-0 text-end text-foreground">
                                                                    {row.total.toLocaleString()} · {formatPercent(row.sharePercent)}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-end tabular-nums">
                                                            <span className={row.failed > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}>
                                                                {formatPercent(row.successRate)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-end tabular-nums text-foreground">{formatDuration(row.averageLatencyMs)}</TableCell>
                                                        <TableCell className="text-end tabular-nums text-foreground">{formatUsd(row.costPerSuccessUsd)}</TableCell>
                                                        <TableCell className="pe-4 text-end tabular-nums text-foreground">{formatUsd(row.totalCostUsd)}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex min-w-0 flex-col gap-3 p-0">
                    <AdminSectionHeader
                        className="px-4 pt-4"
                        title="Recent calls"
                        description="The newest calls in this scope, for tracing a single failure."
                        actions={(
                            <AdminFilterMenu
                                label="Status"
                                options={recentStatusOptions}
                                selectedValues={recentStatusFilters}
                                onSelectedValuesChange={(next) => {
                                    setRecentStatusFilters(next);
                                    setRecentPage(1);
                                }}
                            />
                        )}
                    />

                    <div className="overflow-x-auto border-t border-border">
                        <Table className="text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="ps-4 text-muted-foreground">Time</TableHead>
                                    <TableHead className="text-muted-foreground">Model</TableHead>
                                    <TableHead className="text-muted-foreground">Status</TableHead>
                                    <TableHead className="text-end text-muted-foreground">Duration</TableHead>
                                    <TableHead className="text-end text-muted-foreground">Cost</TableHead>
                                    <TableHead className="pe-4 text-muted-foreground">Error</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagedRecent.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="px-4 py-6 text-center text-sm text-muted-foreground"
                                            role={telemetryLoading ? 'status' : undefined}
                                        >
                                            {telemetryLoading
                                                ? 'Loading telemetry…'
                                                : recentStatusFilters.length > 0 ? 'No calls match this status.' : 'No calls in this scope yet.'}
                                        </TableCell>
                                    </TableRow>
                                )}

                                {pagedRecent.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-muted/50">
                                        <TableCell className="ps-4 tabular-nums text-muted-foreground">
                                            <span data-tooltip={formatAdminAbsoluteTime(row.created_at)}>
                                                {formatAdminRelativeTime(row.created_at, nowMs)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[260px] truncate text-foreground">
                                            <ProviderLabel provider={row.provider} model={row.model} logoSize={13} />
                                        </TableCell>
                                        <TableCell>
                                            <AdminStatusBadge tone={row.status === 'success' ? 'success' : 'danger'}>
                                                {row.status === 'success' ? 'Success' : 'Failed'}
                                            </AdminStatusBadge>
                                        </TableCell>
                                        <TableCell className="text-end tabular-nums text-foreground">{formatDuration(row.latency_ms)}</TableCell>
                                        <TableCell className="text-end tabular-nums text-foreground">{formatUsd(row.estimated_cost_usd)}</TableCell>
                                        <TableCell className="pe-4 font-mono text-muted-foreground">{row.error_code || '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <AdminPagination
                        className="px-4 pb-4"
                        page={safeRecentPage}
                        pageSize={RECENT_PAGE_SIZE}
                        totalItems={filteredRecent.length}
                        onPageChange={setRecentPage}
                        noun="calls"
                    />
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Benchmark run comments"
                        description="Notes left on benchmark runs in this window, grouped by model."
                        actions={(
                            <span className="text-sm tabular-nums text-muted-foreground">
                                {telemetryCommentTotal.toLocaleString()} {telemetryCommentTotal === 1 ? 'comment' : 'comments'}
                            </span>
                        )}
                    />

                    {telemetryCommentGroups.length === 0 ? (
                        <TelemetryEmpty description={telemetryLoading ? undefined : 'Comments come from rating runs on the AI benchmark screen.'}>
                            {telemetryLoading ? 'Loading comments…' : 'No benchmark run comments in this window'}
                        </TelemetryEmpty>
                    ) : (
                        <div className="flex max-h-[500px] flex-col gap-3 overflow-y-auto">
                            {telemetryCommentGroups.map((group) => (
                                <div key={group.key} className="rounded-md border border-border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="min-w-0 text-sm font-medium text-foreground">
                                            <ProviderLabel provider={group.provider} model={group.model} providerClassName="text-foreground" modelClassName="truncate text-foreground" logoSize={12} />
                                        </p>
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                            {group.total} comment{group.total === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Latest <span data-tooltip={formatAdminAbsoluteTime(group.latestCommentAt)}>{formatAdminRelativeTime(group.latestCommentAt, nowMs)}</span>
                                    </p>

                                    <div className="mt-2 flex flex-col gap-2">
                                        {group.comments.map((comment) => (
                                            <div key={`${group.key}-${comment.runId}-${comment.updatedAt}`} className="rounded-md bg-secondary px-2.5 py-2 text-xs">
                                                <p className="whitespace-pre-wrap break-words text-foreground">{comment.comment}</p>
                                                <p className="mt-1 text-[11px] text-muted-foreground">
                                                    Run {comment.runId.slice(0, 8)} · {comment.status || 'unknown'} · {comment.satisfactionRating || 'unrated'} · {formatAdminAbsoluteTime(comment.updatedAt)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
