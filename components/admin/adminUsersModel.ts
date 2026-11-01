import type { PlanTierKey } from '../../types';
import type { AdminUserRecord } from '../../services/adminService';
import type { AdminStatusTone } from './AdminStatusBadge';
import type { AdminUserChangeRecord } from '../../services/adminService';
import { PLAN_CATALOG, PLAN_ORDER } from '../../config/planCatalog';
import { buildPath } from '../../config/routes';
import type { AdminFilterMenuOption } from './AdminFilterMenu';
import type { AdminDateRange } from './adminShellUtils';
import { isIsoDateInRange } from './adminDateRange';
import {
    humanizeAdminBillingStatus,
    normalizeAdminBillingStatus,
    resolveAdminBillingStatusTone,
} from '../../services/adminBillingPresentation';
import { resolveBillingAccessUntil, resolveBillingLifecycleState } from '../../lib/billing/subscriptionState';

/**
 * Pure classification for the admin Users screen: how an account is labelled,
 * filtered, sorted, queued and mirrored into the URL. Kept out of the page so
 * it can be tested without rendering any UI.
 */

export type UserActivationStatus = 'activated' | 'invited' | 'pending' | 'anonymous';
export type UserAccountStatus = 'active' | 'disabled' | 'deleted';
export type UserLoginType = 'social' | 'password' | 'unknown';
export type UserTripFilter = 'no_trips_no_profile' | 'no_trips' | 'one_to_two' | 'three_to_five' | 'six_plus';
export type UserTermsState = 'latest' | 'pending' | 'never';
export type UserSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled_grace' | 'canceled' | 'inactive' | 'none' | 'unknown';
export type SocialProviderFilter = 'google' | 'facebook' | 'kakao' | 'apple' | 'github' | 'discord' | 'other_social';

export const USER_ACTIVATION_VALUES: ReadonlyArray<UserActivationStatus> = ['activated', 'invited', 'pending', 'anonymous'];
export const USER_STATUS_VALUES: ReadonlyArray<UserAccountStatus> = ['active', 'disabled', 'deleted'];
export const USER_TRIP_FILTER_VALUES: ReadonlyArray<UserTripFilter> = ['no_trips_no_profile', 'no_trips', 'one_to_two', 'three_to_five', 'six_plus'];
export const USER_TERMS_STATE_VALUES: ReadonlyArray<UserTermsState> = ['latest', 'pending', 'never'];
export const USER_SUBSCRIPTION_VALUES: ReadonlyArray<UserSubscriptionStatus> = ['active', 'trialing', 'past_due', 'paused', 'canceled_grace', 'canceled', 'inactive', 'none', 'unknown'];
export const SOCIAL_PROVIDER_VALUES: ReadonlyArray<SocialProviderFilter> = [
    'google',
    'facebook',
    'kakao',
    'apple',
    'github',
    'discord',
    'other_social',
];

export const USER_TRIP_FILTER_LABELS: Record<UserTripFilter, string> = {
    no_trips_no_profile: 'Empty accounts (no trips, no profile)',
    no_trips: 'No trips',
    one_to_two: '1–2 trips',
    three_to_five: '3–5 trips',
    six_plus: '6+ trips',
};

const hasNonEmptyValue = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0);

export const getUserDisplayName = (user: AdminUserRecord): string => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (user.display_name?.trim()) return user.display_name.trim();
    if (user.username_display?.trim()) return user.username_display.trim();
    if (user.username?.trim()) return user.username.trim();
    return 'Unnamed user';
};

export const getUserTotalTrips = (user: AdminUserRecord): number => Math.max(0, Number(user.total_trips || 0));
export const getUserActiveTrips = (user: AdminUserRecord): number => Math.max(0, Number(user.active_trips || 0));
export const getUserAccountStatus = (user: Pick<AdminUserRecord, 'account_status'>): UserAccountStatus => (
    (user.account_status || 'active') as UserAccountStatus
);
/** Soft-deleted accounts are restored, not hard-deleted, so they cannot be selected for bulk deletes. */
export const isUserHardDeleteEligible = (user: AdminUserRecord): boolean => getUserAccountStatus(user) !== 'deleted';

export const resolveActivationStatus = (user: AdminUserRecord): UserActivationStatus => {
    const providerCandidates = [
        ...(Array.isArray(user.auth_providers) ? user.auth_providers : []),
        user.auth_provider || '',
    ]
        .flatMap((value) => {
            const trimmed = value.trim().toLowerCase();
            return trimmed ? [trimmed] : [];
        });
    const hasAnonymousProvider = providerCandidates.some((provider) => provider === 'anonymous' || provider === 'anon');
    if (Boolean(user.is_anonymous) || hasAnonymousProvider) return 'anonymous';

    const explicit = (user.activation_status || '').trim().toLowerCase();
    if (explicit === 'activated' || explicit === 'invited' || explicit === 'pending' || explicit === 'anonymous') {
        return explicit;
    }
    if (explicit === 'pending_activation' || explicit === 'placeholder') return 'pending';
    if (!user.email && !user.last_sign_in_at) return 'pending';
    if (user.email && !user.last_sign_in_at) return 'invited';
    return 'activated';
};

export const getActivationStatusLabel = (status: UserActivationStatus): string => {
    if (status === 'activated') return 'Activated';
    if (status === 'invited') return 'Invited';
    if (status === 'pending') return 'Pending activation';
    return 'Guest';
};

export const activationStatusTone = (status: UserActivationStatus): AdminStatusTone => {
    if (status === 'activated') return 'success';
    if (status === 'invited') return 'info';
    if (status === 'pending') return 'warning';
    return 'neutral';
};

