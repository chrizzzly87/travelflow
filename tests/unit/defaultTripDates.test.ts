// Force a UTC+ timezone (UTC+1/UTC+2 with DST) before any Date usage so the
// regression scenario — local midnight serializing as the previous UTC day —
// is actually reproduced. Node picks up process.env.TZ for subsequent Date calls.
process.env.TZ = 'Europe/Berlin';

import { describe, expect, it } from 'vitest';

import { formatLocalIsoDate } from '../../shared/tripSpan';
import { getDefaultTripDates } from '../../utils';

const isUtcPlusTimezone = new Date(2026, 6, 3).getTimezoneOffset() < 0;

describe('shared/tripSpan formatLocalIsoDate', () => {
    it('formats local calendar components with zero padding', () => {
        expect(formatLocalIsoDate(new Date(2026, 9, 2))).toBe('2026-10-02');
        expect(formatLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('does not shift local midnight to the previous UTC day', () => {
        // Local Friday 2026-07-03 00:00 in a UTC+ timezone is Thursday in UTC,
        // so toISOString-based formatting would return '2026-07-02'.
        const localFridayMidnight = new Date(2026, 6, 3, 0, 0, 0);
        expect(formatLocalIsoDate(localFridayMidnight)).toBe('2026-07-03');
        // Guard that the forced TZ took effect, so the regression is really exercised.
        expect(isUtcPlusTimezone).toBe(true);
        expect(localFridayMidnight.toISOString().split('T')[0]).toBe('2026-07-02');
    });
});

describe('getDefaultTripDates', () => {
    it('returns the upcoming local Friday ~3 months out, not the previous day (UTC+ regression)', () => {
        // "Now" is Wednesday 2026-04-01. Target month starts Wednesday 2026-07-01,
        // so the first Friday is 2026-07-03. The old toISOString-based
        // serialization returned '2026-07-02' (a Thursday) under Europe/Berlin.
        const { startDate, endDate } = getDefaultTripDates(new Date(2026, 3, 1, 0, 30));
        expect(startDate).toBe('2026-07-03');
        expect(endDate).toBe('2026-07-18');
    });

    it('keeps the start date in the target month when the month starts on a Friday', () => {
        // Target month May 2026 starts on Friday 2026-05-01; the old code
        // serialized it as '2026-04-30', landing in the previous month.
        const { startDate, endDate } = getDefaultTripDates(new Date(2026, 1, 1, 0, 30));
        expect(startDate).toBe('2026-05-01');
        expect(endDate).toBe('2026-05-16');
    });

    it('always starts on a Friday and spans 15 days', () => {
        for (let month = 0; month < 12; month += 1) {
            const { startDate, endDate } = getDefaultTripDates(new Date(2026, month, 15));
            const [sy, sm, sd] = startDate.split('-').map(Number);
            const start = new Date(sy, sm - 1, sd);
            expect(start.getDay()).toBe(5);
            const [ey, em, ed] = endDate.split('-').map(Number);
            const end = new Date(ey, em - 1, ed);
            const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000);
            expect(diffDays).toBe(15);
        }
    });

    it('defaults to the current time when no reference date is given', () => {
        const { startDate, endDate } = getDefaultTripDates();
        expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(endDate > startDate).toBe(true);
    });
});
