import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Hourglass, SuitcaseRolling, UserMinus, UsersThree } from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import type { AdminDateRange } from '../components/admin/adminShellUtils';
import { adminListTrips, adminListUsers, type AdminTripRecord, type AdminUserRecord } from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminBarChart } from '../components/admin/AdminBarChart';
import { AdminBarList } from '../components/admin/AdminBarList';
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
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

const adminDashboardNumberFormatter = new Intl.NumberFormat();
const adminDashboardPercentFormatter = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

const formatValue = (value: number): string => adminDashboardNumberFormatter.format(value);
const formatLastVisitDate = (value: string | null | undefined): string => (
    value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'
);

const RANGE_LABEL: Record<AdminDateRange, string> = {
    '7d': 'in the last 7 days',
    '30d': 'in the last 30 days',
    '90d': 'in the last 90 days',
    all: 'all time',
};

const TRIP_STATUS_COLORS = {
    'Active trips': 'var(--chart-2)',
    'Expired trips': 'var(--chart-3)',
    'Archived trips': 'var(--chart-4)',
} as const;

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

const parseDateRange = (value: string | null): AdminDateRange => (
    value === '7d' || value === '30d' || value === '90d' || value === 'all' ? value : '30d'
);

export const AdminDashboardPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState<AdminUserRecord[]>([]);
    const [trips, setTrips] = useState<AdminTripRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => parseDateRange(searchParams.get('range')));

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (dateRange !== '30d') next.set('range', dateRange);
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [dateRange, searchParams, searchValue, setSearchParams]);

    const loadData = useCallback(async (search: string) => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [nextUsers, nextTrips] = await Promise.all([
                adminListUsers({ limit: 500, search: search || undefined }),
                adminListTrips({ limit: 500, search: search || undefined }),
            ]);
            setUsers(nextUsers);
            setTrips(nextTrips);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load dashboard metrics.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // The date range is applied client-side, so only the search refetches.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadData(searchValue);
        }, 160);
        return () => window.clearTimeout(timer);
    }, [loadData, searchValue]);

    const scopedUsers = useMemo(() => filterDashboardUsersByRange(users, dateRange), [dateRange, users]);
    const scopedTrips = useMemo(() => filterDashboardTripsByRange(trips, dateRange), [dateRange, trips]);

    const metrics = useMemo(() => {
        const totalTrips = scopedTrips.length;
        const activeTrips = scopedTrips.filter((trip) => trip.status === 'active').length;
        return {
            totalUsers: scopedUsers.length,
            disabledUsers: scopedUsers.filter((user) => user.account_status === 'disabled').length,
            totalTrips,
            activeTrips,
            activeShare: totalTrips ? activeTrips / totalTrips : 0,
            expiredTrips: scopedTrips.filter((trip) => trip.status === 'expired').length,
        };
    }, [scopedTrips, scopedUsers]);

    const userLevelBreakdown = useMemo(() => buildAdminDashboardUserLevelBreakdown(scopedUsers), [scopedUsers]);
    const userLevelCategories = useMemo(() => userLevelBreakdown.map((level) => level.label), [userLevelBreakdown]);

    const userLevelTrendData = useMemo(
        () => buildUserLevelCumulativeStackedChartData(users, scopedUsers, userLevelBreakdown, dateRange),
        [dateRange, scopedUsers, userLevelBreakdown, users]
    );
    const tripStatusData = useMemo(() => buildTripStatusStackedChartData(scopedTrips), [scopedTrips]);
    const usersVsTripsData = useMemo(() => buildUsersVsTripsStackedChartData(scopedUsers, scopedTrips), [scopedTrips, scopedUsers]);

    const recentUsers = useMemo(() => scopedUsers.slice(0, 8), [scopedUsers]);
    const rangeLabel = RANGE_LABEL[dateRange];

    return (
        <AdminShell
            title="Overview"
            description="Users, trips and lifecycle pressure points at a glance."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton onClick={() => void loadData(searchValue)} isLoading={isLoading} />
            )}
        >
            <div className="flex flex-col gap-4">
                {errorMessage && <AdminErrorAlert title="Could not load metrics" message={errorMessage} />}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatCard
                        label="Users"
                        icon={<UsersThree />}
                        value={<AdminCountUpNumber value={metrics.totalUsers} />}
                        hint={`Signed up ${rangeLabel}`}
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Trips"
                        icon={<SuitcaseRolling />}
                        value={<AdminCountUpNumber value={metrics.totalTrips} />}
                        hint={`${formatValue(metrics.activeTrips)} active · ${adminDashboardPercentFormatter.format(metrics.activeShare)}`}
                        isLoading={isLoading}
                    >
                        <div
                            className="h-1.5 overflow-hidden rounded-full bg-secondary"
                            role="progressbar"
                            aria-label="Share of active trips"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(metrics.activeShare * 100)}
                        >
                            <div className="h-full rounded-full bg-chart-2 transition-[width]" style={{ width: `${metrics.activeShare * 100}%` }} />
                        </div>
                    </AdminStatCard>
                    <AdminStatCard
                        label="Expired trips"
                        icon={<Hourglass />}
                        value={<AdminCountUpNumber value={metrics.expiredTrips} />}
                        hint={metrics.expiredTrips > 0 ? 'Owners may need a nudge to renew' : 'Nothing has expired'}
                        hintTone={metrics.expiredTrips > 0 ? 'warning' : 'neutral'}
                        isLoading={isLoading}
                    />
                    <AdminStatCard
                        label="Suspended users"
                        icon={<UserMinus />}
                        value={<AdminCountUpNumber value={metrics.disabledUsers} />}
                        hint={metrics.disabledUsers > 0 ? 'Accounts blocked or locked' : 'No blocked accounts'}
                        hintTone={metrics.disabledUsers > 0 ? 'negative' : 'neutral'}
                        isLoading={isLoading}
                    />
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    <AdminSurfaceCard className="flex flex-col gap-4 xl:col-span-2">
                        <AdminSectionHeader
                            title="New users and trips"
                            description={`Daily sign-ups and trips created ${rangeLabel}.`}
                        />
                        <AdminBarChart
                            data={usersVsTripsData}
                            index="date"
                            categories={ACTIVITY_STACKED_CATEGORIES}
                            stacked
                            ariaLabel="Bar chart of new users and new trips per day"
                        />
                    </AdminSurfaceCard>

                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader title="User mix" description="Share of users by plan level." />
                        <AdminBarList
                            ariaLabel="Users by plan level"
                            scale="total"
                            items={userLevelBreakdown.map((level) => ({
                                key: level.key,
                                label: level.label,
                                value: level.count,
                                valueLabel: `${formatValue(level.count)} · ${level.shareLabel}`,
                                tooltip: level.tooltip,
                            }))}
                        />
                    </AdminSurfaceCard>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="Users by level over time"
                            description="Cumulative users per plan level for each day in range."
                        />
                        <AdminBarChart
                            data={userLevelTrendData}
                            index="date"
                            categories={userLevelCategories}
                            stacked
                            ariaLabel="Stacked bar chart of cumulative users by plan level"
                        />
                    </AdminSurfaceCard>
                    <AdminSurfaceCard className="flex flex-col gap-4">
                        <AdminSectionHeader
                            title="Trips by status"
                            description="Active, expired and archived trips by creation day."
                        />
                        <AdminBarChart
                            data={tripStatusData}
                            index="date"
                            categories={TRIP_STATUS_STACKED_CATEGORIES}
                            colors={TRIP_STATUS_COLORS}
                            stacked
                            ariaLabel="Stacked bar chart of trips by status per creation day"
                        />
                    </AdminSurfaceCard>
                </div>

                <AdminSurfaceCard className="flex flex-col gap-3 p-0">
                    <AdminSectionHeader
                        className="px-4 pt-4"
                        title="Recent users"
                        description="The newest accounts with their sign-in method."
                        actions={(
                            <Button asChild variant="ghost" size="sm">
                                <Link
                                    to="/admin/users"
                                    onClick={() => trackEvent('admin__dashboard--all_users')}
                                    {...getAnalyticsDebugAttributes('admin__dashboard--all_users')}
                                >
                                    All users
                                    <ArrowRight className="rtl:rotate-180" />
                                </Link>
                            </Button>
                        )}
                    />
                    {recentUsers.length === 0 && !isLoading ? (
                        <AdminEmptyState
                            className="mx-4 mb-4"
                            icon={<UsersThree />}
                            title="No users in this range"
                            description="Widen the date range or clear the search to see more accounts."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="ps-4">User</TableHead>
                                    <TableHead>Sign-in</TableHead>
                                    <TableHead className="hidden md:table-cell">Status</TableHead>
                                    <TableHead className="pe-4 text-end">Last visit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentUsers.map((user) => (
                                    <TableRow key={user.user_id}>
                                        <TableCell className="ps-4">
                                            <Link
                                                to={`/admin/users?user=${encodeURIComponent(user.user_id)}&drawer=user`}
                                                className="group flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                onClick={() => trackEvent('admin__dashboard--recent_user')}
                                                {...getAnalyticsDebugAttributes('admin__dashboard--recent_user')}
                                            >
                                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-muted-foreground">
                                                    {getUserName(user).charAt(0)}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block truncate font-medium text-foreground group-hover:underline">{getUserName(user)}</span>
                                                    <span className="block truncate text-xs text-muted-foreground">{user.email || 'No email'}</span>
                                                </span>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{getLoginLabel(user)}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {user.account_status === 'disabled'
                                                ? <AdminStatusBadge tone="danger">Suspended</AdminStatusBadge>
                                                : user.is_anonymous
                                                    ? <AdminStatusBadge tone="neutral">Guest</AdminStatusBadge>
                                                    : <AdminStatusBadge tone="success">Active</AdminStatusBadge>}
                                        </TableCell>
                                        <TableCell className="pe-4 text-end tabular-nums text-muted-foreground">
                                            {formatLastVisitDate(user.last_sign_in_at)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
