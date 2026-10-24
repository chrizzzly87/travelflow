import { createFileRoute } from '@tanstack/react-router';
import TripWorkspaceLayout from '../../../features/trips/TripWorkspaceLayout';
import { prepareTripClaimRecovery } from '../../../features/trips/prepareTripClaimRecovery';
import { TripAreaLoadingShell } from '../../../components/tripview/TripAreaLoadingShell';

export const Route = createFileRoute('/_trips')({
    ssr: false,
    beforeLoad: ({ location, abortController }) => prepareTripClaimRecovery(location.searchStr, abortController.signal),
    pendingComponent: TripAreaLoadingShell,
    // Only the workspace is split: the fallback must already be loaded when a
    // server-rendered trip document hydrates.
    codeSplitGroupings: [['component']],
    component: TripWorkspaceLayout,
});
