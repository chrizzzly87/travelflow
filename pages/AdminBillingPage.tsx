import React, { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, CreditCard, LinkBreak, ShieldCheck, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAppDialog } from '../components/AppDialogProvider';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminBarList, type AdminBarListItem } from '../components/admin/AdminBarList';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminBarChart } from '../components/admin/AdminBarChart';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { showAppToast } from '../components/ui/appToast';
import {
    adminListBillingSubscriptions,
    adminReconcilePaddleSubscriptions,
    adminListBillingWebhookEvents,
    adminGetBillingDashboard,
    type AdminBillingDashboardRecord,
    type AdminBillingPaddleReconcileSummary,
    type AdminBillingSubscriptionRecord,
    type AdminBillingWebhookEventRecord,
} from '../services/adminService';
import {
    buildAdminBillingAtRiskChartData,
    buildAdminBillingCurrentMrrCards,
    buildAdminBillingMrrByTierChartData,
    buildAdminBillingStatusMixChartData,
    buildAdminBillingTierMixChartData,
    filterAdminBillingSubscriptionsByRange,
    filterAdminBillingWebhookEventsByRange,
    formatAdminBillingAmount,
    humanizeAdminBillingStatus,
    humanizeTierKey,
    normalizeAdminBillingStatus,
    resolveAdminBillingLifecycleStatus,
    summarizeAdminBilling,
    resolveAdminBillingStatusTone,
} from '../services/adminBillingPresentation';

const adminBillingDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const adminBillingDateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
});

const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return adminBillingDateTimeFormatter.format(new Date(timestamp));
};

const formatCompactDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return adminBillingDateFormatter.format(new Date(timestamp));
};

const humanizeEventType = (value: string | null | undefined): string => {
    const normalized = (value || '').trim();
    if (!normalized) return 'Unknown';
    return normalized.replace(/[._]+/g, ' ');
};

const formatPayloadJson = (value: Record<string, unknown> | null | undefined): string => {
    if (!value) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '{}';
    }
};

const BillingStatusBadge: React.FC<{ status: string | null | undefined }> = ({ status }) => (
    <AdminStatusBadge tone={resolveAdminBillingStatusTone(normalizeAdminBillingStatus(status))}>
        {humanizeAdminBillingStatus(status)}
    </AdminStatusBadge>
);

const formatMajorAmount = (value: number): string => Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const toShareItems = (rows: Array<{ label: string; count: number }>): AdminBarListItem[] => {
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows.map((row) => ({
        key: row.label,
        label: row.label,
        value: row.count,
        valueLabel: `${row.count.toLocaleString()} · ${total > 0 ? Math.round((row.count / total) * 100) : 0}%`,
    }));
};

const webhookMessageClassName = (status: string | null | undefined) => {
    const normalizedStatus = normalizeAdminBillingStatus(status);
    if (normalizedStatus === 'failed') {
        return 'mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30';
    }
    if (normalizedStatus === 'past_due' || normalizedStatus === 'paused' || normalizedStatus === 'ignored') {
        return 'mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30';
    }
    if (normalizedStatus === 'processed' || normalizedStatus === 'received') {
        return 'mt-3 rounded-md border border-accent-200 bg-accent-50/70 px-3 py-2 text-sm text-foreground dark:bg-accent-400/12 dark:border-accent-400/30';
    }
    return 'mt-3 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground';
};

const webhookMessageLabel = (status: string | null | undefined): string => {
    const normalizedStatus = normalizeAdminBillingStatus(status);
    if (normalizedStatus === 'failed') return 'Delivery error';
    if (normalizedStatus === 'past_due' || normalizedStatus === 'paused' || normalizedStatus === 'ignored') return 'Needs attention';
    if (normalizedStatus === 'processed' || normalizedStatus === 'received') return 'Sync note';
    return 'Event note';
};

const SUBSCRIPTIONS_CACHE_LIMIT = 250;
const EVENTS_CACHE_LIMIT = 250;

