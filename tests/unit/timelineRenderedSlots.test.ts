import { describe, expect, it } from 'vitest';

import {
    buildRenderedTimelineDaySlots,
    buildRenderedTimelineMonths,
} from '../../components/tripview/timelineRenderedSlots';

describe('components/tripview/timelineRenderedSlots', () => {
    it('adds partial filler days to match the available timeline space without exceeding it', () => {
        const slots = buildRenderedTimelineDaySlots({
            tripLength: 3,
            visualStartOffset: 0,
            pixelsPerDay: 100,
            fillerSize: 150,
            todayIndex: null,
            baseStartDate: new Date(2026, 3, 1),
        });

        expect(slots).toHaveLength(5);
        expect(slots.map((slot) => slot.size)).toEqual([100, 100, 100, 100, 50]);
        expect(slots.at(-1)?.dayOffset).toBe(4);
        expect(slots.at(-1)?.start).toBe(400);
    });

    it('groups rendered month headers by summed rendered pixel width', () => {
        const slots = buildRenderedTimelineDaySlots({
            tripLength: 2,
            visualStartOffset: 29,
            pixelsPerDay: 80,
            fillerSize: 80,
            todayIndex: null,
            baseStartDate: new Date(2026, 0, 1),
        });

        const months = buildRenderedTimelineMonths(slots);

        expect(months).toEqual([
            { name: 'January', shortName: 'Jan', startIndex: 0, startPx: 0, widthPx: 160 },
            { name: 'February', shortName: 'Feb', startIndex: 2, startPx: 160, widthPx: 80 },
        ]);
    });
});
