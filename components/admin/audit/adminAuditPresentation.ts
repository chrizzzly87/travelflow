import type { AdminAuditRecord } from '../../../services/adminService';
import {
    formatUserChangeDiffValue,
    resolveUserChangeActionPresentation,
    resolveUserChangeSecondaryFacets,
    buildUserChangeDiffEntries,
    type UserChangeDiffEntry,
    type UserChangeSecondaryFacet,
} from '../../../services/adminUserChangeLog';
import { parseUndoSourceEventId, resolveUndoDiffEntries } from '../../../services/adminAuditUndoDiff';
import {
    asRecord,
    canOpenFullDiff,
    canOpenTargetDrawer,
    canUndoTimelineEntry,
    getActionFilterLabel,
    getTargetLabel,
    getTimelineActorEmail,
    getTimelineActorUserId,
    getTimelineEntryKey,
    toAuditRecord,
    type AuditTimelineEntry,
    type AuditTimelineIndex,
} from './adminAuditModel';

// How audit entries read on screen: labels, badge tones and value formatting.

export type AuditDiffEntry = UserChangeDiffEntry;

const NOISY_DIFF_KEYS = new Set([
    'updated_at',
    'created_at',
    'role_updated_at',
    'role_updated_by',
]);

const toComparableValue = (value: unknown): string => JSON.stringify(value ?? null);

export const formatFieldLabel = (value: string): string => (
    value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
);

