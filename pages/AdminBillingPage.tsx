import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, LinkBreak, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router-dom';

import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import {
    adminListBillingSubscriptions,
    adminListBillingWebhookEvents,
    type AdminBillingSubscriptionRecord,
    type AdminBillingWebhookEventRecord,
} from '../services/adminService';
import {
    adminBillingStatusClassName,
    filterAdminBillingSubscriptionsByRange,
    filterAdminBillingWebhookEventsByRange,
    formatAdminBillingAmount,
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

const humanizeTierKey = (value: string | null | undefined): string => {
    const normalized = (value || '').trim();
    if (!normalized) return 'Free';
    if (normalized === 'tier_mid') return 'Explorer';
    if (normalized === 'tier_premium') return 'Globetrotter';
    if (normalized === 'tier_free') return 'Backpacker';
    return normalized.replace(/^tier_/, '').replace(/[_-]+/g, ' ');
};

const humanizeEventType = (value: string | null | undefined): string => {
    const normalized = (value || '').trim();
    if (!normalized) return 'Unknown';
    return normalized.replace(/[._]+/g, ' ');
};

const humanizeStatus = (value: string | null | undefined): string => {
    const normalized = (value || '').trim();
    if (!normalized) return 'Unknown';
    return normalized.replace(/[_-]+/g, ' ');
};

const statusPill = (value: string | null | undefined) => {
    const tone = resolveAdminBillingStatusTone(value);
    return [
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize',
        adminBillingStatusClassName(tone),
    ].join(' ');
};

const SUBSCRIPTIONS_CACHE_LIMIT = 250;
const EVENTS_CACHE_LIMIT = 250;

export const AdminBillingPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [subscriptions, setSubscriptions] = useState<AdminBillingSubscriptionRecord[]>([]);
    const [events, setEvents] = useState<AdminBillingWebhookEventRecord[]>([]);
    const [selectedSubscriptionStatuses, setSelectedSubscriptionStatuses] = useState<string[]>([]);
    const [selectedEventStatuses, setSelectedEventStatuses] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            const [nextSubscriptions, nextEvents] = await Promise.all([
                adminListBillingSubscriptions({ limit: SUBSCRIPTIONS_CACHE_LIMIT, search: searchValue || undefined }),
                adminListBillingWebhookEvents({ limit: EVENTS_CACHE_LIMIT, search: searchValue || undefined }),
            ]);
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
            const key = (record.provider_status || record.subscription_status || 'unknown').trim().toLowerCase() || 'unknown';
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([value, count]) => ({
                value,
                label: humanizeStatus(value),
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
                label: humanizeStatus(value),
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
            const key = (record.provider_status || record.subscription_status || 'unknown').trim().toLowerCase() || 'unknown';
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

    return (
        <AdminShell
            title="Billing"
            description="Inspect subscription state, webhook delivery, and Paddle sync issues without leaving the admin workspace."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadData()}
                    isLoading={isLoading}
                    label="Reload"
                />
            )}
        >
            {errorMessage ? (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {errorMessage}
                </section>
            ) : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminSurfaceCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Active paid</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                <AdminCountUpNumber value={metrics.activeSubscriptions} />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Current paid subscriptions in the selected window.</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent-200 bg-accent-50 text-accent-700">
                            <ShieldCheck size={18} weight="duotone" />
                        </span>
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">Grace period</p>
                            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                <AdminCountUpNumber value={metrics.graceSubscriptions} />
                            </div>
                            <p className="mt-2 text-sm text-slate-500">Canceled subscriptions that still retain access.</p>
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
                                <AdminCountUpNumber value={metrics.failedWebhookEvents} />
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
                        <p className="py-8 text-sm text-slate-500">No billing subscriptions found for this filter set.</p>
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
                                                    <span className={statusPill(record.provider_status || record.subscription_status)}>
                                                        {humanizeStatus(record.provider_status || record.subscription_status)}
                                                    </span>
                                                    <span className="text-xs text-slate-500">App: {humanizeStatus(record.subscription_status)}</span>
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
                        <p className="py-8 text-sm text-slate-500">No billing webhook events found for this filter set.</p>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {filteredEvents.map((record) => (
                                <article key={record.event_id} className="py-4 first:pt-5 last:pb-0">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-slate-900">{humanizeEventType(record.event_type)}</span>
                                                <span className={statusPill(record.status)}>{humanizeStatus(record.status)}</span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
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
                                        </div>
                                        <span className="truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                                            {record.event_id}
                                        </span>
                                    </div>

                                    {record.error_message ? (
                                        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                                            {record.error_message}
                                        </p>
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
                                </article>
                            ))}
                        </div>
                    )}
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
