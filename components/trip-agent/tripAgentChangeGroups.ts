import type { ITrip } from '../../types';
import type { TripAgentChangeSetV1 } from '../../shared/tripAgent';

type Operation = TripAgentChangeSetV1['operations'][number];

export interface TripAgentChangeGroup {
    id: string;
    /** City the group belongs to, when it belongs to one. */
    subjectId: string | null;
    /** The operation that carries the intent of the group. */
    primary: Operation;
    /** Everything else the group performs, in order. */
    followUps: Operation[];
    operationIds: string[];
}

const TRIP_WIDE_KINDS = new Set(['update_trip', 'replace_itinerary', 'replace_itinerary_segment']);

/** Maps every item to the city that owns its day, so changes read per stop. */
const buildOwnerIndex = (trip: ITrip): { ownerOf: Map<string, string>; cityAt: (offset: number) => string | null } => {
    const cities = trip.items.filter((item) => item.type === 'city');
    const cityAt = (offset: number): string | null => cities.find((city) => (
        offset >= city.startDateOffset && offset < city.startDateOffset + city.duration
    ))?.id ?? null;

    const ownerOf = new Map<string, string>();
    trip.items.forEach((item) => {
        if (item.type === 'city') {
            ownerOf.set(item.id, item.id);
            return;
        }
        const owner = cityAt(item.startDateOffset);
        if (owner) ownerOf.set(item.id, owner);
    });

    return { ownerOf, cityAt };
};

const subjectOf = (
    operation: Operation,
    index: { ownerOf: Map<string, string>; cityAt: (offset: number) => string | null },
): string | null => {
    if (TRIP_WIDE_KINDS.has(operation.kind)) return null;
    if (operation.kind === 'add_stay' || operation.kind === 'update_stay' || operation.kind === 'remove_stay') {
        return operation.cityId;
    }
    if (operation.kind === 'add_item') return index.cityAt(operation.item.startDateOffset);
    if (operation.kind === 'move_item') {
        return index.ownerOf.get(operation.itemId) ?? index.cityAt(operation.startDateOffset);
    }
    if (operation.kind === 'update_item' || operation.kind === 'remove_item') {
        return index.ownerOf.get(operation.itemId) ?? null;
    }
    return null;
};

/** Rank used to pick the operation a group is named after. */
const significance = (operation: Operation, subjectId: string | null): number => {
    const targetsSubject = Boolean(subjectId)
        && 'itemId' in operation
        && (operation as { itemId?: string }).itemId === subjectId;
    if (operation.kind === 'remove_item') return targetsSubject ? 100 : 40;
    if (operation.kind === 'update_item') return targetsSubject ? 90 : 35;
    if (operation.kind === 'add_item') return 60;
    if (operation.kind === 'add_stay' || operation.kind === 'update_stay' || operation.kind === 'remove_stay') return 50;
    if (operation.kind === 'move_item') return targetsSubject ? 45 : 10;
    return 80;
};

/**
 * Groups a change set the way a person reads it: one entry per stop that
 * changes, with the edits and shifts it causes folded in. Removing a city with
 * its activities and transfers is one decision, not eight rows.
 */
export const groupTripAgentChanges = (trip: ITrip, operations: Operation[]): TripAgentChangeGroup[] => {
    const index = buildOwnerIndex(trip);
    const buckets: Array<{ subjectId: string | null; operations: Operation[] }> = [];

    operations.forEach((operation) => {
        const subjectId = subjectOf(operation, index);
        const current = buckets.at(-1);
        // Trip-wide changes always stand alone; anything else joins the open
        // bucket for the same stop, even when other stops were touched between.
        const target = subjectId === null
            ? null
            : buckets.find((bucket) => bucket.subjectId === subjectId);
        if (subjectId !== null && target) {
            target.operations.push(operation);
            return;
        }
        if (subjectId === null && current && current.subjectId === null && current.operations.length === 1
            && TRIP_WIDE_KINDS.has(current.operations[0].kind) === false) {
            current.operations.push(operation);
            return;
        }
        buckets.push({ subjectId, operations: [operation] });
    });

    return buckets.map((bucket) => {
        const primary = [...bucket.operations].sort((left, right) => (
            significance(right, bucket.subjectId) - significance(left, bucket.subjectId)
        ))[0];
        return {
            id: primary.id,
            subjectId: bucket.subjectId,
            primary,
            followUps: bucket.operations.filter((operation) => operation.id !== primary.id),
            operationIds: bucket.operations.map((operation) => operation.id),
        };
    });
};

export const selectedOperationIdsForGroups = (
    groups: TripAgentChangeGroup[],
    selectedGroupIds: string[],
): string[] => groups
    .filter((group) => selectedGroupIds.includes(group.id))
    .flatMap((group) => group.operationIds);
