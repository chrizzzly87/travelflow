import { describe, expect, it } from 'vitest';

import { buildMobileDayPlan, findMobileDayPlanIndexForItem } from '../../components/tripview/mobileDayPlanModel';
import type { ITimelineItem, ITrip } from '../../types';

const item = (overrides: Partial<ITimelineItem> & Pick<ITimelineItem, 'id' | 'type'>): ITimelineItem => ({
    title: overrides.id,
    startDateOffset: 0,
    duration: 1,
    color: '#4f46e5',
    ...overrides,
});

const makeTrip = (items: ITimelineItem[]): ITrip => ({
    id: 'trip-1',
    title: 'Trip',
    startDate: '2026-05-04', // A Monday.
    items,
    createdAt: 0,
    updatedAt: 0,
});

describe('components/tripview/mobileDayPlanModel', () => {
    const trip = makeTrip([
        item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 3 }),
        item({ id: 'travel-a', type: 'travel', title: 'Train', startDateOffset: 3, duration: 0.2, transportMode: 'train', departureTime: '09:30' }),
        item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 3, duration: 2 }),
        item({ id: 'act-1', type: 'activity', title: 'Alfama walk', startDateOffset: 0, duration: 0.2 }),
        item({ id: 'act-2', type: 'activity', title: 'Belem', startDateOffset: 1, duration: 0.2 }),
        item({ id: 'act-3', type: 'activity', title: 'Ribeira', startDateOffset: 3, duration: 0.2 }),
    ]);

    it('emits one entry per calendar day with its stay and weekday label', () => {
        const days = buildMobileDayPlan(trip, { today: new Date('2026-05-06T12:00:00'), locale: 'en-US' });

        expect(days).toHaveLength(5);
        expect(days.map((day) => day.city?.id)).toEqual(['city-a', 'city-a', 'city-a', 'city-b', 'city-b']);
        expect(days.map((day) => day.weekdayLabel)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        expect(days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5]);
        expect(days.map((day) => day.dayOfMonthLabel)).toEqual(['4', '5', '6', '7', '8']);
    });

    it('marks only the first day of a stay as an arrival', () => {
        const days = buildMobileDayPlan(trip);
        expect(days.map((day) => day.isArrivalDay)).toEqual([true, false, false, true, false]);
    });

    it('files activities under the day they start on', () => {
        const days = buildMobileDayPlan(trip);
        expect(days.map((day) => day.activities.map((activity) => activity.id))).toEqual([
            ['act-1'],
            ['act-2'],
            [],
            ['act-3'],
            [],
        ]);
    });

    it('attaches a transfer to the departure day, not the arrival day', () => {
        const days = buildMobileDayPlan(trip);

        expect(days[2].transfer?.item?.id).toBe('travel-a');
        expect(days[2].transfer?.toCityTitle).toBe('Porto');
        expect(days[2].transfer?.departureTime).toBe('09:30');
        expect(days[3].transfer).toBeNull();
    });

    it('flags today only when it falls inside the trip', () => {
        expect(buildMobileDayPlan(trip, { today: new Date('2026-05-06T08:00:00') }).map((day) => day.isToday))
            .toEqual([false, false, true, false, false]);
        expect(buildMobileDayPlan(trip, { today: new Date('2027-01-01T08:00:00') }).some((day) => day.isToday))
            .toBe(false);
    });

    it('returns no days for a trip with an unparseable start date', () => {
        expect(buildMobileDayPlan({ ...trip, startDate: 'not-a-date' })).toEqual([]);
    });

    it('locates the day holding a given city, activity or transfer', () => {
        const days = buildMobileDayPlan(trip);

        expect(findMobileDayPlanIndexForItem(days, 'act-3')).toBe(3);
        expect(findMobileDayPlanIndexForItem(days, 'travel-a')).toBe(2);
        expect(findMobileDayPlanIndexForItem(days, 'city-b')).toBe(3);
        expect(findMobileDayPlanIndexForItem(days, 'missing')).toBe(-1);
        expect(findMobileDayPlanIndexForItem(days, null)).toBe(-1);
    });
});
