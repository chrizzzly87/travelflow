import type { ITrip, IViewSettings } from '../../types';
import type { DbTripAccess } from '../../services/dbApi';

export interface TripRouteData {
    trip: ITrip;
    view?: IViewSettings;
    access: DbTripAccess | null;
}
export interface SharedTripRouteData extends TripRouteData {
    shareMode: 'view' | 'edit';
    allowCopy: boolean;
    sourceShareVersionId: string | null;
    snapshotState: { hasNewer: boolean; latestUrl: string } | null;
}
export interface ExampleTripRouteData extends TripRouteData {
    templateId: string;
    templateTitle: string;
    countries: string[];
}

/** Only version affects fetched data; view controls stay in the current session. */
export const tripLoaderDeps = ({ search }: { search: Record<string, unknown> }) => ({
    versionId: typeof search.v === 'string' ? search.v : undefined,
});
