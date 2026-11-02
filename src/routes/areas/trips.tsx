import { createFileRoute } from '@tanstack/react-router';
import TripWorkspaceLayout from '../../../features/trips/TripWorkspaceLayout';
import { prepareTripClaimRecovery } from '../../../features/trips/prepareTripClaimRecovery';
import { TripAreaLoadingShell } from '../../../components/tripview/TripAreaLoadingShell';
import { tripRouteSearchSchema } from '../../../features/trips/tripRouteSearch';

export const Route = createFileRoute('/_trips')({
    // Lenient: never throws, adds no defaults and keeps unknown parameters.
    validateSearch: tripRouteSearchSchema,
    ssr: false,
    beforeLoad: ({ location, abortController }) => prepareTripClaimRecovery(location.searchStr, abortController.signal),
    pendingComponent: TripAreaLoadingShell,
    // Only the workspace is split: the fallback must already be loaded when a
    // server-rendered trip document hydrates.
    codeSplitGroupings: [['component']],
    component: TripWorkspaceLayout,
});
