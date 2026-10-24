import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { AdminBarList, type AdminBarListItem } from '../components/admin/AdminBarList';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminBarChart } from '../components/admin/AdminBarChart';
import { Button } from '../components/ui/button';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    chartColor,
    type ChartConfig,
} from '../components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';
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

// Tremor colour names from the chart-data service, as fills. The matching `bg-*-500`
// classes above make Tailwind emit these theme variables.
const DONUT_COLOR_FILL: Record<TelemetryDonutColor, string> = {
    blue: 'var(--color-blue-500)',
    cyan: 'var(--color-cyan-500)',
    indigo: 'var(--color-indigo-500)',
    violet: 'var(--color-violet-500)',
    fuchsia: 'var(--color-fuchsia-500)',
    rose: 'var(--color-rose-500)',
    emerald: 'var(--color-emerald-500)',
    amber: 'var(--color-amber-500)',
};

const CALL_TREND_COLORS = { Success: 'var(--chart-2)', Failed: 'var(--chart-5)' } as const;
const PROVIDER_VOLUME_COLORS = { Calls: 'var(--chart-1)', Failures: 'var(--chart-5)' } as const;
const PROVIDER_SUCCESS_COLORS = { 'Success rate': 'var(--chart-2)' } as const;

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

const compactModelLabelNode = (provider: string, model: string): React.ReactNode => {
    const metadata = getAiProviderMetadata(provider);
    return (
        <span className="inline-flex min-w-0 max-w-[270px] items-center gap-1.5">
            <AiProviderLogo provider={provider} model={model} size={12} />
            <span className="truncate text-foreground" title={`${metadata.shortName} / ${model}`}>
                {metadata.shortName} / {model}
            </span>
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

interface TelemetrySeriesChartProps<TDatum extends Record<string, unknown>> {
    data: TDatum[];
    index: keyof TDatum & string;
    category: keyof TDatum & string;
    kind: 'area' | 'bar';
    color: string;
    valueFormatter: (value: number) => string;
    tickFormatter?: (value: number) => string;
    indexFormatter?: (value: unknown) => string;
    domain?: [number, number];
    yAxisWidth?: number;
    className?: string;
    ariaLabel: string;
}

/**
 * One series over a category axis, for values `AdminBarChart` cannot scale: its y axis
 * only draws whole-number ticks, which flattens sub-cent costs and fractional seconds.
 */
const TelemetrySeriesChart = <TDatum extends Record<string, unknown>>({
    data,
    index,
    category,
    kind,
    color,
    valueFormatter,
    tickFormatter,
    indexFormatter,
    domain,
    yAxisWidth = 56,
    className,
    ariaLabel,
}: TelemetrySeriesChartProps<TDatum>) => {
    const config = useMemo<ChartConfig>(() => ({ [category]: { label: category, color } }), [category, color]);
    const gradientId = `telemetry-fill-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;
    return (
        <ChartContainer config={config} className={cn('aspect-auto h-56 w-full', className)} role="img" aria-label={ariaLabel}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartColor(category)} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={chartColor(category)} stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey={index} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={indexFormatter} />
                <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    width={yAxisWidth}
                    domain={domain}
                    tickFormatter={tickFormatter ?? valueFormatter}
                />
                <ChartTooltip
                    cursor={kind === 'bar' ? { fillOpacity: 0.6 } : true}
                    content={(
                        <ChartTooltipContent
                            labelFormatter={indexFormatter ? (label) => indexFormatter(label) : undefined}
                            valueFormatter={(value) => valueFormatter(Number(value))}
                        />
                    )}
                />
                {kind === 'area'
                    ? (
                        <Area
                            dataKey={category}
                            type="monotone"
                            stroke={chartColor(category)}
                            strokeWidth={2}
                            fill={`url(#${gradientId})`}
                            connectNulls
                            isAnimationActive={false}
                        />
                    )
                    : (
                        <Bar
                            dataKey={category}
                            fill={chartColor(category)}
                            radius={[3, 3, 0, 0]}
                            maxBarSize={32}
                            isAnimationActive={false}
                        />
                    )}
            </ComposedChart>
        </ChartContainer>
    );
};

const TelemetryEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AdminEmptyState className="py-6" title={children} />
);

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
    const [telemetryCommentTotal, setTelemetryCommentTotal] = useState(0);
    const [telemetryCommentGroups, setTelemetryCommentGroups] = useState<AiTelemetryRunCommentGroup[]>([]);
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
            setTelemetryCommentTotal(Number(payload.comments?.total) || 0);
            setTelemetryCommentGroups(Array.isArray(payload.comments?.groups) ? payload.comments?.groups : []);
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
            setTelemetryCommentTotal(0);
            setTelemetryCommentGroups([]);
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
        return Array.from(successfulModels)
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
        // Keep the ISO day; the axis formats it locally (see formatIsoDayTick).
        return monthlyCostHistorySeries.map((point) => ({
            Date: point.date,
            'Cost (USD)': point.cost,
        }));
    }, [monthlyCostHistorySeries]);

    const currentMonthCostTotal = useMemo(() => {
        return monthlyCostHistorySeries.reduce((sum, item) => sum + item.cost, 0);
    }, [monthlyCostHistorySeries]);

    const providerVolumeChartData = useMemo(() => {
        return Array.from(telemetryProviders)
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
            key: entry.key,
            Segment: selectedProviderShare
                ? entry.label
                : (entry.provider === 'other' ? entry.label : getAiProviderMetadata(entry.provider).shortName),
            Calls: entry.calls,
            provider: entry.provider,
            model: entry.model,
        }));
    }, [activeDonutEntries, selectedProviderShare]);

    const providerShareChartConfig = useMemo<ChartConfig>(
        () => Object.fromEntries(activeDonutEntries.map((entry) => [
            entry.key,
            { label: entry.label, color: DONUT_COLOR_FILL[entry.color] },
        ])),
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
        return Array.from(telemetryModels)
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
            title="AI telemetry"
            description="Latency, reliability and cost across benchmark and runtime AI calls."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <AdminReloadButton onClick={() => void loadTelemetry()} isLoading={telemetryLoading} />
            )}
        >
            <div className="flex flex-col gap-4">
                {telemetryError && <AdminErrorAlert title="Could not load AI telemetry" message={telemetryError} />}

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader title="Filters" description="Scope every chart and ranking below." />

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">Window</span>
                            <Select value={String(telemetryWindowHours)} onValueChange={(value) => setTelemetryWindowHours(Number(value))}>
                                <SelectTrigger className="h-9 text-sm" aria-label="Window">
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

                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">Source</span>
                            <Select value={telemetrySource} onValueChange={(value) => setTelemetrySource(value as TelemetrySourceFilter)}>
                                <SelectTrigger className="h-9 text-sm" aria-label="Source">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All sources</SelectItem>
                                    <SelectItem value="create_trip">Create-trip runtime</SelectItem>
                                    <SelectItem value="benchmark">Benchmark runs</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">Provider</span>
                            <Select value={telemetryProviderFilter} onValueChange={setTelemetryProviderFilter}>
                                <SelectTrigger className="h-9 text-sm" aria-label="Provider">
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
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">Ranking size</span>
                            <Select value={String(rankLimit)} onValueChange={(value) => setRankLimit(Number(value))}>
                                <SelectTrigger className="h-9 text-sm" aria-label="Ranking size">
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
                    </div>
                </AdminSurfaceCard>

                {/* Five KPIs read as one row on wide screens, so this grid goes to five columns. */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <AdminStatCard
                        label="Total calls"
                        value={telemetrySummary ? telemetrySummary.total.toLocaleString() : '—'}
                        hint="Selected filter scope"
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Success rate"
                        value={telemetrySummary ? formatPercent(telemetrySummary.successRate) : '—'}
                        hint={`Failed: ${telemetrySummary ? telemetrySummary.failed.toLocaleString() : '—'}`}
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Failure rate"
                        value={formatPercent(failureRate)}
                        hint="Quick reliability read"
                        hintTone={failureRate !== null && failureRate > 0 ? 'warning' : 'neutral'}
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Avg duration"
                        value={telemetrySummary ? formatDuration(telemetrySummary.averageLatencyMs) : '—'}
                        hint="Across all calls"
                        isLoading={telemetryLoading}
                    />
                    <AdminStatCard
                        label="Total cost (est.)"
                        value={telemetrySummary ? formatUsd(telemetrySummary.totalCostUsd) : '—'}
                        hint={`Models with success: ${formatPercent(successfulModelCoverage)}`}
                        isLoading={telemetryLoading}
                    />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Top models by speed" description="Only models with successful calls are listed." />
                        {fastestBarListData.length > 0 ? (
                            <AdminBarList
                                color="var(--chart-1)"
                                items={fastestBarListData}
                                sortOrder="ascending"
                                valueFormatter={(value) => formatDuration(value)}
                                ariaLabel="Fastest models by average duration"
                            />
                        ) : (
                            <TelemetryEmpty>No successful speed data</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Top models by cost" description="Average cost per successful call." />
                        {cheapestBarListData.length > 0 ? (
                            <AdminBarList
                                color="var(--chart-1)"
                                items={cheapestBarListData}
                                sortOrder="ascending"
                                valueFormatter={(value) => formatUsd(value)}
                                ariaLabel="Cheapest models by average cost"
                            />
                        ) : (
                            <TelemetryEmpty>No successful cost data</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Top models by value" description="Lower cost per second is better." />
                        {bestValueBarListData.length > 0 ? (
                            <AdminBarList
                                color="var(--chart-1)"
                                items={bestValueBarListData}
                                sortOrder="ascending"
                                valueFormatter={(value) => `${formatUsd(value)} / sec`}
                                ariaLabel="Best-value models by cost per second"
                            />
                        ) : (
                            <TelemetryEmpty>No successful value data</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Top models by success rate" description="Success-rate leaderboard." />
                        {successRateBarListData.length > 0 ? (
                            <AdminBarList
                                items={successRateBarListData}
                                sortOrder="descending"
                                valueFormatter={(value) => formatPercent(value)}
                                color="var(--chart-2)"
                                ariaLabel="Models by success rate"
                            />
                        ) : (
                            <TelemetryEmpty>No success-rate data</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Call trend" description="Successful and failed calls across the selected window." />
                        {callsTrendChartData.length > 0 ? (
                            <AdminBarChart
                                data={callsTrendChartData}
                                index="Time"
                                categories={['Success', 'Failed']}
                                colors={CALL_TREND_COLORS}
                                stacked
                                ariaLabel="Stacked bar chart of successful and failed calls per time bucket"
                            />
                        ) : (
                            <TelemetryEmpty>No time-series call data for this filter set</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Success-rate trend" description="Share of successful calls per bucket." />
                        {successRateTrendChartData.length > 0 ? (
                            <TelemetrySeriesChart
                                kind="area"
                                className="h-64"
                                data={successRateTrendChartData}
                                index="Time"
                                category="Success rate"
                                color="var(--chart-1)"
                                domain={[0, 100]}
                                valueFormatter={(value) => formatPercent(value)}
                                tickFormatter={(value) => `${value}%`}
                                yAxisWidth={44}
                                ariaLabel="Area chart of success rate per time bucket"
                            />
                        ) : (
                            <TelemetryEmpty>No success-rate trend data for this filter set</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Latency trend" description="Average latency per bucket." />
                        {latencyTrendChartData.length > 0 ? (
                            <TelemetrySeriesChart
                                kind="area"
                                data={latencyTrendChartData}
                                index="Time"
                                category="Avg latency (ms)"
                                color="var(--chart-4)"
                                valueFormatter={(value) => formatDuration(value)}
                                ariaLabel="Area chart of average latency per time bucket"
                            />
                        ) : (
                            <TelemetryEmpty>No latency trend data for this filter set</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Cost trend" description="Total estimated cost per bucket." />
                        {costTrendChartData.length > 0 ? (
                            <TelemetrySeriesChart
                                kind="area"
                                data={costTrendChartData}
                                index="Time"
                                category="Total cost (USD)"
                                color="var(--chart-3)"
                                valueFormatter={(value) => formatUsd(value)}
                                tickFormatter={formatUsdTick}
                                yAxisWidth={64}
                                ariaLabel="Area chart of total estimated cost per time bucket"
                            />
                        ) : (
                            <TelemetryEmpty>No cost trend data for this filter set</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>
                </div>

                <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                    <AdminSectionHeader
                        title="Cost per day this month"
                        description="Daily API cost for the current calendar month."
                        actions={(
                            <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                                {formatUsd(currentMonthCostTotal)}
                            </span>
                        )}
                    />
                    {monthlyCostChartData.length > 0 ? (
                        <TelemetrySeriesChart
                            kind="bar"
                            data={monthlyCostChartData}
                            index="Date"
                            category="Cost (USD)"
                            color="var(--chart-2)"
                            valueFormatter={(value) => formatUsd(value)}
                            tickFormatter={formatUsdTick}
                            indexFormatter={formatIsoDayTick}
                            yAxisWidth={64}
                            ariaLabel="Bar chart of API cost per day this month"
                        />
                    ) : (
                        <TelemetryEmpty>No cost data available for the current month</TelemetryEmpty>
                    )}
                </AdminSurfaceCard>

                <div className="grid gap-4 lg:grid-cols-2">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Provider breakdown" description="Calls and failures by provider." />
                        {providerVolumeChartData.length > 0 ? (
                            <AdminBarChart
                                data={providerVolumeChartData}
                                index="Provider"
                                categories={['Calls', 'Failures']}
                                colors={PROVIDER_VOLUME_COLORS}
                                ariaLabel="Bar chart of calls and failures by provider"
                            />
                        ) : (
                            <TelemetryEmpty>No provider breakdown in this filter set</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader
                            title="Provider share"
                            description={selectedProviderShare
                                ? `Model split inside ${getAiProviderMetadata(selectedProviderShare).shortName}. Pick a model for details.`
                                : 'Share of total call volume. Pick a provider to drill down.'}
                            actions={selectedProviderShare ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedProviderShare(null);
                                        setSelectedModelShare(null);
                                    }}
                                >
                                    <ArrowLeft className="rtl:rotate-180" />
                                    Providers
                                </Button>
                            ) : null}
                        />

                        {providerShareDonutData.length > 0 ? (
                            <div className="grid items-center gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,250px)]">
                                <ChartContainer
                                    config={providerShareChartConfig}
                                    className="mx-auto aspect-square h-64 max-w-full"
                                    role="img"
                                    aria-label={selectedProviderShare
                                        ? `Donut chart of call share by model inside ${getAiProviderMetadata(selectedProviderShare).shortName}`
                                        : 'Donut chart of call share by provider'}
                                >
                                    <PieChart>
                                        <ChartTooltip
                                            content={<ChartTooltipContent hideLabel valueFormatter={(value) => formatCallCount(Number(value))} />}
                                        />
                                        <Pie
                                            data={providerShareDonutData}
                                            dataKey="Calls"
                                            nameKey="Segment"
                                            innerRadius="58%"
                                            outerRadius="85%"
                                            paddingAngle={1}
                                            strokeWidth={0}
                                            isAnimationActive={false}
                                            onClick={(_, sliceIndex) => handleProviderShareSliceSelect(providerShareDonutData[sliceIndex])}
                                        >
                                            {providerShareDonutData.map((entry) => (
                                                <Cell
                                                    key={entry.key}
                                                    fill={chartColor(entry.key)}
                                                    fillOpacity={selectedModelShare && entry.model !== selectedModelShare ? 0.35 : 1}
                                                    className={entry.provider === 'other' && !selectedProviderShare ? undefined : 'cursor-pointer'}
                                                />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ChartContainer>

                                <div className="flex flex-col gap-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {selectedProviderShare ? 'Models' : 'Providers'}
                                    </p>

                                    <div className="flex flex-col gap-1.5">
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
                                                // A whole-row toggle, so a plain button rather than `Button`.
                                                <button
                                                    key={entry.key}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    aria-pressed={selectedProviderShare ? isSelected : undefined}
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
                                                    className={cn(
                                                        'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-start text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                                        isSelected
                                                            ? 'border-accent-300 bg-accent-50 text-accent-900 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200'
                                                            : 'border-border bg-card text-foreground hover:bg-secondary',
                                                        isDisabled && 'cursor-not-allowed opacity-60 hover:bg-card',
                                                    )}
                                                >
                                                    <span className="inline-flex min-w-0 items-center gap-2">
                                                        <span className={cn('size-2.5 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
                                                        {entry.provider !== 'other' && (
                                                            <AiProviderLogo provider={entry.provider} size={12} />
                                                        )}
                                                        <span className="truncate">{displayLabel}</span>
                                                    </span>
                                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                                        {entry.calls.toLocaleString()} · {formatPercent(entry.sharePercent)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <TelemetryEmpty>No provider-share data in this filter set</TelemetryEmpty>
                        )}

                        {selectedProviderStats && (
                            <div className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-foreground">
                                <p className="font-medium text-foreground">
                                    Provider details: <ProviderLabel provider={selectedProviderStats.provider} providerClassName="font-semibold text-foreground" logoSize={12} />
                                </p>
                                <p className="mt-1 tabular-nums">
                                    Calls {selectedProviderStats.total.toLocaleString()} · Success {formatPercent(
                                        selectedProviderStats.total > 0
                                            ? (selectedProviderStats.success / selectedProviderStats.total) * 100
                                            : null,
                                    )} · Avg duration {formatDuration(selectedProviderStats.averageLatencyMs)} · Total cost {formatUsd(selectedProviderStats.totalCostUsd)}
                                </p>
                            </div>
                        )}

                        {selectedModelStats && (
                            <div className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-900 dark:border-accent-400/30 dark:bg-accent-400/12 dark:text-accent-200">
                                <p className="font-medium">
                                    Model details: <ProviderLabel provider={selectedModelStats.provider} model={selectedModelStats.model} providerClassName="text-accent-900 dark:text-accent-200" modelClassName="text-accent-800 dark:text-accent-200" logoSize={12} />
                                </p>
                                <p className="mt-1 tabular-nums">
                                    Calls {selectedModelStats.total.toLocaleString()} · Success {formatPercent(selectedModelStats.successRate)} · Avg duration {formatDuration(selectedModelStats.averageLatencyMs)} · Avg cost {formatUsd(selectedModelStats.averageCostUsd)}
                                </p>
                            </div>
                        )}
                    </AdminSurfaceCard>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Provider success rate" description="Top providers by successful call ratio." />
                        {providerSuccessRateChartData.length > 0 ? (
                            <AdminBarChart
                                data={providerSuccessRateChartData}
                                index="Provider"
                                categories={['Success rate']}
                                colors={PROVIDER_SUCCESS_COLORS}
                                layout="vertical"
                                valueFormatter={(value) => formatPercent(value)}
                                className="h-56"
                                ariaLabel="Bar chart of success rate by provider"
                            />
                        ) : (
                            <TelemetryEmpty>No provider success-rate data available</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Provider cost per success" description="Average estimated cost per successful call." />
                        {providerCostPerSuccessChartData.length > 0 ? (
                            <TelemetrySeriesChart
                                kind="bar"
                                data={providerCostPerSuccessChartData}
                                index="Provider"
                                category="Avg cost / success (USD)"
                                color="var(--chart-4)"
                                valueFormatter={(value) => formatUsd(value)}
                                tickFormatter={formatUsdTick}
                                yAxisWidth={64}
                                ariaLabel="Bar chart of average cost per successful call by provider"
                            />
                        ) : (
                            <TelemetryEmpty>No provider cost-per-success data available</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Top failure codes" description="Most frequent recent error categories." />
                        {failureCodeBarListData.length > 0 ? (
                            <AdminBarList
                                items={failureCodeBarListData.map((row) => ({
                                    key: row.key,
                                    label: <span className="font-mono text-xs text-foreground">{row.name}</span>,
                                    value: row.value,
                                }))}
                                sortOrder="descending"
                                valueFormatter={(value) => formatCallCount(value)}
                                color="var(--chart-5)"
                                ariaLabel="Recent failures by error code"
                            />
                        ) : (
                            <TelemetryEmpty>No recent failures in the selected filter scope</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-4">
                        <AdminSectionHeader title="Model call volume" description="Most active provider and model combinations." />
                        {modelVolumeBarListData.length > 0 ? (
                            <AdminBarList
                                color="var(--chart-1)"
                                items={modelVolumeBarListData}
                                sortOrder="descending"
                                valueFormatter={(value) => formatCallCount(value)}
                                ariaLabel="Models by call volume"
                            />
                        ) : (
                            <TelemetryEmpty>No model activity data in this filter set</TelemetryEmpty>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-3 p-0">
                        <AdminSectionHeader
                            className="px-4 pt-4"
                            title="Recent calls"
                            description="Latest rows with status, duration and error code."
                        />

                        <div className="max-h-80 overflow-y-auto border-t border-border">
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
                                    {telemetryRecent.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                {telemetryLoading ? 'Loading telemetry…' : 'No telemetry rows yet.'}
                                            </TableCell>
                                        </TableRow>
                                    )}

                                    {telemetryRecent.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-muted/50">
                                            <TableCell className="ps-4 tabular-nums text-muted-foreground">{formatTimestamp(row.created_at)}</TableCell>
                                            <TableCell className="max-w-[220px] truncate text-foreground">
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
                    </AdminSurfaceCard>
                </div>

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Benchmark run comments"
                        description="Notes captured per run, grouped by provider and model in the current window."
                        actions={(
                            <span className="text-sm tabular-nums text-muted-foreground">
                                {telemetryCommentTotal.toLocaleString()} {telemetryCommentTotal === 1 ? 'comment' : 'comments'}
                            </span>
                        )}
                    />

                    {telemetryCommentGroups.length === 0 ? (
                        <TelemetryEmpty>
                            {telemetryLoading ? 'Loading comments…' : 'No benchmark run comments in this filter window'}
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
                                        Latest: {formatTimestamp(group.latestCommentAt)}
                                    </p>

                                    <div className="mt-2 flex flex-col gap-2">
                                        {group.comments.map((comment) => (
                                            <div key={`${group.key}-${comment.runId}-${comment.updatedAt}`} className="rounded-md bg-secondary px-2.5 py-2 text-xs">
                                                <p className="whitespace-pre-wrap break-words text-foreground">{comment.comment}</p>
                                                <p className="mt-1 text-[11px] text-muted-foreground">
                                                    Run {comment.runId.slice(0, 8)} · {comment.status || 'unknown'} · {comment.satisfactionRating || 'unrated'} · {formatTimestamp(comment.updatedAt)}
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
