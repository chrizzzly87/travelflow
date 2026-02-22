import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { AreaChart, BarChart } from '@tremor/react';
import { AdminShell } from '../components/admin/AdminShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { dbGetAccessToken, ensureDbSession } from '../services/dbService';
import { useAuth } from '../hooks/useAuth';

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
    const [telemetryProviders, setTelemetryProviders] = useState<AiTelemetryProviderPoint[]>([]);
    const [telemetryModels, setTelemetryModels] = useState<AiTelemetryModelPoint[]>([]);
    const [telemetryRecent, setTelemetryRecent] = useState<AiTelemetryRecentRow[]>([]);
    const [telemetryProviderOptions, setTelemetryProviderOptions] = useState<string[]>([]);
    const [fastestModels, setFastestModels] = useState<AiTelemetryModelPoint[]>([]);
    const [cheapestModels, setCheapestModels] = useState<AiTelemetryModelPoint[]>([]);
    const [bestValueModels, setBestValueModels] = useState<AiTelemetryModelPoint[]>([]);

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
            setTelemetryProviders(Array.isArray(payload.providers) ? payload.providers : []);
            setTelemetryModels(Array.isArray(payload.models) ? payload.models : []);
            setTelemetryRecent(Array.isArray(payload.recent) ? payload.recent : []);
            setFastestModels(Array.isArray(payload.rankings?.fastest) ? payload.rankings?.fastest : []);
            setCheapestModels(Array.isArray(payload.rankings?.cheapest) ? payload.rankings?.cheapest : []);
            setBestValueModels(Array.isArray(payload.rankings?.bestValue) ? payload.rankings?.bestValue : []);

            const providerOptions = Array.isArray(payload.availableProviders) ? payload.availableProviders : [];
            setTelemetryProviderOptions(providerOptions);
            if (telemetryProviderFilter !== 'all' && !providerOptions.includes(telemetryProviderFilter)) {
                setTelemetryProviderFilter('all');
            }
        } catch (telemetryLoadError) {
            setTelemetryError(telemetryLoadError instanceof Error ? telemetryLoadError.message : 'Failed to load AI telemetry');
            setTelemetrySummary(null);
            setTelemetrySeries([]);
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

    const timelineChartData = useMemo(() => {
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

    const providerChartData = useMemo(() => {
        return telemetryProviders.slice(0, 10).map((row) => ({
            Provider: row.provider,
            Calls: row.total,
            Failures: row.failed,
        }));
    }, [telemetryProviders]);

    const modelVolumeChartData = useMemo(() => {
        return telemetryModels.slice(0, 12).map((row) => ({
            Model: `${row.provider}/${row.model}`,
            Calls: row.total,
        }));
    }, [telemetryModels]);

    const limitedFastest = useMemo(() => fastestModels.slice(0, rankLimit), [fastestModels, rankLimit]);
    const limitedCheapest = useMemo(() => cheapestModels.slice(0, rankLimit), [cheapestModels, rankLimit]);
    const limitedBestValue = useMemo(() => bestValueModels.slice(0, rankLimit), [bestValueModels, rankLimit]);

    return (
        <AdminShell
            title="AI Telemetry"
            description="Deep telemetry across create-trip runtime and benchmark execution."
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
            {telemetryError && (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {telemetryError}
                </section>
            )}

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total calls</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{telemetrySummary ? telemetrySummary.total : '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">Success: {telemetrySummary ? telemetrySummary.success : '—'}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Success rate</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{telemetrySummary ? `${telemetrySummary.successRate.toFixed(1)}%` : '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">Failed: {telemetrySummary ? telemetrySummary.failed : '—'}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Average duration</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{telemetrySummary ? formatDuration(telemetrySummary.averageLatencyMs) : '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">Across selected filter window</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total cost (est.)</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{telemetrySummary ? formatUsd(telemetrySummary.totalCostUsd) : '—'}</p>
                    <p className="mt-1 text-xs text-slate-500">Avg/call: {telemetrySummary ? formatUsd(telemetrySummary.averageCostUsd) : '—'}</p>
                </article>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={String(telemetryWindowHours)} onValueChange={(value) => setTelemetryWindowHours(Number(value))}>
                        <SelectTrigger className="h-8 w-[120px] text-xs">
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
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All sources</SelectItem>
                            <SelectItem value="create_trip">Create-trip runtime</SelectItem>
                            <SelectItem value="benchmark">Benchmark runs</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={telemetryProviderFilter} onValueChange={setTelemetryProviderFilter}>
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue placeholder="Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All providers</SelectItem>
                            {telemetryProviderOptions.map((provider) => (
                                <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={String(rankLimit)} onValueChange={(value) => setRankLimit(Number(value))}>
                        <SelectTrigger className="h-8 w-[110px] text-xs">
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
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Top models by average speed</h2>
                    <p className="mt-1 text-xs text-slate-500">Lower average duration is better.</p>
                    <div className="mt-3 space-y-2">
                        {limitedFastest.map((model, index) => (
                            <div key={model.key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-semibold text-slate-800">{index + 1}. {model.provider} / {model.model}</div>
                                <div className="mt-0.5 text-[11px] text-slate-600">
                                    {formatDuration(model.averageLatencyMs)} · {model.successRate.toFixed(1)}% success · {model.total} calls
                                </div>
                            </div>
                        ))}
                        {limitedFastest.length === 0 && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">No model speed data.</div>
                        )}
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Top models by average cost</h2>
                    <p className="mt-1 text-xs text-slate-500">Lower average cost per call is better.</p>
                    <div className="mt-3 space-y-2">
                        {limitedCheapest.map((model, index) => (
                            <div key={model.key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-semibold text-slate-800">{index + 1}. {model.provider} / {model.model}</div>
                                <div className="mt-0.5 text-[11px] text-slate-600">
                                    {formatUsd(model.averageCostUsd)} / call · {model.successRate.toFixed(1)}% success · {model.total} calls
                                </div>
                            </div>
                        ))}
                        {limitedCheapest.length === 0 && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">No model cost data.</div>
                        )}
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Top models by cost/speed ratio</h2>
                    <p className="mt-1 text-xs text-slate-500">Lower USD per second is better value.</p>
                    <div className="mt-3 space-y-2">
                        {limitedBestValue.map((model, index) => (
                            <div key={model.key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="text-xs font-semibold text-slate-800">{index + 1}. {model.provider} / {model.model}</div>
                                <div className="mt-0.5 text-[11px] text-slate-600">
                                    {formatUsd(model.costPerSecondUsd)} / sec · {formatDuration(model.averageLatencyMs)} · {formatUsd(model.averageCostUsd)}
                                </div>
                            </div>
                        ))}
                        {limitedBestValue.length === 0 && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">No model efficiency data.</div>
                        )}
                    </div>
                </article>
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Call trend</h2>
                    <p className="mt-1 text-xs text-slate-500">Success/failure trend in the selected window.</p>
                    {timelineChartData.length > 0 ? (
                        <AreaChart
                            className="mt-3 h-64"
                            data={timelineChartData}
                            index="Time"
                            categories={['Success', 'Failed']}
                            colors={['emerald', 'rose']}
                            yAxisWidth={48}
                        />
                    ) : (
                        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                            No telemetry rows in the selected window.
                        </div>
                    )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Provider breakdown</h2>
                    <p className="mt-1 text-xs text-slate-500">Top providers by call volume and failure count.</p>
                    {providerChartData.length > 0 ? (
                        <BarChart
                            className="mt-3 h-64"
                            data={providerChartData}
                            index="Provider"
                            categories={['Calls', 'Failures']}
                            colors={['sky', 'rose']}
                            yAxisWidth={48}
                        />
                    ) : (
                        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                            No provider data for this filter set.
                        </div>
                    )}
                </article>
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Model call volume</h2>
                    <p className="mt-1 text-xs text-slate-500">Most active provider/model combinations.</p>
                    {modelVolumeChartData.length > 0 ? (
                        <BarChart
                            className="mt-3 h-64"
                            data={modelVolumeChartData}
                            index="Model"
                            categories={['Calls']}
                            colors={['indigo']}
                            yAxisWidth={48}
                        />
                    ) : (
                        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                            No model data in this filter set.
                        </div>
                    )}
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Recent calls</h2>
                    <p className="mt-1 text-xs text-slate-500">Latest request rows with status, duration, and errors.</p>
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
                                            <span className="font-semibold">{row.provider}</span> / {row.model}
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
                </article>
            </section>
        </AdminShell>
    );
};
