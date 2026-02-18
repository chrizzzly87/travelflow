import React, { useEffect, useMemo, useState } from 'react';
import { SpinnerGap, ArrowClockwise } from '@phosphor-icons/react';
import { AdminShell, type AdminDateRange } from '../components/admin/AdminShell';
import { isIsoDateInRange } from '../components/admin/adminDateRange';
import { adminListTrips, adminUpdateTrip, type AdminTripRecord } from '../services/adminService';

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

export const AdminTripsPage: React.FC = () => {
    const [trips, setTrips] = useState<AdminTripRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'expired'>('all');
    const [dateRange, setDateRange] = useState<AdminDateRange>('30d');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadTrips = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const rows = await adminListTrips({
                limit: 600,
                status: statusFilter,
            });
            setTrips(rows);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Could not load trips.');
            setTrips([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadTrips();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const visibleTrips = useMemo(() => {
        const token = searchValue.trim().toLowerCase();
        return trips.filter((trip) => {
            if (!isIsoDateInRange(trip.updated_at || trip.created_at, dateRange)) return false;
            if (!token) return true;
            return (
                (trip.title || '').toLowerCase().includes(token)
                || trip.trip_id.toLowerCase().includes(token)
                || (trip.owner_email || '').toLowerCase().includes(token)
                || trip.owner_id.toLowerCase().includes(token)
            );
        });
    }, [dateRange, searchValue, trips]);

    const summary = useMemo(() => ({
        total: visibleTrips.length,
        active: visibleTrips.filter((trip) => trip.status === 'active').length,
        expired: visibleTrips.filter((trip) => trip.status === 'expired').length,
        archived: visibleTrips.filter((trip) => trip.status === 'archived').length,
    }), [visibleTrips]);

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

    return (
        <AdminShell
            title="Trip Lifecycle Controls"
            description="Inspect and adjust trip status, ownership, and expiration metadata."
            searchValue={searchValue}
            onSearchValueChange={setSearchValue}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            actions={(
                <button
                    type="button"
                    onClick={() => void loadTrips()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                >
                    <ArrowClockwise size={14} />
                    Refresh
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

            <section className="grid gap-3 md:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{summary.total}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
                    <p className="mt-2 text-2xl font-black text-emerald-700">{summary.active}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expired</p>
                    <p className="mt-2 text-2xl font-black text-amber-700">{summary.expired}</p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Archived</p>
                    <p className="mt-2 text-2xl font-black text-slate-700">{summary.archived}</p>
                </article>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Trips</h2>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'archived' | 'expired')}
                        className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
                    >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="archived">Archived</option>
                    </select>
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
                                <tr key={trip.trip_id} className="border-b border-slate-100 align-top">
                                    <td className="px-3 py-2">
                                        <div className="max-w-[320px] truncate text-sm font-semibold text-slate-800">{trip.title || trip.trip_id}</div>
                                        <div className="text-xs text-slate-500">{trip.trip_id}</div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600">{trip.owner_email || trip.owner_id}</td>
                                    <td className="px-3 py-2">
                                        <select
                                            value={trip.status}
                                            onChange={(event) => {
                                                void updateTripStatus(trip, { status: event.target.value as 'active' | 'archived' | 'expired' });
                                            }}
                                            className="h-8 rounded border border-slate-300 px-2 text-xs"
                                        >
                                            <option value="active">active</option>
                                            <option value="expired">expired</option>
                                            <option value="archived">archived</option>
                                        </select>
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
        </AdminShell>
    );
};
