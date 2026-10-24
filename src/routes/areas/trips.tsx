import { createFileRoute } from '@tanstack/react-router';
import TripWorkspaceLayout from '../../../features/trips/TripWorkspaceLayout';
import { prepareTripClaimRecovery } from '../../../features/trips/prepareTripClaimRecovery';

export const Route = createFileRoute('/_trips')({
    ssr: false,
    beforeLoad: ({ location, abortController }) => prepareTripClaimRecovery(location.searchStr, abortController.signal),
    component: TripWorkspaceLayout,
});
