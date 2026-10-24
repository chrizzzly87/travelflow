import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { ArrowRight, Info, X } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminPagination } from '../components/admin/AdminPagination';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
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
    type AdminAsyncWorkerHealthSummary,
} from '../services/adminService';
import { formatAdminAbsoluteTime, formatAdminRelativeTime } from '../components/admin/adminRelativeTime';
import {
    WORKER_HEALTH_VERDICT,
    buildWorkerHealthSignals,
    formatWorkerDuration,
    type WorkerHealthSignalKey,
} from '../components/admin/adminWorkerHealthStatus';

// The endpoint caps a read at 50 rows; that is the whole history this screen can show.
const WORKER_CHECK_FETCH_LIMIT = 50;
const WORKER_CHECK_PAGE_SIZE = 10;

type WorkerHealthSortColumn = 'startedAt' | 'checkType' | 'status' | 'staleQueuedCount' | 'dispatch' | 'failure';
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
// A single check passes or fails; the page-level verdict (Healthy/Degraded/Failing) is separate.
const STATUS_META: Record<AdminAsyncWorkerHealthStatus, { label: string; tone: AdminStatusTone }> = {
    ok: { label: 'Passed', tone: 'success' },
    warning: { label: 'Warning', tone: 'warning' },
    failed: { label: 'Failed', tone: 'danger' },
};

