import { readPersistedTripViewSettings } from '../../services/tripViewSettingsService';

export type TripRouteLoadingShellVariant =
    | 'loadingTrip'
    | 'preparingPlanner'
    | 'loadingSharedTrip'
    | 'preparingSharedPlanner'
    | 'loadingExampleTrip'
    | 'preparingExamplePlanner';

export const DEFAULT_PLANNER_SHELL_LAYOUT = {
    plannerLayout: 'horizontal' as const,
    sidebarWidth: undefined as number | undefined,
    timelineHeight: undefined as number | undefined,
};

/**
 * The planner opens in whichever orientation and pane size the traveller last
 * used, so the placeholder reads those back rather than guessing: a returning
 * traveller sees their own layout, and the handoff to the real planner does not
 * jump. A first visit falls back to the planner's own defaults.
 */
export const readPlannerShellLayout = () => {
    const persisted = readPersistedTripViewSettings();
    return {
        plannerLayout: persisted?.layoutMode === 'vertical' ? ('vertical' as const) : ('horizontal' as const),
        sidebarWidth: typeof persisted?.sidebarWidth === 'number' ? persisted.sidebarWidth : undefined,
        timelineHeight: typeof persisted?.timelineHeight === 'number' ? persisted.timelineHeight : undefined,
    };
};

export const tripShellVariantForPath = (pathname: string): TripRouteLoadingShellVariant =>
    pathname.startsWith('/s/') ? 'loadingSharedTrip' : pathname.startsWith('/example/') ? 'loadingExampleTrip' : 'loadingTrip';
