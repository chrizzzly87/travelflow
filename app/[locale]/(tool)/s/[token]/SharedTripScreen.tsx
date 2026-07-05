'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAppShell } from '../../../../../appCore/AppShellContext';
import { TripRouteLoadingShell } from '../../../../../components/tripview/TripRouteLoadingShell';

const SharedTripLoaderRoute = dynamic(
    () => import('../../../../../routes/SharedTripLoaderRoute').then((m) => m.SharedTripLoaderRoute),
    { ssr: false, loading: () => <TripRouteLoadingShell variant="loadingSharedTrip" /> }
);

export const SharedTripScreen: React.FC = () => {
    const shell = useAppShell();

    return (
        <SharedTripLoaderRoute
            trip={shell.trip}
            onTripLoaded={shell.onTripLoaded}
            onOpenManager={shell.onOpenManager}
            onOpenSettings={shell.onOpenSettings}
            appLanguage={shell.appLanguage}
            onViewSettingsChange={shell.onViewSettingsChange}
            onLanguageLoaded={shell.onAppLanguageLoaded}
        />
    );
};
