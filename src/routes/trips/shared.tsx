import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { SharedTripLoaderRoute } from '../../../routes/SharedTripLoaderRoute';
import { useTripSession } from '../../../features/trips/TripWorkspaceLayout';
import { loadSharedTrip } from '../../../features/trips/loadSharedTrip';
import { tripLoaderDeps } from '../../../features/trips/routeData';
import { TripRouteLoadingShell } from '../../../components/tripview/TripRouteLoadingShell';
import { ShareUnavailablePage } from '../../../pages/ShareUnavailablePage';
export const Route = createFileRoute('/_trips/s/$token')({
    staticData: { sessionBound: true },
    loaderDeps: tripLoaderDeps,
    loader: ({ params, deps, location, abortController }) => loadSharedTrip({ token: params.token, versionId: deps.versionId, signal: abortController.signal }),
    staleTime: 0, preloadStaleTime: 0, gcTime: 0,
    pendingComponent: TripRouteLoadingShell,
    errorComponent: ShareUnavailablePage,
    head: ({ loaderData }) => loaderData ? { meta: [{ title: `${loaderData.trip.title} · TravelFlow` }] } : {},
    component: TripPage,
});
function TripPage() { return <SharedTripLoaderRoute {...useTripSession()} data={Route.useLoaderData()} />; }
