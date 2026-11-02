import React from 'react';
import { useHydrated, useRouterState } from '@tanstack/react-router';
import { AppBootstrapShell } from '../bootstrap/AppBootstrapShell';
import { DEFAULT_PLANNER_SHELL_LAYOUT, readPlannerShellLayout, tripShellVariantForPath } from './tripShellLayout';

/**
 * Fallback for the whole client-only trip area, and what the server sends for a
 * trip, share or example link: the first paint already has the planner's shape
 * instead of marketing chrome that the workspace then replaces. It stays in the
 * route's main chunk (a lazy fallback could be swapped before hydration), so it
 * avoids trip storage; the server has no storage either, so both sides render
 * the planner defaults until hydration has finished.
 */
export const TripAreaLoadingShell: React.FC = () => {
    const hydrated = useHydrated();
    const pathname = useRouterState({ select: state => state.location.pathname });
    const { plannerLayout, sidebarWidth, timelineHeight } = hydrated ? readPlannerShellLayout() : DEFAULT_PLANNER_SHELL_LAYOUT;
    return (
        <AppBootstrapShell
            variant="trip"
            testId="trip-route-loading-shell"
            shellState={tripShellVariantForPath(pathname)}
            plannerLayout={plannerLayout}
            sidebarWidth={sidebarWidth}
            timelineHeight={timelineHeight}
        />
    );
};