export const formatAccountStatusLabel = (status: UserAccountStatus): string => {
    if (status === 'disabled') return 'Suspended';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

export const accountStatusTone = (status: UserAccountStatus): AdminStatusTone => {
    if (status === 'active') return 'success';
    if (status === 'disabled') return 'warning';
    return 'danger';
};

export type UserLifecycleKey = 'deleted' | 'suspended' | 'guest' | 'pending' | 'invited' | 'active';

export interface UserLifecycleStatus {
    key: UserLifecycleKey;
    label: string;
    tone: AdminStatusTone;
    /** Lower sorts first: the states that need attention come before healthy accounts. */
    rank: number;
}

/**
 * One status per account for the table: account state wins over activation,
 * because a deleted or suspended account is the more important fact. A healthy,
 * activated account simply reads "Active".
 */
export const resolveUserLifecycleStatus = (user: AdminUserRecord): UserLifecycleStatus => {
    const accountStatus = getUserAccountStatus(user);
    if (accountStatus === 'deleted') return { key: 'deleted', label: 'Deleted', tone: 'danger', rank: 0 };
    if (accountStatus === 'disabled') return { key: 'suspended', label: 'Suspended', tone: 'warning', rank: 1 };
    const activation = resolveActivationStatus(user);
    if (activation === 'pending') return { key: 'pending', label: 'Pending activation', tone: 'warning', rank: 2 };
    if (activation === 'invited') return { key: 'invited', label: 'Invited', tone: 'info', rank: 3 };
    if (activation === 'anonymous') return { key: 'guest', label: 'Guest', tone: 'neutral', rank: 4 };
    return { key: 'active', label: 'Active', tone: 'success', rank: 5 };
};

export interface UserLoginProfile {
    providers: string[];
    hasPassword: boolean;
    socialProviders: SocialProviderFilter[];
    isUnknown: boolean;
    isAnonymousOnly: boolean;
}

const normalizeProviderKey = (value: string | null | undefined): string => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'password' || normalized === 'credentials' || normalized === 'email_password' || normalized === 'mail') {
        return 'email';
    }
    if (normalized === 'google_oauth2' || normalized === 'gmail') return 'google';
    if (normalized === 'anon') return 'anonymous';
    return normalized;
};

const mapProviderToSocialFilter = (provider: string): SocialProviderFilter | null => {
    if (provider === 'google') return 'google';
    if (provider === 'facebook') return 'facebook';
    if (provider === 'kakao') return 'kakao';
    if (provider === 'apple') return 'apple';
    if (provider === 'github') return 'github';
    if (provider === 'discord') return 'discord';
    if (provider === 'email' || provider === 'anonymous' || provider === 'placeholder' || provider === 'unknown') {
        return null;
    }
    return 'other_social';
};

export const resolveUserLoginProfile = (user: AdminUserRecord): UserLoginProfile => {
    const candidates: string[] = [];
    if (Array.isArray(user.auth_providers)) {
        user.auth_providers.forEach((provider) => candidates.push(provider));
    }
    if (user.auth_provider) candidates.push(user.auth_provider);
    if (candidates.length === 0 && user.email) candidates.push('email');
    if (user.is_anonymous) candidates.push('anonymous');

    const providerSet = new Set<string>();
    candidates.forEach((provider) => {
        const normalized = normalizeProviderKey(provider);
        if (normalized) providerSet.add(normalized);
    });
    if (providerSet.size === 0 && user.email) providerSet.add('email');

    const providers = Array.from(providerSet);
    const hasPassword = providers.includes('email');
    const socialSet = new Set<SocialProviderFilter>();
    providers.forEach((provider) => {
        const socialProvider = mapProviderToSocialFilter(provider);
        if (socialProvider) socialSet.add(socialProvider);
    });
    const socialProviders = SOCIAL_PROVIDER_VALUES.filter((provider) => socialSet.has(provider));
    const isUnknown = !hasPassword && socialProviders.length === 0;
    const isAnonymousOnly = isUnknown && (providers.includes('anonymous') || Boolean(user.is_anonymous));

    return {
        providers,
        hasPassword,
        socialProviders,
        isUnknown,
        isAnonymousOnly,
    };
};

/** An account nobody uses: no trips, no profile data, never signed in, no real sign-in method. */
export const isUserTriplessAndNoData = (user: AdminUserRecord): boolean => {
    if (getUserTotalTrips(user) !== 0) return false;
    const hasProfileData = hasNonEmptyValue(user.email)
        || hasNonEmptyValue(user.first_name)
        || hasNonEmptyValue(user.last_name)
        || hasNonEmptyValue(user.display_name)
        || hasNonEmptyValue(user.username)
        || hasNonEmptyValue(user.country)
        || hasNonEmptyValue(user.city);
    if (hasProfileData) return false;
    if (hasNonEmptyValue(user.last_sign_in_at) || hasNonEmptyValue(user.onboarding_completed_at)) return false;
    const loginProfile = resolveUserLoginProfile(user);
    return !loginProfile.hasPassword && loginProfile.socialProviders.length === 0;
};

export const matchesUserTripFilter = (user: AdminUserRecord, filter: UserTripFilter): boolean => {
    const totalTrips = getUserTotalTrips(user);
    if (filter === 'no_trips_no_profile') return isUserTriplessAndNoData(user);
    if (filter === 'no_trips') return totalTrips === 0;
    if (filter === 'one_to_two') return totalTrips >= 1 && totalTrips <= 2;
    if (filter === 'three_to_five') return totalTrips >= 3 && totalTrips <= 5;
    return totalTrips >= 6;
};

