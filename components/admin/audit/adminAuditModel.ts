import type {
    AdminAuditRecord,
    AdminTripRecord,
    AdminUserChangeRecord,
    AdminUserRecord,
    adminUpdateUserProfile,
} from '../../../services/adminService';
import type { PlanTierKey } from '../../../types';
import type { AdminFilterMenuOption } from '../AdminFilterMenu';
import type { AdminTableSortDirection } from '../AdminDataTableUtils';
import { formatAdminRelativeTime } from '../adminRelativeTime';
import {
    buildUserChangeDiffEntries,
    resolveUserChangeActionPresentation,
} from '../../../services/adminUserChangeLog';
import {
    parseUndoRootSourceEventId,
    parseUndoSourceEventId,
    resolveUndoParity,
} from '../../../services/adminAuditUndoDiff';

// Pure model for the Audit log screen: parsing, filtering, sorting, paging and the
// rules for what a timeline entry allows. Nothing here touches React or the network.

export const AUDIT_CACHE_KEY = 'admin.audit.cache.v1';
export const USER_CHANGE_CACHE_KEY = 'admin.user_changes.cache.v1';
export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_SOURCE_MAX_ROWS = 500;
export const AUDIT_DIFF_SUMMARY_LIMIT = 2;
export const FALLBACK_AUDIT_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

export const ACTOR_FILTER_VALUES = ['admin', 'user'] as const;
export const AUDIT_TIME_PRESETS = ['24h', '7d', '30d', 'all', 'custom'] as const;
export const AUDIT_VISIBLE_COLUMN_IDS = ['when', 'actor', 'action', 'target', 'diff', 'rowActions'] as const;
export const RESIZABLE_AUDIT_COLUMN_IDS = ['when', 'actor', 'action', 'target', 'diff'] as const;
export const AUDIT_SORT_COLUMNS = ['when', 'actor', 'action', 'target'] as const;

export type AuditActorFilter = typeof ACTOR_FILTER_VALUES[number];
export type AuditTimePreset = typeof AUDIT_TIME_PRESETS[number];
export type AuditVisibleColumnId = typeof AUDIT_VISIBLE_COLUMN_IDS[number];
export type AuditResizableColumnId = typeof RESIZABLE_AUDIT_COLUMN_IDS[number];
export type AuditSortColumn = typeof AUDIT_SORT_COLUMNS[number];

export interface AuditSort {
    column: AuditSortColumn;
    direction: AdminTableSortDirection;
}

export const DEFAULT_AUDIT_SORT: AuditSort = { column: 'when', direction: 'desc' };
export const DEFAULT_AUDIT_TIME_PRESET: AuditTimePreset = '30d';

export const AUDIT_COLUMN_OPTIONS: Array<{ value: AuditVisibleColumnId; label: string }> = [
    { value: 'when', label: 'When' },
    { value: 'actor', label: 'Actor' },
    { value: 'action', label: 'Action' },
    { value: 'target', label: 'Target' },
    { value: 'diff', label: 'Changes' },
    { value: 'rowActions', label: 'Actions' },
];
export const DEFAULT_VISIBLE_COLUMNS: AuditVisibleColumnId[] = [...AUDIT_VISIBLE_COLUMN_IDS];

// Defaults sum (with the checkbox and menu columns) to ~1140px, the content width
// beside the expanded sidebar at 1440px, so the timeline fits without scrolling.
export const AUDIT_COLUMN_WIDTH_DEFAULTS: Record<AuditResizableColumnId, number> = {
    when: 112,
    actor: 210,
    action: 220,
    target: 170,
    diff: 340,
};
export const AUDIT_COLUMN_WIDTH_MIN: Record<AuditResizableColumnId, number> = {
    when: 96,
    actor: 150,
    action: 160,
    target: 140,
    diff: 220,
};
export const AUDIT_COLUMN_LABELS: Record<AuditResizableColumnId, string> = {
    when: 'When',
    actor: 'Actor',
    action: 'Action',
    target: 'Target',
    diff: 'Changes',
};

export type AuditTimelineEntry =
    | { kind: 'admin'; log: AdminAuditRecord }
    | { kind: 'user'; log: AdminUserChangeRecord };

