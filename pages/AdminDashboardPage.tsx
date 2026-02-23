import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import { adminListTrips, adminListUsers, type AdminTripRecord, type AdminUserRecord } from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';

const formatValue = (value: number): string => new Intl.NumberFormat().format(value);

const getUserName = (user: AdminUserRecord): string => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (user.display_name?.trim()) return user.display_name.trim();
    return 'Unnamed user';
};

const getLoginLabel = (user: AdminUserRecord): string => {
    if (user.is_anonymous) return 'Anonymous';
    const provider = (user.auth_provider || '').toLowerCase();
    if (!provider || provider === 'email') return 'Email/password';
    if (provider === 'google') return 'Google';
    if (provider === 'apple') return 'Apple';
    if (provider === 'github') return 'GitHub';
    return provider;
};

export const AdminDashboardPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState<AdminUserRecord[]>([]);
    const [trips, setTrips] = useState<AdminTripRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [dateRange, searchParams, searchValue, setSearchParams]);

    const loadData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [nextUsers, nextTrips] = await Promise.all([
                adminListUsers({ limit: 500, search: searchValue || undefined }),
                adminListTrips({ limit: 500, search: searchValue || undefined }),
            ]);
            setUsers(nextUsers);
            setTrips(nextTrips);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load dashboard metrics.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadData();
        }, 160);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, searchValue]);

    const scopedUsers = useMemo(
        () => users.filter((user) => isIsoDateInRange(user.created_at, dateRange)),
        [dateRange, users]
    );

    const scopedTrips = useMemo(
        () => trips.filter((trip) => isIsoDateInRange(trip.updated_at || trip.created_at, dateRange)),
        [dateRange, trips]
    );

    const metrics = useMemo(() => {
        const totalUsers = scopedUsers.length;
        const activeUsers = scopedUsers.filter((user) => (user.account_status || 'active') === 'active').length;
        const disabledUsers = scopedUsers.filter((user) => user.account_status === 'disabled').length;
        const adminUsers = scopedUsers.filter((user) => user.system_role === 'admin').length;
        const totalTrips = scopedTrips.length;
        const activeTrips = scopedTrips.filter((trip) => trip.status === 'active').length;
        const expiredTrips = scopedTrips.filter((trip) => trip.status === 'expired').length;
        const archivedTrips = scopedTrips.filter((trip) => trip.status === 'archived').length;
        return {
            totalUsers,
            activeUsers,
            disabledUsers,
            adminUsers,
            totalTrips,
            activeTrips,
            expiredTrips,
            archivedTrips,
        };
    }, [scopedTrips, scopedUsers]);

    const tripStatusBars = useMemo(() => {
        const total = Math.max(scopedTrips.length, 1);
        const toPct = (count: number): number => Math.round((count / total) * 100);
        return [
            { id: 'active', label: 'Active', count: metrics.activeTrips, pct: toPct(metrics.activeTrips), className: 'bg-emerald-500' },
            { id: 'expired', label: 'Expired', count: metrics.expiredTrips, pct: toPct(metrics.expiredTrips), className: 'bg-amber-500' },
            { id: 'archived', label: 'Archived', count: metrics.archivedTrips, pct: toPct(metrics.archivedTrips), className: 'bg-slate-500' },
        ];
    }, [metrics.activeTrips, metrics.archivedTrips, metrics.expiredTrips, scopedTrips.length]);

    return (
        <AdminShell
            title="Operational Overview"
            description="High-signal snapshot of users, trips, and lifecycle pressure points."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadData()}
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

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white p-6">
                    <div className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <h3 className="tracking-tight text-sm font-medium">Total Users</h3>
                    </div>
                    <div className="flex flex-col">
                        <div className="text-2xl font-bold text-slate-900"><AdminCountUpNumber value={metrics.totalUsers} /></div>
                        <p className="text-xs text-muted-foreground text-slate-500 mt-1">Admins: <AdminCountUpNumber value={metrics.adminUsers} /></p>
                    </div>
                </article>
                <article className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white p-6">
                    <div className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <h3 className="tracking-tight text-sm font-medium">Active Users</h3>
                    </div>
                    <div className="flex flex-col">
                        <div className="text-2xl font-bold text-slate-900"><AdminCountUpNumber value={metrics.activeUsers} /></div>
                        <p className="text-xs text-muted-foreground text-slate-500 mt-1">Suspended: <AdminCountUpNumber value={metrics.disabledUsers} /></p>
                    </div>
                </article>
                <article className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white p-6">
                    <div className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <h3 className="tracking-tight text-sm font-medium">Total Trips</h3>
                    </div>
                    <div className="flex flex-col">
                        <div className="text-2xl font-bold text-slate-900"><AdminCountUpNumber value={metrics.totalTrips} /></div>
                        <p className="text-xs text-muted-foreground text-slate-500 mt-1">Active: <AdminCountUpNumber value={metrics.activeTrips} /></p>
                    </div>
                </article>
                <article className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white p-6">
                    <div className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <h3 className="tracking-tight text-sm font-medium">Expired Trips</h3>
                    </div>
                    <div className="flex flex-col">
                        <div className="text-2xl font-bold text-slate-900"><AdminCountUpNumber value={metrics.expiredTrips} /></div>
                        <p className="text-xs text-muted-foreground text-slate-500 mt-1">Lifecycle pressure</p>
                    </div>
                </article>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-8 xl:grid-cols-[1fr_1.5fr]">
                <article className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white p-6">
                    <div className="flex flex-col space-y-1.5 pb-4">
                        <h3 className="font-semibold leading-none tracking-tight">Trip Status Mix</h3>
                        <p className="text-sm text-muted-foreground text-slate-500">Distribution of trips by lifecycle state.</p>
                    </div>
                    <div className="space-y-4">
                        {tripStatusBars.map((bar) => (
                            <div key={bar.id} className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-slate-700">
                                    <span className="font-medium">{bar.label}</span>
                                    <span className="text-slate-500">{formatValue(bar.count)} ({bar.pct}%)</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                        className={`h-full ${bar.className}`}
                                        style={{ width: `${bar.pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="rounded-xl border bg-card text-card-foreground shadow-sm bg-white p-6">
                    <div className="flex flex-col space-y-1.5 pb-4">
                        <h3 className="font-semibold leading-none tracking-tight">Recent Users</h3>
                        <p className="text-sm text-muted-foreground text-slate-500">Most recently created accounts with identity and sign-in context.</p>
                    </div>
                    <div className="space-y-6">
                        {(scopedUsers.slice(0, 6)).map((user) => (
                            <div key={user.user_id} className="flex items-center">
                                <span className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9">
                                    <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-500 font-semibold uppercase">
                                        {getUserName(user).charAt(0)}
                                    </span>
                                </span>
                                <div className="ml-4 space-y-1 w-full max-w-[200px] sm:max-w-none">
                                    <p className="text-sm font-medium leading-none truncate">{getUserName(user)}</p>
                                    <p className="text-sm text-muted-foreground text-slate-500 truncate">{user.email || 'No email'}</p>
                                </div>
                                <div className="ml-auto flex items-end flex-col gap-1 shrink-0 text-right font-medium">
                                    <span className="text-sm font-medium text-slate-700">{getLoginLabel(user)}</span>
                                    <span className="text-xs text-slate-500 hidden sm:inline-block">{(user.last_sign_in_at ? `Visit ${new Date(user.last_sign_in_at).toLocaleDateString()}` : 'No sign-in yet')}</span>
                                </div>
                            </div>
                        ))}
                        {scopedUsers.length === 0 && !isLoading && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                No users found for this filter.
                            </div>
                        )}
                    </div>
                </article>
            </section>
        </AdminShell>
    );
};