export const resolveUserTermsState = (
    user: Pick<AdminUserRecord, 'terms_accepted_version'>,
    currentTermsVersion: string | null
): UserTermsState => {
    const acceptedVersion = (user.terms_accepted_version || '').trim();
    if (!acceptedVersion) return 'never';
    if (!currentTermsVersion) return 'latest';
    return acceptedVersion === currentTermsVersion ? 'latest' : 'pending';
};

export const getUserTermsStateLabel = (state: UserTermsState): string => {
    if (state === 'latest') return 'Latest accepted';
    if (state === 'pending') return 'Pending re-accept';
    return 'Never accepted';
};

export const getUserTermsStateTone = (state: UserTermsState): AdminStatusTone => {
    if (state === 'latest') return 'success';
    if (state === 'pending') return 'warning';
    return 'danger';
};

export const getUserTermsSortRank = (state: UserTermsState): number => {
    if (state === 'latest') return 3;
    if (state === 'pending') return 2;
    return 1;
};

export const resolveUserSubscriptionStatus = (user: AdminUserRecord): UserSubscriptionStatus => {
    const billingInput = {
        providerStatus: user.provider_status,
        status: user.subscription_status,
        currentPeriodEnd: user.current_period_end,
        cancelAt: user.cancel_at,
        canceledAt: user.canceled_at,
        graceEndsAt: user.grace_ends_at,
    };
    const lifecycle = resolveBillingLifecycleState({
        ...billingInput,
        billingAccessUntil: resolveBillingAccessUntil(billingInput),
    });
    if (
        lifecycle === 'active'
        || lifecycle === 'trialing'
        || lifecycle === 'past_due'
        || lifecycle === 'paused'
        || lifecycle === 'canceled_grace'
        || lifecycle === 'inactive'
        || lifecycle === 'none'
    ) {
        return lifecycle;
    }
    const normalized = normalizeAdminBillingStatus(user.provider_status, user.subscription_status);
    if (normalized === 'canceled') {
        return 'canceled';
    }
    return 'unknown';
};

export const getUserSubscriptionStatusLabel = (status: UserSubscriptionStatus): string => {
    if (status === 'canceled_grace') return 'Canceled (grace period)';
    return humanizeAdminBillingStatus(status);
};

export const subscriptionStatusTone = (status: UserSubscriptionStatus): AdminStatusTone => (
    resolveAdminBillingStatusTone(status === 'canceled_grace' ? 'grace' : status)
);

/** True when the account has a subscription worth mentioning next to its plan. */
export const hasNotableSubscription = (status: UserSubscriptionStatus): boolean => (
    status !== 'none' && status !== 'unknown' && status !== 'inactive'
);

export const resolveUserSubscriptionDowngradeAt = (user: AdminUserRecord): string | null => (
    user.grace_ends_at || user.current_period_end || user.cancel_at || null
);

export const tierTone = (tier: PlanTierKey): AdminStatusTone => {
    if (tier === 'tier_premium') return 'accent';
    if (tier === 'tier_mid') return 'info';
    return 'neutral';
};

// ---------------------------------------------------------------------------
// Work queues: the KPI tiles. Each one counts accounts that need an admin and
// applies the filter that lists exactly those accounts.

export type UserQueueId = 'awaiting_activation' | 'subscriptions_at_risk' | 'empty_accounts';

export interface UserQueueFilters {
    activation: UserActivationStatus[];
    subscription: UserSubscriptionStatus[];
    trips: UserTripFilter[];
}

export const USER_QUEUE_IDS: readonly UserQueueId[] = ['awaiting_activation', 'subscriptions_at_risk', 'empty_accounts'];

export const USER_QUEUE_FILTERS: Record<UserQueueId, UserQueueFilters> = {
    awaiting_activation: { activation: ['invited', 'pending'], subscription: [], trips: [] },
    subscriptions_at_risk: { activation: [], subscription: ['past_due', 'canceled_grace'], trips: [] },
    empty_accounts: { activation: [], subscription: [], trips: ['no_trips_no_profile'] },
};

export const matchesUserQueue = (user: AdminUserRecord, queueId: UserQueueId): boolean => {
    const filters = USER_QUEUE_FILTERS[queueId];
    if (filters.activation.length > 0 && !filters.activation.includes(resolveActivationStatus(user))) return false;
    if (filters.subscription.length > 0 && !filters.subscription.includes(resolveUserSubscriptionStatus(user))) return false;
    if (filters.trips.length > 0 && !filters.trips.some((filter) => matchesUserTripFilter(user, filter))) return false;
    return true;
};

export const countUserQueues = (users: AdminUserRecord[]): Record<UserQueueId, number> => {
    const counts: Record<UserQueueId, number> = {
        awaiting_activation: 0,
        subscriptions_at_risk: 0,
        empty_accounts: 0,
    };
    users.forEach((user) => {
        USER_QUEUE_IDS.forEach((queueId) => {
            if (matchesUserQueue(user, queueId)) counts[queueId] += 1;
        });
    });
    return counts;
};

const sameMembers = <T extends string>(left: readonly T[], right: readonly T[]): boolean => (
    left.length === right.length && left.every((value) => right.includes(value))
);

/**
 * The queue whose filter is exactly what the table shows right now, if any.
 * `otherFiltersActive` covers every filter a queue never sets (status, role,
 * plan, sign-in method, terms): with one of those on, no queue is "applied".
 */
export const resolveAppliedUserQueue = (
    current: UserQueueFilters,
    otherFiltersActive: boolean
): UserQueueId | null => {
    if (otherFiltersActive) return null;
    return USER_QUEUE_IDS.find((queueId) => {
        const filters = USER_QUEUE_FILTERS[queueId];
        return sameMembers(filters.activation, current.activation)
            && sameMembers(filters.subscription, current.subscription)
            && sameMembers(filters.trips, current.trips);
    }) ?? null;
};

