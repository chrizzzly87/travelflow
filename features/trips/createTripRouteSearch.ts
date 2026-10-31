import { useMemo } from 'react';
import { useSearch } from '@tanstack/react-router';
import * as z from 'zod/mini';
import { parseSearchWith, searchText } from '../../app/routing/searchSchema';

/**
 * Query parameters of the create-trip area. `prefill` carries the encoded
 * planner draft (`encodeTripPrefill`); it is decoded by the page, so a
 * malformed value is simply ignored there. Unknown parameters are kept.
 */
export const createTripRouteSearchSchema = z.looseObject({
    prefill: searchText(),
});
export type CreateTripRouteSearch = z.infer<typeof createTripRouteSearchSchema>;

export const parseCreateTripRouteSearch = (search: unknown): CreateTripRouteSearch => parseSearchWith(createTripRouteSearchSchema, search);

/** The validated query of the create page that renders the caller (#586-safe). */
export function useCreateTripRouteSearch(): CreateTripRouteSearch {
    const search = useSearch({ strict: false });
    return useMemo(() => parseCreateTripRouteSearch(search), [search]);
}
