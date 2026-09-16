import { describe, expect, it } from 'vitest';

import {
    buildMobileDayPlan,
    buildMobileDayStripNodes,
    findMobileDayPlanIndexForItem,
} from '../../components/tripview/mobileDayPlanModel';
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

    it('attaches a departure to the last day of the stay, not the arrival day', () => {
        const days = buildMobileDayPlan(trip);

        expect(days[2].departure?.item?.id).toBe('travel-a');
        expect(days[2].departure?.toCityTitle).toBe('Porto');
        expect(days[2].departure?.departureTime).toBe('09:30');
        expect(days[2].isDepartureDay).toBe(true);
        expect(days[3].departure).toBeNull();
    });

    it('mirrors the same leg as the arrival of the next stay', () => {
        const days = buildMobileDayPlan(trip);

        expect(days[3].arrival?.item?.id).toBe('travel-a');
        expect(days[3].arrival?.fromCityTitle).toBe('Lisbon');
        expect(days[3].arrival?.modeLabel).toBe('Train');
        // 09:30 plus a 0.2-day (4.8h) leg.
        expect(days[3].arrival?.arrivalTime).toBe('14:18');
        expect(days[3].arrival?.arrivalDayShift).toBe(0);
        expect(days[0].arrival).toBeNull();
    });

    it('rolls an overnight arrival into the following day', () => {
        const overnight = makeTrip([
            item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
            item({ id: 'travel-a', type: 'travel', title: 'Night train', startDateOffset: 2, duration: 0.5, transportMode: 'train', departureTime: '22:00' }),
            item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 2, duration: 2 }),
        ]);
        const days = buildMobileDayPlan(overnight);

        expect(days[2].arrival?.arrivalTime).toBe('10:00');
        expect(days[2].arrival?.arrivalDayShift).toBe(1);
        expect(days[2].arrival?.durationLabel).toBe('12 h');
    });

    it('marks hotel check-in on arrival and check-out on the last day of the stay', () => {
        const withHotel = makeTrip([
            item({
                id: 'city-a',
                type: 'city',
                title: 'Lisbon',
                startDateOffset: 0,
                duration: 3,
                hotels: [{ id: 'hotel-1', name: 'Bairro Alto', address: 'Praca Luis de Camoes 2' }],
            }),
        ]);
        const days = buildMobileDayPlan(withHotel);

        expect(days[0].hotelCheckIn?.name).toBe('Bairro Alto');
        expect(days[0].hotelCheckOut).toBeNull();
        expect(days[1].hotelCheckIn).toBeNull();
        expect(days[1].hotelCheckOut).toBeNull();
        expect(days[2].hotelCheckOut?.name).toBe('Bairro Alto');
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

    it('gives every stay its own arrival day when fractional offsets overlap (regression: missing arrival and check-in)', () => {
        // Sintra runs 19.0–20.6 and Porto starts at 20.6: rounding each stay on
        // its own made both claim day 20, and Porto never reported an arrival.
        const overlapping = makeTrip([
            item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
            item({ id: 'city-b', type: 'city', title: 'Sintra', startDateOffset: 2, duration: 1.6 }),
            item({
                id: 'city-c',
                type: 'city',
                title: 'Porto',
                startDateOffset: 3.6,
                duration: 2,
                hotels: [{ id: 'hotel-1', name: 'The Yeatman', address: '' }],
            }),
        ]);

        const days = buildMobileDayPlan(overlapping);

        expect(days.map((day) => day.city?.id)).toEqual(['city-a', 'city-a', 'city-b', 'city-b', 'city-c', 'city-c']);
        expect(days.map((day) => day.isArrivalDay)).toEqual([true, false, true, false, true, false]);
        expect(days[4].arrival?.fromCityTitle).toBe('Sintra');
        expect(days[4].hotelCheckIn?.name).toBe('The Yeatman');
    });

    describe('buildMobileDayStripNodes', () => {
        it('joins days of one stay and inserts the leg between stays', () => {
            const nodes = buildMobileDayStripNodes(buildMobileDayPlan(trip));

            expect(nodes.map((node) => node.kind)).toEqual([
                'day', 'day', 'day', 'transfer', 'day', 'day',
            ]);

            const dayNodes = nodes.filter((node) => node.kind === 'day');
            // Days inside one stay link with the stay's colour; the boundary
            // days link through the transfer node instead.
            expect(dayNodes.map((node) => (node.kind === 'day' ? node.linkBefore : null)))
                .toEqual(['none', 'stay', 'stay', 'transfer', 'stay']);
            expect(dayNodes.map((node) => (node.kind === 'day' ? node.linkAfter : null)))
                .toEqual(['stay', 'stay', 'transfer', 'stay', 'none']);
        });

        it('points a transfer node at the day it departs on', () => {
            const nodes = buildMobileDayStripNodes(buildMobileDayPlan(trip));
            const transferNode = nodes.find((node) => node.kind === 'transfer');

            expect(transferNode?.kind).toBe('transfer');
            expect(transferNode && transferNode.kind === 'transfer' ? transferNode.dayIndex : null).toBe(2);
            expect(transferNode && transferNode.kind === 'transfer' ? transferNode.transfer.item?.id : null).toBe('travel-a');
        });

        it('emits day nodes only for a single-stay trip', () => {
            const single = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
            ]);
            const nodes = buildMobileDayStripNodes(buildMobileDayPlan(single));

            expect(nodes.every((node) => node.kind === 'day')).toBe(true);
            expect(nodes).toHaveLength(2);
        });
    });
});
