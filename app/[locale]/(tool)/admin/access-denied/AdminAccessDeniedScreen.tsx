'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AuthenticatedRoute } from '../../../../../appCore/routes/guards';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const AdminAccessDeniedPage = dynamic(
    () => import('../../../../../views/AdminAccessDeniedPage').then((m) => m.AdminAccessDeniedPage),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const AdminAccessDeniedScreen: React.FC = () => (
    <AuthenticatedRoute>
        <AdminAccessDeniedPage />
    </AuthenticatedRoute>
);
