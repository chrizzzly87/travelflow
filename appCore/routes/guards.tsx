'use client';

// Client-side route guards, extracted from the react-router DeferredAppRoutes
// tree for reuse by the App Router pages. Auth is client state (Supabase), so
// these remain client redirects — unchanged behavior.

import React from 'react';
import { Navigate, useLocation } from '@/lib/router';
import { useAuth } from '../../hooks/useAuth';
import { suspendUntilAuthBootstrapSettles } from '../../services/authBootstrapSuspense';
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';

export const AuthenticatedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    suspendUntilAuthBootstrapSettles(isLoading);
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return children;
};

export const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAdmin, isAuthenticated } = useAuth();
    const location = useLocation();

    suspendUntilAuthBootstrapSettles(isLoading);
    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }
    if (!isAdmin) {
        return (
            <Navigate
                to="/admin/access-denied"
                replace
                state={{ from: `${location.pathname}${location.search}` }}
            />
        );
    }

    return children;
};

/**
 * Homepage auth gate that never suspends first paint: anonymous visitors get
 * the marketing homepage immediately; signed-in visitors are redirected to
 * /profile once the session hint settles.
 */
export const AuthenticatedMarketingHomeRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();

    if (isAuthenticated) {
        if (isLoading) {
            return <MarketingRouteLoadingShell />;
        }
        return <Navigate to="/profile" replace />;
    }
    return children;
};
