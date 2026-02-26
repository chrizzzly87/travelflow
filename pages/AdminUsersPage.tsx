import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AppleLogo,
    ArrowSquareOut,
    ArrowsDownUp,
    CaretDown,
    ChatCircleDots,
    ChartBarHorizontal,
    DiscordLogo,
    DotsThreeVertical,
    EnvelopeSimple,
    FacebookLogo,
    GithubLogo,
    GoogleLogo,
    Key,
    Question,
    SpinnerGap,
    Trash,
    X,
    UserPlus,
} from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { PROFILE_ACCOUNT_STATUS_OPTIONS, PROFILE_GENDER_OPTIONS } from '../config/profileFields';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import {
    adminCreateUserDirect,
    adminCreateUserInvite,
    adminGetUserProfile,
    adminHardDeleteUser,
    adminListUserTrips,
    adminListUsers,
    adminUpdateTrip,
    adminUpdateUserOverrides,
    adminUpdateUserProfile,
    type AdminTripRecord,
    type AdminUserRecord,
} from '../services/adminService';
import type { PlanTierKey } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Drawer, DrawerContent } from '../components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
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
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { useAppDialog } from '../components/AppDialogProvider';

type SortKey = 'name' | 'email' | 'total_trips' | 'activation_status' | 'last_sign_in_at' | 'created_at' | 'tier_key' | 'system_role' | 'account_status';
type SortDirection = 'asc' | 'desc';
type UserActivationStatus = 'activated' | 'invited' | 'pending' | 'anonymous';
type UserAccountStatus = 'active' | 'disabled' | 'deleted';
type UserLoginType = 'social' | 'password' | 'unknown';
type UserTripFilter = 'no_trips_no_profile' | 'no_trips' | 'one_to_two' | 'three_to_five' | 'six_plus';
type SocialProviderFilter = 'google' | 'facebook' | 'kakao' | 'apple' | 'github' | 'discord' | 'other_social';
type LoginPillKey = 'password' | SocialProviderFilter | 'anonymous' | 'unknown';

const PAGE_SIZE = 25;
const GENDER_UNSET_VALUE = '__gender_unset__';
const USERS_CACHE_KEY = 'admin.users.cache.v1';
const USER_ROLE_VALUES = ['admin', 'user'] as const;
const USER_STATUS_VALUES: ReadonlyArray<UserAccountStatus> = ['active', 'disabled', 'deleted'];
const USER_ACTIVATION_VALUES: ReadonlyArray<UserActivationStatus> = ['activated', 'invited', 'pending', 'anonymous'];
const USER_LOGIN_TYPE_VALUES: ReadonlyArray<UserLoginType> = ['social', 'password', 'unknown'];
const USER_TRIP_FILTER_VALUES: ReadonlyArray<UserTripFilter> = ['no_trips_no_profile', 'no_trips', 'one_to_two', 'three_to_five', 'six_plus'];
const SOCIAL_PROVIDER_VALUES: ReadonlyArray<SocialProviderFilter> = [
    'google',
    'facebook',
    'kakao',
    'apple',
    'github',
    'discord',
    'other_social',
];
const SOCIAL_PROVIDER_OPTIONS: Array<{ value: SocialProviderFilter; label: string }> = [
    { value: 'google', label: 'Gmail' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'kakao', label: 'Kakao' },
    { value: 'apple', label: 'Apple' },
    { value: 'github', label: 'GitHub' },
    { value: 'discord', label: 'Discord' },
    { value: 'other_social', label: 'Other social' },
];
const USER_TRIP_FILTER_LABELS: Record<UserTripFilter, string> = {
    no_trips_no_profile: 'No trips + no profile data',
    no_trips: 'No trips',
    one_to_two: '1-2 trips',
    three_to_five: '3-5 trips',
    six_plus: '6+ trips',
};
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const VALID_PROFILE_GENDERS = new Set(['female', 'male', 'non-binary', 'prefer-not']);

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface LoginPillDefinition {
    label: string;
    className: string;
    icon: IconComponent;
}

interface UserLoginProfile {
    providers: string[];
    hasPassword: boolean;
    socialProviders: SocialProviderFilter[];
    isUnknown: boolean;
    isAnonymousOnly: boolean;
}

const LOGIN_PILL_DEFINITIONS: Record<LoginPillKey, LoginPillDefinition> = {
    password: {
        label: 'Username/password',
        className: 'border-slate-300 bg-slate-50 text-slate-700',
        icon: Key,
    },
    google: {
        label: 'Gmail',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: GoogleLogo,
    },
    facebook: {
        label: 'Facebook',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
        icon: FacebookLogo,
    },
    kakao: {
        label: 'Kakao',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: ChatCircleDots,
    },
    apple: {
        label: 'Apple',
        className: 'border-slate-400 bg-slate-100 text-slate-800',
        icon: AppleLogo,
    },
    github: {
        label: 'GitHub',
        className: 'border-zinc-400 bg-zinc-100 text-zinc-800',
        icon: GithubLogo,
    },
    discord: {
        label: 'Discord',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        icon: DiscordLogo,
    },
    other_social: {
        label: 'Other social',
        className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
        icon: ChatCircleDots,
    },
    anonymous: {
        label: 'Anonymous',
        className: 'border-violet-300 bg-violet-50 text-violet-700',
        icon: Question,
    },
    unknown: {
        label: 'Unknown',
        className: 'border-slate-300 bg-slate-50 text-slate-600',
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
        || value === 'created_at'
        || value === 'tier_key'
        || value === 'system_role'
        || value === 'account_status') {
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
    value
        .split(',')
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .forEach((chunk) => {
            if (allowSet.has(chunk)) {
                unique.add(chunk);
            }
        });
    return allowedValues.filter((candidate) => unique.has(candidate));
};

const parsePositivePage = (value: string | null): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.floor(parsed));
};

const toDateTimeInputValue = (value: string | null): string => {
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

const fromDateTimeInputValue = (value: string): string | null => {
    if (!value.trim()) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
};

const formatTimestamp = (value: string | null | undefined): string => {
    if (!value) return 'No visit yet';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return 'No visit yet';
    return new Date(parsed).toLocaleString();
};

const getUserDisplayName = (user: AdminUserRecord): string => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (user.display_name?.trim()) return user.display_name.trim();
    if (user.username?.trim()) return user.username.trim();
    return 'Unnamed user';
};

const resolveActivationStatus = (user: AdminUserRecord): UserActivationStatus => {
    const providerCandidates = [
        ...(Array.isArray(user.auth_providers) ? user.auth_providers : []),
        user.auth_provider || '',
    ]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
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

const getActivationStatusLabel = (status: UserActivationStatus): string => {
    if (status === 'activated') return 'Activated';
    if (status === 'invited') return 'Invited';
    if (status === 'pending') return 'Pending activation';
    return 'Anonymous';
};

const activationPillClass = (status: UserActivationStatus): string => {
    if (status === 'activated') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
    if (status === 'invited') return 'border-sky-300 bg-sky-50 text-sky-800';
    if (status === 'pending') return 'border-amber-300 bg-amber-50 text-amber-800';
    return 'border-violet-300 bg-violet-50 text-violet-800';
};

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

const resolveUserLoginProfile = (user: AdminUserRecord): UserLoginProfile => {
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

const hasNonEmptyValue = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0);
const isLikelyUserId = (value: string): boolean => USER_ID_PATTERN.test(value.trim());
const isLikelyEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim());

