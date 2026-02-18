import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowSquareOut, SpinnerGap, X } from '@phosphor-icons/react';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import {
    adminGetUserProfile,
    adminListTrips,
    adminUpdateTrip,
    type AdminTripRecord,
    type AdminUserRecord,
} from '../services/adminService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { Drawer, DrawerContent } from '../components/ui/drawer';

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

type TripStatus = 'active' | 'archived' | 'expired';

const TRIPS_CACHE_KEY = 'admin.trips.cache.v1';
const TRIP_STATUS_VALUES: readonly TripStatus[] = ['active', 'archived', 'expired'];

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
            if (allowSet.has(chunk)) unique.add(chunk);
        });
    return allowedValues.filter((candidate) => unique.has(candidate));
};

const getUserDisplayName = (user: AdminUserRecord): string => {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    if (user.display_name?.trim()) return user.display_name.trim();
    if (user.username?.trim()) return user.username.trim();
    if (user.email?.trim()) return user.email.trim();
    return user.user_id;
};

const formatAccountStatusLabel = (status: string | null | undefined): string => {
    const normalized = (status || 'active').toLowerCase();
    if (normalized === 'disabled') return 'Suspended';
    if (normalized === 'deleted') return 'Deleted';
    return 'Active';
};

export const AdminTripsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const cachedTrips = useMemo(
        () => readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []),
        []
    );
    const [trips, setTrips] = useState<AdminTripRecord[]>(cachedTrips);
    const [isLoading, setIsLoading] = useState(() => cachedTrips.length === 0);
    const [isSaving, setIsSaving] = useState(false);
    const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '');
    const [statusFilters, setStatusFilters] = useState<TripStatus[]>(
        () => parseQueryMultiValue(searchParams.get('status'), TRIP_STATUS_VALUES)
    );
    const [dateRange, setDateRange] = useState<AdminDateRange>(() => {
        const value = searchParams.get('range');
        if (value === '7d' || value === '30d' || value === '90d' || value === 'all') return value;
        return '30d';
    });
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
    const [selectedOwnerProfile, setSelectedOwnerProfile] = useState<AdminUserRecord | null>(null);
    const [isOwnerDrawerOpen, setIsOwnerDrawerOpen] = useState(false);
    const [isLoadingOwnerProfile, setIsLoadingOwnerProfile] = useState(false);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (statusFilters.length > 0 && statusFilters.length < TRIP_STATUS_VALUES.length) {
            next.set('status', statusFilters.join(','));
        }
        if (dateRange !== '30d') next.set('range', dateRange);
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [dateRange, searchParams, searchValue, setSearchParams, statusFilters]);

    const loadTrips = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const rows = await adminListTrips({
                limit: 600,
                status: 'all',
            });
            setTrips(rows);
            writeAdminCache(TRIPS_CACHE_KEY, rows);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load trips.');
            setTrips((current) => (current.length > 0 ? current : []));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadTrips();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const visibleTrips = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return trips.filter((trip) => {
            if (!isIsoDateInRange(trip.updated_at || trip.created_at, dateRange)) return false;
            if (statusFilters.length > 0 && !statusFilters.includes(trip.status)) return false;
            if (!token) return true;
            return (
                (trip.title || '').toLowerCase().includes(token)
                || trip.trip_id.toLowerCase().includes(token)
                || (trip.owner_email || '').toLowerCase().includes(token)
                || trip.owner_id.toLowerCase().includes(token)
            );
        });
    }, [dateRange, searchValue, statusFilters, trips]);

    const tripsInDateRange = useMemo(
        () => trips.filter((trip) => isIsoDateInRange(trip.updated_at || trip.created_at, dateRange)),
        [dateRange, trips]
    );

    const summary = useMemo(() => ({
        total: visibleTrips.length,
        active: visibleTrips.filter((trip) => trip.status === 'active').length,
        expired: visibleTrips.filter((trip) => trip.status === 'expired').length,
        archived: visibleTrips.filter((trip) => trip.status === 'archived').length,
    }), [visibleTrips]);

    const statusFilterOptions = useMemo<AdminFilterMenuOption[]>(
        () => TRIP_STATUS_VALUES.map((value) => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
            count: tripsInDateRange.filter((trip) => trip.status === value).length,
        })),
        [tripsInDateRange]
    );

    const updateTripStatus = async (
        trip: AdminTripRecord,
        patch: {
            status?: 'active' | 'archived' | 'expired';
            tripExpiresAt?: string | null;
        }
    ) => {
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await adminUpdateTrip(trip.trip_id, patch);
            setMessage('Trip updated.');
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not update trip.');
        } finally {
            setIsSaving(false);
        }
    };

    const resetTripFilters = () => {
        setStatusFilters([]);
    };

    const openOwnerDrawer = (ownerId: string) => {
        setSelectedOwnerId(ownerId);
        setIsOwnerDrawerOpen(true);
    };

    useEffect(() => {
        if (!isOwnerDrawerOpen || !selectedOwnerId) return;
        let active = true;
        setIsLoadingOwnerProfile(true);
        void adminGetUserProfile(selectedOwnerId)
            .then((profile) => {
                if (!active) return;
                setSelectedOwnerProfile(profile);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : 'Could not load owner profile.');
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingOwnerProfile(false);
            });
        return () => {
            active = false;
        };
    }, [isOwnerDrawerOpen, selectedOwnerId]);

    return (
        <AdminShell
            title="Trip Lifecycle Controls"
            description="Inspect and adjust trip status, ownership, and expiration metadata."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <AdminReloadButton
                    onClick={() => void loadTrips()}
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
            {message && (
                <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    {message}
                </section>
            )}

            <section className="grid gap-3 md:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                    <p className="mt-2 text-2xl font-black text-slate-900"><AdminCountUpNumber value={summary.total} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700"><AdminCountUpNumber value={summary.active} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expired</p>
                    <p className="mt-2 text-2xl font-black text-amber-700"><AdminCountUpNumber value={summary.expired} /></p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Archived</p>
                    <p className="mt-2 text-2xl font-black text-slate-700"><AdminCountUpNumber value={summary.archived} /></p>
                </article>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Trips</h2>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        <AdminFilterMenu
                            label="Status"
                            options={statusFilterOptions}
                            selectedValues={statusFilters}
                            onSelectedValuesChange={(next) => setStatusFilters(next as TripStatus[])}
                        />
                        <button
                            type="button"
                            onClick={resetTripFilters}
                            className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            <X size={14} />
                            Reset
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <th className="px-3 py-2">Trip</th>
                                <th className="px-3 py-2">Owner</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Expires at</th>
                                <th className="px-3 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTrips.map((trip) => (
                                <tr key={trip.trip_id} className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50">
                                    <td className="px-3 py-2">
                                        <a
                                            href={`/trip/${encodeURIComponent(trip.trip_id)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Open trip in a new tab"
                                            className="inline-flex max-w-[360px] cursor-pointer items-center gap-1 truncate text-sm font-semibold text-slate-800 hover:text-accent-700 hover:underline"
                                        >
                                            <span className="truncate">{trip.title || trip.trip_id}</span>
                                            <ArrowSquareOut size={12} />
                                        </a>
                                        <div className="text-xs text-slate-500">{trip.trip_id}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600">
                                        <button
                                            type="button"
                                            onClick={() => openOwnerDrawer(trip.owner_id)}
                                            title="Open owner details"
                                            className="group max-w-[320px] cursor-pointer text-left"
                                        >
                                            <span className="block truncate text-sm text-slate-700 group-hover:text-accent-700 group-hover:underline">
                                                {trip.owner_email || trip.owner_id}
                                            </span>
                                            <span className="block truncate text-[11px] text-slate-500">
                                                {trip.owner_id}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="px-3 py-2">
                                        <Select
                                            value={trip.status}
                                            onValueChange={(value) => {
                                                void updateTripStatus(trip, { status: value as 'active' | 'archived' | 'expired' });
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
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            key={`${trip.trip_id}-${trip.updated_at}`}
                                            type="datetime-local"
                                            defaultValue={toDateTimeInputValue(trip.trip_expires_at)}
                                            onBlur={(event) => {
                                                void updateTripStatus(trip, {
                                                    tripExpiresAt: fromDateTimeInputValue(event.target.value),
                                                });
                                            }}
                                            className="h-8 rounded border border-slate-300 px-2 text-xs"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500">
                                        Updated: {new Date(trip.updated_at).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {visibleTrips.length === 0 && !isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                                        No trips match the current filters.
                                    </td>
                                </tr>
                            )}
                            {isLoading && (
                                <tr>
                                    <td className="px-3 py-6 text-sm text-slate-500" colSpan={5}>
                                        <span className="inline-flex items-center gap-2">
                                            <SpinnerGap size={14} className="animate-spin" />
                                            Loading trips...
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {isSaving && (
                    <p className="mt-2 text-xs text-slate-500">Saving changes...</p>
                )}
            </section>

            <Drawer
                open={isOwnerDrawerOpen}
                onOpenChange={(open) => {
                    setIsOwnerDrawerOpen(open);
                    if (!open) {
                        setSelectedOwnerId(null);
                        setSelectedOwnerProfile(null);
                    }
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,560px)] p-0"
                    accessibleTitle="Owner details"
                    accessibleDescription="View selected trip owner identity and account context."
                >
                    <div className="flex h-full flex-col">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-black text-slate-900">Owner details</h2>
                            <p className="truncate text-sm text-slate-600">{selectedOwnerId || 'No owner selected'}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingOwnerProfile ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Loading owner profile...
                                </div>
                            ) : selectedOwnerProfile ? (
                                <section className="space-y-3 rounded-xl border border-slate-200 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Identity</h3>
                                    <div className="space-y-1 text-sm text-slate-700">
                                        <div><span className="font-semibold text-slate-800">Name:</span> {getUserDisplayName(selectedOwnerProfile)}</div>
                                        <div><span className="font-semibold text-slate-800">Email:</span> {selectedOwnerProfile.email || 'No email'}</div>
                                        <div className="break-all"><span className="font-semibold text-slate-800">User ID:</span> {selectedOwnerProfile.user_id}</div>
                                        <div><span className="font-semibold text-slate-800">Role:</span> {selectedOwnerProfile.system_role === 'admin' ? 'Admin' : 'User'}</div>
                                        <div><span className="font-semibold text-slate-800">Tier:</span> {selectedOwnerProfile.tier_key}</div>
                                        <div><span className="font-semibold text-slate-800">Account status:</span> {formatAccountStatusLabel(selectedOwnerProfile.account_status)}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/admin/users?q=${encodeURIComponent(selectedOwnerProfile.user_id)}`)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Open full user editor
                                        <ArrowSquareOut size={12} />
                                    </button>
                                </section>
                            ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    No owner profile found.
                                </div>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>
        </AdminShell>
    );
};
