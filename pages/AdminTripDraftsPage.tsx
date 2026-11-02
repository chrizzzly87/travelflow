import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, CheckCircle, Eye, Robot, Sparkle } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { resolveTripDraftRangeStart } from '../components/admin/adminTripDraftsModel';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminStatusBadge, type AdminStatusTone } from '../components/admin/AdminStatusBadge';
import { AdminBarList } from '../components/admin/charts/AdminBarList';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
    adminGetTripDraftStats,
    adminListTripDrafts,
    type AdminTripDraftBreakdownEntry,
    type AdminTripDraftRecord,
    type AdminTripDraftStats,
    type AdminTripDraftStatus,
} from '../services/adminService';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

const numberFormatter = new Intl.NumberFormat();
const percentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const SOURCE_LABELS: Record<string, string> = {
    mcp: 'MCP server',
    webmcp: 'WebMCP (in page)',
    api: 'HTTP API',
    paste: 'Paste page',
};

const STATUS_META: Record<AdminTripDraftStatus, { label: string; tone: AdminStatusTone }> = {
    draft: { label: 'Unclaimed', tone: 'info' },
    claimed: { label: 'Saved', tone: 'success' },
    expired: { label: 'Expired', tone: 'neutral' },
};

type StatusFilter = AdminTripDraftStatus | 'all';

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Unclaimed' },
    { value: 'claimed', label: 'Saved' },
    { value: 'expired', label: 'Expired' },
];

const EMPTY_STATS: AdminTripDraftStats = {
    created_count: 0, claimed_count: 0, claim_total: 0, view_total: 0, expired_count: 0, by_source: {}, by_client: {},
};

const toBarListRows = (bucket: Record<string, AdminTripDraftBreakdownEntry>, labels: Record<string, string> = {}) => (
    Object.entries(bucket).map(([key, entry]) => ({
        key,
        name: labels[key] ?? key,
        value: entry.created,
        valueLabel: `${numberFormatter.format(entry.created)} · ${numberFormatter.format(entry.claimed)} saved`,
        tooltip: entry.created ? `${percentFormatter.format(entry.claimed / entry.created)} saved to an account` : undefined,
    }))
);

const formatDate = (value: string | null): string => (value ? dateFormatter.format(new Date(value)) : '—');

/**
 * Trips outside assistants planned and handed to TravelFlow (MCP, WebMCP, API,
 * paste) and how many travellers saved them. docs/EXTERNAL_TRIP_DRAFTS.md.
 */
