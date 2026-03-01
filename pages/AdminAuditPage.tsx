import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowSquareOut, CopySimple, Crosshair, DownloadSimple, Info, SpinnerGap, User, X } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell } from '../components/admin/AdminShell';
import {
    adminExportAuditReplay,
    adminOverrideTripCommit,
    adminGetTripVersionSnapshots,
    adminGetUserProfile,
    adminListAuditLogs,
    adminListUserChangeLogs,
    adminListTrips,
    adminUpdateTrip,
    adminUpdateUserProfile,
    type AdminAuditRecord,
    type AdminTripRecord,
    type AdminUserChangeRecord,
    type AdminUserRecord,
} from '../services/adminService';
import { buildDecisionConfirmDialog } from '../services/appDialogPresets';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { Drawer, DrawerContent } from '../components/ui/drawer';
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
    buildUserChangeDiffEntries,
    formatUserChangeDiffValue,
    resolveUserChangeActionPresentation,
    resolveUserChangeSecondaryFacets,
} from '../services/adminUserChangeLog';

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
    { value: 'diff', label: 'Diff & details' },
    { value: 'rowActions', label: 'Actions' },
];
const DEFAULT_VISIBLE_COLUMNS: AuditVisibleColumnId[] = [...AUDIT_VISIBLE_COLUMN_IDS];
const AUDIT_COLUMN_WIDTH_DEFAULTS: Record<AuditResizableColumnId, number> = {
    when: 176,
    actor: 236,
    action: 296,
    target: 250,
    diff: 620,
};
const AUDIT_COLUMN_WIDTH_MIN: Record<AuditResizableColumnId, number> = {
    when: 124,
    actor: 170,
    action: 190,
    target: 180,
    diff: 360,
};
const DAY_MS = 24 * 60 * 60 * 1000;

type AuditActorFilter = typeof ACTOR_FILTER_VALUES[number];
type AuditTimePreset = typeof AUDIT_TIME_PRESETS[number];
type AuditVisibleColumnId = typeof AUDIT_VISIBLE_COLUMN_IDS[number];
type AuditResizableColumnId = typeof RESIZABLE_AUDIT_COLUMN_IDS[number];

const ACTION_FILTER_LABELS: Record<string, string> = {
    'admin.user.hard_delete': 'Hard-deleted user',
    'admin.user.invite': 'Invited user',
    'admin.user.create_direct': 'Created user',
    'admin.user.update_profile': 'Updated user',
    'admin.user.update_tier': 'Updated user tier',
    'admin.user.update_overrides': 'Updated user overrides',
    'admin.trip.hard_delete': 'Hard-deleted trip',
    'admin.trip.update': 'Updated trip',
    'admin.trip.override_commit': 'Overrode trip content',
    'admin.tier.update_entitlements': 'Updated tier entitlements',
    'admin.tier.reapply': 'Reapplied tier to users',
};

