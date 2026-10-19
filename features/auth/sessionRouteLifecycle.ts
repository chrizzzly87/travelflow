import type { AnyRouter, AnyRoute } from '@tanstack/react-router';
import type { UserAccessContext } from '../../types';

type RouteSession = {
    session: { user: { id: string } } | null;
    access: Pick<UserAccessContext, 'userId' | 'role' | 'accountStatus' | 'isAnonymous'> | null;
};

/** Loading/token refresh alone does not change route authorization. */
export function getRouteSessionIdentity({ session, access }: RouteSession): string {
    return JSON.stringify([session?.user.id, access?.userId, access?.role, access?.accountStatus, access?.isAnonymous]);
}

declare module '@tanstack/react-router' {
    interface StaticDataRouteOption { sessionBound?: boolean }
}

function isSessionBoundMatch(router: AnyRouter, match: { routeId: string }): boolean {
    let route: AnyRoute | undefined = router.routesById[match.routeId];
    while (route) {
        if (route.options.staticData?.sessionBound) return true;
        route = route.parentRoute;
    }
    return false;
}

/** Retire sensitive preloads even on public pages, without reloading those pages. */
export function refreshSessionRoutes(router: AnyRouter): Promise<void> | undefined {
    const activeOrTarget = [...router.state.matches, ...router.matchRoutes(router.latestLocation)];
    const filter = (match: { routeId: string }) => isSessionBoundMatch(router, match);
    router.clearCache({ filter });
    // invalidate always calls load, even with an empty filter. Avoid it entirely
    // for public-only navigation; native context updates already refresh the UI.
    if (activeOrTarget.some(filter)) {
        return router.invalidate({ filter });
    }
}
