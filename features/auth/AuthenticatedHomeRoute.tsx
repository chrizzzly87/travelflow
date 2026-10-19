import React from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '../../hooks/useAuth';
import { useHydrated } from '../../hooks/useHydrated';

/** Public HTML stays deterministic; a verified browser session resumes its account home. */
export function AuthenticatedHomeRoute({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const hydrated = useHydrated();
    // Navigate owns the verified redirect, but renders no content itself. Keep
    // the public presentation mounted until the native account route commits.
    return <>{hydrated && auth.isAuthenticated && !auth.isLoading && <Navigate to="/profile" replace />}{children}</>;
}
