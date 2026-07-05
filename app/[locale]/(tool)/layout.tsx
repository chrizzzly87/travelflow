import React, { Suspense } from 'react';
import { MarketingRouteLoadingShell } from '../../../components/bootstrap/MarketingRouteLoadingShell';

// Tool group (create-trip, trip view, profile, checkout, admin): fully
// interactive client pages, mounted client-side only — matching the SPA's
// behavior for these routes. The Suspense boundary catches the auth-bootstrap
// suspension from route guards.
export default function ToolGroupLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<MarketingRouteLoadingShell />}>
            {children}
        </Suspense>
    );
}
