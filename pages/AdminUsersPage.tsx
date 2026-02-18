import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ArrowsDownUp,
    ChartBarHorizontal,
    DotsThreeVertical,
    EnvelopeSimple,
    SpinnerGap,
    Trash,
    X,
    UserPlus,
} from '@phosphor-icons/react';
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
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';

type SortKey = 'name' | 'email' | 'activation_status' | 'last_sign_in_at' | 'created_at' | 'tier_key' | 'system_role' | 'account_status';
type SortDirection = 'asc' | 'desc';
type UserActivationStatus = 'activated' | 'invited' | 'pending' | 'anonymous';
type UserAccountStatus = 'active' | 'disabled' | 'deleted';

const PAGE_SIZE = 25;
const GENDER_UNSET_VALUE = '__gender_unset__';
const USERS_CACHE_KEY = 'admin.users.cache.v1';
const USER_ROLE_VALUES = ['admin', 'user'] as const;
const USER_STATUS_VALUES: ReadonlyArray<UserAccountStatus> = ['active', 'disabled', 'deleted'];
const USER_ACTIVATION_VALUES: ReadonlyArray<UserActivationStatus> = ['activated', 'invited', 'pending', 'anonymous'];

const parseAdminDateRange = (value: string | null): AdminDateRange => {
    if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
    return '30d';
};

