'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { MarketingRouteLoadingShell } from '../../../../../../components/bootstrap/MarketingRouteLoadingShell';

const PublicProfileStampsPage = dynamic(
    () => import('../../../../../../views/PublicProfileStampsPage').then((m) => m.PublicProfileStampsPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const PublicProfileStampsScreen: React.FC = () => <PublicProfileStampsPage />;
