import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowSquareOut, SpinnerGap, Trash, X } from '@phosphor-icons/react';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import {
    adminGetUserProfile,
    adminHardDeleteTrip,
    adminListTrips,
    adminUpdateTrip,
    type AdminTripRecord,
    type AdminUserRecord,
} from '../services/adminService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../components/admin/AdminFilterMenu';
import { AdminCountUpNumber } from '../components/admin/AdminCountUpNumber';
import { CopyableUuid } from '../components/admin/CopyableUuid';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { Drawer, DrawerContent } from '../components/ui/drawer';
import { Checkbox } from '../components/ui/checkbox';
import { useAppDialog } from '../components/AppDialogProvider';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';

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
    const { confirm: confirmDialog } = useAppDialog();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const cachedTrips = useMemo(
        () => readAdminCache<AdminTripRecord[]>(TRIPS_CACHE_KEY, []),
        []
    );
    const [trips, setTrips] = useState<AdminTripRecord[]>(cachedTrips);
    const [isLoading, setIsLoading] = useState(() => cachedTrips.length === 0);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(() => new Set());
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
    const [selectedTripDrawerId, setSelectedTripDrawerId] = useState<string | null>(null);
    const [isTripDrawerOpen, setIsTripDrawerOpen] = useState(false);
    const [isLoadingOwnerProfile, setIsLoadingOwnerProfile] = useState(false);
    const handledDeepLinkedOwnerIdRef = useRef<string | null>(null);
    const handledDeepLinkedTripIdRef = useRef<string | null>(null);
    const deepLinkedOwnerId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const userId = searchParams.get('user');
        if (drawer !== 'user' || !userId) return null;
        return userId;
    }, [searchParams]);
    const deepLinkedTripId = useMemo(() => {
        const drawer = searchParams.get('drawer');
        const tripId = searchParams.get('trip');
        if (drawer !== 'trip' || !tripId) return null;
        return tripId;
    }, [searchParams]);

    useEffect(() => {
        const next = new URLSearchParams();
        const trimmedSearch = searchValue.trim();
        if (trimmedSearch) next.set('q', trimmedSearch);
        if (statusFilters.length > 0 && statusFilters.length < TRIP_STATUS_VALUES.length) {
            next.set('status', statusFilters.join(','));
        }
        if (dateRange !== '30d') next.set('range', dateRange);
        const drawerTripId = selectedTripDrawerId || deepLinkedTripId;
        const drawerOwnerId = selectedOwnerId || deepLinkedOwnerId;
        if ((isTripDrawerOpen || deepLinkedTripId) && drawerTripId) {
            next.set('trip', drawerTripId);
            next.set('drawer', 'trip');
        } else if ((isOwnerDrawerOpen || deepLinkedOwnerId) && drawerOwnerId) {
            next.set('user', drawerOwnerId);
            next.set('drawer', 'user');
        }
        if (next.toString() === searchParams.toString()) return;
        setSearchParams(next, { replace: true });
    }, [
        dateRange,
        deepLinkedOwnerId,
        deepLinkedTripId,
        isOwnerDrawerOpen,
        isTripDrawerOpen,
        searchParams,
        searchValue,
        selectedOwnerId,
        selectedTripDrawerId,
        setSearchParams,
        statusFilters,
    ]);

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
    const selectedVisibleTrips = useMemo(
        () => visibleTrips.filter((trip) => selectedTripIds.has(trip.trip_id)),
        [selectedTripIds, visibleTrips]
    );
    const selectedTripForDrawer = useMemo(
        () => trips.find((trip) => trip.trip_id === selectedTripDrawerId) || null,
        [selectedTripDrawerId, trips]
    );
    const areAllVisibleTripsSelected = visibleTrips.length > 0 && visibleTrips.every((trip) => selectedTripIds.has(trip.trip_id));
    const isVisibleTripSelectionPartial = selectedVisibleTrips.length > 0 && !areAllVisibleTripsSelected;

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
        setSelectedTripDrawerId(null);
        setIsTripDrawerOpen(false);
        setSelectedOwnerId(ownerId);
        setIsOwnerDrawerOpen(true);
    };

    const openTripDrawer = (tripId: string) => {
        setSelectedOwnerId(null);
        setSelectedOwnerProfile(null);
        setIsOwnerDrawerOpen(false);
        setSelectedTripDrawerId(tripId);
        setIsTripDrawerOpen(true);
    };

    const toggleTripSelection = (tripId: string, checked: boolean) => {
        setSelectedTripIds((current) => {
            const next = new Set(current);
            if (checked) next.add(tripId);
            else next.delete(tripId);
            return next;
        });
    };

    const toggleSelectAllVisibleTrips = (checked: boolean) => {
        setSelectedTripIds((current) => {
            const next = new Set(current);
            if (!checked) {
                visibleTrips.forEach((trip) => next.delete(trip.trip_id));
                return next;
            }
            visibleTrips.forEach((trip) => next.add(trip.trip_id));
            return next;
        });
    };

    const handleBulkSoftDeleteTrips = async () => {
        if (selectedVisibleTrips.length === 0) return;
        const confirmed = await confirmDialog({
            title: 'Soft delete selected trips',
            message: `Archive ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? '' : 's'}?`,
            confirmLabel: 'Archive',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await Promise.all(selectedVisibleTrips.map((trip) => adminUpdateTrip(trip.trip_id, { status: 'archived' })));
            setMessage(`${selectedVisibleTrips.length} trip${selectedVisibleTrips.length === 1 ? '' : 's'} archived.`);
            setSelectedTripIds(new Set());
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not archive selected trips.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkHardDeleteTrips = async () => {
        if (selectedVisibleTrips.length === 0) return;
        const confirmed = await confirmDialog({
            title: 'Hard delete selected trips',
            message: `Hard-delete ${selectedVisibleTrips.length} selected trip${selectedVisibleTrips.length === 1 ? '' : 's'}? This cannot be undone.`,
            confirmLabel: 'Hard delete',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;
        setIsSaving(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const results = await Promise.allSettled(selectedVisibleTrips.map((trip) => adminHardDeleteTrip(trip.trip_id)));
            const failed = results.filter((result) => result.status === 'rejected').length;
            const deleted = results.length - failed;
            if (deleted > 0) {
                setMessage(
                    failed > 0
                        ? `${deleted} trip${deleted === 1 ? '' : 's'} permanently deleted. ${failed} failed.`
                        : `${deleted} trip${deleted === 1 ? '' : 's'} permanently deleted.`
                );
            }
            if (failed > 0 && deleted === 0) {
                throw new Error('Could not hard-delete selected trips.');
            }
            setSelectedTripIds(new Set());
            await loadTrips();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not hard-delete selected trips.');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!deepLinkedOwnerId) {
            handledDeepLinkedOwnerIdRef.current = null;
            return;
        }
        if (handledDeepLinkedOwnerIdRef.current !== deepLinkedOwnerId) {
            setSelectedTripDrawerId(null);
            setIsTripDrawerOpen(false);
            setSelectedOwnerId(deepLinkedOwnerId);
            setIsOwnerDrawerOpen(true);
            handledDeepLinkedOwnerIdRef.current = deepLinkedOwnerId;
        }
    }, [deepLinkedOwnerId]);

    useEffect(() => {
        if (!deepLinkedTripId) {
            handledDeepLinkedTripIdRef.current = null;
            return;
        }
        if (handledDeepLinkedTripIdRef.current !== deepLinkedTripId) {
            setSelectedOwnerId(null);
            setSelectedOwnerProfile(null);
            setIsOwnerDrawerOpen(false);
            setSelectedTripDrawerId(deepLinkedTripId);
            setIsTripDrawerOpen(true);
            handledDeepLinkedTripIdRef.current = deepLinkedTripId;
        }

        const hasTripInList = trips.some((trip) => trip.trip_id === deepLinkedTripId);
        if (hasTripInList) return;

        let active = true;
        void adminListTrips({ search: deepLinkedTripId, limit: 20, status: 'all' })
            .then((rows) => {
                if (!active) return;
                const exactMatch = rows.find((row) => row.trip_id === deepLinkedTripId);
                if (!exactMatch) return;
                setTrips((current) => {
                    const exists = current.some((candidate) => candidate.trip_id === exactMatch.trip_id);
                    const nextTrips = exists
                        ? current.map((candidate) => (
                            candidate.trip_id === exactMatch.trip_id ? { ...candidate, ...exactMatch } : candidate
                        ))
                        : [exactMatch, ...current];
                    writeAdminCache(TRIPS_CACHE_KEY, nextTrips);
                    return nextTrips;
                });
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : 'Could not load linked trip.');
            });

        return () => {
            active = false;
        };
    }, [deepLinkedTripId, trips]);

    useEffect(() => {
        setSelectedTripIds((current) => {
            if (current.size === 0) return current;
            const allowed = new Set(visibleTrips.map((trip) => trip.trip_id));
            let changed = false;
            const next = new Set<string>();
            current.forEach((tripId) => {
                if (allowed.has(tripId)) {
                    next.add(tripId);
                    return;
                }
                changed = true;
            });
            return changed ? next : current;
        });
    }, [visibleTrips]);

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

                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-700">{selectedVisibleTrips.length} selected</span>
                    <button
                        type="button"
                        onClick={() => void handleBulkSoftDeleteTrips()}
                        disabled={isSaving || selectedVisibleTrips.length === 0}
                        className="inline-flex h-8 items-center rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Soft-delete selected
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleBulkHardDeleteTrips()}
                        disabled={isSaving || selectedVisibleTrips.length === 0}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash size={12} />
                        Hard delete selected
                    </button>
                    {selectedVisibleTrips.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedTripIds(new Set())}
                            className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto rounded-xl border bg-card/50">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-12 px-4 py-3">
                                    <Checkbox
                                        checked={areAllVisibleTripsSelected ? true : (isVisibleTripSelectionPartial ? 'indeterminate' : false)}
                                        onCheckedChange={(checked) => toggleSelectAllVisibleTrips(Boolean(checked))}
                                        aria-label="Select all visible trips"
                                    />
                                </TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Trip</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Owner</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Status</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Expires at</TableHead>
                                <TableHead className="px-4 py-3 font-semibold text-slate-700">Last update</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleTrips.map((trip) => (
                                <TableRow
                                    key={trip.trip_id}
                                    data-state={selectedTripIds.has(trip.trip_id) ? "selected" : undefined}
                                >
                                    <TableCell className="px-4 py-3">
                                        <Checkbox
                                            checked={selectedTripIds.has(trip.trip_id)}
                                            onCheckedChange={(checked) => toggleTripSelection(trip.trip_id, Boolean(checked))}
                                            aria-label={`Select trip ${trip.title || trip.trip_id}`}
                                        />
                                    </TableCell>
                                    <TableCell className="px-4 py-3 max-w-[280px]">
                                        <button
                                            type="button"
                                            onClick={() => openTripDrawer(trip.trip_id)}
                                            title="Open trip details drawer"
                                            className="inline-flex cursor-pointer xl:max-w-full items-center gap-1.5 truncate text-left text-sm font-semibold text-slate-800 hover:text-accent-700 hover:underline"
                                        >
                                            <span className="truncate">{trip.title || trip.trip_id}</span>
                                        </button>
                                        <div className="text-xs text-slate-500 mt-1">
                                            <CopyableUuid
                                                value={trip.trip_id}
                                                textClassName="max-w-full truncate text-xs"
                                                hintClassName="text-[9px]"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-xs text-slate-600 max-w-[240px]">
                                        <button
                                            type="button"
                                            onClick={() => openOwnerDrawer(trip.owner_id)}
                                            title="Open owner details"
                                            className="group cursor-pointer xl:max-w-full text-left"
                                        >
                                            <span className="block truncate text-sm font-medium text-slate-700 group-hover:text-accent-700 group-hover:underline">
                                                {trip.owner_email || trip.owner_id}
                                            </span>
                                            <span className="block text-[11px] text-slate-500 mt-0.5">
                                                <CopyableUuid
                                                    value={trip.owner_id}
                                                    focusable={false}
                                                    textClassName="max-w-full truncate text-[11px]"
                                                    hintClassName="text-[9px]"
                                                />
                                            </span>
                                        </button>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <Select
                                            value={trip.status}
                                            onValueChange={(value) => {
                                                void updateTripStatus(trip, { status: value as 'active' | 'archived' | 'expired' });
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-[130px] text-xs font-medium">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="expired">Expired</SelectItem>
                                                <SelectItem value="archived">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="px-4 py-3">
                                        <input
                                            key={`${trip.trip_id}-${trip.updated_at}`}
                                            type="datetime-local"
                                            defaultValue={toDateTimeInputValue(trip.trip_expires_at)}
                                            onBlur={(event) => {
                                                void updateTripStatus(trip, {
                                                    tripExpiresAt: fromDateTimeInputValue(event.target.value),
                                                });
                                            }}
                                            className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm shadow-black/5"
                                        />
                                    </TableCell>
                                    <TableCell className="px-4 py-3 text-sm text-slate-500">
                                        {new Date(trip.updated_at).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {visibleTrips.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                                        No trips match the current filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoading && (
                                <TableRow>
                                    <TableCell className="px-4 py-8 text-center text-sm text-slate-500" colSpan={6}>
                                        <span className="inline-flex items-center gap-2 font-medium">
                                            <SpinnerGap size={16} className="animate-spin text-slate-400" />
                                            Loading trips...
                                        </span>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {isSaving && (
                    <p className="mt-2 text-xs text-slate-500">Saving changes...</p>
                )}
            </section>

            <Drawer
                open={isTripDrawerOpen}
                onOpenChange={(open) => {
                    setIsTripDrawerOpen(open);
                    if (!open) {
                        setSelectedTripDrawerId(null);
                        if (searchParams.has('trip') || searchParams.get('drawer') === 'trip') {
                            const next = new URLSearchParams(searchParams);
                            next.delete('trip');
                            next.delete('drawer');
                            setSearchParams(next, { replace: true });
                        }
                    }
                }}
                direction="right"
            >
                <DrawerContent
                    side="right"
                    className="w-[min(96vw,560px)] p-0"
                    accessibleTitle={selectedTripForDrawer ? (selectedTripForDrawer.title || selectedTripForDrawer.trip_id) : 'Trip details'}
                    accessibleDescription="Inspect selected trip metadata and jump to related owner details."
                >
                    <div className="flex h-full flex-col">
                        <div className="border-b border-slate-200 px-5 py-4">
                            <h2 className="text-base font-black text-slate-900">Trip details</h2>
                            <p className="truncate text-sm text-slate-600">
                                {selectedTripForDrawer ? (selectedTripForDrawer.title || selectedTripForDrawer.trip_id) : 'No trip selected'}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {!selectedTripForDrawer ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    No trip found for the selected audit target.
                                </div>
                            ) : (
                                <section className="space-y-3 rounded-xl border border-slate-200 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trip metadata</h3>
                                    <div className="space-y-1 text-sm text-slate-700">
                                        <div className="break-all">
                                            <span className="font-semibold text-slate-800">Trip ID:</span>{' '}
                                            <CopyableUuid value={selectedTripForDrawer.trip_id} textClassName="break-all text-sm" />
                                        </div>
                                        <div><span className="font-semibold text-slate-800">Status:</span> {selectedTripForDrawer.status}</div>
                                        <div><span className="font-semibold text-slate-800">Owner:</span> {selectedTripForDrawer.owner_email || selectedTripForDrawer.owner_id}</div>
                                        <div className="break-all">
                                            <span className="font-semibold text-slate-800">Owner ID:</span>{' '}
                                            <CopyableUuid value={selectedTripForDrawer.owner_id} textClassName="break-all text-sm" />
                                        </div>
                                        <div><span className="font-semibold text-slate-800">Expires at:</span> {selectedTripForDrawer.trip_expires_at ? new Date(selectedTripForDrawer.trip_expires_at).toLocaleString() : 'Not set'}</div>
                                        <div><span className="font-semibold text-slate-800">Source:</span> {selectedTripForDrawer.source_kind || 'n/a'}</div>
                                        <div><span className="font-semibold text-slate-800">Created:</span> {new Date(selectedTripForDrawer.created_at).toLocaleString()}</div>
                                        <div><span className="font-semibold text-slate-800">Updated:</span> {new Date(selectedTripForDrawer.updated_at).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openOwnerDrawer(selectedTripForDrawer.owner_id)}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Open owner drawer
                                        </button>
                                        <a
                                            href={`/trip/${encodeURIComponent(selectedTripForDrawer.trip_id)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Open trip
                                            <ArrowSquareOut size={12} />
                                        </a>
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <Drawer
                open={isOwnerDrawerOpen}
                onOpenChange={(open) => {
                    setIsOwnerDrawerOpen(open);
                    if (!open) {
                        setSelectedOwnerId(null);
                        setSelectedOwnerProfile(null);
                        if (searchParams.has('user') || searchParams.get('drawer') === 'user') {
                            const next = new URLSearchParams(searchParams);
                            next.delete('user');
                            next.delete('drawer');
                            setSearchParams(next, { replace: true });
                        }
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
                            <p className="truncate text-sm text-slate-600">
                                {selectedOwnerId
                                    ? <CopyableUuid value={selectedOwnerId} textClassName="max-w-[360px] truncate text-sm" />
                                    : 'No owner selected'}
                            </p>
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
                                        <div className="break-all">
                                            <span className="font-semibold text-slate-800">User ID:</span>{' '}
                                            <CopyableUuid value={selectedOwnerProfile.user_id} textClassName="break-all text-sm" />
                                        </div>
                                        <div><span className="font-semibold text-slate-800">Role:</span> {selectedOwnerProfile.system_role === 'admin' ? 'Admin' : 'User'}</div>
                                        <div><span className="font-semibold text-slate-800">Tier:</span> {selectedOwnerProfile.tier_key}</div>
                                        <div><span className="font-semibold text-slate-800">Account status:</span> {formatAccountStatusLabel(selectedOwnerProfile.account_status)}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/admin/users?user=${encodeURIComponent(selectedOwnerProfile.user_id)}&drawer=user`)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Open owner profile
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
