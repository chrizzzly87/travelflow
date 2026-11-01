import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { TripDraftLoaderRoute } from '../../../routes/TripDraftLoaderRoute';
import { useTripSession } from '../../../features/trips/TripWorkspaceLayout';
import { loadTripDraft } from '../../../features/trips/loadTripDraft';
import { TripRouteLoadingShell } from '../../../components/tripview/TripRouteLoadingShell';
import { ShareUnavailablePage } from '../../../pages/ShareUnavailablePage';
export const Route = createFileRoute('/_trips/draft/$draftId')({
    // Every open counts as a view; a hover preload does not.
    loader: ({ params, abortController, preload }) => loadTripDraft(params.draftId, abortController.signal, { preload }),
    staleTime: 30_000, preloadStaleTime: 30_000, gcTime: 30_000,
    pendingComponent: TripRouteLoadingShell,
    errorComponent: ShareUnavailablePage,
    notFoundComponent: ShareUnavailablePage,
    head: ({ loaderData }) => loaderData ? { meta: [{ title: `${loaderData.trip.title} · TravelFlow` }, { name: 'robots', content: 'noindex, nofollow' }] } : {},
    component: TripPage,
});
function TripPage() { return <TripDraftLoaderRoute {...useTripSession()} data={Route.useLoaderData()} />; }
