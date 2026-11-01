import { notFound } from '@tanstack/react-router';
import { fetchTripDraft } from '../../services/tripDraftService';
import { normalizeTripForRuntimeLoad } from './tripSessionModel';
import type { TripDraftRouteData } from './routeData';

/** Drafts are public by link, so the loader needs no session; saving does. */
export async function loadTripDraft(draftId: string, signal: AbortSignal, options: { preload?: boolean } = {}): Promise<TripDraftRouteData> {
    const draft = await fetchTripDraft(draftId, signal, { countView: !options.preload });
    signal.throwIfAborted();
    if (!draft) throw notFound();
    const trip = normalizeTripForRuntimeLoad({ ...draft.trip, id: draft.draftId, isFavorite: false });
    const view = {
        ...trip.defaultView,
        layoutMode: trip.defaultView?.layoutMode ?? 'horizontal' as const,
        timelineView: trip.defaultView?.timelineView ?? 'horizontal' as const,
        mapStyle: trip.defaultView?.mapStyle ?? 'standard' as const,
        zoomLevel: trip.defaultView?.zoomLevel ?? 1,
    };
    return {
        draftId: draft.draftId,
        status: draft.status,
        clientName: draft.clientName,
        expiresAt: draft.expiresAt,
        access: null,
        view,
        trip: { ...trip, defaultView: view },
    };
}
