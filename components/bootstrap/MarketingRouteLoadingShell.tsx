import React from 'react';

import { AppBootstrapShell } from './AppBootstrapShell';
import { hasCompletedInitialRouteHandoff } from '../../services/marketingRouteShellState';

export const MarketingRouteLoadingShell: React.FC = () => {
    const isInitialHandoff = !hasCompletedInitialRouteHandoff();

    return (
        <AppBootstrapShell
            variant="marketing"
            testId="route-loading-shell"
            chromeMode={isInitialHandoff ? 'skeleton' : 'ghost'}
            surfaceMode={isInitialHandoff ? 'default' : 'neutral'}
        />
    );
};
