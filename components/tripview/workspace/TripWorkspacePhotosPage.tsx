import React from 'react';
import { HeartStraight } from '@phosphor-icons/react';

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

interface TripWorkspacePhotosPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
}

export const TripWorkspacePhotosPage: React.FC<TripWorkspacePhotosPageProps> = ({
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
    const photos = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(pageDataset.photos, pageContextSelection, 'city'),
        [pageContextSelection, pageDataset.photos],
    );
    const [favoriteIds, setFavoriteIds] = React.useState<string[]>([photos[0]?.id ?? '']);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="photos"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {photos.map((photo, index) => {
                    const isFavorite = favoriteIds.includes(photo.id);
                    return (
                        <Card key={photo.id} className="overflow-hidden border-border/80 bg-card/95 shadow-sm">
                            <CardHeader className="gap-3">
                                <div className="flex items-center justify-between gap-3">
                                    <Badge variant="outline">{photo.mood}</Badge>
                                    <button
                                        type="button"
                                        onClick={() => setFavoriteIds((current) => current.includes(photo.id)
                                            ? current.filter((id) => id !== photo.id)
                                            : [...current, photo.id])}
                                        className={`rounded-full border p-2 transition-colors ${
                                            isFavorite
                                                ? 'border-rose-300 bg-rose-50 text-rose-600'
                                                : 'border-border bg-background text-muted-foreground hover:border-rose-300 hover:text-rose-600'
                                        }`}
                                        aria-label={isFavorite ? 'Favorite photo' : 'Favorite this photo'}
                                    >
                                        <HeartStraight size={14} weight={isFavorite ? 'fill' : 'duotone'} />
                                    </button>
                                </div>
                                <CardDescription>Album stub {index + 1}</CardDescription>
                                <CardTitle>{photo.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <div className="aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-border/70 bg-linear-to-br from-accent/15 via-amber-50 to-emerald-50">
                                    <div className="flex h-full items-end justify-between bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.75),_transparent_45%),linear-gradient(180deg,transparent_10%,rgba(15,23,42,0.08)_100%)] p-4">
                                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground/60">{photo.mood}</p>
                                        {isFavorite ? <Badge variant="secondary">Saved</Badge> : null}
                                    </div>
                                </div>
                                <p className="text-sm leading-6 text-muted-foreground">{photo.caption}</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
