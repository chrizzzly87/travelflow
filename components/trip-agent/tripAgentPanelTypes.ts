import type { ITrip } from '../../types';
import type { TripAgentContextRef } from '../../shared/tripAgent';

export interface TripAgentPanelProps {
    trip: ITrip;
    contextRefs: TripAgentContextRef[];
    isOpen: boolean;
    onClose: () => void;
    onAdoptCommittedTripVersion: (input: { trip: ITrip; versionId: string; label: string }) => void;
    /** Shows a proposed trip in the planner while the reviewer previews it. */
    onPreviewTrip?: (trip: ITrip | null) => void;
    /** Restores a trip snapshot from before an applied change set. */
    onRevertAgentChange?: (input: {
        trip: ITrip;
        redoTrip: ITrip;
        label: string;
        redoLabel: string;
        changeSetId: string;
    }) => void;
    /** Applies a reviewed set again after it was applied once. */
    onReapplyAgentChange?: (input: { trip: ITrip; label: string; changeSetId: string }) => void;
}
