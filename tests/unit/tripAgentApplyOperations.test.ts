import { describe, expect, it } from 'vitest';

import { applyTripAgentOperations } from '../../shared/tripAgent';
import type { TripChangeOperationV1 } from '../../shared/tripAgent';
import { findUnknownOperationTargets } from '../../shared/tripAgentWireOperations';
import type { ITrip } from '../../types';

/**
 * One case per operation kind plus the ways a real proposal goes wrong: ids the
 * trip does not have, partial selections that strand dependent operations, and
 * changes that cancel each other out.
 */
const createTrip = (): ITrip => ({
    id: 'trip-1',
    title: 'Taiwan',
    startDate: '2026-05-01',
    updatedAt: 10,
    items: [
        {
            id: 'city-taipei', type: 'city', title: 'Taipei', startDateOffset: 0, duration: 4, color: '#111111',
            hotels: [{ id: 'stay-1', name: 'Old stay', address: 'Somewhere 1' }],
        },
        { id: 'act-market', type: 'activity', title: 'Night market', startDateOffset: 1, duration: 0.25, color: '#222222' },
        { id: 'travel-1', type: 'travel', title: '2h Train', startDateOffset: 3.5, duration: 0.1, color: '#333333' },
        { id: 'city-hualien', type: 'city', title: 'Hualien', startDateOffset: 4, duration: 2, color: '#444444' },
        { id: 'act-gorge', type: 'activity', title: 'Taroko Gorge', startDateOffset: 4, duration: 0.5, color: '#555555' },
    ],
} as unknown as ITrip);

const operation = (id: string, extra: Record<string, unknown>): TripChangeOperationV1 => ({
    id, rationale: 'because', targetLabel: id, ...extra,
} as TripChangeOperationV1);

describe('applyTripAgentOperations — every kind', () => {
    it('adds an item and keeps the timeline in day order', () => {
        const result = applyTripAgentOperations(createTrip(), [operation('op', {
            kind: 'add_item',
            item: { id: 'act-new', type: 'activity', title: 'Tea break', startDateOffset: 2, duration: 0.25, color: '#666666' },
        })]);

        expect(result.appliedOperationIds).toEqual(['op']);
        expect(result.trip.items.map((item) => item.id)).toEqual([
            'city-taipei', 'act-market', 'act-new', 'travel-1', 'city-hualien', 'act-gorge',
        ]);
    });

    it('updates, moves and removes an item', () => {
        const trip = createTrip();
        const result = applyTripAgentOperations(trip, [
            operation('update', { kind: 'update_item', itemId: 'city-taipei', changes: { duration: 3 } }),
            operation('move', { kind: 'move_item', itemId: 'act-market', startDateOffset: 2 }),
            operation('remove', { kind: 'remove_item', itemId: 'travel-1' }),
        ]);

        expect(result.appliedOperationIds).toEqual(['update', 'move', 'remove']);
        expect(result.trip.items.find((item) => item.id === 'city-taipei')?.duration).toBe(3);
        expect(result.trip.items.find((item) => item.id === 'act-market')?.startDateOffset).toBe(2);
        expect(result.trip.items.some((item) => item.id === 'travel-1')).toBe(false);
    });

    it('adds, updates and removes a stay on a city', () => {
        const added = applyTripAgentOperations(createTrip(), [operation('add', {
            kind: 'add_stay',
            cityId: 'city-hualien',
            stay: { id: 'stay-2', name: 'Gorge lodge', address: 'Road 8' },
        })]);
        expect(added.trip.items.find((item) => item.id === 'city-hualien')?.hotels).toHaveLength(1);

        const updated = applyTripAgentOperations(createTrip(), [operation('edit', {
            kind: 'update_stay', cityId: 'city-taipei', stayId: 'stay-1', changes: { name: 'New name' },
        })]);
        expect(updated.trip.items[0].hotels?.[0].name).toBe('New name');

        const removed = applyTripAgentOperations(createTrip(), [operation('drop', {
            kind: 'remove_stay', cityId: 'city-taipei', stayId: 'stay-1',
        })]);
        expect(removed.trip.items[0].hotels).toEqual([]);
    });

    it('replaces the itinerary and a segment of days', () => {
        const replaced = applyTripAgentOperations(createTrip(), [operation('all', {
            kind: 'replace_itinerary',
            items: [{ id: 'city-new', type: 'city', title: 'Tainan', startDateOffset: 0, duration: 3, color: '#777777' }],
        })]);
        expect(replaced.trip.items.map((item) => item.id)).toEqual(['city-new']);

        const segment = applyTripAgentOperations(createTrip(), [operation('seg', {
            kind: 'replace_itinerary_segment',
            startOffset: 4,
            endOffset: 6,
            items: [{ id: 'city-kenting', type: 'city', title: 'Kenting', startDateOffset: 4, duration: 2, color: '#888888' }],
        })]);
        expect(segment.trip.items.map((item) => item.id)).toEqual([
            'city-taipei', 'act-market', 'travel-1', 'city-kenting',
        ]);
    });

    it('updates trip-level fields', () => {
        const result = applyTripAgentOperations(createTrip(), [operation('trip', {
            kind: 'update_trip', changes: { title: 'Taiwan, revised' },
        })]);

        expect(result.trip.title).toBe('Taiwan, revised');
    });
});

