import React from 'react';
import { AppBootstrapShell } from '../bootstrap/AppBootstrapShell';
import { readPersistedTripViewSettings } from '../../services/tripViewSettingsService';

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
    // A plain read, not a hook: this component is mounted as a Suspense
    // fallback, and reading two localStorage keys per render is cheaper than
    // holding state for a tree that exists for a few hundred milliseconds.
    const { plannerLayout, sidebarWidth, timelineHeight } = readPlannerShellLayout();

    return (
        <AppBootstrapShell
            variant="trip"
            testId="trip-route-loading-shell"
            shellState={variant}
            plannerLayout={plannerLayout}
            sidebarWidth={sidebarWidth}
            timelineHeight={timelineHeight}
        />
    );
};
