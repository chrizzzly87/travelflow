import React from 'react';
import { ArrowsClockwise, UserCircle } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';

import { AdminDetailSheet } from './AdminDetailSheet';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminStatusBadge } from './AdminStatusBadge';
import { CopyableUuid } from './CopyableUuid';
import { Button } from '../ui/button';
import type { AdminBillingSubscriptionRecord, AdminBillingWebhookEventRecord } from '../../services/adminService';
import {
    extractAdminBillingWebhookSubscriptionId,
    formatAdminBillingAmount,
    humanizeAdminBillingStatus,
    humanizeTierKey,
    normalizeAdminBillingStatus,
    resolveAdminBillingLifecycleStatus,
    resolveAdminBillingStatusTone,
} from '../../services/adminBillingPresentation';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatAdminBillingDateTime = (value: string | null | undefined): string => {
    if (!value) return '—';
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return '—';
    return dateTimeFormatter.format(new Date(timestamp));
};

export const humanizeAdminBillingEventType = (value: string | null | undefined): string => {
    const normalized = (value || '').trim();
    if (!normalized) return 'Unknown';
    const spaced = normalized.replace(/[._]+/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const AdminBillingStatusBadge: React.FC<{ status: string | null | undefined }> = ({ status }) => (
    <AdminStatusBadge tone={resolveAdminBillingStatusTone(normalizeAdminBillingStatus(status))}>
        {humanizeAdminBillingStatus(status)}
    </AdminStatusBadge>
);

export const adminBillingWebhookMessageClassName = (status: string | null | undefined): string => {
    const normalizedStatus = normalizeAdminBillingStatus(status);
    if (normalizedStatus === 'failed') {
        return 'rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30';
    }
    if (normalizedStatus === 'past_due' || normalizedStatus === 'paused' || normalizedStatus === 'ignored') {
        return 'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30';
    }
    if (normalizedStatus === 'processed' || normalizedStatus === 'received') {
        return 'rounded-md border border-accent-200 bg-accent-50/70 px-3 py-2 text-sm text-foreground dark:bg-accent-400/12 dark:border-accent-400/30';
    }
    return 'rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground';
};

export const adminBillingWebhookMessageLabel = (status: string | null | undefined): string => {
    const normalizedStatus = normalizeAdminBillingStatus(status);
    if (normalizedStatus === 'failed') return 'Delivery error';
    if (normalizedStatus === 'past_due' || normalizedStatus === 'paused' || normalizedStatus === 'ignored') return 'Needs attention';
    if (normalizedStatus === 'processed' || normalizedStatus === 'received') return 'Sync note';
    return 'Event note';
};

const formatPayloadJson = (value: Record<string, unknown> | null | undefined): string => {
    if (!value) return '';
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return '{}';
    }
};

const userHref = (userId: string): string => `/admin/users?user=${encodeURIComponent(userId)}&drawer=user`;

/** A two-column term/value list for the sheet body. */
const DetailList: React.FC<{ rows: Array<{ label: string; value: React.ReactNode }> }> = ({ rows }) => (
    <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {rows.map((row) => (
            <React.Fragment key={row.label}>
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
            </React.Fragment>
        ))}
    </dl>
);

const IdValue: React.FC<{ value: string | null | undefined }> = ({ value }) => (
    value
        ? <CopyableUuid value={value} textClassName="font-mono text-xs text-foreground" hintClassName="text-[10px]" />
        : <span className="text-muted-foreground">—</span>
);

interface ReconcileProps {
    isReconciling: boolean;
    onReconcile: (subscriptionId: string) => void;
}

export const AdminBillingSubscriptionSheet: React.FC<ReconcileProps & {
    record: AdminBillingSubscriptionRecord | null;
    onOpenChange: (open: boolean) => void;
}> = ({ record, onOpenChange, isReconciling, onReconcile }) => {
    if (!record) return null;
    const lifecycle = resolveAdminBillingLifecycleStatus(record);
    const appStatus = normalizeAdminBillingStatus(record.subscription_status);
    return (
        <AdminDetailSheet
            open
            onOpenChange={onOpenChange}
            size="md"
            title={record.email || 'Unknown user'}
            subtitle={humanizeTierKey(record.tier_key)}
            meta={<AdminBillingStatusBadge status={lifecycle} />}
            footer={(
                <>
                    {record.provider_subscription_id ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={isReconciling}
                            onClick={() => onReconcile(record.provider_subscription_id as string)}
                            {...getAnalyticsDebugAttributes('admin__billing_subscription--reconcile')}
                        >
                            <ArrowsClockwise weight="bold" />
                            Reconcile with Paddle
                        </Button>
                    ) : null}
                    {record.user_id ? (
                        <Button asChild type="button" size="sm" variant="outline">
                            <Link to={userHref(record.user_id)} {...getAnalyticsDebugAttributes('admin__billing_subscription--open_user')}>
                                <UserCircle />
                                Open user
                            </Link>
                        </Button>
                    ) : null}
                </>
            )}
        >
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="Subscription" />
                <DetailList
                    rows={[
                        { label: 'Amount', value: <span className="tabular-nums">{formatAdminBillingAmount(record.amount, record.currency)}</span> },
                        { label: 'Paddle status', value: humanizeAdminBillingStatus(record.provider_status) },
                        {
                            label: 'App status',
                            value: appStatus === normalizeAdminBillingStatus(record.provider_status)
                                ? humanizeAdminBillingStatus(record.subscription_status)
                                : <span className="text-amber-700 dark:text-amber-200">{humanizeAdminBillingStatus(record.subscription_status)} (differs from Paddle)</span>,
                        },
                        { label: 'Current period', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.current_period_start)} – {formatAdminBillingDateTime(record.current_period_end)}</span> },
                        { label: 'Cancels at', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.cancel_at)}</span> },
                        { label: 'Canceled at', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.canceled_at)}</span> },
                        { label: 'Grace ends', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.grace_ends_at)}</span> },
                    ]}
                />
            </section>
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="Paddle references" />
                <DetailList
                    rows={[
                        { label: 'Subscription ID', value: <IdValue value={record.provider_subscription_id} /> },
                        { label: 'Customer ID', value: <IdValue value={record.provider_customer_id} /> },
                        { label: 'Price ID', value: <IdValue value={record.provider_price_id} /> },
                        { label: 'User ID', value: <IdValue value={record.user_id} /> },
                    ]}
                />
            </section>
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="Last event" />
                <DetailList
                    rows={[
                        { label: 'Type', value: humanizeAdminBillingEventType(record.last_event_type) },
                        { label: 'Received', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.last_event_at)}</span> },
                        { label: 'Event ID', value: <IdValue value={record.last_event_id} /> },
                    ]}
                />
            </section>
        </AdminDetailSheet>
    );
};