// ---------------------------------------------------------------------------
// Dates


export const formatAbsoluteTimestamp = (value: string | null | undefined, fallback = 'Not set'): string => {
    if (!value) return fallback;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return 'Unknown';
    return new Date(parsed).toLocaleString();
};

export const toDateTimeInputValue = (value: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const fromDateTimeInputValue = (value: string): string | null => {
    if (!value.trim()) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
};

/**
 * Whether a trip-expiry input still shows the stored value. The field saves on
 * blur, and tabbing through it used to write an identical value — an
 * `admin.trip.update` audit row for a change nobody made.
 */
export const isTripExpiryInputUnchanged = (inputValue: string, storedValue: string | null): boolean => (
    inputValue === toDateTimeInputValue(storedValue)
);

// ---------------------------------------------------------------------------
// Table: sort keys, columns and URL parsing

export type UserSortKey =
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
export type UserSortDirection = 'asc' | 'desc';
export type UserRole = 'admin' | 'user';
export type UserVisibleColumnId =
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
export type UserDetailTab = 'overview' | 'profile' | 'billing' | 'trips' | 'activity';

export const USERS_PAGE_SIZE = 25;
export const USER_CHANGE_LOG_DRAWER_LIMIT = 20;
export const USER_DETAIL_TRIP_PAGE_SIZE = 10;
export const USER_DETAIL_LOG_PAGE_SIZE = 10;
export const USERS_CACHE_KEY = 'admin.users.cache.v1';
export const USERS_COLUMNS_CACHE_KEY_PREFIX = 'admin.users.columns.v2';
export const USERNAME_CHANGE_COOLDOWN_DAYS = 90;
export const USER_ROLE_VALUES: ReadonlyArray<UserRole> = ['admin', 'user'];
export const USER_LOGIN_TYPE_VALUES: ReadonlyArray<UserLoginType> = ['social', 'password', 'unknown'];
export const DEFAULT_USERS_DATE_RANGE: AdminDateRange = '30d';
export const DEFAULT_USERS_SORT_KEY: UserSortKey = 'created_at';
export const DEFAULT_USERS_SORT_DIRECTION: UserSortDirection = 'desc';

const USER_SORT_KEYS: ReadonlyArray<UserSortKey> = [
    'name',
    'email',
    'total_trips',
    'activation_status',
    'last_sign_in_at',
    'updated_at',
    'created_at',
    'tier_key',
    'subscription_status',
    'system_role',
    'account_status',
    'terms_accepted_version',
];

// Render order of the columns. The picker can only show or hide, never reorder.
export const USER_VISIBLE_COLUMN_IDS: readonly UserVisibleColumnId[] = [
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
export const USER_VISIBLE_COLUMN_OPTIONS: Array<{ value: UserVisibleColumnId; label: string }> = [
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
/** Header label and sort key for every sortable column after the sticky User column. */
export const USER_SORTABLE_COLUMNS: ReadonlyArray<readonly [UserVisibleColumnId, string, UserSortKey]> = [
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
];
// What fits a 1440px screen without scrolling sideways. Role is a badge on the
// name, activation folds into Status, subscription into Plan.
export const DEFAULT_VISIBLE_USER_COLUMNS: UserVisibleColumnId[] = [
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
export const LEGACY_DEFAULT_VISIBLE_USER_COLUMNS: UserVisibleColumnId[] = [
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
export const SOCIAL_PROVIDER_OPTIONS: Array<{ value: SocialProviderFilter; label: string }> = [
    { value: 'google', label: 'Google' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'kakao', label: 'Kakao' },
    { value: 'apple', label: 'Apple' },
    { value: 'github', label: 'GitHub' },
    { value: 'discord', label: 'Discord' },
    { value: 'other_social', label: 'Other social' },
];
export const USER_DETAIL_TAB_LABELS: Record<UserDetailTab, string> = {
    overview: 'Overview',
    profile: 'Profile & access',
    billing: 'Billing',
    trips: 'Trips',
    activity: 'Activity',
};
export const USER_QUEUE_EVENTS = {
    awaiting_activation: 'admin__users_queue--awaiting_activation',
    subscriptions_at_risk: 'admin__users_queue--subscriptions_at_risk',
    empty_accounts: 'admin__users_queue--empty_accounts',
} as const;

export const parseAdminUsersDateRange = (value: string | null): AdminDateRange => {
    if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
    return DEFAULT_USERS_DATE_RANGE;
};

export const parseUserSortKey = (value: string | null): UserSortKey => (
    USER_SORT_KEYS.includes(value as UserSortKey) ? value as UserSortKey : DEFAULT_USERS_SORT_KEY
);

export const parseUserSortDirection = (value: string | null): UserSortDirection => {
    if (value === 'asc' || value === 'desc') return value;
    return DEFAULT_USERS_SORT_DIRECTION;
};

/** Comma-separated query values, kept only when allowed and returned in `allowedValues` order. */
export const parseQueryMultiValue = <T extends string>(
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

export const parsePositivePage = (value: string | null): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.floor(parsed));
};

/** Columns in render order, always including User. Unknown or empty input falls back to the default set. */
export const sanitizeUserVisibleColumns = (values: string[] | null | undefined): UserVisibleColumnId[] => {
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

export const parseUserVisibleColumns = (value: string | null): UserVisibleColumnId[] => {
    const parsed = parseQueryMultiValue(value, USER_VISIBLE_COLUMN_IDS);
    if (parsed.length === 0) return [...DEFAULT_VISIBLE_USER_COLUMNS];
    return sanitizeUserVisibleColumns(parsed);
};

export const restoreCachedUserVisibleColumns = (cached: string[] | null | undefined): UserVisibleColumnId[] => {
    if (Array.isArray(cached) && isSameColumnSet(cached, LEGACY_DEFAULT_VISIBLE_USER_COLUMNS)) {
        return [...DEFAULT_VISIBLE_USER_COLUMNS];
    }
    return sanitizeUserVisibleColumns(cached);
};

export const isDefaultUserColumnSet = (columns: readonly UserVisibleColumnId[]): boolean => (
    columns.length === DEFAULT_VISIBLE_USER_COLUMNS.length
    && columns.every((columnId, index) => columnId === DEFAULT_VISIBLE_USER_COLUMNS[index])
);

export const buildUsersColumnsCacheKey = (userId: string | null | undefined): string => {
    const normalized = typeof userId === 'string' ? userId.trim() : '';
    return `${USERS_COLUMNS_CACHE_KEY_PREFIX}.${normalized || 'anonymous'}`;
};

// ---------------------------------------------------------------------------
// Filters

export interface UserTableFilters {
    role: UserRole[];
    tier: PlanTierKey[];
    status: UserAccountStatus[];
    activation: UserActivationStatus[];
    loginType: UserLoginType[];
    socialProvider: SocialProviderFilter[];
    trips: UserTripFilter[];
    terms: UserTermsState[];
    subscription: UserSubscriptionStatus[];
}

export type UserTableFilterKey = keyof UserTableFilters;

export const EMPTY_USER_TABLE_FILTERS: UserTableFilters = {
    role: [],
    tier: [],
    status: [],
    activation: [],
    loginType: [],
    socialProvider: [],
    trips: [],
    terms: [],
    subscription: [],
};

/** Reads every table filter from the query, including the legacy `identity` filter. */
export const parseUserTableFilters = (params: Pick<URLSearchParams, 'get'>): UserTableFilters => {
    let activation = parseQueryMultiValue(params.get('activation'), USER_ACTIVATION_VALUES);
    if (activation.length === 0) {
        // Legacy URL support from prior identity filter.
        const legacyIdentity = params.get('identity');
        if (legacyIdentity === 'identified') activation = ['activated', 'invited'];
        if (legacyIdentity === 'anonymous') activation = ['pending', 'anonymous'];
    }
    return {
        role: parseQueryMultiValue(params.get('role'), USER_ROLE_VALUES),
        tier: parseQueryMultiValue(params.get('tier'), PLAN_ORDER),
        status: parseQueryMultiValue(params.get('status'), USER_STATUS_VALUES),
        activation,
        loginType: parseQueryMultiValue(params.get('login'), USER_LOGIN_TYPE_VALUES),
        socialProvider: parseQueryMultiValue(params.get('social'), SOCIAL_PROVIDER_VALUES),
        trips: parseQueryMultiValue(params.get('trips'), USER_TRIP_FILTER_VALUES),
        terms: parseQueryMultiValue(params.get('terms'), USER_TERMS_STATE_VALUES),
        subscription: parseQueryMultiValue(params.get('subscription'), USER_SUBSCRIPTION_VALUES),
    };
};

/** Filters a work queue never sets. With one of them on, no queue counts as applied. */
export const hasNonQueueUserFilters = (filters: UserTableFilters): boolean => (
    filters.role.length > 0
    || filters.tier.length > 0
    || filters.status.length > 0
    || filters.loginType.length > 0
    || filters.terms.length > 0
);

export const hasActiveUserFilters = (filters: UserTableFilters): boolean => (
    hasNonQueueUserFilters(filters)
    || filters.activation.length > 0
    || filters.subscription.length > 0
    || filters.trips.length > 0
);

/** Subscription, role and terms sit behind "More filters" until one of them is set. */
export const hasActiveMoreUserFilters = (filters: UserTableFilters): boolean => (
    filters.subscription.length > 0 || filters.role.length > 0 || filters.terms.length > 0
);

export const resolveAppliedUserQueueForFilters = (filters: UserTableFilters): UserQueueId | null => (
    resolveAppliedUserQueue(
        { activation: filters.activation, subscription: filters.subscription, trips: filters.trips },
        hasNonQueueUserFilters(filters)
    )
);

// ---------------------------------------------------------------------------
// Sign-in method labels

export type LoginPillKey = 'password' | SocialProviderFilter | 'anonymous' | 'unknown';

export const LOGIN_PILL_LABELS: Record<LoginPillKey, string> = {
    password: 'Email',
    google: 'Google',
    facebook: 'Facebook',
    kakao: 'Kakao',
    apple: 'Apple',
    github: 'GitHub',
    discord: 'Discord',
    other_social: 'Other social',
    anonymous: 'Guest',
    unknown: 'Unknown',
};

/** The sign-in pills a row shows: password, then each social provider, else Guest or Unknown. */
export const getUserLoginPillKeys = (user: AdminUserRecord): LoginPillKey[] => {
    const profile = resolveUserLoginProfile(user);
    const keys: LoginPillKey[] = [];
    if (profile.hasPassword) keys.push('password');
    profile.socialProviders.forEach((provider) => keys.push(provider));
    if (keys.length === 0 && profile.isAnonymousOnly) keys.push('anonymous');
    if (keys.length === 0) keys.push('unknown');
    return keys;
};

export const getLoginMethodSummary = (user: AdminUserRecord): string => (
    getUserLoginPillKeys(user).map((key) => LOGIN_PILL_LABELS[key]).join(', ')
);

export const getLoginSearchText = (user: AdminUserRecord): string => {
    const profile = resolveUserLoginProfile(user);
    return `${profile.providers.join(' ')} ${getLoginMethodSummary(user)}`.trim().toLowerCase();
};

const matchesLoginFilters = (
    user: AdminUserRecord,
    loginTypes: readonly UserLoginType[],
    socialProviders: readonly SocialProviderFilter[]
): boolean => {
    if (loginTypes.length === 0) return true;
    const loginProfile = resolveUserLoginProfile(user);
    if (loginTypes.includes('password') && loginProfile.hasPassword) return true;
    if (loginTypes.includes('unknown') && loginProfile.isUnknown) return true;
    if (loginTypes.includes('social') && loginProfile.socialProviders.length > 0) {
        if (socialProviders.length === 0) return true;
        if (loginProfile.socialProviders.some((provider) => socialProviders.includes(provider))) return true;
    }
    return false;
};

export interface LoginFilterCounts {
    password: number;
    social: number;
    unknown: number;
    socialProviders: Record<SocialProviderFilter, number>;
}

export const countUserLoginFilters = (users: AdminUserRecord[]): LoginFilterCounts => {
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
    users.forEach((user) => {
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
    return { password, social, unknown, socialProviders };
};

// ---------------------------------------------------------------------------
// Filtering, sorting and paging

export const getPlanName = (tier: PlanTierKey): string => PLAN_CATALOG[tier]?.publicName || tier;

export const filterUsersByDateRange = (users: AdminUserRecord[], dateRange: AdminDateRange): AdminUserRecord[] => (
    users.filter((user) => isIsoDateInRange(user.created_at, dateRange))
);

/** Applies every table filter and the free-text search. */
export const filterAdminUsers = (
    users: AdminUserRecord[],
    filters: UserTableFilters,
    search: string,
    currentTermsVersion: string | null
): AdminUserRecord[] => {
    const token = search.trim().toLowerCase();
    return users.filter((user) => {
        const accountStatus = getUserAccountStatus(user);
        const activationStatus = resolveActivationStatus(user);
        const subscriptionStatus = resolveUserSubscriptionStatus(user);
        if (filters.role.length > 0 && !filters.role.includes(user.system_role)) return false;
        if (filters.tier.length > 0 && !filters.tier.includes(user.tier_key)) return false;
        if (filters.subscription.length > 0 && !filters.subscription.includes(subscriptionStatus)) return false;
        if (filters.status.length > 0 && !filters.status.includes(accountStatus)) return false;
        if (filters.activation.length > 0 && !filters.activation.includes(activationStatus)) return false;
        if (!matchesLoginFilters(user, filters.loginType, filters.socialProvider)) return false;
        if (filters.trips.length > 0 && !filters.trips.some((tripFilter) => matchesUserTripFilter(user, tripFilter))) {
            return false;
        }
        const termsState = resolveUserTermsState(user, currentTermsVersion);
        if (filters.terms.length > 0 && !filters.terms.includes(termsState)) return false;
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
};

const getUserSortValue = (
    user: AdminUserRecord,
    sortKey: UserSortKey,
    currentTermsVersion: string | null
): string | number => {
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

/** Stable sort on a copy; numbers compare numerically, everything else as strings. */
export const sortAdminUsers = (
    users: AdminUserRecord[],
    sortKey: UserSortKey,
    sortDirection: UserSortDirection,
    currentTermsVersion: string | null
): AdminUserRecord[] => Array.from(users).sort((a, b) => {
    const left = getUserSortValue(a, sortKey, currentTermsVersion);
    const right = getUserSortValue(b, sortKey, currentTermsVersion);
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

/** Clicking the sorted column flips it; another column starts ascending. */
export const toggleUserSort = (
    current: { sortKey: UserSortKey; sortDirection: UserSortDirection },
    key: UserSortKey
): { sortKey: UserSortKey; sortDirection: UserSortDirection } => {
    if (current.sortKey === key) {
        return { sortKey: key, sortDirection: current.sortDirection === 'asc' ? 'desc' : 'asc' };
    }
    return { sortKey: key, sortDirection: 'asc' };
};

export const getPageCount = (totalItems: number, pageSize: number): number => Math.max(Math.ceil(totalItems / pageSize), 1);

/** The requested page, clamped to the pages that exist. */
export const clampPage = (page: number, totalItems: number, pageSize: number): number => (
    Math.min(page, getPageCount(totalItems, pageSize))
);

export const slicePage = <T>(items: readonly T[], page: number, pageSize: number): T[] => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
};

export interface UsersFilterOptions {
    status: AdminFilterMenuOption[];
    activation: AdminFilterMenuOption[];
    tier: AdminFilterMenuOption[];
    trips: AdminFilterMenuOption[];
    subscription: AdminFilterMenuOption[];
    role: AdminFilterMenuOption[];
    terms: AdminFilterMenuOption[];
}

/** Filter menu options with counts over the users in the date range. */
export const buildUsersFilterOptions = (
    usersInDateRange: AdminUserRecord[],
    currentTermsVersion: string | null
): UsersFilterOptions => ({
    status: USER_STATUS_VALUES.map((value) => ({
        value,
        label: formatAccountStatusLabel(value),
        count: usersInDateRange.filter((user) => getUserAccountStatus(user) === value).length,
    })),
    role: USER_ROLE_VALUES.map((value) => ({
        value,
        label: value === 'admin' ? 'Admin' : 'User',
        count: usersInDateRange.filter((user) => user.system_role === value).length,
    })),
    tier: PLAN_ORDER.map((value) => ({
        value,
        label: getPlanName(value),
        count: usersInDateRange.filter((user) => user.tier_key === value).length,
    })),
    subscription: USER_SUBSCRIPTION_VALUES.map((value) => ({
        value,
        label: getUserSubscriptionStatusLabel(value),
        count: usersInDateRange.filter((user) => resolveUserSubscriptionStatus(user) === value).length,
    })),
    activation: USER_ACTIVATION_VALUES.map((value) => ({
        value,
        label: getActivationStatusLabel(value),
        count: usersInDateRange.filter((user) => resolveActivationStatus(user) === value).length,
    })),
    trips: USER_TRIP_FILTER_VALUES.map((value) => ({
        value,
        label: USER_TRIP_FILTER_LABELS[value],
        count: usersInDateRange.filter((user) => matchesUserTripFilter(user, value)).length,
    })),
    terms: USER_TERMS_STATE_VALUES.map((value) => ({
        value,
        label: getUserTermsStateLabel(value),
        count: usersInDateRange.filter((user) => resolveUserTermsState(user, currentTermsVersion) === value).length,
    })),
});

// ---------------------------------------------------------------------------
// URL

export interface UsersSearchParamsInput {
    search: string;
    dateRange: AdminDateRange;
    filters: UserTableFilters;
    sortKey: UserSortKey;
    sortDirection: UserSortDirection;
    /** The page the table shows, already clamped. */
    page: number;
    visibleColumns: UserVisibleColumnId[];
    /** The account whose sheet is open or deep-linked, if any. */
    drawerUserId: string | null;
}

const setMultiValue = (next: URLSearchParams, key: string, values: readonly string[], allCount: number) => {
    if (values.length > 0 && values.length < allCount) next.set(key, values.join(','));
};

/** The query that mirrors the table. Defaults and "everything selected" are left out. */
export const buildUsersSearchParams = (input: UsersSearchParamsInput): URLSearchParams => {
    const { filters } = input;
    const next = new URLSearchParams();
    const trimmedSearch = input.search.trim();
    if (trimmedSearch) next.set('q', trimmedSearch);
    if (input.dateRange !== DEFAULT_USERS_DATE_RANGE) next.set('range', input.dateRange);
    setMultiValue(next, 'role', filters.role, USER_ROLE_VALUES.length);
    setMultiValue(next, 'tier', filters.tier, PLAN_ORDER.length);
    setMultiValue(next, 'status', filters.status, USER_STATUS_VALUES.length);
    setMultiValue(next, 'activation', filters.activation, USER_ACTIVATION_VALUES.length);
    setMultiValue(next, 'login', filters.loginType, USER_LOGIN_TYPE_VALUES.length);
    if (filters.loginType.includes('social')) {
        setMultiValue(next, 'social', filters.socialProvider, SOCIAL_PROVIDER_VALUES.length);
    }
    setMultiValue(next, 'trips', filters.trips, USER_TRIP_FILTER_VALUES.length);
    setMultiValue(next, 'terms', filters.terms, USER_TERMS_STATE_VALUES.length);
    setMultiValue(next, 'subscription', filters.subscription, USER_SUBSCRIPTION_VALUES.length);
    if (input.sortKey !== DEFAULT_USERS_SORT_KEY) next.set('sort', input.sortKey);
    if (input.sortDirection !== DEFAULT_USERS_SORT_DIRECTION) next.set('dir', input.sortDirection);
    if (input.page > 1) next.set('page', String(input.page));
    if (!isDefaultUserColumnSet(input.visibleColumns)) next.set('cols', input.visibleColumns.join(','));
    if (input.drawerUserId) {
        next.set('user', input.drawerUserId);
        next.set('drawer', 'user');
    }
    return next;
};

/** `?user=<id>&drawer=user` opens that account's sheet. */
export const getDeepLinkedUserId = (params: Pick<URLSearchParams, 'get'>): string | null => {
    const drawer = params.get('drawer');
    const userId = params.get('user');
    if (drawer !== 'user' || !userId) return null;
    return userId;
};

export const buildAdminTripsLinkForUser = (user: Pick<AdminUserRecord, 'email' | 'user_id'>): string => (
    `/admin/trips?q=${encodeURIComponent((user.email || '').trim() || user.user_id)}`
);

export const getUserPublicProfilePath = (username: string | null | undefined): string | null => {
    const normalizedUsername = (username || '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,40}$/.test(normalizedUsername)) return null;
    return buildPath('publicProfile', { username: normalizedUsername });
};

// ---------------------------------------------------------------------------
// CSV export

const escapeCsvField = (value: string | null | undefined): string => {
    const normalized = value ?? '';
    return `"${normalized.replace(/"/g, '""')}"`;
};

const buildCsvLine = (fields: Array<string | null | undefined>): string => fields.map((field) => escapeCsvField(field)).join(',');

export const sanitizeFilenameSegment = (value: string): string => {
    const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
    return normalized || 'users';
};

/** Billing columns for the given users, one quoted CSV line each after the header. */
export const buildUsersBillingCsv = (users: AdminUserRecord[]): string => {
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
    const rows = users.map((user) => buildCsvLine([
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
    return [header, ...rows].join('\n');
};

export const buildUsersBillingCsvFileName = (isoNow: string): string => (
    `admin-users-billing-${sanitizeFilenameSegment(isoNow.slice(0, 10))}.csv`
);

// ---------------------------------------------------------------------------
// Detail sheet

export const getUsernameCooldownMeta = (
    usernameChangedAt: string | null | undefined,
    nowMs: number = Date.now()
): { isActive: boolean; endsAt: string | null } => {
    const parsed = Date.parse(usernameChangedAt || '');
    if (!Number.isFinite(parsed)) {
        return { isActive: false, endsAt: null };
    }
    const endsDate = new Date(parsed + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    return {
        isActive: nowMs < endsDate.getTime(),
        endsAt: endsDate.toISOString(),
    };
};

export type ProfileGenderDraft = '' | 'female' | 'male' | 'non-binary' | 'prefer-not';

const VALID_PROFILE_GENDERS = new Set(['female', 'male', 'non-binary', 'prefer-not']);

export const toProfileGenderDraft = (value: string | null | undefined): ProfileGenderDraft => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim().toLowerCase();
    if (!normalized) return '';
    return VALID_PROFILE_GENDERS.has(normalized) ? (normalized as ProfileGenderDraft) : '';
};

export interface UserProfileDraft {
    firstName: string;
    lastName: string;
    username: string;
    gender: ProfileGenderDraft;
    country: string;
    city: string;
    preferredLanguage: string;
    accountStatus: UserAccountStatus;
    role: UserRole;
}

export const EMPTY_USER_PROFILE_DRAFT: UserProfileDraft = {
    firstName: '',
    lastName: '',
    username: '',
    gender: '',
    country: '',
    city: '',
    preferredLanguage: 'en',
    accountStatus: 'active',
    role: 'user',
};

/** The editable profile fields for a record; the username keeps its display casing. */
export const toUserProfileDraft = (user: AdminUserRecord): UserProfileDraft => ({
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    username: user.username_display || user.username || '',
    gender: toProfileGenderDraft(user.gender),
    country: user.country || '',
    city: user.city || '',
    preferredLanguage: user.preferred_language || 'en',
    accountStatus: user.account_status || 'active',
    role: user.system_role,
});

export const formatOverrideDraft = (value: Record<string, unknown> | null | undefined): string => {
    if (!value || Object.keys(value).length === 0) return '';
    return JSON.stringify(value, null, 2);
};

/** Parses the overrides textarea. Empty means no overrides; throws on invalid JSON or a non-object. */
export const parseOverrideDraft = (value: string): Record<string, unknown> => {
    if (!value.trim()) return {};
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Overrides JSON must be an object.');
    }
    return parsed as Record<string, unknown>;
};

export const normalizeOverrideRecord = (value: unknown): Record<string, unknown> => {
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

/** Deep equality that ignores key order, so re-saving reformatted JSON writes nothing. */
export const areOverrideRecordsEqual = (left: Record<string, unknown>, right: Record<string, unknown>): boolean => (
    JSON.stringify(toStableComparableJson(left)) === JSON.stringify(toStableComparableJson(right))
);

export const formatSubscriptionAmount = (
    user: Pick<AdminUserRecord, 'subscription_amount' | 'subscription_currency'>
): string => (
    user.subscription_amount !== null && user.subscription_amount !== undefined
        ? `${user.subscription_currency || '—'} ${(user.subscription_amount / 100).toFixed(2)}`
        : '—'
);

export const formatFieldLabel = (value: string): string => {
    const spaced = value.replace(/_/g, ' ').trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value;
};

export const asString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

export const hasSnapshotData = (value: Record<string, unknown> | null | undefined): boolean => Object.keys(asRecord(value)).length > 0;

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

/** A change row has a full diff when it carries snapshots or points at a trip version. */
export const canOpenUserChangeFullDiff = (log: AdminUserChangeRecord): boolean => {
    if (hasSnapshotData(log.before_data) || hasSnapshotData(log.after_data)) return true;
    if (log.target_type !== 'trip' || !log.target_id) return false;
    const metadata = asRecord(log.metadata);
    return Boolean(asString(metadata.version_id));
};

// ---------------------------------------------------------------------------
// Deletion and transfer

const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const isLikelyUserId = (value: string): boolean => USER_ID_PATTERN.test(value.trim());
export const isLikelyEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

export const getUserReferenceText = (user: AdminUserRecord): string => {
    const name = getUserDisplayName(user);
    const email = (user.email || '').trim();
    if (email) return `${name} (${email})`;
    return `${name} (${user.user_id})`;
};

/** Loaded users whose id or email equals the transfer target input exactly (case-insensitive). */
export const findLocalTransferTargets = (users: AdminUserRecord[], rawInput: string): AdminUserRecord[] => {
    const normalizedLower = rawInput.trim().toLowerCase();
    return users.filter((candidate) => {
        const candidateEmail = (candidate.email || '').trim().toLowerCase();
        if (candidate.user_id.toLowerCase() === normalizedLower) return true;
        if (candidateEmail && candidateEmail === normalizedLower) return true;
        return false;
    });
};

export const summarizeBulkDeleteFailures = (details: string[]): string => {
    if (details.length === 0) return '';
    const maxVisible = 5;
    const visible = details.slice(0, maxVisible).map((detail) => `- ${detail}`).join('\n');
    if (details.length <= maxVisible) return visible;
    return `${visible}\n- +${details.length - maxVisible} more failure${details.length - maxVisible === 1 ? '' : 's'}`;
};

/** The error shown above the table after a bulk hard delete, or null when every delete succeeded. */
export const buildBulkHardDeleteErrorMessage = (deleted: number, failedDetails: string[]): string | null => {
    const failed = failedDetails.length;
    if (failed === 0) return null;
    const detailSummary = summarizeBulkDeleteFailures(failedDetails);
    if (deleted === 0) {
        return detailSummary
            ? `Could not hard-delete selected users.\n${detailSummary}`
            : 'Could not hard-delete selected users.';
    }
    return detailSummary
        ? `${failed} user${failed === 1 ? '' : 's'} failed to hard-delete.\n${detailSummary}`
        : `${failed} user${failed === 1 ? '' : 's'} failed to hard-delete.`;
};
