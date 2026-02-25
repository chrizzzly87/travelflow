import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, ArrowLeft } from '@phosphor-icons/react';
import {
    AreaChart,
    BarChart,
    BarList,
    type CustomTooltipProps,
    DonutChart,
    Metric,
    Subtitle,
    Text,
    Title,
} from '@tremor/react';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AiProviderLogo } from '../components/admin/AiProviderLogo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { getAiProviderMetadata, getAiProviderSortOrder } from '../config/aiProviderCatalog';
import { dbGetAccessToken, ensureDbSession } from '../services/dbService';
import { useAuth } from '../hooks/useAuth';
import {
    buildFailureCodeBarListData,
    buildCurrentMonthDailyCostHistory,
    buildProviderCostPerSuccessChartData,
    buildProviderDonutEntries,
    buildProviderModelDonutEntries,
    buildProviderSuccessRateChartData,
    type TelemetryDonutColor,
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
    recent?: AiTelemetryRecentRow[];
    availableProviders?: string[];
}

const TELEMETRY_WINDOW_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 24, label: 'Last 24h' },
    { value: 24 * 7, label: 'Last 7d' },
    { value: 24 * 30, label: 'Last 30d' },
];

const RANK_LIMIT_OPTIONS: Array<{ value: number; label: string }> = [
    { value: 3, label: 'Top 3' },
    { value: 5, label: 'Top 5' },
];

const DONUT_COLOR_DOT_CLASS: Record<TelemetryDonutColor, string> = {
    blue: 'bg-blue-500',
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    fuchsia: 'bg-fuchsia-500',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
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

const formatPercent = (value: number | null | undefined): string => {
    if (!Number.isFinite(value)) return '—';
    return `${Number(value).toFixed(1)}%`;
};

const formatCallCount = (value: number | null | undefined): string => {
    if (!Number.isFinite(value)) return '0 calls';
    const count = Math.max(0, Math.round(Number(value)));
    return `${count.toLocaleString()} ${count === 1 ? 'call' : 'calls'}`;
};

const formatTimestamp = (value?: string | null): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '—';
    return new Date(parsed).toLocaleString();
};

const toNumericTooltipValue = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const createProviderChartTooltip = (
    formatValue: (name: string, value: number) => string,
): React.FC<CustomTooltipProps> => {
    return ({ active, payload, label }) => {
        if (!active || !Array.isArray(payload) || payload.length === 0) return null;

        const firstPayload = payload[0]?.payload as Record<string, unknown> | undefined;
        const providerId = typeof firstPayload?.providerId === 'string'
            ? firstPayload.providerId
            : (typeof label === 'string' ? label.trim().toLowerCase() : '');

        if (!providerId) return null;

        return (
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
                <p className="mb-1 text-[11px] font-semibold text-slate-900">
                    <ProviderLabel provider={providerId} providerClassName="text-slate-900" logoSize={12} />
                </p>
                <div className="space-y-0.5">
                    {payload.map((entry, index) => {
                        const metricName = String(entry.name || 'Value');
                        const metricValue = toNumericTooltipValue(entry.value);
                        return (
                            <p key={`${metricName}-${index}`} className="text-[11px] text-slate-700">
                                {metricName}: {formatValue(metricName, metricValue)}
                            </p>
                        );
                    })}
                </div>
            </div>
        );
    };
};

const ProviderBreakdownTooltip = createProviderChartTooltip((_name, value) => formatCallCount(value));
const ProviderSuccessRateTooltip = createProviderChartTooltip((_name, value) => formatPercent(value));
const ProviderCostPerSuccessTooltip = createProviderChartTooltip((_name, value) => formatUsd(value));

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
            <span className={providerClassName || 'font-semibold text-slate-800'} title={`${metadata.label} (${provider})`}>
                {metadata.shortName}
            </span>
            {model ? (
                <span className={modelClassName || 'truncate text-slate-600'}>
                    / {model}
                </span>
            ) : null}
        </span>
    );
};

