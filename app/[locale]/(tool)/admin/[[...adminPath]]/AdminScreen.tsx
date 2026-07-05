'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AdminRoute } from '../../../../../appCore/routes/guards';
import { RouteBase } from '../../../../../lib/router';
import { MarketingRouteLoadingShell } from '../../../../../components/bootstrap/MarketingRouteLoadingShell';

const AdminWorkspaceRouter = dynamic(
    () => import('../../../../../views/AdminWorkspaceRouter').then((m) => m.AdminWorkspaceRouter),
    { ssr: false, loading: () => <MarketingRouteLoadingShell /> }
);

export const AdminScreen: React.FC = () => (
    <AdminRoute>
        <RouteBase base="/admin">
            <AdminWorkspaceRouter />
        </RouteBase>
    </AdminRoute>
);
