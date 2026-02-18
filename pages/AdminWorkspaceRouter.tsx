import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { loadLazyComponentWithRecovery } from '../services/lazyImportRecovery';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const AdminDashboardPage = lazyWithRecovery('AdminDashboardPage', () => import('./AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminAiBenchmarkPage = lazyWithRecovery('AdminAiBenchmarkPage', () => import('./AdminAiBenchmarkPage').then((module) => ({ default: module.AdminAiBenchmarkPage })));
const AdminUsersPage = lazyWithRecovery('AdminUsersPage', () => import('./AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminTripsPage = lazyWithRecovery('AdminTripsPage', () => import('./AdminTripsPage').then((module) => ({ default: module.AdminTripsPage })));
const AdminTiersPage = lazyWithRecovery('AdminTiersPage', () => import('./AdminTiersPage').then((module) => ({ default: module.AdminTiersPage })));
const AdminAuditPage = lazyWithRecovery('AdminAuditPage', () => import('./AdminAuditPage').then((module) => ({ default: module.AdminAuditPage })));

const RouteLoadingFallback: React.FC = () => (
    <div className="min-h-[42vh] w-full bg-slate-50" aria-hidden="true" />
);

export const AdminWorkspaceRouter: React.FC = () => (
    <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="trips" element={<AdminTripsPage />} />
            <Route path="tiers" element={<AdminTiersPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="ai-benchmark" element={<AdminAiBenchmarkPage />} />
            <Route path="access" element={<Navigate to="/admin/users" replace />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
    </Suspense>
);
