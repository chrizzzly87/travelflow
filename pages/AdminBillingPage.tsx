import React, { useEffect, useMemo, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import {
    ArrowsClockwise,
    CreditCard,
    CurrencyCircleDollar,
    DotsThreeVertical,
    ShieldCheck,
    SpinnerGap,
    WarningCircle,
} from '@phosphor-icons/react';
import { Link, useNavigate, useSearchParams } from '@/app/navigation';

import { useAppDialog } from '../components/AppDialogProvider';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminBarList, type AdminBarListItem } from '../components/admin/charts/AdminBarList';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminBarChart } from '../components/admin/charts/AdminBarChart';
import { AdminPagination } from '../components/admin/AdminPagination';
import {
    AdminBillingStatusBadge,
    AdminBillingSubscriptionSheet,
    AdminBillingWebhookEventSheet,
    formatAdminBillingDateTime,
    humanizeAdminBillingEventType,
} from '../components/admin/AdminBillingSheets';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { showAppToast } from '../components/ui/appToast';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
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
    buildAdminBillingMrrHeadline,
    buildAdminBillingStatusMixChartData,
    buildAdminBillingTierMixChartData,
    filterAdminBillingSubscriptionsByRange,
    filterAdminBillingWebhookEvents,
    filterAdminBillingWebhookEventsByRange,
    formatAdminBillingAmount,
    formatAdminBillingRelativeTime,
    humanizeAdminBillingStatus,
    humanizeTierKey,
    normalizeAdminBillingStatus,
    resolveAdminBillingLifecycleStatus,
    resolveAdminBillingWebhookStatusKey,
    sliceAdminBillingPage,
    summarizeAdminBilling,
} from '../services/adminBillingPresentation';

const adminBillingDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const formatCompactDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return adminBillingDateFormatter.format(new Date(timestamp));
};

const formatMajorAmount = (value: number): string => Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const toShareItems = (rows: Array<{ label: string; count: number }>): AdminBarListItem[] => {
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return rows.map((row) => ({
        key: row.label,
        name: row.label,
        value: row.count,
        valueLabel: `${row.count.toLocaleString()} · ${total > 0 ? Math.round((row.count / total) * 100) : 0}%`,
    }));
};

const countOptions = (keys: string[], label: (key: string) => string): AdminFilterMenuOption[] => {
    const counts = new Map<string, number>();
    keys.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
    return Array.from(counts.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([value, count]) => ({ value, label: label(value), count }));
};

/** A relative timestamp with the absolute one in the tooltip. */
const RelativeTime: React.FC<{ value: string | null | undefined }> = ({ value }) => (
    <time
        dateTime={value || undefined}
        data-tooltip={value ? formatAdminBillingDateTime(value) : undefined}
        className="tabular-nums"
    >
        {formatAdminBillingRelativeTime(value)}
    </time>
);

const LoadingRow: React.FC<{ colSpan: number; label: string }> = ({ colSpan, label }) => (
    <TableRow>
        <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
            <span role="status" className="inline-flex items-center gap-2">
                <SpinnerGap className="size-4 animate-spin" aria-hidden="true" />
                {label}
            </span>
        </TableCell>
    </TableRow>
);

type RecordsView = 'subscriptions' | 'events';

const SUBSCRIPTIONS_CACHE_LIMIT = 250;
const EVENTS_CACHE_LIMIT = 250;
const PAGE_SIZE = 25;
const LINK_FILTER_OPTIONS_LABEL: Record<string, string> = { linked: 'Linked to a user', unlinked: 'No linked user' };

const parseDateRange = (value: string | null): AdminDateRange => (
    value === '7d' || value === '30d' || value === '90d' || value === 'all' ? value : '30d'
);

