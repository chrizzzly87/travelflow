import { describe, expect, it } from 'vitest';
import {
    formatAdminAbsoluteTime,
    formatAdminRelativeDay,
    formatAdminRelativeTime,
} from '../../components/admin/adminRelativeTime';

const NOW = Date.parse('2026-10-24T12:00:00.000Z');

describe('formatAdminRelativeTime', () => {
    it('reads past and future times as plain English', () => {
        expect(formatAdminRelativeTime('2026-10-24T11:59:30.000Z', NOW)).toBe('just now');
        expect(formatAdminRelativeTime('2026-10-24T12:00:30.000Z', NOW)).toBe('just now');
        expect(formatAdminRelativeTime('2026-10-24T11:55:00.000Z', NOW)).toBe('5 minutes ago');
        expect(formatAdminRelativeTime('2026-10-23T12:00:00.000Z', NOW)).toBe('yesterday');
        expect(formatAdminRelativeTime('2026-11-07T12:00:00.000Z', NOW)).toBe('in 2 weeks');
    });

    it('uses the caller fallback for a missing or invalid value', () => {
        expect(formatAdminRelativeTime(null, NOW)).toBe('—');
        expect(formatAdminRelativeTime(undefined, NOW, 'Never')).toBe('Never');
        expect(formatAdminRelativeTime('', NOW, 'n/a')).toBe('n/a');
        expect(formatAdminRelativeTime('not a date', NOW, 'Unknown')).toBe('Unknown');
    });
});

describe('formatAdminRelativeDay', () => {
    it('counts whole days, then months and years', () => {
        expect(formatAdminRelativeDay('2026-10-24T08:00:00.000Z', NOW)).toBe('today');
        expect(formatAdminRelativeDay('2026-10-19T12:00:00.000Z', NOW)).toBe('5 days ago');
        expect(formatAdminRelativeDay('2026-10-25T12:00:00.000Z', NOW)).toBe('tomorrow');
        expect(formatAdminRelativeDay('2026-07-24T12:00:00.000Z', NOW)).toBe('3 months ago');
        expect(formatAdminRelativeDay('2025-10-01T12:00:00.000Z', NOW)).toBe('last year');
    });

    it('shows an unparseable string as is, unless a fallback is given', () => {
        expect(formatAdminRelativeDay('soon', NOW)).toBe('soon');
        expect(formatAdminRelativeDay('soon', NOW, '—')).toBe('—');
        expect(formatAdminRelativeDay(null, NOW)).toBe('—');
    });
});

describe('formatAdminAbsoluteTime', () => {
    it('falls back for a missing or invalid value', () => {
        expect(formatAdminAbsoluteTime(null)).toBe('—');
        expect(formatAdminAbsoluteTime('not a date', '')).toBe('');
        expect(formatAdminAbsoluteTime('2026-10-24T12:00:00.000Z')).toMatch(/2026/);
    });
});
