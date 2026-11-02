import { redirect } from '@tanstack/react-router';
import { DB_ENABLED } from '../../config/db';
import { dbGetTrip, dbGetTripVersion } from '../../services/dbApi';
import { getTripById } from '../../services/storageService';
import { findHistoryEntryByUrl } from '../../services/historyService';
import { hasQueuedTripCommit } from '../../services/offlineChangeQueue';
import { getConnectivitySnapshot } from '../../services/supabaseHealthMonitor';
import { buildLoginPathWithNext } from '../../services/authNavigationService';
import { buildTripUrl, decompressTrip, isUuid } from '../../utils';
import { normalizeTripForRuntimeLoad } from './tripSessionModel';
import type { TripRouteData } from './routeData';
import type { ITrip, IViewSettings } from '../../types';

const result = (trip: ITrip, view?: IViewSettings, access: TripRouteData['access'] = null): TripRouteData => {
    const normalized = normalizeTripForRuntimeLoad(trip);
    return { trip: normalized, view: view ?? normalized.defaultView, access };
};

async function resolveSharedPath(tripId: string, versionId: string | undefined, signal: AbortSignal) {
    const query = new URLSearchParams({ trip: tripId });
    if (versionId) query.set('v', versionId);
    try {
        const response = await fetch(`/api/trip-share-resolve?${query}`, { headers: { Accept: 'application/json' }, signal });
        if (!response.ok) return null;
        const payload = await response.json() as { path?: unknown };
        signal.throwIfAborted();
        if (typeof payload.path !== 'string' || !payload.path.startsWith('/s/')) return null;
        const url = new URL(payload.path, 'https://travelflow.invalid');
        return url.origin === 'https://travelflow.invalid' ? `${url.pathname}${url.search}${url.hash}` : null;
    } catch (error) {
        signal.throwIfAborted();
        return null;
    }
}

/** Browser-only route resolver. Reads never persist historical snapshots over the current trip. */
export async function loadOwnedTrip(input: { tripId: string; versionId?: string; href: string; signal: AbortSignal }): Promise<TripRouteData> {
    const { tripId, versionId, href, signal } = input;
    signal.throwIfAborted();
    const connectivity = getConnectivitySnapshot().state;
    const compressed = decompressTrip(tripId);
    if (compressed) {
        const favorite = getTripById(compressed.trip.id)?.isFavorite;
        return result({ ...compressed.trip, isFavorite: favorite ?? compressed.trip.isFavorite ?? false }, compressed.view);
    }
    const local = getTripById(tripId);
    const history = versionId ? findHistoryEntryByUrl(tripId, buildTripUrl(tripId, versionId)) : null;
    const localVersion = versionId && !isUuid(versionId) ? history?.snapshot?.trip : null;
    const historyView = history?.snapshot?.view;
    if (connectivity === 'offline' || !DB_ENABLED) {
        if (localVersion) return result(localVersion, historyView);
        if (local) return result(local, historyView ?? local.defaultView);
        throw redirect({ href: DB_ENABLED ? '/share-unavailable?reason=offline' : '/create-trip', replace: true });
    }

    // Resolve access with the current trip even when the target is a historical
    // version. Public/admin reads must never temporarily acquire owner controls.
    let remote: Awaited<ReturnType<typeof dbGetTrip>> = null;
    let version: Awaited<ReturnType<typeof dbGetTripVersion>> = null;
    try {
        [remote, version] = await Promise.all([
            dbGetTrip(tripId),
            versionId && isUuid(versionId) ? dbGetTripVersion(tripId, versionId) : Promise.resolve(null),
        ]);
    } catch {
        signal.throwIfAborted();
        if (localVersion) return result(localVersion, historyView);
        if (local) return result(local, historyView ?? local.defaultView);
        throw redirect({ href: '/share-unavailable?reason=offline', replace: true });
    }
    signal.throwIfAborted();
    if (localVersion) return result(localVersion, historyView, remote?.access);
    if (version?.trip) {
        // No proven ownership means read-only; backend permissions still authorize
        // every write independently.
        const access = remote?.access ?? { source: 'public_read' } as TripRouteData['access'];
        return result(version.trip, version.view ?? undefined, access);
    }
    if (remote?.trip) {
        // Read access is not authority to restore a cached editable copy. Queued
        // owner edits win over stale cloud data only for a confirmed owner.
        const localWins = local && remote.access.source === 'owner'
            && (hasQueuedTripCommit(tripId) || (local.updatedAt ?? 0) > (remote.trip.updatedAt ?? 0));
        return localWins
            ? result(local, historyView ?? local.defaultView, remote.access)
            : result(remote.trip, historyView ?? remote.view ?? undefined, remote.access);
    }
    if (local) return result(local, historyView ?? local.defaultView);
    if (connectivity !== 'online') throw redirect({ href: '/share-unavailable?reason=offline', replace: true });
    const sharedPath = await resolveSharedPath(tripId, versionId, signal);
    signal.throwIfAborted();
    if (sharedPath) throw redirect({ href: sharedPath, replace: true });
    const access = await (await import('../../services/authService')).getCurrentAccessContext();
    signal.throwIfAborted();
    if (!access?.userId || access.isAnonymous) {
        const target = new URL(href, 'https://travelflow.invalid');
        const { loginTarget } = buildLoginPathWithNext({ pathname: target.pathname, search: target.search, hash: target.hash });
        throw redirect({ href: loginTarget, replace: true });
    }
    throw redirect({ href: '/share-unavailable', replace: true });
}
