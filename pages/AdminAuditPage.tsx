import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminUserFacingError, toAdminErrorMessage } from '../services/adminErrorMessages';
import { ArrowSquareOut, CopySimple, Crosshair, DotsThreeVertical, DownloadSimple, Info, SpinnerGap, User, Warning, X } from '@phosphor-icons/react';
import { Link, useSearchParams } from '@/app/navigation';
import { AdminShell } from '../components/admin/AdminShell';
import type { PlanTierKey } from '../types';
import {
    adminGetUserChangeLog,
    adminExportAuditReplay,
    adminOverrideTripCommit,
    adminGetTripVersionSnapshots,
    adminGetUserProfile,
    adminListAuditLogs,
    adminListUserChangeLogs,
    adminListTrips,
    adminUpdatePlanEntitlements,
    adminUpdateTrip,
    adminUpdateUserOverrides,
    adminUpdateUserProfile,
    type AdminAuditRecord,
    type AdminTripRecord,
    type AdminUserChangeRecord,
    type AdminUserRecord,
} from '../services/adminService';
import { buildDecisionConfirmDialog } from '../services/appDialogPresets';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { ADMIN_TABLE_ROW_SURFACE_CLASS } from '../components/admin/AdminDataTableUtils';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminDetailSheet } from '../components/admin/AdminDetailSheet';
import { AdminSelectionBar } from '../components/admin/AdminSelectionBar';
import { AdminPagination } from '../components/admin/AdminPagination';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DateRangePicker } from '../components/DateRangePicker';
import { showAppToast } from '../components/ui/appToast';
import { AdminJsonDiffModal } from '../components/admin/AdminJsonDiffModal';
import { useAppDialog } from '../components/AppDialogProvider';
import {
    downloadAdminForensicsReplayBundle,
} from '../services/adminForensicsService';
import {
    buildDiffEntryRenderKey,
    buildSecondaryFacetRenderKey,
    buildUserChangeDiffEntries,
    formatUserChangeDiffValue,
    resolveUserChangeActionPresentation,
    resolveUserChangeSecondaryFacets,
} from '../services/adminUserChangeLog';
import {
    parseUndoRootSourceEventId,
    parseUndoSourceEventId,
    resolveUndoDiffEntries,
    resolveUndoParity,
} from '../services/adminAuditUndoDiff';

const AUDIT_CACHE_KEY = 'admin.audit.cache.v1';
const USER_CHANGE_CACHE_KEY = 'admin.user_changes.cache.v1';
const AUDIT_PAGE_SIZE = 50;
const AUDIT_SOURCE_MAX_ROWS = 500;
const ACTOR_FILTER_VALUES = ['admin', 'user'] as const;
const AUDIT_TIME_PRESETS = ['24h', '7d', '30d', 'all', 'custom'] as const;
const AUDIT_VISIBLE_COLUMN_IDS = ['when', 'actor', 'action', 'target', 'diff', 'rowActions'] as const;
const RESIZABLE_AUDIT_COLUMN_IDS = ['when', 'actor', 'action', 'target', 'diff'] as const;
const AUDIT_COLUMN_OPTIONS: Array<{ value: AuditVisibleColumnId; label: string }> = [
    { value: 'when', label: 'When' },
    { value: 'actor', label: 'Actor' },
    { value: 'action', label: 'Action' },
    { value: 'target', label: 'Target' },
    { value: 'diff', label: 'Changes' },
    { value: 'rowActions', label: 'Actions' },
];
const DEFAULT_VISIBLE_COLUMNS: AuditVisibleColumnId[] = [...AUDIT_VISIBLE_COLUMN_IDS];
// Defaults sum (with the checkbox and menu columns) to ~1140px, the content width
// beside the expanded sidebar at 1440px, so the timeline fits without scrolling.
const AUDIT_COLUMN_WIDTH_DEFAULTS: Record<AuditResizableColumnId, number> = {
    when: 112,
    actor: 210,
    action: 220,
    target: 170,
    diff: 340,
};
const AUDIT_COLUMN_WIDTH_MIN: Record<AuditResizableColumnId, number> = {
    when: 96,
    actor: 150,
    action: 160,
    target: 140,
    diff: 220,
};
const AUDIT_COLUMN_RESIZE_LABELS: Record<AuditResizableColumnId, string> = {
    when: 'When',
    actor: 'Actor',
    action: 'Action',
    target: 'Target',
    diff: 'Changes',
};
const AUDIT_DIFF_SUMMARY_LIMIT = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

// Errors this page throws itself carry an authored sentence that is safe to show.
// Anything else (RPC, network, Supabase) is logged and replaced with a fallback, so a
// raw exception never reaches the admin UI.
// Audit's own validation sentences are user-facing; everything else is mapped.
const AuditUserFacingError = AdminUserFacingError;

const toAuditErrorMessage = (error: unknown, fallback: string): string => (
    toAdminErrorMessage(error, fallback, 'admin-audit')
);

type AuditActorFilter = typeof ACTOR_FILTER_VALUES[number];
type AuditTimePreset = typeof AUDIT_TIME_PRESETS[number];
type AuditVisibleColumnId = typeof AUDIT_VISIBLE_COLUMN_IDS[number];
type AuditResizableColumnId = typeof RESIZABLE_AUDIT_COLUMN_IDS[number];

const ACTION_FILTER_LABELS: Record<string, string> = {
    'admin.audit.export': 'Exported audit replay bundle',
    'admin.user.hard_delete': 'Hard-deleted user',
    'admin.user.invite': 'Invited user',
    'admin.user.create_direct': 'Created user',
    'admin.user.update_profile': 'Updated user',
    'admin.user.update_tier': 'Updated user tier',
    'admin.user.update_overrides': 'Updated user overrides',
    'admin.user.reset_username_cooldown': 'Revoked username cooldown',
    'admin.user.reset_terms_acceptance': 'Reset Terms acceptance',
    'admin.terms.publish': 'Published Terms version',
    'admin.terms.set_current': 'Set current Terms version',
    'admin.trip.hard_delete': 'Hard-deleted trip',
    'admin.trip.update': 'Updated trip',
    'admin.trip.override_commit': 'Overrode trip content',
    'admin.tier.update_entitlements': 'Updated tier entitlements',
    'billing.subscription.created': 'Billing subscription created',
    'billing.subscription.updated': 'Billing subscription updated',
    'billing.subscription.canceled': 'Billing subscription canceled',
    'billing.subscription.activated': 'Billing subscription activated',
    'billing.transaction.completed': 'Billing transaction completed',
    'admin.tier.reapply': 'Reapplied tier to users',
};

const TARGET_LABELS: Record<string, string> = {
    user: 'User',
    trip: 'Trip',
    tier: 'Tier',
    subscription: 'Subscription',
    legal_terms_version: 'Terms version',
    audit: 'Audit',
    unknown: 'Unknown',
};

const ACTION_GROUP_ORDER = [
    'Audit & tooling',
    'Billing & subscriptions',
    'Admin users',
    'Admin trips',
    'Terms & legal',
    'Tier & entitlements',
    'User trip actions',
    'User profile actions',
    'User account actions',
    'Other',
] as const;

const getActionGroupOrder = (groupLabel: string): number => {
    const index = ACTION_GROUP_ORDER.indexOf(groupLabel as (typeof ACTION_GROUP_ORDER)[number]);
    return index >= 0 ? index : ACTION_GROUP_ORDER.length;
};

const getActionGroupLabel = (action: string): string => {
    const normalized = action.trim().toLowerCase();
    if (normalized.startsWith('admin.audit.')) return 'Audit & tooling';
    if (normalized.startsWith('billing.')) return 'Billing & subscriptions';
    if (normalized.startsWith('admin.user.')) return 'Admin users';
    if (normalized.startsWith('admin.trip.')) return 'Admin trips';
    if (normalized.startsWith('admin.terms.')) return 'Terms & legal';
    if (normalized.startsWith('admin.tier.')) return 'Tier & entitlements';
    if (normalized.startsWith('trip.')) return 'User trip actions';
    if (normalized.startsWith('profile.')) return 'User profile actions';
    if (
        normalized.includes('auth')
        || normalized.includes('sign')
        || normalized.includes('account')
        || normalized.includes('login')
    ) {
        return 'User account actions';
    }
    return 'Other';
};

const NOISY_DIFF_KEYS = new Set([
    'updated_at',
    'created_at',
    'role_updated_at',
    'role_updated_by',
]);

interface AuditDiffEntry {
    key: string;
    beforeValue: unknown;
    afterValue: unknown;
}

type AuditTimelineEntry =
    | { kind: 'admin'; log: AdminAuditRecord }
    | { kind: 'user'; log: AdminUserChangeRecord };

const parseQueryMultiValue = (value: string | null): string[] => {
    if (!value) return [];
    return Array.from(new Set(
        value
            .split(',')
            .flatMap((part) => {
                const trimmed = part.trim();
                return trimmed ? [trimmed] : [];
            })
    ));
};

const parseNonNegativeOffset = (value: string | null): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
};

const parseAuditTimePreset = (value: string | null): AuditTimePreset => {
    if (value === '24h' || value === '7d' || value === '30d' || value === 'all' || value === 'custom') return value;
    return '30d';
};

const parseAuditVisibleColumns = (value: string | null): AuditVisibleColumnId[] => {
    const parsed = parseQueryMultiValue(value)
        .filter((columnId): columnId is AuditVisibleColumnId => (
            AUDIT_VISIBLE_COLUMN_IDS.includes(columnId as AuditVisibleColumnId)
        ));
    return parsed.length > 0 ? parsed : [...DEFAULT_VISIBLE_COLUMNS];
};

const toDateInputValue = (value: Date): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isPlanTierKey = (value: string): value is PlanTierKey => (
    value === 'tier_free' || value === 'tier_mid' || value === 'tier_premium'
);

