import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { Link, useSearchParams } from '@/app/navigation';
import {
    AppleLogo,
    ArrowSquareOut,
    Broom,
    CaretDown,
    ChatCircleDots,
    Copy,
    CreditCard,
    DiscordLogo,
    DotsThreeVertical,
    DownloadSimple,
    EnvelopeSimple,
    FacebookLogo,
    GithubLogo,
    GoogleLogo,
    Hourglass,
    Key,
    Question,
    SpinnerGap,
    Trash,
    UserPlus,
    UsersThree,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { PROFILE_ACCOUNT_STATUS_OPTIONS, PROFILE_GENDER_OPTIONS } from '../config/profileFields';
import { buildPath } from '../config/routes';
import { useAuth } from '../hooks/useAuth';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import {
    adminCreateUserDirect,
    adminCreateUserInvite,
    adminGetTripVersionSnapshots,
    adminGetUserProfile,
    adminHardDeleteUser,
    adminListUserChangeLogs,
    adminListUserTrips,
    adminListUsers,
    adminResetUserTermsAcceptance,
    adminResetUserUsernameCooldown,
    adminUpdateTrip,
    adminUpdateUserOverrides,
    adminUpdateUserProfile,
    type AdminUserChangeRecord,
    type AdminTripRecord,
    type AdminUserRecord,
} from '../services/adminService';
import {
    buildDangerConfirmDialog,
    buildTransferTargetPromptDialog,
} from '../services/appDialogPresets';
import type { PlanTierKey } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminSortHeaderButton } from '../components/admin/AdminDataTable';
import {
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    ADMIN_TABLE_SORTED_HEADER_CLASS,
    getAdminStickyBodyCellClass,
    getAdminStickyHeaderCellClass,
} from '../components/admin/AdminDataTableUtils';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminDetailSheet } from '../components/admin/AdminDetailSheet';
import { AdminDetailField } from '../components/admin/AdminDetailField';
import { AdminRelativeTimestamp } from '../components/admin/AdminRelativeTimestamp';
import { formatAdminRelativeTime } from '../components/admin/adminRelativeTime';
import { AdminSelectionBar } from '../components/admin/AdminSelectionBar';
import { AdminPagination } from '../components/admin/AdminPagination';
import { AdminJsonDiffModal } from '../components/admin/AdminJsonDiffModal';
import { CopyableUuid, copyTextToClipboard } from '../components/admin/CopyableUuid';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import {
    USER_ACTIVATION_VALUES,
    USER_QUEUE_FILTERS,
    USER_QUEUE_IDS,
    USER_STATUS_VALUES,
    USER_SUBSCRIPTION_VALUES,
    USER_TERMS_STATE_VALUES,
    USER_TRIP_FILTER_LABELS,
    USER_TRIP_FILTER_VALUES,
    SOCIAL_PROVIDER_VALUES,
    countUserQueues,
    formatAbsoluteTimestamp,
    formatAccountStatusLabel,
    fromDateTimeInputValue,
    getActivationStatusLabel,
    getUserAccountStatus,
    getUserActiveTrips,
    getUserDisplayName,
    getUserSubscriptionStatusLabel,
    getUserTermsSortRank,
    getUserTermsStateLabel,
    getUserTermsStateTone,
    getUserTotalTrips,
    activationStatusTone,
    hasNotableSubscription,
    isTripExpiryInputUnchanged,
    isUserHardDeleteEligible,
    isUserTriplessAndNoData,
    matchesUserTripFilter,
    resolveActivationStatus,
    resolveAppliedUserQueue,
    resolveUserLifecycleStatus,
    resolveUserLoginProfile,
    resolveUserSubscriptionDowngradeAt,
    resolveUserSubscriptionStatus,
    resolveUserTermsState,
    subscriptionStatusTone,
    tierTone,
    toDateTimeInputValue,
    type SocialProviderFilter,
    type UserAccountStatus,
    type UserActivationStatus,
    type UserLoginType,
    type UserQueueId,
    type UserSubscriptionStatus,
    type UserTermsState,
    type UserTripFilter,
} from '../components/admin/adminUsersModel';
import { useAppDialog } from '../components/AppDialogProvider';
import { showAppToast } from '../components/ui/appToast';
import { cn } from '../lib/utils';
import { humanizeAdminBillingStatus } from '../services/adminBillingPresentation';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    buildDiffEntryRenderKey,
    buildSecondaryFacetRenderKey,
    buildUserChangeDiffEntries,
    formatUserChangeDiffValue,
    resolveUserChangeActionPresentation,
    resolveUserChangeSecondaryFacets,
} from '../services/adminUserChangeLog';

type SortKey =
    | 'name'
    | 'email'
    | 'total_trips'
    | 'activation_status'
    | 'last_sign_in_at'
    | 'updated_at'
    | 'created_at'
    | 'tier_key'
    | 'subscription_status'
    | 'system_role'
    | 'account_status'
    | 'terms_accepted_version';
type SortDirection = 'asc' | 'desc';
type LoginPillKey = 'password' | SocialProviderFilter | 'anonymous' | 'unknown';
type UserVisibleColumnId =
    | 'user'
    | 'status'
    | 'login'
    | 'tier'
    | 'subscription'
    | 'trips'
    | 'activation'
    | 'role'
    | 'toc'
    | 'last_visit'
    | 'last_log'
    | 'created';
type UserDetailTab = 'overview' | 'profile' | 'billing' | 'trips' | 'activity';

const PAGE_SIZE = 25;
const USER_CHANGE_LOG_DRAWER_LIMIT = 20;
const USER_DETAIL_TRIP_PAGE_SIZE = 10;
const USER_DETAIL_LOG_PAGE_SIZE = 10;
const GENDER_UNSET_VALUE = '__gender_unset__';
const USERS_CACHE_KEY = 'admin.users.cache.v1';
const USERS_COLUMNS_CACHE_KEY_PREFIX = 'admin.users.columns.v2';
const USERNAME_CHANGE_COOLDOWN_DAYS = 90;
const USER_ROLE_VALUES = ['admin', 'user'] as const;
const USER_LOGIN_TYPE_VALUES: ReadonlyArray<UserLoginType> = ['social', 'password', 'unknown'];
// Render order of the columns. The picker can only show or hide, never reorder.
const USER_VISIBLE_COLUMN_IDS: readonly UserVisibleColumnId[] = [
    'user',
    'status',
    'login',
    'tier',
    'subscription',
    'trips',
    'activation',
    'role',
    'toc',
    'last_visit',
    'last_log',
    'created',
];
const USER_VISIBLE_COLUMN_OPTIONS: Array<{ value: UserVisibleColumnId; label: string }> = [
    { value: 'user', label: 'User' },
    { value: 'status', label: 'Status' },
    { value: 'login', label: 'Sign-in method' },
    { value: 'tier', label: 'Plan' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'trips', label: 'Trips' },
    { value: 'activation', label: 'Activation' },
    { value: 'role', label: 'Role' },
    { value: 'toc', label: 'Terms' },
    { value: 'last_visit', label: 'Last sign-in' },
    { value: 'last_log', label: 'Last updated' },
    { value: 'created', label: 'Created' },
];
// What fits a 1440px screen without scrolling sideways. Role is a badge on the
// name, activation folds into Status, subscription into Plan.
const DEFAULT_VISIBLE_USER_COLUMNS: UserVisibleColumnId[] = [
    'user',
    'status',
    'login',
    'tier',
    'trips',
    'last_visit',
    'created',
];
// The previous default set. Admins who never touched the picker have exactly
// this stored; they get the new default instead of a frozen 10-column table.
const LEGACY_DEFAULT_VISIBLE_USER_COLUMNS: UserVisibleColumnId[] = [
    'user',
    'login',
    'trips',
    'activation',
    'role',
    'tier',
    'subscription',
    'status',
    'last_visit',
    'created',
];
const SOCIAL_PROVIDER_OPTIONS: Array<{ value: SocialProviderFilter; label: string }> = [
    { value: 'google', label: 'Google' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'kakao', label: 'Kakao' },
    { value: 'apple', label: 'Apple' },
    { value: 'github', label: 'GitHub' },
    { value: 'discord', label: 'Discord' },
    { value: 'other_social', label: 'Other social' },
];
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const VALID_PROFILE_GENDERS = new Set(['female', 'male', 'non-binary', 'prefer-not']);

const USER_QUEUE_COPY: Record<UserQueueId, { label: string; description: string; icon: React.ReactNode; attention: boolean }> = {
    awaiting_activation: {
        label: 'Awaiting activation',
        description: 'Invited or created, never signed in.',
        icon: <Hourglass />,
        attention: true,
    },
    subscriptions_at_risk: {
        label: 'Subscriptions at risk',
        description: 'Past due, or cancelled and in grace.',
        icon: <CreditCard />,
        attention: true,
    },
    empty_accounts: {
        label: 'Empty accounts',
        description: 'No trips, no profile, never signed in.',
        icon: <Broom />,
        attention: false,
    },
};

const USER_QUEUE_EVENTS = {
    awaiting_activation: 'admin__users_queue--awaiting_activation',
    subscriptions_at_risk: 'admin__users_queue--subscriptions_at_risk',
    empty_accounts: 'admin__users_queue--empty_accounts',
} as const;

const USER_DETAIL_TAB_LABELS: Record<UserDetailTab, string> = {
    overview: 'Overview',
    profile: 'Profile & access',
    billing: 'Billing',
    trips: 'Trips',
    activity: 'Activity',
};

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

const sanitizeFilenameSegment = (value: string): string => {
    const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    return normalized || 'users';
};

const escapeCsvField = (value: string | null | undefined): string => {
    const normalized = value ?? '';
    return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsvLine = (fields: Array<string | null | undefined>): string => fields.map((field) => escapeCsvField(field)).join(',');

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface LoginPillDefinition {
    label: string;
    className: string;
    icon: IconComponent;
}

const LOGIN_PILL_DEFINITIONS: Record<LoginPillKey, LoginPillDefinition> = {
    password: {
        label: 'Email',
        className: 'border-border bg-secondary text-secondary-foreground',
        icon: Key,
    },
    google: {
        label: 'Google',
        className: 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30',
        icon: GoogleLogo,
    },
    facebook: {
        label: 'Facebook',
        className: 'border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-400/12 dark:text-sky-200 dark:border-sky-400/30',
        icon: FacebookLogo,
    },
    kakao: {
        label: 'Kakao',
        className: 'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30',
        icon: ChatCircleDots,
    },
    apple: {
        label: 'Apple',
        className: 'border-slate-400 bg-secondary text-foreground dark:border-slate-500',
        icon: AppleLogo,
    },
    github: {
        label: 'GitHub',
        className: 'border-zinc-400 bg-secondary text-foreground dark:border-zinc-500',
        icon: GithubLogo,
    },
    discord: {
        label: 'Discord',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-400/12 dark:text-indigo-200 dark:border-indigo-400/30',
        icon: DiscordLogo,
    },
    other_social: {
        label: 'Other social',
        className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-400/12 dark:text-fuchsia-200 dark:border-fuchsia-400/30',
        icon: ChatCircleDots,
    },
    anonymous: {
        label: 'Guest',
        className: 'border-border bg-secondary text-muted-foreground',
        icon: Question,
    },
    unknown: {
        label: 'Unknown',
        className: 'border-border bg-secondary text-muted-foreground',
        icon: Question,
    },
};

const parseAdminDateRange = (value: string | null): AdminDateRange => {
    if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
    return '30d';
};

const parseSortKey = (value: string | null): SortKey => {
    if (value === 'name'
        || value === 'email'
        || value === 'total_trips'
        || value === 'activation_status'
        || value === 'last_sign_in_at'
        || value === 'updated_at'
        || value === 'created_at'
        || value === 'tier_key'
        || value === 'subscription_status'
        || value === 'system_role'
        || value === 'account_status'
        || value === 'terms_accepted_version') {
        return value;
    }
    return 'created_at';
};

const parseSortDirection = (value: string | null): SortDirection => {
    if (value === 'asc' || value === 'desc') return value;
    return 'desc';
};

const parseQueryMultiValue = <T extends string>(
    value: string | null,
    allowedValues: readonly T[]
): T[] => {
    if (!value) return [];
    const allowSet = new Set<string>(allowedValues);
    const unique = new Set<string>();
    for (const chunk of value.split(',')) {
        const trimmed = chunk.trim();
        if (!trimmed || !allowSet.has(trimmed)) continue;
        unique.add(trimmed);
    }
    return allowedValues.filter((candidate) => unique.has(candidate));
};

const parsePositivePage = (value: string | null): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.floor(parsed));
};

const sanitizeUserVisibleColumns = (values: string[] | null | undefined): UserVisibleColumnId[] => {
    if (!Array.isArray(values) || values.length === 0) return [...DEFAULT_VISIBLE_USER_COLUMNS];
    const unique = new Set<string>();
    values.forEach((value) => {
        if (USER_VISIBLE_COLUMN_IDS.includes(value as UserVisibleColumnId)) {
            unique.add(value);
        }
    });
    const ordered = USER_VISIBLE_COLUMN_IDS.filter((columnId) => unique.has(columnId));
    if (ordered.length === 0) return [...DEFAULT_VISIBLE_USER_COLUMNS];
    if (ordered.includes('user')) return ordered;
    return ['user', ...ordered];
};

const isSameColumnSet = (left: readonly string[], right: readonly string[]): boolean => (
    left.length === right.length && left.every((value) => right.includes(value))
);

const parseUserVisibleColumns = (value: string | null): UserVisibleColumnId[] => {
    const parsed = parseQueryMultiValue(value, USER_VISIBLE_COLUMN_IDS);
    if (parsed.length === 0) return [...DEFAULT_VISIBLE_USER_COLUMNS];
    return sanitizeUserVisibleColumns(parsed);
};

const restoreCachedUserVisibleColumns = (cached: string[] | null | undefined): UserVisibleColumnId[] => {
    if (Array.isArray(cached) && isSameColumnSet(cached, LEGACY_DEFAULT_VISIBLE_USER_COLUMNS)) {
        return [...DEFAULT_VISIBLE_USER_COLUMNS];
    }
    return sanitizeUserVisibleColumns(cached);
};

const buildUsersColumnsCacheKey = (userId: string | null | undefined): string => {
    const normalized = typeof userId === 'string' ? userId.trim() : '';
    return `${USERS_COLUMNS_CACHE_KEY_PREFIX}.${normalized || 'anonymous'}`;
};

