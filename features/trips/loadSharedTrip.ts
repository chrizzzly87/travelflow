import { redirect } from '@tanstack/react-router';
import { DB_ENABLED } from '../../config/db';
import { getTripLifecycleState } from '../../config/paywall';
import { dbGetSharedTrip, dbGetSharedTripVersion, dbGetTripVersion } from '../../services/dbApi';
import { findHistoryEntryByUrl } from '../../services/historyService';
import { getConnectivitySnapshot } from '../../services/supabaseHealthMonitor';
import { buildShareUrl, isUuid } from '../../utils';
import { normalizeTripForRuntimeLoad } from './tripSessionModel';
import type { SharedTripRouteData } from './routeData';

/** The shared route always resolves current token access before showing a snapshot. */
export async function loadSharedTrip(input: { token: string; versionId?: string; signal: AbortSignal }): Promise<SharedTripRouteData> {
    const { token, versionId, signal } = input;
    signal.throwIfAborted();
    const connectivity = getConnectivitySnapshot().state;
    if (!DB_ENABLED || connectivity === 'offline') {
        throw redirect({ href: connectivity === 'offline' ? '/share-unavailable?reason=offline' : '/share-unavailable', replace: true });
    }
    const shared = await dbGetSharedTrip(token);
    signal.throwIfAborted();
    if (!shared || getTripLifecycleState(shared.trip) !== 'active') {
        throw redirect({ href: connectivity !== 'online' ? '/share-unavailable?reason=offline' : '/share-unavailable', replace: true });
    }
    const base: SharedTripRouteData = {
        trip: normalizeTripForRuntimeLoad(shared.trip), view: shared.shareView ?? shared.view ?? shared.trip.defaultView,
        access: null, shareMode: shared.mode, allowCopy: shared.allowCopy ?? true,
        snapshotState: null, sourceShareVersionId: shared.latestVersionId ?? null,
    };
    if (!versionId) return base;
    if (isUuid(versionId)) {
        const snapshot = await dbGetSharedTripVersion(token, versionId);
        signal.throwIfAborted();
        if (snapshot?.trip) return {
            ...base, trip: normalizeTripForRuntimeLoad(snapshot.trip),
            view: snapshot.view ?? snapshot.shareView ?? shared.shareView ?? snapshot.trip.defaultView,
            sourceShareVersionId: snapshot.versionId,
            snapshotState: { hasNewer: Boolean((snapshot.latestVersionId ?? shared.latestVersionId) && (snapshot.latestVersionId ?? shared.latestVersionId) !== snapshot.versionId), latestUrl: buildShareUrl(token) },
        };
        // Legacy owner-visible versions remain readable only through backend RLS.
        const version = await dbGetTripVersion(shared.trip.id, versionId);
        signal.throwIfAborted();
        if (version?.trip) return {
            ...base, trip: normalizeTripForRuntimeLoad(version.trip), view: version.view ?? shared.shareView ?? version.trip.defaultView,
            sourceShareVersionId: versionId,
            snapshotState: { hasNewer: Boolean((shared.latestVersionId && shared.latestVersionId !== versionId) || (shared.trip.updatedAt ?? 0) > (version.trip.updatedAt ?? 0)), latestUrl: buildShareUrl(token) },
        };
    }
    const local = findHistoryEntryByUrl(shared.trip.id, buildShareUrl(token, versionId));
    if (local?.snapshot?.trip) return {
        ...base, trip: normalizeTripForRuntimeLoad(local.snapshot.trip), view: local.snapshot.view ?? local.snapshot.trip.defaultView,
        sourceShareVersionId: isUuid(versionId) ? versionId : null,
        snapshotState: { hasNewer: true, latestUrl: buildShareUrl(token) },
    };
    return base;
}
