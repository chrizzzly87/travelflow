'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAppShell } from '../../../../../appCore/AppShellContext';
import { TripRouteLoadingShell } from '../../../../../components/tripview/TripRouteLoadingShell';

const ExampleTripLoaderRoute = dynamic(
    () => import('../../../../../routes/ExampleTripLoaderRoute').then((m) => m.ExampleTripLoaderRoute),
    { ssr: false, loading: () => <TripRouteLoadingShell variant="loadingExampleTrip" /> }
);

export const ExampleScreen: React.FC = () => {
    const shell = useAppShell();

    return (
        <ExampleTripLoaderRoute
            trip={shell.trip}
            onTripLoaded={shell.onTripLoaded}
            onOpenManager={shell.onOpenManager}
            onOpenSettings={shell.onOpenSettings}
            appLanguage={shell.appLanguage}
            onViewSettingsChange={shell.onViewSettingsChange}
        />
    );
};
