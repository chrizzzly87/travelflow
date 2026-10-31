import { useMemo } from 'react';
import { useSearch } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { parseSearchWith, searchNumberText, searchOption, searchText } from '../../app/routing/searchSchema';
import { TRIP_CLAIM_CONFLICT_QUERY_KEY } from '../../services/tripClaimNavigation';

/**
 * Query parameters of the trip area (`/trip/$tripId`, `/s/$token`,
 * `/example/$templateId`). Only `v` reaches a loader (`tripLoaderDeps`);
 * the rest belong to the open page. The view-setting keys are the ones
 * `applyViewSettingsToSearchParams` writes. Unknown parameters are kept.
 */
export const tripRouteSearchSchema = z.looseObject({
    /** Trip or share version to open. */
    v: searchText(),
    /** Queued generation request to claim after sign-in. */
    claim: searchText(),
    [TRIP_CLAIM_CONFLICT_QUERY_KEY]: searchText(),
    /** Deep link that opens the ideas deck once. */
    discover: searchOption(['1']),
    mode: searchOption(['print']),
    layout: searchOption(['vertical', 'horizontal']),
    timelineMode: searchOption(['calendar', 'timeline']),
    timelineView: searchOption(['vertical', 'horizontal']),
    mapStyle: searchOption(['minimal', 'standard', 'dark', 'satellite', 'clean', 'cleanDark']),
    routeMode: searchOption(['simple', 'realistic']),
    cityNames: searchOption(['1', '0']),
    zoom: searchNumberText(),
    sidebarWidth: searchNumberText(),
    detailsWidth: searchNumberText(),
    timelineHeight: searchNumberText(),
});
export type TripRouteSearch = z.infer<typeof tripRouteSearchSchema>;

export const parseTripRouteSearch = (search: unknown): TripRouteSearch => parseSearchWith(tripRouteSearchSchema, search);

/**
 * The validated query of the trip page that renders the caller. It reads the
 * caller's own match, never the pending destination (#586). TripView is shared
 * by three routes, so it reads the nearest match and applies the same schema.
 */
export function useTripRouteSearch(): TripRouteSearch {
    const search = useSearch({ strict: false });
    return useMemo(() => parseTripRouteSearch(search), [search]);
}