export const AdminBillingPage: React.FC = () => {
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => parseDateRange(searchParams.get('range')));
    const [recordsView, setRecordsView] = useState<RecordsView>(() => (searchParams.get('view') === 'events' ? 'events' : 'subscriptions'));
    const [dashboard, setDashboard] = useState<AdminBillingDashboardRecord | null>(null);
    const [subscriptions, setSubscriptions] = useState<AdminBillingSubscriptionRecord[]>([]);
    const [events, setEvents] = useState<AdminBillingWebhookEventRecord[]>([]);
    const [selectedSubscriptionStatuses, setSelectedSubscriptionStatuses] = useState<string[]>([]);
    const [selectedEventStatuses, setSelectedEventStatuses] = useState<string[]>([]);
    const [selectedEventLinks, setSelectedEventLinks] = useState<string[]>([]);
    const [subscriptionPage, setSubscriptionPage] = useState(1);
    const [eventPage, setEventPage] = useState(1);
    const [openSubscription, setOpenSubscription] = useState<AdminBillingSubscriptionRecord | null>(null);
    const [openEvent, setOpenEvent] = useState<AdminBillingWebhookEventRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastReconcileSummary, setLastReconcileSummary] = useState<AdminBillingPaddleReconcileSummary | null>(null);
    const [lastReconcileSubscriptionId, setLastReconcileSubscriptionId] = useState<string | null>(null);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (recordsView === 'events') next.set('view', 'events');
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [dateRange, recordsView, searchParams, searchValue, setSearchParams]);

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
            setErrorMessage(toAdminErrorMessage(error, 'Could not load billing workspace.', 'admin-billing'));
        } finally {
            setIsLoading(false);
            setHasLoaded(true);
        }
    };

    // The date range is applied client-side, so only the search refetches.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadData();
        }, 160);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchValue]);

    const handleSearchChange = (value: string) => {
        setSearchValue(value);
        setSubscriptionPage(1);
        setEventPage(1);
    };

    const handleDateRangeChange = (value: AdminDateRange) => {
        setDateRange(value);
        setSubscriptionPage(1);
        setEventPage(1);
    };

    const rangedSubscriptions = useMemo(
        () => filterAdminBillingSubscriptionsByRange(subscriptions, dateRange),
        [dateRange, subscriptions],
    );
    const rangedEvents = useMemo(
        () => filterAdminBillingWebhookEventsByRange(events, dateRange),
        [dateRange, events],
    );

    const subscriptionStatusOptions = useMemo(
        () => countOptions(rangedSubscriptions.map((record) => resolveAdminBillingLifecycleStatus(record)), humanizeAdminBillingStatus),
        [rangedSubscriptions],
    );
    const eventStatusOptions = useMemo(
        () => countOptions(rangedEvents.map(resolveAdminBillingWebhookStatusKey), humanizeAdminBillingStatus),
        [rangedEvents],
    );
    const eventLinkOptions = useMemo(
        () => countOptions(rangedEvents.map((record) => (record.user_id ? 'linked' : 'unlinked')), (key) => LINK_FILTER_OPTIONS_LABEL[key] ?? key),
        [rangedEvents],
    );

    const filteredSubscriptions = useMemo(() => {
        if (selectedSubscriptionStatuses.length === 0) return rangedSubscriptions;
        const selectedSet = new Set(selectedSubscriptionStatuses);
        return rangedSubscriptions.filter((record) => selectedSet.has(resolveAdminBillingLifecycleStatus(record)));
    }, [rangedSubscriptions, selectedSubscriptionStatuses]);

    const filteredEvents = useMemo(
        () => filterAdminBillingWebhookEvents(rangedEvents, { statuses: selectedEventStatuses, links: selectedEventLinks }),
        [rangedEvents, selectedEventLinks, selectedEventStatuses],
    );

    const subscriptionPageSlice = sliceAdminBillingPage<AdminBillingSubscriptionRecord>(filteredSubscriptions, subscriptionPage, PAGE_SIZE);
    const eventPageSlice = sliceAdminBillingPage<AdminBillingWebhookEventRecord>(filteredEvents, eventPage, PAGE_SIZE);

    // KPIs describe the whole range, not whatever the table filters currently show.
    const metrics = useMemo(
        () => summarizeAdminBilling(rangedSubscriptions, rangedEvents),
        [rangedEvents, rangedSubscriptions],
    );
    const mrrHeadline = useMemo(
        () => buildAdminBillingMrrHeadline(dashboard ? buildAdminBillingCurrentMrrCards(dashboard) : []),
        [dashboard],
    );
    const mrrByTierChartData = useMemo(
        () => (dashboard ? buildAdminBillingMrrByTierChartData(dashboard) : []).map((row) => ({ label: row.label, MRR: row.amount })),
        [dashboard],
    );
    const atRiskListItems = useMemo<AdminBarListItem[]>(
        () => (dashboard ? buildAdminBillingAtRiskChartData(dashboard) : []).map((row) => ({
            key: row.label,
            name: row.label,
            value: row.amount,
            valueLabel: formatMajorAmount(row.amount),
        })),
        [dashboard],
    );
    const tierMixListItems = useMemo(
        () => toShareItems((dashboard ? buildAdminBillingTierMixChartData(dashboard) : []).map((row) => ({ label: row.tier, count: row.count }))),
        [dashboard],
    );
    const statusMixListItems = useMemo(
        () => toShareItems((dashboard ? buildAdminBillingStatusMixChartData(dashboard) : []).map((row) => ({ label: row.status, count: row.count }))),
        [dashboard],
    );

    const scheduledCancellations = dashboard?.scheduled_cancellations ?? 0;
    const graceSubscriptions = dashboard?.grace_subscriptions ?? metrics.graceSubscriptions;
    const failedEvents = metrics.failedWebhookEvents;
    const failedEventsAllTime = dashboard?.failed_webhook_events ?? failedEvents;
    const unlinkedEvents = metrics.unlinkedWebhookEvents;
    const syncIssues = failedEvents + unlinkedEvents;

    const switchView = (view: RecordsView) => {
        setRecordsView(view);
        trackEvent('admin__billing_view--switch', { view });
    };

    const reviewEvents = (filter: 'failed' | 'unlinked') => {
        setRecordsView('events');
        setEventPage(1);
        if (filter === 'failed') {
            setSelectedEventStatuses(['failed']);
            setSelectedEventLinks([]);
        } else {
            setSelectedEventStatuses([]);
            setSelectedEventLinks(['unlinked']);
        }
        trackEvent(`admin__billing--review_${filter}`);
    };

    const hasSubscriptionFilters = selectedSubscriptionStatuses.length > 0;
    const hasEventFilters = selectedEventStatuses.length > 0 || selectedEventLinks.length > 0;

    const handleReconcile = async (presetSubscriptionId?: string) => {
        let subscriptionId: string | null = presetSubscriptionId ?? null;

        if (!presetSubscriptionId) {
            const trimmedSearch = searchValue.trim();
            const subscriptionInput = await promptDialog({
                title: 'Optional Paddle subscription ID',
                message: 'Leave this blank to scan recent Paddle subscriptions. Enter a specific sub_... ID when you want to repair one subscription without hitting Paddle list rate limits.',
                label: 'Subscription ID',
                placeholder: 'sub_01...',
                defaultValue: trimmedSearch.startsWith('sub_') ? trimmedSearch : '',
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
            subscriptionId = subscriptionInput.trim() || null;
        }

        const confirmed = await confirmDialog({
            title: subscriptionId ? 'Reconcile Paddle subscription' : 'Reconcile Paddle subscriptions',
            message: subscriptionId
                ? `This fetches ${subscriptionId} from Paddle, replays it through the billing sync, and reapplies the local subscription state for the matched TravelFlow user.`
                : 'This fetches configured Paddle subscriptions, replays them through the billing sync, and reapplies local subscription state for matched TravelFlow users.',
            confirmLabel: subscriptionId ? 'Reconcile subscription' : 'Run reconcile',
            cancelLabel: 'Cancel',
        });
        if (!confirmed) return;

        trackEvent('admin__billing--reconcile', { scope: subscriptionId ? 'single' : 'scan' });
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
            setOpenSubscription(null);
            setOpenEvent(null);
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
            const message = toAdminErrorMessage(error, 'Could not reconcile Paddle subscriptions.', 'admin-billing');
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
    const showInitialLoading = isLoading && !hasLoaded;

    return (
        <AdminShell
            title="Billing"
            description="Keep Paddle subscriptions in sync, repair failed webhooks and watch recurring revenue."
            searchValue={searchValue}
            onSearchValueChange={handleSearchChange}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            actions={(
                <>
                    <Button
                        type="button"
                        onClick={() => void handleReconcile()}
                        disabled={isReconciling}
                        aria-busy={isReconciling || undefined}
                        {...getAnalyticsDebugAttributes('admin__billing--reconcile')}
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

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Billing health">
                    <AdminStatCard
                        label="Sync issues"
                        icon={<WarningCircle />}
                        value={<AdminCountUpNumber value={syncIssues} />}
                        hint={syncIssues > 0
                            ? `${failedEvents} failed · ${unlinkedEvents} without a user`
                            : 'Every webhook in range was processed and linked'}
                        hintTone={failedEvents > 0 ? 'negative' : unlinkedEvents > 0 ? 'warning' : 'neutral'}
                        isLoading={isLoading}
                    >
                        {syncIssues > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {failedEvents > 0 ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => reviewEvents('failed')}
                                        {...getAnalyticsDebugAttributes('admin__billing--review_failed')}
                                    >
                                        Review failed
                                    </Button>
                                ) : null}
                                {unlinkedEvents > 0 ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => reviewEvents('unlinked')}
                                        {...getAnalyticsDebugAttributes('admin__billing--review_unlinked')}
                                    >
                                        Review unlinked
                                    </Button>
                                ) : null}
                            </div>
                        ) : failedEventsAllTime > failedEvents ? (
                            <p className="text-xs text-muted-foreground tabular-nums">{failedEventsAllTime} failed outside this range</p>
                        ) : null}
                    </AdminStatCard>
                    <AdminStatCard
                        label="Current MRR"
                        icon={<CurrencyCircleDollar />}
                        value={mrrHeadline.value}
                        hint={mrrHeadline.otherCurrencies.length > 0
                            ? `Also ${mrrHeadline.otherCurrencies.join(', ')}`
                            : `${mrrHeadline.subscriptions} running subscriptions`}
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Active paid"
                        icon={<ShieldCheck />}
                        value={<AdminCountUpNumber value={dashboard?.active_subscriptions ?? metrics.activeSubscriptions} />}
                        hint="Paying or trialing after the latest sync"
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Cancelling"
                        icon={<CreditCard />}
                        value={<AdminCountUpNumber value={scheduledCancellations + graceSubscriptions} />}
                        hint={`${scheduledCancellations} scheduled · ${graceSubscriptions} in grace`}
                        hintTone={scheduledCancellations + graceSubscriptions > 0 ? 'warning' : 'neutral'}
                        isLoading={isLoading}
                    />
                </section>

                <AdminSurfaceCard className="flex min-w-0 flex-col p-0">
                    <Tabs value={recordsView} onValueChange={(value) => switchView(value as RecordsView)} className="gap-0">
                        <div className="flex flex-col gap-3 border-b border-border px-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
                            <TabsList variant="line" aria-label="Billing records">
                                <TabsTrigger value="subscriptions" className="py-3">
                                    Subscriptions
                                    <span className="tabular-nums text-muted-foreground">{rangedSubscriptions.length}</span>
                                </TabsTrigger>
                                <TabsTrigger value="events" className="py-3">
                                    Webhook events
                                    {failedEvents > 0 ? (
                                        <AdminStatusBadge tone="danger" className="tabular-nums">{failedEvents} failed</AdminStatusBadge>
                                    ) : (
                                        <span className="tabular-nums text-muted-foreground">{rangedEvents.length}</span>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="subscriptions" className="flex flex-col gap-3 pt-3">
                            <div className="flex flex-wrap items-center gap-2 px-4">
                                <AdminFilterMenu
                                    label="Subscription status"
                                    options={subscriptionStatusOptions}
                                    selectedValues={selectedSubscriptionStatuses}
                                    onSelectedValuesChange={(values) => {
                                        setSelectedSubscriptionStatuses(values);
                                        setSubscriptionPage(1);
                                    }}
                                />
                                {hasSubscriptionFilters ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setSelectedSubscriptionStatuses([]);
                                            setSubscriptionPage(1);
                                        }}
                                    >
                                        Reset
                                    </Button>
                                ) : null}
                            </div>

                            {!showInitialLoading && filteredSubscriptions.length === 0 ? (
                                <AdminEmptyState
                                    className="mx-4 mb-4"
                                    icon={<CreditCard />}
                                    title="No subscriptions match"
                                    description={searchValue.trim() || hasSubscriptionFilters
                                        ? 'Clear the search or the status filter to see every subscription.'
                                        : 'If a sandbox checkout already completed, replay the latest Paddle notification and confirm this deploy can receive simulation events.'}
                                />
                            ) : (
                                <>
                                    <Table className="min-w-[860px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="ps-4">Customer</TableHead>
                                                <TableHead>Plan</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-end">Amount</TableHead>
                                                <TableHead>Renews</TableHead>
                                                <TableHead>Last event</TableHead>
                                                <TableHead className="w-12 pe-4"><span className="sr-only">Actions</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {showInitialLoading ? (
                                                <LoadingRow colSpan={7} label="Loading subscriptions…" />
                                            ) : subscriptionPageSlice.items.map((record) => {
                                                const lifecycle = resolveAdminBillingLifecycleStatus(record);
                                                const appStatus = normalizeAdminBillingStatus(record.subscription_status);
                                                const appStatusDiffers = appStatus !== 'none' && appStatus !== normalizeAdminBillingStatus(record.provider_status);
                                                return (
                                                    <TableRow key={record.user_id} className="align-top">
                                                        <TableCell className="max-w-[280px] py-3 ps-4">
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
                                                            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                                                                {record.provider_subscription_id || 'No subscription ID'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3 font-medium text-foreground">{humanizeTierKey(record.tier_key)}</TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <AdminBillingStatusBadge status={lifecycle} />
                                                                {appStatusDiffers ? (
                                                                    <span className="text-xs text-amber-700 dark:text-amber-200">App: {humanizeAdminBillingStatus(record.subscription_status)}</span>
                                                                ) : null}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3 text-end font-medium tabular-nums text-foreground">
                                                            {formatAdminBillingAmount(record.amount, record.currency)}
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="tabular-nums text-foreground">{formatCompactDate(record.current_period_end)}</div>
                                                            {record.grace_ends_at ? (
                                                                <div className="mt-1 text-xs text-amber-700 dark:text-amber-200">Grace until {formatCompactDate(record.grace_ends_at)}</div>
                                                            ) : record.cancel_at ? (
                                                                <div className="mt-1 text-xs text-amber-700 dark:text-amber-200">Cancels {formatCompactDate(record.cancel_at)}</div>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell className="max-w-[220px] py-3">
                                                            <div className="truncate text-foreground">{humanizeAdminBillingEventType(record.last_event_type)}</div>
                                                            <div className="mt-1 text-xs text-muted-foreground"><RelativeTime value={record.last_event_at} /></div>
                                                        </TableCell>
                                                        <TableCell className="py-2 pe-4 text-end">
                                                            <DropdownMenu modal={false}>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        aria-label={`Open actions for ${record.email || 'this subscription'}`}
                                                                        data-tooltip="Subscription actions"
                                                                    >
                                                                        <DotsThreeVertical weight="bold" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="min-w-[200px]">
                                                                    <DropdownMenuItem
                                                                        onSelect={() => {
                                                                            setOpenSubscription(record);
                                                                            trackEvent('admin__billing_subscription--details');
                                                                        }}
                                                                        {...getAnalyticsDebugAttributes('admin__billing_subscription--details')}
                                                                    >
                                                                        View details
                                                                    </DropdownMenuItem>
                                                                    {record.user_id ? (
                                                                        <DropdownMenuItem
                                                                            onSelect={() => {
                                                                                trackEvent('admin__billing_subscription--open_user');
                                                                                navigate(`/admin/users?user=${encodeURIComponent(record.user_id)}&drawer=user`);
                                                                            }}
                                                                            {...getAnalyticsDebugAttributes('admin__billing_subscription--open_user')}
                                                                        >
                                                                            Open user
                                                                        </DropdownMenuItem>
                                                                    ) : null}
                                                                    {record.provider_subscription_id ? (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                disabled={isReconciling}
                                                                                onSelect={() => void handleReconcile(record.provider_subscription_id as string)}
                                                                                {...getAnalyticsDebugAttributes('admin__billing_subscription--reconcile')}
                                                                            >
                                                                                Reconcile with Paddle
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    ) : null}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    <AdminPagination
                                        className="px-4 pb-4"
                                        page={subscriptionPageSlice.page}
                                        pageSize={PAGE_SIZE}
                                        totalItems={filteredSubscriptions.length}
                                        onPageChange={setSubscriptionPage}
                                        noun="subscriptions"
                                    />
                                </>
                            )}
                        </TabsContent>

                        <TabsContent value="events" className="flex flex-col gap-3 pt-3">
                            <div className="flex flex-wrap items-center gap-2 px-4">
                                <AdminFilterMenu
                                    label="Webhook status"
                                    options={eventStatusOptions}
                                    selectedValues={selectedEventStatuses}
                                    onSelectedValuesChange={(values) => {
                                        setSelectedEventStatuses(values);
                                        setEventPage(1);
                                    }}
                                />
                                <AdminFilterMenu
                                    label="User link"
                                    options={eventLinkOptions}
                                    selectedValues={selectedEventLinks}
                                    onSelectedValuesChange={(values) => {
                                        setSelectedEventLinks(values);
                                        setEventPage(1);
                                    }}
                                />
                                {hasEventFilters ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setSelectedEventStatuses([]);
                                            setSelectedEventLinks([]);
                                            setEventPage(1);
                                        }}
                                    >
                                        Reset
                                    </Button>
                                ) : null}
                            </div>

                            {!showInitialLoading && filteredEvents.length === 0 ? (
                                <AdminEmptyState
                                    className="mx-4 mb-4"
                                    icon={<WarningCircle />}
                                    title="No webhook events match"
                                    description={searchValue.trim() || hasEventFilters
                                        ? 'Clear the search or the filters to see every stored event.'
                                        : 'Paddle may never have reached the webhook endpoint, the notification was not sent for simulation traffic, or signature verification failed before the event could be stored.'}
                                />
                            ) : (
                                <>
                                    <Table className="min-w-[820px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="ps-4">Event</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>User</TableHead>
                                                <TableHead>Occurred</TableHead>
                                                <TableHead className="w-24 pe-4"><span className="sr-only">Actions</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {showInitialLoading ? (
                                                <LoadingRow colSpan={5} label="Loading webhook events…" />
                                            ) : eventPageSlice.items.map((record) => {
                                                const isFailed = resolveAdminBillingWebhookStatusKey(record) === 'failed';
                                                return (
                                                    <TableRow key={record.event_id} className="align-top">
                                                        <TableCell className="max-w-[300px] py-3 ps-4">
                                                            <div className="truncate font-medium text-foreground">{humanizeAdminBillingEventType(record.event_type)}</div>
                                                            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{record.event_id}</div>
                                                        </TableCell>
                                                        <TableCell className="max-w-[280px] py-3">
                                                            <AdminBillingStatusBadge status={record.status} />
                                                            {isFailed && record.error_message ? (
                                                                <p className="mt-1 line-clamp-2 text-xs text-rose-700 dark:text-rose-300">{record.error_message}</p>
                                                            ) : null}
                                                        </TableCell>
                                                        <TableCell className="max-w-[240px] py-3">
                                                            {record.user_id ? (
                                                                <Link
                                                                    to={`/admin/users?user=${encodeURIComponent(record.user_id)}&drawer=user`}
                                                                    className="block truncate text-foreground hover:text-accent-700 hover:underline dark:hover:text-accent-200"
                                                                >
                                                                    {record.user_email || 'Linked user'}
                                                                </Link>
                                                            ) : (
                                                                <AdminStatusBadge tone="warning">No linked user</AdminStatusBadge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-sm text-muted-foreground">
                                                            <RelativeTime value={record.occurred_at} />
                                                        </TableCell>
                                                        <TableCell className="py-2 pe-4 text-end">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                aria-label={`Inspect ${humanizeAdminBillingEventType(record.event_type)} event ${record.event_id}`}
                                                                onClick={() => {
                                                                    setOpenEvent(record);
                                                                    trackEvent('admin__billing_event--details');
                                                                }}
                                                                {...getAnalyticsDebugAttributes('admin__billing_event--details')}
                                                            >
                                                                Inspect
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                    <AdminPagination
                                        className="px-4 pb-4"
                                        page={eventPageSlice.page}
                                        pageSize={PAGE_SIZE}
                                        totalItems={filteredEvents.length}
                                        onPageChange={setEventPage}
                                        noun="events"
                                    />
                                </>
                            )}
                        </TabsContent>
                    </Tabs>
                </AdminSurfaceCard>

                {dashboard ? (
                    <>
                        <div className="grid gap-4 xl:grid-cols-3">
                            <AdminSurfaceCard className="flex flex-col gap-4 xl:col-span-2">
                                <AdminSectionHeader
                                    title="Current MRR by tier"
                                    description="Monthly recurring revenue by tier and currency. Canceled access grace is excluded."
                                />
                                {mrrByTierChartData.length > 0 ? (
                                    <AdminBarChart
                                        data={mrrByTierChartData}
                                        index="label"
                                        categories={['MRR']}
                                        colors={['indigo']}
                                        showLegend={false}
                                        yAxisWidth={80}
                                        valueFormatter={formatMajorAmount}
                                        className="h-72"
                                        ariaLabel="Bar chart of current monthly recurring revenue by tier and currency"
                                    />
                                ) : (
                                    <AdminEmptyState title="No recurring revenue yet" description="MRR appears after the first paid subscription syncs." />
                                )}
                            </AdminSurfaceCard>

                            <AdminSurfaceCard className="flex flex-col gap-4">
                                <AdminSectionHeader
                                    title="At-risk revenue"
                                    description="Revenue exposed to churn or collection risk, by status."
                                />
                                {atRiskListItems.length > 0 ? (
                                    <AdminBarList data={atRiskListItems} color="rose" ariaLabel="At-risk revenue by status" />
                                ) : (
                                    <AdminEmptyState title="No revenue at risk" />
                                )}
                            </AdminSurfaceCard>
                        </div>

                        <AdminSurfaceCard className="flex flex-col gap-4">
                            <AdminSectionHeader title="Subscription mix" description="Synced subscriptions by plan and by billing status." />
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-xs font-medium text-muted-foreground">By plan</h3>
                                    {tierMixListItems.length > 0 ? (
                                        <AdminBarList data={tierMixListItems} sortOrder="none" ariaLabel="Paid subscriptions by plan tier" />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No paid subscriptions yet.</p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-xs font-medium text-muted-foreground">By status</h3>
                                    {statusMixListItems.length > 0 ? (
                                        <AdminBarList data={statusMixListItems} sortOrder="none" ariaLabel="Subscriptions by billing lifecycle status" />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No synced subscriptions yet.</p>
                                    )}
                                </div>
                            </div>
                        </AdminSurfaceCard>
                    </>
                ) : null}
            </div>

            <AdminBillingSubscriptionSheet
                record={openSubscription}
                onOpenChange={(open) => { if (!open) setOpenSubscription(null); }}
                isReconciling={isReconciling}
                onReconcile={(subscriptionId) => void handleReconcile(subscriptionId)}
            />
            <AdminBillingWebhookEventSheet
                record={openEvent}
                onOpenChange={(open) => { if (!open) setOpenEvent(null); }}
                isReconciling={isReconciling}
                onReconcile={(subscriptionId) => void handleReconcile(subscriptionId)}
            />
        </AdminShell>
    );
};
