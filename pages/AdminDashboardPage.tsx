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

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total users</p>
                    <p className="mt-2 text-3xl font-black text-slate-900"><AdminCountUpNumber value={metrics.totalUsers} /></p>
                    <p className="mt-1 text-xs text-slate-500">Admins: <AdminCountUpNumber value={metrics.adminUsers} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">User health</p>
                    <p className="mt-2 text-3xl font-black text-slate-900"><AdminCountUpNumber value={metrics.activeUsers} /></p>
                    <p className="mt-1 text-xs text-slate-500">Suspended: <AdminCountUpNumber value={metrics.disabledUsers} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total trips</p>
                    <p className="mt-2 text-3xl font-black text-slate-900"><AdminCountUpNumber value={metrics.totalTrips} /></p>
                    <p className="mt-1 text-xs text-slate-500">Active: <AdminCountUpNumber value={metrics.activeTrips} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Lifecycle pressure</p>
                    <p className="mt-2 text-3xl font-black text-slate-900"><AdminCountUpNumber value={metrics.expiredTrips} /></p>
                    <p className="mt-1 text-xs text-slate-500">Expired trips</p>
                </article>
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_1fr]">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Trip status mix</h2>
                    <p className="mt-1 text-xs text-slate-500">Distribution of trips by lifecycle state.</p>
                    <div className="mt-4 space-y-3">
                        {tripStatusBars.map((bar) => (
                            <div key={bar.id} className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>{bar.label}</span>
                                    <span>{formatValue(bar.count)} ({bar.pct}%)</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100">
                                    <div
                                        className={`h-2 rounded-full ${bar.className}`}
                                        style={{ width: `${bar.pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Recent users</h2>
                    <p className="mt-1 text-xs text-slate-500">Most recently created accounts with identity and sign-in context.</p>
                    <div className="mt-4 space-y-2">
                        {(scopedUsers.slice(0, 6)).map((user) => (
                            <div key={user.user_id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                                <div className="truncate text-sm font-semibold text-slate-800">{getUserName(user)}</div>
                                <div className="truncate text-xs text-slate-600">{user.email || 'No email'}</div>
                                <div className="text-[11px] text-slate-500">
                                    {getLoginLabel(user)} · {user.user_id} · {(user.last_sign_in_at ? `Last visit ${new Date(user.last_sign_in_at).toLocaleString()}` : 'No sign-in yet')}
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
