import { describe, expect, it } from 'vitest';

import {
    countByStatus,
    formatAdminRelativeTime,
    isEditorDraftEqual,
    parseOverridePatch,
} from '../../components/admin/adminContentEditorModel';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');

describe('formatAdminRelativeTime', () => {
    it('reads recent times relatively and old ones as a date', () => {
        expect(formatAdminRelativeTime('2026-10-24T11:59:30.000Z', NOW)).toBe('just now');
        expect(formatAdminRelativeTime('2026-10-24T09:00:00.000Z', NOW)).toBe('3 hours ago');
        expect(formatAdminRelativeTime('2026-10-23T12:00:00.000Z', NOW)).toBe('yesterday');
        expect(formatAdminRelativeTime('2026-03-12T12:00:00.000Z', NOW)).toBe('Mar 12, 2026');
    });

    it('uses the fallback for missing or broken values', () => {
        expect(formatAdminRelativeTime(null, NOW)).toBe('Never');
        expect(formatAdminRelativeTime('not a date', NOW, '—')).toBe('—');
    });
});

describe('parseOverridePatch', () => {
    it('accepts an object and treats an empty field as no change', () => {
        expect(parseOverridePatch('{"summary":"x"}')).toEqual({ ok: true, patch: { summary: 'x' }, message: null });
        expect(parseOverridePatch('  ')).toEqual({ ok: true, patch: {}, message: null });
    });

    it('explains broken JSON and non-object values', () => {
        expect(parseOverridePatch('{ broken').message).toBe('The override must be valid JSON.');
        expect(parseOverridePatch('[1]').message).toBe('The override must be a JSON object.');
        expect(parseOverridePatch('null').ok).toBe(false);
    });
});

describe('editor helpers', () => {
    it('counts rows per status', () => {
        expect(countByStatus([{ s: 'draft' }, { s: 'draft' }, { s: 'published' }], (row) => row.s))
            .toEqual({ draft: 2, published: 1 });
    });

    it('compares flat drafts field by field', () => {
        expect(isEditorDraftEqual({ a: '1', b: true }, { a: '1', b: true })).toBe(true);
        expect(isEditorDraftEqual({ a: '1', b: true }, { a: '1', b: false })).toBe(false);
    });
});