describe('applyTripAgentOperations — edge cases', () => {
    it('skips an operation whose target is not in the trip instead of failing the set', () => {
        const result = applyTripAgentOperations(createTrip(), [
            operation('ghost', { kind: 'remove_item', itemId: 'city-2-hash' }),
            operation('real', { kind: 'remove_item', itemId: 'act-market' }),
        ]);

        expect(result.appliedOperationIds).toEqual(['real']);
        expect(result.skippedOperations).toEqual([
            { id: 'ghost', reason: 'item-not-found', target: 'city-2-hash' },
        ]);
        expect(result.trip.items.some((item) => item.id === 'act-market')).toBe(false);
    });

    it('skips a dependent operation when its creating change is deselected', () => {
        const operations = [
            operation('add', {
                kind: 'add_item',
                item: { id: 'act-new', type: 'activity', title: 'Tea break', startDateOffset: 2, duration: 0.25, color: '#666666' },
            }),
            operation('move', { kind: 'move_item', itemId: 'act-new', startDateOffset: 3 }),
        ];

        const result = applyTripAgentOperations(createTrip(), operations, ['move']);

        expect(result.appliedOperationIds).toEqual([]);
        expect(result.skippedOperations[0]).toMatchObject({ id: 'move', reason: 'item-not-found' });
    });

    it('skips a stay change on a city that is not there, and one on a missing stay', () => {
        const result = applyTripAgentOperations(createTrip(), [
            operation('no-city', { kind: 'add_stay', cityId: 'city-ghost', stay: { id: 's', name: 'X', address: '' } }),
            operation('no-stay', { kind: 'remove_stay', cityId: 'city-taipei', stayId: 'stay-ghost' }),
        ]);

        expect(result.skippedOperations.map((entry) => entry.reason)).toEqual(['city-not-found', 'stay-not-found']);
        expect(result.appliedOperationIds).toEqual([]);
    });

    it('skips an add whose id is already taken rather than duplicating an item', () => {
        const result = applyTripAgentOperations(createTrip(), [operation('dup', {
            kind: 'add_item',
            item: { id: 'act-market', type: 'activity', title: 'Copy', startDateOffset: 1, duration: 0.25, color: '#999999' },
        })]);

        expect(result.skippedOperations[0]).toMatchObject({ reason: 'item-exists', target: 'act-market' });
        expect(result.trip.items.filter((item) => item.id === 'act-market')).toHaveLength(1);
    });

    it('skips a segment replacement that would collide with a retained item', () => {
        const result = applyTripAgentOperations(createTrip(), [operation('seg', {
            kind: 'replace_itinerary_segment',
            startOffset: 4,
            endOffset: 6,
            items: [{ id: 'act-market', type: 'activity', title: 'Clash', startDateOffset: 4, duration: 0.5, color: '#aaaaaa' }],
        })]);

        expect(result.skippedOperations[0]).toMatchObject({ reason: 'id-collision', target: 'act-market' });
        expect(result.trip.items).toHaveLength(5);
    });

    it('reports a change that leaves the trip untouched as a no-op', () => {
        const result = applyTripAgentOperations(createTrip(), [operation('same', {
            kind: 'update_item', itemId: 'city-taipei', changes: { duration: 4 },
        })]);

        expect(result.noOpOperationIds).toEqual(['same']);
        expect(result.trip.updatedAt).toBe(10);
    });

    it('stamps updatedAt only when something actually changed', () => {
        const result = applyTripAgentOperations(createTrip(), [operation('real', {
            kind: 'remove_item', itemId: 'act-market',
        })], ['real'], 999);

        expect(result.trip.updatedAt).toBe(999);
    });

    it('applies only the selected operations and leaves the rest untouched', () => {
        const operations = [
            operation('a', { kind: 'remove_item', itemId: 'act-market' }),
            operation('b', { kind: 'remove_item', itemId: 'act-gorge' }),
        ];

        const result = applyTripAgentOperations(createTrip(), operations, ['b']);

        expect(result.trip.items.some((item) => item.id === 'act-market')).toBe(true);
        expect(result.trip.items.some((item) => item.id === 'act-gorge')).toBe(false);
    });

    it('rejects a set with duplicate operation ids or an unknown selection', () => {
        const duplicated = [
            operation('same-id', { kind: 'remove_item', itemId: 'act-market' }),
            operation('same-id', { kind: 'remove_item', itemId: 'act-gorge' }),
        ];
        expect(() => applyTripAgentOperations(createTrip(), duplicated)).toThrow(/Duplicate operation id/);

        expect(() => applyTripAgentOperations(
            createTrip(),
            [operation('a', { kind: 'remove_item', itemId: 'act-market' })],
            ['missing'],
        )).toThrow(/Unknown selected operation id/);
    });

    it('never mutates the trip it was given', () => {
        const trip = createTrip();
        const snapshot = JSON.stringify(trip);

        applyTripAgentOperations(trip, [operation('remove', { kind: 'remove_item', itemId: 'act-market' })]);

        expect(JSON.stringify(trip)).toBe(snapshot);
    });
});

