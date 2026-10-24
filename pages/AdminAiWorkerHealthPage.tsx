import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { ArrowRight, Info, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminStatusBadge, type AdminStatusTone } from '../components/admin/AdminStatusBadge';
import { Button } from '../components/ui/button';
import { SearchInput } from '../components/ui/search-input';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import {
    AdminSortHeaderButton,
} from '../components/admin/AdminDataTable';
import {
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    ADMIN_TABLE_SORTED_HEADER_CLASS,
} from '../components/admin/AdminDataTableUtils';
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
const STATUS_META: Record<AdminAsyncWorkerHealthStatus, { label: string; tone: AdminStatusTone }> = {
    ok: { label: 'Healthy', tone: 'success' },
    warning: { label: 'Warning', tone: 'warning' },
    failed: { label: 'Failed', tone: 'danger' },
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
    // `data-tooltip` only: a native `title` as well drew a second, unstyled tooltip on hover.
    <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={ariaLabel}
        data-tooltip={tooltip}
        className="size-5 rounded-full text-muted-foreground hover:text-foreground"
    >
        <Info weight="bold" />
    </Button>
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
    <AdminStatusBadge tone={STATUS_META[status].tone}>
        {STATUS_META[status].label}
    </AdminStatusBadge>
);

const SORT_COLUMNS: ReadonlyArray<{ column: WorkerHealthSortColumn; label: string }> = [
    { column: 'checkType', label: 'Type' },
    { column: 'status', label: 'Status' },
    { column: 'startedAt', label: 'Started' },
    { column: 'staleQueuedCount', label: 'Stale queued' },
    { column: 'dispatch', label: 'Dispatch' },
    { column: 'failure', label: 'Failure' },
];

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
            setError(toAdminErrorMessage(loadError, 'Failed to load worker health.', 'admin-worker-health'));
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
            title="Worker health"
            description="Async trip generation heartbeat: stale queued jobs, recent self-heals and canary regressions."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <>
                    <Button asChild variant="ghost">
                        <Link to="/admin/ai-benchmark/telemetry">
                            Open AI telemetry
                            <ArrowRight className="rtl:rotate-180" />
                        </Link>
                    </Button>
                    <AdminReloadButton onClick={() => void loadWorkerHealth()} isLoading={loading} label="Reload health" />
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                {error ? <AdminErrorAlert title="Could not load worker health" message={error} /> : null}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <AdminStatCard
                        label={(
                            <WorkerHealthLabel
                                text="Overall status"
                                tooltip={WORKER_HEALTH_TOOLTIPS.overallStatus}
                                ariaLabel="What overall worker status means"
                            />
                        )}
                        value={summary ? <StatusBadge status={summary.overallStatus} /> : '—'}
                        hint={summary?.statusReason || (loading ? 'Loading worker status…' : 'No worker health rows yet.')}
                        isLoading={loading && !summary}
                    />
                    <AdminStatCard
                        label={(
                            <WorkerHealthLabel
                                text="Last heartbeat"
                                tooltip={WORKER_HEALTH_TOOLTIPS.heartbeat}
                                ariaLabel="What a worker heartbeat means"
                            />
                        )}
                        value={<span className="text-lg">{summary ? formatTimestamp(summary.lastHeartbeatAt) : '—'}</span>}
                        hint={summary?.heartbeatFresh ? 'Cron heartbeat is fresh.' : 'Cron heartbeat is stale or missing.'}
                        hintTone={summary && !summary.heartbeatFresh ? 'warning' : 'neutral'}
                        isLoading={loading && !summary}
                    />
                    <AdminStatCard
                        label={(
                            <WorkerHealthLabel
                                text="Stale queued jobs"
                                tooltip={WORKER_HEALTH_TOOLTIPS.staleQueued}
                                ariaLabel="What stale queued jobs means"
                            />
                        )}
                        value={summary ? summary.staleQueuedCount.toLocaleString() : '—'}
                        hint={summary?.oldestQueuedAgeMs != null ? `Oldest queued age: ${formatDuration(summary.oldestQueuedAgeMs)}` : 'No stale queued jobs recorded in the latest heartbeat.'}
                        hintTone={summary && summary.staleQueuedCount > 0 ? 'warning' : 'neutral'}
                        isLoading={loading && !summary}
                    />
                    <AdminStatCard
                        label={(
                            <WorkerHealthLabel
                                text="Last self-heal"
                                tooltip={WORKER_HEALTH_TOOLTIPS.selfHeal}
                                ariaLabel="What worker self-heal means"
                            />
                        )}
                        value={summary?.lastSelfHealStatus ? <StatusBadge status={summary.lastSelfHealStatus} /> : '—'}
                        hint={summary?.lastSelfHealAt ? formatTimestamp(summary.lastSelfHealAt) : 'No bounded re-kick recorded yet.'}
                        isLoading={loading && !summary}
                    />
                    <AdminStatCard
                        label={(
                            <WorkerHealthLabel
                                text="Last canary"
                                tooltip={WORKER_HEALTH_TOOLTIPS.canary}
                                ariaLabel="What the canary proves"
                            />
                        )}
                        value={summary?.lastCanaryStatus ? <StatusBadge status={summary.lastCanaryStatus} /> : '—'}
                        hint={summary?.lastCanaryAt ? formatTimestamp(summary.lastCanaryAt) : 'No canary run recorded yet.'}
                        isLoading={loading && !summary}
                    />
                    <AdminStatCard
                        label={(
                            <WorkerHealthLabel
                                text="Canary latency"
                                tooltip={WORKER_HEALTH_TOOLTIPS.canaryLatency}
                                ariaLabel="What canary latency means"
                            />
                        )}
                        value={summary ? formatDuration(summary.lastCanaryLatencyMs) : '—'}
                        hint={summary?.canaryDue ? 'Another canary is due soon.' : 'Recent successful canary is still within the target window.'}
                        isLoading={loading && !summary}
                    />
                </div>

                <AdminSurfaceCard className="grid gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                            <span>Heartbeat</span>
                            <WorkerHealthInfoButton ariaLabel="Explain heartbeat checks" tooltip={WORKER_HEALTH_TOOLTIPS.heartbeat} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Scheduled cron proof. If heartbeats stop, the worker loop itself may no longer be running.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                            <span>Watchdog</span>
                            <WorkerHealthInfoButton ariaLabel="Explain watchdog checks" tooltip={WORKER_HEALTH_TOOLTIPS.selfHeal} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Stale-queue detector. It only records when queued work looked stuck and the normal worker path was re-kicked once.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                            <span>Canary</span>
                            <WorkerHealthInfoButton ariaLabel="Explain canary checks" tooltip={WORKER_HEALTH_TOOLTIPS.canary} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Safe end-to-end probe. Healthy means queueing, dispatch, claiming, execution, and terminal writes all completed on the live path.
                        </p>
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex flex-col gap-4 p-0">
                    <AdminSectionHeader
                        className="px-4 pt-4"
                        title="Recent checks"
                        description="Newest first. Heartbeats show cron health, watchdog rows capture stale-queue incidents, and canaries prove the drain path end to end."
                        actions={(
                            <span className="text-sm tabular-nums text-muted-foreground">
                                {checks.length.toLocaleString()} rows loaded
                            </span>
                        )}
                    />

                    <div className="flex flex-wrap items-center gap-2 px-4">
                        <SearchInput
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.currentTarget.value);
                                setPage(1);
                            }}
                            onClear={() => {
                                setSearchQuery('');
                                setPage(1);
                            }}
                            placeholder="Search type, dispatch, or failure text"
                            aria-label="Search worker health checks"
                            containerClassName="h-8 w-full sm:w-72"
                        />
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
                        <Button type="button" variant="ghost" size="sm" onClick={resetTableState}>
                            <X />
                            Reset
                        </Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                {SORT_COLUMNS.map(({ column, label }) => {
                                    const isActive = sortColumn === column;
                                    return (
                                        <TableHead
                                            key={column}
                                            className={`px-4 ${isActive ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}
                                            aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            <AdminSortHeaderButton
                                                label={label}
                                                isActive={isActive}
                                                direction={sortDirection}
                                                onClick={() => handleSort(column)}
                                            />
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pagedChecks.length === 0 && !loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        {hasActiveTableControls ? 'No checks match your filters.' : 'No worker health rows yet.'}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {loading && checks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        Loading worker health…
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {pagedChecks.map((row) => (
                                <TableRow key={row.id} className={`${ADMIN_TABLE_ROW_SURFACE_CLASS} align-top`}>
                                    <TableCell className={`px-4 py-3 font-medium text-foreground ${sortColumn === 'checkType' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        {CHECK_TYPE_LABELS[row.checkType]}
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 ${sortColumn === 'status' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <StatusBadge status={row.status} />
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 tabular-nums text-foreground ${sortColumn === 'startedAt' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div>{formatTimestamp(row.startedAt)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Finished: {formatTimestamp(row.finishedAt)}
                                        </div>
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 tabular-nums text-foreground ${sortColumn === 'staleQueuedCount' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div>{row.staleQueuedCount.toLocaleString()}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Oldest: {formatDuration(row.oldestQueuedAgeMs)}
                                        </div>
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 text-foreground ${sortColumn === 'dispatch' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div>{formatDispatchStatus(row)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Canary latency: {formatDuration(row.canaryLatencyMs)}
                                        </div>
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 text-foreground ${sortColumn === 'failure' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div className="font-mono text-xs">{row.failureCode || '—'}</div>
                                        <div className="max-w-[340px] whitespace-normal break-words text-xs text-muted-foreground">
                                            {row.failureMessage || 'No failure recorded.'}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-sm text-muted-foreground">
                        <span className="tabular-nums">
                            {sortedChecks.length === 0
                                ? 'Showing 0 checks'
                                : `Showing ${showingFrom}-${showingTo} of ${sortedChecks.length}`}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                                disabled={page === 1}
                            >
                                Previous
                            </Button>
                            <span className="tabular-nums">Page {page} / {pageCount}</span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
                                disabled={page >= pageCount}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
