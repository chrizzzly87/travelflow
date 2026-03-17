import React, { useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, CreditCard, LinkBreak, ShieldCheck, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import { BarChart, BarList, DonutChart, Metric, Text, Title } from '@tremor/react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAppDialog } from '../components/AppDialogProvider';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { CopyableUuid } from '../components/admin/CopyableUuid';
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
    adminBillingStatusClassName,
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

const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(timestamp));
};

const formatCompactDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
    }).format(new Date(timestamp));
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

const statusPill = (value: string | null | undefined) => {
    const tone = resolveAdminBillingStatusTone(normalizeAdminBillingStatus(value));
    return [
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
        adminBillingStatusClassName(tone),
    ].join(' ');
};

const webhookMessageClassName = (status: string | null | undefined) => {
    const normalizedStatus = normalizeAdminBillingStatus(status);
    if (normalizedStatus === 'failed') {
        return 'mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900';
    }
    if (normalizedStatus === 'past_due' || normalizedStatus === 'paused' || normalizedStatus === 'ignored') {
        return 'mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900';
    }
    if (normalizedStatus === 'processed' || normalizedStatus === 'received') {
        return 'mt-3 rounded-lg border border-accent-200 bg-accent-50/70 px-3 py-2 text-sm text-slate-800';
    }
    return 'mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700';
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

    return (
        <AdminShell
            title="Billing"
            description="Inspect subscription state, webhook delivery, and Paddle sync issues without leaving the admin workspace."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void handleReconcile()}
                        disabled={isReconciling}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isReconciling ? <SpinnerGap size={14} className="animate-spin" /> : <ArrowsClockwise size={14} weight="bold" />}
                        Reconcile Paddle
                    </button>
                    <AdminReloadButton
                        onClick={() => void loadData()}
                        isLoading={isLoading}
                        label="Reload"
                    />
                </div>
            )}
        >
            {errorMessage ? (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {errorMessage}
                </section>
            ) : null}

            {lastReconcileSummary ? (
                <section className="mb-4 rounded-2xl border border-accent-200 bg-accent-50/70 px-4 py-4 text-sm text-slate-800 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-semibold text-slate-900">Latest Paddle reconciliation</p>
                            <p className="mt-1 text-slate-600">
                                {lastReconcileSubscriptionId
                                    ? `Fetched ${lastReconcileSubscriptionId} and replayed it through the billing sync.`
                                    : `Fetched ${lastReconcileSummary.fetched} subscriptions and replayed ${lastReconcileSummary.eligible} eligible records through the billing sync.`}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Processed {lastReconcileSummary.processed}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Duplicates {lastReconcileSummary.duplicates}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Unresolved {lastReconcileSummary.unresolved}</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Failed {lastReconcileSummary.failed}</span>
                        </div>
                    </div>
                </section>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminSurfaceCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Active paid</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                <AdminCountUpNumber value={dashboard?.active_subscriptions ?? metrics.activeSubscriptions} />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Current MRR-eligible subscriptions after the latest billing sync.</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent-200 bg-accent-50 text-accent-700">
                            <ShieldCheck size={18} weight="duotone" />
                        </span>
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Scheduled cancellations</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                <AdminCountUpNumber value={(dashboard?.scheduled_cancellations ?? 0) + (dashboard?.grace_subscriptions ?? metrics.graceSubscriptions)} />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Includes subscriptions scheduled to cancel and grace-access accounts.</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                            <CreditCard size={18} weight="duotone" />
                        </span>
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Failed webhooks</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                <AdminCountUpNumber value={dashboard?.failed_webhook_events ?? metrics.failedWebhookEvents} />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Events that need replay or payload inspection.</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700">
                            <WarningCircle size={18} weight="duotone" />
                        </span>
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Unlinked events</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                <AdminCountUpNumber value={metrics.unlinkedWebhookEvents} />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Webhook records that did not resolve to a TravelFlow user.</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700">
                            <LinkBreak size={18} weight="duotone" />
                        </span>
                    </div>
                </AdminSurfaceCard>
            </div>

            {dashboard ? (
                <>
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {dashboardCurrentMrrCards.map((card) => (
                            <AdminSurfaceCard key={`mrr-${card.currency}`}>
                                <Text>Current MRR ({card.currency})</Text>
                                <Metric className="mt-2">{card.amountLabel}</Metric>
                                <Text className="mt-2">{card.subscriptions} running subscriptions</Text>
                            </AdminSurfaceCard>
                        ))}
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-2">
                        <AdminSurfaceCard>
                            <div className="space-y-4">
                                <div>
                                    <Title>Current MRR by tier</Title>
                                    <Text>Current monthly recurring revenue grouped by tier and currency. Canceled access grace is excluded.</Text>
                                </div>
                                {dashboardMrrByTierData.length > 0 ? (
                                    <BarChart
                                        data={dashboardMrrByTierData}
                                        index="label"
                                        categories={['amount']}
                                        colors={['indigo']}
                                        valueFormatter={(value) => Number(value).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                        yAxisWidth={72}
                                        className="h-72"
                                    />
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                                        No MRR chart data yet.
                                    </div>
                                )}
                            </div>
                        </AdminSurfaceCard>

                        <AdminSurfaceCard>
                            <div className="space-y-4">
                                <div>
                                    <Title>At-risk revenue</Title>
                                    <Text>Revenue currently exposed to churn or collection risk, grouped by status bucket.</Text>
                                </div>
                                {dashboardAtRiskData.length > 0 ? (
                                    <BarList
                                        data={dashboardAtRiskData}
                                        className="h-72"
                                        color="rose"
                                        valueFormatter={(value) => Number(value).toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    />
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                                        No at-risk revenue recorded in the selected data set.
                                    </div>
                                )}
                            </div>
                        </AdminSurfaceCard>
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-2">
                        <AdminSurfaceCard>
                            <div className="space-y-4">
                                <div>
                                    <Title>Subscription mix</Title>
                                    <Text>Paid subscription distribution by plan tier.</Text>
                                </div>
                                {dashboardTierMixData.length > 0 ? (
                                    <DonutChart
                                        data={dashboardTierMixData}
                                        category="count"
                                        index="tier"
                                        colors={['indigo', 'amber', 'slate']}
                                        valueFormatter={(value) => `${value}`}
                                        className="h-72"
                                    />
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                                        No subscription mix data yet.
                                    </div>
                                )}
                            </div>
                        </AdminSurfaceCard>

                        <AdminSurfaceCard>
                            <div className="space-y-4">
                                <div>
                                    <Title>Status mix</Title>
                                    <Text>Billing lifecycle distribution across currently synced subscriptions.</Text>
                                </div>
                                {dashboardStatusMixData.length > 0 ? (
                                    <DonutChart
                                        data={dashboardStatusMixData}
                                        category="count"
                                        index="status"
                                        colors={['emerald', 'indigo', 'amber', 'rose', 'slate']}
                                        valueFormatter={(value) => `${value}`}
                                        className="h-72"
                                    />
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                                        No status mix data yet.
                                    </div>
                                )}
                            </div>
                        </AdminSurfaceCard>
                    </div>
                </>
            ) : null}

            <section className="mt-6 flex flex-wrap items-center gap-2">
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
            </section>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <AdminSurfaceCard className="min-w-0">
                    <div className="flex items-end justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Subscriptions</h2>
                            <p className="mt-1 text-sm text-slate-500">Current billing state per user after webhook sync.</p>
                        </div>
                        <span className="text-sm text-slate-500">{filteredSubscriptions.length} rows</span>
                    </div>

                    {filteredSubscriptions.length === 0 ? (
                        <div className="py-8 text-sm text-slate-500">
                            <p>No billing subscriptions found for this filter set.</p>
                            {searchValue.trim() || selectedSubscriptionStatuses.length > 0 ? null : (
                                <p className="mt-2 text-xs leading-5 text-slate-400">
                                    If a sandbox checkout already completed, replay the latest Paddle notification and confirm this deploy can receive simulation events.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[860px] w-full border-separate border-spacing-0 text-left text-sm">
                                <thead>
                                    <tr className="text-slate-500">
                                        <th className="border-b border-slate-200 py-3 pe-4 font-semibold">User</th>
                                        <th className="border-b border-slate-200 py-3 pe-4 font-semibold">Plan</th>
                                        <th className="border-b border-slate-200 py-3 pe-4 font-semibold">Status</th>
                                        <th className="border-b border-slate-200 py-3 pe-4 font-semibold">Amount</th>
                                        <th className="border-b border-slate-200 py-3 pe-4 font-semibold">Renews</th>
                                        <th className="border-b border-slate-200 py-3 pe-4 font-semibold">Last event</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSubscriptions.map((record) => (
                                        <tr key={record.user_id} className="align-top text-slate-700">
                                            <td className="border-b border-slate-200 py-4 pe-4">
                                                <div className="min-w-0">
                                                    {record.user_id ? (
                                                        <Link
                                                            to={`/admin/users?user=${encodeURIComponent(record.user_id)}&drawer=user`}
                                                            className="block truncate font-semibold text-slate-900 hover:text-accent-700 hover:underline"
                                                        >
                                                            {record.email || 'Unknown user'}
                                                        </Link>
                                                    ) : (
                                                        <span className="block truncate font-semibold text-slate-900">{record.email || 'Unknown user'}</span>
                                                    )}
                                                    <div className="mt-1">
                                                        <CopyableUuid value={record.user_id} textClassName="text-xs text-slate-500" hintClassName="text-[10px]" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border-b border-slate-200 py-4 pe-4">
                                                <div className="font-semibold text-slate-900">{humanizeTierKey(record.tier_key)}</div>
                                                <div className="mt-1 font-mono text-xs text-slate-500">{record.provider_price_id || 'No price id'}</div>
                                            </td>
                                            <td className="border-b border-slate-200 py-4 pe-4">
                                                <div className="flex flex-col gap-2">
                                                    <span className={statusPill(resolveAdminBillingLifecycleStatus(record))}>
                                                        {humanizeAdminBillingStatus(resolveAdminBillingLifecycleStatus(record))}
                                                    </span>
                                                    <span className="text-xs text-slate-500">App: {humanizeAdminBillingStatus(record.subscription_status)}</span>
                                                </div>
                                            </td>
                                            <td className="border-b border-slate-200 py-4 pe-4">
                                                <div className="font-semibold text-slate-900">{formatAdminBillingAmount(record.amount, record.currency)}</div>
                                                <div className="mt-1 text-xs text-slate-500">{record.provider || 'Provider unknown'}</div>
                                            </td>
                                            <td className="border-b border-slate-200 py-4 pe-4">
                                                <div className="font-medium text-slate-900">{formatCompactDate(record.current_period_end)}</div>
                                                {record.grace_ends_at ? (
                                                    <div className="mt-1 text-xs text-amber-700">Grace until {formatCompactDate(record.grace_ends_at)}</div>
                                                ) : null}
                                            </td>
                                            <td className="border-b border-slate-200 py-4 pe-4">
                                                <div className="font-medium text-slate-900">{humanizeEventType(record.last_event_type)}</div>
                                                <div className="mt-1 text-xs text-slate-500">{formatDateTime(record.last_event_at)}</div>
                                                <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{record.provider_subscription_id || 'No subscription id'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </AdminSurfaceCard>

                <AdminSurfaceCard className="min-w-0">
                    <div className="flex items-end justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Webhook events</h2>
                            <p className="mt-1 text-sm text-slate-500">Most recent Paddle delivery records stored for replay and debugging.</p>
                        </div>
                        <span className="text-sm text-slate-500">{filteredEvents.length} rows</span>
                    </div>

                    {filteredEvents.length === 0 ? (
                        <div className="py-8 text-sm text-slate-500">
                            <p>No billing webhook events found for this filter set.</p>
                            {searchValue.trim() || selectedEventStatuses.length > 0 ? null : (
                                <p className="mt-2 text-xs leading-5 text-slate-400">
                                    This usually means Paddle never reached the webhook endpoint, the notification was not sent for simulation traffic, or signature verification failed before the event could be stored.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {filteredEvents.map((record) => (
                                <article key={record.event_id} className="py-4 first:pt-5 last:pb-0">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-slate-900">{humanizeEventType(record.event_type)}</span>
                                            <span className={statusPill(record.status)}>{humanizeAdminBillingStatus(record.status)}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                            <span>{formatDateTime(record.occurred_at)}</span>
                                            <span>{record.provider}</span>
                                            {record.user_email && record.user_id ? (
                                                <Link
                                                    to={`/admin/users?user=${encodeURIComponent(record.user_id)}&drawer=user`}
                                                    className="font-medium text-slate-700 hover:text-accent-700 hover:underline"
                                                >
                                                    {record.user_email}
                                                </Link>
                                            ) : (
                                                <span>No linked user</span>
                                            )}
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Event ID</div>
                                            <div className="mt-1 break-all font-mono text-xs leading-5 text-slate-700">
                                                {record.event_id}
                                            </div>
                                        </div>
                                    </div>

                                    {record.error_message ? (
                                        <div className={webhookMessageClassName(record.status)}>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{webhookMessageLabel(record.status)}</p>
                                            <p className="mt-1">{record.error_message}</p>
                                        </div>
                                    ) : null}

                                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                                        <div>
                                            <span className="font-semibold text-slate-700">Processed:</span> {formatDateTime(record.processed_at)}
                                        </div>
                                        <div className="truncate">
                                            <span className="font-semibold text-slate-700">User ID:</span>{' '}
                                            {record.user_id ? <CopyableUuid value={record.user_id} textClassName="text-xs text-slate-500" hintClassName="text-[10px]" /> : '—'}
                                        </div>
                                    </div>

                                    {record.payload ? (
                                        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                                Payload JSON
                                            </summary>
                                            <pre className="mt-3 max-h-56 overflow-auto rounded border border-slate-200 bg-slate-900 p-3 text-[10px] text-slate-100">
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
        </AdminShell>
    );
};
