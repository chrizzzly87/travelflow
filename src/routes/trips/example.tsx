import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ExampleTripLoaderRoute } from '../../../routes/ExampleTripLoaderRoute';
import { useTripSession } from '../../../features/trips/TripWorkspaceLayout';
import { loadExampleTrip } from '../../../features/trips/loadExampleTrip';
import { tripLoaderDeps } from '../../../features/trips/routeData';
import { TripRouteLoadingShell } from '../../../components/tripview/TripRouteLoadingShell';
import { ShareUnavailablePage } from '../../../pages/ShareUnavailablePage';
export const Route = createFileRoute('/_trips/example/$templateId')({
    loaderDeps: tripLoaderDeps,
    loader: ({ params, deps, location, abortController }) => loadExampleTrip(params.templateId, abortController.signal),
    staleTime: 30_000, preloadStaleTime: 30_000, gcTime: 30_000,
    pendingComponent: TripRouteLoadingShell,
    errorComponent: ShareUnavailablePage,
    head: ({ loaderData }) => loaderData ? { meta: [{ title: `${loaderData.trip.title} · TravelFlow` }] } : {},
    component: TripPage,
});
function TripPage() { return <ExampleTripLoaderRoute {...useTripSession()} data={Route.useLoaderData()} />; }
