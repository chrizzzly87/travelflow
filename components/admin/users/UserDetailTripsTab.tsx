import React from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminPagination } from '../AdminPagination';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { CopyableUuid } from '../CopyableUuid';
import type { AdminTripRecord } from '../../../services/adminService';
import {
    USER_DETAIL_TRIP_PAGE_SIZE,
    clampPage,
    fromDateTimeInputValue,
    isTripExpiryInputUnchanged,
    slicePage,
    toDateTimeInputValue,
} from '../adminUsersModel';

type TripStatus = 'active' | 'archived' | 'expired';

/** The account's owned trips. Status and expiry save as soon as they change. */
export const UserDetailTripsTab: React.FC<{
    trips: AdminTripRecord[];
    isLoading: boolean;
    page: number;
    onPageChange: (page: number) => void;
    tripsPageLink: string;
    onPatchTrip: (trip: AdminTripRecord, patch: { status?: TripStatus; tripExpiresAt?: string | null }) => void;
}> = ({ trips, isLoading, page, onPageChange, tripsPageLink, onPatchTrip }) => {
    const safePage = clampPage(page, trips.length, USER_DETAIL_TRIP_PAGE_SIZE);
    const pagedTrips = slicePage(trips, safePage, USER_DETAIL_TRIP_PAGE_SIZE);

    return (
        <section className="flex flex-col gap-3">
            <AdminSectionHeader
                as="h3"
                title="Owned trips"
                description="Status and expiry save as soon as you change them."
                actions={(
                    <Button asChild variant="outline" size="xs">
                        <Link to={tripsPageLink}>Open in Trips</Link>
                    </Button>
                )}
            />
            {isLoading ? (
                <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                    Loading trips…
                </div>
            ) : trips.length === 0 ? (
                <AdminEmptyState
                    className="py-6"
                    title="No trips owned by this user"
                    description="Trips this user creates or receives by transfer will appear here."
                />
            ) : (
                <>
                    <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                        {pagedTrips.map((trip) => (
                            <li key={trip.trip_id} className="flex flex-col gap-2 p-3">
                                <div className="min-w-0">
                                    <a
                                        href={`/trip/${encodeURIComponent(trip.trip_id)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        data-tooltip="Open trip in a new tab"
                                        className="block truncate text-sm font-medium text-foreground hover:underline"
                                    >
                                        {trip.title || trip.trip_id}
                                    </a>
                                    <CopyableUuid
                                        value={trip.trip_id}
                                        className="-ms-1"
                                        textClassName="max-w-[300px] truncate text-[11px] text-muted-foreground"
                                        hintClassName="text-[9px]"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <Select
                                        value={trip.status}
                                        onValueChange={(value) => onPatchTrip(trip, { status: value as TripStatus })}
                                    >
                                        <SelectTrigger className="h-8 !w-[120px] min-w-[120px] text-xs" aria-label={`Status for ${trip.title || trip.trip_id}`}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="expired">Expired</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <label className="flex items-center gap-2 text-muted-foreground">
                                        Expires
                                        <Input
                                            key={`${trip.trip_id}-${trip.updated_at}`}
                                            type="datetime-local"
                                            aria-label={`Trip expiration for ${trip.title || trip.trip_id}`}
                                            defaultValue={toDateTimeInputValue(trip.trip_expires_at)}
                                            onBlur={(event) => {
                                                if (isTripExpiryInputUnchanged(event.target.value, trip.trip_expires_at)) return;
                                                onPatchTrip(trip, { tripExpiresAt: fromDateTimeInputValue(event.target.value) });
                                            }}
                                            className="h-8 w-auto text-xs"
                                        />
                                    </label>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <AdminPagination
                        page={safePage}
                        pageSize={USER_DETAIL_TRIP_PAGE_SIZE}
                        totalItems={trips.length}
                        onPageChange={onPageChange}
                        noun="trips"
                    />
                </>
            )}
        </section>
    );
};