const getUserTotalTrips = (user: AdminUserRecord): number => Math.max(0, Number(user.total_trips || 0));

const getUserActiveTrips = (user: AdminUserRecord): number => Math.max(0, Number(user.active_trips || 0));
const isUserHardDeleteEligible = (user: AdminUserRecord): boolean => (user.account_status || 'active') !== 'deleted';

const isUserTriplessAndNoData = (user: AdminUserRecord): boolean => {
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

const matchesUserTripFilter = (user: AdminUserRecord, filter: UserTripFilter): boolean => {
    const totalTrips = getUserTotalTrips(user);
    if (filter === 'no_trips_no_profile') return isUserTriplessAndNoData(user);
    if (filter === 'no_trips') return totalTrips === 0;
    if (filter === 'one_to_two') return totalTrips >= 1 && totalTrips <= 2;
    if (filter === 'three_to_five') return totalTrips >= 3 && totalTrips <= 5;
    return totalTrips >= 6;
};
const getUserReferenceText = (user: AdminUserRecord): string => {
    const name = getUserDisplayName(user);
    const email = (user.email || '').trim();
    if (email) return `${name} (${email})`;
    return `${name} (${user.user_id})`;
};

const getUnknownErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    if (typeof error === 'string' && error.trim()) return error.trim();
    return fallback;
};

const summarizeBulkDeleteFailures = (details: string[]): string => {
    if (details.length === 0) return '';
    const maxVisible = 5;
    const visible = details.slice(0, maxVisible).map((detail) => `- ${detail}`).join('\n');
    if (details.length <= maxVisible) return visible;
    return `${visible}\n- +${details.length - maxVisible} more failure${details.length - maxVisible === 1 ? '' : 's'}`;
};

const buildSingleHardDeleteMessage = (
    userRef: string,
    ownedTripCount: number
): string => {
    const tripLabel = `${ownedTripCount} owned trip${ownedTripCount === 1 ? '' : 's'}`;
    return [
        `Account: ${userRef}`,
        '',
        'Permanent delete impact',
        '• Auth account',
        '• Profile record',
        `• ${tripLabel}`,
        '• All related versions, share links, and collaborators for those trips',
        '',
        ownedTripCount > 0 ? 'Trip ownership choices before confirm' : '',
        ownedTripCount > 0 ? '• Cancel and use "Transfer trips + hard delete" to preserve trip ownership' : '',
        ownedTripCount > 0 ? '• Continue hard delete to permanently remove those trips' : '',
        '',
        'This cannot be undone.',
    ].join('\n');
};

const buildBulkHardDeleteMessage = (
    selectedUsers: number,
    selectedTrips: number
): string => {
    return [
        `Selected users: ${selectedUsers}`,
        '',
        'Permanent delete impact',
        `• Auth accounts + profiles for ${selectedUsers} user${selectedUsers === 1 ? '' : 's'}`,
        `• ${selectedTrips} owned trip${selectedTrips === 1 ? '' : 's'} in total`,
        '• All related versions, share links, and collaborators for those trips',
        '',
        selectedTrips > 0 ? 'Trip ownership choices before confirm' : '',
        selectedTrips > 0 ? '• Cancel and transfer trips from each user drawer if you need to preserve data' : '',
        selectedTrips > 0 ? '• Continue hard delete to permanently remove selected users and owned trips' : '',
        '',
        'This cannot be undone.',
    ].join('\n');
};

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

const rolePillClass = (role: 'admin' | 'user') => (
    role === 'admin'
        ? 'border-accent-300 bg-accent-50 text-accent-900'
        : 'border-slate-300 bg-slate-50 text-slate-700'
);

const statusPillClass = (status: UserAccountStatus) => {
    if (status === 'active') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
    if (status === 'disabled') return 'border-amber-300 bg-amber-50 text-amber-800';
    return 'border-rose-300 bg-rose-50 text-rose-800';
};

