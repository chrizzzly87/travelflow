import React from 'react';

import type { ITrip, TripWorkspaceContextSelection } from '../../../types';
import type { TripWorkspaceDemoDataset } from './tripWorkspaceDemoData';
import { filterTripWorkspaceEntriesBySelection } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { deriveTripActivityBoardCards, getActivityBoardCityLabel } from './tripActivityBoard';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceBookingsPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
}

const FILTERS = ['All', 'Confirmed', 'Needs review', 'Missing'] as const;
type BookingFilter = typeof FILTERS[number];

export const TripWorkspaceBookingsPage: React.FC<TripWorkspaceBookingsPageProps> = ({
    trip,
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
}) => {
    const pageTripMeta = React.useMemo(
        () => tripMeta ?? resolveTripWorkspaceFallbackTripMeta(trip),
        [trip, tripMeta],
    );
    const {
        dataset: pageDataset,
        contextSelection: pageContextSelection,
        onContextSelectionChange: handleContextSelectionChange,
    } = useTripWorkspacePageContext({
        trip,
        dataset,
        contextSelection,
        onContextSelectionChange,
    });
    const [activeFilter, setActiveFilter] = React.useState<BookingFilter>('All');
    const bookedActivityCards = React.useMemo(
        () => deriveTripActivityBoardCards(trip).filter((card) => card.status === 'booked'),
        [trip],
    );
    const scopedBookings = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(pageDataset.bookings, pageContextSelection, 'city'),
        [pageContextSelection, pageDataset.bookings],
    );
    const bookings = React.useMemo(() => scopedBookings.filter((booking) => (
        activeFilter === 'All' || booking.status === activeFilter
    )), [activeFilter, scopedBookings]);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="bookings"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader className="gap-3">
                        <CardDescription>Logistics board</CardDescription>
                        <CardTitle>Booking pressure by status</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            {FILTERS.map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    onClick={() => setActiveFilter(filter)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeFilter === filter
                                            ? 'border-accent-500 bg-accent-50 text-accent-700'
                                            : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {bookings.map((booking) => (
                            <div key={booking.id} className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{booking.title}</p>
                                        {booking.type ? <p className="mt-1 text-xs text-muted-foreground uppercase tracking-[0.08em]">{booking.type}</p> : null}
                                    </div>
                                    <Badge variant={booking.status === 'Confirmed' ? 'secondary' : 'outline'}>{booking.status}</Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.meta}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Booked activities from Explore</CardDescription>
                            <CardTitle>{bookedActivityCards.length} experiences already marked as booked</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {bookedActivityCards.length > 0 ? bookedActivityCards.map((card) => (
                                <div key={card.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-foreground">{card.title}</p>
                                        <Badge variant="secondary">Booked</Badge>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        {getActivityBoardCityLabel(card, trip.items)} • {card.description || card.note || 'Tracked from the activity workflow board.'}
                                    </p>
                                </div>
                            )) : (
                                <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground">
                                    No activity cards are marked as booked yet. Use the Explore board to move strong plans into a visible booked state.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Current demo rule</CardDescription>
                            <CardTitle>Keep booking decisions visible by country and city</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <p>Bookings should clarify where the route is blocked, not bury that signal inside the planner or modal flow.</p>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">Context-aware blocker</p>
                                <p className="mt-2">
                                    This view now follows the active route context, so border packets, stays, and activity bookings all feel tied to the same country and city selection as the rest of the workspace.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
