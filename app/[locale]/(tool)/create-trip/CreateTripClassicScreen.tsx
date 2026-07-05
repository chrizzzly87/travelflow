'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAppShell } from '../../../../appCore/AppShellContext';
import { useDbSync } from '../../../../hooks/useDbSync';
import { MarketingRouteLoadingShell } from '../../../../components/bootstrap/MarketingRouteLoadingShell';

const CreateTripClassicLabPage = dynamic(
    () => import('../../../../views/CreateTripClassicLabPage').then((m) => m.CreateTripClassicLabPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const CreateTripClassicScreen: React.FC = () => {
    const shell = useAppShell();
    useDbSync(shell.onAppLanguageLoaded);

    return (
        <CreateTripClassicLabPage
            onTripGenerated={shell.onTripGenerated}
            onOpenManager={shell.onOpenManager}
            onLanguageLoaded={shell.onAppLanguageLoaded}
        />
    );
};
