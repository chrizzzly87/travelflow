import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowsDownUp, PlusCircle, UserCircle, SpinnerGap, Trash, UserPlus, EnvelopeSimple } from '@phosphor-icons/react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

type SortKey = 'email' | 'created_at' | 'updated_at' | 'tier_key' | 'system_role';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 25;

const parseAdminDateRange = (value: string | null): AdminDateRange => {
    if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
    return '30d';
};

const parseSortKey = (value: string | null): SortKey => {
    if (value === 'email' || value === 'created_at' || value === 'updated_at' || value === 'tier_key' || value === 'system_role') return value;
    return 'created_at';
};

const parseSortDirection = (value: string | null): SortDirection => {
    if (value === 'asc' || value === 'desc') return value;
    return 'desc';
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

export const AdminUsersPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState<AdminUserRecord[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(true);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => parseAdminDateRange(searchParams.get('range')));
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>(() => {
        const value = searchParams.get('role');
        if (value === 'admin' || value === 'user') return value;
        return 'all';
    });
    const [tierFilter, setTierFilter] = useState<'all' | PlanTierKey>(() => {
        const value = searchParams.get('tier');
        if (value && PLAN_ORDER.includes(value as PlanTierKey)) return value as PlanTierKey;
        return 'all';
    });
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled' | 'deleted'>(() => {
        const value = searchParams.get('status');
        if (value === 'active' || value === 'disabled' || value === 'deleted') return value;
        return 'all';
    });
    const [sortKey, setSortKey] = useState<SortKey>(() => parseSortKey(searchParams.get('sort')));
    const [sortDirection, setSortDirection] = useState<SortDirection>(() => parseSortDirection(searchParams.get('dir')));
    const [page, setPage] = useState(() => parsePositivePage(searchParams.get('page')));
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [overrideDraft, setOverrideDraft] = useState('{}');
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
    const [createMode, setCreateMode] = useState<'invite' | 'direct'>('invite');
    const [inviteDraft, setInviteDraft] = useState<CreateInviteDraft>(INITIAL_INVITE_DRAFT);
    const [directDraft, setDirectDraft] = useState<CreateDirectDraft>(INITIAL_DIRECT_DRAFT);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (roleFilter !== 'all') next.set('role', roleFilter);
        if (tierFilter !== 'all') next.set('tier', tierFilter);
        if (statusFilter !== 'all') next.set('status', statusFilter);
        if (sortKey !== 'created_at') next.set('sort', sortKey);
        if (sortDirection !== 'desc') next.set('dir', sortDirection);
        if (page > 1) next.set('page', String(page));
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        dateRange,
        page,
        roleFilter,
        searchParams,
        searchValue,
        setSearchParams,
        sortDirection,
        sortKey,
        statusFilter,
        tierFilter,
    ]);

    const selectedUser = useMemo(
        () => users.find((user) => user.user_id === selectedUserId) || null,
        [selectedUserId, users]
    );

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        setErrorMessage(null);
        try {
            const rows = await adminListUsers({
                limit: 500,
            });
            setUsers(rows);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load users.');
            setUsers([]);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    useEffect(() => {
        void loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

    useEffect(() => {
        if (!selectedUser) return;
        let active = true;
        setTierDraft(selectedUser.tier_key);
        setOverrideDraft(JSON.stringify(selectedUser.entitlements_override || {}, null, 2));
        setProfileDraft((current) => ({
            ...current,
            role: selectedUser.system_role,
        }));

        void adminGetUserProfile(selectedUser.user_id)
            .then((fullProfile) => {
                if (!active || !fullProfile) return;
                setTierDraft(fullProfile.tier_key);
                setOverrideDraft(JSON.stringify(fullProfile.entitlements_override || {}, null, 2));
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
        const filtered = users.filter((user) => {
            if (!isIsoDateInRange(user.created_at, dateRange)) return false;
            if (roleFilter !== 'all' && user.system_role !== roleFilter) return false;
            if (tierFilter !== 'all' && user.tier_key !== tierFilter) return false;
            if (statusFilter !== 'all' && (user.account_status || 'active') !== statusFilter) return false;
            if (!searchValue.trim()) return true;
            const token = searchValue.trim().toLowerCase();
            return (
                (user.email || '').toLowerCase().includes(token)
                || (user.first_name || '').toLowerCase().includes(token)
                || (user.last_name || '').toLowerCase().includes(token)
                || user.user_id.toLowerCase().includes(token)
            );
        });

        const sorted = [...filtered].sort((a, b) => {
            const left = String(a[sortKey] || '').toLowerCase();
            const right = String(b[sortKey] || '').toLowerCase();
            if (left === right) return 0;
            const base = left > right ? 1 : -1;
            return sortDirection === 'asc' ? base : -base;
        });
        return sorted;
    }, [dateRange, roleFilter, searchValue, sortDirection, sortKey, statusFilter, tierFilter, users]);

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
            let parsedOverrides: Record<string, unknown> = {};
            try {
                parsedOverrides = JSON.parse(overrideDraft || '{}') as Record<string, unknown>;
            } catch {
                throw new Error('Overrides JSON is invalid.');
            }

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
            await adminUpdateUserProfile(user.user_id, {
                accountStatus: nextStatus,
            });
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
            setMessage('User created successfully.');
            await loadUsers();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not create user.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AdminShell
            title="User Provisioning"
            description="Search, filter, and manage users, profile metadata, tier entitlements, and linked trips."
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
                <button
                    type="button"
                    onClick={() => void loadUsers()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                >
                    <ArrowsDownUp size={14} />
                    Reload
                </button>
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

            <section className="grid gap-3 xl:grid-cols-[1fr_420px]">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">User table</h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <select
                                value={roleFilter}
                                onChange={(event) => {
                                    setRoleFilter(event.target.value as 'all' | 'admin' | 'user');
                                    setPage(1);
                                }}
                                className="h-8 rounded-lg border border-slate-300 bg-white px-2"
                            >
                                <option value="all">All roles</option>
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                            </select>
                            <select
                                value={tierFilter}
                                onChange={(event) => {
                                    setTierFilter(event.target.value as 'all' | PlanTierKey);
                                    setPage(1);
                                }}
                                className="h-8 rounded-lg border border-slate-300 bg-white px-2"
                            >
                                <option value="all">All tiers</option>
                                {PLAN_ORDER.map((tierKey) => (
                                    <option key={tierKey} value={tierKey}>{tierKey}</option>
                                ))}
                            </select>
                            <select
                                value={statusFilter}
                                onChange={(event) => {
                                    setStatusFilter(event.target.value as 'all' | 'active' | 'disabled' | 'deleted');
                                    setPage(1);
                                }}
                                className="h-8 rounded-lg border border-slate-300 bg-white px-2"
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                                <option value="deleted">Deleted</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                    <th className="px-3 py-2">
                                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('email')}>
                                            User <ArrowsDownUp size={12} />
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
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2">
                                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('created_at')}>
                                            Created <ArrowsDownUp size={12} />
                                        </button>
                                    </th>
                                    <th className="px-3 py-2">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedUsers.map((user) => (
                                    <tr key={user.user_id} className="border-b border-slate-100 align-top">
                                        <td className="px-3 py-2">
                                            <button
                                                type="button"
                                                onClick={() => openUserDetail(user.user_id)}
                                                className="text-left text-sm font-semibold text-slate-800 hover:text-accent-700"
                                            >
                                                <div className="truncate">{user.email || user.user_id}</div>
                                                <div className="text-xs font-normal text-slate-500">
                                                    {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.display_name || 'No name'}
                                                </div>
                                            </button>
                                        </td>
                                        <td className="px-3 py-2">{user.system_role}</td>
                                        <td className="px-3 py-2">{user.tier_key}</td>
                                        <td className="px-3 py-2">{user.account_status || 'active'}</td>
                                        <td className="px-3 py-2 text-xs text-slate-500">{new Date(user.created_at).toLocaleString()}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex flex-wrap gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openUserDetail(user.user_id)}
                                                    className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                >
                                                    Open
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleSoftDelete(user)}
                                                    className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                                >
                                                    {(user.account_status || 'active') === 'deleted' ? 'Restore' : 'Soft-delete'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pagedUsers.length === 0 && !isLoadingUsers && (
                                    <tr>
                                        <td className="px-3 py-6 text-sm text-slate-500" colSpan={6}>
                                            No users match your filters.
                                        </td>
                                    </tr>
                                )}
                                {isLoadingUsers && (
                                    <tr>
                                        <td className="px-3 py-6 text-sm text-slate-500" colSpan={6}>
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
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <PlusCircle size={16} className="text-accent-700" />
                        <h2 className="text-sm font-semibold text-slate-900">Create user</h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                        Invite flow emails a password setup link. Direct flow sets the initial password immediately.
                    </p>

                    <div className="mt-3 inline-flex rounded-lg border border-slate-300 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setCreateMode('invite')}
                            className={`rounded-md px-2.5 py-1.5 font-semibold ${createMode === 'invite' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <EnvelopeSimple size={13} />
                                Invite
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreateMode('direct')}
                            className={`rounded-md px-2.5 py-1.5 font-semibold ${createMode === 'direct' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
                        >
                            <span className="inline-flex items-center gap-1">
                                <UserPlus size={13} />
                                Direct
                            </span>
                        </button>
                    </div>

                    {createMode === 'invite' ? (
                        <div className="mt-3 space-y-2">
                            <input
                                value={inviteDraft.email}
                                onChange={(event) => setInviteDraft((current) => ({ ...current, email: event.target.value }))}
                                placeholder="Email"
                                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={inviteDraft.firstName}
                                    onChange={(event) => setInviteDraft((current) => ({ ...current, firstName: event.target.value }))}
                                    placeholder="First name"
                                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                />
                                <input
                                    value={inviteDraft.lastName}
                                    onChange={(event) => setInviteDraft((current) => ({ ...current, lastName: event.target.value }))}
                                    placeholder="Last name"
                                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                />
                            </div>
                            <select
                                value={inviteDraft.tierKey}
                                onChange={(event) => setInviteDraft((current) => ({ ...current, tierKey: event.target.value as PlanTierKey }))}
                                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                            >
                                {PLAN_ORDER.map((tierKey) => (
                                    <option key={`invite-tier-${tierKey}`} value={tierKey}>
                                        {PLAN_CATALOG[tierKey].publicName} ({tierKey})
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => void submitCreateInvite()}
                                disabled={isSaving || !inviteDraft.email.trim()}
                                className="inline-flex h-9 items-center rounded-lg bg-accent-600 px-3 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                            >
                                Send invite
                            </button>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            <input
                                value={directDraft.email}
                                onChange={(event) => setDirectDraft((current) => ({ ...current, email: event.target.value }))}
                                placeholder="Email"
                                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={directDraft.firstName}
                                    onChange={(event) => setDirectDraft((current) => ({ ...current, firstName: event.target.value }))}
                                    placeholder="First name"
                                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                />
                                <input
                                    value={directDraft.lastName}
                                    onChange={(event) => setDirectDraft((current) => ({ ...current, lastName: event.target.value }))}
                                    placeholder="Last name"
                                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                />
                            </div>
                            <input
                                value={directDraft.password}
                                onChange={(event) => setDirectDraft((current) => ({ ...current, password: event.target.value }))}
                                type="password"
                                placeholder="Initial password"
                                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                            />
                            <select
                                value={directDraft.tierKey}
                                onChange={(event) => setDirectDraft((current) => ({ ...current, tierKey: event.target.value as PlanTierKey }))}
                                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm"
                            >
                                {PLAN_ORDER.map((tierKey) => (
                                    <option key={`direct-tier-${tierKey}`} value={tierKey}>
                                        {PLAN_CATALOG[tierKey].publicName} ({tierKey})
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => void submitCreateDirect()}
                                disabled={isSaving || !directDraft.email.trim() || !directDraft.password.trim()}
                                className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                Create user
                            </button>
                        </div>
                    )}
                </article>
            </section>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="left-auto right-0 top-0 h-screen w-[min(96vw,620px)] translate-x-0 translate-y-0 rounded-none border-l border-slate-200">
                    <DialogHeader className="border-b border-slate-200">
                        <DialogTitle className="text-base font-black">
                            {selectedUser?.email || selectedUser?.user_id || 'User details'}
                        </DialogTitle>
                    </DialogHeader>

                    {!selectedUser ? (
                        <div className="p-4 text-sm text-slate-500">No user selected.</div>
                    ) : (
                        <div className="h-[calc(100vh-84px)] overflow-y-auto p-4">
                            <section className="space-y-3 rounded-xl border border-slate-200 p-3">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profile</h3>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <input
                                        value={profileDraft.firstName}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, firstName: event.target.value }))}
                                        placeholder="First name"
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                    <input
                                        value={profileDraft.lastName}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, lastName: event.target.value }))}
                                        placeholder="Last name"
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                    <input
                                        value={profileDraft.username}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, username: event.target.value }))}
                                        placeholder="Username"
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                    <select
                                        value={profileDraft.gender}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, gender: event.target.value as '' | 'female' | 'male' | 'non-binary' | 'prefer-not' }))}
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    >
                                        {PROFILE_GENDER_OPTIONS.map((option) => (
                                            <option key={`profile-gender-${option.value || 'empty'}`} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        value={profileDraft.country}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, country: event.target.value }))}
                                        placeholder="Country"
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                    <input
                                        value={profileDraft.city}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))}
                                        placeholder="City"
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                    <input
                                        value={profileDraft.preferredLanguage}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, preferredLanguage: event.target.value }))}
                                        placeholder="Preferred language"
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    />
                                    <select
                                        value={profileDraft.accountStatus}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, accountStatus: event.target.value as 'active' | 'disabled' | 'deleted' }))}
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    >
                                        {PROFILE_ACCOUNT_STATUS_OPTIONS.map((option) => (
                                            <option key={`profile-status-${option.value}`} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={profileDraft.role}
                                        onChange={(event) => setProfileDraft((current) => ({ ...current, role: event.target.value as 'admin' | 'user' }))}
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    >
                                        <option value="user">Role: user</option>
                                        <option value="admin">Role: admin</option>
                                    </select>
                                    <select
                                        value={tierDraft}
                                        onChange={(event) => setTierDraft(event.target.value as PlanTierKey)}
                                        className="h-9 rounded-lg border border-slate-300 px-3 text-sm"
                                    >
                                        {PLAN_ORDER.map((tierKey) => (
                                            <option key={`profile-tier-${tierKey}`} value={tierKey}>
                                                Tier: {PLAN_CATALOG[tierKey].publicName} ({tierKey})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <textarea
                                    value={overrideDraft}
                                    onChange={(event) => setOverrideDraft(event.target.value)}
                                    className="min-h-[140px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                                />
                                <div className="flex flex-wrap gap-2">
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
                                </div>
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
                                                    <select
                                                        value={trip.status}
                                                        onChange={(event) => {
                                                            void handleTripPatch(trip, { status: event.target.value as 'active' | 'archived' | 'expired' });
                                                        }}
                                                        className="h-8 rounded border border-slate-300 px-2 text-xs"
                                                    >
                                                        <option value="active">active</option>
                                                        <option value="expired">expired</option>
                                                        <option value="archived">archived</option>
                                                    </select>
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
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AdminShell>
    );
};
