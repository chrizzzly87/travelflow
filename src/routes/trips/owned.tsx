import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { TripLoaderRoute } from '../../../routes/TripLoaderRoute';
import { useTripSession } from '../../../features/trips/TripWorkspaceLayout';
import { loadOwnedTrip } from '../../../features/trips/loadOwnedTrip';
import { tripLoaderDeps } from '../../../features/trips/routeData';
import { TripRouteLoadingShell } from '../../../components/tripview/TripRouteLoadingShell';
import { ShareUnavailablePage } from '../../../pages/ShareUnavailablePage';
export const Route = createFileRoute('/_trips/trip/$tripId')({
    loaderDeps: tripLoaderDeps,
    loader: ({ params, deps, location, abortController }) => loadOwnedTrip({ tripId: params.tripId, versionId: deps.versionId, href: location.href, signal: abortController.signal }),
    staleTime: 0, preloadStaleTime: 0, gcTime: 0,
    pendingComponent: TripRouteLoadingShell,
    errorComponent: ShareUnavailablePage,
    head: ({ loaderData }) => loaderData ? { meta: [{ title: `${loaderData.trip.title} · TravelFlow` }] } : {},
    component: TripPage,
});
function TripPage() { return <TripLoaderRoute {...useTripSession()} data={Route.useLoaderData()} />; }
