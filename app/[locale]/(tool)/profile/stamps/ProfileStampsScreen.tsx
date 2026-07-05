'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthenticatedRoute } from '../../../../../appCore/routes/guards';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const ProfileStampsPage = dynamic(
    () => import('../../../../../views/ProfileStampsPage').then((m) => m.ProfileStampsPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const ProfileStampsScreen: React.FC = () => (
    <AuthenticatedRoute>
        <ProfileStampsPage />
    </AuthenticatedRoute>
);
