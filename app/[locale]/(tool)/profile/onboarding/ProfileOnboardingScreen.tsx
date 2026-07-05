'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthenticatedRoute } from '../../../../../appCore/routes/guards';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const ProfileOnboardingPage = dynamic(
    () => import('../../../../../views/ProfileOnboardingPage').then((m) => m.ProfileOnboardingPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const ProfileOnboardingScreen: React.FC = () => (
    <AuthenticatedRoute>
        <ProfileOnboardingPage />
    </AuthenticatedRoute>
);
