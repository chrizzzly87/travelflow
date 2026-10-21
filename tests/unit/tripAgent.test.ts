import { describe, expect, it } from 'vitest';

import {
    applyTripAgentOperations,
    buildTripAgentContextRefs,
    buildTripAgentSelectableContextRefs,
    tripChangeOperationV1Schema,
} from '../../shared/tripAgent';
import type { ITrip } from '../../types';

const createTrip = (): ITrip => ({
    id: 'trip-1',
    title: 'Portugal',
    startDate: '2026-10-01',
    createdAt: 1,
    updatedAt: 10,
    items: [
        {
            id: 'lisbon',
            type: 'city',
            title: 'Lisbon',
            startDateOffset: 0,
            duration: 3,
            color: '#123456',
            hotels: [{ id: 'old-stay', name: 'Old stay', address: 'Rua One' }],
        },
        {
            id: 'porto',
            type: 'city',
            title: 'Porto',
            startDateOffset: 3,
            duration: 2,
            color: '#654321',
        },
    ],
});

describe('trip agent operations', () => {
    it('applies only selected changes and records one updated timestamp', () => {
        const result = applyTripAgentOperations(createTrip(), [
            {
                id: 'rename',
                kind: 'update_trip',
                rationale: 'Use a clearer title.',
                targetLabel: 'Trip title',
                changes: { title: 'Portugal by rail' },
            },
            {
                id: 'stay',
                kind: 'add_stay',
                rationale: 'Keep a central option.',
                targetLabel: 'Lisbon stay',
                cityId: 'lisbon',
                stay: { id: 'new-stay', name: 'Central stay', address: 'Rua Two' },
            },
        ], ['stay'], 99);

        expect(result.trip.title).toBe('Portugal');
        expect(result.trip.items[0].hotels).toHaveLength(2);
        expect(result.trip.updatedAt).toBe(99);
        expect(result.appliedOperationIds).toEqual(['stay']);
    });

    it('replaces only items starting inside a bounded segment', () => {
        const result = applyTripAgentOperations(createTrip(), [{
            id: 'segment',
            kind: 'replace_itinerary_segment',
            rationale: 'Swap the northern stop.',
            targetLabel: 'Days 4–5',
            startOffset: 3,
            endOffset: 5,
            items: [{
                id: 'coimbra',
                type: 'city',
                title: 'Coimbra',
                startDateOffset: 3,
                duration: 2,
                color: '#abcdef',
            }],
        }], undefined, 100);

        expect(result.trip.items.map((item) => item.id)).toEqual(['lisbon', 'coimbra']);
    });

    it('rejects arbitrary fields and unknown selected operations', () => {
        expect(() => tripChangeOperationV1Schema.parse({
            id: 'bad',
            kind: 'update_trip',
            rationale: 'Unsafe field.',
            targetLabel: 'Trip',
            changes: { ownerId: 'attacker' },
        })).toThrow();

        expect(() => applyTripAgentOperations(createTrip(), [{
            id: 'rename',
            kind: 'update_trip',
            rationale: 'Rename.',
            targetLabel: 'Trip',
            changes: { title: 'New' },
        }], ['missing'])).toThrow('Unknown selected operation id');
    });

    it('rejects an itinerary that would carry duplicate item IDs', () => {
        expect(() => applyTripAgentOperations(createTrip(), [{
            id: 'replace',
            kind: 'replace_itinerary',
            rationale: 'Replace route.',
            targetLabel: 'Itinerary',
            items: [createTrip().items[0], createTrip().items[0]],
        }])).toThrow('Duplicate itinerary item id');
    });

    it('skips a stay for a city that is not in the trip, leaving the rest of the set usable', () => {
        const result = applyTripAgentOperations(createTrip(), [{
            id: 'stay',
            kind: 'add_stay',
            rationale: 'Add stay.',
            targetLabel: 'Stay',
            cityId: 'missing',
            stay: { id: 'stay-1', name: 'Stay', address: 'Address' },
        }]);

        expect(result.appliedOperationIds).toEqual([]);
        expect(result.skippedOperations).toEqual([{ id: 'stay', reason: 'city-not-found', target: 'missing' }]);
    });

    it('builds immutable context references from current selection', () => {
        const refs = buildTripAgentContextRefs(createTrip(), null, ['porto', 'lisbon']);
        expect(refs).toEqual([
            { kind: 'city', id: 'lisbon', label: 'Lisbon', tripUpdatedAt: 10 },
            { kind: 'city', id: 'porto', label: 'Porto', tripUpdatedAt: 10 },
        ]);
    });

    it('builds selectable trip, item, and stay context with stable ownership metadata', () => {
        const trip = createTrip();
        trip.items.splice(1, 0, {
            id: 'activity-1',
            type: 'activity',
            title: 'Alfama walk',
            startDateOffset: 1,
            duration: 0.25,
            color: '#123456',
        });

        expect(buildTripAgentSelectableContextRefs(trip)).toEqual([
            { kind: 'trip', id: 'trip-1', label: 'Portugal', tripUpdatedAt: 10 },
            { kind: 'city', id: 'lisbon', label: 'Lisbon', tripUpdatedAt: 10 },
            { kind: 'activity', id: 'activity-1', label: 'Alfama walk', cityId: 'lisbon', tripUpdatedAt: 10 },
            { kind: 'city', id: 'porto', label: 'Porto', tripUpdatedAt: 10 },
            { kind: 'stay', id: 'old-stay', label: 'Old stay', cityId: 'lisbon', tripUpdatedAt: 10 },
        ]);
    });
});
