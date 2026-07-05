'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAppShell } from '../../../../../appCore/AppShellContext';
import { useDbSync } from '../../../../../hooks/useDbSync';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const CreateTripV3Page = dynamic(
    () => import('../../../../../views/CreateTripV3Page').then((m) => m.CreateTripV3Page),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const CreateTripWizardScreen: React.FC = () => {
    const shell = useAppShell();
    useDbSync(shell.onAppLanguageLoaded);

    return (
        <CreateTripV3Page
            onTripGenerated={shell.onTripGenerated}
            onOpenManager={shell.onOpenManager}
        />
    );
};