const formatAccountStatusLabel = (status: UserAccountStatus): string => {
    if (status === 'disabled') return 'Suspended';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const tierPillClass = (tier: PlanTierKey) => {
    if (tier === 'tier_premium') return 'border-violet-300 bg-violet-50 text-violet-800';
    if (tier === 'tier_mid') return 'border-sky-300 bg-sky-50 text-sky-800';
    return 'border-slate-300 bg-slate-50 text-slate-700';
};

interface CreateInviteDraft {
    email: string;
    firstName: string;
    lastName: string;
    tierKey: PlanTierKey;
}

interface CreateDirectDraft extends CreateInviteDraft {
    password: string;
}

const INITIAL_INVITE_DRAFT: CreateInviteDraft = {
    email: '',
    firstName: '',
    lastName: '',
    tierKey: 'tier_free',
};

const INITIAL_DIRECT_DRAFT: CreateDirectDraft = {
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    tierKey: 'tier_free',
};

const UserRowActionsMenu: React.FC<{
    disabled: boolean;
    isDeleted: boolean;
    onOpenDetails: () => void;
    onSoftDelete: () => void;
}> = ({ disabled, isDeleted, onOpenDetails, onSoftDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const onPointer = (event: PointerEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsOpen(false);
        };
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onEscape);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                disabled={disabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Open user actions"
            >
                <DotsThreeVertical size={16} />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[170px] rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            onOpenDetails();
                        }}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                        Open details
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            onSoftDelete();
                        }}
                        className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-amber-800 hover:bg-amber-50"
                    >
                        {isDeleted ? 'Restore user' : 'Soft-delete user'}
                    </button>
                </div>
            )}
        </div>
    );
};

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
        if (selectedLoginTypes.length === 0) return 'All';
        const labels: string[] = [];
        if (selectedLoginTypeSet.has('social')) {
            if (socialIndeterminate) labels.push(`Social (${activeSocialProviderCount})`);
            else labels.push('Social');
        }
        if (selectedLoginTypeSet.has('password')) labels.push('Username/password');
        if (selectedLoginTypeSet.has('unknown')) labels.push('Unknown');
        return labels.join(', ');
    }, [activeSocialProviderCount, selectedLoginTypeSet, selectedLoginTypes.length, socialIndeterminate]);

    const updateMenuPosition = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const viewportPadding = 10;
        const preferredWidth = Math.max(320, rect.width + 70);
        const maxLeft = window.innerWidth - preferredWidth - viewportPadding;
        const nextLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
        setMenuPosition({
            top: rect.bottom + 8,
            left: nextLeft,
            width: preferredWidth,
        });
    };

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

    return (
        <div>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    updateMenuPosition();
                    setIsOpen((current) => !current);
                }}
                className={`inline-flex h-8 w-fit items-center justify-center whitespace-nowrap rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label="Filter by login type"
                aria-expanded={isOpen}
            >
                <Key size={14} className="mr-2 text-slate-500 shrink-0" weight="duotone" />
                <span>Login type</span>
                
                <div className="mx-2 flex h-4 items-center">
                    <div className="h-full w-[1px] bg-slate-200" />
                </div>
                
                <span className="inline-flex items-center rounded-sm bg-slate-100 px-1 font-normal text-slate-800 max-w-[220px] truncate">
                    {selectedLabelSummary}
                </span>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[1700] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md animate-in fade-in-80"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        width: `${menuPosition.width}px`,
                    }}
                >
                    <div className="px-2 py-1.5 text-xs font-medium text-slate-500">
                        Login type
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="space-y-0.5 p-1">
                        <label className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 group">
                            <div className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selectedLoginTypeSet.has('password')}
                                    onCheckedChange={(checked) => setLoginTypeChecked('password', Boolean(checked))}
                                    className="h-4 w-4"
                                />
                            </div>
                            <span>Username/password</span>
                            <span className="ml-auto text-xs text-slate-500">{counts.password}</span>
                        </label>
                        <label className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 group">
                            <div className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={socialCheckboxState}
                                    onCheckedChange={(checked) => setSocialParentChecked(Boolean(checked))}
                                    className="h-4 w-4"
                                />
                            </div>
                            <span>Social</span>
                            <span className="ml-auto text-xs text-slate-500">{counts.social}</span>
                        </label>
                        <div className={`ms-6 space-y-0.5 border-l-2 border-slate-100 pl-2 ${socialEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                            {SOCIAL_PROVIDER_OPTIONS.map((option) => {
                                const checked = socialEnabled
                                    && (selectedSocialProviders.length === 0 || selectedSocialProviderSet.has(option.value));
                                const definition = LOGIN_PILL_DEFINITIONS[option.value];
                                const Icon = definition.icon;
                                return (
                                    <label
                                        key={`social-provider-filter-${option.value}`}
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-xs outline-none hover:bg-slate-100 hover:text-slate-900 group"
                                    >
                                        <div className="mr-2 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => toggleSocialProvider(option.value)}
                                                className="h-3.5 w-3.5 rounded-[2px]"
                                            />
                                        </div>
                                        <Icon size={12} className="mr-1.5 text-slate-500" />
                                        <span>{option.label}</span>
                                        <span className="ml-auto text-[10px] text-slate-500">{counts.socialProviders[option.value]}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <label className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 group">
                            <div className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                                <Checkbox
                                    checked={selectedLoginTypeSet.has('unknown')}
                                    onCheckedChange={(checked) => setLoginTypeChecked('unknown', Boolean(checked))}
                                    className="h-4 w-4"
                                />
                            </div>
                            <span>Unknown</span>
                            <span className="ml-auto text-xs text-slate-500">{counts.unknown}</span>
                        </label>
                    </div>
                    {selectedLoginTypeSet.size > 0 && (
                        <>
                            <div className="h-px bg-slate-100" />
                            <div className="p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectedLoginTypesChange([]);
                                        onSelectedSocialProvidersChange([]);
                                        setIsOpen(false);
                                    }}
                                    className="relative flex w-full cursor-default select-none items-center justify-center rounded-sm py-1.5 text-sm font-medium outline-none hover:bg-slate-100 hover:text-slate-900"
                                >
                                    Clear filters
                                </button>
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
    const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')));
    const [sortDirection, setSortDirection] = useState<SortDirection>(() => parseSortDirection(searchParams.get('dir')));
    const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());

    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [createMode, setCreateMode] = useState<'invite' | 'direct'>('invite');
    const [inviteDraft, setInviteDraft] = useState<CreateInviteDraft>(INITIAL_INVITE_DRAFT);
    const [directDraft, setDirectDraft] = useState<CreateDirectDraft>(INITIAL_DIRECT_DRAFT);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
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
    const handledDeepLinkUserIdRef = useRef<string | null>(null);
    const deepLinkedUserId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const userId = searchParams.get('user');
        if (drawer !== 'user' || !userId) return null;
        return userId;
    }, [searchParams]);

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
        if (sortKey !== 'created_at') next.set('sort', sortKey);
        if (sortDirection !== 'desc') next.set('dir', sortDirection);
        if (page > 1) next.set('page', String(page));
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
        dateRange,
        isDetailOpen,
        loginTypeFilters,
        page,
        roleFilters,
        searchParams,
        searchValue,
        selectedUserId,
        setSearchParams,
        sortDirection,
        sortKey,
        socialProviderFilters,
        statusFilters,
        tierFilters,
        tripFilters,
    ]);

    useEffect(() => {
        if (!deepLinkedUserId) {
            handledDeepLinkUserIdRef.current = null;
            return;
        }
        if (handledDeepLinkUserIdRef.current !== deepLinkedUserId) {
            setSelectedUserId(deepLinkedUserId);
            setIsDetailOpen(true);
            handledDeepLinkUserIdRef.current = deepLinkedUserId;
        }

        const hasInTable = users.some((user) => user.user_id === deepLinkedUserId);
        if (hasInTable) return;

        let active = true;
        void adminGetUserProfile(deepLinkedUserId)
            .then((profile) => {
                if (!active || !profile) return;
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
                setErrorMessage(error instanceof Error ? error.message : 'Could not load linked user profile.');
            });

        return () => {
            active = false;
        };
    }, [deepLinkedUserId, users]);

    const selectedUser = useMemo(
        () => users.find((user) => user.user_id === selectedUserId) || null,
        [selectedUserId, users]
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
    }, [isLoadingTrips, selectedUser?.active_trips, selectedUser?.total_trips, userTrips]);
    const selectedUserTripsPageLink = useMemo(() => {
        if (!selectedUser) return null;
        const token = (selectedUser.email || '').trim() || selectedUser.user_id;
        return `/admin/trips?q=${encodeURIComponent(token)}`;
    }, [selectedUser]);

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
            const reason = error instanceof Error ? error.message : 'Could not load users.';
            if (!options.preserveErrorMessage) {
                setErrorMessage(reason);
            }
            const cachedRows = readAdminCache<AdminUserRecord[]>(USERS_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setUsers(cachedRows);
                setDataSourceNotice(`Live admin users failed. Showing ${cachedRows.length} cached row${cachedRows.length === 1 ? '' : 's'} from this browser. Reason: ${reason}`);
            } else {
                setUsers([]);
            }
        } finally {
            setIsLoadingUsers(false);
        }
    };

    useEffect(() => {
        void loadUsers();
    }, []);

    useEffect(() => {
        if (!selectedUser) return;
        let active = true;

        setTierDraft(selectedUser.tier_key);
        setOverrideDraft(formatOverrideDraft(selectedUser.entitlements_override));
        setProfileDraft({
            firstName: selectedUser.first_name || '',
            lastName: selectedUser.last_name || '',
            username: selectedUser.username || '',
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
                    username: fullProfile.username || '',
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
                setErrorMessage(error instanceof Error ? error.message : 'Could not load full user profile.');
            });

        setUserTrips([]);
        setIsLoadingTrips(true);
        void adminListUserTrips(selectedUser.user_id)
            .then((rows) => setUserTrips(rows))
            .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Could not load user trips.'))
            .finally(() => setIsLoadingTrips(false));

        return () => {
            active = false;
        };
    }, [selectedUser]);

    const filteredUsers = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        const filtered = users.filter((user) => {
            const accountStatus = (user.account_status || 'active') as UserAccountStatus;
            const activationStatus = resolveActivationStatus(user);
            const loginProfile = resolveUserLoginProfile(user);
            if (!isIsoDateInRange(user.created_at, dateRange)) return false;
            if (roleFilters.length > 0 && !roleFilters.includes(user.system_role)) return false;
            if (tierFilters.length > 0 && !tierFilters.includes(user.tier_key)) return false;
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
            if (!token) return true;
            return (
                getUserDisplayName(user).toLowerCase().includes(token)
                || (user.email || '').toLowerCase().includes(token)
                || user.user_id.toLowerCase().includes(token)
                || getLoginSearchText(user).includes(token)
                || (user.username || '').toLowerCase().includes(token)
                || getActivationStatusLabel(activationStatus).toLowerCase().includes(token)
            );
        });

        const getSortValue = (user: AdminUserRecord): string | number => {
            if (sortKey === 'name') return getUserDisplayName(user).toLowerCase();
            if (sortKey === 'email') return (user.email || '').toLowerCase();
            if (sortKey === 'total_trips') return getUserTotalTrips(user);
            if (sortKey === 'activation_status') return resolveActivationStatus(user);
            if (sortKey === 'last_sign_in_at') return Date.parse(user.last_sign_in_at || '') || 0;
            if (sortKey === 'created_at') return Date.parse(user.created_at || '') || 0;
            if (sortKey === 'tier_key') return String(user.tier_key || '').toLowerCase();
            if (sortKey === 'system_role') return String(user.system_role || '').toLowerCase();
            return String(user.account_status || 'active').toLowerCase();
        };

        const sorted = [...filtered].sort((a, b) => {
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
        dateRange,
        loginTypeFilters,
        roleFilters,
        searchValue,
        socialProviderFilters,
        sortDirection,
        sortKey,
        statusFilters,
        tierFilters,
        tripFilters,
        users,
    ]);

    const usersInDateRange = useMemo(
        () => users.filter((user) => isIsoDateInRange(user.created_at, dateRange)),
        [dateRange, users]
    );

    const usersSummary = useMemo(() => {
        const total = filteredUsers.length;
        const activeAccounts = filteredUsers.filter((user) => (user.account_status || 'active') === 'active').length;
        const pendingActivation = filteredUsers.filter((user) => {
            const activationStatus = resolveActivationStatus(user);
            return activationStatus === 'pending' || activationStatus === 'invited';
        }).length;
        const activationBuckets: Record<UserActivationStatus, number> = {
            activated: 0,
            invited: 0,
            pending: 0,
            anonymous: 0,
        };
        filteredUsers.forEach((user) => {
            activationBuckets[resolveActivationStatus(user)] += 1;
        });
        return {
            total,
            activeAccounts,
            pendingActivation,
            activeRatioPct: total > 0 ? Math.round((activeAccounts / total) * 100) : 0,
            pendingRatioPct: total > 0 ? Math.round((pendingActivation / total) * 100) : 0,
            activationBuckets,
        };
    }, [filteredUsers]);

    const statusFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => USER_STATUS_VALUES.map((value) => ({
            value,
            label: value === 'disabled' ? 'Suspended' : value.charAt(0).toUpperCase() + value.slice(1),
            count: usersInDateRange.filter((user) => (user.account_status || 'active') === value).length,
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
            label: PLAN_CATALOG[value].publicName,
            count: usersInDateRange.filter((user) => user.tier_key === value).length,
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
    const pagedUsers = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredUsers.slice(start, start + PAGE_SIZE);
    }, [filteredUsers, page]);
    const selectedVisibleUsers = useMemo(
        () => filteredUsers.filter((user) => selectedUserIds.has(user.user_id)),
        [filteredUsers, selectedUserIds]
    );
    const hardDeleteSelectableVisibleUsers = useMemo(
        () => filteredUsers.filter((user) => isUserHardDeleteEligible(user)),
        [filteredUsers]
    );
    const areAllVisibleUsersSelected = hardDeleteSelectableVisibleUsers.length > 0
        && hardDeleteSelectableVisibleUsers.every((user) => selectedUserIds.has(user.user_id));
    const isVisibleUserSelectionPartial = selectedVisibleUsers.length > 0 && !areAllVisibleUsersSelected;

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    useEffect(() => {
        setSelectedUserIds((current) => {
            if (current.size === 0) return current;
            const allowed = new Set(filteredUsers.map((user) => user.user_id));
            let changed = false;
            const next = new Set<string>();
            current.forEach((userId) => {
                if (allowed.has(userId)) {
                    next.add(userId);
                    return;
                }
                changed = true;
            });
            return changed ? next : current;
        });
    }, [filteredUsers]);

    useEffect(() => {
        setSelectedUserIds((current) => {
            if (current.size === 0) return current;
            const eligible = new Set(filteredUsers.filter((user) => isUserHardDeleteEligible(user)).map((user) => user.user_id));
            let changed = false;
            const next = new Set<string>();
            current.forEach((userId) => {
                if (eligible.has(userId)) {
                    next.add(userId);
                    return;
                }
                changed = true;
            });
            return changed ? next : current;
        });
    }, [filteredUsers]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortKey(key);
        setSortDirection('asc');
    };

    const openUserDetail = (userId: string) => {
        setSelectedUserId(userId);
        setIsDetailOpen(true);
    };

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

    const saveSelectedUser = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
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
            setMessage('User updated.');
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not save user.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSoftDelete = async (user: AdminUserRecord) => {
        const nextStatus = (user.account_status || 'active') === 'deleted' ? 'active' : 'deleted';
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminUpdateUserProfile(user.user_id, { accountStatus: nextStatus });
            setMessage(nextStatus === 'deleted' ? 'User soft-deleted.' : 'User restored.');
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not update user status.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleHardDelete = async (user: AdminUserRecord) => {
        if (!isUserHardDeleteEligible(user)) {
            setErrorMessage('Hard delete is unavailable for soft-deleted users.');
            return;
        }
        const sourceTripCount = selectedUser?.user_id === user.user_id
            ? selectedUserTripStats.total
            : getUserTotalTrips(user);
        const confirmed = await confirmDialog({
            title: 'Hard delete user',
            message: buildSingleHardDeleteMessage(getUserReferenceText(user), sourceTripCount),
            confirmLabel: 'Hard delete',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminHardDeleteUser(user.user_id);
            setMessage(
                sourceTripCount > 0
                    ? `User permanently deleted. ${sourceTripCount} owned trip${sourceTripCount === 1 ? '' : 's'} were removed with this hard delete.`
                    : 'User permanently deleted.'
            );
            setIsDetailOpen(false);
            setSelectedUserId(null);
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not hard-delete user.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkSoftDeleteUsers = async () => {
        if (selectedVisibleUsers.length === 0) return;
        const confirmed = await confirmDialog({
            title: 'Soft delete selected users',
            message: `Soft-delete ${selectedVisibleUsers.length} selected user${selectedVisibleUsers.length === 1 ? '' : 's'}?`,
            confirmLabel: 'Soft delete',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await Promise.all(selectedVisibleUsers.map((user) => adminUpdateUserProfile(user.user_id, { accountStatus: 'deleted' })));
            setMessage(`${selectedVisibleUsers.length} user${selectedVisibleUsers.length === 1 ? '' : 's'} soft-deleted.`);
            setSelectedUserIds(new Set());
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not soft-delete selected users.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkHardDeleteUsers = async () => {
        if (selectedVisibleUsers.length === 0) return;
        const hardDeleteUsers = selectedVisibleUsers.filter((user) => isUserHardDeleteEligible(user));
        const skippedUsers = selectedVisibleUsers.length - hardDeleteUsers.length;
        if (hardDeleteUsers.length === 0) {
            setErrorMessage('No eligible users selected for hard delete. Soft-deleted users are skipped.');
            return;
        }
        const selectedTripCount = hardDeleteUsers.reduce((sum, user) => sum + getUserTotalTrips(user), 0);
        const confirmed = await confirmDialog({
            title: 'Hard delete selected users',
            message: buildBulkHardDeleteMessage(hardDeleteUsers.length, selectedTripCount),
            confirmLabel: 'Hard delete',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
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
            if (deleted > 0) {
                const deletedTripCount = hardDeleteUsers
                    .filter((_, index) => results[index]?.status === 'fulfilled')
                    .reduce((sum, user) => sum + getUserTotalTrips(user), 0);
                const deleteMessage = (
                    failed > 0
                        ? `${deleted} user${deleted === 1 ? '' : 's'} hard-deleted (${deletedTripCount} owned trip${deletedTripCount === 1 ? '' : 's'} removed). ${failed} failed.`
                        : `${deleted} user${deleted === 1 ? '' : 's'} permanently deleted (${deletedTripCount} owned trip${deletedTripCount === 1 ? '' : 's'} removed).`
                );
                setMessage(skippedUsers > 0 ? `${deleteMessage} ${skippedUsers} soft-deleted user${skippedUsers === 1 ? '' : 's'} were skipped.` : deleteMessage);
            } else if (skippedUsers > 0) {
                setMessage(`${skippedUsers} soft-deleted user${skippedUsers === 1 ? '' : 's'} were skipped.`);
            }
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
                setSelectedUserId(null);
                setIsDetailOpen(false);
            }
            await loadUsers({ preserveErrorMessage: Boolean(bulkErrorMessage) });
            if (bulkErrorMessage) {
                setErrorMessage(bulkErrorMessage);
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not hard-delete selected users.');
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

        const transferTargetInput = await promptDialog({
            title: 'Transfer trips before hard delete',
            message: 'Enter the target user email or UUID. All owned trips will move to this account before hard delete.',
            label: 'Target user (email or UUID)',
            placeholder: 'name@example.com or user UUID',
            confirmLabel: 'Continue',
            cancelLabel: 'Cancel',
            tone: 'danger',
            inputType: 'text',
        });
        if (transferTargetInput === null) return;

        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const targetUser = await resolveTransferTargetUser(transferTargetInput);
            if (targetUser.user_id === user.user_id) {
                throw new Error('Target user must be different from the user being deleted.');
            }

            const targetStatus = (targetUser.account_status || 'active') as UserAccountStatus;
            if (targetStatus !== 'active') {
                throw new Error('Target user must be an active account.');
            }

            const sourceTrips = await adminListUserTrips(user.user_id, { status: 'all' });
            if (sourceTrips.length === 0) {
                throw new Error('No owned trips found to transfer. Reload and try again.');
            }

            const confirmed = await confirmDialog({
                title: 'Confirm transfer and hard delete',
                message: [
                    `Transfer ${sourceTrips.length} trip${sourceTrips.length === 1 ? '' : 's'} from ${getUserReferenceText(user)} to ${getUserReferenceText(targetUser)}?`,
                    '',
                    'Step 1: Transfer all owned trips to the target account.',
                    'Step 2: Hard-delete the source user (auth + profile only).',
                    '',
                    'Result: trips remain accessible under the new owner.',
                ].join('\n'),
                confirmLabel: 'Transfer + hard delete',
                cancelLabel: 'Cancel',
                tone: 'danger',
            });
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
                setMessage(
                    [
                        `Transferred ${sourceTrips.length} trip${sourceTrips.length === 1 ? '' : 's'} to ${getUserReferenceText(targetUser)} and permanently deleted the source user.`,
                        `Audit should show ${sourceTrips.length} "Transferred trip owner" entr${sourceTrips.length === 1 ? 'y' : 'ies'} and one "Hard-deleted user" entry.`,
                    ].join(' ')
                );
                setIsDetailOpen(false);
                setSelectedUserId(null);
                await loadUsers();
            } catch (deleteError) {
                await loadUsers();
                const deleteMessage = deleteError instanceof Error ? deleteError.message : 'Could not hard-delete user after transfer.';
                setErrorMessage(
                    `Trips were transferred to ${getUserReferenceText(targetUser)}, but hard delete failed: ${deleteMessage} Retry hard delete for the source user if needed.`
                );
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not transfer trips before hard delete.');
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
        setMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, patch);
            setMessage('Trip updated.');
            if (selectedUser) {
                const rows = await adminListUserTrips(selectedUser.user_id);
                setUserTrips(rows);
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not update trip.');
        } finally {
            setIsSaving(false);
        }
    };

    const submitCreateInvite = async () => {
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminCreateUserInvite({
                ...inviteDraft,
                redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined,
            });
            setInviteDraft(INITIAL_INVITE_DRAFT);
            setIsCreateDialogOpen(false);
            setMessage('Invite sent successfully.');
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not invite user.');
        } finally {
            setIsSaving(false);
        }
    };

    const submitCreateDirect = async () => {
        if (directDraft.password.trim().length < 8) {
            setErrorMessage('Direct creation requires a password with at least 8 characters.');
            return;
        }
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminCreateUserDirect(directDraft);
            setDirectDraft(INITIAL_DIRECT_DRAFT);
            setIsCreateDialogOpen(false);
            setMessage('User created successfully.');
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not create user.');
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
        setPage(1);
    };

    return (
        <AdminShell
            title="User Provisioning"
            description="Manage users, identity state, tiers, access roles, and trip ownership from one workspace."
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
                    <button
                        type="button"
                        onClick={() => setIsCreateDialogOpen(true)}
                        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white hover:bg-accent-700"
                    >
                        <UserPlus size={14} />
                        Create user
                    </button>
                </>
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
            {isSaving && (
                <section className="mb-4 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">
                    <span className="inline-flex items-center gap-2 font-medium">
                        <SpinnerGap size={14} className="animate-spin" />
                        Processing admin changes. Please wait...
                    </span>
                </section>
            )}

            <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total users</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">
                        <AdminCountUpNumber value={usersSummary.total} />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Within active table scope</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Active account ratio</p>
                    <p className="mt-2 inline-flex items-baseline gap-0.5 text-3xl font-black text-emerald-700">
                        <AdminCountUpNumber value={usersSummary.activeRatioPct} />
                        <span className="text-xl">%</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        <AdminCountUpNumber value={usersSummary.activeAccounts} /> active accounts
                    </p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pending activation</p>
                    <p className="mt-2 text-3xl font-black text-amber-700">
                        <AdminCountUpNumber value={usersSummary.pendingActivation} />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{usersSummary.pendingRatioPct}% of visible users</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Activation mix</p>
                        <ChartBarHorizontal size={16} className="text-slate-500" />
                    </div>
                    <div className="mt-3 space-y-2">
                        {USER_ACTIVATION_VALUES.map((activation) => {
                            const count = usersSummary.activationBuckets[activation];
                            const pct = usersSummary.total > 0 ? Math.round((count / usersSummary.total) * 100) : 0;
                            return (
                                <div key={`activation-mix-${activation}`} className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                                        <span>{getActivationStatusLabel(activation)}</span>
                                        <span>{count} ({pct}%)</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-slate-100">
                                        <div className="h-1.5 rounded-full bg-slate-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </article>
            </section>

            <section
                className={`relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${isSaving ? 'pointer-events-none opacity-80' : ''}`}
                aria-busy={isSaving}
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Users</h2>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <AdminFilterMenu
                            label="Activation"
                            options={activationFilterOptions}
                            selectedValues={activationFilters}
                            onSelectedValuesChange={(next) => {
                                setActivationFilters(next as UserActivationStatus[]);
                                setPage(1);
                            }}
                        />
                        <LoginTypeFilterMenu
                            selectedLoginTypes={loginTypeFilters}
                            selectedSocialProviders={socialProviderFilters}
                            counts={loginFilterCounts}
                            onSelectedLoginTypesChange={(next) => {
                                setLoginTypeFilters(next);
                                setPage(1);
                            }}
                            onSelectedSocialProvidersChange={(next) => {
                                setSocialProviderFilters(next);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="# Trips"
                            options={tripFilterOptions}
                            selectedValues={tripFilters}
                            onSelectedValuesChange={(next) => {
                                setTripFilters(next as UserTripFilter[]);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Status"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={(next) => {
                                setStatusFilters(next as UserAccountStatus[]);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Role"
                            options={roleFilterOptions}
                            selectedValues={roleFilters}
                            onSelectedValuesChange={(next) => {
                                setRoleFilters(next as Array<'admin' | 'user'>);
                                setPage(1);
                            }}
                        />
                        <AdminFilterMenu
                            label="Tier"
                            options={tierFilterOptions}
                            selectedValues={tierFilters}
                            onSelectedValuesChange={(next) => {
                                setTierFilters(next as PlanTierKey[]);
                                setPage(1);
                            }}
                        />
                        <button
                            type="button"
                            onClick={resetTableFilters}
                            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            <X size={14} />
                            Reset
                        </button>
                    </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                    Cleanup shortcut: use <span className="font-semibold text-slate-700"># Trips</span> and select
                    <span className="font-semibold text-slate-700"> No trips + no profile data</span>.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">
                        {selectedVisibleUsers.length} selected
                    </span>
                    <button
                        type="button"
                        onClick={() => void handleBulkSoftDeleteUsers()}
                        disabled={isSaving || selectedVisibleUsers.length === 0}
                        className="inline-flex h-8 items-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Soft-delete selected
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleBulkHardDeleteUsers()}
                        disabled={isSaving || selectedVisibleUsers.every((user) => !isUserHardDeleteEligible(user))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash size={12} />
                        Hard delete selected
                    </button>
                    {selectedVisibleUsers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedUserIds(new Set())}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-12 px-4 py-3">
                                    <Checkbox
                                        checked={areAllVisibleUsersSelected ? true : (isVisibleUserSelectionPartial ? 'indeterminate' : false)}
                                        onCheckedChange={(checked) => toggleSelectAllVisibleUsers(Boolean(checked))}
                                        aria-label="Select all visible users"
                                    />
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('name')}>
                                        User <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('email')}>
                                        Login <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('total_trips')}>
                                        Trips <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('activation_status')}>
                                        Activation <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('system_role')}>
                                        Role <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('tier_key')}>
                                        Tier <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('account_status')}>
                                        Status <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('last_sign_in_at')}>
                                        Last visit <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">
                                    <button type="button" className="inline-flex items-center gap-1 hover:text-accent-700" onClick={() => toggleSort('created_at')}>
                                        Created <ArrowsDownUp size={12} />
                                    </button>
                                </TableHead>
                                <TableHead className="px-4 py-3 text-right font-semibold text-slate-700">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pagedUsers.map((user) => {
                                const userName = getUserDisplayName(user);
                                const accountStatus = (user.account_status || 'active') as UserAccountStatus;
                                const activationStatus = resolveActivationStatus(user);
                                const isSelected = selectedUserIds.has(user.user_id);
                                const isHardDeleteEligible = isUserHardDeleteEligible(user);
                                const isTriplessNoData = isUserTriplessAndNoData(user);
                                return (
                                    <TableRow
                                        key={user.user_id}
                                        data-state={isSelected ? "selected" : undefined}
                                    >
                                        <TableCell className="px-4 py-3">
                                            <Checkbox
                                                checked={isSelected}
                                                disabled={!isHardDeleteEligible}
                                                onCheckedChange={(checked) => toggleUserSelection(user.user_id, Boolean(checked))}
                                                aria-label={isHardDeleteEligible ? `Select ${userName}` : `Cannot select ${userName} (soft-deleted)`}
                                            />
                                        </TableCell>
                                        <TableCell className="px-4 py-3 max-w-[280px]">
                                            <button
                                                type="button"
                                                onClick={() => openUserDetail(user.user_id)}
                                                title="Open details drawer"
                                                className="group xl:max-w-full cursor-pointer text-left hover:text-accent-700"
                                            >
                                                <div className="truncate text-sm font-semibold text-slate-800 group-hover:underline group-hover:decoration-slate-400">{userName}</div>
                                                <div className="truncate text-xs text-slate-600">{user.email || 'No email address'}</div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    UUID:{' '}
                                                    <CopyableUuid
                                                        value={user.user_id}
                                                        focusable={false}
                                                        className="align-middle"
                                                        textClassName="max-w-full truncate text-[11px]"
                                                        hintClassName="text-[9px]"
                                                    />
                                                </div>
                                            </button>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {getLoginPills(user).map((pill) => {
                                                    const Icon = pill.icon;
                                                    return (
                                                        <span key={`${user.user_id}-login-pill-${pill.label}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>
                                                            <Icon size={11} />
                                                            {pill.label}
                                                        </span>
                                                    );
                                                })}
                                                {activationStatus === 'pending' && (
                                                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                        Needs activation
                                                    </span>
                                                )}
                                                {activationStatus === 'invited' && (
                                                    <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                                                        Invite sent
                                                    </span>
                                                )}
                                                {activationStatus === 'anonymous' && (
                                                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                                        Temp
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-xs text-slate-600">
                                            <div className="font-semibold text-slate-800 hover:text-accent-700">
                                                {getUserTotalTrips(user)} total
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {getUserActiveTrips(user)} active
                                            </div>
                                            {isTriplessNoData && (
                                                <div className="text-[11px] font-semibold text-amber-700">
                                                    No profile data
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${activationPillClass(activationStatus)}`}>
                                                {getActivationStatusLabel(activationStatus)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rolePillClass(user.system_role)}`}>
                                                {user.system_role === 'admin' ? 'Admin' : 'User'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tierPillClass(user.tier_key)}`}>
                                                {PLAN_CATALOG[user.tier_key]?.publicName || user.tier_key}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(accountStatus)}`}>
                                                {formatAccountStatusLabel(accountStatus)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-xs text-slate-600 max-w-[120px] truncate">{formatTimestamp(user.last_sign_in_at)}</TableCell>
                                        <TableCell className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">{new Date(user.created_at).toLocaleString()}</TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <UserRowActionsMenu
                                                disabled={isSaving}
                                                isDeleted={accountStatus === 'deleted'}
                                                onOpenDetails={() => openUserDetail(user.user_id)}
                                                onSoftDelete={() => {
                                                    void handleSoftDelete(user);
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {pagedUsers.length === 0 && !isLoadingUsers && (
                                <TableRow>
                                    <TableCell className="px-4 py-8 text-center text-sm text-slate-500" colSpan={11}>
                                        No users match your filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoadingUsers && (
                                <TableRow>
                                    <TableCell className="px-4 py-8 text-center text-sm text-slate-500" colSpan={11}>
                                        <span className="inline-flex items-center gap-2 font-medium">
                                            <SpinnerGap size={16} className="animate-spin text-slate-400" />
                                            Loading users...
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        {filteredUsers.length === 0
                            ? 'Showing 0 users'
                            : `Showing ${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filteredUsers.length)} of ${filteredUsers.length}`}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.max(current - 1, 1))}
                            disabled={page === 1}
                            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span>Page {page} / {pageCount}</span>
                        <button
                            type="button"
                            onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
                            disabled={page >= pageCount}
                            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
                {isSaving && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/45 backdrop-blur-[1px]">
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                            <SpinnerGap size={13} className="animate-spin" />
                            Applying changes...
                        </span>
                    </div>
                )}
            </section>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="w-[min(96vw,760px)]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-black">
                            <UserPlus size={16} className="text-accent-700" />
                            Create user
                        </DialogTitle>
                        <DialogDescription>
                            Invite sends a password setup link. Direct creates the account immediately with a temporary password.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 px-5 pb-5">
                        <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setCreateMode('invite')}
                                className={`rounded-md px-3 py-1.5 font-semibold ${createMode === 'invite' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <EnvelopeSimple size={13} />
                                    Invite
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreateMode('direct')}
                                className={`rounded-md px-3 py-1.5 font-semibold ${createMode === 'direct' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                            >
                                <span className="inline-flex items-center gap-1">
                                    <UserPlus size={13} />
                                    Direct
                                </span>
                            </button>
                        </div>

                        {createMode === 'invite' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1 sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                                    <input
                                        value={inviteDraft.email}
                                        onChange={(event) => setInviteDraft((current) => ({ ...current, email: event.target.value }))}
                                        placeholder="name@example.com"
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</span>
                                    <input
                                        value={inviteDraft.firstName}
                                        onChange={(event) => setInviteDraft((current) => ({ ...current, firstName: event.target.value }))}
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</span>
                                    <input
                                        value={inviteDraft.lastName}
                                        onChange={(event) => setInviteDraft((current) => ({ ...current, lastName: event.target.value }))}
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1 sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Starting tier</span>
                                    <Select
                                        value={inviteDraft.tierKey}
                                        onValueChange={(value) => setInviteDraft((current) => ({ ...current, tierKey: value as PlanTierKey }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PLAN_ORDER.map((tierKey) => (
                                                <SelectItem key={`invite-tier-${tierKey}`} value={tierKey}>
                                                    {PLAN_CATALOG[tierKey].publicName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </label>
                                <div className="sm:col-span-2">
                                    <button
                                        type="button"
                                        onClick={() => void submitCreateInvite()}
                                        disabled={isSaving || !inviteDraft.email.trim()}
                                        className="inline-flex h-9 items-center rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                                    >
                                        Send invite
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1 sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                                    <input
                                        value={directDraft.email}
                                        onChange={(event) => setDirectDraft((current) => ({ ...current, email: event.target.value }))}
                                        placeholder="name@example.com"
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</span>
                                    <input
                                        value={directDraft.firstName}
                                        onChange={(event) => setDirectDraft((current) => ({ ...current, firstName: event.target.value }))}
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</span>
                                    <input
                                        value={directDraft.lastName}
                                        onChange={(event) => setDirectDraft((current) => ({ ...current, lastName: event.target.value }))}
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1 sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Initial password</span>
                                    <input
                                        value={directDraft.password}
                                        onChange={(event) => setDirectDraft((current) => ({ ...current, password: event.target.value }))}
                                        type="password"
                                        placeholder="Minimum 8 characters"
                                        className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                </label>
                                <label className="space-y-1 sm:col-span-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Starting tier</span>
                                    <Select
                                        value={directDraft.tierKey}
                                        onValueChange={(value) => setDirectDraft((current) => ({ ...current, tierKey: value as PlanTierKey }))}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PLAN_ORDER.map((tierKey) => (
                                                <SelectItem key={`direct-tier-${tierKey}`} value={tierKey}>
                                                    {PLAN_CATALOG[tierKey].publicName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </label>
                                <div className="sm:col-span-2">
                                    <button
                                        type="button"
                                        onClick={() => void submitCreateDirect()}
                                        disabled={isSaving || !directDraft.email.trim() || !directDraft.password.trim()}
                                        className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        Create user
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Drawer
                open={isDetailOpen}
                onOpenChange={(open) => {
                    setIsDetailOpen(open);
                    if (open) return;
                    setSelectedUserId(null);
                    if (!searchParams.has('user') && searchParams.get('drawer') !== 'user') return;
                    const next = new URLSearchParams(searchParams);
                    next.delete('user');
                    next.delete('drawer');
                    setSearchParams(next, { replace: true });
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,680px)] p-0"
                    accessibleTitle={selectedUser ? `${getUserDisplayName(selectedUser)} details` : 'User details'}
                    accessibleDescription="Inspect and edit profile, entitlement overrides, account state, and connected trips."
                >
                    {!selectedUser ? (
                        <div className="p-4 text-sm text-slate-500">No user selected.</div>
                    ) : (
                        <div className="flex h-full flex-col">
                            <div className="border-b border-slate-200 px-5 py-4">
                                <h2 className="text-base font-black text-slate-900">{getUserDisplayName(selectedUser)}</h2>
                                <p className="truncate text-sm text-slate-600">
                                    {selectedUser.email || (
                                        <CopyableUuid
                                            value={selectedUser.user_id}
                                            className="align-middle"
                                            textClassName="max-w-[360px] truncate text-sm"
                                        />
                                    )}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-slate-600">
                                        {selectedUserTripStats.active} active trips / {selectedUserTripStats.total} total trips
                                    </p>
                                    {selectedUserTripsPageLink && (
                                        <a
                                            href={selectedUserTripsPageLink}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Open in Trips
                                            <ArrowSquareOut size={12} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                <section className="space-y-3 rounded-xl border border-slate-200 p-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profile and access</h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">First name</span>
                                        <input
                                            value={profileDraft.firstName}
                                            onChange={(event) => setProfileDraft((current) => ({ ...current, firstName: event.target.value }))}
                                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last name</span>
                                        <input
                                            value={profileDraft.lastName}
                                            onChange={(event) => setProfileDraft((current) => ({ ...current, lastName: event.target.value }))}
                                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
                                        <input
                                            value={profileDraft.username}
                                            onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))}
                                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</span>
                                        <Select
                                            value={profileDraft.gender || GENDER_UNSET_VALUE}
                                            onValueChange={(value) => {
                                                setProfileDraft((current) => ({
                                                    ...current,
                                                    gender: value === GENDER_UNSET_VALUE ? '' : value as '' | 'female' | 'male' | 'non-binary' | 'prefer-not',
                                                }));
                                            }}
                                        >
                                            <SelectTrigger className="h-9">
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
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country/Region</span>
                                        <ProfileCountryRegionSelect
                                            value={profileDraft.country}
                                            placeholder="Search country or region"
                                            clearLabel="Clear country/region"
                                            emptyLabel="No countries found"
                                            toggleLabel="Toggle country/region options"
                                            onValueChange={(nextCode) => setProfileDraft((current) => ({ ...current, country: nextCode }))}
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">City</span>
                                        <input
                                            value={profileDraft.city}
                                            onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))}
                                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred language</span>
                                        <input
                                            value={profileDraft.preferredLanguage}
                                            onChange={(event) => setProfileDraft((current) => ({ ...current, preferredLanguage: event.target.value }))}
                                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account status</span>
                                        <Select
                                            value={profileDraft.accountStatus}
                                            onValueChange={(value) => setProfileDraft((current) => ({ ...current, accountStatus: value as 'active' | 'disabled' | 'deleted' }))}
                                        >
                                            <SelectTrigger className="h-9">
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
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</span>
                                        <Select
                                            value={profileDraft.role}
                                            onValueChange={(value) => setProfileDraft((current) => ({ ...current, role: value as 'admin' | 'user' }))}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="user">User</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</span>
                                        <Select
                                            value={tierDraft}
                                            onValueChange={(value) => setTierDraft(value as PlanTierKey)}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PLAN_ORDER.map((tierKey) => (
                                                    <SelectItem key={`profile-tier-${tierKey}`} value={tierKey}>
                                                        {PLAN_CATALOG[tierKey].publicName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </label>
                                </div>
                                </section>

                                <section className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Entitlement overrides (advanced)</h3>
                                <p className="text-xs text-slate-500">
                                    Optional JSON object. Leave this field empty to inherit all limits from the selected tier.
                                </p>
                                <textarea
                                    value={overrideDraft}
                                    onChange={(event) => setOverrideDraft(event.target.value)}
                                    placeholder={`{\n  "maxActiveTrips": 15\n}`}
                                    className="min-h-[140px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                                />
                                {!overrideDraft.trim() && (
                                    <p className="text-xs text-slate-500">No override configured for this user.</p>
                                )}
                                </section>

                                <section className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 p-3">
                                <button
                                    type="button"
                                    onClick={() => void saveSelectedUser()}
                                    disabled={isSaving}
                                    className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                                >
                                    Save user
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleSoftDelete(selectedUser)}
                                    disabled={isSaving}
                                    className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                >
                                    {(selectedUser.account_status || 'active') === 'deleted' ? 'Restore user' : 'Soft-delete user'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleHardDelete(selectedUser)}
                                    disabled={isSaving || !isUserHardDeleteEligible(selectedUser)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                >
                                    <Trash size={13} />
                                    Hard delete
                                </button>
                                {selectedUserTripStats.total > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => void handleTransferTripsAndHardDelete(selectedUser)}
                                        disabled={isSaving || isLoadingTrips}
                                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                                    >
                                        Transfer trips + hard delete
                                    </button>
                                )}
                                </section>

                                <section className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Connected trips</h3>
                                {isLoadingTrips ? (
                                    <div className="text-sm text-slate-500">Loading trips...</div>
                                ) : userTrips.length === 0 ? (
                                    <div className="text-sm text-slate-500">No trips owned by this user.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {userTrips.map((trip) => (
                                            <article key={trip.trip_id} className="rounded-lg border border-slate-200 p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <a
                                                            href={`/trip/${encodeURIComponent(trip.trip_id)}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="Open trip in a new tab"
                                                            className="block text-sm font-semibold text-slate-800 hover:text-accent-700 hover:underline"
                                                        >
                                                            {trip.title || trip.trip_id}
                                                        </a>
                                                        <div className="text-[11px] text-slate-500">
                                                            <CopyableUuid
                                                                value={trip.trip_id}
                                                                textClassName="max-w-[300px] truncate text-[11px]"
                                                                hintClassName="text-[9px]"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                    <input
                                                        key={`${trip.trip_id}-${trip.updated_at}`}
                                                        type="datetime-local"
                                                        defaultValue={toDateTimeInputValue(trip.trip_expires_at)}
                                                        onBlur={(event) => {
                                                            void handleTripPatch(trip, { tripExpiresAt: fromDateTimeInputValue(event.target.value) });
                                                        }}
                                                        className="h-8 rounded border border-slate-300 px-2"
                                                    />
                                                    <Select
                                                        value={trip.status}
                                                        onValueChange={(value) => {
                                                            void handleTripPatch(trip, { status: value as 'active' | 'archived' | 'expired' });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-[116px] text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="expired">Expired</SelectItem>
                                                            <SelectItem value="archived">Archived</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <span className="text-slate-500">
                                                        Owner:{' '}
                                                        {trip.owner_email || (
                                                            <CopyableUuid
                                                                value={trip.owner_id}
                                                                className="align-middle"
                                                                textClassName="max-w-[280px] truncate text-xs"
                                                                hintClassName="text-[9px]"
                                                            />
                                                        )}
                                                    </span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                                </section>

                                <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Identity</h3>
                                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                                        <div><span className="font-semibold text-slate-800">Name:</span> {getUserDisplayName(selectedUser)}</div>
                                        <div><span className="font-semibold text-slate-800">Email:</span> {selectedUser.email || 'No email'}</div>
                                        <div className="break-all">
                                            <span className="font-semibold text-slate-800">User ID:</span>{' '}
                                            <CopyableUuid value={selectedUser.user_id} textClassName="break-all text-sm" />
                                        </div>
                                        <div><span className="font-semibold text-slate-800">Activation:</span> {getActivationStatusLabel(resolveActivationStatus(selectedUser))}</div>
                                        <div><span className="font-semibold text-slate-800">Login method:</span> {getLoginMethodSummary(selectedUser)}</div>
                                        <div><span className="font-semibold text-slate-800">Account status:</span> {formatAccountStatusLabel((selectedUser.account_status || 'active') as UserAccountStatus)}</div>
                                        <div><span className="font-semibold text-slate-800">Last visit:</span> {formatTimestamp(selectedUser.last_sign_in_at)}</div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                </DrawerContent>
            </Drawer>
        </AdminShell>
    );
};
