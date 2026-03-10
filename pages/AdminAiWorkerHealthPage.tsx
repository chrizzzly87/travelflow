import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import {
    adminGetAiWorkerHealth,
    type AdminAsyncWorkerHealthCheckRecord,
    type AdminAsyncWorkerHealthResponse,
    type AdminAsyncWorkerHealthStatus,
} from '../services/adminService';

const formatTimestamp = (value?: string | null): string => {
    if (!value) return '—';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return '—';
    return new Date(parsed).toLocaleString();
};

const formatDuration = (value?: number | null): string => {
    if (!Number.isFinite(value)) return '—';
    const normalized = Number(value);
    if (normalized < 1000) return `${Math.round(normalized)} ms`;
    if (normalized < 60_000) return `${(normalized / 1000).toFixed(1)} s`;
    return `${(normalized / 60_000).toFixed(1)} min`;
};

const formatDispatchStatus = (row: AdminAsyncWorkerHealthCheckRecord): string => {
    if (!row.dispatchAttempted) return 'No dispatch';
    if (!Number.isFinite(row.dispatchHttpStatus)) return 'Triggered';
    return `HTTP ${Math.round(Number(row.dispatchHttpStatus))}`;
};

const STATUS_META: Record<AdminAsyncWorkerHealthStatus, { label: string; className: string }> = {
    ok: {
        label: 'Healthy',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    warning: {
        label: 'Warning',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    failed: {
        label: 'Failed',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
    },
};

const StatusBadge: React.FC<{
    status: AdminAsyncWorkerHealthStatus;
}> = ({ status }) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_META[status].className}`}>
        {STATUS_META[status].label}
    </span>
);

const SummaryCard: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
}> = ({ label, value, hint }) => (
    <AdminSurfaceCard className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <div className="text-2xl font-black tracking-tight text-slate-900">{value}</div>
        {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
    </AdminSurfaceCard>
);

export const AdminAiWorkerHealthPage: React.FC = () => {
    const [data, setData] = useState<AdminAsyncWorkerHealthResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadWorkerHealth = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await adminGetAiWorkerHealth({ limit: 25 });
            setData(next);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load worker health.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadWorkerHealth();
    }, [loadWorkerHealth]);

    const summary = data?.summary || null;
    const checks = data?.checks || [];

    return (
        <AdminShell
            title="Worker Health"
            description="Operational heartbeat for async trip generation. Use this to spot stale queued jobs, recent self-heals, and canary regressions before user trips pile up."
            actions={(
                <div className="flex items-center gap-2">
                    <Link
                        to="/admin/ai-benchmark/telemetry"
                        className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                    >
                        Open AI Telemetry
                    </Link>
                    <AdminReloadButton onClick={() => void loadWorkerHealth()} isLoading={loading} label="Reload health" />
                </div>
            )}
        >
            <div className="space-y-5">
                {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <SummaryCard
                        label="Overall status"
                        value={summary ? <StatusBadge status={summary.overallStatus} /> : '—'}
                        hint={summary?.statusReason || (loading ? 'Loading worker status...' : 'No worker health rows yet.')}
                    />
                    <SummaryCard
                        label="Last heartbeat"
                        value={summary ? formatTimestamp(summary.lastHeartbeatAt) : '—'}
                        hint={summary?.heartbeatFresh ? 'Cron heartbeat is fresh.' : 'Cron heartbeat is stale or missing.'}
                    />
                    <SummaryCard
                        label="Stale queued jobs"
                        value={summary ? summary.staleQueuedCount.toLocaleString() : '—'}
                        hint={summary?.oldestQueuedAgeMs != null ? `Oldest queued age: ${formatDuration(summary.oldestQueuedAgeMs)}` : 'No stale queued jobs recorded in the latest heartbeat.'}
                    />
                    <SummaryCard
                        label="Last self-heal"
                        value={summary?.lastSelfHealStatus ? <StatusBadge status={summary.lastSelfHealStatus} /> : '—'}
                        hint={summary?.lastSelfHealAt ? formatTimestamp(summary.lastSelfHealAt) : 'No bounded re-kick recorded yet.'}
                    />
                    <SummaryCard
                        label="Last canary"
                        value={summary?.lastCanaryStatus ? <StatusBadge status={summary.lastCanaryStatus} /> : '—'}
                        hint={summary?.lastCanaryAt ? formatTimestamp(summary.lastCanaryAt) : 'No canary run recorded yet.'}
                    />
                    <SummaryCard
                        label="Canary latency"
                        value={summary ? formatDuration(summary.lastCanaryLatencyMs) : '—'}
                        hint={summary?.canaryDue ? 'Another canary is due soon.' : 'Recent successful canary is still within the target window.'}
                    />
                </div>

                <AdminSurfaceCard className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Recent checks</h2>
                            <p className="text-sm text-slate-500">Newest rows first. Heartbeats show cron health, watchdog rows capture stale-queue incidents, and canaries prove the drain path end to end.</p>
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {checks.length.toLocaleString()} rows
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                    <th className="px-3 py-2">Type</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">Started</th>
                                    <th className="px-3 py-2">Stale queued</th>
                                    <th className="px-3 py-2">Dispatch</th>
                                    <th className="px-3 py-2">Failure</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {checks.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                                            {loading ? 'Loading worker health...' : 'No worker health rows yet.'}
                                        </td>
                                    </tr>
                                ) : checks.map((row) => (
                                    <tr key={row.id} className="align-top">
                                        <td className="px-3 py-3 font-semibold capitalize text-slate-900">{row.checkType}</td>
                                        <td className="px-3 py-3"><StatusBadge status={row.status} /></td>
                                        <td className="px-3 py-3 text-slate-700">
                                            <div>{formatTimestamp(row.startedAt)}</div>
                                            <div className="text-xs text-slate-500">
                                                Finished: {formatTimestamp(row.finishedAt)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-slate-700">
                                            <div>{row.staleQueuedCount.toLocaleString()}</div>
                                            <div className="text-xs text-slate-500">
                                                Oldest: {formatDuration(row.oldestQueuedAgeMs)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-slate-700">
                                            <div>{formatDispatchStatus(row)}</div>
                                            {row.canaryLatencyMs != null ? (
                                                <div className="text-xs text-slate-500">
                                                    Canary latency: {formatDuration(row.canaryLatencyMs)}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-3 text-slate-700">
                                            <div>{row.failureCode || '—'}</div>
                                            <div className="max-w-[340px] text-xs text-slate-500">
                                                {row.failureMessage || 'No failure recorded.'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
