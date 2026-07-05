'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthenticatedRoute } from '../../../../appCore/routes/guards';
import { MarketingRouteLoadingShell } from '../../../../components/bootstrap/MarketingRouteLoadingShell';

const ProfilePage = dynamic(
    () => import('../../../../views/ProfilePage').then((m) => m.ProfilePage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const ProfileScreen: React.FC = () => (
    <AuthenticatedRoute>
        <ProfilePage />
    </AuthenticatedRoute>
);
