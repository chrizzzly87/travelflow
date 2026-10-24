import React from 'react';
import { useParams } from '@/app/navigation';

import { AppBootstrapShell } from '../bootstrap/AppBootstrapShell';
import { readTripRouteShellPreviewDays } from '../../services/tripRouteShellPreview';
import { readPlannerShellLayout, type TripRouteLoadingShellVariant } from './tripShellLayout';

interface TripRouteLoadingShellProps {
    variant?: TripRouteLoadingShellVariant;
}

export const TripRouteLoadingShell: React.FC<TripRouteLoadingShellProps> = ({
    variant = 'loadingTrip',
}) => {
    // Plain reads, not hooks: this component is mounted as a Suspense fallback,
    // and both answers are memoised, so holding state for a tree that exists
    // for a few hundred milliseconds would cost more than it saves.
    const { plannerLayout, sidebarWidth, timelineHeight } = readPlannerShellLayout();
    const { tripId } = useParams<{ tripId?: string }>();
    // A trip this device has opened before is already in local storage, so the
    // day strip can carry its real dates instead of grey circles that are then
    // swapped for differently-shaped ones.
    const previewDays = readTripRouteShellPreviewDays(tripId);

    return (
        <AppBootstrapShell
            variant="trip"
            testId="trip-route-loading-shell"
            shellState={variant}
            plannerLayout={plannerLayout}
            sidebarWidth={sidebarWidth}
            timelineHeight={timelineHeight}
            previewDays={previewDays}
        />
    );
};
