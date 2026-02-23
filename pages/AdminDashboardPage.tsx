import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import { adminListTrips, adminListUsers, type AdminTripRecord, type AdminUserRecord } from '../services/adminService';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { Card, Metric, Text, Flex, Grid, ProgressBar, BarChart, DonutChart, Title } from '@tremor/react';

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

            <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mt-6">
                <Card decoration="top" decorationColor="indigo">
                    <Text>Total Users</Text>
                    <Metric><AdminCountUpNumber value={metrics.totalUsers} /></Metric>
                    <Flex className="mt-4">
                        <Text>Active / Total</Text>
                        <Text>{formatValue(metrics.activeUsers)} / {formatValue(metrics.totalUsers)}</Text>
                    </Flex>
                    <ProgressBar value={metrics.totalUsers ? (metrics.activeUsers / metrics.totalUsers) * 100 : 0} color="indigo" className="mt-2" />
                </Card>
                <Card decoration="top" decorationColor="emerald">
                    <Text>Total Trips</Text>
                    <Metric><AdminCountUpNumber value={metrics.totalTrips} /></Metric>
                    <Flex className="mt-4">
                        <Text>Active / Total</Text>
                        <Text>{formatValue(metrics.activeTrips)} / {formatValue(metrics.totalTrips)}</Text>
                    </Flex>
                    <ProgressBar value={metrics.totalTrips ? (metrics.activeTrips / metrics.totalTrips) * 100 : 0} color="emerald" className="mt-2" />
                </Card>
                <Card decoration="top" decorationColor="amber">
                    <Text>Expired Trips</Text>
                    <Metric><AdminCountUpNumber value={metrics.expiredTrips} /></Metric>
                    <Text className="mt-4">Lifecycle pressure point</Text>
                </Card>
                <Card decoration="top" decorationColor="slate">
                    <Text>Suspended Users</Text>
                    <Metric><AdminCountUpNumber value={metrics.disabledUsers} /></Metric>
                    <Text className="mt-4">Accounts blocked or locked</Text>
                </Card>
            </Grid>

            <Grid numItemsLg={2} className="gap-6 mt-6">
                <Card>
                    <Title>Trips Created Over Time</Title>
                    <BarChart
                        className="mt-6 h-72"
                        data={(() => {
                            const days: Record<string, number> = {};
                            scopedTrips.forEach((t) => {
                                const d = new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                days[d] = (days[d] || 0) + 1;
                            });
                            return Object.entries(days).map(([date, count]) => ({ date, 'Trips Created': count })).reverse().slice(0, 14).reverse();
                        })()}
                        index="date"
                        categories={['Trips Created']}
                        colors={['indigo']}
                        yAxisWidth={48}
                    />
                </Card>

                <Card>
                    <Title>User Login Providers</Title>
                    <div className="mt-6 flex h-72 items-center justify-center">
                        <DonutChart
                            data={(() => {
                                const counts: Record<string, number> = {};
                                scopedUsers.forEach((u) => {
                                    const label = getLoginLabel(u);
                                    counts[label] = (counts[label] || 0) + 1;
                                });
                                return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
                            })()}
                            category="value"
                            index="name"
                            colors={['indigo', 'cyan', 'amber', 'emerald', 'slate']}
                            className="h-full w-full max-h-[240px]"
                            showAnimation
                        />
                    </div>
                </Card>
            </Grid>

            <section className="mt-6">
                <Card>
                    <div className="flex flex-col space-y-1.5 pb-4">
                        <h3 className="font-semibold leading-none tracking-tight">Recent Users</h3>
                        <p className="text-sm text-slate-500">Most recently created accounts with identity and sign-in context.</p>
                    </div>
                    <div className="space-y-6 mt-4">
                        {(scopedUsers.slice(0, 6)).map((user) => (
                            <a 
                                key={user.user_id} 
                                href={`/admin/users?user=${encodeURIComponent(user.user_id)}&drawer=user`}
                                className="flex items-center group hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                            >
                                <span className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 border border-transparent group-hover:border-slate-200 group-hover:shadow-sm transition-all">
                                    <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-slate-500 font-semibold uppercase group-hover:bg-white transition-colors">
                                        {getUserName(user).charAt(0)}
                                    </span>
                                </span>
                                <div className="ml-4 space-y-1 w-full max-w-[200px] sm:max-w-none">
                                    <p className="text-sm font-medium leading-none truncate group-hover:text-accent-700 transition-colors">{getUserName(user)}</p>
                                    <p className="text-sm text-slate-500 truncate">{user.email || 'No email'}</p>
                                </div>
                                <div className="ml-auto flex items-end flex-col gap-1 shrink-0 text-right font-medium">
                                    <span className="text-sm font-medium text-slate-700">{getLoginLabel(user)}</span>
                                    <span className="text-xs text-slate-500 hidden sm:inline-block">{(user.last_sign_in_at ? `Visit ${new Date(user.last_sign_in_at).toLocaleDateString()}` : 'No sign-in yet')}</span>
                                </div>
                            </a>
                        ))}
                        {scopedUsers.length === 0 && !isLoading && (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                No users found for this filter.
                            </div>
                        )}
                    </div>
                </Card>
            </section>
        </AdminShell>
    );
};
