'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthenticatedRoute } from '../../../../../appCore/routes/guards';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const ProfileSettingsPage = dynamic(
    () => import('../../../../../views/ProfileSettingsPage').then((m) => m.ProfileSettingsPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const ProfileSettingsScreen: React.FC = () => (
    <AuthenticatedRoute>
        <ProfileSettingsPage />
    </AuthenticatedRoute>
);
