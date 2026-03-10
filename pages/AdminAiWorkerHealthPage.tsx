import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, MagnifyingGlass, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import {
    AdminSortHeaderButton,
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    ADMIN_TABLE_SORTED_HEADER_CLASS,
} from '../components/admin/AdminDataTable';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import {
    adminGetAiWorkerHealth,
    type AdminAsyncWorkerHealthCheckRecord,
    type AdminAsyncWorkerHealthCheckType,
    type AdminAsyncWorkerHealthResponse,
    type AdminAsyncWorkerHealthStatus,
} from '../services/adminService';

const WORKER_CHECK_FETCH_LIMIT = 50;
const WORKER_CHECK_PAGE_SIZE = 10;

type WorkerHealthSortColumn = 'checkType' | 'status' | 'startedAt' | 'staleQueuedCount' | 'dispatch' | 'failure';
type WorkerHealthSortDirection = 'asc' | 'desc';

const DEFAULT_SORT_COLUMN: WorkerHealthSortColumn = 'startedAt';
const DEFAULT_SORT_DIRECTION: WorkerHealthSortDirection = 'desc';
const CHECK_TYPE_FILTER_VALUES: readonly AdminAsyncWorkerHealthCheckType[] = ['heartbeat', 'watchdog', 'canary'];
const STATUS_FILTER_VALUES: readonly AdminAsyncWorkerHealthStatus[] = ['ok', 'warning', 'failed'];
const CHECK_TYPE_LABELS: Record<AdminAsyncWorkerHealthCheckType, string> = {
    heartbeat: 'Heartbeat',
    watchdog: 'Watchdog',
    canary: 'Canary',
};
const CHECK_TYPE_ORDER: Record<AdminAsyncWorkerHealthCheckType, number> = {
    heartbeat: 0,
    watchdog: 1,
    canary: 2,
};
const STATUS_ORDER: Record<AdminAsyncWorkerHealthStatus, number> = {
    ok: 0,
    warning: 1,
    failed: 2,
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

const WORKER_HEALTH_TOOLTIPS = {
    overallStatus: 'Combines the latest heartbeat, stale-queue watchdog, and canary signal into one production-readiness badge.',
    heartbeat: 'A heartbeat is the scheduled cron check. Healthy means the scheduler is still running and can reach the async worker dispatcher.',
    staleQueued: 'Counts queued jobs whose run time has already passed and that have still not moved for at least five minutes.',
    selfHeal: 'A self-heal is the watchdog’s bounded re-kick. It only appears when stale queued jobs were detected and the normal worker path was nudged once.',
    canary: 'The canary is a safe synthetic probe. It enqueues an intentionally invalid async job that should fail in a known way, proving queueing, dispatch, worker claim, execution, and terminal writes all work end to end.',
    canaryLatency: 'Canary latency is how long that synthetic probe took to reach a terminal worker result after it was created.',
} as const;

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

const normalizeSearchText = (value: string | null | undefined): string => (
    (value || '').trim().toLowerCase()
);

const getFailureSummary = (row: AdminAsyncWorkerHealthCheckRecord): string => (
    [row.failureCode || '', row.failureMessage || '']
        .filter(Boolean)
        .join(' ')
        .trim()
);

const getWorkerHealthSearchText = (row: AdminAsyncWorkerHealthCheckRecord): string => (
    [
        CHECK_TYPE_LABELS[row.checkType],
        STATUS_META[row.status].label,
        formatDispatchStatus(row),
        row.failureCode || '',
        row.failureMessage || '',
    ]
        .join(' ')
        .toLowerCase()
);

const compareWorkerHealthRows = (
    left: AdminAsyncWorkerHealthCheckRecord,
    right: AdminAsyncWorkerHealthCheckRecord,
    column: WorkerHealthSortColumn,
): number => {
    switch (column) {
    case 'checkType':
        return CHECK_TYPE_ORDER[left.checkType] - CHECK_TYPE_ORDER[right.checkType];
    case 'status':
        return STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    case 'startedAt':
        return Date.parse(left.startedAt) - Date.parse(right.startedAt);
    case 'staleQueuedCount':
        return left.staleQueuedCount - right.staleQueuedCount;
    case 'dispatch':
        return formatDispatchStatus(left).localeCompare(formatDispatchStatus(right));
    case 'failure':
        return getFailureSummary(left).localeCompare(getFailureSummary(right));
    default:
        return 0;
    }
};

const WorkerHealthInfoButton: React.FC<{
    ariaLabel: string;
    tooltip: string;
}> = ({ ariaLabel, tooltip }) => (
    <button
        type="button"
        aria-label={ariaLabel}
        title={tooltip}
        data-tooltip={tooltip}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
    >
        <Info size={12} weight="bold" />
    </button>
);

const WorkerHealthLabel: React.FC<{
    text: string;
    tooltip: string;
    ariaLabel: string;
}> = ({ text, tooltip, ariaLabel }) => (
    <span className="inline-flex items-center gap-1.5">
        <span>{text}</span>
        <WorkerHealthInfoButton ariaLabel={ariaLabel} tooltip={tooltip} />
    </span>
);

const StatusBadge: React.FC<{
    status: AdminAsyncWorkerHealthStatus;
}> = ({ status }) => (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_META[status].className}`}>
        {STATUS_META[status].label}
    </span>
);

const SummaryCard: React.FC<{
    label: React.ReactNode;
    value: React.ReactNode;
    hint?: React.ReactNode;
}> = ({ label, value, hint }) => (
    <AdminSurfaceCard className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <div className="text-2xl font-black tracking-tight text-slate-900">{value}</div>
        {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
    </AdminSurfaceCard>
);

export const AdminAiWorkerHealthPage: React.FC = () => {
    const [data, setData] = useState<AdminAsyncWorkerHealthResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilters, setTypeFilters] = useState<AdminAsyncWorkerHealthCheckType[]>([]);
    const [statusFilters, setStatusFilters] = useState<AdminAsyncWorkerHealthStatus[]>([]);
    const [page, setPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<WorkerHealthSortColumn>(DEFAULT_SORT_COLUMN);
    const [sortDirection, setSortDirection] = useState<WorkerHealthSortDirection>(DEFAULT_SORT_DIRECTION);

    const loadWorkerHealth = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await adminGetAiWorkerHealth({ limit: WORKER_CHECK_FETCH_LIMIT });
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
    const normalizedSearchQuery = normalizeSearchText(searchQuery);

    const typeFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => CHECK_TYPE_FILTER_VALUES.map((value) => ({
            value,
            label: CHECK_TYPE_LABELS[value],
            count: checks.filter((row) => row.checkType === value).length,
        })),
        [checks],
    );

    const statusFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => STATUS_FILTER_VALUES.map((value) => ({
            value,
            label: STATUS_META[value].label,
            count: checks.filter((row) => row.status === value).length,
        })),
        [checks],
    );

    const filteredChecks = useMemo(() => checks.filter((row) => {
        if (typeFilters.length > 0 && !typeFilters.includes(row.checkType)) return false;
        if (statusFilters.length > 0 && !statusFilters.includes(row.status)) return false;
        if (normalizedSearchQuery && !getWorkerHealthSearchText(row).includes(normalizedSearchQuery)) return false;
        return true;
    }), [checks, normalizedSearchQuery, statusFilters, typeFilters]);

    const sortedChecks = useMemo(() => {
        const next = [...filteredChecks];
        next.sort((left, right) => {
            const result = compareWorkerHealthRows(left, right, sortColumn);
            if (result !== 0) {
                return sortDirection === 'asc' ? result : -result;
            }
            const fallback = Date.parse(left.startedAt) - Date.parse(right.startedAt);
            return sortDirection === 'asc' ? fallback : -fallback;
        });
        return next;
    }, [filteredChecks, sortColumn, sortDirection]);

    const pageCount = Math.max(Math.ceil(sortedChecks.length / WORKER_CHECK_PAGE_SIZE), 1);
    const pagedChecks = useMemo(() => {
        const startIndex = (page - 1) * WORKER_CHECK_PAGE_SIZE;
        return sortedChecks.slice(startIndex, startIndex + WORKER_CHECK_PAGE_SIZE);
    }, [page, sortedChecks]);

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    const resetTableState = useCallback(() => {
        setSearchQuery('');
        setTypeFilters([]);
        setStatusFilters([]);
        setPage(1);
        setSortColumn(DEFAULT_SORT_COLUMN);
        setSortDirection(DEFAULT_SORT_DIRECTION);
    }, []);

    const handleSort = useCallback((column: WorkerHealthSortColumn) => {
        if (sortColumn === column) {
            setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortColumn(column);
        setSortDirection(column === DEFAULT_SORT_COLUMN ? DEFAULT_SORT_DIRECTION : 'asc');
        setPage(1);
    }, [sortColumn]);

    const hasActiveTableControls = normalizedSearchQuery.length > 0 || typeFilters.length > 0 || statusFilters.length > 0;
    const showingFrom = sortedChecks.length === 0 ? 0 : ((page - 1) * WORKER_CHECK_PAGE_SIZE) + 1;
    const showingTo = sortedChecks.length === 0 ? 0 : Math.min(page * WORKER_CHECK_PAGE_SIZE, sortedChecks.length);

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
                        label={(
                            <WorkerHealthLabel
                                text="Overall status"
                                tooltip={WORKER_HEALTH_TOOLTIPS.overallStatus}
                                ariaLabel="What overall worker status means"
                            />
                        )}
                        value={summary ? <StatusBadge status={summary.overallStatus} /> : '—'}
                        hint={summary?.statusReason || (loading ? 'Loading worker status...' : 'No worker health rows yet.')}
                    />
                    <SummaryCard
                        label={(
                            <WorkerHealthLabel
                                text="Last heartbeat"
                                tooltip={WORKER_HEALTH_TOOLTIPS.heartbeat}
                                ariaLabel="What a worker heartbeat means"
                            />
                        )}
                        value={summary ? formatTimestamp(summary.lastHeartbeatAt) : '—'}
                        hint={summary?.heartbeatFresh ? 'Cron heartbeat is fresh.' : 'Cron heartbeat is stale or missing.'}
                    />
                    <SummaryCard
                        label={(
                            <WorkerHealthLabel
                                text="Stale queued jobs"
                                tooltip={WORKER_HEALTH_TOOLTIPS.staleQueued}
                                ariaLabel="What stale queued jobs means"
                            />
                        )}
                        value={summary ? summary.staleQueuedCount.toLocaleString() : '—'}
                        hint={summary?.oldestQueuedAgeMs != null ? `Oldest queued age: ${formatDuration(summary.oldestQueuedAgeMs)}` : 'No stale queued jobs recorded in the latest heartbeat.'}
                    />
                    <SummaryCard
                        label={(
                            <WorkerHealthLabel
                                text="Last self-heal"
                                tooltip={WORKER_HEALTH_TOOLTIPS.selfHeal}
                                ariaLabel="What worker self-heal means"
                            />
                        )}
                        value={summary?.lastSelfHealStatus ? <StatusBadge status={summary.lastSelfHealStatus} /> : '—'}
                        hint={summary?.lastSelfHealAt ? formatTimestamp(summary.lastSelfHealAt) : 'No bounded re-kick recorded yet.'}
                    />
                    <SummaryCard
                        label={(
                            <WorkerHealthLabel
                                text="Last canary"
                                tooltip={WORKER_HEALTH_TOOLTIPS.canary}
                                ariaLabel="What the canary proves"
                            />
                        )}
                        value={summary?.lastCanaryStatus ? <StatusBadge status={summary.lastCanaryStatus} /> : '—'}
                        hint={summary?.lastCanaryAt ? formatTimestamp(summary.lastCanaryAt) : 'No canary run recorded yet.'}
                    />
                    <SummaryCard
                        label={(
                            <WorkerHealthLabel
                                text="Canary latency"
                                tooltip={WORKER_HEALTH_TOOLTIPS.canaryLatency}
                                ariaLabel="What canary latency means"
                            />
                        )}
                        value={summary ? formatDuration(summary.lastCanaryLatencyMs) : '—'}
                        hint={summary?.canaryDue ? 'Another canary is due soon.' : 'Recent successful canary is still within the target window.'}
                    />
                </div>

                <AdminSurfaceCard className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <span>Heartbeat</span>
                            <WorkerHealthInfoButton ariaLabel="Explain heartbeat checks" tooltip={WORKER_HEALTH_TOOLTIPS.heartbeat} />
                        </div>
                        <p className="text-sm text-slate-500">
                            Scheduled cron proof. If heartbeats stop, the worker loop itself may no longer be running.
                        </p>
                    </div>
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <span>Watchdog</span>
                            <WorkerHealthInfoButton ariaLabel="Explain watchdog checks" tooltip={WORKER_HEALTH_TOOLTIPS.selfHeal} />
                        </div>
                        <p className="text-sm text-slate-500">
                            Stale-queue detector. It only records when queued work looked stuck and the normal worker path was re-kicked once.
                        </p>
                    </div>
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <span>Canary</span>
                            <WorkerHealthInfoButton ariaLabel="Explain canary checks" tooltip={WORKER_HEALTH_TOOLTIPS.canary} />
                        </div>
                        <p className="text-sm text-slate-500">
                            Safe end-to-end probe. Healthy means queueing, dispatch, claiming, execution, and terminal writes all completed on the live path.
                        </p>
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Recent checks</h2>
                            <p className="text-sm text-slate-500">
                                Newest rows first. Heartbeats show cron health, watchdog rows capture stale-queue incidents, and canaries prove the drain path end to end.
                            </p>
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {checks.length.toLocaleString()} rows loaded
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[260px] flex-1 sm:flex-none">
                            <MagnifyingGlass size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => {
                                    setSearchQuery(event.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search type, dispatch, or failure text"
                                className="h-8 w-full rounded-md border border-slate-200 bg-white ps-9 pe-3 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
                                aria-label="Search worker health checks"
                            />
                        </label>
                        <AdminFilterMenu
                            label="Type"
                            options={typeFilterOptions}
                            selectedValues={typeFilters}
                            onSelectedValuesChange={(next) => {
                                setTypeFilters(next as AdminAsyncWorkerHealthCheckType[]);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Status"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={(next) => {
                                setStatusFilters(next as AdminAsyncWorkerHealthStatus[]);
                                setPage(1);
                            }}
                        />
                        <button
                            type="button"
                            onClick={resetTableState}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                            <X size={14} />
                            Reset
                        </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className={`px-4 py-3 font-semibold text-slate-700 ${sortColumn === 'checkType' ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Type"
                                            isActive={sortColumn === 'checkType'}
                                            direction={sortDirection}
                                            onClick={() => handleSort('checkType')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-semibold text-slate-700 ${sortColumn === 'status' ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Status"
                                            isActive={sortColumn === 'status'}
                                            direction={sortDirection}
                                            onClick={() => handleSort('status')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-semibold text-slate-700 ${sortColumn === 'startedAt' ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Started"
                                            isActive={sortColumn === 'startedAt'}
                                            direction={sortDirection}
                                            onClick={() => handleSort('startedAt')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-semibold text-slate-700 ${sortColumn === 'staleQueuedCount' ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Stale queued"
                                            isActive={sortColumn === 'staleQueuedCount'}
                                            direction={sortDirection}
                                            onClick={() => handleSort('staleQueuedCount')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-semibold text-slate-700 ${sortColumn === 'dispatch' ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Dispatch"
                                            isActive={sortColumn === 'dispatch'}
                                            direction={sortDirection}
                                            onClick={() => handleSort('dispatch')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-semibold text-slate-700 ${sortColumn === 'failure' ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Failure"
                                            isActive={sortColumn === 'failure'}
                                            direction={sortDirection}
                                            onClick={() => handleSort('failure')}
                                        />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagedChecks.length === 0 && !loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                            {hasActiveTableControls ? 'No checks match your filters.' : 'No worker health rows yet.'}
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {loading && checks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                            Loading worker health...
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                                {pagedChecks.map((row) => (
                                    <TableRow key={row.id} className={`${ADMIN_TABLE_ROW_SURFACE_CLASS} align-top`}>
                                        <TableCell className={`px-4 py-3 font-semibold text-slate-900 ${sortColumn === 'checkType' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                            {CHECK_TYPE_LABELS[row.checkType]}
                                        </TableCell>
                                        <TableCell className={`px-4 py-3 ${sortColumn === 'status' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                            <StatusBadge status={row.status} />
                                        </TableCell>
                                        <TableCell className={`px-4 py-3 text-slate-700 ${sortColumn === 'startedAt' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                            <div>{formatTimestamp(row.startedAt)}</div>
                                            <div className="text-xs text-slate-500">
                                                Finished: {formatTimestamp(row.finishedAt)}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`px-4 py-3 text-slate-700 ${sortColumn === 'staleQueuedCount' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                            <div>{row.staleQueuedCount.toLocaleString()}</div>
                                            <div className="text-xs text-slate-500">
                                                Oldest: {formatDuration(row.oldestQueuedAgeMs)}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`px-4 py-3 text-slate-700 ${sortColumn === 'dispatch' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                            <div>{formatDispatchStatus(row)}</div>
                                            <div className="text-xs text-slate-500">
                                                Canary latency: {formatDuration(row.canaryLatencyMs)}
                                            </div>
                                        </TableCell>
                                        <TableCell className={`px-4 py-3 text-slate-700 ${sortColumn === 'failure' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                            <div>{row.failureCode || '—'}</div>
                                            <div className="max-w-[340px] text-xs text-slate-500">
                                                {row.failureMessage || 'No failure recorded.'}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                            {sortedChecks.length === 0
                                ? 'Showing 0 checks'
                                : `Showing ${showingFrom}-${showingTo} of ${sortedChecks.length}`}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                                disabled={page === 1}
                                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <span>Page {page} / {pageCount}</span>
                            <button
                                type="button"
                                onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
                                disabled={page >= pageCount}
                                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