export const AdminTripDraftsPage: React.FC = () => {
    const [drafts, setDrafts] = useState<AdminTripDraftRecord[]>([]);
    const [stats, setStats] = useState<AdminTripDraftStats>(EMPTY_STATS);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [dateRange, setDateRange] = useState<AdminDateRange>('30d');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    const loadData = useCallback(async (search: string, range: AdminDateRange, status: StatusFilter) => {
        setIsLoading(true);
        setErrorMessage(null);
        const since = resolveTripDraftRangeStart(range);
        try {
            const [nextDrafts, nextStats] = await Promise.all([
                adminListTripDrafts({ limit: 300, search, status, since }),
                adminGetTripDraftStats(since),
            ]);
            setDrafts(nextDrafts);
            setStats(nextStats);
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not load trip drafts.', 'admin-trip-drafts'));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => { void loadData(searchValue, dateRange, statusFilter); }, 160);
        return () => window.clearTimeout(timer);
    }, [dateRange, loadData, searchValue, statusFilter]);

    const conversion = stats.created_count ? stats.claimed_count / stats.created_count : 0;
    const sourceRows = useMemo(() => toBarListRows(stats.by_source, SOURCE_LABELS), [stats.by_source]);
    const clientRows = useMemo(() => toBarListRows(stats.by_client), [stats.by_client]);

    return (
        <AdminShell
            title="AI trip drafts"
            description="Trips planned by outside assistants and handed to TravelFlow. No model runs on our side."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={<AdminReloadButton onClick={() => void loadData(searchValue, dateRange, statusFilter)} isLoading={isLoading} />}
        >
            <div className="flex flex-col gap-4">
                {errorMessage && <AdminErrorAlert title="Could not load trip drafts" message={errorMessage} />}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard
                        label="Drafts created"
                        icon={<Sparkle />}
                        value={<AdminCountUpNumber value={stats.created_count} />}
                        hint={stats.expired_count > 0 ? `${numberFormatter.format(stats.expired_count)} expired unsaved` : 'Created in this range'}
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Saved to an account"
                        icon={<CheckCircle />}
                        value={<AdminCountUpNumber value={stats.claimed_count} />}
                        hint={`${numberFormatter.format(stats.claim_total)} saves in total`}
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Conversion"
                        icon={<Robot />}
                        value={percentFormatter.format(conversion)}
                        hint="Drafts saved at least once"
                        hintTone={stats.created_count > 0 && conversion === 0 ? 'warning' : 'neutral'}
                        isLoading={isLoading}
                    >
                        <div
                            className="h-1.5 overflow-hidden rounded-full bg-secondary"
                            role="progressbar"
                            aria-label="Share of drafts saved"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(conversion * 100)}
                        >
                            <div className="h-full rounded-full bg-chart-2 transition-[width]" style={{ width: `${conversion * 100}%` }} />
                        </div>
                    </AdminStatCard>
                    <AdminStatCard
                        label="Draft views"
                        icon={<Eye />}
                        value={<AdminCountUpNumber value={stats.view_total} />}
                        hint="Opens of a draft link"
                        isLoading={isLoading}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader title="By channel" description="How the draft reached TravelFlow." />
                        {sourceRows.length > 0
                            ? <AdminBarList ariaLabel="Drafts by channel" scale="total" data={sourceRows} />
                            : <p className="text-sm text-muted-foreground">No drafts in this range.</p>}
                    </AdminSurfaceCard>
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader title="By assistant" description="Self-reported by the caller; treat as a hint." />
                        {clientRows.length > 0
                            ? <AdminBarList ariaLabel="Drafts by assistant" scale="total" data={clientRows} />
                            : <p className="text-sm text-muted-foreground">No drafts in this range.</p>}
                    </AdminSurfaceCard>
                </div>

                <AdminSurfaceCard className="flex flex-col gap-3 p-0">
                    <AdminSectionHeader
                        className="px-4 pt-4"
                        title="Drafts"
                        description="Newest first. Saved drafts link to the first trip created from them."
                        actions={(
                            <SegmentedControl<StatusFilter>
                                name="admin-trip-draft-status"
                                label="Filter by status"
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={STATUS_FILTER_OPTIONS}
                                size="sm"
                            />
                        )}
                    />
                    {drafts.length === 0 && !isLoading ? (
                        <AdminEmptyState
                            className="mx-4 mb-4"
                            icon={<Sparkle />}
                            title="No drafts yet"
                            description="Drafts appear here when an assistant sends a trip through MCP, WebMCP, the API or the paste page."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="ps-4">Draft</TableHead>
                                    <TableHead className="hidden md:table-cell">Channel</TableHead>
                                    <TableHead className="hidden lg:table-cell">Size</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell text-end">Views</TableHead>
                                    <TableHead className="hidden lg:table-cell">Saved by</TableHead>
                                    <TableHead className="pe-4 text-end">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {drafts.map((draft) => {
                                    const status = STATUS_META[draft.status] ?? STATUS_META.draft;
                                    return (
                                        <TableRow key={draft.id}>
                                            <TableCell className="ps-4">
                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                    <a
                                                        href={`/draft/${draft.id}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground hover:underline"
                                                        onClick={() => trackEvent('admin__trip_drafts--open_draft')}
                                                        {...getAnalyticsDebugAttributes('admin__trip_drafts--open_draft')}
                                                    >
                                                        <span className="truncate">{draft.title}</span>
                                                        <ArrowSquareOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                    </a>
                                                    <CopyableUuid value={draft.id} ariaLabel={`Copy draft id ${draft.id}`} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <span className="block text-foreground">{SOURCE_LABELS[draft.source] ?? draft.source}</span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {[draft.client_name, draft.client_model].filter(Boolean).join(' · ') || 'Unknown assistant'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell tabular-nums text-muted-foreground">
                                                {draft.city_count} stops · {draft.activity_count} activities
                                                {draft.country_codes.length > 0 && <span className="block text-xs">{draft.country_codes.join(', ')}</span>}
                                            </TableCell>
                                            <TableCell>
                                                <AdminStatusBadge tone={status.tone}>
                                                    {status.label}{draft.claim_count > 1 ? ` ×${draft.claim_count}` : ''}
                                                </AdminStatusBadge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-end tabular-nums text-muted-foreground">{draft.view_count}</TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                {draft.first_claimed_trip_id ? (
                                                    <Link
                                                        to={`/admin/trips?q=${encodeURIComponent(draft.first_claimed_trip_id)}`}
                                                        className="block truncate text-foreground hover:underline"
                                                        onClick={() => trackEvent('admin__trip_drafts--open_trip')}
                                                        {...getAnalyticsDebugAttributes('admin__trip_drafts--open_trip')}
                                                    >
                                                        {draft.first_claimed_by_email || 'Open trip'}
                                                    </Link>
                                                ) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="pe-4 text-end tabular-nums text-muted-foreground">{formatDate(draft.created_at)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
