import type { PlanTierKey } from '../../types';
import { formatAdminRelativeTime } from './adminRelativeTime';
import type { AdminUserRecord } from '../../services/adminService';
import type { AdminStatusTone } from './AdminStatusBadge';
import {
    humanizeAdminBillingStatus,
    normalizeAdminBillingStatus,
    resolveAdminBillingStatusTone,
} from '../../services/adminBillingPresentation';
import { resolveBillingAccessUntil, resolveBillingLifecycleState } from '../../lib/billing/subscriptionState';

/**
 * Pure classification for the admin Users screen: how an account is labelled,
 * filtered and queued. Kept out of the page so it can be tested without
 * rendering 4,000 lines of UI.
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


export const formatRelativeTimestamp = (
    value: string | null | undefined,
    fallback = 'Never',
    now: number = Date.now()
): string => formatAdminRelativeTime(value, now, fallback);

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
