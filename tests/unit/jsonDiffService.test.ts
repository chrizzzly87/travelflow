import { describe, expect, it } from 'vitest';
import { buildSideBySideJsonDiff } from '../../services/jsonDiffService';

describe('services/jsonDiffService', () => {
    it('marks simple scalar updates as removed/added side-by-side rows', () => {
        const diff = buildSideBySideJsonDiff(
            { mode: 'train', title: 'Segment A' },
            { mode: 'bus', title: 'Segment A' }
        );

        expect(diff.changedRowCount).toBeGreaterThan(0);
        expect(diff.rows.some((row) => row.leftType === 'removed' && row.rightType === 'added')).toBe(true);
    });

    it('keeps equal json payloads as pure context rows', () => {
        const payload = {
            id: 'trip-1',
            title: 'Trip',
            items: [{ id: 'a1', type: 'activity' }],
        };

        const diff = buildSideBySideJsonDiff(payload, payload);
        expect(diff.changedRowCount).toBe(0);
        expect(diff.rows.every((row) => row.leftType === 'context' && row.rightType === 'context')).toBe(true);
    });

    it('creates single-sided rows for added and deleted array items', () => {
        const diff = buildSideBySideJsonDiff(
            { items: [{ id: 'a1', type: 'activity' }] },
            { items: [{ id: 'a1', type: 'activity' }, { id: 't1', type: 'travel' }] }
        );

        const hasAddedOnlyRow = diff.rows.some((row) => row.leftType === 'empty' && row.rightType === 'added');
        expect(hasAddedOnlyRow).toBe(true);
    });
});
