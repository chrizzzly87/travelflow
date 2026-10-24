import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@/app/navigation';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { adminListTrips, adminListUsers, type AdminTripRecord, type AdminUserRecord } from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { buildAdminDashboardUserLevelBreakdown } from '../components/admin/adminDashboardUserBreakdown';
import {
    ACTIVITY_STACKED_CATEGORIES,
    buildTripStatusStackedChartData,
    buildUserLevelCumulativeStackedChartData,
    buildUsersVsTripsStackedChartData,
    filterDashboardTripsByRange,
    filterDashboardUsersByRange,
    TRIP_STATUS_STACKED_CATEGORIES,
} from '../components/admin/adminDashboardChartData';
import { AdminBarChart } from '../components/admin/charts';
import { AdminMetric, AdminProgressBar, AdminText, AdminTitle } from '../components/admin/AdminText';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';

const adminDashboardNumberFormatter = new Intl.NumberFormat();

const formatValue = (value: number): string => adminDashboardNumberFormatter.format(value);
const formatLastVisitDate = (value: string | null | undefined): string => (
    value ? `Visit ${new Date(value).toLocaleDateString()}` : 'No sign-in yet'
);

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
        () => filterDashboardUsersByRange(users, dateRange),
        [dateRange, users]
    );

    const scopedTrips = useMemo(
        () => filterDashboardTripsByRange(trips, dateRange),
        [dateRange, trips]
    );

    const metrics = useMemo(() => {
        const totalUsers = scopedUsers.length;
        const disabledUsers = scopedUsers.filter((user) => user.account_status === 'disabled').length;
        const totalTrips = scopedTrips.length;
        const activeTrips = scopedTrips.filter((trip) => trip.status === 'active').length;
        const expiredTrips = scopedTrips.filter((trip) => trip.status === 'expired').length;
        const archivedTrips = scopedTrips.filter((trip) => trip.status === 'archived').length;
        return {
            totalUsers,
            disabledUsers,
            totalTrips,
            activeTrips,
            expiredTrips,
            archivedTrips,
        };
    }, [scopedTrips, scopedUsers]);

    const userLevelBreakdown = useMemo(
        () => buildAdminDashboardUserLevelBreakdown(scopedUsers),
        [scopedUsers]
    );

    const userLevelTrendStackedChartData = useMemo(
        () => buildUserLevelCumulativeStackedChartData(users, scopedUsers, userLevelBreakdown, dateRange),
        [dateRange, scopedUsers, userLevelBreakdown, users]
    );

    const tripStatusStackedChartData = useMemo(
        () => buildTripStatusStackedChartData(scopedTrips),
        [scopedTrips]
    );

    const usersVsTripsStackedChartData = useMemo(
        () => buildUsersVsTripsStackedChartData(scopedUsers, scopedTrips),
        [scopedTrips, scopedUsers]
    );


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
                <section className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
                    {errorMessage}
                </section>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <AdminSurfaceCard className="border-t-4 border-t-[var(--admin-chart-indigo)]">
                    <AdminText>Total Users</AdminText>
                    <AdminMetric><AdminCountUpNumber value={metrics.totalUsers} /></AdminMetric>
                    <div className="mt-4 space-y-2">
                        {userLevelBreakdown.map((level) => (
                            <div
                                key={`total-users-level-${level.key}`}
                                className="flex items-center justify-between rounded-md border border-border bg-secondary px-2 py-1.5"
                                data-tooltip={level.tooltip}
                            >
                                <AdminText>{level.label}</AdminText>
                                <AdminText>{formatValue(level.count)} ({level.shareLabel})</AdminText>
                            </div>
                        ))}
                    </div>
                </AdminSurfaceCard>
                <AdminSurfaceCard className="border-t-4 border-t-[var(--admin-chart-emerald)]">
                    <AdminText>Total Trips</AdminText>
                    <AdminMetric><AdminCountUpNumber value={metrics.totalTrips} /></AdminMetric>
                    <div className="mt-4 flex items-center justify-between">
                        <AdminText>Active / Total</AdminText>
                        <AdminText>{formatValue(metrics.activeTrips)} / {formatValue(metrics.totalTrips)}</AdminText>
                    </div>
                    <AdminProgressBar
                        label="Active share of total trips"
                        value={metrics.totalTrips ? (metrics.activeTrips / metrics.totalTrips) * 100 : 0}
                        className="mt-2"
                    />
                </AdminSurfaceCard>
                <AdminSurfaceCard className="border-t-4 border-t-[var(--admin-chart-amber)]">
                    <AdminText>Expired Trips</AdminText>
                    <AdminMetric><AdminCountUpNumber value={metrics.expiredTrips} /></AdminMetric>
                    <AdminText className="mt-4">Lifecycle pressure point</AdminText>
                </AdminSurfaceCard>
                <AdminSurfaceCard className="border-t-4 border-t-[var(--admin-chart-slate)]">
                    <AdminText>Suspended Users</AdminText>
                    <AdminMetric><AdminCountUpNumber value={metrics.disabledUsers} /></AdminMetric>
                    <AdminText className="mt-4">Accounts blocked or locked</AdminText>
                </AdminSurfaceCard>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AdminSurfaceCard>
                    <AdminTitle>User Levels Over Time</AdminTitle>
                    <AdminText className="mt-1">Cumulative total users by level for each day in the selected range.</AdminText>
                    <AdminBarChart
                        ariaLabel="User levels over time"
                        className="mt-6 h-72"
                        data={userLevelTrendStackedChartData}
                        index="date"
                        categories={userLevelBreakdown.map((level) => level.label)}
                        stack
                        yAxisWidth={48}
                    />
                </AdminSurfaceCard>

                <AdminSurfaceCard>
                    <AdminTitle>Trips by Status Over Time</AdminTitle>
                    <AdminText className="mt-1">Single stacked view of active, expired, and archived trips by creation day.</AdminText>
                    <AdminBarChart
                        ariaLabel="Trips by status over time"
                        className="mt-6 h-72"
                        data={tripStatusStackedChartData}
                        index="date"
                        categories={[...TRIP_STATUS_STACKED_CATEGORIES]}
                        stack
                        yAxisWidth={48}
                    />
                </AdminSurfaceCard>
            </div>

            <section className="mt-6">
                <AdminSurfaceCard>
                    <AdminTitle>New Users vs New Trips</AdminTitle>
                    <AdminText className="mt-1">Acquisition and planning throughput trend within the selected date range.</AdminText>
                    <AdminBarChart
                        ariaLabel="New users vs new trips"
                        className="mt-6 h-72"
                        data={usersVsTripsStackedChartData}
                        index="date"
                        categories={[...ACTIVITY_STACKED_CATEGORIES]}
                        stack
                        yAxisWidth={48}
                    />
                </AdminSurfaceCard>
            </section>

            <section className="mt-6">
                <AdminSurfaceCard>
                    <div className="flex flex-col gap-y-1.5 pb-4">
                        <h3 className="font-semibold leading-none tracking-tight">Recent Users</h3>
                        <p className="text-sm text-muted-foreground">Most recently created accounts with identity and sign-in context.</p>
                    </div>
                    <div className="space-y-6 mt-4">
                        {(scopedUsers.slice(0, 6)).map((user) => (
                            <a 
                                key={user.user_id} 
                                href={`/admin/users?user=${encodeURIComponent(user.user_id)}&drawer=user`}
                                className="flex items-center group hover:bg-secondary p-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                            >
                                <span className="relative flex shrink-0 overflow-hidden rounded-full size-9 border border-transparent group-hover:border-border group-hover:shadow-sm transition-all">
                                    <span className="flex size-full items-center justify-center rounded-full bg-secondary text-muted-foreground font-semibold uppercase group-hover:bg-card transition-colors dark:text-foreground">
                                        {getUserName(user).charAt(0)}
                                    </span>
                                </span>
                                <div className="ml-4 space-y-1 w-full max-w-[200px] sm:max-w-none">
                                    <p className="text-sm font-medium leading-none truncate group-hover:text-accent-700 transition-colors dark:group-hover:text-accent-200">{getUserName(user)}</p>
                                    <p className="text-sm text-muted-foreground truncate">{user.email || 'No email'}</p>
                                </div>
                                <div className="ml-auto flex items-end flex-col gap-1 shrink-0 text-right font-medium">
                                    <span className="text-sm font-medium text-foreground">{getLoginLabel(user)}</span>
                                    <span className="text-xs text-muted-foreground hidden sm:inline-block">{formatLastVisitDate(user.last_sign_in_at)}</span>
                                </div>
                            </a>
                        ))}
                        {scopedUsers.length === 0 && !isLoading && (
                            <div className="rounded-xl border border-border bg-secondary p-3 text-sm text-muted-foreground">
                                No users found for this filter.
                            </div>
                        )}
                    </div>
                </AdminSurfaceCard>
            </section>
        </AdminShell>
    );
};