const parseSortKey = (value: string | null): SortKey => {
    if (value === 'name'
        || value === 'email'
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
    const explicit = (user.activation_status || '').trim().toLowerCase();
    if (explicit === 'activated' || explicit === 'invited' || explicit === 'pending' || explicit === 'anonymous') {
        return explicit;
    }
    if (explicit === 'pending_activation' || explicit === 'placeholder') return 'pending';
    if (Boolean(user.is_anonymous)) return 'anonymous';
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

const getProviderLabel = (user: AdminUserRecord): string => {
    const activationStatus = resolveActivationStatus(user);
    if (activationStatus === 'pending') return 'Pending activation';
    if (activationStatus === 'anonymous') return 'Anonymous';
    const provider = (user.auth_provider || '').trim().toLowerCase();
    if (!provider || provider === 'email') return 'Email/password';
    if (provider === 'google') return 'Google';
    if (provider === 'apple') return 'Apple';
    if (provider === 'github') return 'GitHub';
    if (provider === 'discord') return 'Discord';
    return provider;
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

export const AdminUsersPage: React.FC = () => {
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
    const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')));
    const [sortDirection, setSortDirection] = useState<SortDirection>(() => parseSortDirection(searchParams.get('dir')));
    const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

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

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (roleFilters.length > 0 && roleFilters.length < USER_ROLE_VALUES.length) next.set('role', roleFilters.join(','));
        if (tierFilters.length > 0 && tierFilters.length < PLAN_ORDER.length) next.set('tier', tierFilters.join(','));
        if (statusFilters.length > 0 && statusFilters.length < USER_STATUS_VALUES.length) next.set('status', statusFilters.join(','));
        if (activationFilters.length > 0 && activationFilters.length < USER_ACTIVATION_VALUES.length) next.set('activation', activationFilters.join(','));
        if (sortKey !== 'created_at') next.set('sort', sortKey);
        if (sortDirection !== 'desc') next.set('dir', sortDirection);
        if (page > 1) next.set('page', String(page));
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        activationFilters,
        dateRange,
        page,
        roleFilters,
        searchParams,
        searchValue,
        setSearchParams,
        sortDirection,
        sortKey,
        statusFilters,
        tierFilters,
    ]);

    const selectedUser = useMemo(
        () => users.find((user) => user.user_id === selectedUserId) || null,
        [selectedUserId, users]
    );

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        setErrorMessage(null);
        try {
            const rows = await adminListUsers({ limit: 500 });
            setUsers(rows);
            writeAdminCache(USERS_CACHE_KEY, rows);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load users.');
            setUsers((current) => (current.length > 0 ? current : []));
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
            gender: (selectedUser.gender as '' | 'female' | 'male' | 'non-binary' | 'prefer-not') || '',
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
                    gender: (fullProfile.gender as '' | 'female' | 'male' | 'non-binary' | 'prefer-not') || '',
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
            if (!isIsoDateInRange(user.created_at, dateRange)) return false;
            if (roleFilters.length > 0 && !roleFilters.includes(user.system_role)) return false;
            if (tierFilters.length > 0 && !tierFilters.includes(user.tier_key)) return false;
            if (statusFilters.length > 0 && !statusFilters.includes(accountStatus)) return false;
            if (activationFilters.length > 0 && !activationFilters.includes(activationStatus)) return false;
            if (!token) return true;
            return (
                getUserDisplayName(user).toLowerCase().includes(token)
                || (user.email || '').toLowerCase().includes(token)
                || user.user_id.toLowerCase().includes(token)
                || getProviderLabel(user).toLowerCase().includes(token)
                || (user.username || '').toLowerCase().includes(token)
                || getActivationStatusLabel(activationStatus).toLowerCase().includes(token)
            );
        });

        const getSortValue = (user: AdminUserRecord): string | number => {
            if (sortKey === 'name') return getUserDisplayName(user).toLowerCase();
            if (sortKey === 'email') return (user.email || '').toLowerCase();
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
        roleFilters,
        searchValue,
        sortDirection,
        sortKey,
        statusFilters,
        tierFilters,
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

    const pageCount = Math.max(Math.ceil(filteredUsers.length / PAGE_SIZE), 1);
    const pagedUsers = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredUsers.slice(start, start + PAGE_SIZE);
    }, [filteredUsers, page]);

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

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

    const saveSelectedUser = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const parsedOverrides = parseOverrideDraft(overrideDraft);
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
            await adminUpdateUserOverrides(selectedUser.user_id, parsedOverrides);
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
        const confirmText = `Hard-delete ${user.email || user.user_id}? This permanently removes auth + profile data.`;
        if (!window.confirm(confirmText)) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminHardDeleteUser(user.user_id);
            setMessage('User permanently deleted.');
            setIsDetailOpen(false);
            setSelectedUserId(null);
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not hard-delete user.');
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
            {message && (
                <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {message}
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

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

                <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('name')}>
                                        User <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('email')}>
                                        Login <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('activation_status')}>
                                        Activation <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('system_role')}>
                                        Role <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('tier_key')}>
                                        Tier <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('account_status')}>
                                        Status <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('last_sign_in_at')}>
                                        Last visit <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2">
                                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('created_at')}>
                                        Created <ArrowsDownUp size={12} />
                                    </button>
                                </th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedUsers.map((user) => {
                                const userName = getUserDisplayName(user);
                                const accountStatus = (user.account_status || 'active') as UserAccountStatus;
                                const activationStatus = resolveActivationStatus(user);
                                return (
                                    <tr key={user.user_id} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => openUserDetail(user.user_id)}
                                                title="Open details drawer"
                                                className="group max-w-[280px] cursor-pointer text-left hover:text-accent-700"
                                            >
                                                <div className="truncate text-sm font-semibold text-slate-800 group-hover:underline group-hover:decoration-slate-400">{userName}</div>
                                                <div className="truncate text-xs text-slate-600">{user.email || 'No email address'}</div>
                                                <div className="truncate text-[11px] text-slate-500">UUID: {user.user_id}</div>
                                            </button>
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                                    {getProviderLabel(user)}
                                                </span>
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
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${activationPillClass(activationStatus)}`}>
                                                {getActivationStatusLabel(activationStatus)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rolePillClass(user.system_role)}`}>
                                                {user.system_role === 'admin' ? 'Admin' : 'User'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tierPillClass(user.tier_key)}`}>
                                                {PLAN_CATALOG[user.tier_key]?.publicName || user.tier_key}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(accountStatus)}`}>
                                                {formatAccountStatusLabel(accountStatus)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-slate-600">{formatTimestamp(user.last_sign_in_at)}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{new Date(user.created_at).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-right">
                                            <UserRowActionsMenu
                                                disabled={isSaving}
                                                isDeleted={accountStatus === 'deleted'}
                                                onOpenDetails={() => openUserDetail(user.user_id)}
                                                onSoftDelete={() => {
                                                    void handleSoftDelete(user);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                            {pagedUsers.length === 0 && !isLoadingUsers && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={9}>
                                        No users match your filters.
                                    </td>
                                </tr>
                            )}
                            {isLoadingUsers && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={9}>
                                        <span className="inline-flex items-center gap-2">
                                            <SpinnerGap size={14} className="animate-spin" />
                                            Loading users...
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
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

            <Drawer open={isDetailOpen} onOpenChange={setIsDetailOpen} direction="right">
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
                                    {selectedUser.email || selectedUser.user_id}
                                </p>
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
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country</span>
                                        <input
                                            value={profileDraft.country}
                                            onChange={(event) => setProfileDraft((current) => ({ ...current, country: event.target.value }))}
                                            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
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
                                    disabled={isSaving}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                >
                                    <Trash size={13} />
                                    Hard delete
                                </button>
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
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-slate-800">{trip.title || trip.trip_id}</div>
                                                        <div className="text-[11px] text-slate-500">{trip.trip_id}</div>
                                                    </div>
                                                    <Select
                                                        value={trip.status}
                                                        onValueChange={(value) => {
                                                            void handleTripPatch(trip, { status: value as 'active' | 'archived' | 'expired' });
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-[140px] text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="expired">Expired</SelectItem>
                                                            <SelectItem value="archived">Archived</SelectItem>
                                                        </SelectContent>
                                                    </Select>
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
                                                    <span className="text-slate-500">Owner: {trip.owner_email || trip.owner_id}</span>
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
                                        <div className="break-all"><span className="font-semibold text-slate-800">User ID:</span> {selectedUser.user_id}</div>
                                        <div><span className="font-semibold text-slate-800">Activation:</span> {getActivationStatusLabel(resolveActivationStatus(selectedUser))}</div>
                                        <div><span className="font-semibold text-slate-800">Login method:</span> {getProviderLabel(selectedUser)}</div>
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
