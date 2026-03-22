import React from 'react';
import { PushPinSimple } from '@phosphor-icons/react';

import type { ITrip, TripWorkspaceContextSelection } from '../../../types';
import type { TripWorkspaceDemoDataset } from './tripWorkspaceDemoData';
import { filterTripWorkspaceEntriesBySelection } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
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

interface TripWorkspaceNotesPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
}

export const TripWorkspaceNotesPage: React.FC<TripWorkspaceNotesPageProps> = ({
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
    const notes = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(pageDataset.notes, pageContextSelection, 'city'),
        [pageContextSelection, pageDataset.notes],
    );
    const [pinnedId, setPinnedId] = React.useState<string>(notes[0]?.id ?? '');

    React.useEffect(() => {
        if (!notes.some((note) => note.id === pinnedId)) {
            setPinnedId(notes[0]?.id ?? '');
        }
    }, [notes, pinnedId]);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="notes"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />
            <div className="grid gap-4 xl:grid-cols-3">
                {notes.map((note) => {
                    const isPinned = pinnedId === note.id;
                    return (
                        <Card key={note.id} className="border-border/80 bg-card/95 shadow-sm">
                            <CardHeader className="gap-3">
                                <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline">{note.type}</Badge>
                                    <button
                                        type="button"
                                        onClick={() => setPinnedId(note.id)}
                                        className={`rounded-full border p-2 transition-colors ${
                                            isPinned
                                                ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                        }`}
                                        aria-label={isPinned ? 'Pinned note' : 'Pin note'}
                                    >
                                        <PushPinSimple size={14} weight={isPinned ? 'fill' : 'duotone'} />
                                    </button>
                                </div>
                                <CardDescription>{isPinned ? 'Pinned note' : 'Diary stub'}</CardDescription>
                                <CardTitle>{note.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm leading-6 text-muted-foreground">{note.body}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