describe('findUnknownOperationTargets', () => {
    it('flags an id the trip does not contain', () => {
        const issues = findUnknownOperationTargets(createTrip(), [
            operation('ghost', { kind: 'remove_item', itemId: 'city-2-hash' }),
        ]);

        expect(issues).toEqual([{
            operationId: 'ghost',
            path: 'itemId',
            message: '"city-2-hash" is not in this trip. Use an id from read_trip_context.',
        }]);
    });

    it('accepts an id the same change set creates first', () => {
        const issues = findUnknownOperationTargets(createTrip(), [
            operation('add', {
                kind: 'add_item',
                item: { id: 'act-new', type: 'activity', title: 'Tea', startDateOffset: 2, duration: 0.25, color: '#666666' },
            }),
            operation('move', { kind: 'move_item', itemId: 'act-new', startDateOffset: 3 }),
        ]);

        expect(issues).toEqual([]);
    });

    it('flags a stay on a city that is not a city, and an unknown stay id', () => {
        const issues = findUnknownOperationTargets(createTrip(), [
            operation('stay-on-activity', {
                kind: 'add_stay', cityId: 'act-market', stay: { id: 's', name: 'X', address: '' },
            }),
            operation('unknown-stay', { kind: 'update_stay', cityId: 'city-taipei', stayId: 'nope', changes: { name: 'Y' } }),
        ]);

        expect(issues.map((issue) => issue.path)).toEqual(['cityId', 'stayId']);
    });

    it('accepts ids introduced by a full itinerary replacement', () => {
        const issues = findUnknownOperationTargets(createTrip(), [
            operation('all', {
                kind: 'replace_itinerary',
                items: [{ id: 'city-new', type: 'city', title: 'Tainan', startDateOffset: 0, duration: 3, color: '#777777' }],
            }),
            operation('stay', { kind: 'add_stay', cityId: 'city-new', stay: { id: 's', name: 'X', address: '' } }),
        ]);

        expect(issues).toEqual([]);
    });
});