export const AdminBillingPage: React.FC = () => {
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [dashboard, setDashboard] = useState<AdminBillingDashboardRecord | null>(null);
    const [subscriptions, setSubscriptions] = useState<AdminBillingSubscriptionRecord[]>([]);
    const [events, setEvents] = useState<AdminBillingWebhookEventRecord[]>([]);
    const [selectedSubscriptionStatuses, setSelectedSubscriptionStatuses] = useState<string[]>([]);
    const [selectedEventStatuses, setSelectedEventStatuses] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReconciling, setIsReconciling] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastReconcileSummary, setLastReconcileSummary] = useState<AdminBillingPaddleReconcileSummary | null>(null);
    const [lastReconcileSubscriptionId, setLastReconcileSubscriptionId] = useState<string | null>(null);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [dateRange, searchParams, searchValue, setSearchParams]);

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [nextDashboard, nextSubscriptions, nextEvents] = await Promise.all([
                adminGetBillingDashboard(),
                adminListBillingSubscriptions({ limit: SUBSCRIPTIONS_CACHE_LIMIT, search: searchValue || undefined }),
                adminListBillingWebhookEvents({ limit: EVENTS_CACHE_LIMIT, search: searchValue || undefined }),
            ]);
            setDashboard(nextDashboard);
            setSubscriptions(nextSubscriptions);
            setEvents(nextEvents);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load billing workspace.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadData();
        }, 160);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, searchValue]);

    const subscriptionStatusOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        subscriptions.forEach((record) => {
            const key = resolveAdminBillingLifecycleStatus(record);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([value, count]) => ({
                value,
                label: humanizeAdminBillingStatus(value),
                count,
            }));
    }, [subscriptions]);

    const eventStatusOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        events.forEach((record) => {
            const key = (record.status || 'unknown').trim().toLowerCase() || 'unknown';
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([value, count]) => ({
                value,
                label: humanizeAdminBillingStatus(value),
                count,
            }));
    }, [events]);

    const rangedSubscriptions = useMemo(
        () => filterAdminBillingSubscriptionsByRange(subscriptions, dateRange),
        [dateRange, subscriptions],
    );

    const rangedEvents = useMemo(
        () => filterAdminBillingWebhookEventsByRange(events, dateRange),
        [dateRange, events],
    );

    const filteredSubscriptions = useMemo(() => {
        if (selectedSubscriptionStatuses.length === 0) return rangedSubscriptions;
        const selectedSet = new Set(selectedSubscriptionStatuses);
        return rangedSubscriptions.filter((record) => {
            const key = resolveAdminBillingLifecycleStatus(record);
            return selectedSet.has(key);
        });
    }, [rangedSubscriptions, selectedSubscriptionStatuses]);

    const filteredEvents = useMemo(() => {
        if (selectedEventStatuses.length === 0) return rangedEvents;
        const selectedSet = new Set(selectedEventStatuses);
        return rangedEvents.filter((record) => selectedSet.has(((record.status || 'unknown').trim().toLowerCase() || 'unknown')));
    }, [rangedEvents, selectedEventStatuses]);

    const metrics = useMemo(
        () => summarizeAdminBilling(filteredSubscriptions, filteredEvents),
        [filteredEvents, filteredSubscriptions],
    );
    const dashboardCurrentMrrCards = useMemo(
        () => dashboard ? buildAdminBillingCurrentMrrCards(dashboard) : [],
        [dashboard],
    );
    const dashboardMrrByTierData = useMemo(
        () => dashboard ? buildAdminBillingMrrByTierChartData(dashboard) : [],
        [dashboard],
    );
    const dashboardTierMixData = useMemo(
        () => dashboard ? buildAdminBillingTierMixChartData(dashboard) : [],
        [dashboard],
    );
    const dashboardStatusMixData = useMemo(
        () => dashboard ? buildAdminBillingStatusMixChartData(dashboard) : [],
        [dashboard],
    );
    const dashboardAtRiskData = useMemo(
        () => dashboard ? buildAdminBillingAtRiskChartData(dashboard) : [],
        [dashboard],
    );
    // Chart and list adapters: a readable series name for the tooltip, share labels for the mixes.
    const mrrByTierChartData = useMemo(
        () => dashboardMrrByTierData.map((row) => ({ label: row.label, MRR: row.amount })),
        [dashboardMrrByTierData],
    );
    const atRiskListItems = useMemo<AdminBarListItem[]>(
        () => dashboardAtRiskData.map((row) => ({
            key: row.label,
            label: row.label,
            value: row.amount,
            valueLabel: formatMajorAmount(row.amount),
        })),
        [dashboardAtRiskData],
    );
    const tierMixListItems = useMemo(() => toShareItems(dashboardTierMixData.map((row) => ({ label: row.tier, count: row.count }))), [dashboardTierMixData]);
    const statusMixListItems = useMemo(() => toShareItems(dashboardStatusMixData.map((row) => ({ label: row.status, count: row.count }))), [dashboardStatusMixData]);

    const handleReconcile = async () => {
        const suggestedSubscriptionId = (() => {
            const trimmedSearch = searchValue.trim();
            return trimmedSearch.startsWith('sub_') ? trimmedSearch : '';
        })();

        const subscriptionInput = await promptDialog({
            title: 'Optional Paddle subscription ID',
            message: 'Leave this blank to scan recent Paddle subscriptions. Enter a specific sub_... ID when you want to repair one subscription without hitting Paddle list rate limits.',
            label: 'Subscription ID',
            placeholder: 'sub_01...',
            defaultValue: suggestedSubscriptionId,
            confirmLabel: 'Continue',
            cancelLabel: 'Cancel',
            validate: (value) => {
                const trimmedValue = value.trim();
                if (!trimmedValue) return null;
                return /^sub_[a-z0-9]+$/i.test(trimmedValue)
                    ? null
                    : 'Use a Paddle subscription ID that starts with sub_.';
            },
        });
        if (subscriptionInput === null) return;

        const subscriptionId = subscriptionInput.trim() || null;
        const confirmed = await confirmDialog({
            title: subscriptionId ? 'Reconcile Paddle subscription' : 'Reconcile Paddle subscriptions',
            message: subscriptionId
                ? `This fetches ${subscriptionId} from Paddle, replays it through the billing sync, and reapplies the local subscription state for the matched TravelFlow user.`
                : 'This fetches configured Paddle subscriptions, replays them through the billing sync, and reapplies local subscription state for matched TravelFlow users.',
            confirmLabel: subscriptionId ? 'Reconcile subscription' : 'Run reconcile',
            cancelLabel: 'Cancel',
        });
        if (!confirmed) return;

        setIsReconciling(true);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: subscriptionId ? 'Reconciling Paddle subscription' : 'Reconciling Paddle subscriptions',
            description: subscriptionId
                ? `Fetching ${subscriptionId} and replaying it through the billing sync.`
                : 'Fetching Paddle subscriptions and replaying them through the billing sync.',
        });

        try {
            const result = await adminReconcilePaddleSubscriptions({
                maxSubscriptions: subscriptionId ? 1 : SUBSCRIPTIONS_CACHE_LIMIT,
                subscriptionId,
            });
            setLastReconcileSummary(result.summary);
            setLastReconcileSubscriptionId(subscriptionId);
            await loadData();

            showAppToast({
                id: loadingToastId,
                tone: result.summary.failed > 0 || result.summary.unresolved > 0 ? 'warning' : 'success',
                title: 'Paddle reconciliation finished',
                description: subscriptionId
                    ? `Fetched ${subscriptionId}, processed ${result.summary.processed}, duplicates ${result.summary.duplicates}, unresolved ${result.summary.unresolved}.`
                    : `Fetched ${result.summary.fetched}, replayed ${result.summary.eligible}, processed ${result.summary.processed}, duplicates ${result.summary.duplicates}, unresolved ${result.summary.unresolved}.`,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not reconcile Paddle subscriptions.';
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Paddle reconciliation failed',
                description: message,
            });
        } finally {
            setIsReconciling(false);
        }
    };

    const reconcileNeedsAttention = Boolean(
        lastReconcileSummary && (lastReconcileSummary.failed > 0 || lastReconcileSummary.unresolved > 0),
    );

    return (
        <AdminShell
            title="Billing"
            description="Subscription state, webhook delivery and Paddle sync issues."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <>
                    <Button
                        type="button"
                        onClick={() => void handleReconcile()}
                        disabled={isReconciling}
                        aria-busy={isReconciling || undefined}
                    >
                        {isReconciling ? <SpinnerGap className="animate-spin" /> : <ArrowsClockwise weight="bold" />}
                        Reconcile Paddle
                    </Button>
                    <AdminReloadButton
                        onClick={() => void loadData()}
                        isLoading={isLoading}
                        label="Reload"
                    />
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                {errorMessage ? <AdminErrorAlert title="Could not load billing" message={errorMessage} /> : null}

                {lastReconcileSummary ? (
                    <Alert variant={reconcileNeedsAttention ? 'warning' : 'success'} role="status">
                        <ArrowsClockwise weight="bold" />
                        <AlertTitle>Latest Paddle reconciliation</AlertTitle>
                        <AlertDescription>
                            <p>
                                {lastReconcileSubscriptionId
                                    ? `Fetched ${lastReconcileSubscriptionId} and replayed it through the billing sync.`
                                    : `Fetched ${lastReconcileSummary.fetched} subscriptions and replayed ${lastReconcileSummary.eligible} eligible records through the billing sync.`}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <AdminStatusBadge tone="success" className="tabular-nums">Processed {lastReconcileSummary.processed}</AdminStatusBadge>
                                <AdminStatusBadge tone="neutral" className="tabular-nums">Duplicates {lastReconcileSummary.duplicates}</AdminStatusBadge>
                                <AdminStatusBadge tone={lastReconcileSummary.unresolved > 0 ? 'warning' : 'neutral'} className="tabular-nums">
                                    Unresolved {lastReconcileSummary.unresolved}
                                </AdminStatusBadge>
                                <AdminStatusBadge tone={lastReconcileSummary.failed > 0 ? 'danger' : 'neutral'} className="tabular-nums">
                                    Failed {lastReconcileSummary.failed}
                                </AdminStatusBadge>
                            </div>
                        </AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard
                        label="Active paid"
                        icon={<ShieldCheck />}
                        value={<AdminCountUpNumber value={dashboard?.active_subscriptions ?? metrics.activeSubscriptions} />}
                        hint="MRR-eligible subscriptions after the latest billing sync."
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Scheduled cancellations"
                        icon={<CreditCard />}
                        value={<AdminCountUpNumber value={(dashboard?.scheduled_cancellations ?? 0) + (dashboard?.grace_subscriptions ?? metrics.graceSubscriptions)} />}
                        hint="Includes subscriptions scheduled to cancel and grace-access accounts."
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Failed webhooks"
                        icon={<WarningCircle />}
                        value={<AdminCountUpNumber value={dashboard?.failed_webhook_events ?? metrics.failedWebhookEvents} />}
                        hint="Events that need replay or payload inspection."
                        hintTone={(dashboard?.failed_webhook_events ?? metrics.failedWebhookEvents) > 0 ? 'negative' : 'neutral'}
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Unlinked events"
                        icon={<LinkBreak />}
                        value={<AdminCountUpNumber value={metrics.unlinkedWebhookEvents} />}
                        hint="Webhook records that did not resolve to a TravelFlow user."
                        hintTone={metrics.unlinkedWebhookEvents > 0 ? 'warning' : 'neutral'}
                        isLoading={isLoading}
                    />
                </div>

                {dashboard ? (
                    <>
                        {dashboardCurrentMrrCards.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {dashboardCurrentMrrCards.map((card) => (
                                    <AdminStatCard
                                        key={`mrr-${card.currency}`}
                                        label={`Current MRR (${card.currency})`}
                                        value={card.amountLabel}
                                        hint={`${card.subscriptions} running subscriptions`}
                                    />
                                ))}
                            </div>
                        ) : null}

                        <div className="grid gap-4 xl:grid-cols-2">
                            <AdminSurfaceCard className="flex flex-col gap-4">
                                <AdminSectionHeader
                                    title="Current MRR by tier"
                                    description="Monthly recurring revenue by tier and currency. Canceled access grace is excluded."
                                />
                                {mrrByTierChartData.length > 0 ? (
                                    <AdminBarChart
                                        data={mrrByTierChartData}
                                        index="label"
                                        categories={['MRR']}
                                        layout="vertical"
                                        valueFormatter={formatMajorAmount}
                                        className="h-72"
                                        ariaLabel="Bar chart of current monthly recurring revenue by tier and currency"
                                    />
                                ) : (
                                    <AdminEmptyState title="No MRR chart data yet" />
                                )}
                            </AdminSurfaceCard>

                            <AdminSurfaceCard className="flex flex-col gap-4">
                                <AdminSectionHeader
                                    title="At-risk revenue"
                                    description="Revenue exposed to churn or collection risk, by status bucket."
                                />
                                {atRiskListItems.length > 0 ? (
                                    <AdminBarList items={atRiskListItems} color="var(--chart-5)" ariaLabel="At-risk revenue by status" />
                                ) : (
                                    <AdminEmptyState title="No at-risk revenue recorded in the selected data set" />
                                )}
                            </AdminSurfaceCard>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <AdminSurfaceCard className="flex flex-col gap-4">
                                <AdminSectionHeader title="Subscription mix" description="Paid subscriptions by plan tier." />
                                {tierMixListItems.length > 0 ? (
                                    <AdminBarList items={tierMixListItems} ariaLabel="Paid subscriptions by plan tier" />
                                ) : (
                                    <AdminEmptyState title="No subscription mix data yet" />
                                )}
                            </AdminSurfaceCard>

                            <AdminSurfaceCard className="flex flex-col gap-4">
                                <AdminSectionHeader title="Status mix" description="Billing lifecycle across synced subscriptions." />
                                {statusMixListItems.length > 0 ? (
                                    <AdminBarList items={statusMixListItems} ariaLabel="Subscriptions by billing lifecycle status" />
                                ) : (
                                    <AdminEmptyState title="No status mix data yet" />
                                )}
                            </AdminSurfaceCard>
                        </div>
                    </>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                    <AdminFilterMenu
                        label="Subscription status"
                        options={subscriptionStatusOptions}
                        selectedValues={selectedSubscriptionStatuses}
                        onSelectedValuesChange={setSelectedSubscriptionStatuses}
                    />
                    <AdminFilterMenu
                        label="Webhook status"
                        options={eventStatusOptions}
                        selectedValues={selectedEventStatuses}
                        onSelectedValuesChange={setSelectedEventStatuses}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-3 p-0">
                        <AdminSectionHeader
                            className="px-4 pt-4"
                            title="Subscriptions"
                            description="Current billing state per user after webhook sync."
                            actions={<span className="text-sm tabular-nums text-muted-foreground">{filteredSubscriptions.length} rows</span>}
                        />

                        {filteredSubscriptions.length === 0 ? (
                            <AdminEmptyState
                                className="mx-4 mb-4"
                                icon={<CreditCard />}
                                title="No billing subscriptions found for this filter set"
                                description={searchValue.trim() || selectedSubscriptionStatuses.length > 0
                                    ? undefined
                                    : 'If a sandbox checkout already completed, replay the latest Paddle notification and confirm this deploy can receive simulation events.'}
                            />
                        ) : (
                            <Table className="min-w-[860px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="ps-4 text-muted-foreground">User</TableHead>
                                        <TableHead className="text-muted-foreground">Plan</TableHead>
                                        <TableHead className="text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-muted-foreground">Amount</TableHead>
                                        <TableHead className="text-muted-foreground">Renews</TableHead>
                                        <TableHead className="pe-4 text-muted-foreground">Last event</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSubscriptions.map((record) => (
                                        <TableRow key={record.user_id} className="align-top hover:bg-muted/50">
                                            <TableCell className="max-w-[260px] py-3 ps-4">
                                                <div className="min-w-0">
                                                    {record.user_id ? (
                                                        <Link
                                                            to={`/admin/users?user=${encodeURIComponent(record.user_id)}&drawer=user`}
                                                            className="block truncate font-medium text-foreground hover:text-accent-700 hover:underline dark:hover:text-accent-200"
                                                        >
                                                            {record.email || 'Unknown user'}
                                                        </Link>
                                                    ) : (
                                                        <span className="block truncate font-medium text-foreground">{record.email || 'Unknown user'}</span>
                                                    )}
                                                    <div className="mt-1">
                                                        <CopyableUuid value={record.user_id} textClassName="text-xs text-muted-foreground" hintClassName="text-[10px]" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="font-medium text-foreground">{humanizeTierKey(record.tier_key)}</div>
                                                <div className="mt-1 font-mono text-xs text-muted-foreground">{record.provider_price_id || 'No price id'}</div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="flex flex-col gap-2">
                                                    <BillingStatusBadge status={resolveAdminBillingLifecycleStatus(record)} />
                                                    <span className="text-xs text-muted-foreground">App: {humanizeAdminBillingStatus(record.subscription_status)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="font-medium tabular-nums text-foreground">{formatAdminBillingAmount(record.amount, record.currency)}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">{record.provider || 'Provider unknown'}</div>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="tabular-nums text-foreground">{formatCompactDate(record.current_period_end)}</div>
                                                {record.grace_ends_at ? (
                                                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-200">Grace until {formatCompactDate(record.grace_ends_at)}</div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="max-w-[240px] py-3 pe-4">
                                                <div className="text-foreground">{humanizeEventType(record.last_event_type)}</div>
                                                <div className="mt-1 text-xs tabular-nums text-muted-foreground">{formatDateTime(record.last_event_at)}</div>
                                                <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{record.provider_subscription_id || 'No subscription id'}</div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex min-w-0 flex-col gap-3">
                        <AdminSectionHeader
                            title="Webhook events"
                            description="Recent Paddle delivery records stored for replay and debugging."
                            actions={<span className="text-sm tabular-nums text-muted-foreground">{filteredEvents.length} rows</span>}
                        />

                        {filteredEvents.length === 0 ? (
                            <AdminEmptyState
                                icon={<WarningCircle />}
                                title="No billing webhook events found for this filter set"
                                description={searchValue.trim() || selectedEventStatuses.length > 0
                                    ? undefined
                                    : 'Paddle may never have reached the webhook endpoint, the notification was not sent for simulation traffic, or signature verification failed before the event could be stored.'}
                            />
                        ) : (
                            <div className="divide-y divide-border border-t border-border">
                                {filteredEvents.map((record) => (
                                    <article key={record.event_id} className="py-4 last:pb-0">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-foreground">{humanizeEventType(record.event_type)}</span>
                                                <BillingStatusBadge status={record.status} />
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span className="tabular-nums">{formatDateTime(record.occurred_at)}</span>
                                                <span>{record.provider}</span>
                                                {record.user_email && record.user_id ? (
                                                    <Link
                                                        to={`/admin/users?user=${encodeURIComponent(record.user_id)}&drawer=user`}
                                                        className="min-w-0 truncate font-medium text-foreground hover:text-accent-700 hover:underline dark:hover:text-accent-200"
                                                    >
                                                        {record.user_email}
                                                    </Link>
                                                ) : (
                                                    <span>No linked user</span>
                                                )}
                                            </div>
                                            <div className="rounded-md border border-border bg-secondary px-3 py-2">
                                                <div className="text-xs font-medium text-muted-foreground">Event ID</div>
                                                <div className="mt-1 break-all font-mono text-xs leading-5 text-foreground">
                                                    {record.event_id}
                                                </div>
                                            </div>
                                        </div>

                                        {record.error_message ? (
                                            <div className={webhookMessageClassName(record.status)}>
                                                <p className="text-xs font-medium opacity-80">{webhookMessageLabel(record.status)}</p>
                                                <p className="mt-1 break-words">{record.error_message}</p>
                                            </div>
                                        ) : null}

                                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                            <div className="tabular-nums">
                                                <span className="font-medium text-foreground">Processed:</span> {formatDateTime(record.processed_at)}
                                            </div>
                                            <div className="min-w-0 truncate">
                                                <span className="font-medium text-foreground">User ID:</span>{' '}
                                                {record.user_id ? <CopyableUuid value={record.user_id} textClassName="text-xs text-muted-foreground" hintClassName="text-[10px]" /> : '—'}
                                            </div>
                                        </div>

                                        {record.payload ? (
                                            <details className="mt-3 rounded-md border border-border bg-secondary px-3 py-2">
                                                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                                                    Payload JSON
                                                </summary>
                                                <pre className="mt-3 max-h-56 overflow-auto rounded-md border border-border bg-slate-900 p-3 text-[10px] text-slate-100 dark:bg-slate-950">
                                                    {formatPayloadJson(record.payload)}
                                                </pre>
                                            </details>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        )}
                    </AdminSurfaceCard>
                </div>
            </div>
        </AdminShell>
    );
};
