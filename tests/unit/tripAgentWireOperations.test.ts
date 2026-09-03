import { describe, expect, it } from 'vitest';

import {
    tripAgentWireOperationSchema,
    toTypedTripChangeOperation,
    toTypedTripChangeOperations,
} from '../../shared/tripAgentWireOperations';

const base = { id: 'op-1', rationale: 'Because the route is tight', targetLabel: 'Hualien' };

describe('toTypedTripChangeOperation', () => {
    it('converts a flat remove into the typed operation', () => {
        const result = toTypedTripChangeOperation({ ...base, kind: 'remove_item', itemId: 'city-1' });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.operation).toEqual({ ...base, kind: 'remove_item', itemId: 'city-1' });
    });

    it('fills in the id and colour a model left out of a new item', () => {
        const result = toTypedTripChangeOperation({
            ...base,
            kind: 'add_item',
            item: { type: 'activity', title: 'Night market', startDateOffset: 2, duration: 0.25 },
        });

        expect(result.status).toBe('ok');
        if (result.status !== 'ok' || result.operation.kind !== 'add_item') return;
        expect(result.operation.item.id).toMatch(/^activity-/);
        expect(result.operation.item.color).toBeTruthy();
    });

    it('names the field a kind is missing instead of failing opaquely', () => {
        const result = toTypedTripChangeOperation({ ...base, kind: 'move_item', itemId: 'city-1' });

        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.issues).toEqual([{
            operationId: 'op-1',
            path: 'startDateOffset',
            message: '"startDateOffset" is required for kind "move_item".',
        }]);
    });

    it('accepts the flat shape a function-calling model can actually emit', () => {
        const parsed = tripAgentWireOperationSchema.safeParse({
            ...base,
            kind: 'update_item',
            itemId: 'city-1',
            itemChanges: { duration: 3 },
        });

        expect(parsed.success).toBe(true);
    });

    it('reports every failing operation in one answer', () => {
        const result = toTypedTripChangeOperations([
            { ...base, id: 'op-1', kind: 'remove_item' },
            { ...base, id: 'op-2', kind: 'add_stay', cityId: 'city-1' },
        ]);

        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.issues.map((issue) => `${issue.operationId}:${issue.path}`)).toEqual(['op-1:itemId', 'op-2:stay']);
    });
});
