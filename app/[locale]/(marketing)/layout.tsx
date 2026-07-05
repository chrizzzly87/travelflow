import React, { Suspense } from 'react';
import { MarketingRouteLoadingShell } from '../../../components/bootstrap/MarketingRouteLoadingShell';

// Marketing/blog/legal group: pages are server-rendered with their locale's
// translations (each page.tsx nests an I18nProvider with its namespaces).
export default function MarketingGroupLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<MarketingRouteLoadingShell />}>
            {children}
        </Suspense>
    );
}
