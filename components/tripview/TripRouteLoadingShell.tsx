import React from 'react';
import { AppBootstrapShell } from '../bootstrap/AppBootstrapShell';

type TripRouteLoadingShellVariant =
    | 'loadingTrip'
    | 'preparingPlanner'
    | 'loadingSharedTrip'
    | 'preparingSharedPlanner'
    | 'loadingExampleTrip'
    | 'preparingExamplePlanner';

interface TripRouteLoadingShellProps {
    variant?: TripRouteLoadingShellVariant;
}

export const TripRouteLoadingShell: React.FC<TripRouteLoadingShellProps> = ({
    variant = 'loadingTrip',
}) => (
    <AppBootstrapShell
        variant="trip"
        testId="trip-route-loading-shell"
        shellState={variant}
    />
);
