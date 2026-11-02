import type { ITrip } from '../types';
import type { TripAgentContextRef } from './tripAgent.ts';

// Kept apart from the agent's zod schemas so the trip view can derive the
// selection context without loading zod; the chat session owns validation.
export const buildTripAgentContextRefs = (
    trip: ITrip,
    selectedItemId: string | null,
    selectedCityIds: string[],
): TripAgentContextRef[] => {
    const selectedIds = new Set(selectedCityIds);
    if (selectedItemId) selectedIds.add(selectedItemId);

    return trip.items
        .filter((item) => selectedIds.has(item.id))
        .map((item) => ({
            kind: item.type === 'city' ? 'city' as const : item.type === 'activity' ? 'activity' as const : 'travel' as const,
            id: item.id,
            label: item.title,
            tripUpdatedAt: trip.updatedAt,
        }));
};
