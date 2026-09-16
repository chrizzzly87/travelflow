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

    it('reports a whole-day boundary leg as an arrival on the day it lands', () => {
        const days = buildMobileDayPlan(trip);

        // Lisbon ends exactly at offset 3, so day 3 contains no Lisbon at all.
        expect(days[3].legs.map((leg) => leg.role)).toEqual(['arrival']);
        expect(days[3].legs[0].item?.id).toBe('travel-a');
        expect(days[3].legs[0].fromCityTitle).toBe('Lisbon');
        expect(days[3].legs[0].modeLabel).toBe('Train');
        // 09:30 plus a 0.2-day (4.8h) leg.
        expect(days[3].legs[0].arrivalTime).toBe('14:18');
        expect(days[3].legs[0].arrivalDayShift).toBe(0);
        expect(days[3].isHandoverDay).toBe(false);
        expect(days[2].legs).toEqual([]);
    });

    it('keeps a half-day handover inside one day, with both stays on it', () => {
        // The shape every generated trip uses: a stay ends mid-day and the next
        // begins at the same offset, so one day holds the whole move.
        const handover = makeTrip([
            item({ id: 'city-a', type: 'city', title: 'Sintra', startDateOffset: 0, duration: 1.5 }),
            item({ id: 'travel-a', type: 'travel', title: 'Train', startDateOffset: 1.5, duration: 0.3, transportMode: 'train', departureTime: '11:00' }),
            item({
                id: 'city-b',
                type: 'city',
                title: 'Porto',
                startDateOffset: 1.5,
                duration: 2,
                hotels: [{ id: 'hotel-1', name: 'The Yeatman', address: '' }],
            }),
        ]);

        const days = buildMobileDayPlan(handover);

        expect(days).toHaveLength(4);
        expect(days[1].isHandoverDay).toBe(true);
        expect(days[1].departingCity?.id).toBe('city-a');
        expect(days[1].city?.id).toBe('city-b');
        expect(days[1].legs.map((leg) => leg.role)).toEqual(['handover']);
        expect(days[1].legs[0].departureTime).toBe('11:00');
        expect(days[1].legs[0].arrivalTime).toBe('18:12');
        // Both ends of the move are recorded on the same day.
        expect(days[1].hotelCheckIn?.name).toBe('The Yeatman');
        expect(days[1].isArrivalDay).toBe(true);
        expect(days[0].isHandoverDay).toBe(false);
        expect(days[2].legs).toEqual([]);
    });

    it('splits an overnight leg into a departure and an arrival on two days', () => {
        const overnight = makeTrip([
            item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
            item({ id: 'travel-a', type: 'travel', title: 'Night train', startDateOffset: 1.9, duration: 0.5, transportMode: 'train', departureTime: '22:00' }),
            item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 2.4, duration: 2 }),
        ]);
        const days = buildMobileDayPlan(overnight);

        expect(days[1].legs.map((leg) => leg.role)).toEqual(['departure']);
        expect(days[2].legs.map((leg) => leg.role)).toEqual(['arrival']);
        expect(days[2].legs[0].arrivalTime).toBe('10:00');
        expect(days[2].legs[0].arrivalDayShift).toBe(1);
        expect(days[2].legs[0].durationLabel).toBe('12 h');
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
        expect(findMobileDayPlanIndexForItem(days, 'travel-a')).toBe(3);
        expect(findMobileDayPlanIndexForItem(days, 'city-b')).toBe(3);
        expect(findMobileDayPlanIndexForItem(days, 'missing')).toBe(-1);
        expect(findMobileDayPlanIndexForItem(days, null)).toBe(-1);
    });

    it('never loses a stay when two share the day of the move (regression: missing arrival and check-in)', () => {
        // Sintra runs 2.0-3.6 and Porto starts at 3.6: rounding each stay to
        // whole days on its own made both claim day 3, and whichever lost the
        // lookup reported no arrival and no hotel check-in at all.
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

        expect(days.map((day) => day.city?.id)).toEqual(['city-a', 'city-a', 'city-b', 'city-c', 'city-c', 'city-c']);
        expect(days[3].isHandoverDay).toBe(true);
        expect(days[3].departingCity?.id).toBe('city-b');
        expect(days[3].legs.map((leg) => leg.role)).toEqual(['handover']);
        expect(days[3].hotelCheckIn?.name).toBe('The Yeatman');
    });

    describe('buildMobileDayStripNodes', () => {
        it('gives every leg its own node, placed before the day it lands in', () => {
            const nodes = buildMobileDayStripNodes(buildMobileDayPlan(trip));

            // The move happens inside day 3, and its transport is the control
            // the traveller taps to change it — so it keeps a node of its own
            // rather than a badge on the day bubble.
            expect(nodes.map((node) => node.kind))
                .toEqual(['day', 'day', 'day', 'transfer', 'day', 'day']);

            const transferNode = nodes[3];
            expect(transferNode.kind === 'transfer' ? transferNode.transfer.item?.id : null).toBe('travel-a');
            // Tapping it shows the day the leg lands in.
            expect(transferNode.kind === 'transfer' ? transferNode.dayIndex : null).toBe(3);
        });

        it('joins days of one stay in that stay\'s colour and breaks around a leg', () => {
            const nodes = buildMobileDayStripNodes(buildMobileDayPlan(trip));
            const dayNodes = nodes.filter((node) => node.kind === 'day');

            expect(dayNodes.map((node) => (node.kind === 'day' ? node.linkBefore.kind : null)))
                .toEqual(['none', 'stay', 'stay', 'transfer', 'stay']);
            expect(dayNodes.map((node) => (node.kind === 'day' ? node.linkAfter.kind : null)))
                .toEqual(['stay', 'stay', 'transfer', 'stay', 'none']);
            // A stay link carries the colour of the stay it continues, so the
            // line reads as one run of that city.
            expect(dayNodes.map((node) => (node.kind === 'day' ? node.linkBefore.colorHex : null)))
                .toEqual([null, '#4f46e5', '#4f46e5', null, '#4f46e5']);
        });

        it('gives an overnight leg a node between the days it separates', () => {
            const overnight = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
                item({ id: 'travel-a', type: 'travel', title: 'Night train', startDateOffset: 1.9, duration: 0.5, transportMode: 'train' }),
                item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 2.4, duration: 2 }),
            ]);
            const nodes = buildMobileDayStripNodes(buildMobileDayPlan(overnight));
            const transferNode = nodes.find((node) => node.kind === 'transfer');

            expect(transferNode?.kind).toBe('transfer');
            // The leg departs on day 1 and lands on day 2, so its node sits
            // between them and selects the day it lands in.
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

        it('keeps a node per leg when two moves happen on the same day', () => {
            const twoMoves = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 1.2, color: '#16a34a' }),
                item({ id: 'travel-a', type: 'travel', title: 'Train', startDateOffset: 1.2, duration: 0.1, transportMode: 'train' }),
                item({ id: 'city-b', type: 'city', title: 'Coimbra', startDateOffset: 1.3, duration: 0.4, color: '#2563eb' }),
                item({ id: 'travel-b', type: 'travel', title: 'Bus', startDateOffset: 1.7, duration: 0.1, transportMode: 'bus' }),
                item({ id: 'city-c', type: 'city', title: 'Porto', startDateOffset: 1.8, duration: 1.2, color: '#db2777' }),
            ]);
            const days = buildMobileDayPlan(twoMoves);

            // The middle stay is only ever part of a day, so the day has to
            // carry all three: the ring is painted from this list.
            expect(days[1].stays.map((stay) => stay.id)).toEqual(['city-a', 'city-b', 'city-c']);
            expect(days[1].stays.map((stay) => stay.colorHex)).toEqual(['#16a34a', '#2563eb', '#db2777']);

            const nodes = buildMobileDayStripNodes(days);
            expect(nodes.map((node) => node.kind)).toEqual(['day', 'transfer', 'transfer', 'day', 'day']);
            expect(nodes.filter((node) => node.kind === 'transfer')
                .map((node) => (node.kind === 'transfer' ? node.transfer.item?.id : null)))
                .toEqual(['travel-a', 'travel-b']);
        });

        it('lists one stay for an ordinary day', () => {
            const days = buildMobileDayPlan(trip);

            expect(days[0].stays.map((stay) => stay.id)).toEqual(['city-a']);
            expect(days[0].stays[0].title).toBe('Lisbon');
        });
    });
});