export type AuditTimelineIndex = Map<string, AuditTimelineEntry>;

export interface AuditFilterState {
    search: string;
    timePreset: AuditTimePreset;
    customStartDate: string;
    customEndDate: string;
    actionFilters: string[];
    targetFilters: string[];
    actorFilters: AuditActorFilter[];
}

// ---------------------------------------------------------------------------
// Labels and grouping
// ---------------------------------------------------------------------------

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

export const getActionGroupOrder = (groupLabel: string): number => {
    const index = ACTION_GROUP_ORDER.indexOf(groupLabel as (typeof ACTION_GROUP_ORDER)[number]);
    return index >= 0 ? index : ACTION_GROUP_ORDER.length;
};

export const getActionGroupLabel = (action: string): string => {
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

export const getActionFilterLabel = (action: string): string => ACTION_FILTER_LABELS[action] || action;

export const getTargetLabel = (targetType: string): string => TARGET_LABELS[targetType] || targetType;

export const formatAuditRelativeTime = (isoDate: string | null | undefined, now = Date.now()): string => (
    formatAdminRelativeTime(isoDate, now)
);

/**
 * An action filter that covers every available action is no filter at all. Storing
 * it as `[]` keeps actions that appear later (a wider time range, a reload) visible
 * instead of silently hiding them, and keeps the URL short.
 */
export const normalizeActionFilters = (values: string[], allValues: string[]): string[] => {
    if (values.length === 0 || allValues.length === 0) return values;
    const selected = new Set(values);
    return allValues.every((value) => selected.has(value)) ? [] : values;
};

// ---------------------------------------------------------------------------
// Parsing and URL serialization
// ---------------------------------------------------------------------------

export const parseQueryMultiValue = (value: string | null): string[] => {
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

export const parseNonNegativeOffset = (value: string | null): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
};

export const parseAuditTimePreset = (value: string | null): AuditTimePreset => (
    AUDIT_TIME_PRESETS.includes(value as AuditTimePreset) ? value as AuditTimePreset : DEFAULT_AUDIT_TIME_PRESET
);

export const sanitizeActorFilters = (values: string[]): AuditActorFilter[] => values.filter(
    (value): value is AuditActorFilter => ACTOR_FILTER_VALUES.includes(value as AuditActorFilter)
);

/** Unknown ids are dropped; an empty result falls back to the default columns. */
export const sanitizeAuditVisibleColumns = (values: string[]): AuditVisibleColumnId[] => {
    const parsed = values.filter((columnId): columnId is AuditVisibleColumnId => (
        AUDIT_VISIBLE_COLUMN_IDS.includes(columnId as AuditVisibleColumnId)
    ));
    return parsed.length > 0 ? parsed : [...DEFAULT_VISIBLE_COLUMNS];
};

export const parseAuditVisibleColumns = (value: string | null): AuditVisibleColumnId[] => (
    sanitizeAuditVisibleColumns(parseQueryMultiValue(value))
);

const isTextSortColumn = (column: AuditSortColumn): boolean => column !== 'when';

export const getDefaultAuditSortDirection = (column: AuditSortColumn): AdminTableSortDirection => (
    isTextSortColumn(column) ? 'asc' : 'desc'
);

export const parseAuditSort = (column: string | null, direction: string | null): AuditSort => {
    const parsedColumn = AUDIT_SORT_COLUMNS.includes(column as AuditSortColumn)
        ? column as AuditSortColumn
        : DEFAULT_AUDIT_SORT.column;
    const parsedDirection = direction === 'asc' || direction === 'desc'
        ? direction
        : getDefaultAuditSortDirection(parsedColumn);
    return { column: parsedColumn, direction: parsedDirection };
};

/** Clicking the sorted column flips it; a new column starts in its natural order. */
export const toggleAuditSort = (current: AuditSort, column: AuditSortColumn): AuditSort => (
    current.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: getDefaultAuditSortDirection(column) }
);

export const toDateInputValue = (value: Date): string => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getDefaultCustomRange = (nowMs: number = Date.now()): { startDate: string; endDate: string } => {
    const start = new Date(nowMs);
    start.setDate(start.getDate() - 6);
    return { startDate: toDateInputValue(start), endDate: toDateInputValue(new Date(nowMs)) };
};