const WORKER_HEALTH_TOOLTIPS: Record<WorkerHealthSignalKey | 'overallStatus', string> = {
    overallStatus: 'Combines the latest heartbeat, stale-queue watchdog and canary into one verdict. A stale heartbeat or a failed canary means failing; an overdue canary or stuck jobs mean degraded.',
    heartbeat: 'The scheduled cron check, every minute. Fresh means the scheduler is running and can reach the worker dispatcher; if heartbeats stop, the worker loop itself may be down.',
    queue: 'Queued jobs whose run time has passed and that have not moved for at least five minutes, as of the latest heartbeat.',
    selfHeal: 'The watchdog’s bounded re-kick. It only happens when stale queued jobs were detected, and nudges the normal worker path once.',
    canary: 'A safe synthetic probe, about every 15 minutes. It enqueues an intentionally invalid job that should fail in a known way, proving queueing, dispatch, worker claim, execution and terminal writes all work end to end.',
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

const StatusBadge: React.FC<{
    status: AdminAsyncWorkerHealthStatus;
}> = ({ status }) => (
    <AdminStatusBadge tone={STATUS_META[status].tone}>
        {STATUS_META[status].label}
    </AdminStatusBadge>
);

const SIGNAL_ARIA_LABELS: Record<WorkerHealthSignalKey, string> = {
    heartbeat: 'What a worker heartbeat means',
    queue: 'What stale queued jobs means',
    canary: 'What the canary proves',
    selfHeal: 'What worker self-heal means',
};

const SORT_COLUMNS: ReadonlyArray<{ column: WorkerHealthSortColumn; label: string }> = [
    { column: 'startedAt', label: 'Started' },
    { column: 'checkType', label: 'Type' },
    { column: 'status', label: 'Result' },
    { column: 'staleQueuedCount', label: 'Stale queued' },
    { column: 'dispatch', label: 'Dispatch' },
    { column: 'failure', label: 'Failure' },
];

const WorkerHealthStatusHeader: React.FC<{
    summary: AdminAsyncWorkerHealthSummary | null;
    loading: boolean;
}> = ({ summary, loading }) => {
    if (!summary) {
        return (
            <AdminSurfaceCard role="status" aria-busy={loading || undefined} className="text-sm text-muted-foreground">
                {loading ? 'Loading worker status…' : 'No worker health rows yet. The first cron heartbeat creates one within a minute.'}
            </AdminSurfaceCard>
        );
    }
    const verdict = WORKER_HEALTH_VERDICT[summary.overallStatus];
    const signals = buildWorkerHealthSignals(summary);
    return (
        <AdminSurfaceCard className="flex flex-col gap-4" aria-busy={loading || undefined}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge tone={verdict.tone}>{verdict.label}</AdminStatusBadge>
                        <h2 className="text-base font-semibold leading-6 text-foreground">{verdict.headline}</h2>
                        <WorkerHealthInfoButton ariaLabel="What overall worker status means" tooltip={WORKER_HEALTH_TOOLTIPS.overallStatus} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{summary.statusReason}</p>
                </div>
                {summary.lastHeartbeatAt ? (
                    <span
                        className="shrink-0 text-xs tabular-nums text-muted-foreground"
                        data-tooltip={formatAdminAbsoluteTime(summary.lastHeartbeatAt)}
                    >
                        Last checked {formatAdminRelativeTime(summary.lastHeartbeatAt)}
                    </span>
                ) : null}
            </div>
            <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
                {signals.map((signal) => (
                    <div key={signal.key} className="flex min-w-0 flex-col gap-1">
                        <dt className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                            {signal.label}
                            <WorkerHealthInfoButton ariaLabel={SIGNAL_ARIA_LABELS[signal.key]} tooltip={WORKER_HEALTH_TOOLTIPS[signal.key]} />
                        </dt>
                        <dd className="flex flex-col gap-1">
                            <AdminStatusBadge tone={signal.tone}>{signal.state}</AdminStatusBadge>
                            <span
                                className="text-xs text-muted-foreground"
                                data-tooltip={signal.observedAt ? formatAdminAbsoluteTime(signal.observedAt) : undefined}
                            >
                                {signal.detail}
                            </span>
                        </dd>
                    </div>
                ))}
            </dl>
        </AdminSurfaceCard>
    );
};

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
    const checks = useMemo(() => data?.checks || [], [data]);
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

    // Clamp at render time instead of syncing state in an effect after the list shrinks.
    const pageCount = Math.max(Math.ceil(sortedChecks.length / WORKER_CHECK_PAGE_SIZE), 1);
    const safePage = Math.min(page, pageCount);
    const pagedChecks = useMemo(() => {
        const startIndex = (safePage - 1) * WORKER_CHECK_PAGE_SIZE;
        return sortedChecks.slice(startIndex, startIndex + WORKER_CHECK_PAGE_SIZE);
    }, [safePage, sortedChecks]);

    const resetTableState = useCallback(() => {
        trackEvent('admin__worker_health--reset_filters');
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

    const hasActiveFilters = normalizedSearchQuery.length > 0 || typeFilters.length > 0 || statusFilters.length > 0;
    const hasCustomTableState = hasActiveFilters
        || sortColumn !== DEFAULT_SORT_COLUMN
        || sortDirection !== DEFAULT_SORT_DIRECTION;
    const nowMs = Date.now();

    return (
        <AdminShell
            title="Worker health"
            description="Is async trip generation draining its queue? Heartbeat, stuck jobs, self-heals and the end-to-end canary."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <>
                    <Button asChild variant="ghost">
                        <Link
                            to="/admin/ai-benchmark/telemetry"
                            onClick={() => trackEvent('admin__worker_health--ai_telemetry')}
                            {...getAnalyticsDebugAttributes('admin__worker_health--ai_telemetry')}
                        >
                            AI telemetry
                            <ArrowRight className="rtl:rotate-180" />
                        </Link>
                    </Button>
                    <AdminReloadButton onClick={() => void loadWorkerHealth()} isLoading={loading} label="Reload health" />
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                {error ? <AdminErrorAlert title="Could not load worker health" message={error} /> : null}

                <WorkerHealthStatusHeader summary={summary} loading={loading} />

                <AdminSurfaceCard className="flex flex-col gap-4 p-0">
                    <AdminSectionHeader
                        className="px-4 pt-4"
                        title="Recent checks"
                        description={`The latest ${WORKER_CHECK_FETCH_LIMIT} checks. Filter to failed rows to see what broke and when.`}
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
                            placeholder="Search type, dispatch or failure"
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
                            label="Result"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={(next) => {
                                setStatusFilters(next as AdminAsyncWorkerHealthStatus[]);
                                setPage(1);
                            }}
                        />
                        {hasCustomTableState ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={resetTableState}
                                {...getAnalyticsDebugAttributes('admin__worker_health--reset_filters')}
                            >
                                <X />
                                Reset
                            </Button>
                        ) : null}
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
                            {loading && checks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={SORT_COLUMNS.length} className="px-4 py-8 text-center text-sm text-muted-foreground" role="status">
                                        Loading worker health…
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {pagedChecks.length === 0 && !loading ? (
                                <TableRow>
                                    <TableCell colSpan={SORT_COLUMNS.length} className="p-4">
                                        <AdminEmptyState
                                            className="py-6"
                                            title={hasActiveFilters ? 'No checks match your filters.' : 'No worker health rows yet.'}
                                            description={hasActiveFilters
                                                ? 'Clear the search or filters to see every loaded check.'
                                                : 'The cron heartbeat writes the first row within a minute of a deploy.'}
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {pagedChecks.map((row) => (
                                <TableRow key={row.id} className={`${ADMIN_TABLE_ROW_SURFACE_CLASS} align-top`}>
                                    <TableCell className={`px-4 py-3 tabular-nums text-foreground ${sortColumn === 'startedAt' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div data-tooltip={formatAdminAbsoluteTime(row.startedAt)}>
                                            {formatAdminRelativeTime(row.startedAt, nowMs)}
                                        </div>
                                        {row.finishedAt ? (
                                            <div className="text-xs text-muted-foreground">
                                                Took {formatWorkerDuration(Date.parse(row.finishedAt) - Date.parse(row.startedAt))}
                                            </div>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 font-medium text-foreground ${sortColumn === 'checkType' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        {CHECK_TYPE_LABELS[row.checkType]}
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 ${sortColumn === 'status' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <StatusBadge status={row.status} />
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 tabular-nums text-foreground ${sortColumn === 'staleQueuedCount' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div>{row.staleQueuedCount.toLocaleString()}</div>
                                        {row.staleQueuedCount > 0 ? (
                                            <div className="text-xs text-muted-foreground">
                                                Oldest {formatWorkerDuration(row.oldestQueuedAgeMs)}
                                            </div>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 text-foreground ${sortColumn === 'dispatch' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        <div>{formatDispatchStatus(row)}</div>
                                        {row.checkType === 'canary' ? (
                                            <div className="text-xs text-muted-foreground">
                                                Canary latency {formatWorkerDuration(row.canaryLatencyMs)}
                                            </div>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className={`px-4 py-3 text-foreground ${sortColumn === 'failure' ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                        {row.failureCode || row.failureMessage ? (
                                            <>
                                                <div className="font-mono text-xs">{row.failureCode || '—'}</div>
                                                <div className="max-w-[340px] whitespace-normal break-words text-xs text-muted-foreground">
                                                    {row.failureMessage}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <AdminPagination
                        className="px-4 pb-4"
                        page={safePage}
                        pageSize={WORKER_CHECK_PAGE_SIZE}
                        totalItems={sortedChecks.length}
                        onPageChange={setPage}
                        noun="checks"
                    />
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