const TARGET_LABELS: Record<string, string> = {
    user: 'User',
    trip: 'Trip',
    tier: 'Tier',
    unknown: 'Unknown',
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
            .map((part) => part.trim())
            .filter(Boolean)
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
        .filter((key) => !NOISY_DIFF_KEYS.has(key))
        .filter((key) => toComparableValue(before[key]) !== toComparableValue(after[key]))
        .map((key) => ({
            key,
            beforeValue: before[key],
            afterValue: after[key],
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
};

const resolveAuditActionPresentation = (
    log: AdminAuditRecord,
    diffEntries: AuditDiffEntry[]
): { label: string; className: string } => {
    const raw = log.action;
    if (raw === 'admin.user.hard_delete') {
        return { label: 'Hard-deleted user', className: 'border-rose-300 bg-rose-50 text-rose-800' };
    }
    if (raw === 'admin.trip.hard_delete') {
        return { label: 'Hard-deleted trip', className: 'border-rose-300 bg-rose-50 text-rose-800' };
    }
    if (raw === 'admin.user.invite') {
        return { label: 'Invited user', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }
    if (raw === 'admin.user.create_direct') {
        return { label: 'Created user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
    }
    if (raw === 'admin.user.update_profile') {
        const accountStatusChange = getStatusChange(diffEntries, 'account_status');
        if (accountStatusChange?.to === 'deleted') {
            return { label: 'Soft-deleted user', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (accountStatusChange?.from === 'deleted' && accountStatusChange?.to === 'active') {
            return { label: 'Restored user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
        }
        if (accountStatusChange?.to === 'disabled') {
            return { label: 'Suspended user', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (accountStatusChange?.from === 'disabled' && accountStatusChange?.to === 'active') {
            return { label: 'Reactivated user', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
        }
        if (diffEntries.some((entry) => entry.key === 'system_role')) {
            return { label: 'Updated user role', className: 'border-indigo-300 bg-indigo-50 text-indigo-800' };
        }
        if (diffEntries.some((entry) => entry.key === 'tier_key')) {
            return { label: 'Updated user tier', className: 'border-sky-300 bg-sky-50 text-sky-800' };
        }
        return { label: 'Updated user', className: 'border-slate-300 bg-slate-100 text-slate-800' };
    }
    if (raw === 'admin.user.update_tier') {
        return { label: 'Updated user tier', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }
    if (raw === 'admin.user.update_overrides') {
        return { label: 'Updated overrides', className: 'border-indigo-300 bg-indigo-50 text-indigo-800' };
    }
    if (raw === 'admin.trip.update') {
        if (diffEntries.some((entry) => entry.key === 'owner_id')) {
            return { label: 'Transferred trip owner', className: 'border-violet-300 bg-violet-50 text-violet-800' };
        }
        const tripStatusChange = getStatusChange(diffEntries, 'status');
        if (tripStatusChange?.to === 'archived') {
            return { label: 'Archived trip', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (tripStatusChange?.from === 'archived' && tripStatusChange?.to === 'active') {
            return { label: 'Restored trip', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
        }
        if (tripStatusChange?.to === 'expired') {
            return { label: 'Expired trip', className: 'border-amber-300 bg-amber-50 text-amber-800' };
        }
        if (diffEntries.some((entry) => entry.key === 'trip_expires_at')) {
            return { label: 'Updated trip expiry', className: 'border-sky-300 bg-sky-50 text-sky-800' };
        }
        return { label: 'Updated trip', className: 'border-slate-300 bg-slate-100 text-slate-800' };
    }
    if (raw === 'admin.trip.override_commit') {
        return { label: 'Overrode trip content', className: 'border-violet-300 bg-violet-50 text-violet-800' };
    }
    if (raw === 'admin.tier.update_entitlements') {
        return { label: 'Updated tier entitlements', className: 'border-sky-300 bg-sky-50 text-sky-800' };
    }
    if (raw === 'admin.tier.reapply') {
        return { label: 'Reapplied tier', className: 'border-slate-300 bg-slate-100 text-slate-800' };
    }
    return { label: getActionFilterLabel(raw), className: 'border-slate-300 bg-slate-100 text-slate-800' };
};

const getTargetPillClass = (targetType: string): string => {
    if (targetType === 'user') return 'border-indigo-300 bg-indigo-50 text-indigo-800';
    if (targetType === 'trip') return 'border-sky-300 bg-sky-50 text-sky-800';
    if (targetType === 'tier') return 'border-violet-300 bg-violet-50 text-violet-800';
    return 'border-slate-300 bg-slate-100 text-slate-700';
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
        const before = asRecord(log.before_data);
        return Object.keys(asRecord(before.data)).length > 0;
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

export const AdminAuditPage: React.FC = () => {
    const { confirm: confirmDialog } = useAppDialog();
    const [searchParams, setSearchParams] = useSearchParams();
    const [logs, setLogs] = useState<AdminAuditRecord[]>(() => readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []));
    const [userChangeLogs, setUserChangeLogs] = useState<AdminUserChangeRecord[]>(
        () => readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, [])
    );
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
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
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
            const reason = adminResult.reason instanceof Error ? adminResult.reason.message : 'Could not load audit logs.';
            const cachedRows = readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setLogs(cachedRows);
                notices.push(`Live admin audit logs failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser. Reason: ${reason}`);
            } else {
                setLogs([]);
                hardFailures.push(reason);
            }
        }

        if (userResult.status === 'fulfilled') {
            setUserChangeLogs(userResult.value);
            writeAdminCache(USER_CHANGE_CACHE_KEY, userResult.value);
        } else {
            const reason = userResult.reason instanceof Error ? userResult.reason.message : 'Could not load user change logs.';
            const cachedRows = readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setUserChangeLogs(cachedRows);
                notices.push(`Live user change logs failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser. Reason: ${reason}`);
            } else {
                setUserChangeLogs([]);
                hardFailures.push(reason);
            }
        }

        if (hardFailures.length > 0) {
            setErrorMessage(hardFailures.join(' '));
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

    const openTargetDrawer = (log: AdminAuditRecord) => {
        if (!canOpenTargetDrawer(log)) return;
        setErrorMessage(null);
        if (log.target_type === 'user') {
            setSelectedTripLog(null);
            setSelectedTripRecord(null);
            setTripDrawerError(null);
            setIsTripDrawerOpen(false);
            setSelectedUserLog(log);
            setSelectedUserProfile(null);
            setUserDrawerError(null);
            setIsUserDrawerOpen(true);
            return;
        }
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
                setUserDrawerError(error instanceof Error ? error.message : 'Could not load user profile.');
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
                setTripDrawerError(error instanceof Error ? error.message : 'Could not load trip details.');
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
            setUserDrawerError(error instanceof Error ? error.message : 'Could not restore user.');
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
        setDiffModalTitle(`${log.action} · ${targetLabel}`);
        setDiffModalDescription(
            [
                actorEmail ? `Actor: ${actorEmail}` : null,
                log.target_id ? `${targetLabel} ID: ${log.target_id}` : null,
                versionId ? `Version: ${versionId}` : null,
            ].filter(Boolean).join(' • ')
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
            setDiffModalError(error instanceof Error ? error.message : 'Could not load trip snapshots.');
        } finally {
            setIsDiffModalLoading(false);
        }
    };

    const timelineEntries = useMemo<AuditTimelineEntry[]>(() => {
        const combined: AuditTimelineEntry[] = [
            ...logs.map((log) => ({ kind: 'admin', log } as const)),
            ...userChangeLogs.map((log) => ({ kind: 'user', log } as const)),
        ];

        return combined.sort((a, b) => {
            const left = Date.parse(getTimelineCreatedAt(a)) || 0;
            const right = Date.parse(getTimelineCreatedAt(b)) || 0;
            return right - left;
        });
    }, [logs, userChangeLogs]);

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
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => {
                const matchingEntry = logsInTimeRange.find((entry) => getTimelineAction(entry) === value);
                return {
                    value,
                    label: matchingEntry ? getTimelineActionLabel(matchingEntry) : getActionFilterLabel(value),
                    count,
                };
            });
    }, [logsInTimeRange]);

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
        setActionFilters(values);
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

    const copyToClipboard = async (value: string, token: string) => {
        if (!value.trim() || typeof navigator === 'undefined' || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedToken(token);
            window.setTimeout(() => {
                setCopiedToken((current) => (current === token ? null : current));
            }, 1400);
        } catch {
            // best effort only
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
                throw new Error('Replay export is only available in browser context.');
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
            setErrorMessage(error instanceof Error ? error.message : 'Could not export replay bundle.');
        } finally {
            setIsExportingReplay(false);
        }
    };

    const exportSelectedReplayBundle = async () => {
        if (selectedEntryKeys.length === 0) {
            setErrorMessage('Select at least one row to export.');
            return;
        }
        await exportReplayBundle({ selectedEventIds: selectedEntryKeys });
    };

    const exportSingleReplayEntry = async (entry: AuditTimelineEntry) => {
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
                if (action === 'trip.archived') {
                    if (!entry.log.target_id) throw new Error('Trip id missing for undo.');
                    await adminUpdateTrip(entry.log.target_id, { status: 'active' });
                } else if (action === 'trip.updated') {
                    if (!entry.log.target_id) throw new Error('Trip id missing for undo.');
                    const metadata = asRecord(entry.log.metadata);
                    const versionId = asString(metadata.version_id);
                    const previousVersionId = asString(metadata.previous_version_id);
                    if (!versionId) throw new Error('Version id missing for undo.');
                    const versionSnapshots = await adminGetTripVersionSnapshots({
                        tripId: entry.log.target_id,
                        afterVersionId: versionId,
                        beforeVersionId: previousVersionId,
                    });
                    if (!versionSnapshots) {
                        throw new Error('Version snapshots unavailable for undo.');
                    }
                    const beforeSnapshot = asRecord(versionSnapshots.before_snapshot);
                    if (Object.keys(beforeSnapshot).length === 0) {
                        throw new Error('No previous snapshot found for undo.');
                    }
                    await adminOverrideTripCommit({
                        tripId: entry.log.target_id,
                        data: beforeSnapshot,
                        viewSettings: asRecord(versionSnapshots.before_view_settings),
                        label: `Audit undo ${entry.log.id}`,
                    });
                } else if (action === 'profile.updated') {
                    if (!entry.log.target_id) throw new Error('User id missing for undo.');
                    const patch = extractRevertibleProfilePatch(entry.log.before_data);
                    if (!patch) throw new Error('No revertible profile fields found for this row.');
                    await adminUpdateUserProfile(entry.log.target_id, patch);
                } else {
                    throw new Error('Undo is not supported for this action.');
                }
            } else {
                if (!entry.log.target_id) throw new Error('Target id missing for undo.');
                if (action === 'admin.trip.override_commit') {
                    const before = asRecord(entry.log.before_data);
                    const tripData = asRecord(before.data);
                    if (Object.keys(tripData).length === 0) {
                        throw new Error('No previous trip snapshot found for this undo.');
                    }
                    await adminOverrideTripCommit({
                        tripId: entry.log.target_id,
                        data: tripData,
                        viewSettings: asRecord(before.view_settings),
                        label: `Audit undo ${entry.log.id}`,
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
                        throw new Error('No revertible trip fields found for this row.');
                    }
                    await adminUpdateTrip(entry.log.target_id, patch);
                } else if (action === 'admin.user.update_profile' || action === 'admin.user.update_tier') {
                    const patch = extractRevertibleProfilePatch(entry.log.before_data);
                    if (!patch) throw new Error('No revertible user fields found for this row.');
                    await adminUpdateUserProfile(entry.log.target_id, patch);
                } else {
                    throw new Error('Undo is not supported for this action.');
                }
            }
            showAppToast({
                tone: 'success',
                title: 'Undo completed',
                description: 'A new admin audit entry was written for this revert operation.',
            });
            await loadLogs();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not undo this change.');
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

    return (
        <AdminShell
            title="Admin Audit Log"
            description="Unified timeline of admin actions and user-originated account/trip changes for incident replay and support tracing."
            searchValue={searchValue}
            onSearchValueChange={handleSearchValueChange}
            showDateRange={false}
            actions={(
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void exportReplayBundle()}
                        disabled={isLoading || isExportingReplay || visibleLogs.length === 0}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isExportingReplay
                            ? <SpinnerGap size={14} className="animate-spin" />
                            : <DownloadSimple size={14} />}
                        Export replay
                    </button>
                    <button
                        type="button"
                        onClick={() => void exportSelectedReplayBundle()}
                        disabled={isLoading || isExportingReplay || selectedEntryKeys.length === 0}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isExportingReplay
                            ? <SpinnerGap size={14} className="animate-spin" />
                            : <DownloadSimple size={14} />}
                        Export selected ({selectedEntryKeys.length})
                    </button>
                    <AdminReloadButton
                        onClick={() => void loadLogs()}
                        isLoading={isLoading}
                        label="Reload"
                    />
                </div>
            )}
        >
            {errorMessage && (
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    {errorMessage}
                </section>
            )}
            {dataSourceNotice && (
                <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {dataSourceNotice}
                </section>
            )}

            <section className="mb-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex min-w-[176px] items-center gap-2">
                    <Select value={timePreset} onValueChange={(value) => handleTimePresetChange(value as AuditTimePreset)}>
                        <SelectTrigger className="h-8 w-[180px]">
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
                        <button
                            type="button"
                            onClick={() => setIsCustomRangeDialogOpen(true)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            {formatAuditCustomRangeLabel(customStartDate, customEndDate)}
                        </button>
                    )}
                </div>
                <AdminFilterMenu
                    label="Action"
                    icon={<Info size={14} className="mr-2 shrink-0 text-slate-500" weight="duotone" />}
                    options={actionFilterOptions}
                    selectedValues={actionFilters}
                    onSelectedValuesChange={handleActionFiltersChange}
                />
                <AdminFilterMenu
                    label="Target"
                    icon={<Crosshair size={14} className="mr-2 shrink-0 text-slate-500" weight="duotone" />}
                    options={targetFilterOptions}
                    selectedValues={targetFilters}
                    onSelectedValuesChange={handleTargetFiltersChange}
                />
                <AdminFilterMenu
                    label="Actor"
                    icon={<User size={14} className="mr-2 shrink-0 text-slate-500" weight="duotone" />}
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
                <button
                    type="button"
                    onClick={() => {
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
                    }}
                    className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <X size={14} />
                    Reset
                </button>
            </section>

            <Dialog open={isCustomRangeDialogOpen} onOpenChange={setIsCustomRangeDialogOpen}>
                <DialogContent className="w-[min(96vw,640px)] overflow-hidden rounded-2xl p-0">
                    <DialogHeader className="border-b border-slate-200">
                        <DialogTitle className="text-base font-black text-slate-900">Custom time range</DialogTitle>
                        <DialogDescription className="text-sm text-slate-600">
                            Pick the start and end date used by the audit filters and replay export.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="px-5 py-4">
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
                    <DialogFooter className="border-t border-slate-200">
                        <button
                            type="button"
                            onClick={() => setIsCustomRangeDialogOpen(false)}
                            className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Done
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs text-slate-600">
                    <p>
                        {selectedEntryKeys.length} selected • {visibleLogs.length} matching entr{visibleLogs.length === 1 ? 'y' : 'ies'}
                    </p>
                    <p>
                        Tip: drag column handles to resize. Diff/details starts wider by default.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed border-collapse text-left text-sm">
                        <colgroup>
                            <col style={{ width: 44 }} />
                            {isColumnVisible('when') && <col style={{ width: `${columnWidths.when}px` }} />}
                            {isColumnVisible('actor') && <col style={{ width: `${columnWidths.actor}px` }} />}
                            {isColumnVisible('action') && <col style={{ width: `${columnWidths.action}px` }} />}
                            {isColumnVisible('target') && <col style={{ width: `${columnWidths.target}px` }} />}
                            {isColumnVisible('diff') && <col style={{ width: `${columnWidths.diff}px` }} />}
                            {isColumnVisible('rowActions') && <col style={{ width: 170 }} />}
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-2 py-2">
                                    <Checkbox
                                        checked={areAllPageRowsSelected ? true : hasSomePageRowsSelected ? 'indeterminate' : false}
                                        onCheckedChange={(checked) => togglePageSelection(Boolean(checked))}
                                        aria-label="Select all rows on this page"
                                    />
                                </th>
                                {isColumnVisible('when') && (
                                    <th className="relative px-3 py-2">
                                        When
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                beginColumnResize('when', event.clientX);
                                            }}
                                            className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                            aria-label="Resize when column"
                                        />
                                    </th>
                                )}
                                {isColumnVisible('actor') && (
                                    <th className="relative px-3 py-2">
                                        Actor
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                beginColumnResize('actor', event.clientX);
                                            }}
                                            className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                            aria-label="Resize actor column"
                                        />
                                    </th>
                                )}
                                {isColumnVisible('action') && (
                                    <th className="relative px-3 py-2">
                                        Action
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                beginColumnResize('action', event.clientX);
                                            }}
                                            className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                            aria-label="Resize action column"
                                        />
                                    </th>
                                )}
                                {isColumnVisible('target') && (
                                    <th className="relative px-3 py-2">
                                        Target
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                beginColumnResize('target', event.clientX);
                                            }}
                                            className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                            aria-label="Resize target column"
                                        />
                                    </th>
                                )}
                                {isColumnVisible('diff') && (
                                    <th className="relative px-3 py-2">
                                        Diff & details
                                        <button
                                            type="button"
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                beginColumnResize('diff', event.clientX);
                                            }}
                                            className="absolute inset-y-0 right-0 w-2 cursor-col-resize"
                                            aria-label="Resize diff and details column"
                                        />
                                    </th>
                                )}
                                {isColumnVisible('rowActions') && <th className="px-3 py-2">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {pagedLogs.map((timelineEntry) => {
                                const log = timelineEntry.kind === 'admin'
                                    ? timelineEntry.log
                                    : mapUserChangeLogToAuditRecord(timelineEntry.log);
                                const diffEntries = timelineEntry.kind === 'admin'
                                    ? buildAuditDiffEntries(timelineEntry.log)
                                    : buildUserChangeDiffEntries(timelineEntry.log);
                                const actionPresentation = timelineEntry.kind === 'admin'
                                    ? resolveAuditActionPresentation(timelineEntry.log, diffEntries)
                                    : resolveUserChangeActionPresentation(timelineEntry.log, diffEntries);
                                const secondaryFacets = timelineEntry.kind === 'user'
                                    ? resolveUserChangeSecondaryFacets(timelineEntry.log)
                                    : [];
                                const targetLabel = getTargetLabel(log.target_type);
                                const visibleDiffEntries = diffEntries.slice(0, 5);
                                const hiddenDiffCount = Math.max(diffEntries.length - visibleDiffEntries.length, 0);
                                const targetCanOpenDrawer = canOpenTargetDrawer(log);
                                const metadataRecord = asRecord(log.metadata);
                                const rawOwnedTripCount = metadataRecord.owned_trips_before_delete;
                                const ownedTripsBeforeDelete = typeof rawOwnedTripCount === 'number' ? rawOwnedTripCount : null;
                                const actorEmail = getTimelineActorEmail(timelineEntry);
                                const actorUserId = getTimelineActorUserId(timelineEntry);
                                const eventTypeLabel = timelineEntry.kind === 'admin' ? 'Admin action' : 'User action';
                                const canShowFullDiff = canOpenFullDiffModal(timelineEntry);
                                const entryKey = getTimelineEntryKey(timelineEntry);
                                const isRowSelected = selectedEntryKeySet.has(entryKey);
                                const canUndo = canUndoTimelineEntry(timelineEntry);
                                const isUndoing = revertingEntryKey === entryKey;

                                return (
                                    <tr key={entryKey} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                                        <td className="px-2 py-2">
                                            <Checkbox
                                                checked={isRowSelected}
                                                onCheckedChange={() => toggleRowSelection(entryKey)}
                                                aria-label="Select row"
                                            />
                                        </td>
                                        {isColumnVisible('when') && (
                                            <td className="px-3 py-2 text-xs text-slate-600">{new Date(log.created_at).toLocaleString()}</td>
                                        )}
                                        {isColumnVisible('actor') && (
                                            <td className="px-3 py-2 text-xs text-slate-700">
                                                {actorEmail || (
                                                    actorUserId
                                                        ? <CopyableUuid value={actorUserId} textClassName="max-w-[220px] truncate text-xs" hintClassName="text-[9px]" />
                                                        : 'unknown'
                                                )}
                                            </td>
                                        )}
                                        {isColumnVisible('action') && (
                                            <td className="px-3 py-2 text-xs">
                                            <span
                                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionPresentation.className}`}
                                                title={log.action}
                                            >
                                                {actionPresentation.label}
                                            </span>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                                    {eventTypeLabel}
                                                </span>
                                                <span className="max-w-[220px] truncate font-mono" title={log.action}>
                                                    {log.action}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => void copyToClipboard(log.action, `action-${timelineEntry.kind}-${log.id}`)}
                                                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-100"
                                                    title="Copy raw action code"
                                                >
                                                    <CopySimple size={11} />
                                                    Copy
                                                </button>
                                                {copiedToken === `action-${timelineEntry.kind}-${log.id}` && <span className="text-emerald-700">Copied</span>}
                                            </div>
                                            {secondaryFacets.length > 0 && (
                                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                                    {secondaryFacets.map((facet) => (
                                                        <span
                                                            key={`${timelineEntry.kind}-${log.id}-${facet.code}`}
                                                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${facet.className}`}
                                                            title={facet.code}
                                                        >
                                                            {facet.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            </td>
                                        )}
                                        {isColumnVisible('target') && (
                                            <td className="px-3 py-2 text-xs text-slate-600">
                                            <div className="inline-flex items-center gap-1.5">
                                                <span
                                                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getTargetPillClass(log.target_type)}`}
                                                    title={`Raw target type: ${log.target_type}`}
                                                >
                                                    {targetLabel}
                                                </span>
                                                {targetCanOpenDrawer && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openTargetDrawer(log)}
                                                        className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:border-accent-300 hover:text-accent-700"
                                                        title={`Open ${targetLabel.toLowerCase()} drawer`}
                                                    >
                                                        Open
                                                        <ArrowSquareOut size={11} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                                {log.target_id
                                                    ? (
                                                        <CopyableUuid
                                                            value={log.target_id}
                                                            textClassName="max-w-[220px] truncate text-[11px]"
                                                            hintClassName="text-[9px]"
                                                        />
                                                    )
                                                    : <span className="max-w-[220px] truncate font-mono">n/a</span>}
                                                {log.target_id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyToClipboard(log.target_id || '', `target-${timelineEntry.kind}-${log.id}`)}
                                                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-100"
                                                        title="Copy target id"
                                                    >
                                                        <CopySimple size={11} />
                                                        Copy
                                                    </button>
                                                )}
                                                {copiedToken === `target-${timelineEntry.kind}-${log.id}` && <span className="text-emerald-700">Copied</span>}
                                            </div>
                                            </td>
                                        )}
                                        {isColumnVisible('diff') && (
                                            <td className="px-3 py-2">
                                            {visibleDiffEntries.length > 0 ? (
                                                <div className="space-y-2">
                                                    {visibleDiffEntries.map((entry) => (
                                                        <article key={`${timelineEntry.kind}-${log.id}-${entry.key}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                {formatFieldLabel(entry.key)}
                                                            </p>
                                                            <div className="mt-1 grid gap-1 lg:grid-cols-2">
                                                                <div className="rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-[11px] text-rose-900">
                                                                    <span className="font-semibold">Before: </span>
                                                                    <span className="break-all">
                                                                        {timelineEntry.kind === 'user'
                                                                            ? formatUserChangeDiffValue(entry, entry.beforeValue)
                                                                            : formatAuditValue(entry.beforeValue)}
                                                                    </span>
                                                                </div>
                                                                <div className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[11px] text-emerald-900">
                                                                    <span className="font-semibold">After: </span>
                                                                    <span className="break-all">
                                                                        {timelineEntry.kind === 'user'
                                                                            ? formatUserChangeDiffValue(entry, entry.afterValue)
                                                                            : formatAuditValue(entry.afterValue)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    ))}
                                                    {hiddenDiffCount > 0 && (
                                                        <p className="text-[11px] font-semibold text-slate-500">
                                                            +{hiddenDiffCount} more changed field{hiddenDiffCount === 1 ? '' : 's'}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">No field diff recorded.</p>
                                            )}
                                            {canShowFullDiff && (
                                                <button
                                                    type="button"
                                                    onClick={() => void openFullDiffModal(timelineEntry)}
                                                    className="mt-2 inline-flex h-7 items-center rounded-md border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    Show complete diff
                                                </button>
                                            )}
                                            {timelineEntry.kind === 'admin' && log.action === 'admin.user.hard_delete' && ownedTripsBeforeDelete !== null && (
                                                <p className="mt-2 text-[11px] font-semibold text-rose-700">
                                                    Trip impact: {ownedTripsBeforeDelete} owned trip{ownedTripsBeforeDelete === 1 ? '' : 's'} deleted with this account.
                                                </p>
                                            )}
                                            </td>
                                        )}
                                        {isColumnVisible('rowActions') && (
                                            <td className="px-3 py-2">
                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => void exportSingleReplayEntry(timelineEntry)}
                                                        disabled={isExportingReplay}
                                                        className="inline-flex h-7 items-center justify-center rounded-md border border-slate-300 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Export row
                                                    </button>
                                                    {canUndo ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => void undoTimelineEntry(timelineEntry)}
                                                            disabled={Boolean(revertingEntryKey)}
                                                            className="inline-flex h-7 items-center justify-center rounded-md border border-amber-300 px-2 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {isUndoing ? 'Undoing...' : getUndoActionLabel(timelineEntry)}
                                                        </button>
                                                    ) : (
                                                        <span className="inline-flex h-7 items-center justify-center rounded-md border border-slate-200 px-2 text-[11px] font-medium text-slate-400">
                                                            Undo n/a
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {visibleLogs.length === 0 && !isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={tableColumnCount}>
                                        No audit entries found for the current filters.
                                    </td>
                                </tr>
                            )}
                            {isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={tableColumnCount}>
                                        <span className="inline-flex items-center gap-2">
                                            <SpinnerGap size={14} className="animate-spin" />
                                            Loading change logs...
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
                    <p>
                        Showing {visibleLogs.length === 0 ? 0 : offset + 1}-{Math.min(offset + AUDIT_PAGE_SIZE, visibleLogs.length)} of {visibleLogs.length}
                        {' '}matching entr{visibleLogs.length === 1 ? 'y' : 'ies'}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setOffset((current) => Math.max(0, current - AUDIT_PAGE_SIZE))}
                            disabled={!hasPreviousPage}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous 50
                        </button>
                        <button
                            type="button"
                            onClick={() => setOffset((current) => current + AUDIT_PAGE_SIZE)}
                            disabled={!hasNextPage}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next 50
                        </button>
                    </div>
                </div>
            </section>

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

            <Drawer
                open={isUserDrawerOpen}
                onOpenChange={(open) => {
                    setIsUserDrawerOpen(open);
                    if (open) return;
                    setSelectedUserLog(null);
                    setSelectedUserProfile(null);
                    setUserDrawerError(null);
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,560px)] p-0"
                    accessibleTitle="User details"
                    accessibleDescription="Inspect user identity details directly from the audit log."
                >
                    <div className="flex h-full flex-col">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-black text-slate-900">User details</h2>
                            <p className="truncate text-sm text-slate-600">
                                {userIdentity.email || (
                                    <CopyableUuid value={userIdentity.userId} textClassName="max-w-[360px] truncate text-sm" />
                                )}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {userDrawerError && (
                                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    {userDrawerError}
                                </div>
                            )}
                            {isLoadingUserProfile ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Loading user profile...
                                </div>
                            ) : (
                                <>
                                    <section className="space-y-3 rounded-xl border border-slate-200 p-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Identity</h3>
                                        <div className="space-y-1 text-sm text-slate-700">
                                            <div><span className="font-semibold text-slate-800">Name:</span> {userIdentity.name || 'n/a'}</div>
                                            <div><span className="font-semibold text-slate-800">Email:</span> {userIdentity.email || 'No email'}</div>
                                            <div className="break-all">
                                                <span className="font-semibold text-slate-800">User ID:</span>{' '}
                                                <CopyableUuid value={userIdentity.userId} textClassName="break-all text-sm" />
                                            </div>
                                            <div><span className="font-semibold text-slate-800">Role:</span> {userIdentity.role || 'n/a'}</div>
                                            <div><span className="font-semibold text-slate-800">Tier:</span> {userIdentity.tier || 'n/a'}</div>
                                            <div>
                                                <span className="font-semibold text-slate-800">Status:</span>{' '}
                                                {resolvedUserAccountStatus ? formatAccountStatusLabel(resolvedUserAccountStatus) : 'n/a'}
                                            </div>
                                            {userIdentity.totalTrips !== null && (
                                                <div>
                                                    <span className="font-semibold text-slate-800">Trips:</span>{' '}
                                                    {userIdentity.activeTrips ?? 0} active / {userIdentity.totalTrips} total
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="mt-3 rounded-xl border border-slate-200 p-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Actions</h3>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void restoreUserFromAudit()}
                                                disabled={
                                                    isRestoringUser
                                                    || resolvedUserAccountStatus !== 'deleted'
                                                    || !selectedUserLog?.target_id
                                                    || !selectedUserProfile
                                                }
                                                className="inline-flex h-8 items-center rounded-lg border border-emerald-300 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isRestoringUser ? 'Restoring...' : 'Restore user'}
                                            </button>
                                        </div>
                                        {resolvedUserAccountStatus !== 'deleted' && (
                                            <p className="mt-2 text-[11px] text-slate-500">Restore is available only for soft-deleted users.</p>
                                        )}
                                    </section>

                                    {Object.keys(selectedUserSnapshot).length > 0 && (
                                        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
                                            <summary className="cursor-pointer font-semibold text-slate-700">Audit snapshot</summary>
                                            <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-800 p-3 font-mono text-[10px] sm:text-xs text-slate-100 shadow-inner">
                                                {JSON.stringify(selectedUserSnapshot, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer
                open={isTripDrawerOpen}
                onOpenChange={(open) => {
                    setIsTripDrawerOpen(open);
                    if (open) return;
                    setSelectedTripLog(null);
                    setSelectedTripRecord(null);
                    setTripDrawerError(null);
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,560px)] p-0"
                    accessibleTitle="Trip details"
                    accessibleDescription="Inspect trip details directly from the audit log."
                >
                    <div className="flex h-full flex-col">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-black text-slate-900">Trip details</h2>
                            <p className="truncate text-sm text-slate-600">
                                {tripIdentity.title || (
                                    <CopyableUuid value={tripIdentity.tripId} textClassName="max-w-[360px] truncate text-sm" />
                                )}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {tripDrawerError && (
                                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    {tripDrawerError}
                                </div>
                            )}
                            {isLoadingTripRecord ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Loading trip details...
                                </div>
                            ) : (
                                <>
                                    <section className="space-y-3 rounded-xl border border-slate-200 p-3">
                                        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trip metadata</h3>
                                        <div className="space-y-1 text-sm text-slate-700">
                                            <div className="break-all">
                                                <span className="font-semibold text-slate-800">Trip ID:</span>{' '}
                                                <CopyableUuid value={tripIdentity.tripId} textClassName="break-all text-sm" />
                                            </div>
                                            <div><span className="font-semibold text-slate-800">Status:</span> {tripIdentity.status || 'n/a'}</div>
                                            <div><span className="font-semibold text-slate-800">Owner:</span> {tripIdentity.ownerEmail || tripIdentity.ownerId || 'n/a'}</div>
                                            {tripIdentity.ownerId && (
                                                <div className="break-all">
                                                    <span className="font-semibold text-slate-800">Owner ID:</span>{' '}
                                                    <CopyableUuid value={tripIdentity.ownerId} textClassName="break-all text-sm" />
                                                </div>
                                            )}
                                            <div><span className="font-semibold text-slate-800">Expires at:</span> {tripIdentity.expiresAt ? new Date(tripIdentity.expiresAt).toLocaleString() : 'Not set'}</div>
                                            <div><span className="font-semibold text-slate-800">Source:</span> {tripIdentity.sourceKind || 'n/a'}</div>
                                            <div><span className="font-semibold text-slate-800">Created:</span> {tripIdentity.createdAt ? new Date(tripIdentity.createdAt).toLocaleString() : 'n/a'}</div>
                                            <div><span className="font-semibold text-slate-800">Updated:</span> {tripIdentity.updatedAt ? new Date(tripIdentity.updatedAt).toLocaleString() : 'n/a'}</div>
                                        </div>
                                        {tripIdentity.ownerId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!tripIdentity.ownerId) return;
                                                    openTargetDrawer({
                                                        id: selectedTripLog?.id || `audit-owner-${Date.now()}`,
                                                        actor_user_id: null,
                                                        actor_email: null,
                                                        action: 'audit.open_owner_from_trip',
                                                        target_type: 'user',
                                                        target_id: tripIdentity.ownerId,
                                                        before_data: null,
                                                        after_data: null,
                                                        metadata: null,
                                                        created_at: selectedTripLog?.created_at || new Date().toISOString(),
                                                    });
                                                }}
                                                className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                Open owner drawer
                                            </button>
                                        )}
                                        {tripIdentity.tripId && (
                                            <a
                                                href={`/trip/${encodeURIComponent(tripIdentity.tripId)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                            >
                                                Open trip
                                                <ArrowSquareOut size={12} />
                                            </a>
                                        )}
                                    </section>

                                    {Object.keys(selectedTripSnapshot).length > 0 && (
                                        <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
                                            <summary className="cursor-pointer font-semibold text-slate-700">Audit snapshot</summary>
                                            <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-800 p-3 font-mono text-[10px] sm:text-xs text-slate-100 shadow-inner">
                                                {JSON.stringify(selectedTripSnapshot, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </AdminShell>
    );
};
