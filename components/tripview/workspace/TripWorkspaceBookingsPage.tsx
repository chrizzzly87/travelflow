import React from 'react';

import type { ITrip } from '../../../types';
import { THAILAND_BOOKINGS } from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

interface TripWorkspaceBookingsPageProps {
    trip: ITrip;
}

const FILTERS = ['All', 'Confirmed', 'Needs review', 'Missing'] as const;
type BookingFilter = typeof FILTERS[number];

export const TripWorkspaceBookingsPage: React.FC<TripWorkspaceBookingsPageProps> = ({ trip }) => {
    const [activeFilter, setActiveFilter] = React.useState<BookingFilter>('All');
    const cityStopCount = React.useMemo(
        () => trip.items.filter((item) => item.type === 'city').length,
        [trip.items],
    );
    const bookings = React.useMemo(() => THAILAND_BOOKINGS.filter((booking) => (
        activeFilter === 'All' || booking.status === activeFilter
    )), [activeFilter]);

    return (
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
                                <p className="text-sm font-medium text-foreground">{booking.title}</p>
                                <Badge variant={booking.status === 'Confirmed' ? 'secondary' : 'outline'}>{booking.status}</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{booking.meta}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card className="border-border/80 bg-card/95 shadow-sm">
                <CardHeader>
                    <CardDescription>Current demo rule</CardDescription>
                    <CardTitle>Keep booking decisions visible</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                    <p>Bookings should clarify where the trip is blocked, not bury that signal inside the planner modal.</p>
                    <p>In this Thailand demo, the coast-base decision is intentionally the missing hinge because it affects atmosphere, transfers, and cost all at once across {cityStopCount} city phases.</p>
                    <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                        <p className="text-sm font-medium text-foreground">Current blocker</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">Use this board to resolve the Krabi coast-base stay before the transfer chain gets locked in.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
