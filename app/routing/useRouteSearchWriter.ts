import { useCallback } from 'react';
import { useMatch, useRouter } from '@tanstack/react-router';
import { stringifyRouteSearch } from './search';

export type RouteSearch = Record<string, unknown>;
export type RouteSearchUpdate = (previous: RouteSearch) => RouteSearch;
/** Returns false when nothing was written because the page is being left. */
export type RouteSearchWriter = (update: RouteSearchUpdate) => boolean;

/**
 * Replace the query of the page that renders the caller, through the router.
 *
 * - The router sees every write, so `useLocation`, `useSearch` and links built
 *   from them stay current (a raw `history.replaceState` left them stale).
 * - Path, hash, history state and scroll position are kept.
 * - A write that changes nothing is skipped: re-committing the same URL makes
 *   the router reload stale loaders.
 * - Once the latest location resolves to another match than the caller's (a
 *   navigation away, a different trip or version), nothing is written, so a
 *   page being left never puts its query onto the next one (#586).
 *
 * `update` receives the current query as parsed by the flat codec, including
 * parameters the caller does not own; return `undefined` for a key to remove it.
 */
export function useRouteSearchWriter(): RouteSearchWriter {
    const router = useRouter();
    const matchId = useMatch({ strict: false, select: match => match.id });
    return useCallback((update: RouteSearchUpdate) => {
        const latest = router.latestLocation;
        if (!router.matchRoutes(latest).some(match => match.id === matchId)) return false;
        const next = update({ ...latest.search });
        if (stringifyRouteSearch(next) === latest.searchStr) return true;
        void router.navigate({ to: '.', search: next, hash: true, state: true, replace: true, resetScroll: false });
        return true;
    }, [router, matchId]);
}
