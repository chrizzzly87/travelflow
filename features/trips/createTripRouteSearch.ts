import { useMemo } from 'react';
import { useSearch } from '@tanstack/react-router';
import { defineSearchSchema, searchText } from '../../app/routing/searchSchema';

/**
 * Query parameters of the create-trip area. `prefill` carries the encoded
 * planner draft (`encodeTripPrefill`); it is decoded by the page, so a
 * malformed value is simply ignored there. Unknown parameters are kept.
 */
export const createTripRouteSearchSchema = defineSearchSchema({
    prefill: searchText(),
});
export type CreateTripRouteSearch = ReturnType<typeof createTripRouteSearchSchema>;

export const parseCreateTripRouteSearch = (search: unknown): CreateTripRouteSearch => createTripRouteSearchSchema(search);

/** The validated query of the create page that renders the caller (#586-safe). */
export function useCreateTripRouteSearch(): CreateTripRouteSearch {
    const search = useSearch({ strict: false });
    return useMemo(() => parseCreateTripRouteSearch(search), [search]);
}