const compactModelLabelNode = (provider: string, model: string): React.ReactNode => {
    const metadata = getAiProviderMetadata(provider);
    return (
        <span className="inline-flex min-w-0 max-w-[270px] items-center gap-1.5">
            <AiProviderLogo provider={provider} model={model} size={12} />
            <span className="truncate text-slate-700" title={`${metadata.shortName} / ${model}`}>
                {metadata.shortName} / {model}
            </span>
        </span>
    );
};

export const AdminAiTelemetryPage: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [telemetryWindowHours, setTelemetryWindowHours] = useState<number>(24 * 7);
    const [telemetrySource, setTelemetrySource] = useState<TelemetrySourceFilter>('all');
    const [telemetryProviderFilter, setTelemetryProviderFilter] = useState<string>('all');
    const [rankLimit, setRankLimit] = useState<number>(5);

    const [telemetryLoading, setTelemetryLoading] = useState(false);
    const [telemetryError, setTelemetryError] = useState<string | null>(null);
    const [telemetrySummary, setTelemetrySummary] = useState<AiTelemetrySummary | null>(null);
    const [telemetrySeries, setTelemetrySeries] = useState<AiTelemetrySeriesPoint[]>([]);
    const [monthlyCostSeries, setMonthlyCostSeries] = useState<Array<{ date: string; cost: number }>>([]);
    const [telemetryProviders, setTelemetryProviders] = useState<AiTelemetryProviderPoint[]>([]);
    const [telemetryModels, setTelemetryModels] = useState<AiTelemetryModelPoint[]>([]);
    const [telemetryRecent, setTelemetryRecent] = useState<AiTelemetryRecentRow[]>([]);
    const [telemetryProviderOptions, setTelemetryProviderOptions] = useState<string[]>([]);
    const [fastestModels, setFastestModels] = useState<AiTelemetryModelPoint[]>([]);
    const [cheapestModels, setCheapestModels] = useState<AiTelemetryModelPoint[]>([]);
    const [bestValueModels, setBestValueModels] = useState<AiTelemetryModelPoint[]>([]);
    const [selectedProviderShare, setSelectedProviderShare] = useState<string | null>(null);
    const [selectedModelShare, setSelectedModelShare] = useState<string | null>(null);

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
            setFastestModels(Array.isArray(payload.rankings?.fastest) ? payload.rankings?.fastest : []);
            setCheapestModels(Array.isArray(payload.rankings?.cheapest) ? payload.rankings?.cheapest : []);
            setBestValueModels(Array.isArray(payload.rankings?.bestValue) ? payload.rankings?.bestValue : []);

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
            setTelemetryError(telemetryLoadError instanceof Error ? telemetryLoadError.message : 'Failed to load AI telemetry');
            setTelemetrySummary(null);
            setTelemetrySeries([]);
            setMonthlyCostSeries([]);
            setTelemetryProviders([]);
            setTelemetryModels([]);
            setTelemetryRecent([]);
            setFastestModels([]);
            setCheapestModels([]);
            setBestValueModels([]);
        } finally {
            setTelemetryLoading(false);
        }
    }, [fetchTelemetryApi, telemetryProviderFilter, telemetrySource, telemetryWindowHours]);

    useEffect(() => {
        if (!accessToken) return;
        void loadTelemetry();
    }, [accessToken, loadTelemetry]);

    useEffect(() => {
        if (!selectedProviderShare) return;
        const providerStillVisible = telemetryProviders.some((row) => row.provider === selectedProviderShare);
        if (!providerStillVisible) {
            setSelectedProviderShare(null);
            setSelectedModelShare(null);
        }
    }, [selectedProviderShare, telemetryProviders]);

    const successfulModels = useMemo(
        () => telemetryModels.filter((row) => row.success > 0),
        [telemetryModels],
    );

    const successRateLeaders = useMemo(() => {
        return [...successfulModels]
            .sort((left, right) => right.successRate - left.successRate || right.total - left.total)
            .slice(0, rankLimit);
    }, [rankLimit, successfulModels]);

    const limitedFastest = useMemo(
        () => fastestModels.filter((row) => row.success > 0).slice(0, rankLimit),
        [fastestModels, rankLimit],
    );
    const limitedCheapest = useMemo(
        () => cheapestModels.filter((row) => row.success > 0).slice(0, rankLimit),
        [cheapestModels, rankLimit],
    );
    const limitedBestValue = useMemo(
        () => bestValueModels.filter((row) => row.success > 0).slice(0, rankLimit),
        [bestValueModels, rankLimit],
    );

    const fastestBarListData = useMemo(() => {
        return limitedFastest.map((model) => ({
            key: model.key,
            name: compactModelLabelNode(model.provider, model.model),
            value: model.averageLatencyMs || 0,
        }));
    }, [limitedFastest]);

    const cheapestBarListData = useMemo(() => {
        return limitedCheapest.map((model) => ({
            key: model.key,
            name: compactModelLabelNode(model.provider, model.model),
            value: model.averageCostUsd || 0,
        }));
    }, [limitedCheapest]);

    const bestValueBarListData = useMemo(() => {
        return limitedBestValue.map((model) => ({
            key: model.key,
            name: compactModelLabelNode(model.provider, model.model),
            value: model.costPerSecondUsd || 0,
        }));
    }, [limitedBestValue]);

    const successRateBarListData = useMemo(() => {
        return successRateLeaders.map((model) => ({
            key: model.key,
            name: compactModelLabelNode(model.provider, model.model),
            value: model.successRate,
        }));
    }, [successRateLeaders]);

    const callsTrendChartData = useMemo(() => {
        return telemetrySeries.map((point) => ({
            Time: new Date(point.bucketStart).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
            }),
            Success: point.success,
            Failed: point.failed,
        }));
    }, [telemetrySeries]);

    const successRateTrendChartData = useMemo(() => {
        return telemetrySeries.map((point) => ({
            Time: new Date(point.bucketStart).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
            }),
            'Success rate': point.total > 0 ? Number(((point.success / point.total) * 100).toFixed(1)) : 0,
        }));
    }, [telemetrySeries]);

    const latencyTrendChartData = useMemo(() => {
        return telemetrySeries.map((point) => ({
            Time: new Date(point.bucketStart).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
            }),
            'Avg latency (ms)': point.averageLatencyMs || 0,
        }));
    }, [telemetrySeries]);

    const costTrendChartData = useMemo(() => {
        return telemetrySeries.map((point) => ({
            Time: new Date(point.bucketStart).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
            }),
            'Total cost (USD)': point.totalCostUsd,
        }));
    }, [telemetrySeries]);

    const monthlyCostHistorySeries = useMemo(
        () => buildCurrentMonthDailyCostHistory(monthlyCostSeries),
        [monthlyCostSeries],
    );

    const monthlyCostChartData = useMemo(() => {
        return monthlyCostHistorySeries.map((point) => ({
            Date: new Date(point.date).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
            }),
            'Cost (USD)': point.cost,
        }));
    }, [monthlyCostHistorySeries]);

    const currentMonthCostTotal = useMemo(() => {
        return monthlyCostHistorySeries.reduce((sum, item) => sum + item.cost, 0);
    }, [monthlyCostHistorySeries]);

    const providerVolumeChartData = useMemo(() => {
        return [...telemetryProviders]
            .sort((left, right) => right.total - left.total)
            .slice(0, 10)
            .map((row) => ({
                providerId: row.provider,
                Provider: getAiProviderMetadata(row.provider).shortName,
                Calls: row.total,
                Failures: row.failed,
            }));
    }, [telemetryProviders]);

    const providerDonutEntries = useMemo(
        () => buildProviderDonutEntries(telemetryProviders, 8),
        [telemetryProviders],
    );

    const providerModelDonutEntries = useMemo(() => {
        if (!selectedProviderShare) return [];
        return buildProviderModelDonutEntries(telemetryModels, selectedProviderShare, 10);
    }, [selectedProviderShare, telemetryModels]);

    const activeDonutEntries = selectedProviderShare ? providerModelDonutEntries : providerDonutEntries;

    useEffect(() => {
        if (!selectedProviderShare || !selectedModelShare) return;
        const modelStillVisible = providerModelDonutEntries.some((entry) => entry.model === selectedModelShare);
        if (!modelStillVisible) {
            setSelectedModelShare(null);
        }
    }, [providerModelDonutEntries, selectedModelShare, selectedProviderShare]);

    const providerShareDonutData = useMemo(() => {
        return activeDonutEntries.map((entry) => ({
            Segment: selectedProviderShare
                ? entry.label
                : (entry.provider === 'other' ? entry.label : getAiProviderMetadata(entry.provider).shortName),
            Calls: entry.calls,
            provider: entry.provider,
            model: entry.model,
        }));
    }, [activeDonutEntries, selectedProviderShare]);

    const providerShareDonutColors = useMemo(
        () => activeDonutEntries.map((entry) => entry.color),
        [activeDonutEntries],
    );

    const providerSuccessRateChartData = useMemo(
        () => buildProviderSuccessRateChartData(telemetryProviders, 8).map((row) => ({
            providerId: row.Provider,
            ...row,
            Provider: getAiProviderMetadata(row.Provider).shortName,
        })),
        [telemetryProviders],
    );

    const providerCostPerSuccessChartData = useMemo(
        () => buildProviderCostPerSuccessChartData(telemetryProviders, 8).map((row) => ({
            providerId: row.Provider,
            ...row,
            Provider: getAiProviderMetadata(row.Provider).shortName,
        })),
        [telemetryProviders],
    );

    const failureCodeBarListData = useMemo(
        () => buildFailureCodeBarListData(telemetryRecent, 8),
        [telemetryRecent],
    );

    const selectedProviderStats = useMemo(() => {
        if (!selectedProviderShare) return null;
        return telemetryProviders.find((row) => row.provider === selectedProviderShare) || null;
    }, [selectedProviderShare, telemetryProviders]);

    const selectedModelStats = useMemo(() => {
        if (!selectedProviderShare || !selectedModelShare) return null;
        return telemetryModels.find((row) => row.provider === selectedProviderShare && row.model === selectedModelShare) || null;
    }, [selectedModelShare, selectedProviderShare, telemetryModels]);

    const handleProviderShareSliceSelect = useCallback((value: unknown) => {
        if (!value || typeof value !== 'object') {
            setSelectedModelShare(null);
            return;
        }
        const payload = value as { provider?: unknown; model?: unknown };
        const provider = typeof payload.provider === 'string' ? payload.provider : null;
        const model = typeof payload.model === 'string' ? payload.model : null;

        if (!provider || provider === 'other') return;

        if (!selectedProviderShare) {
            setSelectedProviderShare(provider);
            setSelectedModelShare(null);
            return;
        }

        if (selectedProviderShare !== provider) {
            setSelectedProviderShare(provider);
            setSelectedModelShare(null);
            return;
        }

        if (model) {
            setSelectedModelShare((current) => (current === model ? null : model));
        }
    }, [selectedProviderShare]);

    const modelVolumeBarListData = useMemo(() => {
        return [...telemetryModels]
            .sort((left, right) => right.total - left.total)
            .slice(0, 12)
            .map((row) => ({
                key: row.key,
                name: compactModelLabelNode(row.provider, row.model),
                value: row.total,
            }));
    }, [telemetryModels]);

    const failureRate = useMemo(() => {
        if (!telemetrySummary) return null;
        return Number((100 - telemetrySummary.successRate).toFixed(1));
    }, [telemetrySummary]);

    const successfulModelCoverage = useMemo(() => {
        if (telemetryModels.length === 0) return null;
        return Number(((successfulModels.length / telemetryModels.length) * 100).toFixed(1));
    }, [successfulModels.length, telemetryModels.length]);

    return (
        <AdminShell
            title="AI Telemetry"
            description="Operational telemetry dashboard for latency, reliability, and cost across benchmark/runtime calls."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <button
                    type="button"
                    onClick={() => void loadTelemetry()}
                    disabled={telemetryLoading}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <ArrowClockwise size={14} className={telemetryLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            )}
        >
            <div className="mx-auto w-full max-w-[1600px] space-y-4">
                {telemetryError && (
                    <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {telemetryError}
                    </section>
                )}

                <AdminSurfaceCard>
                    <Title>Filters</Title>
                    <Subtitle>Keep this compact up top, then scroll down for deeper telemetry analysis.</Subtitle>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Window</p>
                            <Select value={String(telemetryWindowHours)} onValueChange={(value) => setTelemetryWindowHours(Number(value))}>
                                <SelectTrigger className="h-9 text-sm">
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
                        </div>

                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Source</p>
                            <Select value={telemetrySource} onValueChange={(value) => setTelemetrySource(value as TelemetrySourceFilter)}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All sources</SelectItem>
                                    <SelectItem value="create_trip">Create-trip runtime</SelectItem>
                                    <SelectItem value="benchmark">Benchmark runs</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Provider</p>
                            <Select value={telemetryProviderFilter} onValueChange={setTelemetryProviderFilter}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All providers</SelectItem>
                                    {telemetryProviderOptions.map((provider) => (
                                        <SelectItem key={provider} value={provider}>
                                            <ProviderLabel
                                                provider={provider}
                                                providerClassName="text-slate-700"
                                                logoSize={12}
                                            />
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Ranking size</p>
                            <Select value={String(rankLimit)} onValueChange={(value) => setRankLimit(Number(value))}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Top X" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RANK_LIMIT_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={String(option.value)}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Action</p>
                            <button
                                type="button"
                                onClick={() => void loadTelemetry()}
                                disabled={telemetryLoading}
                                className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <ArrowClockwise size={14} className={telemetryLoading ? 'animate-spin' : ''} />
                                Refresh data
                            </button>
                        </div>
                    </div>
                </AdminSurfaceCard>

                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <AdminSurfaceCard>
                        <Text>Total calls</Text>
                        <Metric>{telemetrySummary ? telemetrySummary.total : '—'}</Metric>
                        <Text className="mt-1 text-xs text-slate-500">Selected filter scope</Text>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Text>Success rate</Text>
                        <Metric>{telemetrySummary ? formatPercent(telemetrySummary.successRate) : '—'}</Metric>
                        <Text className="mt-1 text-xs text-slate-500">Failed: {telemetrySummary ? telemetrySummary.failed : '—'}</Text>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Text>Failure rate</Text>
                        <Metric>{formatPercent(failureRate)}</Metric>
                        <Text className="mt-1 text-xs text-slate-500">Quick reliability read</Text>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Text>Avg duration</Text>
                        <Metric>{telemetrySummary ? formatDuration(telemetrySummary.averageLatencyMs) : '—'}</Metric>
                        <Text className="mt-1 text-xs text-slate-500">Across all calls</Text>
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Text>Total cost (est.)</Text>
                        <Metric>{telemetrySummary ? formatUsd(telemetrySummary.totalCostUsd) : '—'}</Metric>
                        <Text className="mt-1 text-xs text-slate-500">
                            Models with success: {formatPercent(successfulModelCoverage)}
                        </Text>
                    </AdminSurfaceCard>
                </section>

                <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <AdminSurfaceCard>
                        <Title>Top models by speed</Title>
                        <Subtitle>Only models with successful calls are listed.</Subtitle>
                        {fastestBarListData.length > 0 ? (
                            <BarList
                                className="mt-3"
                                data={fastestBarListData}
                                sortOrder="ascending"
                                valueFormatter={(value) => formatDuration(value)}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No successful speed data.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Top models by cost</Title>
                        <Subtitle>Average cost per successful call.</Subtitle>
                        {cheapestBarListData.length > 0 ? (
                            <BarList
                                className="mt-3"
                                data={cheapestBarListData}
                                sortOrder="ascending"
                                valueFormatter={(value) => formatUsd(value)}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No successful cost data.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Top models by value</Title>
                        <Subtitle>Lower cost/second is better.</Subtitle>
                        {bestValueBarListData.length > 0 ? (
                            <BarList
                                className="mt-3"
                                data={bestValueBarListData}
                                sortOrder="ascending"
                                valueFormatter={(value) => `${formatUsd(value)} / sec`}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No successful value data.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Top models by success rate</Title>
                        <Subtitle>Success-rate ratio leaderboard.</Subtitle>
                        {successRateBarListData.length > 0 ? (
                            <BarList
                                className="mt-3"
                                data={successRateBarListData}
                                sortOrder="descending"
                                valueFormatter={(value) => formatPercent(value)}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No success-rate data.</Text>
                        )}
                    </AdminSurfaceCard>
                </section>

                <section className="grid gap-3 lg:grid-cols-2">
                    <AdminSurfaceCard>
                        <Title>Call trend</Title>
                        <Subtitle>Success vs failed volume across the selected window.</Subtitle>
                        {callsTrendChartData.length > 0 ? (
                            <BarChart
                                className="mt-3 h-64"
                                data={callsTrendChartData}
                                index="Time"
                                categories={['Success', 'Failed']}
                                colors={['emerald', 'rose']}
                                stack
                                yAxisWidth={56}
                                valueFormatter={(value) => formatCallCount(value)}
                                startEndOnly={callsTrendChartData.length > 12}
                                showTooltip
                                showLegend
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No time-series call data for this filter set.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Success-rate trend</Title>
                        <Subtitle>Ratio evolution over time (%).</Subtitle>
                        {successRateTrendChartData.length > 0 ? (
                            <AreaChart
                                className="mt-3 h-64"
                                data={successRateTrendChartData}
                                index="Time"
                                categories={['Success rate']}
                                colors={['indigo']}
                                yAxisWidth={56}
                                minValue={0}
                                maxValue={100}
                                valueFormatter={(value) => formatPercent(value)}
                                connectNulls
                                showGradient
                                startEndOnly={successRateTrendChartData.length > 12}
                                showTooltip
                                showLegend
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No success-rate trend data for this filter set.</Text>
                        )}
                    </AdminSurfaceCard>
                </section>

                <section className="grid gap-3 lg:grid-cols-2">
                    <AdminSurfaceCard>
                        <Title>Latency trend</Title>
                        <Subtitle>Average latency by bucket.</Subtitle>
                        {latencyTrendChartData.length > 0 ? (
                            <AreaChart
                                className="mt-3 h-56"
                                data={latencyTrendChartData}
                                index="Time"
                                categories={['Avg latency (ms)']}
                                colors={['blue']}
                                yAxisWidth={56}
                                valueFormatter={(value) => formatDuration(value)}
                                connectNulls
                                showGradient
                                startEndOnly={latencyTrendChartData.length > 12}
                                showTooltip
                                showLegend
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No latency trend data for this filter set.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Cost trend</Title>
                        <Subtitle>Total estimated cost per bucket.</Subtitle>
                        {costTrendChartData.length > 0 ? (
                            <AreaChart
                                className="mt-3 h-56"
                                data={costTrendChartData}
                                index="Time"
                                categories={['Total cost (USD)']}
                                colors={['violet']}
                                yAxisWidth={56}
                                valueFormatter={(value) => formatUsd(value)}
                                connectNulls
                                showGradient
                                startEndOnly={costTrendChartData.length > 12}
                                showTooltip
                                showLegend
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No cost trend data for this filter set.</Text>
                        )}
                    </AdminSurfaceCard>
                </section>

                <section className="mt-3">
                    <AdminSurfaceCard>
                        <Title>Total cost per day (Current Month)</Title>
                        <Subtitle>Daily breakdown of API costs for the ongoing calendar month.</Subtitle>
                        <Metric className="mt-2">{formatUsd(currentMonthCostTotal)}</Metric>
                        {monthlyCostChartData.length > 0 ? (
                            <BarChart
                                className="mt-3 h-56"
                                data={monthlyCostChartData}
                                index="Date"
                                categories={['Cost (USD)']}
                                colors={['emerald']}
                                yAxisWidth={56}
                                valueFormatter={(value) => formatUsd(value)}
                                showTooltip
                                showLegend={false}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No cost data available for the current month.</Text>
                        )}
                    </AdminSurfaceCard>
                </section>

                <section className="grid gap-3 lg:grid-cols-2 mt-3">
                    <AdminSurfaceCard>
                        <Title>Provider breakdown</Title>
                        <Subtitle>Calls and failures by provider.</Subtitle>
                        {providerVolumeChartData.length > 0 ? (
                            <BarChart
                                className="mt-3 h-64"
                                data={providerVolumeChartData}
                                index="Provider"
                                categories={['Calls', 'Failures']}
                                colors={['blue', 'rose']}
                                layout="horizontal"
                                yAxisWidth={48}
                                valueFormatter={(value) => formatCallCount(value)}
                                showTooltip
                                showLegend
                                customTooltip={ProviderBreakdownTooltip}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No provider breakdown in this filter set.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <Title>Provider share</Title>
                                <Subtitle>
                                    {selectedProviderShare
                                        ? `Model split inside ${getAiProviderMetadata(selectedProviderShare).shortName}. Click a slice for details.`
                                        : 'Distribution of total call volume. Click a provider slice to drill down.'}
                                </Subtitle>
                            </div>

                            {selectedProviderShare && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedProviderShare(null);
                                        setSelectedModelShare(null);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    <ArrowLeft size={13} />
                                    Providers
                                </button>
                            )}
                        </div>

                        {providerShareDonutData.length > 0 ? (
                            <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,250px)]">
                                <DonutChart
                                    className="h-64"
                                    data={providerShareDonutData}
                                    index="Segment"
                                    category="Calls"
                                    label={selectedProviderShare ? `${getAiProviderMetadata(selectedProviderShare).shortName} models` : 'Providers'}
                                    valueFormatter={(value) => formatCallCount(value)}
                                    colors={providerShareDonutColors}
                                    showTooltip
                                    onValueChange={handleProviderShareSliceSelect}
                                />

                                <div className="space-y-2">
                                    <Text className="text-xs uppercase tracking-[0.1em] text-slate-500">
                                        {selectedProviderShare ? 'Model legend' : 'Provider legend'}
                                    </Text>

                                    <div className="space-y-1.5">
                                        {activeDonutEntries.map((entry) => {
                                            const isSelected = Boolean(
                                                selectedProviderShare &&
                                                selectedModelShare &&
                                                entry.model === selectedModelShare,
                                            );
                                            const isDisabled = !selectedProviderShare && entry.provider === 'other';
                                            const dotClass = DONUT_COLOR_DOT_CLASS[entry.color];
                                            const providerMetadata = getAiProviderMetadata(entry.provider);
                                            const displayLabel = selectedProviderShare
                                                ? entry.label
                                                : (entry.provider === 'other' ? entry.label : providerMetadata.shortName);
                                            return (
                                                <button
                                                    key={entry.key}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    onClick={() => {
                                                        if (!selectedProviderShare) {
                                                            if (entry.provider === 'other') return;
                                                            setSelectedProviderShare(entry.provider);
                                                            setSelectedModelShare(null);
                                                            return;
                                                        }
                                                        if (!entry.model) {
                                                            setSelectedModelShare(null);
                                                            return;
                                                        }
                                                        setSelectedModelShare((current) => (current === entry.model ? null : entry.model));
                                                    }}
                                                    className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition ${
                                                        isSelected
                                                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                                    } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
                                                        {entry.provider !== 'other' && (
                                                            <AiProviderLogo provider={entry.provider} size={12} />
                                                        )}
                                                        <span className="truncate">{displayLabel}</span>
                                                    </span>
                                                    <span className="ml-2 shrink-0 text-slate-500">
                                                        {entry.calls.toLocaleString()} • {formatPercent(entry.sharePercent)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No provider-share data in this filter set.</Text>
                        )}

                        {selectedProviderStats && (
                            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                <p className="font-semibold text-slate-900">
                                    Provider details: <ProviderLabel provider={selectedProviderStats.provider} providerClassName="font-bold text-slate-900" logoSize={12} />
                                </p>
                                <p className="mt-1">
                                    Calls {selectedProviderStats.total.toLocaleString()} • Success {formatPercent(
                                        selectedProviderStats.total > 0
                                            ? (selectedProviderStats.success / selectedProviderStats.total) * 100
                                            : null,
                                    )} • Avg duration {formatDuration(selectedProviderStats.averageLatencyMs)} • Total cost {formatUsd(selectedProviderStats.totalCostUsd)}
                                </p>
                            </div>
                        )}

                        {selectedModelStats && (
                            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                                <p className="font-semibold">
                                    Model details: <ProviderLabel provider={selectedModelStats.provider} model={selectedModelStats.model} providerClassName="text-blue-900" modelClassName="text-blue-800" logoSize={12} />
                                </p>
                                <p className="mt-1">
                                    Calls {selectedModelStats.total.toLocaleString()} • Success {formatPercent(selectedModelStats.successRate)} • Avg duration {formatDuration(selectedModelStats.averageLatencyMs)} • Avg cost {formatUsd(selectedModelStats.averageCostUsd)}
                                </p>
                            </div>
                        )}
                    </AdminSurfaceCard>
                </section>

                <section className="grid gap-3 lg:grid-cols-3">
                    <AdminSurfaceCard>
                        <Title>Provider success rate</Title>
                        <Subtitle>Top providers by successful call ratio.</Subtitle>
                        {providerSuccessRateChartData.length > 0 ? (
                            <BarChart
                                className="mt-3 h-56"
                                data={providerSuccessRateChartData}
                                index="Provider"
                                categories={['Success rate']}
                                colors={['emerald']}
                                yAxisWidth={56}
                                minValue={0}
                                maxValue={100}
                                valueFormatter={(value) => formatPercent(value)}
                                showTooltip
                                showLegend
                                customTooltip={ProviderSuccessRateTooltip}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No provider success-rate data available.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Provider cost per success</Title>
                        <Subtitle>Average estimated cost per successful call.</Subtitle>
                        {providerCostPerSuccessChartData.length > 0 ? (
                            <BarChart
                                className="mt-3 h-56"
                                data={providerCostPerSuccessChartData}
                                index="Provider"
                                categories={['Avg cost / success (USD)']}
                                colors={['violet']}
                                layout="horizontal"
                                yAxisWidth={64}
                                valueFormatter={(value) => formatUsd(value)}
                                showTooltip
                                showLegend
                                customTooltip={ProviderCostPerSuccessTooltip}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No provider cost-per-success data available.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Top failure codes</Title>
                        <Subtitle>Most frequent recent error categories.</Subtitle>
                        {failureCodeBarListData.length > 0 ? (
                            <BarList
                                className="mt-3"
                                data={failureCodeBarListData}
                                sortOrder="descending"
                                valueFormatter={(value) => formatCallCount(value)}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No recent failures in the selected filter scope.</Text>
                        )}
                    </AdminSurfaceCard>
                </section>

                <section className="grid gap-3 lg:grid-cols-2">
                    <AdminSurfaceCard>
                        <Title>Model call volume</Title>
                        <Subtitle>Most active provider/model combinations.</Subtitle>
                        {modelVolumeBarListData.length > 0 ? (
                            <BarList
                                className="mt-3"
                                data={modelVolumeBarListData}
                                sortOrder="descending"
                                valueFormatter={(value) => formatCallCount(value)}
                            />
                        ) : (
                            <Text className="mt-3 text-xs text-slate-500">No model activity data in this filter set.</Text>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard>
                        <Title>Recent calls</Title>
                        <Subtitle>Latest rows with status, duration, and error code.</Subtitle>

                        <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                            <table className="min-w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 uppercase tracking-wide text-slate-500">
                                        <th className="px-2 py-1.5">Time</th>
                                        <th className="px-2 py-1.5">Model</th>
                                        <th className="px-2 py-1.5">Status</th>
                                        <th className="px-2 py-1.5">Duration</th>
                                        <th className="px-2 py-1.5">Cost</th>
                                        <th className="px-2 py-1.5">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {telemetryRecent.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                                                {telemetryLoading ? 'Loading telemetry...' : 'No telemetry rows yet.'}
                                            </td>
                                        </tr>
                                    )}

                                    {telemetryRecent.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100">
                                            <td className="px-2 py-1.5 text-slate-600">{formatTimestamp(row.created_at)}</td>
                                            <td className="px-2 py-1.5 text-slate-800">
                                                <ProviderLabel provider={row.provider} model={row.model} logoSize={13} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <span className={row.status === 'success' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-slate-700">{formatDuration(row.latency_ms)}</td>
                                            <td className="px-2 py-1.5 text-slate-700">{formatUsd(row.estimated_cost_usd)}</td>
                                            <td className="px-2 py-1.5 text-slate-600">{row.error_code || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </AdminSurfaceCard>
                </section>
            </div>
        </AdminShell>
    );
};
