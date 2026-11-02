import { describe, expect, it } from 'vitest';

import { applyTripAgentOperations, buildTripAgentSelectableContextRefs } from '../../shared/tripAgent';
import type { TripChangeOperationV1 } from '../../shared/tripAgent';
import {
    findUnknownOperationTargets,
    toTypedTripChangeOperation,
    tripAgentWireOperationSchema,
} from '../../shared/tripAgentWireOperations';
import { withResolvedActivityStays } from '../../netlify/edge-lib/trip-agent-runtime';
import type { ITrip } from '../../types';

const createTrip = (): ITrip => ({
    id: 'trip-1',
    title: 'Portugal',
    startDate: '2026-05-01',
    createdAt: 1,
    updatedAt: 10,
    items: [
        { id: 'city-lisbon', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 4, color: '#111111' },
        {
            id: 'act-pasteis', type: 'activity', title: 'Pastéis de Belém', startDateOffset: 0.5, duration: 0.25, color: '#222222',
            location: 'Belém', coordinates: { lat: 38.6975, lng: -9.2033 },
            // Written by the location resolver. The agent schema once rejected
            // these, which failed every proposal on a trip that had them.
            coordinatesSource: 'places', coordinatesQuery: 'pasteis de belem, lisbon', placeId: 'place-1',
        },
        { id: 'city-porto', type: 'city', title: 'Porto', startDateOffset: 4, duration: 3, color: '#444444' },
    ],
});

const base = { id: 'op-1', rationale: 'A classic outing', targetLabel: 'Sintra' };

const parseWire = (value: Record<string, unknown>) => tripAgentWireOperationSchema.parse({ ...base, ...value });

describe('trip agent day trips', () => {
    it('turns a model day trip into a day-trip activity tied to its stay', () => {
        const result = toTypedTripChangeOperation(parseWire({
            kind: 'add_item',
            item: {
                type: 'activity',
                title: 'Palaces of Sintra',
                startDateOffset: '2',
                duration: 0.6,
                location: 'Sintra',
                coordinates: { lat: '38.7981', lng: -9.388 },
                activityTypes: 'culture, sightseeing',
                stayCityId: 'city-lisbon',
                isDayTrip: 'true',
            },
        }));

        expect(result.status).toBe('ok');
        if (result.status !== 'ok' || result.operation.kind !== 'add_item') return;
        expect(result.operation.item).toMatchObject({
            type: 'activity',
            startDateOffset: 2,
            activityKind: 'day-trip',
            stayCityId: 'city-lisbon',
            coordinates: { lat: 38.7981, lng: -9.388 },
            coordinatesSource: 'agent',
        });
        expect(result.operation.item).not.toHaveProperty('dayTripReturnCityId');
    });

    it('reads "false" as false instead of coercing any string to true', () => {
        const result = toTypedTripChangeOperation(parseWire({
            kind: 'update_item',
            itemId: 'act-pasteis',
            itemChanges: { isDayTrip: 'false' },
        }));
        expect(result.status).toBe('ok');
        if (result.status !== 'ok' || result.operation.kind !== 'update_item') return;
        expect(result.operation.changes.activityKind).toBe('activity');
    });

    it('rejects a stay reference to a hotel or an invented city', () => {
        const trip = createTrip();
        const add = toTypedTripChangeOperation(parseWire({
            kind: 'add_item',
            item: {
                type: 'activity', title: 'Sintra', startDateOffset: 2, duration: 0.5,
                stayCityId: 'hotel-1', isDayTrip: true, dayTripReturnCityId: 'city-porto',
            },
        }));
        if (add.status !== 'ok') throw new Error('expected ok');
        const issues = findUnknownOperationTargets(trip, [add.operation]);
        expect(issues).toHaveLength(1);
        expect(issues[0].path).toBe('item.stayCityId');
    });

    it('applies a day trip on a trip whose activities carry resolver fields', () => {
        const add = toTypedTripChangeOperation(parseWire({
            kind: 'add_item',
            item: {
                id: 'act-sintra', type: 'activity', title: 'Palaces of Sintra', startDateOffset: 2, duration: 0.6,
                location: 'Sintra', coordinates: { lat: 38.7981, lng: -9.388 },
                stayCityId: 'city-lisbon', isDayTrip: true,
            },
        }));
        if (add.status !== 'ok') throw new Error('expected ok');

        const result = applyTripAgentOperations(createTrip(), [add.operation as TripChangeOperationV1]);
        const sintra = result.trip.items.find((item) => item.id === 'act-sintra');
        expect(result.appliedOperationIds).toEqual(['op-1']);
        expect(sintra).toMatchObject({ activityKind: 'day-trip', stayCityId: 'city-lisbon' });
        expect(result.trip.items.find((item) => item.id === 'act-pasteis')?.coordinatesSource).toBe('places');
    });

    it('shows the agent the stay of every activity, even on older trips', () => {
        const readable = withResolvedActivityStays(createTrip());
        expect(readable.items.find((item) => item.id === 'act-pasteis')?.stayCityId).toBe('city-lisbon');
        // Read-only: the stored trip is untouched.
        expect(createTrip().items[1].stayCityId).toBeUndefined();
    });

    it('attaches an activity to its explicit stay in selectable context', () => {
        const trip = createTrip();
        trip.items.push({
            id: 'act-departure', type: 'activity', title: 'Morning walk', startDateOffset: 4.1, duration: 0.2, color: '#999999',
            stayCityId: 'city-lisbon',
        });
        const ref = buildTripAgentSelectableContextRefs(trip).find((entry) => entry.id === 'act-departure');
        expect(ref?.cityId).toBe('city-lisbon');
    });
});