export const formatAuditValue = (value: unknown): string => {
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

export const formatAccountStatusLabel = (status: string | null | undefined): string => {
    const normalized = (status || 'active').toLowerCase();
    if (normalized === 'disabled') return 'Suspended';
    if (normalized === 'deleted') return 'Deleted';
    return 'Active';
};

/** Paddle writes billing rows without a user id; name it instead of "Unknown actor". */
export const formatAuditActorName = (actorEmail: string | null): string => (
    actorEmail === 'Paddle' ? 'Paddle system' : (actorEmail || 'Unknown actor')
);

export const buildAuditDiffEntries = (log: AdminAuditRecord): AuditDiffEntry[] => {
    const before = asRecord(log.before_data);
    const after = asRecord(log.after_data);
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys
        .flatMap((key) => {
            if (NOISY_DIFF_KEYS.has(key)) return [];
            if (toComparableValue(before[key]) === toComparableValue(after[key])) return [];
            return [{ key, beforeValue: before[key], afterValue: after[key] }];
        })
        .sort((a, b) => a.key.localeCompare(b.key));
};

const getStatusChange = (entries: AuditDiffEntry[], key: string): { from: string; to: string } | null => {
    const entry = entries.find((candidate) => candidate.key === key);
    if (!entry) return null;
    const from = typeof entry.beforeValue === 'string' ? entry.beforeValue.trim().toLowerCase() : '';
    const to = typeof entry.afterValue === 'string' ? entry.afterValue.trim().toLowerCase() : '';
    if (!from && !to) return null;
    return { from, to };
};

const TONE_CLASS = {
    rose: 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30',
    sky: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/12 dark:text-emerald-200 dark:border-emerald-400/30',
    amber: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30',
    indigo: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-400/12 dark:text-indigo-200 dark:border-indigo-400/30',
    violet: 'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-400/12 dark:text-violet-200 dark:border-violet-400/30',
    accent: 'border-accent-300 bg-accent-50 text-accent-800 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30',
    neutral: 'border-border bg-secondary text-foreground',
} as const;

export interface AuditActionPresentation {
    label: string;
    className: string;
}

const present = (label: string, tone: keyof typeof TONE_CLASS): AuditActionPresentation => ({
    label,
    className: TONE_CLASS[tone],
});

const FIXED_ACTION_PRESENTATION: Record<string, AuditActionPresentation> = {
    'admin.user.hard_delete': present('Hard-deleted user', 'rose'),
    'admin.trip.hard_delete': present('Hard-deleted trip', 'rose'),
    'admin.user.invite': present('Invited user', 'sky'),
    'admin.user.create_direct': present('Created user', 'emerald'),
    'admin.user.update_tier': present('Updated user tier', 'sky'),
    'admin.user.update_overrides': present('Updated overrides', 'indigo'),
    'admin.user.reset_username_cooldown': present('Revoked username cooldown', 'amber'),
    'admin.user.reset_terms_acceptance': present('Reset Terms acceptance', 'amber'),
    'admin.tier.update_entitlements': present('Updated tier entitlements', 'sky'),
    'admin.tier.reapply': present('Reapplied tier', 'neutral'),
    'admin.terms.publish': present('Published Terms version', 'sky'),
    'admin.terms.set_current': present('Set current Terms version', 'sky'),
    'billing.transaction.completed': present('Billing transaction completed', 'emerald'),
};

const resolveUserProfileUpdate = (diffEntries: AuditDiffEntry[]): AuditActionPresentation => {
    const change = getStatusChange(diffEntries, 'account_status');
    if (change?.to === 'deleted') return present('Soft-deleted user', 'amber');
    if (change?.from === 'deleted' && change?.to === 'active') return present('Restored user', 'emerald');
    if (change?.to === 'disabled') return present('Suspended user', 'amber');
    if (change?.from === 'disabled' && change?.to === 'active') return present('Reactivated user', 'emerald');
    if (diffEntries.some((entry) => entry.key === 'system_role')) return present('Updated user role', 'indigo');
    if (diffEntries.some((entry) => entry.key === 'tier_key')) return present('Updated user tier', 'sky');
    return present('Updated user', 'neutral');
};

const resolveTripUpdate = (diffEntries: AuditDiffEntry[]): AuditActionPresentation => {
    if (diffEntries.some((entry) => entry.key === 'owner_id')) return present('Transferred trip owner', 'violet');
    const change = getStatusChange(diffEntries, 'status');
    if (change?.to === 'archived') return present('Archived trip', 'amber');
    if (change?.from === 'archived' && change?.to === 'active') return present('Restored trip', 'emerald');
    if (change?.to === 'expired') return present('Expired trip', 'amber');
    if (diffEntries.some((entry) => entry.key === 'trip_expires_at')) return present('Updated trip expiry', 'sky');
    return present('Updated trip', 'neutral');
};

export const resolveAuditActionPresentation = (
    log: AdminAuditRecord,
    diffEntries: AuditDiffEntry[]
): AuditActionPresentation => {
    const raw = log.action;
    const fixed = FIXED_ACTION_PRESENTATION[raw];
    if (fixed) return fixed;
    if (raw === 'admin.user.update_profile') return resolveUserProfileUpdate(diffEntries);
    if (raw === 'admin.trip.update') return resolveTripUpdate(diffEntries);
    if (raw === 'admin.trip.override_commit') {
        return parseUndoSourceEventId(log)
            ? present('Undid trip change', 'emerald')
            : present('Overrode trip content', 'violet');
    }
    if (raw.startsWith('billing.subscription.')) {
        if (raw.endsWith('.canceled')) return present('Billing subscription canceled', 'rose');
        if (raw.endsWith('.activated')) return present('Billing subscription activated', 'emerald');
        return present('Billing subscription updated', 'accent');
    }
    return present(getActionFilterLabel(raw), 'neutral');
};

export const getTargetPillClass = (targetType: string): string => {
    if (targetType === 'user') return TONE_CLASS.indigo;
    if (targetType === 'trip') return TONE_CLASS.sky;
    if (targetType === 'tier') return TONE_CLASS.violet;
    if (targetType === 'subscription') return TONE_CLASS.accent;
    return TONE_CLASS.neutral;
};

export interface AuditEntryDetails {
    log: AdminAuditRecord;
    diffEntries: AuditDiffEntry[];
    formatValue: (entry: AuditDiffEntry, value: unknown) => string;
    actionPresentation: AuditActionPresentation;
    secondaryFacets: UserChangeSecondaryFacet[];
    targetLabel: string;
    targetCanOpenDrawer: boolean;
    ownedTripsBeforeDelete: number | null;
    actorEmail: string | null;
    actorUserId: string | null;
    originLabel: string;
    canShowFullDiff: boolean;
    entryKey: string;
    canUndo: boolean;
}

/** Everything a row, the entry sheet and the row menu need, derived once per entry. */
export const describeAuditEntry = (
    timelineEntry: AuditTimelineEntry,
    index: AuditTimelineIndex,
): AuditEntryDetails => {
    const log = toAuditRecord(timelineEntry);
    const isAdmin = timelineEntry.kind === 'admin';
    const baseDiffEntries = timelineEntry.kind === 'admin'
        ? buildAuditDiffEntries(timelineEntry.log)
        : buildUserChangeDiffEntries(timelineEntry.log);
    const undoDiffEntries = timelineEntry.kind === 'admin'
        ? resolveUndoDiffEntries(timelineEntry.log, index)
        : null;
    const diffEntries = undoDiffEntries ?? baseDiffEntries;
    const actionPresentation = timelineEntry.kind === 'admin'
        ? resolveAuditActionPresentation(timelineEntry.log, diffEntries)
        : resolveUserChangeActionPresentation(timelineEntry.log, diffEntries);
    const rawOwnedTripCount = asRecord(log.metadata).owned_trips_before_delete;
    const ownedTripsBeforeDelete = isAdmin
        && log.action === 'admin.user.hard_delete'
        && typeof rawOwnedTripCount === 'number'
        ? rawOwnedTripCount
        : null;
    return {
        log,
        diffEntries,
        formatValue: (entry, value) => (
            isAdmin ? formatAuditValue(value) : formatUserChangeDiffValue(entry, value)
        ),
        actionPresentation,
        secondaryFacets: timelineEntry.kind === 'user' ? resolveUserChangeSecondaryFacets(timelineEntry.log) : [],
        targetLabel: getTargetLabel(log.target_type),
        targetCanOpenDrawer: canOpenTargetDrawer(log),
        ownedTripsBeforeDelete,
        actorEmail: getTimelineActorEmail(timelineEntry),
        actorUserId: getTimelineActorUserId(timelineEntry),
        originLabel: isAdmin ? 'Admin action' : 'User action',
        canShowFullDiff: canOpenFullDiff(timelineEntry),
        entryKey: getTimelineEntryKey(timelineEntry),
        canUndo: canUndoTimelineEntry(timelineEntry),
    };
};

export const formatAuditDiffLine = (details: AuditEntryDetails, entry: AuditDiffEntry): string => (
    `${formatFieldLabel(entry.key)}: ${details.formatValue(entry, entry.beforeValue)} → ${details.formatValue(entry, entry.afterValue)}`
);
