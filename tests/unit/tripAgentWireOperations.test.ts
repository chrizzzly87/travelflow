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

describe('every wire kind converts with its minimal fields', () => {
    const base = { rationale: 'because', targetLabel: 'target' };
    const item = { type: 'activity' as const, title: 'Tea', startDateOffset: 2, duration: 0.25 };
    const stay = { name: 'Lodge' };

    const cases: Array<[string, Record<string, unknown>]> = [
        ['update_trip', { tripChanges: { title: 'New' } }],
        ['add_item', { item }],
        ['update_item', { itemId: 'i', itemChanges: { duration: 2 } }],
        ['move_item', { itemId: 'i', startDateOffset: 3 }],
        ['remove_item', { itemId: 'i' }],
        ['add_stay', { cityId: 'c', stay }],
        ['update_stay', { cityId: 'c', stayId: 's', stayChanges: { name: 'New' } }],
        ['remove_stay', { cityId: 'c', stayId: 's' }],
        ['replace_itinerary', { items: [item] }],
        ['replace_itinerary_segment', { startOffset: 1, endOffset: 3, items: [item] }],
    ];

    it.each(cases)('converts %s', (kind, extra) => {
        const parsed = tripAgentWireOperationSchema.safeParse({ id: `op-${kind}`, kind, ...base, ...extra });
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;

        const result = toTypedTripChangeOperation(parsed.data);
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.operation.kind).toBe(kind);
    });

    it('drops a field the schema does not define instead of failing the call', () => {
        // The SDK rejects a call that fails this schema before the tool can
        // answer, which surfaced as an unexplained red step in the chat.
        const parsed = tripAgentWireOperationSchema.safeParse({
            id: 'op', kind: 'remove_item', itemId: 'i', ...base, notAField: true,
        });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect('notAField' in parsed.data).toBe(false);
    });

    it('accepts numbers sent as strings', () => {
        const parsed = tripAgentWireOperationSchema.safeParse({
            id: 'op', kind: 'move_item', itemId: 'i', startDateOffset: '3', ...base,
        });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.startDateOffset).toBe(3);
    });

    it('maps an unsupported transport mode to "not specified"', () => {
        const parsed = tripAgentWireOperationSchema.safeParse({
            id: 'op', kind: 'add_item', ...base,
            item: { ...item, type: 'travel', transportMode: 'tourist shuttle' },
        });

        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(parsed.data.item?.transportMode).toBe('na');
    });

    it('still rejects an out-of-range day offset and a zero duration', () => {
        expect(tripAgentWireOperationSchema.safeParse({
            id: 'op', kind: 'move_item', itemId: 'i', startDateOffset: -1, ...base,
        }).success).toBe(false);
        expect(tripAgentWireOperationSchema.safeParse({
            id: 'op', kind: 'add_item', ...base, item: { ...item, duration: 0 },
        }).success).toBe(false);
    });

    it('rejects a segment that ends before it starts', () => {
        const parsed = tripAgentWireOperationSchema.safeParse({
            id: 'op', kind: 'replace_itinerary_segment', startOffset: 5, endOffset: 2, items: [item], ...base,
        });
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;

        expect(toTypedTripChangeOperation(parsed.data).status).toBe('invalid');
    });
});