export interface AuditUrlState extends AuditFilterState {
    visibleColumns: AuditVisibleColumnId[];
    sort: AuditSort;
    offset: number;
}

/** Only non-default values reach the URL, so a fresh screen keeps a clean address. */
export const buildAuditSearchParams = (state: AuditUrlState): URLSearchParams => {
    const next = new URLSearchParams();
    const trimmedSearch = state.search.trim();
    if (trimmedSearch) next.set('q', trimmedSearch);
    if (state.timePreset !== DEFAULT_AUDIT_TIME_PRESET) next.set('range', state.timePreset);
    if (state.timePreset === 'custom') {
        if (state.customStartDate) next.set('start', state.customStartDate);
        if (state.customEndDate) next.set('end', state.customEndDate);
    }
    if (state.actionFilters.length > 0) next.set('action', state.actionFilters.join(','));
    if (state.targetFilters.length > 0) next.set('target', state.targetFilters.join(','));
    if (state.actorFilters.length > 0) next.set('actor', state.actorFilters.join(','));
    if (state.visibleColumns.length !== DEFAULT_VISIBLE_COLUMNS.length) {
        next.set('cols', state.visibleColumns.join(','));
    }
    if (state.sort.column !== DEFAULT_AUDIT_SORT.column || state.sort.direction !== DEFAULT_AUDIT_SORT.direction) {
        next.set('sort', state.sort.column);
        next.set('dir', state.sort.direction);
    }
    if (state.offset > 0) next.set('offset', String(state.offset));
    return next;
};

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

