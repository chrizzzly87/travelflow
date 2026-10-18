import React from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '../../hooks/useAuth';
import { useHydrated } from '../../hooks/useHydrated';
import { MarketingRouteLoadingShell } from '../../components/bootstrap/MarketingRouteLoadingShell';

/** Public HTML stays deterministic; a verified browser session resumes its account home. */
export function AuthenticatedHomeRoute({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const hydrated = useHydrated();
    if (hydrated && auth.isAuthenticated) {
        return auth.isLoading ? <MarketingRouteLoadingShell /> : <Navigate to="/profile" replace />;
    }
    return children;
}