const parseDateInputToTimestamp = (value: string, asEndOfDay: boolean): number | null => {
    if (!value) return null;
    const parsed = new Date(`${value}T${asEndOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    const timestamp = parsed.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

const getDefaultCustomStartDate = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return toDateInputValue(date);
};

const getDefaultCustomEndDate = (): string => toDateInputValue(new Date());

const formatAuditCustomRangeLabel = (startDate: string, endDate: string): string => {
    const startTs = parseDateInputToTimestamp(startDate, false);
    const endTs = parseDateInputToTimestamp(endDate, true);
    if (!startTs || !endTs) return 'Choose custom range';
    return `${new Date(startTs).toLocaleDateString()} - ${new Date(endTs).toLocaleDateString()}`;
};

const isIsoDateInAuditRange = (
    isoDate: string | null | undefined,
    dateRange: AuditTimePreset,
    customStartDate: string,
    customEndDate: string
): boolean => {
    if (!isoDate) return false;
    const timestamp = Date.parse(isoDate);
    if (!Number.isFinite(timestamp)) return false;

    if (dateRange === 'all') return true;
    if (dateRange === '24h') return timestamp >= (Date.now() - DAY_MS);
    if (dateRange === '7d') return timestamp >= (Date.now() - (7 * DAY_MS));
    if (dateRange === '30d') return timestamp >= (Date.now() - (30 * DAY_MS));

    const startTs = parseDateInputToTimestamp(customStartDate, false);
    const endTs = parseDateInputToTimestamp(customEndDate, true);
    if (!startTs || !endTs) return false;
    if (startTs <= endTs) return timestamp >= startTs && timestamp <= endTs;
    return timestamp >= endTs && timestamp <= startTs;
};

const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

const toComparableValue = (value: unknown): string => JSON.stringify(value ?? null);

const formatFieldLabel = (value: string): string => (
    value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
);

const formatAuditValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '—';
        const asDate = Date.parse(trimmed);
        if (Number.isFinite(asDate) && /^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
            return new Date(asDate).toLocaleString();
        }
        return trimmed;
    }
    return JSON.stringify(value);
};

const FALLBACK_AUDIT_TIMESTAMP = '1970-01-01T00:00:00.000Z';

const formatAccountStatusLabel = (status: string | null | undefined): string => {
    const normalized = (status || 'active').toLowerCase();
    if (normalized === 'disabled') return 'Suspended';
    if (normalized === 'deleted') return 'Deleted';
    return 'Active';
};

const getStatusChange = (entries: AuditDiffEntry[], key: string): { from: string; to: string } | null => {
    const entry = entries.find((candidate) => candidate.key === key);
    if (!entry) return null;
    const from = typeof entry.beforeValue === 'string' ? entry.beforeValue.trim().toLowerCase() : '';
    const to = typeof entry.afterValue === 'string' ? entry.afterValue.trim().toLowerCase() : '';
    if (!from && !to) return null;
    return { from, to };
};

const getActionFilterLabel = (action: string): string => ACTION_FILTER_LABELS[action] || action;

const getTargetLabel = (targetType: string): string => TARGET_LABELS[targetType] || targetType;

/**
 * An action filter that covers every available action is no filter at all. Storing
 * it as `[]` keeps actions that appear later (a wider time range, a reload) visible
 * instead of silently hiding them, and keeps the URL short.
 */
const normalizeActionFilters = (values: string[], allValues: string[]): string[] => {
    if (values.length === 0 || allValues.length === 0) return values;
    const selected = new Set(values);
    return allValues.every((value) => selected.has(value)) ? [] : values;
};

const auditRelativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const formatAuditRelativeTime = (isoDate: string | null | undefined, now = Date.now()): string => {
    if (!isoDate) return '—';
    const parsed = Date.parse(isoDate);
    if (!Number.isFinite(parsed)) return '—';
    const diffMs = parsed - now;
    const absDiffMs = Math.abs(diffMs);
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    if (absDiffMs < minuteMs) return 'just now';
    if (absDiffMs < hourMs) return auditRelativeTimeFormatter.format(Math.round(diffMs / minuteMs), 'minute');
    if (absDiffMs < DAY_MS) return auditRelativeTimeFormatter.format(Math.round(diffMs / hourMs), 'hour');
    if (absDiffMs < 7 * DAY_MS) return auditRelativeTimeFormatter.format(Math.round(diffMs / DAY_MS), 'day');
    if (absDiffMs < 30 * DAY_MS) return auditRelativeTimeFormatter.format(Math.round(diffMs / (7 * DAY_MS)), 'week');
    if (absDiffMs < 365 * DAY_MS) return auditRelativeTimeFormatter.format(Math.round(diffMs / (30 * DAY_MS)), 'month');
    return auditRelativeTimeFormatter.format(Math.round(diffMs / (365 * DAY_MS)), 'year');
};

export const __ADMIN_AUDIT_TESTING__ = {
    getActionGroupLabel,
    getActionFilterLabel,
    getTargetLabel,
    normalizeActionFilters,
    formatAuditRelativeTime,
};

const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

const hasSnapshotData = (value: Record<string, unknown> | null | undefined): boolean => Object.keys(asRecord(value)).length > 0;

const mergeTripSnapshotWithViewSettings = (
    snapshot: Record<string, unknown> | null | undefined,
    viewSettings: Record<string, unknown> | null | undefined
): Record<string, unknown> => {
    const normalizedSnapshot = asRecord(snapshot);
    const normalizedViewSettings = asRecord(viewSettings);
    if (Object.keys(normalizedViewSettings).length === 0) return normalizedSnapshot;
    return {
        ...normalizedSnapshot,
        view_settings: normalizedViewSettings,
    };
};

const isUserStatusValue = (value: unknown): value is 'active' | 'disabled' | 'deleted' => (
    value === 'active' || value === 'disabled' || value === 'deleted'
);

const getSnapshotForTarget = (log: AdminAuditRecord | null): Record<string, unknown> => {
    if (!log) return {};
    const after = asRecord(log.after_data);
    if (Object.keys(after).length > 0) return after;
    return asRecord(log.before_data);
};

const buildAuditDiffEntries = (log: AdminAuditRecord): AuditDiffEntry[] => {
    const before = asRecord(log.before_data);
    const after = asRecord(log.after_data);
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
        .flatMap((key) => {
            if (NOISY_DIFF_KEYS.has(key)) return [];
            if (toComparableValue(before[key]) === toComparableValue(after[key])) return [];
            return [{
                key,
                beforeValue: before[key],
                afterValue: after[key],
            }];
        })
        .sort((a, b) => a.key.localeCompare(b.key));
};

const resolveAuditActionPresentation = (
    log: AdminAuditRecord,
    diffEntries: AuditDiffEntry[]
): { label: string; className: string } => {
    const raw = log.action;
    if (raw === 'admin.user.hard_delete') {
        return { label: 'Hard-deleted user', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30' };
    }
    if (raw === 'admin.trip.hard_delete') {
        return { label: 'Hard-deleted trip', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30' };
    }
    if (raw === 'admin.user.invite') {
        return { label: 'Invited user', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
    }
    if (raw === 'admin.user.create_direct') {
        return { label: 'Created user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
    }
    if (raw === 'admin.user.update_profile') {
        const accountStatusChange = getStatusChange(diffEntries, 'account_status');
        if (accountStatusChange?.to === 'deleted') {
            return { label: 'Soft-deleted user', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' };
        }
        if (accountStatusChange?.from === 'deleted' && accountStatusChange?.to === 'active') {
            return { label: 'Restored user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
        }
        if (accountStatusChange?.to === 'disabled') {
            return { label: 'Suspended user', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' };
        }
        if (accountStatusChange?.from === 'disabled' && accountStatusChange?.to === 'active') {
            return { label: 'Reactivated user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
        }
        if (diffEntries.some((entry) => entry.key === 'system_role')) {
            return { label: 'Updated user role', className: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-400/12 dark:text-indigo-200 dark:border-indigo-400/30' };
        }
        if (diffEntries.some((entry) => entry.key === 'tier_key')) {
            return { label: 'Updated user tier', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
        }
        return { label: 'Updated user', className: 'border-border bg-secondary text-foreground' };
    }
    if (raw === 'admin.user.update_tier') {
        return { label: 'Updated user tier', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
    }
    if (raw === 'admin.user.update_overrides') {
        return { label: 'Updated overrides', className: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-400/12 dark:text-indigo-200 dark:border-indigo-400/30' };
    }
    if (raw === 'admin.user.reset_username_cooldown') {
        return { label: 'Revoked username cooldown', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' };
    }
    if (raw === 'admin.user.reset_terms_acceptance') {
        return { label: 'Reset Terms acceptance', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' };
    }
    if (raw === 'admin.trip.update') {
        if (diffEntries.some((entry) => entry.key === 'owner_id')) {
            return { label: 'Transferred trip owner', className: 'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-400/12 dark:text-violet-200 dark:border-violet-400/30' };
        }
        const tripStatusChange = getStatusChange(diffEntries, 'status');
        if (tripStatusChange?.to === 'archived') {
            return { label: 'Archived trip', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' };
        }
        if (tripStatusChange?.from === 'archived' && tripStatusChange?.to === 'active') {
            return { label: 'Restored trip', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
        }
        if (tripStatusChange?.to === 'expired') {
            return { label: 'Expired trip', className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30' };
        }
        if (diffEntries.some((entry) => entry.key === 'trip_expires_at')) {
            return { label: 'Updated trip expiry', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
        }
        return { label: 'Updated trip', className: 'border-border bg-secondary text-foreground' };
    }
    if (raw === 'admin.trip.override_commit') {
        if (parseUndoSourceEventId(log)) {
            return { label: 'Undid trip change', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
        }
        return { label: 'Overrode trip content', className: 'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-400/12 dark:text-violet-200 dark:border-violet-400/30' };
    }
    if (raw === 'admin.tier.update_entitlements') {
        return { label: 'Updated tier entitlements', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
    }
    if (raw === 'admin.tier.reapply') {
        return { label: 'Reapplied tier', className: 'border-border bg-secondary text-foreground' };
    }
    if (raw === 'admin.terms.publish') {
        return { label: 'Published Terms version', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
    }
    if (raw === 'admin.terms.set_current') {
        return { label: 'Set current Terms version', className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30' };
    }
    if (raw.startsWith('billing.subscription.')) {
        if (raw.endsWith('.canceled')) {
            return { label: 'Billing subscription canceled', className: 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30' };
        }
        if (raw.endsWith('.activated')) {
            return { label: 'Billing subscription activated', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
        }
        return { label: 'Billing subscription updated', className: 'border-accent-300 bg-accent-50 text-accent-800 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30' };
    }
    if (raw === 'billing.transaction.completed') {
        return { label: 'Billing transaction completed', className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30' };
    }
    return { label: getActionFilterLabel(raw), className: 'border-border bg-secondary text-foreground' };
};

const getTargetPillClass = (targetType: string): string => {
    if (targetType === 'user') return 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-400/12 dark:text-indigo-200 dark:border-indigo-400/30';
    if (targetType === 'trip') return 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30';
    if (targetType === 'tier') return 'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-400/12 dark:text-violet-200 dark:border-violet-400/30';
    if (targetType === 'subscription') return 'border-accent-300 bg-accent-50 text-accent-800 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30';
    return 'border-border bg-secondary text-foreground';
};

const canOpenTargetDrawer = (log: AdminAuditRecord): boolean => {
    if (!log.target_id) return false;
    return log.target_type === 'user' || log.target_type === 'trip';
};

const mapUserChangeLogToAuditRecord = (log: AdminUserChangeRecord): AdminAuditRecord => ({
    id: log.id,
    actor_user_id: log.owner_user_id,
    actor_email: log.owner_email,
    action: log.action,
    target_type: log.target_type,
    target_id: log.target_id,
    before_data: log.before_data,
    after_data: log.after_data,
    metadata: log.metadata,
    created_at: log.created_at,
});

const getTimelineCreatedAt = (entry: AuditTimelineEntry): string => entry.log.created_at;

const getTimelineAction = (entry: AuditTimelineEntry): string => entry.log.action;

const getTimelineTargetType = (entry: AuditTimelineEntry): string => entry.log.target_type;

const getTimelineTargetId = (entry: AuditTimelineEntry): string | null => entry.log.target_id;

const getTimelineActorEmail = (entry: AuditTimelineEntry): string | null => (
    entry.kind === 'admin' ? entry.log.actor_email : entry.log.owner_email
);

const getTimelineActorUserId = (entry: AuditTimelineEntry): string | null => (
    entry.kind === 'admin' ? entry.log.actor_user_id : entry.log.owner_user_id
);

const getTimelineActionLabel = (entry: AuditTimelineEntry): string => {
    if (entry.kind === 'admin') return getActionFilterLabel(entry.log.action);
    const diffEntries = buildUserChangeDiffEntries(entry.log);
    return resolveUserChangeActionPresentation(entry.log, diffEntries).label;
};

const getTimelineEntryKey = (entry: AuditTimelineEntry): string => `${entry.kind}:${entry.log.id}`;

const extractRevertibleProfilePatch = (
    beforeData: Record<string, unknown> | null | undefined
): Parameters<typeof adminUpdateUserProfile>[1] | null => {
    const source = asRecord(beforeData);
    const patch: Parameters<typeof adminUpdateUserProfile>[1] = {};
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(source, key);
    const toTextOrNull = (value: unknown): string | null => {
        if (value === null) return null;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed || null;
    };
    const toStatusOrNull = (value: unknown): 'active' | 'disabled' | 'deleted' | null => (
        value === 'active' || value === 'disabled' || value === 'deleted' ? value : null
    );
    const toRoleOrNull = (value: unknown): 'admin' | 'user' | null => (
        value === 'admin' || value === 'user' ? value : null
    );

    if (hasOwn('first_name')) patch.firstName = toTextOrNull(source.first_name);
    if (hasOwn('last_name')) patch.lastName = toTextOrNull(source.last_name);
    if (hasOwn('username')) patch.username = toTextOrNull(source.username);
    if (hasOwn('gender')) patch.gender = toTextOrNull(source.gender);
    if (hasOwn('country')) patch.country = toTextOrNull(source.country);
    if (hasOwn('city')) patch.city = toTextOrNull(source.city);
    if (hasOwn('preferred_language')) patch.preferredLanguage = toTextOrNull(source.preferred_language);
    if (hasOwn('account_status')) patch.accountStatus = toStatusOrNull(source.account_status);
    if (hasOwn('system_role')) patch.systemRole = toRoleOrNull(source.system_role);
    if (hasOwn('tier_key')) patch.tierKey = toTextOrNull(source.tier_key) as Parameters<typeof adminUpdateUserProfile>[1]['tierKey'];

    return Object.keys(patch).length > 0 ? patch : null;
};

const canUndoTimelineEntry = (entry: AuditTimelineEntry): boolean => {
    const log = entry.log;
    const action = log.action.trim().toLowerCase();

    if (entry.kind === 'user') {
        if (action === 'trip.created') return Boolean(log.target_id);
        if (action === 'trip.archived') return Boolean(log.target_id);
        if (action === 'trip.updated') {
            const metadata = asRecord(log.metadata);
            return Boolean(log.target_id && asString(metadata.version_id));
        }
        if (action === 'profile.updated') {
            return Boolean(log.target_id && extractRevertibleProfilePatch(log.before_data));
        }
        return false;
    }

    if (!log.target_id) return false;
    if (action === 'admin.trip.override_commit') {
        const sourceEventId = parseUndoSourceEventId(entry.log);
        if (sourceEventId) return true;
        const before = asRecord(log.before_data);
        return Object.keys(asRecord(before.data as Record<string, unknown> | null | undefined)).length > 0;
    }
    if (action === 'admin.trip.update') {
        const before = asRecord(log.before_data);
        return (
            Object.prototype.hasOwnProperty.call(before, 'status')
            || Object.prototype.hasOwnProperty.call(before, 'trip_expires_at')
            || Object.prototype.hasOwnProperty.call(before, 'owner_id')
        );
    }
    if (action === 'admin.user.update_profile' || action === 'admin.user.update_tier') {
        return Boolean(extractRevertibleProfilePatch(log.before_data));
    }
    if (action === 'admin.user.update_overrides') {
        const before = asRecord(log.before_data);
        return Object.prototype.hasOwnProperty.call(before, 'entitlements_override');
    }
    if (action === 'admin.tier.update_entitlements') {
        const before = asRecord(log.before_data);
        return Boolean(log.target_id && typeof before.entitlements === 'object' && before.entitlements !== null);
    }
    return false;
};

const getUndoActionLabel = (entry: AuditTimelineEntry): string => {
    const action = entry.log.action.trim().toLowerCase();
    if (action === 'trip.archived') return 'Undo archive';
    if (action === 'profile.updated') return 'Undo profile';
    if (action === 'admin.trip.override_commit') return 'Undo override';
    return 'Undo change';
};

const toForensicsReplayFileName = (generatedAtIso: string): string => {
    const safeTimestamp = generatedAtIso.replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z');
    return `admin-audit-replay-${safeTimestamp}.json`;
};

const AuditColumnResizeHandle: React.FC<{
    columnId: AuditResizableColumnId;
    onResizeStart: (columnId: AuditResizableColumnId, clientX: number) => void;
}> = ({ columnId, onResizeStart }) => (
    // Mouse-only affordance: the column picker and Reset cover keyboard users.
    <span
        aria-hidden="true"
        onMouseDown={(event) => {
            event.preventDefault();
            onResizeStart(columnId, event.clientX);
        }}
        data-tooltip={`Drag to resize ${AUDIT_COLUMN_RESIZE_LABELS[columnId].toLowerCase()}`}
        className="absolute inset-y-0 end-0 w-2 cursor-col-resize transition-colors hover:bg-border"
    />
);

const AuditDetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 py-1.5 text-sm">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
);

const SnapshotDisclosure: React.FC<{ snapshot: Record<string, unknown> }> = ({ snapshot }) => (
    <details className="rounded-md border border-border text-xs text-muted-foreground">
        <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">Audit snapshot (JSON)</summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border bg-slate-800 p-3 font-mono text-[11px] text-slate-100 dark:bg-slate-950">
            {JSON.stringify(snapshot, null, 2)}
        </pre>
    </details>
);

export const AdminAuditPage: React.FC = () => {
    const { confirm: confirmDialog } = useAppDialog();
    const [searchParams, setSearchParams] = useSearchParams();
    const [logs, setLogs] = useState<AdminAuditRecord[]>(() => readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []));
    const [userChangeLogs, setUserChangeLogs] = useState<AdminUserChangeRecord[]>(
        () => readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, [])
    );
    const [lookupUserChangeLogs, setLookupUserChangeLogs] = useState<AdminUserChangeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(() => logs.length === 0 && userChangeLogs.length === 0);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [timePreset, setTimePreset] = useState<AuditTimePreset>(() => parseAuditTimePreset(searchParams.get('range')));
    const [customStartDate, setCustomStartDate] = useState(() => searchParams.get('start') || getDefaultCustomStartDate());
    const [customEndDate, setCustomEndDate] = useState(() => searchParams.get('end') || getDefaultCustomEndDate());
    const [isCustomRangeDialogOpen, setIsCustomRangeDialogOpen] = useState(false);
    const [actionFilters, setActionFilters] = useState<string[]>(() => parseQueryMultiValue(searchParams.get('action')));
    const [targetFilters, setTargetFilters] = useState<string[]>(() => parseQueryMultiValue(searchParams.get('target')));
    const [actorFilters, setActorFilters] = useState<AuditActorFilter[]>(
        () => parseQueryMultiValue(searchParams.get('actor')).filter(
            (value): value is AuditActorFilter => ACTOR_FILTER_VALUES.includes(value as AuditActorFilter)
        )
    );
    const [visibleColumns, setVisibleColumns] = useState<AuditVisibleColumnId[]>(
        () => parseAuditVisibleColumns(searchParams.get('cols'))
    );
    const [columnWidths, setColumnWidths] = useState<Record<AuditResizableColumnId, number>>(
        () => ({ ...AUDIT_COLUMN_WIDTH_DEFAULTS })
    );
    const resizeStateRef = useRef<{
        columnId: AuditResizableColumnId;
        startX: number;
        startWidth: number;
    } | null>(null);
    const [selectedEntryKeys, setSelectedEntryKeys] = useState<string[]>([]);
    const [offset, setOffset] = useState(() => parseNonNegativeOffset(searchParams.get('offset')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
    const [selectedUserLog, setSelectedUserLog] = useState<AdminAuditRecord | null>(null);
    const [selectedTripLog, setSelectedTripLog] = useState<AdminAuditRecord | null>(null);
    const [selectedUserProfile, setSelectedUserProfile] = useState<AdminUserRecord | null>(null);
    const [selectedTripRecord, setSelectedTripRecord] = useState<AdminTripRecord | null>(null);
    const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
    const [isTripDrawerOpen, setIsTripDrawerOpen] = useState(false);
    const [isLoadingUserProfile, setIsLoadingUserProfile] = useState(false);
    const [isLoadingTripRecord, setIsLoadingTripRecord] = useState(false);
    const [userDrawerError, setUserDrawerError] = useState<string | null>(null);
    const [tripDrawerError, setTripDrawerError] = useState<string | null>(null);
    const [isRestoringUser, setIsRestoringUser] = useState(false);
    const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
    const [isDiffModalLoading, setIsDiffModalLoading] = useState(false);
    const [diffModalError, setDiffModalError] = useState<string | null>(null);
    const [diffModalTitle, setDiffModalTitle] = useState('Full change diff');
    const [diffModalDescription, setDiffModalDescription] = useState<string | undefined>(undefined);
    const [diffModalBeforeLabel, setDiffModalBeforeLabel] = useState('Before snapshot');
    const [diffModalAfterLabel, setDiffModalAfterLabel] = useState('After snapshot');
    const [diffModalBeforeValue, setDiffModalBeforeValue] = useState<unknown>({});
    const [diffModalAfterValue, setDiffModalAfterValue] = useState<unknown>({});
    const [isExportingReplay, setIsExportingReplay] = useState(false);
    const [revertingEntryKey, setRevertingEntryKey] = useState<string | null>(null);
    const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
    const requestedUndoSourceIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (timePreset !== '30d') next.set('range', timePreset);
        if (timePreset === 'custom') {
            if (customStartDate) next.set('start', customStartDate);
            if (customEndDate) next.set('end', customEndDate);
        }
        if (actionFilters.length > 0) next.set('action', actionFilters.join(','));
        if (targetFilters.length > 0) next.set('target', targetFilters.join(','));
        if (actorFilters.length > 0) next.set('actor', actorFilters.join(','));
        if (visibleColumns.length !== DEFAULT_VISIBLE_COLUMNS.length) {
            next.set('cols', visibleColumns.join(','));
        }
        if (offset > 0) next.set('offset', String(offset));
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        actionFilters,
        actorFilters,
        customEndDate,
        customStartDate,
        offset,
        searchParams,
        searchValue,
        setSearchParams,
        targetFilters,
        timePreset,
        visibleColumns,
    ]);

    const loadLogs = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setDataSourceNotice(null);
        setLookupUserChangeLogs([]);
        requestedUndoSourceIdsRef.current.clear();
        const notices: string[] = [];
        const hardFailures: string[] = [];

        const [adminResult, userResult] = await Promise.allSettled([
            adminListAuditLogs({ limit: AUDIT_SOURCE_MAX_ROWS }),
            adminListUserChangeLogs({ limit: AUDIT_SOURCE_MAX_ROWS }),
        ]);

        if (adminResult.status === 'fulfilled') {
            setLogs(adminResult.value);
            writeAdminCache(AUDIT_CACHE_KEY, adminResult.value);
        } else {
            const reason = toAuditErrorMessage(adminResult.reason, 'Could not load admin audit logs.');
            const cachedRows = readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setLogs(cachedRows);
                notices.push(`Live admin audit logs failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser.`);
            } else {
                setLogs([]);
                hardFailures.push(reason);
            }
        }

        if (userResult.status === 'fulfilled') {
            setUserChangeLogs(userResult.value);
            writeAdminCache(USER_CHANGE_CACHE_KEY, userResult.value);
        } else {
            const reason = toAuditErrorMessage(userResult.reason, 'Could not load user change logs.');
            const cachedRows = readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setUserChangeLogs(cachedRows);
                notices.push(`Live user change logs failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser.`);
            } else {
                setUserChangeLogs([]);
                hardFailures.push(reason);
            }
        }

        if (hardFailures.length > 0) {
            setErrorMessage(Array.from(new Set(hardFailures)).join(' '));
        }
        if (notices.length > 0) {
            setDataSourceNotice(notices.join(' '));
        }
        setIsLoading(false);
    };

    useEffect(() => {
        void loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openUserDrawerById = (
        userId: string,
        options?: {
            sourceLog?: AdminAuditRecord;
            actorEmail?: string | null;
        }
    ) => {
        const trimmedUserId = userId.trim();
        if (!trimmedUserId) return;
        const sourceLog = options?.sourceLog || null;
        const actorEmail = options?.actorEmail || sourceLog?.actor_email || null;
        const userLog: AdminAuditRecord = sourceLog
            ? {
                ...sourceLog,
                target_type: 'user',
                target_id: trimmedUserId,
                actor_email: sourceLog.actor_email || actorEmail,
            }
            : {
                id: `audit-actor-${trimmedUserId}-${Date.now()}`,
                actor_user_id: trimmedUserId,
                actor_email: actorEmail,
                action: 'audit.open_actor',
                target_type: 'user',
                target_id: trimmedUserId,
                before_data: null,
                after_data: null,
                metadata: { source: 'actor_column' },
                created_at: new Date().toISOString(),
            };
        setSelectedEntryKey(null);
        setSelectedTripLog(null);
        setSelectedTripRecord(null);
        setTripDrawerError(null);
        setIsTripDrawerOpen(false);
        setSelectedUserLog(userLog);
        setSelectedUserProfile(null);
        setUserDrawerError(null);
        setIsUserDrawerOpen(true);
    };

    const openTargetDrawer = (log: AdminAuditRecord) => {
        if (!canOpenTargetDrawer(log)) return;
        setErrorMessage(null);
        if (log.target_type === 'user' && log.target_id) {
            openUserDrawerById(log.target_id, {
                sourceLog: log,
                actorEmail: log.actor_email,
            });
            return;
        }
        setSelectedEntryKey(null);
        setSelectedUserLog(null);
        setSelectedUserProfile(null);
        setUserDrawerError(null);
        setIsUserDrawerOpen(false);
        setSelectedTripLog(log);
        setSelectedTripRecord(null);
        setTripDrawerError(null);
        setIsTripDrawerOpen(true);
    };

    useEffect(() => {
        if (!isUserDrawerOpen || !selectedUserLog?.target_id) return;
        let active = true;
        setIsLoadingUserProfile(true);
        setUserDrawerError(null);
        void adminGetUserProfile(selectedUserLog.target_id)
            .then((profile) => {
                if (!active) return;
                setSelectedUserProfile(profile);
                if (!profile) {
                    setUserDrawerError('Live profile not found. Showing audit snapshot only.');
                }
            })
            .catch((error) => {
                if (!active) return;
                setUserDrawerError(toAuditErrorMessage(error, 'Could not load the live user profile.'));
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingUserProfile(false);
            });
        return () => {
            active = false;
        };
    }, [isUserDrawerOpen, selectedUserLog]);

    useEffect(() => {
        if (!isTripDrawerOpen || !selectedTripLog?.target_id) return;
        let active = true;
        setIsLoadingTripRecord(true);
        setTripDrawerError(null);
        void adminListTrips({ search: selectedTripLog.target_id, limit: 20, status: 'all' })
            .then((rows) => {
                if (!active) return;
                const exactMatch = rows.find((row) => row.trip_id === selectedTripLog.target_id) || null;
                setSelectedTripRecord(exactMatch);
                if (!exactMatch) {
                    setTripDrawerError('Live trip not found. Showing audit snapshot only.');
                }
            })
            .catch((error) => {
                if (!active) return;
                setTripDrawerError(toAuditErrorMessage(error, 'Could not load the live trip details.'));
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingTripRecord(false);
            });
        return () => {
            active = false;
        };
    }, [isTripDrawerOpen, selectedTripLog]);

    const selectedUserSnapshot = useMemo(
        () => getSnapshotForTarget(selectedUserLog),
        [selectedUserLog]
    );

    const selectedTripSnapshot = useMemo(
        () => getSnapshotForTarget(selectedTripLog),
        [selectedTripLog]
    );

    const resolvedUserAccountStatus = useMemo<'active' | 'disabled' | 'deleted' | null>(() => {
        const fromProfile = selectedUserProfile?.account_status || null;
        if (isUserStatusValue(fromProfile)) return fromProfile;
        const fromSnapshot = selectedUserSnapshot.account_status;
        if (isUserStatusValue(fromSnapshot)) return fromSnapshot;
        return null;
    }, [selectedUserProfile?.account_status, selectedUserSnapshot.account_status]);

    const restoreUserFromAudit = async () => {
        const userId = selectedUserProfile?.user_id || selectedUserLog?.target_id || null;
        if (!userId) {
            setUserDrawerError('Cannot restore: no user id available.');
            return;
        }
        const confirmed = await confirmDialog(buildDecisionConfirmDialog({
            title: 'Restore user account',
            message: 'Restore this user by setting account status back to active?',
            confirmLabel: 'Restore user',
        }));
        if (!confirmed) return;
        setIsRestoringUser(true);
        setErrorMessage(null);
        setUserDrawerError(null);
        try {
            await adminUpdateUserProfile(userId, { accountStatus: 'active' });
            const refreshedProfile = await adminGetUserProfile(userId);
            setSelectedUserProfile(refreshedProfile);
            showAppToast({
                tone: 'success',
                title: 'User restored',
                description: 'Account status has been set to active and recorded in audit logs.',
            });
            await loadLogs();
        } catch (error) {
            setUserDrawerError(toAuditErrorMessage(error, 'Could not restore this user. Try again.'));
        } finally {
            setIsRestoringUser(false);
        }
    };

    const canOpenFullDiffModal = (entry: AuditTimelineEntry): boolean => {
        const log = entry.kind === 'admin' ? entry.log : mapUserChangeLogToAuditRecord(entry.log);
        if (hasSnapshotData(log.before_data) || hasSnapshotData(log.after_data)) return true;
        if (log.target_type !== 'trip' || !log.target_id) return false;
        const metadata = asRecord(log.metadata);
        return Boolean(asString(metadata.version_id));
    };

    const openFullDiffModal = async (entry: AuditTimelineEntry) => {
        const log = entry.kind === 'admin' ? entry.log : mapUserChangeLogToAuditRecord(entry.log);
        const metadata = asRecord(log.metadata);
        const actorEmail = getTimelineActorEmail(entry);
        const targetLabel = getTargetLabel(log.target_type);
        const versionId = asString(metadata.version_id);
        const previousVersionId = asString(metadata.previous_version_id);

        setDiffModalError(null);
        setDiffModalTitle(`${getTimelineActionLabel(entry)} · ${targetLabel}`);
        setDiffModalDescription(
            [
                log.action,
                actorEmail ? `Actor: ${actorEmail}` : null,
                log.target_id ? `${targetLabel} id: ${log.target_id}` : null,
                versionId ? `Version: ${versionId}` : null,
            ].filter(Boolean).join(' · ')
        );

        setDiffModalBeforeLabel('Before snapshot');
        setDiffModalAfterLabel('After snapshot');
        setDiffModalBeforeValue(hasSnapshotData(log.before_data) ? asRecord(log.before_data) : {});
        setDiffModalAfterValue(hasSnapshotData(log.after_data) ? asRecord(log.after_data) : {});
        setIsDiffModalOpen(true);

        if (log.target_type !== 'trip' || !log.target_id || !versionId) {
            setIsDiffModalLoading(false);
            return;
        }

        setIsDiffModalLoading(true);
        try {
            const versionSnapshots = await adminGetTripVersionSnapshots({
                tripId: log.target_id,
                afterVersionId: versionId,
                beforeVersionId: previousVersionId,
            });
            if (!versionSnapshots) {
                setDiffModalError('Trip snapshots were not found for this event. Showing event snapshots when available.');
                return;
            }
            setDiffModalBeforeValue(mergeTripSnapshotWithViewSettings(
                versionSnapshots.before_snapshot,
                versionSnapshots.before_view_settings
            ));
            setDiffModalAfterValue(mergeTripSnapshotWithViewSettings(
                versionSnapshots.after_snapshot,
                versionSnapshots.after_view_settings
            ));
            setDiffModalBeforeLabel(versionSnapshots.before_label || 'Before version');
            setDiffModalAfterLabel(versionSnapshots.after_label || 'After version');
        } catch (error) {
            setDiffModalError(toAuditErrorMessage(error, 'Could not load trip snapshots. Showing event snapshots when available.'));
        } finally {
            setIsDiffModalLoading(false);
        }
    };

    const timelineEntries = useMemo<AuditTimelineEntry[]>(() => {
        const byId = new Map<string, AuditTimelineEntry>();
        logs.forEach((log) => {
            byId.set(log.id, { kind: 'admin', log });
        });
        userChangeLogs.forEach((log) => {
            byId.set(log.id, { kind: 'user', log });
        });
        lookupUserChangeLogs.forEach((log) => {
            if (!byId.has(log.id)) {
                byId.set(log.id, { kind: 'user', log });
            }
        });

        return Array.from(byId.values()).sort((a, b) => {
            const left = Date.parse(getTimelineCreatedAt(a)) || 0;
            const right = Date.parse(getTimelineCreatedAt(b)) || 0;
            return right - left;
        });
    }, [logs, lookupUserChangeLogs, userChangeLogs]);

    const timelineEntriesById = useMemo(() => {
        const map = new Map<string, AuditTimelineEntry>();
        timelineEntries.forEach((entry) => {
            map.set(entry.log.id, entry);
        });
        return map;
    }, [timelineEntries]);

    useEffect(() => {
        const missingSourceIds = new Set<string>();
        timelineEntries.forEach((entry) => {
            if (entry.kind !== 'admin') return;
            if (entry.log.action.trim().toLowerCase() !== 'admin.trip.override_commit') return;
            const sourceId = parseUndoRootSourceEventId(entry.log) || parseUndoSourceEventId(entry.log);
            if (!sourceId) return;
            if (timelineEntriesById.has(sourceId)) return;
            if (requestedUndoSourceIdsRef.current.has(sourceId)) return;
            requestedUndoSourceIdsRef.current.add(sourceId);
            missingSourceIds.add(sourceId);
        });
        if (missingSourceIds.size === 0) return;

        let active = true;
        void Promise.all(
            Array.from(missingSourceIds).map(async (eventId) => {
                try {
                    return await adminGetUserChangeLog(eventId);
                } catch {
                    return null;
                }
            })
        ).then((rows) => {
            if (!active) return;
            const nextRows = rows.filter((row): row is AdminUserChangeRecord => Boolean(row));
            if (nextRows.length === 0) return;
            setLookupUserChangeLogs((current) => {
                const byId = new Map(current.map((row) => [row.id, row]));
                nextRows.forEach((row) => byId.set(row.id, row));
                return Array.from(byId.values());
            });
        });

        return () => {
            active = false;
        };
    }, [timelineEntries, timelineEntriesById]);

    const visibleLogs = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return timelineEntries.filter((entry) => {
            const createdAt = getTimelineCreatedAt(entry);
            const action = getTimelineAction(entry);
            const targetType = getTimelineTargetType(entry);
            const targetId = getTimelineTargetId(entry);
            const actorEmail = getTimelineActorEmail(entry);
            const actorUserId = getTimelineActorUserId(entry);
            const actorType = entry.kind;

            if (!isIsoDateInAuditRange(createdAt, timePreset, customStartDate, customEndDate)) return false;
            if (actionFilters.length > 0 && !actionFilters.includes(action)) return false;
            if (targetFilters.length > 0 && !targetFilters.includes(targetType)) return false;
            if (actorFilters.length > 0 && !actorFilters.includes(actorType)) return false;
            if (!token) return true;
            return (
                action.toLowerCase().includes(token)
                || getTimelineActionLabel(entry).toLowerCase().includes(token)
                || targetType.toLowerCase().includes(token)
                || getTargetLabel(targetType).toLowerCase().includes(token)
                || (targetId || '').toLowerCase().includes(token)
                || (actorEmail || '').toLowerCase().includes(token)
                || (actorUserId || '').toLowerCase().includes(token)
            );
        });
    }, [
        actionFilters,
        actorFilters,
        customEndDate,
        customStartDate,
        searchValue,
        targetFilters,
        timePreset,
        timelineEntries,
    ]);

    const logsInTimeRange = useMemo(
        () => timelineEntries.filter((entry) => isIsoDateInAuditRange(getTimelineCreatedAt(entry), timePreset, customStartDate, customEndDate)),
        [customEndDate, customStartDate, timePreset, timelineEntries]
    );

    const pagedLogs = useMemo(
        () => visibleLogs.slice(offset, offset + AUDIT_PAGE_SIZE),
        [offset, visibleLogs]
    );
    const hasPreviousPage = offset > 0;
    const hasNextPage = offset + AUDIT_PAGE_SIZE < visibleLogs.length;

    const selectedEntryKeySet = useMemo(() => new Set(selectedEntryKeys), [selectedEntryKeys]);
    const pagedEntryKeys = useMemo(() => pagedLogs.map((entry) => getTimelineEntryKey(entry)), [pagedLogs]);
    const selectedOnPageCount = useMemo(
        () => pagedEntryKeys.filter((key) => selectedEntryKeySet.has(key)).length,
        [pagedEntryKeys, selectedEntryKeySet]
    );
    const areAllPageRowsSelected = pagedEntryKeys.length > 0 && selectedOnPageCount === pagedEntryKeys.length;
    const hasSomePageRowsSelected = selectedOnPageCount > 0 && !areAllPageRowsSelected;

    useEffect(() => {
        if (visibleLogs.length === 0) {
            if (offset !== 0) setOffset(0);
            return;
        }
        if (offset >= visibleLogs.length) {
            const lastPageOffset = Math.floor((visibleLogs.length - 1) / AUDIT_PAGE_SIZE) * AUDIT_PAGE_SIZE;
            setOffset(lastPageOffset);
        }
    }, [offset, visibleLogs.length]);

    useEffect(() => {
        if (selectedEntryKeys.length === 0) return;
        const availableKeys = new Set(visibleLogs.map((entry) => getTimelineEntryKey(entry)));
        setSelectedEntryKeys((current) => current.filter((key) => availableKeys.has(key)));
    }, [selectedEntryKeys.length, visibleLogs]);

    const actionFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInTimeRange.forEach((entry) => {
            const action = getTimelineAction(entry);
            const nextValue = (counts.get(action) || 0) + 1;
            counts.set(action, nextValue);
        });
        return Array.from(counts.entries())
            .map(([value, count]) => {
                const matchingEntry = logsInTimeRange.find((entry) => getTimelineAction(entry) === value);
                return {
                    value,
                    label: matchingEntry ? getTimelineActionLabel(matchingEntry) : getActionFilterLabel(value),
                    count,
                    group: getActionGroupLabel(value),
                };
            })
            .sort((left, right) => {
                const byGroup = getActionGroupOrder(left.group || 'Other') - getActionGroupOrder(right.group || 'Other');
                if (byGroup !== 0) return byGroup;
                return left.label.localeCompare(right.label);
            });
    }, [logsInTimeRange]);
    const allActionFilterValues = useMemo(
        () => actionFilterOptions.map((option) => option.value),
        [actionFilterOptions]
    );

    const targetFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInTimeRange.forEach((entry) => {
            const targetType = getTimelineTargetType(entry);
            const nextValue = (counts.get(targetType) || 0) + 1;
            counts.set(targetType, nextValue);
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => ({ value, label: getTargetLabel(value), count }));
    }, [logsInTimeRange]);

    const actorFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const adminCount = logsInTimeRange.filter((entry) => entry.kind === 'admin').length;
        const userCount = logsInTimeRange.filter((entry) => entry.kind === 'user').length;
        return [
            { value: 'admin', label: 'Admin actor', count: adminCount },
            { value: 'user', label: 'User actor', count: userCount },
        ];
    }, [logsInTimeRange]);

    const visibleColumnOptions = useMemo<AdminFilterMenuOption[]>(
        () => AUDIT_COLUMN_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
        []
    );

    const handleSearchValueChange = (value: string) => {
        setSearchValue(value);
        setOffset(0);
    };

    const handleTimePresetChange = (value: AuditTimePreset) => {
        setTimePreset(value);
        if (value !== 'custom') {
            setCustomStartDate(getDefaultCustomStartDate());
            setCustomEndDate(getDefaultCustomEndDate());
        }
        setOffset(0);
    };

    const handleActionFiltersChange = (values: string[]) => {
        setActionFilters(normalizeActionFilters(values, allActionFilterValues));
        setOffset(0);
    };

    const handleTargetFiltersChange = (values: string[]) => {
        setTargetFilters(values);
        setOffset(0);
    };

    const handleActorFiltersChange = (values: string[]) => {
        setActorFilters(values.filter(
            (value): value is AuditActorFilter => ACTOR_FILTER_VALUES.includes(value as AuditActorFilter)
        ));
        setOffset(0);
    };

    const handleVisibleColumnsChange = (values: string[]) => {
        const nextValues = values.filter(
            (value): value is AuditVisibleColumnId => AUDIT_VISIBLE_COLUMN_IDS.includes(value as AuditVisibleColumnId)
        );
        setVisibleColumns(nextValues.length > 0 ? nextValues : [...DEFAULT_VISIBLE_COLUMNS]);
    };

    const copyActionCode = async (actionCode: string) => {
        trackEvent('admin__audit--copy_action_code');
        if (!actionCode.trim() || typeof navigator === 'undefined' || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(actionCode);
            showAppToast({ tone: 'success', title: 'Action code copied', description: actionCode });
        } catch {
            showAppToast({ tone: 'warning', title: 'Could not copy', description: 'Your browser blocked clipboard access.' });
        }
    };

    const beginColumnResize = (columnId: AuditResizableColumnId, clientX: number) => {
        resizeStateRef.current = {
            columnId,
            startX: clientX,
            startWidth: columnWidths[columnId],
        };

        const onPointerMove = (event: MouseEvent) => {
            if (!resizeStateRef.current) return;
            const resizeState = resizeStateRef.current;
            const delta = event.clientX - resizeState.startX;
            const minWidth = AUDIT_COLUMN_WIDTH_MIN[resizeState.columnId];
            const nextWidth = Math.max(minWidth, Math.round(resizeState.startWidth + delta));
            setColumnWidths((current) => (
                current[resizeState.columnId] === nextWidth
                    ? current
                    : {
                        ...current,
                        [resizeState.columnId]: nextWidth,
                    }
            ));
        };

        const onPointerUp = () => {
            resizeStateRef.current = null;
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('mouseup', onPointerUp);
        };

        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
    };

    const exportReplayBundle = async (options?: { selectedEventIds?: string[] }) => {
        const selectedEventIds = options?.selectedEventIds ?? [];
        if (selectedEventIds.length === 0 && visibleLogs.length === 0) {
            setErrorMessage('No audit entries match the current filters.');
            return;
        }
        if (selectedEventIds.length > 0 && selectedEventIds.length > AUDIT_SOURCE_MAX_ROWS) {
            setErrorMessage(`Too many selected entries (${selectedEventIds.length}). Please select up to ${AUDIT_SOURCE_MAX_ROWS}.`);
            return;
        }

        setIsExportingReplay(true);
        setErrorMessage(null);
        try {
            const { bundle, exportAuditId } = await adminExportAuditReplay({
                search: searchValue.trim() || null,
                dateRange: timePreset,
                customStartDate: timePreset === 'custom' ? customStartDate : null,
                customEndDate: timePreset === 'custom' ? customEndDate : null,
                actionFilters,
                targetFilters,
                actorFilters,
                selectedEventIds: selectedEventIds.length > 0 ? selectedEventIds : null,
                sourceLimit: AUDIT_SOURCE_MAX_ROWS,
            });
            const downloaded = downloadAdminForensicsReplayBundle(bundle, toForensicsReplayFileName(bundle.generated_at));
            if (!downloaded) {
                throw new AuditUserFacingError('Replay export is only available in browser context.');
            }
            showAppToast({
                tone: 'success',
                title: 'Replay export ready',
                description:
                    `Exported ${bundle.totals.event_count} event${bundle.totals.event_count === 1 ? '' : 's'} `
                    + `across ${bundle.totals.correlation_count} trace${bundle.totals.correlation_count === 1 ? '' : 's'}`
                    + `${exportAuditId ? ` (audit id ${exportAuditId})` : ''}.`,
            });
        } catch (error) {
            setErrorMessage(toAuditErrorMessage(error, 'Could not export the replay bundle.'));
        } finally {
            setIsExportingReplay(false);
        }
    };

    const exportSelectedReplayBundle = async () => {
        if (selectedEntryKeys.length === 0) {
            setErrorMessage('Select at least one row to export.');
            return;
        }
        trackEvent('admin__audit--export_selected', { count: selectedEntryKeys.length });
        await exportReplayBundle({ selectedEventIds: selectedEntryKeys });
    };

    const exportSingleReplayEntry = async (entry: AuditTimelineEntry) => {
        trackEvent('admin__audit--export_entry');
        await exportReplayBundle({ selectedEventIds: [getTimelineEntryKey(entry)] });
    };

    const toggleRowSelection = (entryKey: string) => {
        setSelectedEntryKeys((current) => (
            current.includes(entryKey)
                ? current.filter((key) => key !== entryKey)
                : [...current, entryKey]
        ));
    };

    const togglePageSelection = (checked: boolean) => {
        setSelectedEntryKeys((current) => {
            const currentSet = new Set(current);
            if (checked) {
                pagedEntryKeys.forEach((entryKey) => currentSet.add(entryKey));
            } else {
                pagedEntryKeys.forEach((entryKey) => currentSet.delete(entryKey));
            }
            return Array.from(currentSet);
        });
    };

    const buildUndoOverrideMetadata = (entry: AuditTimelineEntry): Record<string, unknown> => {
        const metadata: Record<string, unknown> = {
            undo_source_event_id: entry.log.id,
        };
        if (entry.kind === 'user') {
            metadata.undo_root_source_event_id = entry.log.id;
            metadata.undo_parity = 1;
            return metadata;
        }
        if (entry.log.action.trim().toLowerCase() !== 'admin.trip.override_commit') {
            return metadata;
        }

        const rootSourceEventId = parseUndoRootSourceEventId(entry.log) || parseUndoSourceEventId(entry.log);
        if (rootSourceEventId) {
            metadata.undo_root_source_event_id = rootSourceEventId;
        }

        const sourceParity = resolveUndoParity(entry.log, timelineEntriesById);
        if (sourceParity !== null) {
            metadata.undo_parity = (sourceParity + 1) % 2;
        }

        return metadata;
    };

    const undoTimelineEntry = async (entry: AuditTimelineEntry) => {
        if (!canUndoTimelineEntry(entry)) return;
        const entryKey = getTimelineEntryKey(entry);
        const action = entry.log.action.trim().toLowerCase();
        const confirmed = await confirmDialog(buildDecisionConfirmDialog({
            title: 'Undo this change?',
            message: 'This creates a new admin action that reverts the selected row. Continue?',
            confirmLabel: 'Undo change',
        }));
        if (!confirmed) return;

        setRevertingEntryKey(entryKey);
        setErrorMessage(null);
        try {
            if (entry.kind === 'user') {
                if (action === 'trip.created') {
                    if (!entry.log.target_id) throw new AuditUserFacingError('Trip id missing for undo.');
                    await adminUpdateTrip(entry.log.target_id, { status: 'archived' });
                } else if (action === 'trip.archived') {
                    if (!entry.log.target_id) throw new AuditUserFacingError('Trip id missing for undo.');
                    await adminUpdateTrip(entry.log.target_id, { status: 'active' });
                } else if (action === 'trip.updated') {
                    if (!entry.log.target_id) throw new AuditUserFacingError('Trip id missing for undo.');
                    const metadata = asRecord(entry.log.metadata);
                    const versionId = asString(metadata.version_id);
                    const previousVersionId = asString(metadata.previous_version_id);
                    if (!versionId) throw new AuditUserFacingError('Version id missing for undo.');
                    const versionSnapshots = await adminGetTripVersionSnapshots({
                        tripId: entry.log.target_id,
                        afterVersionId: versionId,
                        beforeVersionId: previousVersionId,
                    });
                    if (!versionSnapshots) {
                        throw new AuditUserFacingError('Version snapshots unavailable for undo.');
                    }
                    const beforeSnapshot = asRecord(versionSnapshots.before_snapshot);
                    if (Object.keys(beforeSnapshot).length === 0) {
                        throw new AuditUserFacingError('No previous snapshot found for undo.');
                    }
                    await adminOverrideTripCommit({
                        tripId: entry.log.target_id,
                        data: beforeSnapshot,
                        viewSettings: asRecord(versionSnapshots.before_view_settings),
                        label: `Audit undo ${entry.log.id}`,
                        metadata: buildUndoOverrideMetadata(entry),
                    });
                } else if (action === 'profile.updated') {
                    if (!entry.log.target_id) throw new AuditUserFacingError('User id missing for undo.');
                    const patch = extractRevertibleProfilePatch(entry.log.before_data);
                    if (!patch) throw new AuditUserFacingError('No revertible profile fields found for this row.');
                    await adminUpdateUserProfile(entry.log.target_id, patch);
                } else {
                    throw new AuditUserFacingError('Undo is not supported for this action.');
                }
            } else {
                if (!entry.log.target_id) throw new AuditUserFacingError('Target id missing for undo.');
                if (action === 'admin.trip.override_commit') {
                    const before = asRecord(entry.log.before_data);
                    const tripData = asRecord(before.data as Record<string, unknown> | null | undefined);
                    if (Object.keys(tripData).length === 0) {
                        throw new AuditUserFacingError('No previous trip snapshot found for this undo.');
                    }
                    await adminOverrideTripCommit({
                        tripId: entry.log.target_id,
                        data: tripData,
                        viewSettings: asRecord(before.view_settings as Record<string, unknown> | null | undefined),
                        label: `Audit undo ${entry.log.id}`,
                        metadata: buildUndoOverrideMetadata(entry),
                    });
                } else if (action === 'admin.trip.update') {
                    const before = asRecord(entry.log.before_data);
                    const patch: Parameters<typeof adminUpdateTrip>[1] = {};
                    if (Object.prototype.hasOwnProperty.call(before, 'status')) {
                        const status = asString(before.status);
                        if (status === 'active' || status === 'archived' || status === 'expired') {
                            patch.status = status;
                        }
                    }
                    if (Object.prototype.hasOwnProperty.call(before, 'trip_expires_at')) {
                        patch.tripExpiresAt = asString(before.trip_expires_at);
                    }
                    if (Object.prototype.hasOwnProperty.call(before, 'owner_id')) {
                        patch.ownerId = asString(before.owner_id);
                    }
                    if (Object.keys(patch).length === 0) {
                        throw new AuditUserFacingError('No revertible trip fields found for this row.');
                    }
                    await adminUpdateTrip(entry.log.target_id, patch);
                } else if (action === 'admin.user.update_profile' || action === 'admin.user.update_tier') {
                    const patch = extractRevertibleProfilePatch(entry.log.before_data);
                    if (!patch) throw new AuditUserFacingError('No revertible user fields found for this row.');
                    await adminUpdateUserProfile(entry.log.target_id, patch);
                } else if (action === 'admin.user.update_overrides') {
                    const before = asRecord(entry.log.before_data);
                    const overrides = asRecord(before.entitlements_override as Record<string, unknown> | null | undefined);
                    await adminUpdateUserOverrides(entry.log.target_id, overrides);
                } else if (action === 'admin.tier.update_entitlements') {
                    const before = asRecord(entry.log.before_data);
                    const entitlements = asRecord(before.entitlements as Record<string, unknown> | null | undefined);
                    if (Object.keys(entitlements).length === 0) {
                        throw new AuditUserFacingError('No previous tier entitlements found for this row.');
                    }
                    const tierKey = entry.log.target_id;
                    if (!tierKey || !isPlanTierKey(tierKey)) {
                        throw new AuditUserFacingError('Tier key missing or invalid for undo.');
                    }
                    await adminUpdatePlanEntitlements(tierKey, entitlements);
                } else {
                    throw new AuditUserFacingError('Undo is not supported for this action.');
                }
            }
            showAppToast({
                tone: 'success',
                title: 'Undo completed',
                description: 'A new admin audit entry was written for this revert operation.',
            });
            await loadLogs();
        } catch (error) {
            setErrorMessage(toAuditErrorMessage(error, 'Could not undo this change.'));
        } finally {
            setRevertingEntryKey(null);
        }
    };

    const userIdentity = useMemo(() => {
        const name = [
            asString(selectedUserSnapshot.first_name),
            asString(selectedUserSnapshot.last_name),
        ].filter(Boolean).join(' ').trim();
        const resolvedName = selectedUserProfile
            ? ([selectedUserProfile.first_name, selectedUserProfile.last_name].filter(Boolean).join(' ').trim()
                || selectedUserProfile.display_name
                || selectedUserProfile.username
                || null)
            : null;
        return {
            userId: selectedUserProfile?.user_id || asString(selectedUserSnapshot.id) || selectedUserLog?.target_id || 'n/a',
            email: selectedUserProfile?.email || asString(selectedUserSnapshot.email) || null,
            name: resolvedName || name || asString(selectedUserSnapshot.display_name) || asString(selectedUserSnapshot.username) || null,
            role: selectedUserProfile?.system_role || asString(selectedUserSnapshot.system_role) || null,
            tier: selectedUserProfile?.tier_key || asString(selectedUserSnapshot.tier_key) || null,
            totalTrips: selectedUserProfile?.total_trips ?? null,
            activeTrips: selectedUserProfile?.active_trips ?? null,
        };
    }, [selectedUserLog?.target_id, selectedUserProfile, selectedUserSnapshot]);

    const tripIdentity = useMemo(() => ({
        tripId: selectedTripRecord?.trip_id || asString(selectedTripSnapshot.id) || selectedTripLog?.target_id || 'n/a',
        title: selectedTripRecord?.title || asString(selectedTripSnapshot.title) || null,
        status: selectedTripRecord?.status || asString(selectedTripSnapshot.status) || null,
        ownerId: selectedTripRecord?.owner_id || asString(selectedTripSnapshot.owner_id) || null,
        ownerEmail: selectedTripRecord?.owner_email || asString(selectedTripSnapshot.owner_email) || null,
        expiresAt: selectedTripRecord?.trip_expires_at || asString(selectedTripSnapshot.trip_expires_at) || null,
        createdAt: selectedTripRecord?.created_at || asString(selectedTripSnapshot.created_at) || null,
        updatedAt: selectedTripRecord?.updated_at || asString(selectedTripSnapshot.updated_at) || null,
        sourceKind: selectedTripRecord?.source_kind || asString(selectedTripSnapshot.source_kind) || null,
    }), [selectedTripLog?.target_id, selectedTripRecord, selectedTripSnapshot]);

    const visibleColumnSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);
    const isColumnVisible = (columnId: AuditVisibleColumnId): boolean => visibleColumnSet.has(columnId);
    const tableColumnCount = 1 + visibleColumns.length;

    const hasActiveFilters = (
        actionFilters.length > 0
        || targetFilters.length > 0
        || actorFilters.length > 0
        || timePreset !== '30d'
        || visibleColumns.length !== DEFAULT_VISIBLE_COLUMNS.length
        || RESIZABLE_AUDIT_COLUMN_IDS.some((columnId) => columnWidths[columnId] !== AUDIT_COLUMN_WIDTH_DEFAULTS[columnId])
    );

    const resetFilters = () => {
        trackEvent('admin__audit--reset_filters');
        setActionFilters([]);
        setTargetFilters([]);
        setActorFilters([]);
        setTimePreset('30d');
        setCustomStartDate(getDefaultCustomStartDate());
        setCustomEndDate(getDefaultCustomEndDate());
        setVisibleColumns([...DEFAULT_VISIBLE_COLUMNS]);
        setSelectedEntryKeys([]);
        setColumnWidths({ ...AUDIT_COLUMN_WIDTH_DEFAULTS });
        setOffset(0);
    };

    // Everything a row, the entry sheet and the row menu need, derived once per entry.
    const describeEntry = (timelineEntry: AuditTimelineEntry) => {
        const log = timelineEntry.kind === 'admin'
            ? timelineEntry.log
            : mapUserChangeLogToAuditRecord(timelineEntry.log);
        const baseDiffEntries = timelineEntry.kind === 'admin'
            ? buildAuditDiffEntries(timelineEntry.log)
            : buildUserChangeDiffEntries(timelineEntry.log);
        const undoDiffEntries = timelineEntry.kind === 'admin'
            ? resolveUndoDiffEntries(timelineEntry.log, timelineEntriesById)
            : null;
        const diffEntries = undoDiffEntries ?? baseDiffEntries;
        const actionPresentation = timelineEntry.kind === 'admin'
            ? resolveAuditActionPresentation(timelineEntry.log, diffEntries)
            : resolveUserChangeActionPresentation(timelineEntry.log, diffEntries);
        const metadataRecord = asRecord(log.metadata);
        const rawOwnedTripCount = metadataRecord.owned_trips_before_delete;
        const ownedTripsBeforeDelete = timelineEntry.kind === 'admin'
            && log.action === 'admin.user.hard_delete'
            && typeof rawOwnedTripCount === 'number'
            ? rawOwnedTripCount
            : null;
        const formatValue = (entry: (typeof diffEntries)[number], value: unknown): string => (
            timelineEntry.kind === 'user'
                ? formatUserChangeDiffValue(entry, value)
                : formatAuditValue(value)
        );
        return {
            log,
            diffEntries,
            formatValue,
            actionPresentation,
            secondaryFacets: timelineEntry.kind === 'user' ? resolveUserChangeSecondaryFacets(timelineEntry.log) : [],
            targetLabel: getTargetLabel(log.target_type),
            targetCanOpenDrawer: canOpenTargetDrawer(log),
            ownedTripsBeforeDelete,
            actorEmail: getTimelineActorEmail(timelineEntry),
            actorUserId: getTimelineActorUserId(timelineEntry),
            originLabel: timelineEntry.kind === 'admin' ? 'Admin action' : 'User action',
            canShowFullDiff: canOpenFullDiffModal(timelineEntry),
            entryKey: getTimelineEntryKey(timelineEntry),
            canUndo: canUndoTimelineEntry(timelineEntry),
        };
    };

    const selectedEntry = useMemo(
        () => (selectedEntryKey
            ? timelineEntries.find((entry) => getTimelineEntryKey(entry) === selectedEntryKey) ?? null
            : null),
        [selectedEntryKey, timelineEntries]
    );
    const selectedEntryDetails = selectedEntry ? describeEntry(selectedEntry) : null;

    const openEntrySheet = (entryKey: string) => {
        trackEvent('admin__audit--open_entry');
        setIsUserDrawerOpen(false);
        setIsTripDrawerOpen(false);
        setSelectedEntryKey(entryKey);
    };

    const openActorDetails = (actorUserId: string, log: AdminAuditRecord, actorEmail: string | null) => {
        trackEvent('admin__audit--open_actor');
        openUserDrawerById(actorUserId, { sourceLog: log, actorEmail });
    };

    const openTargetDetails = (log: AdminAuditRecord) => {
        trackEvent('admin__audit--open_target', { target_type: log.target_type });
        openTargetDrawer(log);
    };

    const showFullDiff = (entry: AuditTimelineEntry) => {
        trackEvent('admin__audit--show_diff');
        void openFullDiffModal(entry);
    };

    const requestUndo = (entry: AuditTimelineEntry) => {
        trackEvent('admin__audit--undo', { action: entry.log.action });
        void undoTimelineEntry(entry);
    };

    const undoButtonClassName = 'border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-400/30 dark:text-amber-200 dark:hover:bg-amber-400/12 dark:hover:text-amber-100';

    const renderDiffLine = (
        details: ReturnType<typeof describeEntry>,
        entry: (typeof details.diffEntries)[number],
    ): string => (
        `${formatFieldLabel(entry.key)}: ${details.formatValue(entry, entry.beforeValue)} → ${details.formatValue(entry, entry.afterValue)}`
    );

    return (
        <AdminShell
            title="Audit log"
            description="Admin actions and user account and trip changes in one timeline, for incident replay and support tracing."
            searchValue={searchValue}
            onSearchValueChange={handleSearchValueChange}
            showDateRange={false}
            actions={(
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            trackEvent('admin__audit--export_replay', { count: visibleLogs.length });
                            void exportReplayBundle();
                        }}
                        disabled={isLoading || isExportingReplay || visibleLogs.length === 0}
                        aria-busy={isExportingReplay || undefined}
                        data-tooltip="Download every entry that matches the filters as a replay bundle"
                        {...getAnalyticsDebugAttributes('admin__audit--export_replay')}
                    >
                        {isExportingReplay
                            ? <SpinnerGap className="animate-spin" />
                            : <DownloadSimple />}
                        Export replay
                    </Button>
                    <AdminReloadButton
                        onClick={() => void loadLogs()}
                        isLoading={isLoading}
                        label="Reload"
                    />
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
            {errorMessage && (
                <AdminErrorAlert message={errorMessage} />
            )}
            {dataSourceNotice && (
                <Alert variant="warning">
                    <Warning weight="fill" />
                    <AlertDescription>
                        <p>{dataSourceNotice}</p>
                    </AlertDescription>
                </Alert>
            )}

            <section className="flex flex-wrap items-center gap-2" aria-label="Audit filters">
                <Select value={timePreset} onValueChange={(value) => handleTimePresetChange(value as AuditTimePreset)}>
                    <SelectTrigger className="h-8 w-[160px]" aria-label="Time range">
                        <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="24h">Last 24 hours</SelectItem>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                </Select>
                {timePreset === 'custom' && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCustomRangeDialogOpen(true)}
                        className="tabular-nums"
                    >
                        {formatAuditCustomRangeLabel(customStartDate, customEndDate)}
                    </Button>
                )}
                <AdminFilterMenu
                    label="Action"
                    icon={<Info size={14} className="mr-2 shrink-0 text-muted-foreground" weight="duotone" />}
                    options={actionFilterOptions}
                    selectedValues={actionFilters}
                    onSelectedValuesChange={handleActionFiltersChange}
                    selectAllLabel="Select all actions"
                    clearLabel="Clear action filter"
                />
                <AdminFilterMenu
                    label="Target"
                    icon={<Crosshair size={14} className="mr-2 shrink-0 text-muted-foreground" weight="duotone" />}
                    options={targetFilterOptions}
                    selectedValues={targetFilters}
                    onSelectedValuesChange={handleTargetFiltersChange}
                />
                <AdminFilterMenu
                    label="Actor"
                    icon={<User size={14} className="mr-2 shrink-0 text-muted-foreground" weight="duotone" />}
                    options={actorFilterOptions}
                    selectedValues={actorFilters}
                    onSelectedValuesChange={handleActorFiltersChange}
                />
                <AdminFilterMenu
                    label="Columns"
                    options={visibleColumnOptions}
                    selectedValues={visibleColumns}
                    onSelectedValuesChange={handleVisibleColumnsChange}
                />
                {hasActiveFilters && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        {...getAnalyticsDebugAttributes('admin__audit--reset_filters')}
                    >
                        <X />
                        Reset
                    </Button>
                )}
            </section>

            <Dialog open={isCustomRangeDialogOpen} onOpenChange={setIsCustomRangeDialogOpen}>
                <DialogContent className="w-[min(96vw,640px)] overflow-hidden rounded-lg p-0">
                    <DialogHeader className="border-b border-border">
                        <DialogTitle className="text-base font-semibold text-foreground">Custom time range</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Pick the start and end date used by the audit filters and replay export.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        <DateRangePicker
                            startDate={customStartDate}
                            endDate={customEndDate}
                            onChange={(start, end) => {
                                setCustomStartDate(start);
                                setCustomEndDate(end);
                                setOffset(0);
                            }}
                            showLabel={false}
                        />
                    </div>
                    <DialogFooter className="border-t border-border">
                        <Button
                            type="button"
                            onClick={() => setIsCustomRangeDialogOpen(false)}
                        >
                            Apply range
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminSurfaceCard className="flex flex-col gap-3 p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed border-collapse text-start text-sm">
                        <colgroup>
                            <col style={{ width: 40 }} />
                            {isColumnVisible('when') && <col style={{ width: `${columnWidths.when}px` }} />}
                            {isColumnVisible('actor') && <col style={{ width: `${columnWidths.actor}px` }} />}
                            {isColumnVisible('action') && <col style={{ width: `${columnWidths.action}px` }} />}
                            {isColumnVisible('target') && <col style={{ width: `${columnWidths.target}px` }} />}
                            {isColumnVisible('diff') && <col style={{ width: `${columnWidths.diff}px` }} />}
                            {isColumnVisible('rowActions') && <col style={{ width: 48 }} />}
                        </colgroup>
                        <thead>
                            <tr className="border-b border-border bg-muted/50 text-sm">
                                <th className="h-10 ps-3 pe-1 text-start align-middle">
                                    <Checkbox
                                        checked={areAllPageRowsSelected ? true : hasSomePageRowsSelected ? 'indeterminate' : false}
                                        onCheckedChange={(checked) => togglePageSelection(Boolean(checked))}
                                        aria-label="Select all rows on this page"
                                        disabled={pagedLogs.length === 0}
                                    />
                                </th>
                                {RESIZABLE_AUDIT_COLUMN_IDS.map((columnId) => (
                                    isColumnVisible(columnId) && (
                                        <th key={columnId} className="relative h-10 px-3 text-start align-middle font-medium text-muted-foreground">
                                            {AUDIT_COLUMN_RESIZE_LABELS[columnId]}
                                            <AuditColumnResizeHandle columnId={columnId} onResizeStart={beginColumnResize} />
                                        </th>
                                    )
                                ))}
                                {isColumnVisible('rowActions') && (
                                    <th className="h-10 px-2 text-end align-middle font-medium text-muted-foreground">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedLogs.map((timelineEntry) => {
                                const details = describeEntry(timelineEntry);
                                const { log, diffEntries, actionPresentation, actorEmail, actorUserId, entryKey } = details;
                                const summaryEntries = diffEntries.slice(0, AUDIT_DIFF_SUMMARY_LIMIT);
                                const hiddenDiffCount = Math.max(diffEntries.length - summaryEntries.length, 0);
                                const isRowSelected = selectedEntryKeySet.has(entryKey);
                                const isUndoing = revertingEntryKey === entryKey;

                                return (
                                    <tr
                                        key={entryKey}
                                        data-state={isRowSelected ? 'selected' : undefined}
                                        className={`border-b border-border align-top last:border-b-0 data-[state=selected]:bg-muted/60 ${ADMIN_TABLE_ROW_SURFACE_CLASS}`}
                                    >
                                        <td className="py-2.5 ps-3 pe-1">
                                            <Checkbox
                                                checked={isRowSelected}
                                                onCheckedChange={() => toggleRowSelection(entryKey)}
                                                aria-label={`Select ${actionPresentation.label} entry`}
                                            />
                                        </td>
                                        {isColumnVisible('when') && (
                                            <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                                <time
                                                    dateTime={log.created_at}
                                                    data-tooltip={formatAuditValue(log.created_at)}
                                                    className="tabular-nums"
                                                >
                                                    {formatAuditRelativeTime(log.created_at)}
                                                </time>
                                            </td>
                                        )}
                                        {isColumnVisible('actor') && (
                                            <td className="max-w-0 px-3 py-2.5">
                                                {actorUserId ? (
                                                    <Button
                                                        type="button"
                                                        variant="link"
                                                        onClick={() => openActorDetails(actorUserId, log, actorEmail)}
                                                        className="block h-auto max-w-full truncate p-0 text-start text-sm font-medium text-foreground"
                                                        data-tooltip="Open actor details"
                                                        {...getAnalyticsDebugAttributes('admin__audit--open_actor')}
                                                    >
                                                        {actorEmail || 'Unknown actor'}
                                                    </Button>
                                                ) : (
                                                    <span className="block truncate text-sm text-muted-foreground">
                                                        {actorEmail === 'Paddle' ? 'Paddle system' : (actorEmail || 'Unknown actor')}
                                                    </span>
                                                )}
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{details.originLabel}</span>
                                            </td>
                                        )}
                                        {isColumnVisible('action') && (
                                            <td className="px-3 py-2.5">
                                                <span
                                                    className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-xs font-medium ${actionPresentation.className}`}
                                                    data-tooltip={log.action}
                                                >
                                                    {actionPresentation.label}
                                                </span>
                                                {details.secondaryFacets.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                                        {details.secondaryFacets.map((facet, facetIndex) => (
                                                            <span
                                                                key={`${entryKey}-${buildSecondaryFacetRenderKey(facet, facetIndex)}`}
                                                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${facet.className}`}
                                                                data-tooltip={facet.code}
                                                            >
                                                                {facet.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                        {isColumnVisible('target') && (
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getTargetPillClass(log.target_type)}`}
                                                        data-tooltip={`Target type: ${log.target_type}`}
                                                    >
                                                        {details.targetLabel}
                                                    </span>
                                                    {details.targetCanOpenDrawer && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            onClick={() => openTargetDetails(log)}
                                                            aria-label={`Open ${details.targetLabel.toLowerCase()} details`}
                                                            data-tooltip={`Open ${details.targetLabel.toLowerCase()} details`}
                                                            {...getAnalyticsDebugAttributes('admin__audit--open_target')}
                                                        >
                                                            <ArrowSquareOut className="rtl:-scale-x-100" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="mt-1 min-w-0 text-[11px] text-muted-foreground">
                                                    {log.target_id
                                                        ? (
                                                            <CopyableUuid
                                                                value={log.target_id}
                                                                textClassName="max-w-[140px] truncate text-[11px]"
                                                                hintClassName="text-[9px]"
                                                            />
                                                        )
                                                        : <span>No target id</span>}
                                                </div>
                                            </td>
                                        )}
                                        {isColumnVisible('diff') && (
                                            <td className="px-2 py-1.5">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => openEntrySheet(entryKey)}
                                                    className="h-auto w-full flex-col items-stretch gap-0.5 whitespace-normal px-2 py-1 text-start text-xs font-normal"
                                                    aria-label={`Open details for ${actionPresentation.label}`}
                                                    {...getAnalyticsDebugAttributes('admin__audit--open_entry')}
                                                >
                                                    {summaryEntries.length > 0 ? (
                                                        summaryEntries.map((entry, entryIndex) => (
                                                            <span
                                                                key={`${entryKey}-${buildDiffEntryRenderKey(entry, entryIndex)}`}
                                                                className="block truncate text-foreground"
                                                            >
                                                                {renderDiffLine(details, entry)}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="block text-muted-foreground">No field changes recorded</span>
                                                    )}
                                                    {hiddenDiffCount > 0 && (
                                                        <span className="block text-muted-foreground tabular-nums">
                                                            +{hiddenDiffCount} more field{hiddenDiffCount === 1 ? '' : 's'}
                                                        </span>
                                                    )}
                                                    {details.ownedTripsBeforeDelete !== null && (
                                                        <span className="block font-medium text-red-700 dark:text-red-300 tabular-nums">
                                                            {details.ownedTripsBeforeDelete} owned trip{details.ownedTripsBeforeDelete === 1 ? '' : 's'} deleted
                                                        </span>
                                                    )}
                                                </Button>
                                            </td>
                                        )}
                                        {isColumnVisible('rowActions') && (
                                            <td className="px-2 py-2 text-end">
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            aria-label={`Actions for ${actionPresentation.label} entry`}
                                                            aria-busy={isUndoing || undefined}
                                                            data-tooltip="Entry actions"
                                                        >
                                                            {isUndoing
                                                                ? <SpinnerGap className="animate-spin" />
                                                                : <DotsThreeVertical weight="bold" />}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-[200px]">
                                                        <DropdownMenuItem onSelect={() => openEntrySheet(entryKey)}>
                                                            View details
                                                        </DropdownMenuItem>
                                                        {details.canShowFullDiff && (
                                                            <DropdownMenuItem onSelect={() => showFullDiff(timelineEntry)}>
                                                                Show full diff
                                                            </DropdownMenuItem>
                                                        )}
                                                        {details.targetCanOpenDrawer && (
                                                            <DropdownMenuItem onSelect={() => openTargetDetails(log)}>
                                                                Open {details.targetLabel.toLowerCase()}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {actorUserId && (
                                                            <DropdownMenuItem onSelect={() => openActorDetails(actorUserId, log, actorEmail)}>
                                                                Open actor
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onSelect={() => void copyActionCode(log.action)}>
                                                            Copy action code
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onSelect={() => void exportSingleReplayEntry(timelineEntry)}
                                                            disabled={isExportingReplay}
                                                        >
                                                            Export entry
                                                        </DropdownMenuItem>
                                                        {details.canUndo && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onSelect={() => requestUndo(timelineEntry)}
                                                                    disabled={Boolean(revertingEntryKey)}
                                                                >
                                                                    {getUndoActionLabel(timelineEntry)}…
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {visibleLogs.length === 0 && !isLoading && (
                                <tr>
                                    <td className="p-4" colSpan={tableColumnCount}>
                                        <AdminEmptyState
                                            title="No audit entries match these filters."
                                            description="Widen the time range or reset the filters to see more entries."
                                        />
                                    </td>
                                </tr>
                            )}
                            {isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-muted-foreground" colSpan={tableColumnCount}>
                                        <span className="inline-flex items-center gap-2" role="status">
                                            <SpinnerGap size={14} className="animate-spin" />
                                            Loading change logs…
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <AdminPagination
                    page={Math.floor(offset / AUDIT_PAGE_SIZE) + 1}
                    pageSize={AUDIT_PAGE_SIZE}
                    totalItems={visibleLogs.length}
                    onPageChange={(page) => setOffset(Math.max(0, (page - 1) * AUDIT_PAGE_SIZE))}
                    noun="entries"
                    className="px-4 pb-3"
                />
            </AdminSurfaceCard>

            <AdminSelectionBar
                count={selectedEntryKeys.length}
                noun="entry"
                pluralNoun="entries"
                onClear={() => setSelectedEntryKeys([])}
            >
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void exportSelectedReplayBundle()}
                    disabled={isExportingReplay}
                    aria-busy={isExportingReplay || undefined}
                    {...getAnalyticsDebugAttributes('admin__audit--export_selected')}
                >
                    {isExportingReplay
                        ? <SpinnerGap className="animate-spin" />
                        : <DownloadSimple />}
                    Export replay
                </Button>
            </AdminSelectionBar>
            </div>

            <AdminDetailSheet
                open={Boolean(selectedEntry && selectedEntryDetails)}
                onOpenChange={(open) => {
                    if (!open) setSelectedEntryKey(null);
                }}
                title={selectedEntryDetails?.actionPresentation.label ?? 'Audit entry'}
                subtitle={selectedEntryDetails ? formatAuditValue(selectedEntryDetails.log.created_at) : undefined}
                meta={selectedEntryDetails && (
                    <>
                        <AdminStatusBadge tone="neutral" dot={false}>{selectedEntryDetails.originLabel}</AdminStatusBadge>
                        <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getTargetPillClass(selectedEntryDetails.log.target_type)}`}
                        >
                            {selectedEntryDetails.targetLabel}
                        </span>
                    </>
                )}
                footer={selectedEntry && selectedEntryDetails && (
                    <>
                        {selectedEntryDetails.canShowFullDiff && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => showFullDiff(selectedEntry)}
                                {...getAnalyticsDebugAttributes('admin__audit--show_diff')}
                            >
                                Show full diff
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void exportSingleReplayEntry(selectedEntry)}
                            disabled={isExportingReplay}
                            aria-busy={isExportingReplay || undefined}
                            {...getAnalyticsDebugAttributes('admin__audit--export_entry')}
                        >
                            <DownloadSimple />
                            Export entry
                        </Button>
                        {selectedEntryDetails.canUndo && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => requestUndo(selectedEntry)}
                                disabled={Boolean(revertingEntryKey)}
                                aria-busy={revertingEntryKey === selectedEntryDetails.entryKey || undefined}
                                className={`ms-auto ${undoButtonClassName}`}
                                {...getAnalyticsDebugAttributes('admin__audit--undo')}
                            >
                                {revertingEntryKey === selectedEntryDetails.entryKey ? 'Undoing…' : getUndoActionLabel(selectedEntry)}
                            </Button>
                        )}
                    </>
                )}
            >
                {selectedEntry && selectedEntryDetails && (
                    <>
                        <section className="flex flex-col gap-2">
                            <AdminSectionHeader as="h3" title="Event" />
                            <dl className="divide-y divide-border">
                                <AuditDetailRow label="When">
                                    <span className="tabular-nums">{formatAuditValue(selectedEntryDetails.log.created_at)}</span>
                                    <span className="text-muted-foreground"> · {formatAuditRelativeTime(selectedEntryDetails.log.created_at)}</span>
                                </AuditDetailRow>
                                <AuditDetailRow label="Actor">
                                    {selectedEntryDetails.actorUserId ? (
                                        <div className="flex flex-col gap-0.5">
                                            <Button
                                                type="button"
                                                variant="link"
                                                className="h-auto w-fit p-0 text-sm"
                                                onClick={() => {
                                                    if (!selectedEntryDetails.actorUserId) return;
                                                    openActorDetails(selectedEntryDetails.actorUserId, selectedEntryDetails.log, selectedEntryDetails.actorEmail);
                                                }}
                                            >
                                                {selectedEntryDetails.actorEmail || 'Unknown actor'}
                                            </Button>
                                            <CopyableUuid value={selectedEntryDetails.actorUserId} textClassName="break-all text-xs" />
                                        </div>
                                    ) : (
                                        <span>{selectedEntryDetails.actorEmail === 'Paddle' ? 'Paddle system' : (selectedEntryDetails.actorEmail || 'Unknown actor')}</span>
                                    )}
                                </AuditDetailRow>
                                <AuditDetailRow label="Action code">
                                    <span className="inline-flex max-w-full items-center gap-1">
                                        <code className="truncate font-mono text-xs">{selectedEntryDetails.log.action}</code>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() => void copyActionCode(selectedEntryDetails.log.action)}
                                            aria-label="Copy action code"
                                            data-tooltip="Copy action code"
                                        >
                                            <CopySimple />
                                        </Button>
                                    </span>
                                </AuditDetailRow>
                                <AuditDetailRow label="Target">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="inline-flex items-center gap-1">
                                            {selectedEntryDetails.targetLabel}
                                            {selectedEntryDetails.targetCanOpenDrawer && (
                                                <Button
                                                    type="button"
                                                    variant="link"
                                                    className="h-auto p-0 text-sm"
                                                    onClick={() => openTargetDetails(selectedEntryDetails.log)}
                                                >
                                                    Open details
                                                </Button>
                                            )}
                                        </span>
                                        {selectedEntryDetails.log.target_id && (
                                            <CopyableUuid value={selectedEntryDetails.log.target_id} textClassName="break-all text-xs" />
                                        )}
                                    </div>
                                </AuditDetailRow>
                                <AuditDetailRow label="Event id">
                                    <CopyableUuid value={selectedEntryDetails.log.id} textClassName="break-all text-xs" />
                                </AuditDetailRow>
                                {selectedEntryDetails.secondaryFacets.length > 0 && (
                                    <AuditDetailRow label="Also changed">
                                        <span className="flex flex-wrap gap-1">
                                            {selectedEntryDetails.secondaryFacets.map((facet, facetIndex) => (
                                                <span
                                                    key={`sheet-${buildSecondaryFacetRenderKey(facet, facetIndex)}`}
                                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${facet.className}`}
                                                    data-tooltip={facet.code}
                                                >
                                                    {facet.label}
                                                </span>
                                            ))}
                                        </span>
                                    </AuditDetailRow>
                                )}
                            </dl>
                        </section>

                        <section className="flex flex-col gap-2">
                            <AdminSectionHeader
                                as="h3"
                                title="Changes"
                                description={selectedEntryDetails.diffEntries.length > 0
                                    ? `${selectedEntryDetails.diffEntries.length} changed field${selectedEntryDetails.diffEntries.length === 1 ? '' : 's'}`
                                    : 'No field changes were recorded for this event.'}
                            />
                            {selectedEntryDetails.ownedTripsBeforeDelete !== null && (
                                <Alert variant="destructive">
                                    <Warning weight="fill" />
                                    <AlertDescription>
                                        <p>
                                            {selectedEntryDetails.ownedTripsBeforeDelete} owned trip{selectedEntryDetails.ownedTripsBeforeDelete === 1 ? ' was' : 's were'} deleted with this account.
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {selectedEntryDetails.diffEntries.map((entry, entryIndex) => (
                                <article
                                    key={`sheet-${buildDiffEntryRenderKey(entry, entryIndex)}`}
                                    className="rounded-md border border-border px-3 py-2"
                                >
                                    <p className="text-xs font-medium text-muted-foreground">{formatFieldLabel(entry.key)}</p>
                                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                                        <div className="min-w-0 rounded-sm border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/12 dark:text-rose-200">
                                            <span className="font-medium">Before: </span>
                                            <span className="break-all">{selectedEntryDetails.formatValue(entry, entry.beforeValue)}</span>
                                        </div>
                                        <div className="min-w-0 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-200">
                                            <span className="font-medium">After: </span>
                                            <span className="break-all">{selectedEntryDetails.formatValue(entry, entry.afterValue)}</span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </section>
                    </>
                )}
            </AdminDetailSheet>

            <AdminJsonDiffModal
                isOpen={isDiffModalOpen}
                onClose={() => {
                    setIsDiffModalOpen(false);
                    setDiffModalError(null);
                    setIsDiffModalLoading(false);
                }}
                title={diffModalTitle}
                description={diffModalDescription}
                beforeLabel={diffModalBeforeLabel}
                afterLabel={diffModalAfterLabel}
                beforeValue={diffModalBeforeValue}
                afterValue={diffModalAfterValue}
                isLoading={isDiffModalLoading}
                errorMessage={diffModalError}
            />

            <AdminDetailSheet
                open={isUserDrawerOpen}
                onOpenChange={(open) => {
                    setIsUserDrawerOpen(open);
                    if (open) return;
                    setSelectedUserLog(null);
                    setSelectedUserProfile(null);
                    setUserDrawerError(null);
                }}
                size="md"
                title={userIdentity.name || userIdentity.email || 'User'}
                accessibleTitle="User details"
                subtitle={userIdentity.name ? (userIdentity.email || undefined) : undefined}
                meta={resolvedUserAccountStatus && (
                    <AdminStatusBadge
                        tone={resolvedUserAccountStatus === 'active' ? 'success' : resolvedUserAccountStatus === 'deleted' ? 'danger' : 'warning'}
                    >
                        {formatAccountStatusLabel(resolvedUserAccountStatus)}
                    </AdminStatusBadge>
                )}
                headerActions={userIdentity.userId !== 'n/a' && (
                    <Button asChild variant="outline" size="sm">
                        <Link
                            to={`/admin/users?user=${encodeURIComponent(userIdentity.userId)}&drawer=user`}
                            onClick={() => trackEvent('admin__audit--open_in_users')}
                            {...getAnalyticsDebugAttributes('admin__audit--open_in_users')}
                        >
                            Open in Users
                        </Link>
                    </Button>
                )}
                footer={resolvedUserAccountStatus === 'deleted' && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            trackEvent('admin__audit--restore_user');
                            void restoreUserFromAudit();
                        }}
                        disabled={isRestoringUser || !selectedUserLog?.target_id || !selectedUserProfile}
                        aria-busy={isRestoringUser || undefined}
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-400/12 dark:hover:text-emerald-100"
                        {...getAnalyticsDebugAttributes('admin__audit--restore_user')}
                    >
                        {isRestoringUser ? 'Restoring…' : 'Restore user'}
                    </Button>
                )}
            >
                {userDrawerError && (
                    <Alert variant="warning">
                        <Warning weight="fill" />
                        <AlertDescription>
                            <p>{userDrawerError}</p>
                        </AlertDescription>
                    </Alert>
                )}
                {isLoadingUserProfile ? (
                    <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <SpinnerGap size={14} className="animate-spin" />
                        Loading user profile…
                    </div>
                ) : (
                    <>
                        <section className="flex flex-col gap-2">
                            <AdminSectionHeader as="h3" title="Profile" />
                            <dl className="divide-y divide-border">
                                <AuditDetailRow label="Name">{userIdentity.name || '—'}</AuditDetailRow>
                                <AuditDetailRow label="Email">{userIdentity.email || 'No email'}</AuditDetailRow>
                                <AuditDetailRow label="User id">
                                    <CopyableUuid value={userIdentity.userId} textClassName="break-all text-xs" />
                                </AuditDetailRow>
                                <AuditDetailRow label="Role">{userIdentity.role || '—'}</AuditDetailRow>
                                <AuditDetailRow label="Tier">{userIdentity.tier || '—'}</AuditDetailRow>
                                {userIdentity.totalTrips !== null && (
                                    <AuditDetailRow label="Trips">
                                        <span className="tabular-nums">{userIdentity.activeTrips ?? 0} active / {userIdentity.totalTrips} total</span>
                                    </AuditDetailRow>
                                )}
                            </dl>
                        </section>
                        {Object.keys(selectedUserSnapshot).length > 0 && (
                            <SnapshotDisclosure snapshot={selectedUserSnapshot} />
                        )}
                    </>
                )}
            </AdminDetailSheet>

            <AdminDetailSheet
                open={isTripDrawerOpen}
                onOpenChange={(open) => {
                    setIsTripDrawerOpen(open);
                    if (open) return;
                    setSelectedTripLog(null);
                    setSelectedTripRecord(null);
                    setTripDrawerError(null);
                }}
                size="md"
                title={tripIdentity.title || 'Trip'}
                accessibleTitle="Trip details"
                subtitle={tripIdentity.ownerEmail || undefined}
                meta={tripIdentity.status && (
                    <AdminStatusBadge
                        tone={tripIdentity.status === 'active' ? 'success' : tripIdentity.status === 'archived' ? 'neutral' : 'warning'}
                    >
                        {tripIdentity.status.charAt(0).toUpperCase() + tripIdentity.status.slice(1)}
                    </AdminStatusBadge>
                )}
                headerActions={tripIdentity.tripId !== 'n/a' && (
                    <Button asChild variant="outline" size="sm">
                        <a
                            href={`/trip/${encodeURIComponent(tripIdentity.tripId)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => trackEvent('admin__audit--open_trip')}
                            {...getAnalyticsDebugAttributes('admin__audit--open_trip')}
                        >
                            Open trip
                            <ArrowSquareOut className="rtl:-scale-x-100" />
                        </a>
                    </Button>
                )}
                footer={tripIdentity.tripId !== 'n/a' && (
                    <>
                        <Button asChild variant="outline" size="sm">
                            <Link
                                to={`/admin/trips?trip=${encodeURIComponent(tripIdentity.tripId)}&drawer=trip`}
                                onClick={() => trackEvent('admin__audit--open_in_trips')}
                                {...getAnalyticsDebugAttributes('admin__audit--open_in_trips')}
                            >
                                Open in Trips
                            </Link>
                        </Button>
                        {tripIdentity.ownerId && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (!tripIdentity.ownerId) return;
                                    trackEvent('admin__audit--open_owner');
                                    openTargetDrawer({
                                        id: selectedTripLog?.id || `audit-owner-${tripIdentity.ownerId}`,
                                        actor_user_id: null,
                                        actor_email: null,
                                        action: 'audit.open_owner_from_trip',
                                        target_type: 'user',
                                        target_id: tripIdentity.ownerId,
                                        before_data: null,
                                        after_data: null,
                                        metadata: null,
                                        created_at: selectedTripLog?.created_at || tripIdentity.createdAt || FALLBACK_AUDIT_TIMESTAMP,
                                    });
                                }}
                                {...getAnalyticsDebugAttributes('admin__audit--open_owner')}
                            >
                                Open owner
                            </Button>
                        )}
                    </>
                )}
            >
                {tripDrawerError && (
                    <Alert variant="warning">
                        <Warning weight="fill" />
                        <AlertDescription>
                            <p>{tripDrawerError}</p>
                        </AlertDescription>
                    </Alert>
                )}
                {isLoadingTripRecord ? (
                    <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <SpinnerGap size={14} className="animate-spin" />
                        Loading trip details…
                    </div>
                ) : (
                    <>
                        <section className="flex flex-col gap-2">
                            <AdminSectionHeader as="h3" title="Trip" />
                            <dl className="divide-y divide-border">
                                <AuditDetailRow label="Trip id">
                                    <CopyableUuid value={tripIdentity.tripId} textClassName="break-all text-xs" />
                                </AuditDetailRow>
                                <AuditDetailRow label="Owner">
                                    <div className="flex flex-col gap-0.5">
                                        <span>{tripIdentity.ownerEmail || (tripIdentity.ownerId ? 'No email' : '—')}</span>
                                        {tripIdentity.ownerId && (
                                            <CopyableUuid value={tripIdentity.ownerId} textClassName="break-all text-xs" />
                                        )}
                                    </div>
                                </AuditDetailRow>
                                <AuditDetailRow label="Expires">{tripIdentity.expiresAt ? formatAuditValue(tripIdentity.expiresAt) : 'Not set'}</AuditDetailRow>
                                <AuditDetailRow label="Source">{tripIdentity.sourceKind || '—'}</AuditDetailRow>
                                <AuditDetailRow label="Created">{tripIdentity.createdAt ? formatAuditValue(tripIdentity.createdAt) : '—'}</AuditDetailRow>
                                <AuditDetailRow label="Updated">{tripIdentity.updatedAt ? formatAuditValue(tripIdentity.updatedAt) : '—'}</AuditDetailRow>
                            </dl>
                        </section>
                        {Object.keys(selectedTripSnapshot).length > 0 && (
                            <SnapshotDisclosure snapshot={selectedTripSnapshot} />
                        )}
                    </>
                )}
            </AdminDetailSheet>
        </AdminShell>
    );
};
