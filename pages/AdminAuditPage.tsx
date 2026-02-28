import React, { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, CopySimple, Crosshair, Info, SpinnerGap, User, X } from '@phosphor-icons/react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import {
    adminGetTripVersionSnapshots,
    adminGetUserProfile,
    adminListAuditLogs,
    adminListUserChangeLogs,
    adminListTrips,
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
import { AdminJsonDiffModal } from '../components/admin/AdminJsonDiffModal';
import { useAppDialog } from '../components/AppDialogProvider';
import {
    buildUserChangeDiffEntries,
    listUserChangeSecondaryActions,
    resolveUserChangeActionPresentation,
    resolveUserChangeSecondaryActions,
} from '../services/adminUserChangeLog';

const AUDIT_CACHE_KEY = 'admin.audit.cache.v1';
const USER_CHANGE_CACHE_KEY = 'admin.user_changes.cache.v1';
const AUDIT_PAGE_SIZE = 50;
const AUDIT_SOURCE_MAX_ROWS = 500;
const ACTOR_FILTER_VALUES = ['admin', 'user'] as const;

type AuditActorFilter = typeof ACTOR_FILTER_VALUES[number];

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

export const AdminAuditPage: React.FC = () => {
    const { confirm: confirmDialog } = useAppDialog();
    const [searchParams, setSearchParams] = useSearchParams();
    const [logs, setLogs] = useState<AdminAuditRecord[]>(() => readAdminCache<AdminAuditRecord[]>(AUDIT_CACHE_KEY, []));
    const [userChangeLogs, setUserChangeLogs] = useState<AdminUserChangeRecord[]>(
        () => readAdminCache<AdminUserChangeRecord[]>(USER_CHANGE_CACHE_KEY, [])
    );
    const [isLoading, setIsLoading] = useState(() => logs.length === 0 && userChangeLogs.length === 0);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [actionFilters, setActionFilters] = useState<string[]>(() => parseQueryMultiValue(searchParams.get('action')));
    const [secondaryActionFilters, setSecondaryActionFilters] = useState<string[]>(
        () => parseQueryMultiValue(searchParams.get('secondary'))
    );
    const [targetFilters, setTargetFilters] = useState<string[]>(() => parseQueryMultiValue(searchParams.get('target')));
    const [actorFilters, setActorFilters] = useState<AuditActorFilter[]>(
        () => parseQueryMultiValue(searchParams.get('actor')).filter(
            (value): value is AuditActorFilter => ACTOR_FILTER_VALUES.includes(value as AuditActorFilter)
        )
    );
    const [offset, setOffset] = useState(() => parseNonNegativeOffset(searchParams.get('offset')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
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

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (actionFilters.length > 0) next.set('action', actionFilters.join(','));
        if (secondaryActionFilters.length > 0) next.set('secondary', secondaryActionFilters.join(','));
        if (targetFilters.length > 0) next.set('target', targetFilters.join(','));
        if (actorFilters.length > 0) next.set('actor', actorFilters.join(','));
        if (offset > 0) next.set('offset', String(offset));
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        actionFilters,
        actorFilters,
        dateRange,
        offset,
        searchParams,
        searchValue,
        secondaryActionFilters,
        setSearchParams,
        targetFilters,
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
        setMessage(null);
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
        setMessage(null);
        setErrorMessage(null);
        setUserDrawerError(null);
        try {
            await adminUpdateUserProfile(userId, { accountStatus: 'active' });
            const refreshedProfile = await adminGetUserProfile(userId);
            setSelectedUserProfile(refreshedProfile);
            setMessage('User restored to active status.');
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
            const secondaryActions = entry.kind === 'user'
                ? listUserChangeSecondaryActions(entry.log)
                : [];
            const secondaryActionKeys = secondaryActions.map((secondaryAction) => secondaryAction.key);
            const secondaryActionLabels = secondaryActions.map((secondaryAction) => secondaryAction.label.toLowerCase()).join(' ');

            if (!isIsoDateInRange(createdAt, dateRange)) return false;
            if (actionFilters.length > 0 && !actionFilters.includes(action)) return false;
            if (
                secondaryActionFilters.length > 0
                && !secondaryActionFilters.some((secondaryActionFilter) => secondaryActionKeys.includes(secondaryActionFilter))
            ) {
                return false;
            }
            if (targetFilters.length > 0 && !targetFilters.includes(targetType)) return false;
            if (actorFilters.length > 0 && !actorFilters.includes(actorType)) return false;
            if (!token) return true;
            return (
                action.toLowerCase().includes(token)
                || getTimelineActionLabel(entry).toLowerCase().includes(token)
                || secondaryActionLabels.includes(token)
                || targetType.toLowerCase().includes(token)
                || getTargetLabel(targetType).toLowerCase().includes(token)
                || (targetId || '').toLowerCase().includes(token)
                || (actorEmail || '').toLowerCase().includes(token)
                || (actorUserId || '').toLowerCase().includes(token)
            );
        });
    }, [actionFilters, actorFilters, dateRange, searchValue, secondaryActionFilters, targetFilters, timelineEntries]);

    const logsInDateRange = useMemo(
        () => timelineEntries.filter((entry) => isIsoDateInRange(getTimelineCreatedAt(entry), dateRange)),
        [dateRange, timelineEntries]
    );
    const pagedLogs = useMemo(
        () => visibleLogs.slice(offset, offset + AUDIT_PAGE_SIZE),
        [offset, visibleLogs]
    );
    const hasPreviousPage = offset > 0;
    const hasNextPage = offset + AUDIT_PAGE_SIZE < visibleLogs.length;

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

    const actionFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInDateRange.forEach((entry) => {
            const action = getTimelineAction(entry);
            const nextValue = (counts.get(action) || 0) + 1;
            counts.set(action, nextValue);
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => {
                const matchingEntry = logsInDateRange.find((entry) => getTimelineAction(entry) === value);
                return {
                    value,
                    label: matchingEntry ? getTimelineActionLabel(matchingEntry) : getActionFilterLabel(value),
                    count,
                };
            });
    }, [logsInDateRange]);

    const targetFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        logsInDateRange.forEach((entry) => {
            const targetType = getTimelineTargetType(entry);
            const nextValue = (counts.get(targetType) || 0) + 1;
            counts.set(targetType, nextValue);
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => ({ value, label: getTargetLabel(value), count }));
    }, [logsInDateRange]);

    const secondaryActionFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const counts = new Map<string, number>();
        const labels = new Map<string, string>();
        logsInDateRange.forEach((entry) => {
            if (entry.kind !== 'user') return;
            const secondaryActions = listUserChangeSecondaryActions(entry.log);
            secondaryActions.forEach((secondaryAction) => {
                counts.set(secondaryAction.key, (counts.get(secondaryAction.key) || 0) + 1);
                if (!labels.has(secondaryAction.key)) {
                    labels.set(secondaryAction.key, secondaryAction.label);
                }
            });
        });
        return Array.from(counts.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([value, count]) => ({
                value,
                label: labels.get(value) || value,
                count,
            }));
    }, [logsInDateRange]);

    const actorFilterOptions = useMemo<AdminFilterMenuOption[]>(() => {
        const adminCount = logsInDateRange.filter((entry) => entry.kind === 'admin').length;
        const userCount = logsInDateRange.filter((entry) => entry.kind === 'user').length;
        return [
            { value: 'admin', label: 'Admin actor', count: adminCount },
            { value: 'user', label: 'User actor', count: userCount },
        ];
    }, [logsInDateRange]);

    const handleSearchValueChange = (value: string) => {
        setSearchValue(value);
        setOffset(0);
    };

    const handleDateRangeChange = (value: AdminDateRange) => {
        setDateRange(value);
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

    const handleSecondaryActionFiltersChange = (values: string[]) => {
        setSecondaryActionFilters(values);
        setOffset(0);
    };

    const handleActorFiltersChange = (values: string[]) => {
        setActorFilters(values.filter(
            (value): value is AuditActorFilter => ACTOR_FILTER_VALUES.includes(value as AuditActorFilter)
        ));
        setOffset(0);
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

    return (
        <AdminShell
            title="Admin Audit Log"
            description="Unified timeline of admin actions and user-originated account/trip changes for incident replay and support tracing."
            searchValue={searchValue}
            onSearchValueChange={handleSearchValueChange}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadLogs()}
                    isLoading={isLoading}
                    label="Reload"
                />
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
            {message && (
                <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {message}
                </section>
            )}

            <section className="mb-3 flex flex-wrap items-center gap-2">
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
                    label="Update Facet"
                    icon={<Info size={14} className="mr-2 shrink-0 text-slate-500" weight="duotone" />}
                    options={secondaryActionFilterOptions}
                    selectedValues={secondaryActionFilters}
                    onSelectedValuesChange={handleSecondaryActionFiltersChange}
                />
                <AdminFilterMenu
                    label="Actor"
                    icon={<User size={14} className="mr-2 shrink-0 text-slate-500" weight="duotone" />}
                    options={actorFilterOptions}
                    selectedValues={actorFilters}
                    onSelectedValuesChange={handleActorFiltersChange}
                />
                <button
                    type="button"
                    onClick={() => {
                        setActionFilters([]);
                        setSecondaryActionFilters([]);
                        setTargetFilters([]);
                        setActorFilters([]);
                        setOffset(0);
                    }}
                    className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                    <X size={14} />
                    Reset
                </button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-3 py-2">When</th>
                                <th className="px-3 py-2">Actor</th>
                                <th className="px-3 py-2">Action</th>
                                <th className="px-3 py-2">Target</th>
                                <th className="px-3 py-2">Diff & details</th>
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
                                const secondaryActions = timelineEntry.kind === 'user'
                                    ? resolveUserChangeSecondaryActions(timelineEntry.log, diffEntries)
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

                                return (
                                    <tr key={`${timelineEntry.kind}-${log.id}`} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                                        <td className="px-3 py-2 text-xs text-slate-600">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-xs text-slate-700">
                                            {actorEmail || (
                                                actorUserId
                                                    ? <CopyableUuid value={actorUserId} textClassName="max-w-[220px] truncate text-xs" hintClassName="text-[9px]" />
                                                    : 'unknown'
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            <span
                                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionPresentation.className}`}
                                                title={log.action}
                                            >
                                                {actionPresentation.label}
                                            </span>
                                            {secondaryActions.length > 0 && (
                                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                                    {secondaryActions.map((secondaryAction) => (
                                                        <span
                                                            key={`${timelineEntry.kind}-${log.id}-${secondaryAction.key}`}
                                                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${secondaryAction.className}`}
                                                            title="Secondary trip update action"
                                                        >
                                                            {secondaryAction.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
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
                                        </td>
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
                                        <td className="px-3 py-2">
                                            {visibleDiffEntries.length > 0 ? (
                                                <div className="max-w-[420px] space-y-2">
                                                    {visibleDiffEntries.map((entry) => (
                                                        <article key={`${timelineEntry.kind}-${log.id}-${entry.key}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                                {formatFieldLabel(entry.key)}
                                                            </p>
                                                            <div className="mt-1 grid gap-1 lg:grid-cols-2">
                                                                <div className="rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-[11px] text-rose-900">
                                                                    <span className="font-semibold">Before: </span>
                                                                    <span className="break-all">{formatAuditValue(entry.beforeValue)}</span>
                                                                </div>
                                                                <div className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[11px] text-emerald-900">
                                                                    <span className="font-semibold">After: </span>
                                                                    <span className="break-all">{formatAuditValue(entry.afterValue)}</span>
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
                                    </tr>
                                );
                            })}
                            {visibleLogs.length === 0 && !isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                                        No audit entries found for the current filters.
                                    </td>
                                </tr>
                            )}
                            {isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
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