const getUsernameCooldownMeta = (usernameChangedAt: string | null | undefined): {
    isActive: boolean;
    endsAt: string | null;
} => {
    const parsed = Date.parse(usernameChangedAt || '');
    if (!Number.isFinite(parsed)) {
        return {
            isActive: false,
            endsAt: null,
        };
    }
    const endsDate = new Date(parsed + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    return {
        isActive: Date.now() < endsDate.getTime(),
        endsAt: endsDate.toISOString(),
    };
};

const formatFieldLabel = (value: string): string => {
    const spaced = value.replace(/_/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
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

const getLoginPills = (user: AdminUserRecord): LoginPillDefinition[] => {
    const profile = resolveUserLoginProfile(user);
    const pills: LoginPillDefinition[] = [];
    if (profile.hasPassword) pills.push(LOGIN_PILL_DEFINITIONS.password);
    profile.socialProviders.forEach((provider) => pills.push(LOGIN_PILL_DEFINITIONS[provider]));
    if (pills.length === 0 && profile.isAnonymousOnly) pills.push(LOGIN_PILL_DEFINITIONS.anonymous);
    if (pills.length === 0) pills.push(LOGIN_PILL_DEFINITIONS.unknown);
    return pills;
};

const getLoginMethodSummary = (user: AdminUserRecord): string => {
    return getLoginPills(user).map((pill) => pill.label).join(', ');
};

const getLoginSearchText = (user: AdminUserRecord): string => {
    const profile = resolveUserLoginProfile(user);
    return `${profile.providers.join(' ')} ${getLoginMethodSummary(user)}`.trim().toLowerCase();
};

const toProfileGenderDraft = (value: string | null | undefined): '' | 'female' | 'male' | 'non-binary' | 'prefer-not' => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().toLowerCase();
    if (!normalized) return '';
    return VALID_PROFILE_GENDERS.has(normalized)
        ? (normalized as 'female' | 'male' | 'non-binary' | 'prefer-not')
        : '';
};

const isLikelyUserId = (value: string): boolean => USER_ID_PATTERN.test(value.trim());
const isLikelyEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

const getUserReferenceText = (user: AdminUserRecord): string => {
    const name = getUserDisplayName(user);
    const email = (user.email || '').trim();
    if (email) return `${name} (${email})`;
    return `${name} (${user.user_id})`;
};

const getUnknownErrorMessage = (error: unknown, fallback: string): string => (
    toAdminErrorMessage(error, fallback, 'admin-users')
);

const summarizeBulkDeleteFailures = (details: string[]): string => {
    if (details.length === 0) return '';
    const maxVisible = 5;
    const visible = details.slice(0, maxVisible).map((detail) => `- ${detail}`).join('\n');
    if (details.length <= maxVisible) return visible;
    return `${visible}\n- +${details.length - maxVisible} more failure${details.length - maxVisible === 1 ? '' : 's'}`;
};

const buildSingleHardDeleteMessage = (
    userName: string,
    ownedTripCount: number
): React.ReactNode => {
    const tripSuffix = ownedTripCount > 0 ? ` (${ownedTripCount})` : '';
    const tripLine = ownedTripCount > 0
        ? `${ownedTripCount} owned trip${ownedTripCount === 1 ? '' : 's'} will be permanently deleted.`
        : 'No owned trips were found for this user.';
    return (
        <div className="space-y-3">
            <p>
                Are you sure you want to hard-delete <strong>"{userName}"</strong>?
            </p>
            <p>
                Hard delete permanently removes the <strong>auth account</strong>, <strong>profile data</strong>, and <strong>all owned trips{tripSuffix}</strong>.
            </p>
            <ul className="list-disc space-y-1 ps-5">
                <li>Auth account and profile data are permanently removed.</li>
                <li>{tripLine}</li>
                <li>Use soft delete instead if you may need to restore this user later.</li>
            </ul>
            {ownedTripCount > 0 ? (
                <p>
                    To keep trips, cancel and use <strong>Transfer trips + hard delete</strong> first.
                </p>
            ) : null}
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
                <WarningCircle size={16} className="mt-0.5 shrink-0" />
                <span><strong>This action cannot be undone.</strong></span>
            </div>
        </div>
    );
};

const buildSingleSoftDeleteMessage = (userName: string): React.ReactNode => {
    return (
        <div className="space-y-3">
            <p>
                Are you sure you want to soft-delete <strong>"{userName}"</strong>?
            </p>
            <p>
                Soft delete keeps the account and related data in the database so this user can be restored later.
            </p>
            <ul className="list-disc space-y-1 ps-5">
                <li>The user cannot sign in while the account is soft-deleted.</li>
                <li>An admin can restore the user later.</li>
            </ul>
            <p>
                Use hard delete only for permanent removal.
            </p>
        </div>
    );
};

const buildBulkHardDeleteMessage = (
    selectedUsers: number,
    selectedTrips: number
): React.ReactNode => {
    return (
        <div className="space-y-3">
            <p>
                Selected users: <strong>{selectedUsers}</strong>
            </p>
            <p>
                Hard delete permanently removes auth accounts and profile data for <strong>{selectedUsers}</strong> user{selectedUsers === 1 ? '' : 's'}.
            </p>
            <p>
                It also permanently removes <strong>{selectedTrips}</strong> owned trip{selectedTrips === 1 ? '' : 's'} in total.
            </p>
            <ul className="list-disc space-y-1 ps-5">
                <li>Use soft delete if these users might need to be restored later.</li>
                {selectedTrips > 0 ? (
                    <li>Cancel and transfer trips from each user's details if you need to preserve trip data.</li>
                ) : null}
                {selectedTrips > 0 ? (
                    <li>Continue hard delete to permanently remove selected users and owned trips.</li>
                ) : null}
            </ul>
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
                <WarningCircle size={16} className="mt-0.5 shrink-0" />
                <span><strong>This action cannot be undone.</strong></span>
            </div>
        </div>
    );
};

const buildTransferAndHardDeleteMessage = (
    sourceUser: string,
    targetUser: string,
    transferCount: number
): React.ReactNode => (
    <div className="space-y-3">
        <p>
            Transfer <strong>{transferCount}</strong> trip{transferCount === 1 ? '' : 's'} from <strong>{sourceUser}</strong> to <strong>{targetUser}</strong>?
        </p>
        <ul className="list-disc space-y-1 ps-5">
            <li>Step 1: Transfer all owned trips to the target account.</li>
            <li>Step 2: Hard-delete the source user (auth + profile only).</li>
            <li>Result: trips remain accessible under the new owner.</li>
        </ul>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30">
            <WarningCircle size={16} className="mt-0.5 shrink-0" />
            <span><strong>Transfer first if you want to preserve trips before hard delete.</strong></span>
        </div>
    </div>
);

const formatOverrideDraft = (value: Record<string, unknown> | null | undefined): string => {
    if (!value || Object.keys(value).length === 0) return '';
    return JSON.stringify(value, null, 2);
};

const parseOverrideDraft = (value: string): Record<string, unknown> => {
    if (!value.trim()) return {};
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Overrides JSON must be an object.');
    }
    return parsed as Record<string, unknown>;
};

const normalizeOverrideRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
};

const toStableComparableJson = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((entry) => toStableComparableJson(entry));
    if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
            .sort((a, b) => a.localeCompare(b))
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = toStableComparableJson((value as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }
    return value;
};

const areOverrideRecordsEqual = (left: Record<string, unknown>, right: Record<string, unknown>): boolean => (
    JSON.stringify(toStableComparableJson(left)) === JSON.stringify(toStableComparableJson(right))
);

const getPlanName = (tier: PlanTierKey): string => PLAN_CATALOG[tier]?.publicName || tier;

interface CreateUserDraft {
    email: string;
    firstName: string;
    lastName: string;
    tierKey: PlanTierKey;
    password: string;
}

const INITIAL_CREATE_DRAFT: CreateUserDraft = {
    email: '',
    firstName: '',
    lastName: '',
    tierKey: 'tier_free',
    password: '',
};

const LoginPills: React.FC<{ user: AdminUserRecord }> = ({ user }) => (
    <div className="flex flex-wrap items-center gap-1.5">
        {getLoginPills(user).map((pill) => {
            const Icon = pill.icon;
            return (
                <AdminStatusBadge key={pill.label} dot={false} className={pill.className}>
                    <Icon size={12} aria-hidden="true" />
                    {pill.label}
                </AdminStatusBadge>
            );
        })}
    </div>
);

const UserRowActionsMenu: React.FC<{
    disabled: boolean;
    isDeleted: boolean;
    userName: string;
    tripsLink: string;
    onOpenDetails: () => void;
    onCopyId: () => void;
    onSoftDelete: () => void;
}> = ({ disabled, isDeleted, userName, tripsLink, onOpenDetails, onCopyId, onSoftDelete }) => (
    <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={`Open actions for ${userName}`}
                data-tooltip="User actions"
            >
                <DotsThreeVertical weight="bold" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onSelect={onOpenDetails}>
                Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCopyId}>
                <Copy />
                Copy user ID
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <Link
                    to={tripsLink}
                    onClick={() => trackEvent('admin__users_row--view_trips')}
                    {...getAnalyticsDebugAttributes('admin__users_row--view_trips')}
                >
                    View trips
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant={isDeleted ? 'default' : 'destructive'} onSelect={onSoftDelete}>
                {isDeleted ? 'Restore user' : 'Soft-delete user'}
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

interface LoginFilterCounts {
    password: number;
    social: number;
    unknown: number;
    socialProviders: Record<SocialProviderFilter, number>;
}

