import { isIsoDateInRange } from '../components/admin/adminDateRange';
import type { AdminDateRange } from '../components/admin/AdminShell';
import type { AdminBillingSubscriptionRecord, AdminBillingWebhookEventRecord } from './adminService';

export type AdminBillingStatusTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

const BILLING_STATUS_SYNONYMS: Record<string, string> = {
    cancelled: 'canceled',
};

const MINOR_UNIT_SCALE_FALLBACK = 100;

const isPositiveFiniteInteger = (value: number | null | undefined): value is number => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0
);

export const filterAdminBillingSubscriptionsByRange = (
    records: AdminBillingSubscriptionRecord[],
    dateRange: AdminDateRange,
): AdminBillingSubscriptionRecord[] => records.filter((record) => isIsoDateInRange(record.updated_at || record.created_at, dateRange));

export const filterAdminBillingWebhookEventsByRange = (
    records: AdminBillingWebhookEventRecord[],
    dateRange: AdminDateRange,
): AdminBillingWebhookEventRecord[] => records.filter((record) => isIsoDateInRange(record.occurred_at || record.created_at, dateRange));

export const isAdminBillingGraceActive = (record: Pick<AdminBillingSubscriptionRecord, 'grace_ends_at'>, nowMs = Date.now()): boolean => {
    if (!record.grace_ends_at) return false;
    const graceEndsAtMs = Date.parse(record.grace_ends_at);
    return Number.isFinite(graceEndsAtMs) && graceEndsAtMs > nowMs;
};

export const isAdminBillingSubscriptionActive = (
    record: Pick<AdminBillingSubscriptionRecord, 'subscription_status' | 'provider_status' | 'grace_ends_at'>,
    nowMs = Date.now(),
): boolean => {
    const internalStatus = (record.subscription_status || '').trim().toLowerCase();
    if (internalStatus === 'active' || internalStatus === 'trialing' || internalStatus === 'past_due') {
        return true;
    }

    const providerStatus = (record.provider_status || '').trim().toLowerCase();
    if (providerStatus === 'active' || providerStatus === 'trialing' || providerStatus === 'past_due') {
        return true;
    }

    return isAdminBillingGraceActive({ grace_ends_at: record.grace_ends_at }, nowMs);
};

export const formatAdminBillingAmount = (
    amount: number | null,
    currency: string | null,
    locale = 'en-US',
): string => {
    if (!isPositiveFiniteInteger(amount) || !currency?.trim()) return '—';
    const normalizedCurrency = currency.trim().toUpperCase();

    try {
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: normalizedCurrency,
        });
        const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
        const divisor = 10 ** fractionDigits;
        const majorAmount = divisor > 0 ? amount / divisor : amount / MINOR_UNIT_SCALE_FALLBACK;
        return formatter.format(majorAmount);
    } catch {
        return `${normalizedCurrency} ${amount}`;
    }
};

export const normalizeAdminBillingStatus = (
    providerStatus: string | null | undefined,
    subscriptionStatus?: string | null | undefined,
): string => {
    const normalized = (providerStatus || subscriptionStatus || '').trim().toLowerCase();
    if (!normalized) return 'none';
    return BILLING_STATUS_SYNONYMS[normalized] || normalized;
};

export const humanizeAdminBillingStatus = (value: string | null | undefined): string => {
    const normalized = normalizeAdminBillingStatus(value);
    if (normalized === 'none') return 'No subscription';
    if (normalized === 'past_due') return 'Past due';
    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const summarizeAdminBilling = (
    subscriptions: AdminBillingSubscriptionRecord[],
    events: AdminBillingWebhookEventRecord[],
    nowMs = Date.now(),
) => ({
    totalSubscriptions: subscriptions.length,
    activeSubscriptions: subscriptions.filter((record) => isAdminBillingSubscriptionActive(record, nowMs)).length,
    graceSubscriptions: subscriptions.filter((record) => isAdminBillingGraceActive(record, nowMs)).length,
    canceledSubscriptions: subscriptions.filter((record) => (record.provider_status || '').trim().toLowerCase() === 'canceled').length,
    failedWebhookEvents: events.filter((record) => (record.status || '').trim().toLowerCase() === 'failed').length,
    unlinkedWebhookEvents: events.filter((record) => !record.user_id).length,
});

export const resolveAdminBillingStatusTone = (status: string | null | undefined): AdminBillingStatusTone => {
    const normalized = normalizeAdminBillingStatus(status);
    if (normalized === 'active' || normalized === 'processed' || normalized === 'trialing') return 'accent';
    if (normalized === 'past_due' || normalized === 'ignored' || normalized === 'paused') return 'warning';
    if (normalized === 'failed' || normalized === 'canceled' || normalized === 'cancelled') return 'danger';
    if (normalized === 'received') return 'success';
    return 'neutral';
};

export const adminBillingStatusClassName = (tone: AdminBillingStatusTone): string => {
    if (tone === 'accent') return 'border-accent-200 bg-accent-50 text-accent-800';
    if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (tone === 'danger') return 'border-rose-200 bg-rose-50 text-rose-800';
    return 'border-slate-200 bg-slate-100 text-slate-700';
};
