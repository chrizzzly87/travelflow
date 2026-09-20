import React from 'react';
import { useParams } from 'react-router-dom';

import { AppBootstrapShell } from '../bootstrap/AppBootstrapShell';
import { readPersistedTripViewSettings } from '../../services/tripViewSettingsService';
import { readTripRouteShellPreviewDays } from '../../services/tripRouteShellPreview';

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

/**
 * The planner opens in whichever orientation and pane size the traveller last
 * used, so the placeholder reads those back rather than guessing: a returning
 * traveller sees their own layout, and the handoff to the real planner does not
 * jump. A first visit falls back to the planner's own defaults.
 */
const readPlannerShellLayout = () => {
    const persisted = readPersistedTripViewSettings();
    return {
        plannerLayout: persisted?.layoutMode === 'vertical' ? ('vertical' as const) : ('horizontal' as const),
        sidebarWidth: typeof persisted?.sidebarWidth === 'number' ? persisted.sidebarWidth : undefined,
        timelineHeight: typeof persisted?.timelineHeight === 'number' ? persisted.timelineHeight : undefined,
    };
};

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
