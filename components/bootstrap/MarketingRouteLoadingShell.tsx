import React from 'react';

import { SiteHeader } from '../navigation/SiteHeader';

export const MarketingRouteLoadingShell: React.FC = () => (
    <div
        className="min-h-screen bg-slate-50 text-slate-900"
        data-testid="route-loading-shell"
        data-shell-variant="marketing"
    >
        <SiteHeader />
    </div>
);