const LoginTypeFilterMenu: React.FC<{
    selectedLoginTypes: UserLoginType[];
    selectedSocialProviders: SocialProviderFilter[];
    counts: LoginFilterCounts;
    onSelectedLoginTypesChange: (next: UserLoginType[]) => void;
    onSelectedSocialProvidersChange: (next: SocialProviderFilter[]) => void;
}> = ({
    selectedLoginTypes,
    selectedSocialProviders,
    counts,
    onSelectedLoginTypesChange,
    onSelectedSocialProvidersChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number }>({
        top: 0,
        left: 0,
        width: 320,
    });

    const selectedLoginTypeSet = useMemo(() => new Set(selectedLoginTypes), [selectedLoginTypes]);
    const socialEnabled = selectedLoginTypeSet.has('social');
    const selectedSocialProviderSet = useMemo(
        () => new Set(selectedSocialProviders),
        [selectedSocialProviders]
    );
    const activeSocialProviderCount = socialEnabled
        ? (selectedSocialProviders.length === 0 ? SOCIAL_PROVIDER_VALUES.length : selectedSocialProviders.length)
        : 0;
    const socialIndeterminate = socialEnabled
        && activeSocialProviderCount > 0
        && activeSocialProviderCount < SOCIAL_PROVIDER_VALUES.length;

    const selectedLabelSummary = useMemo(() => {
        if (selectedLoginTypes.length === 0) return null;
        const labels: string[] = [];
        if (selectedLoginTypeSet.has('social')) {
            if (socialIndeterminate) labels.push(`Social (${activeSocialProviderCount})`);
            else labels.push('Social');
        }
        if (selectedLoginTypeSet.has('password')) labels.push('Email');
        if (selectedLoginTypeSet.has('unknown')) labels.push('Unknown');
        return labels.join(', ');
    }, [activeSocialProviderCount, selectedLoginTypeSet, selectedLoginTypes.length, socialIndeterminate]);

    const updateMenuPosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const viewportPadding = 10;
        const preferredWidth = Math.max(300, rect.width + 70);
        const maxLeft = window.innerWidth - preferredWidth - viewportPadding;
        const nextLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
        setMenuPosition({
            top: rect.bottom + 8,
            left: nextLeft,
            width: preferredWidth,
        });
    };

    // Subscribes to window pointer/keyboard/scroll events while the popover is open.
    useEffect(() => {
        if (!isOpen) return undefined;
        updateMenuPosition();
        const onPointer = (event: PointerEvent) => {
            const targetNode = event.target as Node;
            if (triggerRef.current?.contains(targetNode)) return;
            if (menuRef.current?.contains(targetNode)) return;
            setIsOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
            triggerRef.current?.focus();
        };
        const onViewportChange = () => updateMenuPosition();
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onEscape);
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onEscape);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
        };
    }, [isOpen]);

    const setLoginTypeChecked = (value: UserLoginType, checked: boolean) => {
        const next = new Set(selectedLoginTypeSet);
        if (checked) next.add(value);
        else next.delete(value);
        if (!next.has('social')) onSelectedSocialProvidersChange([]);
        onSelectedLoginTypesChange(USER_LOGIN_TYPE_VALUES.filter((candidate) => next.has(candidate)));
    };

    const setSocialParentChecked = (checked: boolean) => {
        const next = new Set(selectedLoginTypeSet);
        if (checked) {
            next.add('social');
        } else {
            next.delete('social');
            onSelectedSocialProvidersChange([]);
        }
        onSelectedLoginTypesChange(USER_LOGIN_TYPE_VALUES.filter((candidate) => next.has(candidate)));
    };

    const toggleSocialProvider = (provider: SocialProviderFilter) => {
        const next = new Set(
            selectedSocialProviders.length === 0
                ? SOCIAL_PROVIDER_VALUES
                : selectedSocialProviders
        );
        if (next.has(provider)) next.delete(provider);
        else next.add(provider);
        if (next.size === 0) {
            setLoginTypeChecked('social', false);
            onSelectedSocialProvidersChange([]);
            return;
        }
        setLoginTypeChecked('social', true);
        const ordered = SOCIAL_PROVIDER_VALUES.filter((candidate) => next.has(candidate));
        if (ordered.length === SOCIAL_PROVIDER_VALUES.length) {
            onSelectedSocialProvidersChange([]);
            return;
        }
        onSelectedSocialProvidersChange(ordered);
    };

    const socialCheckboxState: boolean | 'indeterminate' = socialEnabled
        ? (socialIndeterminate ? 'indeterminate' : true)
        : false;

    const optionRowClass = 'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-secondary hover:text-foreground';

    return (
        <div>
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                    updateMenuPosition();
                    setIsOpen((current) => !current);
                }}
                className="h-8 w-fit gap-0 border-dashed px-3 text-xs"
                aria-label="Filter by sign-in method"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <Key size={14} className="me-2 shrink-0 text-muted-foreground" weight="duotone" />
                <span>Sign-in method</span>
                {selectedLabelSummary && (
                    <>
                        <span className="mx-2 h-4 w-px bg-border" aria-hidden="true" />
                        <span className="inline-flex max-w-[220px] items-center truncate rounded-sm bg-secondary px-1 font-normal text-secondary-foreground">
                            {selectedLabelSummary}
                        </span>
                    </>
                )}
            </Button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    role="group"
                    aria-label="Sign-in method filters"
                    className="fixed z-[1700] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] dark:shadow-none"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                    }}
                >
                    <div className="space-y-0.5 p-1">
                        <label className={optionRowClass}>
                            <div className="me-2 flex size-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selectedLoginTypeSet.has('password')}
                                    onCheckedChange={(checked) => setLoginTypeChecked('password', Boolean(checked))}
                                    className="size-4"
                                />
                            </div>
                            <span>Email and password</span>
                            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.password}</span>
                        </label>
                        <label className={optionRowClass}>
                            <div className="me-2 flex size-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={socialCheckboxState}
                                    onCheckedChange={(checked) => setSocialParentChecked(Boolean(checked))}
                                    className="size-4"
                                />
                            </div>
                            <span>Social</span>
                            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.social}</span>
                        </label>
                        <div className={cn('ms-6 space-y-0.5 border-s-2 border-border ps-2', !socialEnabled && 'pointer-events-none opacity-50')}>
                            {SOCIAL_PROVIDER_OPTIONS.map((option) => {
                                const checked = socialEnabled
                                    && (selectedSocialProviders.length === 0 || selectedSocialProviderSet.has(option.value));
                                const Icon = LOGIN_PILL_DEFINITIONS[option.value].icon;
                                return (
                                    <label
                                        key={`social-provider-filter-${option.value}`}
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-secondary hover:text-foreground"
                                    >
                                        <div className="me-2 flex size-3.5 shrink-0 items-center justify-center">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleSocialProvider(option.value)}
                                                className="size-3.5 rounded-[2px]"
                                            />
                                        </div>
                                        <Icon size={12} className="me-1.5 text-muted-foreground" />
                                        <span>{option.label}</span>
                                        <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.socialProviders[option.value]}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <label className={optionRowClass}>
                            <div className="me-2 flex size-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selectedLoginTypeSet.has('unknown')}
                                    onCheckedChange={(checked) => setLoginTypeChecked('unknown', Boolean(checked))}
                                    className="size-4"
                                />
                            </div>
                            <span>Unknown</span>
                            <span className="ms-auto text-xs tabular-nums text-muted-foreground">{counts.unknown}</span>
                        </label>
                    </div>
                    {selectedLoginTypeSet.size > 0 && (
                        <>
                            <div className="h-px bg-border" />
                            <div className="p-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        onSelectedLoginTypesChange([]);
                                        onSelectedSocialProvidersChange([]);
                                        setIsOpen(false);
                                    }}
                                    className="w-full"
                                >
                                    Clear filter
                                </Button>
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export const AdminUsersPage: React.FC = () => {
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();
    const { access } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const cachedUsers = useMemo(
        () => readAdminCache<AdminUserRecord[]>(USERS_CACHE_KEY, []),
        []
    );
    const [users, setUsers] = useState<AdminUserRecord[]>(cachedUsers);
    const [isLoadingUsers, setIsLoadingUsers] = useState(() => cachedUsers.length === 0);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => parseAdminDateRange(searchParams.get('range')));
    const [roleFilters, setRoleFilters] = useState<Array<'admin' | 'user'>>(
        () => parseQueryMultiValue(searchParams.get('role'), USER_ROLE_VALUES)
    );
    const [tierFilters, setTierFilters] = useState<PlanTierKey[]>(
        () => parseQueryMultiValue(searchParams.get('tier'), PLAN_ORDER)
    );
    const [statusFilters, setStatusFilters] = useState<UserAccountStatus[]>(
        () => parseQueryMultiValue(searchParams.get('status'), USER_STATUS_VALUES)
    );
    const [activationFilters, setActivationFilters] = useState<UserActivationStatus[]>(() => {
        const next = parseQueryMultiValue(searchParams.get('activation'), USER_ACTIVATION_VALUES);
        if (next.length > 0) return next;
        // Legacy URL support from prior identity filter.
        const legacyIdentity = searchParams.get('identity');
        if (legacyIdentity === 'identified') return ['activated', 'invited'];
        if (legacyIdentity === 'anonymous') return ['pending', 'anonymous'];
        return [];
    });
    const [loginTypeFilters, setLoginTypeFilters] = useState<UserLoginType[]>(
        () => parseQueryMultiValue(searchParams.get('login'), USER_LOGIN_TYPE_VALUES)
    );
    const [socialProviderFilters, setSocialProviderFilters] = useState<SocialProviderFilter[]>(
        () => parseQueryMultiValue(searchParams.get('social'), SOCIAL_PROVIDER_VALUES)
    );
    const [tripFilters, setTripFilters] = useState<UserTripFilter[]>(
        () => parseQueryMultiValue(searchParams.get('trips'), USER_TRIP_FILTER_VALUES)
    );
    const [termsFilters, setTermsFilters] = useState<UserTermsState[]>(
        () => parseQueryMultiValue(searchParams.get('terms'), USER_TERMS_STATE_VALUES)
    );
    const [subscriptionFilters, setSubscriptionFilters] = useState<UserSubscriptionStatus[]>(
        () => parseQueryMultiValue(searchParams.get('subscription'), USER_SUBSCRIPTION_VALUES)
    );
    const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<UserVisibleColumnId[]>(
        () => parseUserVisibleColumns(searchParams.get('cols'))
    );
    const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')));
    const [sortDirection, setSortDirection] = useState<SortDirection>(() => parseSortDirection(searchParams.get('dir')));
    const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [createMode, setCreateMode] = useState<'invite' | 'direct'>('invite');
    const [createDraft, setCreateDraft] = useState<CreateUserDraft>(INITIAL_CREATE_DRAFT);
    const [createError, setCreateError] = useState<string | null>(null);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailTab, setDetailTab] = useState<UserDetailTab>('overview');
    const [missingLinkedUserId, setMissingLinkedUserId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [overrideDraft, setOverrideDraft] = useState('');
    const [tierDraft, setTierDraft] = useState<PlanTierKey>('tier_free');
    const [profileDraft, setProfileDraft] = useState({
        firstName: '',
        lastName: '',
        username: '',
        gender: '' as '' | 'female' | 'male' | 'non-binary' | 'prefer-not',
        country: '',
        city: '',
        preferredLanguage: 'en',
        accountStatus: 'active' as 'active' | 'disabled' | 'deleted',
        role: 'user' as 'admin' | 'user',
    });
    const [userTrips, setUserTrips] = useState<AdminTripRecord[]>([]);
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);
    const [connectedTripsPage, setConnectedTripsPage] = useState(1);
    const [userChangeLogs, setUserChangeLogs] = useState<AdminUserChangeRecord[]>([]);
    const [isLoadingUserChangeLogs, setIsLoadingUserChangeLogs] = useState(false);
    const [userChangeLogsError, setUserChangeLogsError] = useState<string | null>(null);
    const [userChangeLogsPage, setUserChangeLogsPage] = useState(1);
    const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
    const [isDiffModalLoading, setIsDiffModalLoading] = useState(false);
    const [diffModalError, setDiffModalError] = useState<string | null>(null);
    const [diffModalTitle, setDiffModalTitle] = useState('Full change diff');
    const [diffModalDescription, setDiffModalDescription] = useState<string | undefined>(undefined);
    const [diffModalBeforeLabel, setDiffModalBeforeLabel] = useState('Before snapshot');
    const [diffModalAfterLabel, setDiffModalAfterLabel] = useState('After snapshot');
    const [diffModalBeforeValue, setDiffModalBeforeValue] = useState<unknown>({});
    const [diffModalAfterValue, setDiffModalAfterValue] = useState<unknown>({});
    const usersColumnsCacheKey = useMemo(
        () => buildUsersColumnsCacheKey(access?.userId),
        [access?.userId]
    );
    const usersTableScrollRef = useRef<HTMLDivElement | null>(null);
    const [isUsersTableScrolledHorizontally, setIsUsersTableScrolledHorizontally] = useState(false);
    const handledDeepLinkUserIdRef = useRef<string | null>(null);
    const deepLinkedUserId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const userId = searchParams.get('user');
        if (drawer !== 'user' || !userId) return null;
        return userId;
    }, [searchParams]);
    const loadedColumnsCacheKeyRef = useRef<string | null>(null);

    const notifySuccess = (title: string, description?: string) => {
        showAppToast({ tone: 'success', title, description });
    };

    /** Opens the inspector for one account, always on its overview. */
    const showUserDetail = (userId: string) => {
        setSelectedUserId(userId);
        setIsDetailOpen(true);
        setDetailTab('overview');
        setConnectedTripsPage(1);
        setUserChangeLogsPage(1);
    };

    /**
     * Closes the inspector and drops `?user=…&drawer=user`. Every close path
     * goes through here: a hard delete used to close the sheet but leave the
     * deep link behind, so a reload reopened a deleted account.
     */
    const closeUserDetail = () => {
        setIsDetailOpen(false);
        setSelectedUserId(null);
        setSearchParams((current) => {
            if (!current.has('user') && current.get('drawer') !== 'user') return current;
            const next = new URLSearchParams(current);
            next.delete('user');
            next.delete('drawer');
            return next;
        }, { replace: true });
    };

    // Restores the admin's column choice from browser storage (an external store keyed by the signed-in admin).
    useEffect(() => {
        if (loadedColumnsCacheKeyRef.current === usersColumnsCacheKey) return;
        loadedColumnsCacheKeyRef.current = usersColumnsCacheKey;
        if (searchParams.get('cols')) return;
        const cachedColumns = readAdminCache<string[] | null>(usersColumnsCacheKey, null);
        if (!cachedColumns) return;
        setVisibleColumns(restoreCachedUserVisibleColumns(cachedColumns));
    }, [searchParams, usersColumnsCacheKey]);

    useEffect(() => {
        writeAdminCache(usersColumnsCacheKey, visibleColumns);
    }, [usersColumnsCacheKey, visibleColumns]);

    // Tracks horizontal scroll of the table container to show the sticky-column edge.
    useEffect(() => {
        const root = usersTableScrollRef.current;
        const node = root?.querySelector<HTMLElement>('[data-slot="table-container"]');
        if (!node) return;
        const handleScroll = () => {
            setIsUsersTableScrolledHorizontally(node.scrollLeft > 4);
        };
        handleScroll();
        node.addEventListener('scroll', handleScroll, { passive: true });
        return () => node.removeEventListener('scroll', handleScroll);
    }, [visibleColumns]);

    useEffect(() => {
        if (!deepLinkedUserId) {
            handledDeepLinkUserIdRef.current = null;
            return;
        }
        if (handledDeepLinkUserIdRef.current !== deepLinkedUserId) {
            showUserDetail(deepLinkedUserId);
            handledDeepLinkUserIdRef.current = deepLinkedUserId;
        }

        const hasInTable = users.some((user) => user.user_id === deepLinkedUserId);
        if (hasInTable) return;

        let active = true;
        void adminGetUserProfile(deepLinkedUserId)
            .then((profile) => {
                if (!active) return;
                if (!profile) {
                    setMissingLinkedUserId(deepLinkedUserId);
                    return;
                }
                setUsers((current) => {
                    const exists = current.some((candidate) => candidate.user_id === profile.user_id);
                    const nextUsers = exists
                        ? current.map((candidate) => (candidate.user_id === profile.user_id ? { ...candidate, ...profile } : candidate))
                        : [profile, ...current];
                    writeAdminCache(USERS_CACHE_KEY, nextUsers);
                    return nextUsers;
                });
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(toAdminErrorMessage(error, 'Could not load the linked user.', 'admin-users'));
            });

        return () => {
            active = false;
        };
    }, [deepLinkedUserId, users]);

    const selectedUser = useMemo(
        () => users.find((user) => user.user_id === selectedUserId) || null,
        [selectedUserId, users]
    );
    const currentTermsVersion = access?.termsCurrentVersion ?? null;
    const selectedUserUsernameCooldown = useMemo(
        () => getUsernameCooldownMeta(selectedUser?.username_changed_at),
        [selectedUser?.username_changed_at]
    );
    const selectedUserTripStats = useMemo(() => {
        const fallbackTotal = selectedUser ? getUserTotalTrips(selectedUser) : 0;
        const fallbackActive = selectedUser ? getUserActiveTrips(selectedUser) : 0;
        if (isLoadingTrips) {
            return { total: fallbackTotal, active: fallbackActive };
        }
        const total = userTrips.length;
        const active = userTrips.filter((trip) => trip.status === 'active').length;
        return { total, active };
    }, [isLoadingTrips, selectedUser, userTrips]);
    const selectedUserTripsPageLink = useMemo(() => {
        if (!selectedUser) return null;
        const token = (selectedUser.email || '').trim() || selectedUser.user_id;
        return `/admin/trips?q=${encodeURIComponent(token)}`;
    }, [selectedUser]);
    const selectedUserPublicProfilePath = useMemo(() => {
        const normalizedUsername = (selectedUser?.username || '').trim().toLowerCase();
        if (!/^[a-z0-9_-]{3,40}$/.test(normalizedUsername)) return null;
        return buildPath('publicProfile', { username: normalizedUsername });
    }, [selectedUser?.username]);
    const selectedUserChangeEntries = useMemo(() => userChangeLogs.map((log) => {
        const diffEntries = buildUserChangeDiffEntries(log);
        const actionPresentation = resolveUserChangeActionPresentation(log, diffEntries);
        const secondaryFacets = resolveUserChangeSecondaryFacets(log);
        const visibleDiffEntries = diffEntries.slice(0, 4);
        const hiddenDiffCount = Math.max(0, diffEntries.length - visibleDiffEntries.length);
        return {
            log,
            actionPresentation,
            secondaryFacets,
            visibleDiffEntries,
            hiddenDiffCount,
        };
    }), [userChangeLogs]);
    const connectedTripsPageCount = Math.max(Math.ceil(userTrips.length / USER_DETAIL_TRIP_PAGE_SIZE), 1);
    const safeConnectedTripsPage = Math.min(connectedTripsPage, connectedTripsPageCount);
    const pagedConnectedTrips = useMemo(() => {
        const start = (safeConnectedTripsPage - 1) * USER_DETAIL_TRIP_PAGE_SIZE;
        return userTrips.slice(start, start + USER_DETAIL_TRIP_PAGE_SIZE);
    }, [safeConnectedTripsPage, userTrips]);
    const userChangeLogsPageCount = Math.max(Math.ceil(selectedUserChangeEntries.length / USER_DETAIL_LOG_PAGE_SIZE), 1);
    const safeUserChangeLogsPage = Math.min(userChangeLogsPage, userChangeLogsPageCount);
    const pagedUserChangeEntries = useMemo(() => {
        const start = (safeUserChangeLogsPage - 1) * USER_DETAIL_LOG_PAGE_SIZE;
        return selectedUserChangeEntries.slice(start, start + USER_DETAIL_LOG_PAGE_SIZE);
    }, [selectedUserChangeEntries, safeUserChangeLogsPage]);

    const canOpenUserChangeFullDiffModal = (log: AdminUserChangeRecord): boolean => {
        if (hasSnapshotData(log.before_data) || hasSnapshotData(log.after_data)) return true;
        if (log.target_type !== 'trip' || !log.target_id) return false;
        const metadata = asRecord(log.metadata);
        return Boolean(asString(metadata.version_id));
    };

    const openUserChangeFullDiffModal = async (log: AdminUserChangeRecord) => {
        const metadata = asRecord(log.metadata);
        const versionId = asString(metadata.version_id);
        const previousVersionId = asString(metadata.previous_version_id);
        const ownerLabel = selectedUser?.email || selectedUser?.username || selectedUser?.user_id || log.owner_user_id;

        setDiffModalError(null);
        setDiffModalTitle(`${log.action} · user change`);
        setDiffModalDescription([
            `Owner: ${ownerLabel}`,
            log.target_type === 'trip' && log.target_id ? `Trip ID: ${log.target_id}` : null,
            versionId ? `Version: ${versionId}` : null,
        ].filter(Boolean).join(' • '));
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
            const snapshots = await adminGetTripVersionSnapshots({
                tripId: log.target_id,
                afterVersionId: versionId,
                beforeVersionId: previousVersionId,
            });
            if (!snapshots) {
                setDiffModalError('Trip snapshots were not found for this event. Showing event snapshots when available.');
                return;
            }
            setDiffModalBeforeValue(mergeTripSnapshotWithViewSettings(
                snapshots.before_snapshot,
                snapshots.before_view_settings
            ));
            setDiffModalAfterValue(mergeTripSnapshotWithViewSettings(
                snapshots.after_snapshot,
                snapshots.after_view_settings
            ));
            setDiffModalBeforeLabel(snapshots.before_label || 'Before version');
            setDiffModalAfterLabel(snapshots.after_label || 'After version');
        } catch (error) {
            setDiffModalError(toAdminErrorMessage(error, 'Could not load trip snapshots.', 'admin-users'));
        } finally {
            setIsDiffModalLoading(false);
        }
    };

    const loadUsers = async (options: { preserveErrorMessage?: boolean } = {}) => {
        setIsLoadingUsers(true);
        setDataSourceNotice(null);
        if (!options.preserveErrorMessage) {
            setErrorMessage(null);
        }
        try {
            const rows = await adminListUsers({ limit: 500 });
            setUsers(rows);
            writeAdminCache(USERS_CACHE_KEY, rows);
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not load users.', 'admin-users');
            if (!options.preserveErrorMessage) {
                setErrorMessage(reason);
            }
            const cachedRows = readAdminCache<AdminUserRecord[]>(USERS_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setUsers(cachedRows);
                setDataSourceNotice(`Showing ${cachedRows.length} cached user${cachedRows.length === 1 ? '' : 's'} from this browser because the live list could not load.`);
            } else {
                setUsers([]);
            }
        } finally {
            setIsLoadingUsers(false);
        }
    };

    // Initial fetch of the user list.
    useEffect(() => {
        void loadUsers();
    }, []);

    // Loads the full profile, trips and change log for the account in the inspector.
    useEffect(() => {
        if (!selectedUser) return;
        let active = true;

        setTierDraft(selectedUser.tier_key);
        setOverrideDraft(formatOverrideDraft(selectedUser.entitlements_override));
        setProfileDraft({
            firstName: selectedUser.first_name || '',
            lastName: selectedUser.last_name || '',
            username: selectedUser.username_display || selectedUser.username || '',
            gender: toProfileGenderDraft(selectedUser.gender),
            country: selectedUser.country || '',
            city: selectedUser.city || '',
            preferredLanguage: selectedUser.preferred_language || 'en',
            accountStatus: selectedUser.account_status || 'active',
            role: selectedUser.system_role,
        });

        void adminGetUserProfile(selectedUser.user_id)
            .then((fullProfile) => {
                if (!active || !fullProfile) return;
                setTierDraft(fullProfile.tier_key);
                setOverrideDraft(formatOverrideDraft(fullProfile.entitlements_override));
                setProfileDraft({
                    firstName: fullProfile.first_name || '',
                    lastName: fullProfile.last_name || '',
                    username: fullProfile.username_display || fullProfile.username || '',
                    gender: toProfileGenderDraft(fullProfile.gender),
                    country: fullProfile.country || '',
                    city: fullProfile.city || '',
                    preferredLanguage: fullProfile.preferred_language || 'en',
                    accountStatus: fullProfile.account_status || 'active',
                    role: fullProfile.system_role,
                });
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(toAdminErrorMessage(error, 'Could not load the full user profile.', 'admin-users'));
            });

        setUserTrips([]);
        setIsLoadingTrips(true);
        setUserChangeLogs([]);
        setIsLoadingUserChangeLogs(true);
        setUserChangeLogsError(null);
        void adminListUserTrips(selectedUser.user_id)
            .then((rows) => {
                if (!active) return;
                setUserTrips(rows);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(toAdminErrorMessage(error, 'Could not load user trips.', 'admin-users'));
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingTrips(false);
            });

        void adminListUserChangeLogs({ ownerUserId: selectedUser.user_id, limit: USER_CHANGE_LOG_DRAWER_LIMIT })
            .then((rows) => {
                if (!active) return;
                setUserChangeLogs(rows);
            })
            .catch((error) => {
                if (!active) return;
                setUserChangeLogsError(toAdminErrorMessage(error, 'Could not load the change log.', 'admin-users'));
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingUserChangeLogs(false);
            });

        return () => {
            active = false;
        };
    }, [selectedUser]);

    const usersInDateRange = useMemo<AdminUserRecord[]>(
        () => users.filter((user) => isIsoDateInRange(user.created_at, dateRange)),
        [dateRange, users]
    );

    const filteredUsers = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        const filtered: AdminUserRecord[] = usersInDateRange.filter((user) => {
            const accountStatus = getUserAccountStatus(user);
            const activationStatus = resolveActivationStatus(user);
            const subscriptionStatus = resolveUserSubscriptionStatus(user);
            const loginProfile = resolveUserLoginProfile(user);
            if (roleFilters.length > 0 && !roleFilters.includes(user.system_role)) return false;
            if (tierFilters.length > 0 && !tierFilters.includes(user.tier_key)) return false;
            if (subscriptionFilters.length > 0 && !subscriptionFilters.includes(subscriptionStatus)) return false;
            if (statusFilters.length > 0 && !statusFilters.includes(accountStatus)) return false;
            if (activationFilters.length > 0 && !activationFilters.includes(activationStatus)) return false;
            if (loginTypeFilters.length > 0) {
                let loginMatches = false;
                if (loginTypeFilters.includes('password') && loginProfile.hasPassword) {
                    loginMatches = true;
                }
                if (loginTypeFilters.includes('unknown') && loginProfile.isUnknown) {
                    loginMatches = true;
                }
                if (loginTypeFilters.includes('social') && loginProfile.socialProviders.length > 0) {
                    if (socialProviderFilters.length === 0) {
                        loginMatches = true;
                    } else if (loginProfile.socialProviders.some((provider) => socialProviderFilters.includes(provider))) {
                        loginMatches = true;
                    }
                }
                if (!loginMatches) return false;
            }
            if (tripFilters.length > 0 && !tripFilters.some((tripFilter) => matchesUserTripFilter(user, tripFilter))) {
                return false;
            }
            const termsState = resolveUserTermsState(user, currentTermsVersion);
            if (termsFilters.length > 0 && !termsFilters.includes(termsState)) return false;
            if (!token) return true;
            return (
                getUserDisplayName(user).toLowerCase().includes(token)
                || (user.email || '').toLowerCase().includes(token)
                || user.user_id.toLowerCase().includes(token)
                || getLoginSearchText(user).includes(token)
                || (user.username || '').toLowerCase().includes(token)
                || getActivationStatusLabel(activationStatus).toLowerCase().includes(token)
                || getUserSubscriptionStatusLabel(subscriptionStatus).toLowerCase().includes(token)
                || (user.provider_subscription_id || '').toLowerCase().includes(token)
                || getUserTermsStateLabel(termsState).toLowerCase().includes(token)
            );
        });

        const getSortValue = (user: AdminUserRecord): string | number => {
            if (sortKey === 'name') return getUserDisplayName(user).toLowerCase();
            if (sortKey === 'email') return (user.email || '').toLowerCase();
            if (sortKey === 'total_trips') return getUserTotalTrips(user);
            if (sortKey === 'activation_status') return resolveActivationStatus(user);
            if (sortKey === 'last_sign_in_at') return Date.parse(user.last_sign_in_at || '') || 0;
            if (sortKey === 'updated_at') return Date.parse(user.updated_at || '') || 0;
            if (sortKey === 'created_at') return Date.parse(user.created_at || '') || 0;
            if (sortKey === 'tier_key') return PLAN_ORDER.indexOf(user.tier_key);
            if (sortKey === 'subscription_status') return resolveUserSubscriptionStatus(user);
            if (sortKey === 'system_role') return String(user.system_role || '').toLowerCase();
            if (sortKey === 'terms_accepted_version') {
                const stateRank = getUserTermsSortRank(resolveUserTermsState(user, currentTermsVersion));
                const acceptedAt = Date.parse(user.terms_accepted_at || '') || 0;
                return stateRank * 10_000_000_000_000 + acceptedAt;
            }
            // Status: accounts that need attention (deleted, suspended, not activated) sort first.
            return resolveUserLifecycleStatus(user).rank;
        };

        const sorted = Array.from(filtered).sort((a, b) => {
            const left = getSortValue(a);
            const right = getSortValue(b);
            let base = 0;
            if (typeof left === 'number' && typeof right === 'number') {
                base = left === right ? 0 : left > right ? 1 : -1;
            } else {
                const normalizedLeft = String(left);
                const normalizedRight = String(right);
                base = normalizedLeft === normalizedRight ? 0 : normalizedLeft > normalizedRight ? 1 : -1;
            }
            return sortDirection === 'asc' ? base : -base;
        });
        return sorted;
    }, [
        activationFilters,
        currentTermsVersion,
        loginTypeFilters,
        roleFilters,
        searchValue,
        socialProviderFilters,
        sortDirection,
        sortKey,
        statusFilters,
        subscriptionFilters,
        tierFilters,
        termsFilters,
        tripFilters,
        usersInDateRange,
    ]);

    const handleExportUsersCsv = () => {
        if (filteredUsers.length === 0) return;
        trackEvent('admin__users--export_csv', { rows: filteredUsers.length });

        const header = buildCsvLine([
            'email',
            'user_id',
            'tier',
            'subscription_status',
            'provider_status',
            'provider_subscription_id',
            'canceled_at',
            'grace_ends_at',
            'downgrade_at',
            'current_period_end',
        ]);
        const rows = filteredUsers.map((user) => buildCsvLine([
            user.email || '',
            user.user_id,
            getPlanName(user.tier_key),
            getUserSubscriptionStatusLabel(resolveUserSubscriptionStatus(user)),
            user.provider_status || user.subscription_status || '',
            user.provider_subscription_id || '',
            user.canceled_at || '',
            user.grace_ends_at || '',
            resolveUserSubscriptionDowngradeAt(user) || '',
            user.current_period_end || '',
        ]));
        const payload = [header, ...rows].join('\n');
        const fileName = `admin-users-billing-${sanitizeFilenameSegment(new Date().toISOString().slice(0, 10))}.csv`;
        downloadBlob(new Blob([payload], { type: 'text/csv;charset=utf-8' }), fileName);
        notifySuccess(`Exported ${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'}`, 'Billing columns for the users the table shows.');
    };

    const queueCounts = useMemo(() => countUserQueues(usersInDateRange), [usersInDateRange]);
    const hasNonQueueFilters = roleFilters.length > 0
        || tierFilters.length > 0
        || statusFilters.length > 0
        || loginTypeFilters.length > 0
        || termsFilters.length > 0;
    const appliedQueue = resolveAppliedUserQueue(
        { activation: activationFilters, subscription: subscriptionFilters, trips: tripFilters },
        hasNonQueueFilters
    );
    const hasActiveFilters = hasNonQueueFilters
        || activationFilters.length > 0
        || subscriptionFilters.length > 0
        || tripFilters.length > 0;
    const hasActiveMoreFilters = subscriptionFilters.length > 0 || roleFilters.length > 0 || termsFilters.length > 0;
    const showMoreFilters = isMoreFiltersOpen || hasActiveMoreFilters;

    const statusFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_STATUS_VALUES.map((value) => ({
            value,
            label: formatAccountStatusLabel(value),
            count: usersInDateRange.filter((user) => getUserAccountStatus(user) === value).length,
        })),
        [usersInDateRange]
    );

    const roleFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_ROLE_VALUES.map((value) => ({
            value,
            label: value === 'admin' ? 'Admin' : 'User',
            count: usersInDateRange.filter((user) => user.system_role === value).length,
        })),
        [usersInDateRange]
    );

    const tierFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => PLAN_ORDER.map((value) => ({
            value,
            label: getPlanName(value),
            count: usersInDateRange.filter((user) => user.tier_key === value).length,
        })),
        [usersInDateRange]
    );

    const subscriptionFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_SUBSCRIPTION_VALUES.map((value) => ({
            value,
            label: getUserSubscriptionStatusLabel(value),
            count: usersInDateRange.filter((user) => resolveUserSubscriptionStatus(user) === value).length,
        })),
        [usersInDateRange]
    );

    const activationFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_ACTIVATION_VALUES.map((value) => ({
            value,
            label: getActivationStatusLabel(value),
            count: usersInDateRange.filter((user) => resolveActivationStatus(user) === value).length,
        })),
        [usersInDateRange]
    );
    const tripFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_TRIP_FILTER_VALUES.map((value) => ({
            value,
            label: USER_TRIP_FILTER_LABELS[value],
            count: usersInDateRange.filter((user) => matchesUserTripFilter(user, value)).length,
        })),
        [usersInDateRange]
    );
    const termsFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_TERMS_STATE_VALUES.map((value) => ({
            value,
            label: getUserTermsStateLabel(value),
            count: usersInDateRange.filter((user) => resolveUserTermsState(user, currentTermsVersion) === value).length,
        })),
        [currentTermsVersion, usersInDateRange]
    );
    const visibleUserColumnOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_VISIBLE_COLUMN_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
        })),
        []
    );

    const loginFilterCounts = useMemo<LoginFilterCounts>(() => {
        const socialProviders: Record<SocialProviderFilter, number> = {
            google: 0,
            facebook: 0,
            kakao: 0,
            apple: 0,
            github: 0,
            discord: 0,
            other_social: 0,
        };
        let password = 0;
        let social = 0;
        let unknown = 0;
        usersInDateRange.forEach((user) => {
            const profile = resolveUserLoginProfile(user);
            if (profile.hasPassword) password += 1;
            if (profile.socialProviders.length > 0) {
                social += 1;
                profile.socialProviders.forEach((provider) => {
                    socialProviders[provider] += 1;
                });
            }
            if (profile.isUnknown) unknown += 1;
        });
        return {
            password,
            social,
            unknown,
            socialProviders,
        };
    }, [usersInDateRange]);

    const pageCount = Math.max(Math.ceil(filteredUsers.length / PAGE_SIZE), 1);
    const currentPage = Math.min(page, pageCount);
    const pagedUsers = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredUsers.slice(start, start + PAGE_SIZE);
    }, [filteredUsers, currentPage]);
    // Selection is kept as ids, but only rows the table shows and that can be
    // deleted count: a filter change hides a selection instead of acting on it.
    const selectedVisibleUsers = useMemo(
        () => filteredUsers.filter((user) => selectedUserIds.has(user.user_id) && isUserHardDeleteEligible(user)),
        [filteredUsers, selectedUserIds]
    );
    const hardDeleteSelectableVisibleUsers = useMemo(
        () => filteredUsers.filter((user) => isUserHardDeleteEligible(user)),
        [filteredUsers]
    );
    const areAllVisibleUsersSelected = hardDeleteSelectableVisibleUsers.length > 0
        && hardDeleteSelectableVisibleUsers.every((user) => selectedUserIds.has(user.user_id));
    const isVisibleUserSelectionPartial = selectedVisibleUsers.length > 0 && !areAllVisibleUsersSelected;
    const visibleUserColumnSet = useMemo(() => new Set<UserVisibleColumnId>(visibleColumns), [visibleColumns]);
    const isUserColumnVisible = (columnId: UserVisibleColumnId): boolean => visibleUserColumnSet.has(columnId);
    const hasStickyUserColumnPair = isUserColumnVisible('user');
    const usersTableColumnCount = visibleColumns.length + 2;

    // Mirrors table state into the URL so filters, sort, page and the open user survive reloads and can be shared.
    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (roleFilters.length > 0 && roleFilters.length < USER_ROLE_VALUES.length) next.set('role', roleFilters.join(','));
        if (tierFilters.length > 0 && tierFilters.length < PLAN_ORDER.length) next.set('tier', tierFilters.join(','));
        if (statusFilters.length > 0 && statusFilters.length < USER_STATUS_VALUES.length) next.set('status', statusFilters.join(','));
        if (activationFilters.length > 0 && activationFilters.length < USER_ACTIVATION_VALUES.length) next.set('activation', activationFilters.join(','));
        if (loginTypeFilters.length > 0 && loginTypeFilters.length < USER_LOGIN_TYPE_VALUES.length) {
            next.set('login', loginTypeFilters.join(','));
        }
        if (
            loginTypeFilters.includes('social')
            && socialProviderFilters.length > 0
            && socialProviderFilters.length < SOCIAL_PROVIDER_VALUES.length
        ) {
            next.set('social', socialProviderFilters.join(','));
        }
        if (tripFilters.length > 0 && tripFilters.length < USER_TRIP_FILTER_VALUES.length) {
            next.set('trips', tripFilters.join(','));
        }
        if (termsFilters.length > 0 && termsFilters.length < USER_TERMS_STATE_VALUES.length) {
            next.set('terms', termsFilters.join(','));
        }
        if (subscriptionFilters.length > 0 && subscriptionFilters.length < USER_SUBSCRIPTION_VALUES.length) {
            next.set('subscription', subscriptionFilters.join(','));
        }
        if (sortKey !== 'created_at') next.set('sort', sortKey);
        if (sortDirection !== 'desc') next.set('dir', sortDirection);
        if (currentPage > 1) next.set('page', String(currentPage));
        const hasCustomColumns = (
            visibleColumns.length !== DEFAULT_VISIBLE_USER_COLUMNS.length
            || visibleColumns.some((columnId, index) => columnId !== DEFAULT_VISIBLE_USER_COLUMNS[index])
        );
        if (hasCustomColumns) {
            next.set('cols', visibleColumns.join(','));
        }
        const drawerUserId = selectedUserId || deepLinkedUserId;
        if ((isDetailOpen || deepLinkedUserId) && drawerUserId) {
            next.set('user', drawerUserId);
            next.set('drawer', 'user');
        }
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        deepLinkedUserId,
        activationFilters,
        currentPage,
        dateRange,
        isDetailOpen,
        loginTypeFilters,
        roleFilters,
        searchParams,
        searchValue,
        selectedUserId,
        setSearchParams,
        sortDirection,
        sortKey,
        socialProviderFilters,
        statusFilters,
        subscriptionFilters,
        termsFilters,
        tierFilters,
        tripFilters,
        visibleColumns,
    ]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection('asc');
    };

    const isUserSortedColumn = (key: SortKey): boolean => sortKey === key;

    const toggleUserSelection = (userId: string, checked: boolean) => {
        setSelectedUserIds((current) => {
            const targetUser = filteredUsers.find((user) => user.user_id === userId);
            if (checked && targetUser && !isUserHardDeleteEligible(targetUser)) {
                return current;
            }
            const next = new Set(current);
            if (checked) next.add(userId);
            else next.delete(userId);
            return next;
        });
    };

    const toggleSelectAllVisibleUsers = (checked: boolean) => {
        setSelectedUserIds((current) => {
            const next = new Set(current);
            if (!checked) {
                hardDeleteSelectableVisibleUsers.forEach((user) => next.delete(user.user_id));
                return next;
            }
            hardDeleteSelectableVisibleUsers.forEach((user) => next.add(user.user_id));
            return next;
        });
    };

    const copyUserId = async (user: AdminUserRecord) => {
        trackEvent('admin__users_row--copy_id');
        const copied = await copyTextToClipboard(user.user_id);
        showAppToast(copied
            ? { tone: 'success', title: 'User ID copied', description: user.user_id }
            : { tone: 'warning', title: 'Could not copy', description: 'Your browser blocked clipboard access. Open the details to select the ID.' });
    };

    const saveSelectedUser = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        setErrorMessage(null);
        try {
            const parsedOverrides = parseOverrideDraft(overrideDraft);
            const currentOverrides = normalizeOverrideRecord(selectedUser.entitlements_override);
            const shouldUpdateOverrides = !areOverrideRecordsEqual(parsedOverrides, currentOverrides);
            await adminUpdateUserProfile(selectedUser.user_id, {
                firstName: profileDraft.firstName,
                lastName: profileDraft.lastName,
                username: profileDraft.username,
                gender: profileDraft.gender,
                country: profileDraft.country,
                city: profileDraft.city,
                preferredLanguage: profileDraft.preferredLanguage,
                accountStatus: profileDraft.accountStatus,
                systemRole: profileDraft.role,
                tierKey: tierDraft,
            });
            if (shouldUpdateOverrides) {
                await adminUpdateUserOverrides(selectedUser.user_id, parsedOverrides);
            }
            notifySuccess('User saved', `Changes to "${getUserDisplayName(selectedUser)}" are live.`);
            await loadUsers();
        } catch (error) {
            const fallback = error instanceof SyntaxError
                ? 'Entitlement overrides must be valid JSON.'
                : 'Could not save user.';
            setErrorMessage(toAdminErrorMessage(error, fallback, 'admin-users'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetUsernameCooldown = async () => {
        if (!selectedUser) return;
        const userName = getUserDisplayName(selectedUser);
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Revoking username cooldown',
            description: `Allowing "${userName}" to change username immediately.`,
        });
        try {
            await adminResetUserUsernameCooldown(selectedUser.user_id, 'admin.manual_reset');
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'success',
                title: 'Username cooldown revoked',
                description: `"${userName}" can now change username immediately.`,
            });
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not reset username cooldown.', 'admin-users');
            setErrorMessage(reason);
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Cooldown revoke failed',
                description: reason,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetTermsAcceptance = async () => {
        if (!selectedUser) return;
        const userName = getUserDisplayName(selectedUser);
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Resetting terms acceptance',
            description: `Clearing terms acceptance for "${userName}".`,
        });
        try {
            await adminResetUserTermsAcceptance(selectedUser.user_id, 'admin.testing.reset_terms');
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'success',
                title: 'Terms acceptance reset',
                description: `"${userName}" will be asked to accept the terms again.`,
            });
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not reset terms acceptance.', 'admin-users');
            setErrorMessage(reason);
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Terms reset failed',
                description: reason,
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSoftDelete = async (user: AdminUserRecord) => {
        const nextStatus = getUserAccountStatus(user) === 'deleted' ? 'active' : 'deleted';
        const userName = getUserDisplayName(user);
        const quotedUserName = `"${userName}"`;
        if (nextStatus === 'deleted') {
            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Soft delete user',
                message: buildSingleSoftDeleteMessage(userName),
                confirmLabel: 'Soft delete',
            }));
            if (!confirmed) return;
        }
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: nextStatus === 'deleted' ? 'Soft-deleting user' : 'Restoring user',
            description: nextStatus === 'deleted'
                ? `Applying soft-delete to ${quotedUserName}.`
                : `Restoring ${quotedUserName}.`,
        });
        try {
            await adminUpdateUserProfile(user.user_id, { accountStatus: nextStatus });
            await loadUsers();
            if (nextStatus === 'deleted') {
                showAppToast({
                    id: loadingToastId,
                    tone: 'remove',
                    title: 'User soft-deleted',
                    description: `${quotedUserName} was soft-deleted. The user can be restored and cannot sign in while deleted.`,
                    action: {
                        label: 'Undo',
                        onClick: () => {
                            void (async () => {
                                const undoLoadingToastId = showAppToast({
                                    tone: 'loading',
                                    title: 'Undo soft-delete',
                                    description: `Restoring ${quotedUserName}.`,
                                });
                                setIsSaving(true);
                                setErrorMessage(null);
                                try {
                                    await adminUpdateUserProfile(user.user_id, { accountStatus: 'active' });
                                    await loadUsers();
                                    showAppToast({
                                        id: undoLoadingToastId,
                                        tone: 'success',
                                        title: 'Soft-delete undone',
                                        description: `${quotedUserName} was restored and can sign in again.`,
                                    });
                                } catch (undoError) {
                                    const reason = toAdminErrorMessage(undoError, 'Could not restore user.', 'admin-users');
                                    showAppToast({
                                        id: undoLoadingToastId,
                                        tone: 'error',
                                        title: 'Undo failed',
                                        description: reason,
                                    });
                                    setErrorMessage(reason);
                                } finally {
                                    setIsSaving(false);
                                }
                            })();
                        },
                    },
                });
            } else {
                showAppToast({
                    id: loadingToastId,
                    tone: 'success',
                    title: 'User restored',
                    description: `${quotedUserName} was restored and can sign in again.`,
                });
            }
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not update user status.', 'admin-users');
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Update failed',
                description: reason,
            });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const handleHardDelete = async (user: AdminUserRecord) => {
        if (!isUserHardDeleteEligible(user)) {
            const reason = 'Hard delete is unavailable for soft-deleted users.';
            setErrorMessage(reason);
            showAppToast({
                tone: 'warning',
                title: 'Hard delete unavailable',
                description: reason,
            });
            return;
        }
        const userName = getUserDisplayName(user);
        const quotedUserName = `"${userName}"`;
        const sourceTripCount = selectedUser?.user_id === user.user_id
            ? selectedUserTripStats.total
            : getUserTotalTrips(user);
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete user',
            message: buildSingleHardDeleteMessage(userName, sourceTripCount),
            confirmLabel: 'Hard delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Hard-deleting user',
            description: `Permanently deleting ${quotedUserName}.`,
        });
        try {
            await adminHardDeleteUser(user.user_id);
            closeUserDetail();
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'remove',
                title: 'User hard-deleted',
                description: sourceTripCount > 0
                    ? `${quotedUserName} and ${sourceTripCount} owned trip${sourceTripCount === 1 ? '' : 's'} were permanently deleted.`
                    : `${quotedUserName} was permanently deleted.`,
            });
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not hard-delete user.', 'admin-users');
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Hard delete failed',
                description: reason,
            });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkSoftDeleteUsers = async () => {
        if (selectedVisibleUsers.length === 0) return;
        const isSingleSelection = selectedVisibleUsers.length === 1;
        const selectedSingleUser = isSingleSelection ? selectedVisibleUsers[0] : null;
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Soft delete selected users',
            message: selectedSingleUser
                ? buildSingleSoftDeleteMessage(getUserDisplayName(selectedSingleUser))
                : `Soft-delete ${selectedVisibleUsers.length} selected users?\n\nSoft delete can be reverted later and prevents sign-in while deleted.`,
            confirmLabel: 'Soft delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Soft-deleting users',
            description: `Applying soft-delete to ${selectedVisibleUsers.length} selected user${selectedVisibleUsers.length === 1 ? '' : 's'}.`,
        });
        try {
            await Promise.all(selectedVisibleUsers.map((user) => adminUpdateUserProfile(user.user_id, { accountStatus: 'deleted' })));
            setSelectedUserIds(new Set());
            await loadUsers();
            showAppToast({
                id: loadingToastId,
                tone: 'remove',
                title: 'Users soft-deleted',
                description: `${selectedVisibleUsers.length} user${selectedVisibleUsers.length === 1 ? '' : 's'} were soft-deleted successfully.`,
            });
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not soft-delete selected users.', 'admin-users');
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Soft delete failed',
                description: reason,
            });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkHardDeleteUsers = async () => {
        if (selectedVisibleUsers.length === 0) return;
        const hardDeleteUsers = selectedVisibleUsers.filter((user) => isUserHardDeleteEligible(user));
        if (hardDeleteUsers.length === 0) {
            const reason = 'No eligible users selected for hard delete. Soft-deleted users are skipped.';
            setErrorMessage(reason);
            showAppToast({
                tone: 'warning',
                title: 'Hard delete unavailable',
                description: reason,
            });
            return;
        }
        const selectedTripCount = hardDeleteUsers.reduce((sum, user) => sum + getUserTotalTrips(user), 0);
        const isSingleSelection = hardDeleteUsers.length === 1;
        const selectedSingleUser = isSingleSelection ? hardDeleteUsers[0] : null;
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete selected users',
            message: selectedSingleUser
                ? buildSingleHardDeleteMessage(getUserDisplayName(selectedSingleUser), selectedTripCount)
                : buildBulkHardDeleteMessage(hardDeleteUsers.length, selectedTripCount),
            confirmLabel: 'Hard delete',
        }));
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Hard-deleting users',
            description: `Permanently deleting ${hardDeleteUsers.length} selected user${hardDeleteUsers.length === 1 ? '' : 's'}.`,
        });
        try {
            const results = await Promise.allSettled(hardDeleteUsers.map((user) => adminHardDeleteUser(user.user_id)));
            const failedIndexes: number[] = [];
            const failedDetails: string[] = [];
            const deletedIds = new Set<string>();
            let bulkErrorMessage: string | null = null;

            results.forEach((result, index) => {
                const user = hardDeleteUsers[index];
                if (result.status === 'fulfilled') {
                    deletedIds.add(user.user_id);
                    return;
                }
                failedIndexes.push(index);
                const reason = getUnknownErrorMessage(result.reason, 'Unknown delete error.');
                failedDetails.push(`${getUserReferenceText(user)}: ${reason}`);
            });

            const failed = failedIndexes.length;
            const deleted = results.length - failed;
            const deletedTripCount = hardDeleteUsers
                .filter((_, index) => results[index]?.status === 'fulfilled')
                .reduce((sum, user) => sum + getUserTotalTrips(user), 0);
            if (failed > 0) {
                const detailSummary = summarizeBulkDeleteFailures(failedDetails);
                if (deleted === 0) {
                    bulkErrorMessage = (
                        detailSummary
                            ? `Could not hard-delete selected users.\n${detailSummary}`
                            : 'Could not hard-delete selected users.'
                    );
                } else {
                    bulkErrorMessage = (
                        detailSummary
                            ? `${failed} user${failed === 1 ? '' : 's'} failed to hard-delete.\n${detailSummary}`
                            : `${failed} user${failed === 1 ? '' : 's'} failed to hard-delete.`
                    );
                }
            }
            if (failed > 0) {
                setSelectedUserIds(new Set(failedIndexes.map((index) => hardDeleteUsers[index].user_id)));
            } else {
                setSelectedUserIds(new Set());
            }
            if (selectedUserId && deletedIds.has(selectedUserId)) {
                closeUserDetail();
            }
            await loadUsers({ preserveErrorMessage: Boolean(bulkErrorMessage) });
            if (bulkErrorMessage) {
                setErrorMessage(bulkErrorMessage);
                showAppToast({
                    id: loadingToastId,
                    tone: deleted > 0 ? 'warning' : 'error',
                    title: deleted > 0 ? 'Some users were not deleted' : 'Hard delete failed',
                    description: deleted > 0
                        ? `${deleted} user${deleted === 1 ? '' : 's'} were deleted, but ${failed} failed. The failed accounts stay selected; details are above the table.`
                        : bulkErrorMessage,
                });
            } else {
                showAppToast({
                    id: loadingToastId,
                    tone: 'remove',
                    title: 'Users hard-deleted',
                    description: `${deleted} user${deleted === 1 ? '' : 's'} and ${deletedTripCount} owned trip${deletedTripCount === 1 ? '' : 's'} were permanently deleted.`,
                });
            }
        } catch (error) {
            const reason = toAdminErrorMessage(error, 'Could not hard-delete selected users.', 'admin-users');
            showAppToast({
                id: loadingToastId,
                tone: 'error',
                title: 'Hard delete failed',
                description: reason,
            });
            setErrorMessage(reason);
        } finally {
            setIsSaving(false);
        }
    };

    const resolveTransferTargetUser = async (rawInput: string): Promise<AdminUserRecord> => {
        const normalizedInput = rawInput.trim();
        if (!normalizedInput) {
            throw new Error('Enter a target user email or UUID.');
        }
        const normalizedLower = normalizedInput.toLowerCase();

        const localMatches = users.filter((candidate) => {
            const candidateEmail = (candidate.email || '').trim().toLowerCase();
            if (candidate.user_id.toLowerCase() === normalizedLower) return true;
            if (candidateEmail && candidateEmail === normalizedLower) return true;
            return false;
        });

        if (localMatches.length > 1) {
            throw new Error('Multiple local users matched that target. Enter a UUID instead.');
        }
        if (localMatches.length === 1) {
            return localMatches[0];
        }

        if (isLikelyUserId(normalizedInput)) {
            const profile = await adminGetUserProfile(normalizedInput);
            if (profile) return profile;
        }

        if (isLikelyEmail(normalizedInput)) {
            const rows = await adminListUsers({ search: normalizedInput, limit: 20 });
            const exactMatches = rows.filter((candidate) => (candidate.email || '').trim().toLowerCase() === normalizedLower);
            if (exactMatches.length > 1) {
                throw new Error('Multiple users found for that email. Enter a UUID instead.');
            }
            if (exactMatches.length === 1) {
                return exactMatches[0];
            }
        }

        throw new Error('Target user not found. Enter an existing user email or UUID.');
    };

    const handleTransferTripsAndHardDelete = async (user: AdminUserRecord) => {
        const knownTripCount = selectedUser?.user_id === user.user_id
            ? selectedUserTripStats.total
            : getUserTotalTrips(user);
        if (knownTripCount <= 0) {
            setErrorMessage('No owned trips found to transfer.');
            return;
        }

        const transferTargetInput = await promptDialog(buildTransferTargetPromptDialog({
            title: 'Transfer trips before hard delete',
            message: 'Enter the target user email or UUID. All owned trips will move to this account before hard delete.',
            confirmLabel: 'Continue',
        }));
        if (transferTargetInput === null) return;

        setIsSaving(true);
        setErrorMessage(null);
        try {
            const targetUser = await resolveTransferTargetUser(transferTargetInput);
            if (targetUser.user_id === user.user_id) {
                throw new Error('Target user must be different from the user being deleted.');
            }

            if (getUserAccountStatus(targetUser) !== 'active') {
                throw new Error('Target user must be an active account.');
            }

            const sourceTrips = await adminListUserTrips(user.user_id, { status: 'all' });
            if (sourceTrips.length === 0) {
                throw new Error('No owned trips found to transfer. Reload and try again.');
            }

            const confirmed = await confirmDialog(buildDangerConfirmDialog({
                title: 'Confirm transfer and hard delete',
                message: buildTransferAndHardDeleteMessage(
                    getUserReferenceText(user),
                    getUserReferenceText(targetUser),
                    sourceTrips.length
                ),
                confirmLabel: 'Transfer + hard delete',
            }));
            if (!confirmed) return;

            const transferResults = await Promise.allSettled(
                sourceTrips.map((trip) => adminUpdateTrip(trip.trip_id, { ownerId: targetUser.user_id }))
            );
            const failedTransfers = transferResults.filter((result) => result.status === 'rejected');
            if (failedTransfers.length > 0) {
                const transferredCount = sourceTrips.length - failedTransfers.length;
                throw new Error(
                    transferredCount > 0
                        ? `Transferred ${transferredCount}/${sourceTrips.length} trips. Hard delete was skipped because some transfers failed.`
                        : 'Trip transfer failed. Hard delete was skipped.'
                );
            }

            try {
                await adminHardDeleteUser(user.user_id);
                closeUserDetail();
                await loadUsers();
                notifySuccess(
                    'Trips transferred, user deleted',
                    `Moved ${sourceTrips.length} trip${sourceTrips.length === 1 ? '' : 's'} to ${getUserReferenceText(targetUser)} and permanently deleted the source user. The audit log shows ${sourceTrips.length} "Transferred trip owner" entr${sourceTrips.length === 1 ? 'y' : 'ies'} and one "Hard-deleted user" entry.`
                );
            } catch (deleteError) {
                await loadUsers();
                const deleteMessage = toAdminErrorMessage(deleteError, 'Could not hard-delete user after transfer.', 'admin-users');
                setErrorMessage(
                    `Trips were transferred to ${getUserReferenceText(targetUser)}, but hard delete failed: ${deleteMessage} Retry hard delete for the source user if needed.`
                );
            }
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not transfer trips before hard delete.', 'admin-users'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleTripPatch = async (
        trip: AdminTripRecord,
        patch: { status?: 'active' | 'archived' | 'expired'; tripExpiresAt?: string | null }
    ) => {
        setIsSaving(true);
        setErrorMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, patch);
            notifySuccess('Trip updated', trip.title || trip.trip_id);
            if (selectedUser) {
                const rows = await adminListUserTrips(selectedUser.user_id);
                setUserTrips(rows);
            }
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not update trip.', 'admin-users'));
        } finally {
            setIsSaving(false);
        }
    };

    const openCreateDialog = () => {
        trackEvent('admin__users--create_user');
        setCreateError(null);
        setIsCreateDialogOpen(true);
    };

    const submitCreateUser = async () => {
        if (createMode === 'direct' && createDraft.password.trim().length < 8) {
            setCreateError('The initial password needs at least 8 characters.');
            return;
        }
        setIsSaving(true);
        setCreateError(null);
        try {
            if (createMode === 'invite') {
                await adminCreateUserInvite({
                    email: createDraft.email,
                    firstName: createDraft.firstName,
                    lastName: createDraft.lastName,
                    tierKey: createDraft.tierKey,
                    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined,
                });
            } else {
                await adminCreateUserDirect(createDraft);
            }
            setCreateDraft(INITIAL_CREATE_DRAFT);
            setIsCreateDialogOpen(false);
            notifySuccess(createMode === 'invite' ? 'Invite sent' : 'User created', createDraft.email.trim());
            await loadUsers();
        } catch (error) {
            setCreateError(toAdminErrorMessage(
                error,
                createMode === 'invite' ? 'Could not invite user.' : 'Could not create user.',
                'admin-users'
            ));
        } finally {
            setIsSaving(false);
        }
    };

    const resetTableFilters = () => {
        setRoleFilters([]);
        setTierFilters([]);
        setStatusFilters([]);
        setActivationFilters([]);
        setLoginTypeFilters([]);
        setSocialProviderFilters([]);
        setTripFilters([]);
        setTermsFilters([]);
        setSubscriptionFilters([]);
        setPage(1);
    };

    const applyUserQueue = (queueId: UserQueueId) => {
        trackEvent(USER_QUEUE_EVENTS[queueId], { active: appliedQueue !== queueId });
        const wasApplied = appliedQueue === queueId;
        resetTableFilters();
        if (wasApplied) return;
        const filters = USER_QUEUE_FILTERS[queueId];
        setActivationFilters(filters.activation);
        setSubscriptionFilters(filters.subscription);
        setTripFilters(filters.trips);
    };

    const withPageReset = <T,>(setter: (next: T) => void) => (next: T) => {
        setter(next);
        setPage(1);
    };

    const isSelectedUserDeleted = selectedUser ? getUserAccountStatus(selectedUser) === 'deleted' : false;
    const selectedUserLifecycle = selectedUser ? resolveUserLifecycleStatus(selectedUser) : null;
    const selectedUserSubscriptionStatus = selectedUser ? resolveUserSubscriptionStatus(selectedUser) : null;
    const selectedUserTermsState = selectedUser ? resolveUserTermsState(selectedUser, currentTermsVersion) : null;

    return (
        <AdminShell
            title="Users"
            description="Find an account, check its state and fix its profile, plan or access."
            searchValue={searchValue}
            onSearchValueChange={(value) => {
                setSearchValue(value);
                setPage(1);
            }}
            dateRange={dateRange}
            onDateRangeChange={(next) => {
                setDateRange(next);
                setPage(1);
            }}
            actions={(
                <>
                    <AdminReloadButton
                        onClick={() => void loadUsers()}
                        isLoading={isLoadingUsers}
                        label="Reload"
                    />
                    <Button
                        type="button"
                        onClick={openCreateDialog}
                        {...getAnalyticsDebugAttributes('admin__users--create_user')}
                    >
                        <UserPlus />
                        Create user
                    </Button>
                </>
            )}
        >
            <div className="flex flex-col gap-4">
                {errorMessage && <AdminErrorAlert message={errorMessage} />}
                {dataSourceNotice && (
                    <Alert variant="warning">
                        <WarningCircle weight="fill" />
                        <AlertDescription>{dataSourceNotice}</AlertDescription>
                    </Alert>
                )}

                <section aria-label="Accounts that need attention" className="grid gap-4 sm:grid-cols-3">
                    {USER_QUEUE_IDS.map((queueId) => {
                        const copy = USER_QUEUE_COPY[queueId];
                        const count = queueCounts[queueId];
                        const isApplied = appliedQueue === queueId;
                        return (
                            <AdminStatCard
                                key={queueId}
                                label={copy.label}
                                icon={copy.icon}
                                value={count.toLocaleString()}
                                isLoading={isLoadingUsers}
                                className={cn(isApplied && 'border-primary')}
                                hint={(
                                    <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                        <span className={cn(copy.attention && count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
                                            {copy.description}
                                        </span>
                                        {(count > 0 || isApplied) && (
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="xs"
                                                className="h-auto p-0"
                                                aria-pressed={isApplied}
                                                onClick={() => applyUserQueue(queueId)}
                                                {...getAnalyticsDebugAttributes(USER_QUEUE_EVENTS[queueId])}
                                            >
                                                {isApplied ? 'Clear filter' : 'Show in table'}
                                            </Button>
                                        )}
                                    </span>
                                )}
                            />
                        );
                    })}
                </section>

                <AdminSurfaceCard
                    className={cn('relative flex flex-col gap-3', isSaving && 'pointer-events-none')}
                    aria-busy={isSaving}
                >
                    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filter users">
                        <AdminFilterMenu
                            label="Status"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={withPageReset((next: string[]) => setStatusFilters(next as UserAccountStatus[]))}
                        />
                        <AdminFilterMenu
                            label="Activation"
                            options={activationFilterOptions}
                            selectedValues={activationFilters}
                            onSelectedValuesChange={withPageReset((next: string[]) => setActivationFilters(next as UserActivationStatus[]))}
                        />
                        <AdminFilterMenu
                            label="Plan"
                            options={tierFilterOptions}
                            selectedValues={tierFilters}
                            onSelectedValuesChange={withPageReset((next: string[]) => setTierFilters(next as PlanTierKey[]))}
                        />
                        <LoginTypeFilterMenu
                            selectedLoginTypes={loginTypeFilters}
                            selectedSocialProviders={socialProviderFilters}
                            counts={loginFilterCounts}
                            onSelectedLoginTypesChange={withPageReset(setLoginTypeFilters)}
                            onSelectedSocialProvidersChange={withPageReset(setSocialProviderFilters)}
                        />
                        <AdminFilterMenu
                            label="Trips"
                            options={tripFilterOptions}
                            selectedValues={tripFilters}
                            onSelectedValuesChange={withPageReset((next: string[]) => setTripFilters(next as UserTripFilter[]))}
                        />
                        {showMoreFilters ? (
                            <>
                                <AdminFilterMenu
                                    label="Subscription"
                                    options={subscriptionFilterOptions}
                                    selectedValues={subscriptionFilters}
                                    onSelectedValuesChange={withPageReset((next: string[]) => setSubscriptionFilters(next as UserSubscriptionStatus[]))}
                                />
                                <AdminFilterMenu
                                    label="Role"
                                    options={roleFilterOptions}
                                    selectedValues={roleFilters}
                                    onSelectedValuesChange={withPageReset((next: string[]) => setRoleFilters(next as Array<'admin' | 'user'>))}
                                />
                                <AdminFilterMenu
                                    label="Terms"
                                    options={termsFilterOptions}
                                    selectedValues={termsFilters}
                                    onSelectedValuesChange={withPageReset((next: string[]) => setTermsFilters(next as UserTermsState[]))}
                                />
                            </>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                    trackEvent('admin__users--more_filters');
                                    setIsMoreFiltersOpen(true);
                                }}
                                {...getAnalyticsDebugAttributes('admin__users--more_filters')}
                            >
                                More filters
                                <CaretDown />
                            </Button>
                        )}
                        {hasActiveFilters && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                    trackEvent('admin__users--reset_filters');
                                    resetTableFilters();
                                }}
                                {...getAnalyticsDebugAttributes('admin__users--reset_filters')}
                            >
                                <X />
                                Reset
                            </Button>
                        )}
                        <div className="ms-auto flex items-center gap-2">
                            <AdminFilterMenu
                                label="Columns"
                                options={visibleUserColumnOptions}
                                selectedValues={visibleColumns}
                                showBulkActions={false}
                                onSelectedValuesChange={(next) => {
                                    setVisibleColumns(sanitizeUserVisibleColumns(next));
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={handleExportUsersCsv}
                                disabled={filteredUsers.length === 0}
                                data-tooltip="Billing columns for the users shown"
                                {...getAnalyticsDebugAttributes('admin__users--export_csv')}
                            >
                                <DownloadSimple />
                                Export CSV
                            </Button>
                        </div>
                    </div>

                    <div ref={usersTableScrollRef} className="overflow-hidden rounded-md border border-border">
                        <Table>
                            <TableHeader className="bg-secondary">
                                <TableRow>
                                    <TableHead
                                        className={`sticky start-0 z-40 w-[44px] min-w-[44px] max-w-[44px] px-3 ${getAdminStickyHeaderCellClass({
                                            isScrolled: isUsersTableScrolledHorizontally,
                                            isFirst: hasStickyUserColumnPair,
                                        })}`}
                                        style={{ width: 44, minWidth: 44, maxWidth: 44 }}
                                    >
                                        <Checkbox
                                            checked={areAllVisibleUsersSelected ? true : (isVisibleUserSelectionPartial ? 'indeterminate' : false)}
                                            onCheckedChange={(checked) => toggleSelectAllVisibleUsers(Boolean(checked))}
                                            disabled={hardDeleteSelectableVisibleUsers.length === 0}
                                            aria-label={`Select all ${hardDeleteSelectableVisibleUsers.length} matching users`}
                                        />
                                    </TableHead>
                                    {isUserColumnVisible('user') && (
                                        <TableHead
                                            className={`sticky start-[44px] z-30 w-[280px] min-w-[240px] max-w-[280px] overflow-hidden px-3 text-start ${getAdminStickyHeaderCellClass({
                                                isScrolled: isUsersTableScrolledHorizontally,
                                                isFirst: false,
                                                isSorted: isUserSortedColumn('name'),
                                            })}`}
                                        >
                                            <AdminSortHeaderButton
                                                label="User"
                                                isActive={isUserSortedColumn('name')}
                                                direction={sortDirection}
                                                onClick={() => toggleSort('name')}
                                            />
                                        </TableHead>
                                    )}
                                    {([
                                        ['status', 'Status', 'account_status'],
                                        ['login', 'Sign-in', 'email'],
                                        ['tier', 'Plan', 'tier_key'],
                                        ['subscription', 'Subscription', 'subscription_status'],
                                        ['trips', 'Trips', 'total_trips'],
                                        ['activation', 'Activation', 'activation_status'],
                                        ['role', 'Role', 'system_role'],
                                        ['toc', 'Terms', 'terms_accepted_version'],
                                        ['last_visit', 'Last sign-in', 'last_sign_in_at'],
                                        ['last_log', 'Last updated', 'updated_at'],
                                        ['created', 'Created', 'created_at'],
                                    ] as Array<[UserVisibleColumnId, string, SortKey]>).map(([columnId, label, key]) => (
                                        isUserColumnVisible(columnId) ? (
                                            <TableHead
                                                key={columnId}
                                                className={cn('px-3 text-start', isUserSortedColumn(key) && ADMIN_TABLE_SORTED_HEADER_CLASS)}
                                            >
                                                <AdminSortHeaderButton
                                                    label={label}
                                                    isActive={isUserSortedColumn(key)}
                                                    direction={sortDirection}
                                                    onClick={() => toggleSort(key)}
                                                />
                                            </TableHead>
                                        ) : null
                                    ))}
                                    <TableHead className="w-[52px] px-3 text-end">
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagedUsers.map((user) => {
                                    const userName = getUserDisplayName(user);
                                    const accountStatus = getUserAccountStatus(user);
                                    const activationStatus = resolveActivationStatus(user);
                                    const lifecycle = resolveUserLifecycleStatus(user);
                                    const subscriptionStatus = resolveUserSubscriptionStatus(user);
                                    const isSelected = selectedUserIds.has(user.user_id);
                                    const isHardDeleteEligible = isUserHardDeleteEligible(user);
                                    const termsState = resolveUserTermsState(user, currentTermsVersion);
                                    const sortedCell = (key: SortKey) => cn('px-3 py-2.5', isUserSortedColumn(key) && ADMIN_TABLE_SORTED_CELL_CLASS);
                                    return (
                                        <TableRow
                                            key={user.user_id}
                                            className={ADMIN_TABLE_ROW_SURFACE_CLASS}
                                            data-state={isSelected ? 'selected' : undefined}
                                        >
                                            <TableCell
                                                className={`sticky start-0 z-40 w-[44px] min-w-[44px] max-w-[44px] px-3 py-2.5 ${getAdminStickyBodyCellClass({
                                                    isSelected,
                                                    isScrolled: isUsersTableScrolledHorizontally,
                                                    isFirst: hasStickyUserColumnPair,
                                                })}`}
                                                style={{ width: 44, minWidth: 44, maxWidth: 44 }}
                                            >
                                                <Checkbox
                                                    checked={isSelected && isHardDeleteEligible}
                                                    disabled={!isHardDeleteEligible}
                                                    onCheckedChange={(checked) => toggleUserSelection(user.user_id, Boolean(checked))}
                                                    aria-label={isHardDeleteEligible ? `Select ${userName}` : `Cannot select ${userName} (soft-deleted)`}
                                                />
                                            </TableCell>
                                            {isUserColumnVisible('user') && (
                                                <TableCell
                                                    className={`sticky start-[44px] z-30 w-[280px] min-w-[240px] max-w-[280px] overflow-hidden px-3 py-2.5 ${getAdminStickyBodyCellClass({
                                                        isSelected,
                                                        isScrolled: isUsersTableScrolledHorizontally,
                                                        isFirst: false,
                                                        isSorted: isUserSortedColumn('name'),
                                                    })}`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => showUserDetail(user.user_id)}
                                                        className="group/user block w-full min-w-0 cursor-pointer rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                                    >
                                                        <span className="flex min-w-0 items-center gap-1.5">
                                                            <span className="truncate text-sm font-medium text-foreground group-hover/user:underline group-hover/user:decoration-muted-foreground">{userName}</span>
                                                            {user.system_role === 'admin' && (
                                                                <AdminStatusBadge tone="accent" dot={false} className="h-4 px-1.5 text-[11px]">Admin</AdminStatusBadge>
                                                            )}
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground">{user.email || 'No email address'}</span>
                                                    </button>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('status') && (
                                                <TableCell className={sortedCell('account_status')}>
                                                    <AdminStatusBadge tone={lifecycle.tone}>{lifecycle.label}</AdminStatusBadge>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('login') && (
                                                <TableCell className={sortedCell('email')}>
                                                    <LoginPills user={user} />
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('tier') && (
                                                <TableCell className={sortedCell('tier_key')}>
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <AdminStatusBadge tone={tierTone(user.tier_key)} dot={false}>
                                                            {getPlanName(user.tier_key)}
                                                        </AdminStatusBadge>
                                                        {hasNotableSubscription(subscriptionStatus) && (
                                                            <span
                                                                className={cn(
                                                                    'text-xs',
                                                                    subscriptionStatus === 'past_due' || subscriptionStatus === 'canceled_grace'
                                                                        ? 'text-amber-700 dark:text-amber-300'
                                                                        : 'text-muted-foreground'
                                                                )}
                                                            >
                                                                {getUserSubscriptionStatusLabel(subscriptionStatus)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('subscription') && (
                                                <TableCell className={sortedCell('subscription_status')}>
                                                    <div className="flex min-w-[132px] flex-col gap-1">
                                                        <AdminStatusBadge tone={subscriptionStatusTone(subscriptionStatus)}>
                                                            {getUserSubscriptionStatusLabel(subscriptionStatus)}
                                                        </AdminStatusBadge>
                                                        {user.provider_subscription_id ? (
                                                            <span className="max-w-[180px] truncate font-mono text-[11px] text-muted-foreground" data-tooltip={user.provider_subscription_id}>
                                                                {user.provider_subscription_id}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('trips') && (
                                                <TableCell className={sortedCell('total_trips')}>
                                                    <div className="text-sm font-medium tabular-nums text-foreground">{getUserTotalTrips(user)}</div>
                                                    {getUserTotalTrips(user) > 0 ? (
                                                        <div className="text-xs tabular-nums text-muted-foreground">{getUserActiveTrips(user)} active</div>
                                                    ) : isUserTriplessAndNoData(user) ? (
                                                        <div className="text-xs text-muted-foreground">Empty account</div>
                                                    ) : null}
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('activation') && (
                                                <TableCell className={sortedCell('activation_status')}>
                                                    <AdminStatusBadge tone={activationStatusTone(activationStatus)}>
                                                        {getActivationStatusLabel(activationStatus)}
                                                    </AdminStatusBadge>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('role') && (
                                                <TableCell className={sortedCell('system_role')}>
                                                    <AdminStatusBadge tone={user.system_role === 'admin' ? 'accent' : 'neutral'} dot={false}>
                                                        {user.system_role === 'admin' ? 'Admin' : 'User'}
                                                    </AdminStatusBadge>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('toc') && (
                                                <TableCell className={sortedCell('terms_accepted_version')}>
                                                    <AdminStatusBadge tone={getUserTermsStateTone(termsState)}>
                                                        {getUserTermsStateLabel(termsState)}
                                                    </AdminStatusBadge>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        {user.terms_accepted_version || 'No accepted version'}
                                                    </div>
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('last_visit') && (
                                                <TableCell className={cn(sortedCell('last_sign_in_at'), 'text-sm text-muted-foreground')}>
                                                    <AdminRelativeTimestamp value={user.last_sign_in_at} fallback="Never" />
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('last_log') && (
                                                <TableCell className={cn(sortedCell('updated_at'), 'text-sm text-muted-foreground')}>
                                                    <AdminRelativeTimestamp value={user.updated_at} fallback="Never" />
                                                </TableCell>
                                            )}
                                            {isUserColumnVisible('created') && (
                                                <TableCell className={cn(sortedCell('created_at'), 'text-sm text-muted-foreground')}>
                                                    <AdminRelativeTimestamp value={user.created_at} fallback="Unknown" />
                                                </TableCell>
                                            )}
                                            <TableCell className="px-3 py-2.5 text-end">
                                                <UserRowActionsMenu
                                                    disabled={isSaving}
                                                    isDeleted={accountStatus === 'deleted'}
                                                    userName={userName}
                                                    tripsLink={`/admin/trips?q=${encodeURIComponent((user.email || '').trim() || user.user_id)}`}
                                                    onOpenDetails={() => showUserDetail(user.user_id)}
                                                    onCopyId={() => {
                                                        void copyUserId(user);
                                                    }}
                                                    onSoftDelete={() => {
                                                        void handleSoftDelete(user);
                                                    }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {pagedUsers.length === 0 && !isLoadingUsers && (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell className="p-4" colSpan={usersTableColumnCount}>
                                            <AdminEmptyState
                                                icon={<UsersThree />}
                                                title={users.length === 0 ? 'No users yet' : 'No users match'}
                                                description={users.length === 0
                                                    ? 'Create or invite the first account with "Create user".'
                                                    : 'Clear a filter, widen the date range or change the search.'}
                                                action={hasActiveFilters ? (
                                                    <Button type="button" variant="outline" size="sm" onClick={resetTableFilters}>
                                                        Reset filters
                                                    </Button>
                                                ) : undefined}
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                                {pagedUsers.length === 0 && isLoadingUsers && (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell className="px-4 py-10 text-center text-sm text-muted-foreground" colSpan={usersTableColumnCount}>
                                            <span role="status" className="inline-flex items-center gap-2 font-medium">
                                                <SpinnerGap size={16} className="animate-spin motion-reduce:animate-none" />
                                                Loading users…
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <AdminPagination
                        page={currentPage}
                        pageSize={PAGE_SIZE}
                        totalItems={filteredUsers.length}
                        onPageChange={setPage}
                        noun="users"
                    />

                    {isSaving && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-card/50">
                            <span role="status" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm">
                                <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                                Applying changes…
                            </span>
                        </div>
                    )}
                </AdminSurfaceCard>

                <AdminSelectionBar
                    count={selectedVisibleUsers.length}
                    noun="user"
                    onClear={() => setSelectedUserIds(new Set())}
                >
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleBulkSoftDeleteUsers()}
                        disabled={isSaving}
                    >
                        Soft delete
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleBulkHardDeleteUsers()}
                        disabled={isSaving}
                    >
                        <Trash />
                        Hard delete
                    </Button>
                </AdminSelectionBar>
            </div>

            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    if (!open) setCreateError(null);
                }}
            >
                <DialogContent className="w-[min(96vw,560px)]">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">Create user</DialogTitle>
                        <DialogDescription>
                            An invite emails a link to set a password. Direct creation makes the account now with a password you choose.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitCreateUser();
                        }}
                    >
                        <div className="inline-flex w-fit gap-0.5 rounded-md border border-border p-0.5" role="group" aria-label="Creation mode">
                            <Button
                                type="button"
                                variant="toggle"
                                size="sm"
                                aria-pressed={createMode === 'invite'}
                                onClick={() => setCreateMode('invite')}
                                className="h-7"
                            >
                                <EnvelopeSimple />
                                Invite
                            </Button>
                            <Button
                                type="button"
                                variant="toggle"
                                size="sm"
                                aria-pressed={createMode === 'direct'}
                                onClick={() => setCreateMode('direct')}
                                className="h-7"
                            >
                                <UserPlus />
                                Direct
                            </Button>
                        </div>

                        {createError && <AdminErrorAlert message={createError} />}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5 sm:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">Email</span>
                                <Input
                                    aria-label="Email"
                                    type="email"
                                    value={createDraft.email}
                                    onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
                                    placeholder="name@example.com"
                                    className="h-9"
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">First name</span>
                                <Input
                                    aria-label="First name"
                                    value={createDraft.firstName}
                                    onChange={(event) => setCreateDraft((current) => ({ ...current, firstName: event.target.value }))}
                                    className="h-9"
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">Last name</span>
                                <Input
                                    aria-label="Last name"
                                    value={createDraft.lastName}
                                    onChange={(event) => setCreateDraft((current) => ({ ...current, lastName: event.target.value }))}
                                    className="h-9"
                                />
                            </label>
                            {createMode === 'direct' && (
                                <label className="flex flex-col gap-1.5 sm:col-span-2">
                                    <span className="text-xs font-medium text-muted-foreground">Initial password</span>
                                    <Input
                                        aria-label="Initial password"
                                        value={createDraft.password}
                                        onChange={(event) => setCreateDraft((current) => ({ ...current, password: event.target.value }))}
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="At least 8 characters"
                                        className="h-9"
                                    />
                                </label>
                            )}
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <span className="text-xs font-medium text-muted-foreground">Starting plan</span>
                                <Select
                                    value={createDraft.tierKey}
                                    onValueChange={(value) => setCreateDraft((current) => ({ ...current, tierKey: value as PlanTierKey }))}
                                >
                                    <SelectTrigger className="h-9" aria-label="Starting plan">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PLAN_ORDER.map((tierKey) => (
                                            <SelectItem key={`create-tier-${tierKey}`} value={tierKey}>
                                                {getPlanName(tierKey)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSaving || !createDraft.email.trim() || (createMode === 'direct' && !createDraft.password.trim())}
                            >
                                {createMode === 'invite' ? 'Send invite' : 'Create user'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

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
                open={isDetailOpen}
                onOpenChange={(open) => {
                    if (open) {
                        setIsDetailOpen(true);
                        return;
                    }
                    closeUserDetail();
                }}
                title={selectedUser ? getUserDisplayName(selectedUser) : 'User'}
                accessibleTitle={selectedUser ? `${getUserDisplayName(selectedUser)} details` : 'User details'}
                subtitle={selectedUser ? (selectedUser.email || 'No email address') : undefined}
                meta={selectedUser && selectedUserLifecycle ? (
                    <>
                        <AdminStatusBadge tone={selectedUserLifecycle.tone}>{selectedUserLifecycle.label}</AdminStatusBadge>
                        <AdminStatusBadge tone={tierTone(selectedUser.tier_key)} dot={false}>{getPlanName(selectedUser.tier_key)}</AdminStatusBadge>
                        {selectedUser.system_role === 'admin' && (
                            <AdminStatusBadge tone="accent" dot={false}>Admin</AdminStatusBadge>
                        )}
                    </>
                ) : undefined}
                headerActions={selectedUserPublicProfilePath ? (
                    <Button asChild variant="ghost" size="icon-sm">
                        <a
                            href={selectedUserPublicProfilePath}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open public profile in a new tab"
                            data-tooltip="Open public profile"
                        >
                            <ArrowSquareOut className="rtl:-scale-x-100" />
                        </a>
                    </Button>
                ) : undefined}
                footer={selectedUser ? (
                    <>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void saveSelectedUser()}
                            disabled={isSaving}
                        >
                            Save changes
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleSoftDelete(selectedUser)}
                            disabled={isSaving}
                        >
                            {isSelectedUserDeleted ? 'Restore user' : 'Soft delete'}
                        </Button>
                        <span className="ms-auto flex flex-wrap items-center gap-2">
                            {selectedUserTripStats.total > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleTransferTripsAndHardDelete(selectedUser)}
                                    disabled={isSaving || isLoadingTrips || isSelectedUserDeleted}
                                >
                                    Transfer trips + hard delete
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => void handleHardDelete(selectedUser)}
                                disabled={isSaving || isSelectedUserDeleted}
                                data-tooltip={isSelectedUserDeleted ? 'Restore the user before deleting permanently' : undefined}
                            >
                                <Trash />
                                Hard delete
                            </Button>
                        </span>
                    </>
                ) : undefined}
            >
                {!selectedUser ? (
                    missingLinkedUserId && missingLinkedUserId === selectedUserId ? (
                        <AdminEmptyState
                            icon={<UsersThree />}
                            title="User not found"
                            description="The link points to an account that no longer exists. Close this panel to return to the list."
                        />
                    ) : (
                        <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                            Loading user…
                        </div>
                    )
                ) : (
                    <>
                        {errorMessage && <AdminErrorAlert message={errorMessage} />}
                        <Tabs
                            value={detailTab}
                            onValueChange={(value) => {
                                const nextTab = value as UserDetailTab;
                                setDetailTab(nextTab);
                                trackEvent('admin__users_detail--tab', { tab: nextTab });
                            }}
                            className="gap-4"
                        >
                            <TabsList variant="line" aria-label="User details" className="w-full justify-start gap-5 overflow-x-auto">
                                {(Object.keys(USER_DETAIL_TAB_LABELS) as UserDetailTab[]).map((tab) => (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab}
                                        className="group-data-[variant=line]/tabs-list:py-2.5"
                                        {...getAnalyticsDebugAttributes('admin__users_detail--tab', { tab })}
                                    >
                                        {USER_DETAIL_TAB_LABELS[tab]}
                                        {tab === 'trips' && (
                                            <span className="tabular-nums text-muted-foreground">{selectedUserTripStats.total}</span>
                                        )}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            <TabsContent value="overview" className="flex flex-col gap-6">
                                <section className="flex flex-col gap-3">
                                    <AdminSectionHeader as="h3" title="Account" />
                                    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                        <AdminDetailField label="User ID" className="sm:col-span-2">
                                            <CopyableUuid value={selectedUser.user_id} textClassName="break-all text-sm" />
                                        </AdminDetailField>
                                        <AdminDetailField label="Status">
                                            {selectedUserLifecycle && (
                                                <AdminStatusBadge tone={selectedUserLifecycle.tone}>{selectedUserLifecycle.label}</AdminStatusBadge>
                                            )}
                                        </AdminDetailField>
                                        <AdminDetailField label="Sign-in method">
                                            <LoginPills user={selectedUser} />
                                        </AdminDetailField>
                                        <AdminDetailField label="Last sign-in">
                                            {selectedUser.last_sign_in_at
                                                ? <>{formatAdminRelativeTime(selectedUser.last_sign_in_at, Date.now(), 'Never')} <span className="text-muted-foreground">· {formatAbsoluteTimestamp(selectedUser.last_sign_in_at)}</span></>
                                                : 'Never'}
                                        </AdminDetailField>
                                        <AdminDetailField label="Created">
                                            {formatAbsoluteTimestamp(selectedUser.created_at)}
                                        </AdminDetailField>
                                        <AdminDetailField label="Last updated">
                                            {formatAbsoluteTimestamp(selectedUser.updated_at)}
                                        </AdminDetailField>
                                        <AdminDetailField label="Trips">
                                            <span className="tabular-nums">
                                                {selectedUserTripStats.active} active of {selectedUserTripStats.total}
                                            </span>
                                        </AdminDetailField>
                                        <AdminDetailField label="Public profile" className="sm:col-span-2">
                                            {selectedUserPublicProfilePath ? (
                                                <a
                                                    href={selectedUserPublicProfilePath}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-primary underline-offset-4 hover:underline"
                                                >
                                                    {selectedUserPublicProfilePath}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">Not available until the user picks a username.</span>
                                            )}
                                        </AdminDetailField>
                                    </dl>
                                </section>

                                <section className="flex flex-col gap-3" aria-labelledby="admin-user-terms-heading">
                                    <AdminSectionHeader
                                        as="h3"
                                        title={<span id="admin-user-terms-heading">Terms of service</span>}
                                        actions={(
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                onClick={() => void handleResetTermsAcceptance()}
                                                disabled={isSaving || !selectedUser.terms_accepted_version}
                                            >
                                                Reset terms acceptance
                                            </Button>
                                        )}
                                    />
                                    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                        <AdminDetailField label="State">
                                            {selectedUserTermsState && (
                                                <AdminStatusBadge tone={getUserTermsStateTone(selectedUserTermsState)}>
                                                    {getUserTermsStateLabel(selectedUserTermsState)}
                                                </AdminStatusBadge>
                                            )}
                                        </AdminDetailField>
                                        <AdminDetailField label="Accepted version">
                                            {selectedUser.terms_accepted_version || 'Not accepted yet'}
                                        </AdminDetailField>
                                        <AdminDetailField label="Accepted at">
                                            {formatAbsoluteTimestamp(selectedUser.terms_accepted_at)}
                                        </AdminDetailField>
                                    </dl>
                                </section>
                            </TabsContent>

                            <TabsContent value="profile" className="flex flex-col gap-6">
                                <section className="flex flex-col gap-3">
                                    <AdminSectionHeader as="h3" title="Profile" />
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">First name</span>
                                            <Input
                                                aria-label="First name"
                                                value={profileDraft.firstName}
                                                onChange={(event) => setProfileDraft((current) => ({ ...current, firstName: event.target.value }))}
                                                className="h-9"
                                            />
                                        </label>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Last name</span>
                                            <Input
                                                aria-label="Last name"
                                                value={profileDraft.lastName}
                                                onChange={(event) => setProfileDraft((current) => ({ ...current, lastName: event.target.value }))}
                                                className="h-9"
                                            />
                                        </label>
                                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                                            <label className="flex flex-col gap-1.5">
                                                <span className="text-xs font-medium text-muted-foreground">Username</span>
                                                <Input
                                                    aria-label="Username"
                                                    value={profileDraft.username}
                                                    onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))}
                                                    className="h-9"
                                                />
                                            </label>
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <span>
                                                    Users can change their username once every {USERNAME_CHANGE_COOLDOWN_DAYS} days.{' '}
                                                    {selectedUserUsernameCooldown.isActive
                                                        ? `Cooldown ends ${formatAbsoluteTimestamp(selectedUserUsernameCooldown.endsAt)}.`
                                                        : 'No cooldown is active.'}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="xs"
                                                    onClick={() => void handleResetUsernameCooldown()}
                                                    disabled={isSaving || !selectedUserUsernameCooldown.isActive}
                                                >
                                                    Revoke cooldown
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Gender</span>
                                            <Select
                                                value={profileDraft.gender || GENDER_UNSET_VALUE}
                                                onValueChange={(value) => {
                                                    setProfileDraft((current) => ({
                                                        ...current,
                                                        gender: value === GENDER_UNSET_VALUE ? '' : value as '' | 'female' | 'male' | 'non-binary' | 'prefer-not',
                                                    }));
                                                }}
                                            >
                                                <SelectTrigger className="h-9" aria-label="Gender">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PROFILE_GENDER_OPTIONS.map((option) => (
                                                        <SelectItem
                                                            key={`profile-gender-${option.value || 'empty'}`}
                                                            value={option.value || GENDER_UNSET_VALUE}
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Preferred language</span>
                                            <Input
                                                aria-label="Preferred language"
                                                value={profileDraft.preferredLanguage}
                                                onChange={(event) => setProfileDraft((current) => ({ ...current, preferredLanguage: event.target.value }))}
                                                className="h-9"
                                            />
                                        </label>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Country/Region</span>
                                            <ProfileCountryRegionSelect
                                                value={profileDraft.country}
                                                placeholder="Search country or region"
                                                emptyLabel="No countries found"
                                                toggleLabel="Toggle country/region options"
                                                onValueChange={(nextCode) => setProfileDraft((current) => ({ ...current, country: nextCode }))}
                                            />
                                        </div>
                                        <label className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">City</span>
                                            <Input
                                                aria-label="City"
                                                value={profileDraft.city}
                                                onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))}
                                                className="h-9"
                                            />
                                        </label>
                                    </div>
                                </section>

                                <section className="flex flex-col gap-3">
                                    <AdminSectionHeader
                                        as="h3"
                                        title="Access"
                                        description="Plan, role and account state. Saved with the profile."
                                    />
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Plan</span>
                                            <Select
                                                value={tierDraft}
                                                onValueChange={(value) => setTierDraft(value as PlanTierKey)}
                                            >
                                                <SelectTrigger className="h-9" aria-label="Plan">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PLAN_ORDER.map((tierKey) => (
                                                        <SelectItem key={`profile-tier-${tierKey}`} value={tierKey}>
                                                            {getPlanName(tierKey)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Role</span>
                                            <Select
                                                value={profileDraft.role}
                                                onValueChange={(value) => setProfileDraft((current) => ({ ...current, role: value as 'admin' | 'user' }))}
                                            >
                                                <SelectTrigger className="h-9" aria-label="Role">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">User</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">Account status</span>
                                            <Select
                                                value={profileDraft.accountStatus}
                                                onValueChange={(value) => setProfileDraft((current) => ({ ...current, accountStatus: value as 'active' | 'disabled' | 'deleted' }))}
                                            >
                                                <SelectTrigger className="h-9" aria-label="Account status">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PROFILE_ACCOUNT_STATUS_OPTIONS.map((option) => (
                                                        <SelectItem key={`profile-status-${option.value}`} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </section>

                                <section className="flex flex-col gap-2">
                                    <AdminSectionHeader
                                        as="h3"
                                        title="Entitlement overrides"
                                        description="Optional JSON object that replaces individual plan limits for this user. Leave empty to use the plan's limits."
                                    />
                                    <Textarea
                                        aria-label="Entitlement overrides"
                                        value={overrideDraft}
                                        onChange={(event) => setOverrideDraft(event.target.value)}
                                        placeholder={`{\n  "maxActiveTrips": 15\n}`}
                                        className="min-h-[120px] font-mono text-xs"
                                    />
                                </section>
                            </TabsContent>

                            <TabsContent value="billing" className="flex flex-col gap-3">
                                <AdminSectionHeader
                                    as="h3"
                                    title="Subscription"
                                    description="Read-only. Billing changes happen in Paddle."
                                    actions={(
                                        <Button asChild variant="outline" size="xs">
                                            <Link to={`/admin/billing?q=${encodeURIComponent(selectedUser.provider_subscription_id || selectedUser.user_id)}`}>
                                                Open in Billing
                                            </Link>
                                        </Button>
                                    )}
                                />
                                <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                    <AdminDetailField label="Status">
                                        {selectedUserSubscriptionStatus && (
                                            <AdminStatusBadge tone={subscriptionStatusTone(selectedUserSubscriptionStatus)}>
                                                {getUserSubscriptionStatusLabel(selectedUserSubscriptionStatus)}
                                            </AdminStatusBadge>
                                        )}
                                    </AdminDetailField>
                                    <AdminDetailField label="Provider status">
                                        {humanizeAdminBillingStatus(selectedUser.provider_status || selectedUser.subscription_status)}
                                    </AdminDetailField>
                                    <AdminDetailField label="Recurring amount">
                                        <span className="tabular-nums">
                                            {selectedUser.subscription_amount !== null && selectedUser.subscription_amount !== undefined
                                                ? `${selectedUser.subscription_currency || '—'} ${(selectedUser.subscription_amount / 100).toFixed(2)}`
                                                : '—'}
                                        </span>
                                    </AdminDetailField>
                                    <AdminDetailField label="Current period ends">
                                        {formatAbsoluteTimestamp(selectedUser.current_period_end)}
                                    </AdminDetailField>
                                    <AdminDetailField label="Cancels at">
                                        {formatAbsoluteTimestamp(selectedUser.cancel_at)}
                                    </AdminDetailField>
                                    <AdminDetailField label="Cancelled at">
                                        {formatAbsoluteTimestamp(selectedUser.canceled_at)}
                                    </AdminDetailField>
                                    <AdminDetailField label="Grace ends">
                                        {formatAbsoluteTimestamp(selectedUser.grace_ends_at)}
                                    </AdminDetailField>
                                    <AdminDetailField label="Downgrades at">
                                        {formatAbsoluteTimestamp(resolveUserSubscriptionDowngradeAt(selectedUser))}
                                    </AdminDetailField>
                                    <AdminDetailField label="Subscription ID">
                                        <span className="break-all font-mono text-xs">{selectedUser.provider_subscription_id || '—'}</span>
                                    </AdminDetailField>
                                    <AdminDetailField label="Paddle price ID">
                                        <span className="break-all font-mono text-xs">{selectedUser.provider_price_id || '—'}</span>
                                    </AdminDetailField>
                                    <AdminDetailField label="Latest billing event" className="sm:col-span-2">
                                        <span className="font-medium">{selectedUser.subscription_last_event_type || 'No event recorded'}</span>
                                        {selectedUser.subscription_last_event_at && (
                                            <span className="text-muted-foreground"> · {formatAbsoluteTimestamp(selectedUser.subscription_last_event_at)}</span>
                                        )}
                                        {selectedUser.subscription_last_event_id && (
                                            <span className="block break-all font-mono text-xs text-muted-foreground">{selectedUser.subscription_last_event_id}</span>
                                        )}
                                    </AdminDetailField>
                                </dl>
                            </TabsContent>

                            <TabsContent value="trips">
                                <section className="flex flex-col gap-3">
                                    <AdminSectionHeader
                                        as="h3"
                                        title="Owned trips"
                                        description="Status and expiry save as soon as you change them."
                                        actions={selectedUserTripsPageLink ? (
                                            <Button asChild variant="outline" size="xs">
                                                <Link to={selectedUserTripsPageLink}>Open in Trips</Link>
                                            </Button>
                                        ) : undefined}
                                    />
                                    {isLoadingTrips ? (
                                        <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                            <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                                            Loading trips…
                                        </div>
                                    ) : userTrips.length === 0 ? (
                                        <AdminEmptyState
                                            className="py-6"
                                            title="No trips owned by this user"
                                            description="Trips this user creates or receives by transfer will appear here."
                                        />
                                    ) : (
                                        <>
                                            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                                                {pagedConnectedTrips.map((trip) => (
                                                    <li key={trip.trip_id} className="flex flex-col gap-2 p-3">
                                                        <div className="min-w-0">
                                                            <a
                                                                href={`/trip/${encodeURIComponent(trip.trip_id)}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                data-tooltip="Open trip in a new tab"
                                                                className="block truncate text-sm font-medium text-foreground hover:underline"
                                                            >
                                                                {trip.title || trip.trip_id}
                                                            </a>
                                                            <CopyableUuid
                                                                value={trip.trip_id}
                                                                className="-ms-1"
                                                                textClassName="max-w-[300px] truncate text-[11px] text-muted-foreground"
                                                                hintClassName="text-[9px]"
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                            <Select
                                                                value={trip.status}
                                                                onValueChange={(value) => {
                                                                    void handleTripPatch(trip, { status: value as 'active' | 'archived' | 'expired' });
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 !w-[120px] min-w-[120px] text-xs" aria-label={`Status for ${trip.title || trip.trip_id}`}>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="active">Active</SelectItem>
                                                                    <SelectItem value="expired">Expired</SelectItem>
                                                                    <SelectItem value="archived">Archived</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <label className="flex items-center gap-2 text-muted-foreground">
                                                                Expires
                                                                <Input
                                                                    key={`${trip.trip_id}-${trip.updated_at}`}
                                                                    type="datetime-local"
                                                                    aria-label={`Trip expiration for ${trip.title || trip.trip_id}`}
                                                                    defaultValue={toDateTimeInputValue(trip.trip_expires_at)}
                                                                    onBlur={(event) => {
                                                                        if (isTripExpiryInputUnchanged(event.target.value, trip.trip_expires_at)) return;
                                                                        void handleTripPatch(trip, { tripExpiresAt: fromDateTimeInputValue(event.target.value) });
                                                                    }}
                                                                    className="h-8 w-auto text-xs"
                                                                />
                                                            </label>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                            <AdminPagination
                                                page={safeConnectedTripsPage}
                                                pageSize={USER_DETAIL_TRIP_PAGE_SIZE}
                                                totalItems={userTrips.length}
                                                onPageChange={setConnectedTripsPage}
                                                noun="trips"
                                            />
                                        </>
                                    )}
                                </section>
                            </TabsContent>

                            <TabsContent value="activity">
                                <section className="flex flex-col gap-3">
                                    <AdminSectionHeader
                                        as="h3"
                                        title="Change log"
                                        description={`The latest ${USER_CHANGE_LOG_DRAWER_LIMIT} changes by or to this user.`}
                                        actions={(
                                            <Button asChild variant="outline" size="xs">
                                                <Link to={`/admin/audit?q=${encodeURIComponent(selectedUser.user_id)}`}>
                                                    Open in Audit log
                                                </Link>
                                            </Button>
                                        )}
                                    />
                                    {userChangeLogsError && <AdminErrorAlert message={userChangeLogsError} />}
                                    {isLoadingUserChangeLogs ? (
                                        <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                            <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                                            Loading change log…
                                        </div>
                                    ) : selectedUserChangeEntries.length === 0 ? (
                                        userChangeLogsError ? null : (
                                            <AdminEmptyState
                                                className="py-6"
                                                title="No changes recorded yet"
                                                description="Profile, trip and account changes for this user will appear here."
                                            />
                                        )
                                    ) : (
                                        <>
                                            <ol className="flex flex-col gap-2">
                                                {pagedUserChangeEntries.map(({ log, actionPresentation, secondaryFacets, visibleDiffEntries, hiddenDiffCount }) => (
                                                    <li key={log.id} className="rounded-md border border-border p-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="flex flex-wrap items-center gap-1">
                                                                <AdminStatusBadge dot={false} className={actionPresentation.className} data-tooltip={log.action}>
                                                                    {actionPresentation.label}
                                                                </AdminStatusBadge>
                                                                {secondaryFacets.map((facet, facetIndex) => (
                                                                    <AdminStatusBadge
                                                                        key={`${log.id}-${buildSecondaryFacetRenderKey(facet, facetIndex)}`}
                                                                        dot={false}
                                                                        className={cn('text-[11px]', facet.className)}
                                                                        data-tooltip={facet.code}
                                                                    >
                                                                        {facet.label}
                                                                    </AdminStatusBadge>
                                                                ))}
                                                            </span>
                                                            <AdminRelativeTimestamp value={log.created_at} fallback="Unknown time" className="text-xs text-muted-foreground" />
                                                        </div>
                                                        {(log.source || (log.target_type === 'trip' && log.target_id)) && (
                                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                                                {log.source && <span>Source: {log.source}</span>}
                                                                {log.target_type === 'trip' && log.target_id && (
                                                                    <span className="inline-flex min-w-0 items-center">
                                                                        Trip:
                                                                        <CopyableUuid value={log.target_id} textClassName="max-w-[260px] truncate text-[11px]" hintClassName="text-[9px]" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {visibleDiffEntries.length > 0 ? (
                                                            <dl className="mt-2 flex flex-col gap-1.5">
                                                                {visibleDiffEntries.map((entry, entryIndex) => (
                                                                    <div key={`${log.id}-${buildDiffEntryRenderKey(entry, entryIndex)}`} className="grid gap-1 text-xs sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)]">
                                                                        <dt className="font-medium text-muted-foreground">{formatFieldLabel(entry.key)}</dt>
                                                                        <dd className="break-all rounded-sm bg-red-50 px-1.5 py-0.5 text-red-900 line-through decoration-red-400/60 dark:bg-red-400/12 dark:text-red-200">
                                                                            <span className="sr-only">Before: </span>
                                                                            {formatUserChangeDiffValue(entry, entry.beforeValue)}
                                                                        </dd>
                                                                        <dd className="break-all rounded-sm bg-emerald-50 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-200">
                                                                            <span className="sr-only">After: </span>
                                                                            {formatUserChangeDiffValue(entry, entry.afterValue)}
                                                                        </dd>
                                                                    </div>
                                                                ))}
                                                                {hiddenDiffCount > 0 && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        +{hiddenDiffCount} more changed field{hiddenDiffCount === 1 ? '' : 's'}
                                                                    </p>
                                                                )}
                                                            </dl>
                                                        ) : (
                                                            <p className="mt-2 text-xs text-muted-foreground">No field diff recorded.</p>
                                                        )}
                                                        {canOpenUserChangeFullDiffModal(log) && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="xs"
                                                                onClick={() => void openUserChangeFullDiffModal(log)}
                                                                className="mt-2"
                                                            >
                                                                Show complete diff
                                                            </Button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ol>
                                            <AdminPagination
                                                page={safeUserChangeLogsPage}
                                                pageSize={USER_DETAIL_LOG_PAGE_SIZE}
                                                totalItems={selectedUserChangeEntries.length}
                                                onPageChange={setUserChangeLogsPage}
                                                noun="changes"
                                            />
                                        </>
                                    )}
                                </section>
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </AdminDetailSheet>
        </AdminShell>
    );
};
