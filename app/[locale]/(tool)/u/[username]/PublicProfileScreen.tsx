'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const PublicProfilePage = dynamic(
    () => import('../../../../../views/PublicProfilePage').then((m) => m.PublicProfilePage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const PublicProfileScreen: React.FC = () => <PublicProfilePage />;