export const AdminBillingWebhookEventSheet: React.FC<ReconcileProps & {
    record: AdminBillingWebhookEventRecord | null;
    onOpenChange: (open: boolean) => void;
}> = ({ record, onOpenChange, isReconciling, onReconcile }) => {
    if (!record) return null;
    const subscriptionId = extractAdminBillingWebhookSubscriptionId(record);
    const payloadJson = formatPayloadJson(record.payload);
    return (
        <AdminDetailSheet
            open
            onOpenChange={onOpenChange}
            title={humanizeAdminBillingEventType(record.event_type)}
            subtitle={<span className="font-mono text-xs">{record.event_id}</span>}
            accessibleTitle={humanizeAdminBillingEventType(record.event_type)}
            meta={<AdminBillingStatusBadge status={record.status} />}
            footer={(subscriptionId || record.user_id) ? (
                <>
                    {subscriptionId ? (
                        <Button
                            type="button"
                            size="sm"
                            disabled={isReconciling}
                            onClick={() => onReconcile(subscriptionId)}
                            {...getAnalyticsDebugAttributes('admin__billing_event--reconcile')}
                        >
                            <ArrowsClockwise weight="bold" />
                            Reconcile {subscriptionId}
                        </Button>
                    ) : null}
                    {record.user_id ? (
                        <Button asChild type="button" size="sm" variant="outline">
                            <Link to={userHref(record.user_id)} {...getAnalyticsDebugAttributes('admin__billing_event--open_user')}>
                                <UserCircle />
                                Open user
                            </Link>
                        </Button>
                    ) : null}
                </>
            ) : undefined}
        >
            {record.error_message ? (
                <div className={adminBillingWebhookMessageClassName(record.status)}>
                    <p className="text-xs font-medium opacity-80">{adminBillingWebhookMessageLabel(record.status)}</p>
                    <p className="mt-1 break-words">{record.error_message}</p>
                </div>
            ) : null}
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="Delivery" />
                <DetailList
                    rows={[
                        { label: 'Occurred', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.occurred_at)}</span> },
                        { label: 'Processed', value: <span className="tabular-nums">{formatAdminBillingDateTime(record.processed_at)}</span> },
                        { label: 'Provider', value: record.provider || '—' },
                        { label: 'Subscription ID', value: <IdValue value={subscriptionId} /> },
                    ]}
                />
            </section>
            <section className="flex flex-col gap-3">
                <AdminSectionHeader as="h3" title="User" />
                {record.user_id ? (
                    <DetailList
                        rows={[
                            { label: 'Email', value: record.user_email || '—' },
                            { label: 'User ID', value: <IdValue value={record.user_id} /> },
                        ]}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        This event did not resolve to a TravelFlow user. Check the payload&apos;s custom data, then reconcile the subscription.
                    </p>
                )}
            </section>
            {payloadJson ? (
                <section className="flex flex-col gap-3">
                    <AdminSectionHeader as="h3" title="Payload JSON" />
                    <pre className="max-h-96 overflow-auto rounded-md border border-border bg-slate-900 p-3 text-[11px] leading-5 text-slate-100 dark:bg-slate-950">
                        {payloadJson}
                    </pre>
                </section>
            ) : null}
        </AdminDetailSheet>
    );
};