export const parseDateInputToTimestamp = (value: string, asEndOfDay: boolean): number | null => {
    if (!value) return null;
    const parsed = new Date(`${value}T${asEndOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    const timestamp = parsed.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
};

export const formatAuditCustomRangeLabel = (startDate: string, endDate: string): string => {
    const startTs = parseDateInputToTimestamp(startDate, false);
    const endTs = parseDateInputToTimestamp(endDate, true);
    if (!startTs || !endTs) return 'Choose custom range';
    return `${new Date(startTs).toLocaleDateString()} - ${new Date(endTs).toLocaleDateString()}`;
};

export const isIsoDateInAuditRange = (
    isoDate: string | null | undefined,
    dateRange: AuditTimePreset,
    customStartDate: string,
    customEndDate: string,
    nowMs: number = Date.now(),
): boolean => {
    if (!isoDate) return false;
    const timestamp = Date.parse(isoDate);
    if (!Number.isFinite(timestamp)) return false;

    if (dateRange === 'all') return true;
    if (dateRange === '24h') return timestamp >= (nowMs - DAY_MS);
    if (dateRange === '7d') return timestamp >= (nowMs - (7 * DAY_MS));
    if (dateRange === '30d') return timestamp >= (nowMs - (30 * DAY_MS));

    const startTs = parseDateInputToTimestamp(customStartDate, false);
    const endTs = parseDateInputToTimestamp(customEndDate, true);
    if (!startTs || !endTs) return false;
    if (startTs <= endTs) return timestamp >= startTs && timestamp <= endTs;
    return timestamp >= endTs && timestamp <= startTs;
};

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

export const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

export const hasSnapshotData = (value: Record<string, unknown> | null | undefined): boolean => (
    Object.keys(asRecord(value)).length > 0
);

export const isPlanTierKey = (value: string): value is PlanTierKey => (
    value === 'tier_free' || value === 'tier_mid' || value === 'tier_premium'
);

export const isUserStatusValue = (value: unknown): value is 'active' | 'disabled' | 'deleted' => (
    value === 'active' || value === 'disabled' || value === 'deleted'
);

export const mergeTripSnapshotWithViewSettings = (
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

export const getSnapshotForTarget = (log: AdminAuditRecord | null): Record<string, unknown> => {
    if (!log) return {};
    const after = asRecord(log.after_data);
    if (Object.keys(after).length > 0) return after;
    return asRecord(log.before_data);
};

export const canOpenTargetDrawer = (log: AdminAuditRecord): boolean => {
    if (!log.target_id) return false;
    return log.target_type === 'user' || log.target_type === 'trip';
};

export const mapUserChangeLogToAuditRecord = (log: AdminUserChangeRecord): AdminAuditRecord => ({
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

export const toAuditRecord = (entry: AuditTimelineEntry): AdminAuditRecord => (
    entry.kind === 'admin' ? entry.log : mapUserChangeLogToAuditRecord(entry.log)
);

/**
 * The log a user sheet opens from. Opening an actor (not a target) has no source
 * row of its own, so it gets a synthetic one stamped with `nowMs`.
 */
export const buildUserSheetLog = (
    userId: string,
    options: { sourceLog?: AdminAuditRecord | null; actorEmail?: string | null },
    nowMs: number,
): AdminAuditRecord | null => {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) return null;
    const sourceLog = options.sourceLog || null;
    const actorEmail = options.actorEmail || sourceLog?.actor_email || null;
    if (sourceLog) {
        return {
            ...sourceLog,
            target_type: 'user',
            target_id: trimmedUserId,
            actor_email: sourceLog.actor_email || actorEmail,
        };
    }
    return {
        id: `audit-actor-${trimmedUserId}-${nowMs}`,
        actor_user_id: trimmedUserId,
        actor_email: actorEmail,
        action: 'audit.open_actor',
        target_type: 'user',
        target_id: trimmedUserId,
        before_data: null,
        after_data: null,
        metadata: { source: 'actor_column' },
        created_at: new Date(nowMs).toISOString(),
    };
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const getTimelineCreatedAt = (entry: AuditTimelineEntry): string => entry.log.created_at;
export const getTimelineAction = (entry: AuditTimelineEntry): string => entry.log.action;
export const getTimelineTargetType = (entry: AuditTimelineEntry): string => entry.log.target_type;
export const getTimelineTargetId = (entry: AuditTimelineEntry): string | null => entry.log.target_id;
export const getTimelineActorEmail = (entry: AuditTimelineEntry): string | null => (
    entry.kind === 'admin' ? entry.log.actor_email : entry.log.owner_email
);
export const getTimelineActorUserId = (entry: AuditTimelineEntry): string | null => (
    entry.kind === 'admin' ? entry.log.actor_user_id : entry.log.owner_user_id
);
export const getTimelineActionLabel = (entry: AuditTimelineEntry): string => {
    if (entry.kind === 'admin') return getActionFilterLabel(entry.log.action);
    const diffEntries = buildUserChangeDiffEntries(entry.log);
    return resolveUserChangeActionPresentation(entry.log, diffEntries).label;
};
export const getTimelineEntryKey = (entry: AuditTimelineEntry): string => `${entry.kind}:${entry.log.id}`;

const toTimestamp = (entry: AuditTimelineEntry): number => Date.parse(getTimelineCreatedAt(entry)) || 0;

/**
 * Admin and user change logs in one list, newest first. A user change row loaded
 * later (to resolve an undo chain) never replaces one from the main list.
 */
export const mergeAuditTimeline = (
    adminLogs: AdminAuditRecord[],
    userChangeLogs: AdminUserChangeRecord[],
    lookupUserChangeLogs: AdminUserChangeRecord[] = [],
): AuditTimelineEntry[] => {
    const byId = new Map<string, AuditTimelineEntry>();
    adminLogs.forEach((log) => byId.set(log.id, { kind: 'admin', log }));
    userChangeLogs.forEach((log) => byId.set(log.id, { kind: 'user', log }));
    lookupUserChangeLogs.forEach((log) => {
        if (!byId.has(log.id)) byId.set(log.id, { kind: 'user', log });
    });
    return Array.from(byId.values()).sort((a, b) => toTimestamp(b) - toTimestamp(a));
};

export const indexAuditTimeline = (entries: AuditTimelineEntry[]): AuditTimelineIndex => {
    const map: AuditTimelineIndex = new Map();
    entries.forEach((entry) => map.set(entry.log.id, entry));
    return map;
};

/** Undo rows whose source event is not loaded yet, so its diff can be fetched. */
export const findMissingUndoSourceIds = (
    entries: AuditTimelineEntry[],
    index: AuditTimelineIndex,
    alreadyRequested: ReadonlySet<string>,
): string[] => {
    const missing = new Set<string>();
    entries.forEach((entry) => {
        if (entry.kind !== 'admin') return;
        if (entry.log.action.trim().toLowerCase() !== 'admin.trip.override_commit') return;
        const sourceId = parseUndoRootSourceEventId(entry.log) || parseUndoSourceEventId(entry.log);
        if (!sourceId || index.has(sourceId) || alreadyRequested.has(sourceId)) return;
        missing.add(sourceId);
    });
    return Array.from(missing);
};

export const filterAuditTimeline = (
    entries: AuditTimelineEntry[],
    filters: AuditFilterState,
    nowMs: number = Date.now(),
): AuditTimelineEntry[] => {
    const token = filters.search.trim().toLowerCase();
    return entries.filter((entry) => {
        const action = getTimelineAction(entry);
        const targetType = getTimelineTargetType(entry);
        if (!isIsoDateInAuditRange(
            getTimelineCreatedAt(entry),
            filters.timePreset,
            filters.customStartDate,
            filters.customEndDate,
            nowMs,
        )) return false;
        if (filters.actionFilters.length > 0 && !filters.actionFilters.includes(action)) return false;
        if (filters.targetFilters.length > 0 && !filters.targetFilters.includes(targetType)) return false;
        if (filters.actorFilters.length > 0 && !filters.actorFilters.includes(entry.kind)) return false;
        if (!token) return true;
        return (
            action.toLowerCase().includes(token)
            || getTimelineActionLabel(entry).toLowerCase().includes(token)
            || targetType.toLowerCase().includes(token)
            || getTargetLabel(targetType).toLowerCase().includes(token)
            || (getTimelineTargetId(entry) || '').toLowerCase().includes(token)
            || (getTimelineActorEmail(entry) || '').toLowerCase().includes(token)
            || (getTimelineActorUserId(entry) || '').toLowerCase().includes(token)
        );
    });
};

const getSortText = (entry: AuditTimelineEntry, column: AuditSortColumn): string => {
    if (column === 'actor') return (getTimelineActorEmail(entry) || '').toLowerCase();
    if (column === 'action') return getTimelineActionLabel(entry).toLowerCase();
    return getTargetLabel(getTimelineTargetType(entry)).toLowerCase();
};

/** Stable sort; ties keep newest first so equal labels still read as a timeline. */
export const sortAuditTimeline = (entries: AuditTimelineEntry[], sort: AuditSort): AuditTimelineEntry[] => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return entries
        .map((entry, index) => ({ entry, index }))
        .sort((left, right) => {
            if (sort.column !== 'when') {
                const byText = getSortText(left.entry, sort.column).localeCompare(getSortText(right.entry, sort.column));
                if (byText !== 0) return byText * factor;
                return toTimestamp(right.entry) - toTimestamp(left.entry) || left.index - right.index;
            }
            return (toTimestamp(left.entry) - toTimestamp(right.entry)) * factor || left.index - right.index;
        })
        .map(({ entry }) => entry);
};

/** An offset past the end (after filtering) lands on the last page instead. */
export const clampAuditOffset = (offset: number, totalItems: number, pageSize = AUDIT_PAGE_SIZE): number => {
    if (totalItems <= 0) return 0;
    if (offset < totalItems) return offset;
    return Math.floor((totalItems - 1) / pageSize) * pageSize;
};

export const getAuditPageSelectionState = (
    pageKeys: string[],
    selected: ReadonlySet<string>,
): boolean | 'indeterminate' => {
    const selectedOnPage = pageKeys.filter((key) => selected.has(key)).length;
    if (pageKeys.length > 0 && selectedOnPage === pageKeys.length) return true;
    return selectedOnPage > 0 ? 'indeterminate' : false;
};

export const buildActionFilterOptions = (entries: AuditTimelineEntry[]): AdminFilterMenuOption[] => {
    const counts = new Map<string, { count: number; entry: AuditTimelineEntry }>();
    entries.forEach((entry) => {
        const action = getTimelineAction(entry);
        const current = counts.get(action);
        counts.set(action, { count: (current?.count || 0) + 1, entry: current?.entry || entry });
    });
    return Array.from(counts.entries())
        .map(([value, { count, entry }]) => ({
            value,
            label: getTimelineActionLabel(entry),
            count,
            group: getActionGroupLabel(value),
        }))
        .sort((left, right) => {
            const byGroup = getActionGroupOrder(left.group || 'Other') - getActionGroupOrder(right.group || 'Other');
            if (byGroup !== 0) return byGroup;
            return left.label.localeCompare(right.label);
        });
};

export const buildTargetFilterOptions = (entries: AuditTimelineEntry[]): AdminFilterMenuOption[] => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
        const targetType = getTimelineTargetType(entry);
        counts.set(targetType, (counts.get(targetType) || 0) + 1);
    });
    return Array.from(counts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: getTargetLabel(value), count }));
};

export const buildActorFilterOptions = (entries: AuditTimelineEntry[]): AdminFilterMenuOption[] => [
    { value: 'admin', label: 'Admin actor', count: entries.filter((entry) => entry.kind === 'admin').length },
    { value: 'user', label: 'User actor', count: entries.filter((entry) => entry.kind === 'user').length },
];

export const hasActiveAuditFilters = (state: {
    actionFilters: string[];
    targetFilters: string[];
    actorFilters: string[];
    timePreset: AuditTimePreset;
    visibleColumns: AuditVisibleColumnId[];
    columnWidths: Record<AuditResizableColumnId, number>;
}): boolean => (
    state.actionFilters.length > 0
    || state.targetFilters.length > 0
    || state.actorFilters.length > 0
    || state.timePreset !== DEFAULT_AUDIT_TIME_PRESET
    || state.visibleColumns.length !== DEFAULT_VISIBLE_COLUMNS.length
    || RESIZABLE_AUDIT_COLUMN_IDS.some((columnId) => state.columnWidths[columnId] !== AUDIT_COLUMN_WIDTH_DEFAULTS[columnId])
);

// ---------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------

export type AuditProfilePatch = Parameters<typeof adminUpdateUserProfile>[1];

export const extractRevertibleProfilePatch = (
    beforeData: Record<string, unknown> | null | undefined
): AuditProfilePatch | null => {
    const source = asRecord(beforeData);
    const patch: AuditProfilePatch = {};
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(source, key);
    const toTextOrNull = (value: unknown): string | null => {
        if (value === null) return null;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed || null;
    };
    const toStatusOrNull = (value: unknown): 'active' | 'disabled' | 'deleted' | null => (
        isUserStatusValue(value) ? value : null
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
    if (hasOwn('tier_key')) patch.tierKey = toTextOrNull(source.tier_key) as AuditProfilePatch['tierKey'];

    return Object.keys(patch).length > 0 ? patch : null;
};

export const canUndoTimelineEntry = (entry: AuditTimelineEntry): boolean => {
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

export const getUndoActionLabel = (entry: AuditTimelineEntry): string => {
    const action = entry.log.action.trim().toLowerCase();
    if (action === 'trip.archived') return 'Undo archive';
    if (action === 'profile.updated') return 'Undo profile';
    if (action === 'admin.trip.override_commit') return 'Undo override';
    return 'Undo change';
};

/** Metadata that lets an undo of an undo resolve back to the original change. */
export const buildUndoOverrideMetadata = (
    entry: AuditTimelineEntry,
    index: AuditTimelineIndex,
): Record<string, unknown> => {
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
    const sourceParity = resolveUndoParity(entry.log, index);
    if (sourceParity !== null) {
        metadata.undo_parity = (sourceParity + 1) % 2;
    }
    return metadata;
};

// ---------------------------------------------------------------------------
// Sheets and export
// ---------------------------------------------------------------------------

export const canOpenFullDiff = (entry: AuditTimelineEntry): boolean => {
    const log = toAuditRecord(entry);
    if (hasSnapshotData(log.before_data) || hasSnapshotData(log.after_data)) return true;
    if (log.target_type !== 'trip' || !log.target_id) return false;
    return Boolean(asString(asRecord(log.metadata).version_id));
};

export interface AuditUserIdentity {
    userId: string;
    email: string | null;
    name: string | null;
    role: string | null;
    tier: string | null;
    totalTrips: number | null;
    activeTrips: number | null;
}

/** The live profile wins; the audit snapshot fills whatever it lacks. */
export const resolveAuditUserIdentity = (
    log: AdminAuditRecord | null,
    profile: AdminUserRecord | null,
): AuditUserIdentity => {
    const snapshot = getSnapshotForTarget(log);
    const snapshotName = [asString(snapshot.first_name), asString(snapshot.last_name)].filter(Boolean).join(' ').trim();
    const profileName = profile
        ? ([profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
            || profile.display_name
            || profile.username
            || null)
        : null;
    return {
        userId: profile?.user_id || asString(snapshot.id) || log?.target_id || 'n/a',
        email: profile?.email || asString(snapshot.email) || null,
        name: profileName || snapshotName || asString(snapshot.display_name) || asString(snapshot.username) || null,
        role: profile?.system_role || asString(snapshot.system_role) || null,
        tier: profile?.tier_key || asString(snapshot.tier_key) || null,
        totalTrips: profile?.total_trips ?? null,
        activeTrips: profile?.active_trips ?? null,
    };
};

export const resolveAuditUserAccountStatus = (
    log: AdminAuditRecord | null,
    profile: AdminUserRecord | null,
): 'active' | 'disabled' | 'deleted' | null => {
    const fromProfile = profile?.account_status || null;
    if (isUserStatusValue(fromProfile)) return fromProfile;
    const fromSnapshot = getSnapshotForTarget(log).account_status;
    if (isUserStatusValue(fromSnapshot)) return fromSnapshot;
    return null;
};

export interface AuditTripIdentity {
    tripId: string;
    title: string | null;
    status: string | null;
    ownerId: string | null;
    ownerEmail: string | null;
    expiresAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    sourceKind: string | null;
}

export const resolveAuditTripIdentity = (
    log: AdminAuditRecord | null,
    trip: AdminTripRecord | null,
): AuditTripIdentity => {
    const snapshot = getSnapshotForTarget(log);
    return {
        tripId: trip?.trip_id || asString(snapshot.id) || log?.target_id || 'n/a',
        title: trip?.title || asString(snapshot.title) || null,
        status: trip?.status || asString(snapshot.status) || null,
        ownerId: trip?.owner_id || asString(snapshot.owner_id) || null,
        ownerEmail: trip?.owner_email || asString(snapshot.owner_email) || null,
        expiresAt: trip?.trip_expires_at || asString(snapshot.trip_expires_at) || null,
        createdAt: trip?.created_at || asString(snapshot.created_at) || null,
        updatedAt: trip?.updated_at || asString(snapshot.updated_at) || null,
        sourceKind: trip?.source_kind || asString(snapshot.source_kind) || null,
    };
};

/** The synthetic log the trip sheet's "Open owner" opens the user sheet with. */
export const buildTripOwnerLog = (
    tripLog: AdminAuditRecord | null,
    identity: AuditTripIdentity,
): AdminAuditRecord | null => {
    if (!identity.ownerId) return null;
    return {
        id: tripLog?.id || `audit-owner-${identity.ownerId}`,
        actor_user_id: null,
        actor_email: null,
        action: 'audit.open_owner_from_trip',
        target_type: 'user',
        target_id: identity.ownerId,
        before_data: null,
        after_data: null,
        metadata: null,
        created_at: tripLog?.created_at || identity.createdAt || FALLBACK_AUDIT_TIMESTAMP,
    };
};

export const toForensicsReplayFileName = (generatedAtIso: string): string => {
    const safeTimestamp = generatedAtIso.replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z');
    return `admin-audit-replay-${safeTimestamp}.json`;
};

/** Why an export cannot start, or null when it can. */
export const getAuditExportBlocker = (selectedCount: number, visibleCount: number): string | null => {
    if (selectedCount === 0 && visibleCount === 0) return 'No audit entries match the current filters.';
    if (selectedCount > AUDIT_SOURCE_MAX_ROWS) {
        return `Too many selected entries (${selectedCount}). Please select up to ${AUDIT_SOURCE_MAX_ROWS}.`;
    }
    return null;
};
