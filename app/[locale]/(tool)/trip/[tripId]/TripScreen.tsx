'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAppShell } from '../../../../../appCore/AppShellContext';
import { TripRouteLoadingShell } from '../../../../../components/tripview/TripRouteLoadingShell';

const TripLoaderRoute = dynamic(
    () => import('../../../../../routes/TripLoaderRoute').then((m) => m.TripLoaderRoute),
    { ssr: false, loading: () => <TripRouteLoadingShell variant="loadingTrip" /> }
);

export const TripScreen: React.FC = () => {
    const shell = useAppShell();

    return (
        <TripLoaderRoute
            trip={shell.trip}
            onTripLoaded={shell.onTripLoaded}
            onUpdateTrip={shell.onUpdateTrip}
            onCommitState={shell.onCommitState}
            onOpenManager={shell.onOpenManager}
            onOpenSettings={shell.onOpenSettings}
            appLanguage={shell.appLanguage}
            onViewSettingsChange={shell.onViewSettingsChange}
            onLanguageLoaded={shell.onAppLanguageLoaded}
        />
    );
};
