import type { TripAgentChangeSetV1 } from '../../shared/tripAgent';

type Operation = TripAgentChangeSetV1['operations'][number];

export interface TripAgentChangeGroup {
    id: string;
    /** The operation that carries the intent. */
    primary: Operation;
    /** Everything that only moves because the primary change moved it. */
    followUps: Operation[];
    operationIds: string[];
}

const isFollowUp = (operation: Operation): boolean => operation.kind === 'move_item';

/**
 * Groups a change set the way a person reads it: one entry per intended change,
 * with the shifts it causes folded in. Shortening a stop is a single decision,
 * not one decision plus six "move this later" rows.
 */
export const groupTripAgentChanges = (operations: Operation[]): TripAgentChangeGroup[] => {
    const groups: TripAgentChangeGroup[] = [];

    for (const operation of operations) {
        const current = groups.at(-1);
        if (isFollowUp(operation) && current) {
            current.followUps.push(operation);
            current.operationIds.push(operation.id);
            continue;
        }
        groups.push({
            id: operation.id,
            primary: operation,
            followUps: [],
            operationIds: [operation.id],
        });
    }

    return groups;
};

export const selectedOperationIdsForGroups = (
    groups: TripAgentChangeGroup[],
    selectedGroupIds: string[],
): string[] => groups
    .filter((group) => selectedGroupIds.includes(group.id))
    .flatMap((group) => group.operationIds);
