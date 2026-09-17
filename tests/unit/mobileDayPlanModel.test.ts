import { describe, expect, it } from 'vitest';

import {
    buildMobileDayPlan,
    buildMobileDayPlanSegments,
    buildMobileDayStripNodes,
    findMobileDayPlanIndexForItem,
    findMobileDayPlanSegmentIndexForItem,
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

    describe('buildMobileDayPlanSegments', () => {
        const sameDayMove = makeTrip([
            item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 1.5 }),
            item({ id: 'travel-a', type: 'travel', title: 'Train', startDateOffset: 1.5, duration: 0.1, transportMode: 'train' }),
            item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 1.6, duration: 1.4 }),
        ]);

        it('splits the day of a move into one city-day per stay', () => {
            const segments = buildMobileDayPlanSegments(buildMobileDayPlan(sameDayMove));

            // Day 2 is the move. It appears twice — once in the city being
            // left, once in the one being reached — so the strip can show what
            // happens in each instead of half a circle of each colour.
            expect(segments.map((segment) => [segment.dayOffset, segment.stay?.id]))
                .toEqual([
                    [0, 'city-a'],
                    [1, 'city-a'],
                    [1, 'city-b'],
                    [2, 'city-b'],
                ]);
            expect(segments[1].sharesDayWithAnotherStay).toBe(true);
            expect(segments[1].fullDateLabel).toBe(segments[2].fullDateLabel);
        });

        it('reads the leg from each side it touches', () => {
            const segments = buildMobileDayPlanSegments(buildMobileDayPlan(sameDayMove));

            expect(segments[1].legs.map((leg) => leg.role)).toEqual(['departure']);
            expect(segments[1].legs[0].toCityTitle).toBe('Porto');
            expect(segments[2].legs.map((leg) => leg.role)).toEqual(['arrival']);
            expect(segments[2].legs[0].fromCityTitle).toBe('Lisbon');
        });

        it('gives each city-day the activities that happen while it is under way', () => {
            const sameDayActivities = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 1.5 }),
                item({ id: 'travel-a', type: 'travel', startDateOffset: 1.5, duration: 0.1, transportMode: 'train' }),
                item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 1.6, duration: 1.4 }),
                item({ id: 'act-morning', type: 'activity', title: 'Market', startDateOffset: 1.2, duration: 0.1 }),
                item({ id: 'act-evening', type: 'activity', title: 'Dinner', startDateOffset: 1.8, duration: 0.1 }),
            ]);
            const segments = buildMobileDayPlanSegments(buildMobileDayPlan(sameDayActivities));
            const movingDay = segments.filter((segment) => segment.dayOffset === 1);

            expect(movingDay).toHaveLength(2);
            expect(movingDay[0].activities.map((activity) => activity.id)).toEqual(['act-morning']);
            expect(movingDay[1].activities.map((activity) => activity.id)).toEqual(['act-evening']);
        });

        it('puts a hotel check-out on the city being left and check-in on the one reached', () => {
            const withHotels = makeTrip([
                item({
                    id: 'city-a',
                    type: 'city',
                    title: 'Lisbon',
                    startDateOffset: 0,
                    duration: 1.5,
                    hotels: [{ id: 'h1', name: 'Lisbon Hotel' }],
                }),
                item({ id: 'travel-a', type: 'travel', startDateOffset: 1.5, duration: 0.1, transportMode: 'train' }),
                item({
                    id: 'city-b',
                    type: 'city',
                    title: 'Porto',
                    startDateOffset: 1.6,
                    duration: 1.4,
                    hotels: [{ id: 'h2', name: 'Porto Hotel' }],
                }),
            ]);
            const segments = buildMobileDayPlanSegments(buildMobileDayPlan(withHotels));
            const movingDay = segments.filter((segment) => segment.dayOffset === 1);

            expect(movingDay[0].hotelCheckOut?.name).toBe('Lisbon Hotel');
            expect(movingDay[0].hotelCheckIn).toBeNull();
            expect(movingDay[1].hotelCheckIn?.name).toBe('Porto Hotel');
            expect(movingDay[1].hotelCheckOut).toBeNull();
        });

        it('locates the city-day holding a given item', () => {
            const segments = buildMobileDayPlanSegments(buildMobileDayPlan(trip));

            // The stay's own id finds its first city-day, and an activity finds
            // the city-day it happens in.
            expect(findMobileDayPlanSegmentIndexForItem(segments, 'city-b')).toBe(3);
            expect(findMobileDayPlanSegmentIndexForItem(segments, 'act-3')).toBe(3);
            expect(findMobileDayPlanSegmentIndexForItem(segments, 'nope')).toBe(-1);
        });
    });

    describe('buildMobileDayStripNodes', () => {
        it('puts one transport node between every pair of different cities', () => {
            const nodes = buildMobileDayStripNodes(buildMobileDayPlanSegments(buildMobileDayPlan(trip)));

            expect(nodes.map((node) => node.kind))
                .toEqual(['segment', 'segment', 'segment', 'transfer', 'segment', 'segment']);

            const transferNode = nodes[3];
            expect(transferNode.kind === 'transfer' ? transferNode.transfer.item?.id : null).toBe('travel-a');
            // Tapping it shows the city-day the leg lands in.
            expect(transferNode.kind === 'transfer' ? transferNode.segmentIndex : null).toBe(3);
        });

        it('joins the days of one stay in that stay\'s colour and breaks at a move', () => {
            const nodes = buildMobileDayStripNodes(buildMobileDayPlanSegments(buildMobileDayPlan(trip)));
            const segmentNodes = nodes.filter((node) => node.kind === 'segment');

            expect(segmentNodes.map((node) => (node.kind === 'segment' ? node.linkBefore.kind : null)))
                .toEqual(['none', 'stay', 'stay', 'transfer', 'stay']);
            expect(segmentNodes.map((node) => (node.kind === 'segment' ? node.linkAfter.kind : null)))
                .toEqual(['stay', 'stay', 'transfer', 'stay', 'none']);
            expect(segmentNodes[1].kind === 'segment' ? segmentNodes[1].linkBefore.colorHex : null)
                .toBe('#4f46e5');
        });

        it('keeps a node for a leg that has no travel item yet', () => {
            // A generated trip can hold two stays with nothing between them.
            const noTravelItem = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
                item({ id: 'city-b', type: 'city', title: 'Porto', startDateOffset: 2, duration: 2 }),
            ]);
            const nodes = buildMobileDayStripNodes(buildMobileDayPlanSegments(buildMobileDayPlan(noTravelItem)));
            const transferNode = nodes.find((node) => node.kind === 'transfer');

            expect(transferNode?.kind).toBe('transfer');
            expect(transferNode && transferNode.kind === 'transfer' ? transferNode.transfer.item : 'missing').toBeNull();
            // The leg still knows which stays it joins, which is what lets the
            // picker create the travel item.
            expect(transferNode && transferNode.kind === 'transfer' ? transferNode.transfer.fromCityId : null)
                .toBe('city-a');
            expect(transferNode && transferNode.kind === 'transfer' ? transferNode.transfer.toCityId : null)
                .toBe('city-b');
        });

        it('emits one node per day for a single-stay trip', () => {
            const single = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
            ]);
            const nodes = buildMobileDayStripNodes(buildMobileDayPlanSegments(buildMobileDayPlan(single)));

            expect(nodes.every((node) => node.kind === 'segment')).toBe(true);
            expect(nodes).toHaveLength(2);
        });

        it('gives a day in three cities three circles and two transports', () => {
            const twoMoves = makeTrip([
                item({ id: 'city-a', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 1.2, color: '#16a34a' }),
                item({ id: 'travel-a', type: 'travel', title: 'Train', startDateOffset: 1.2, duration: 0.1, transportMode: 'train' }),
                item({ id: 'city-b', type: 'city', title: 'Coimbra', startDateOffset: 1.3, duration: 0.4, color: '#2563eb' }),
                item({ id: 'travel-b', type: 'travel', title: 'Bus', startDateOffset: 1.7, duration: 0.1, transportMode: 'bus' }),
                item({ id: 'city-c', type: 'city', title: 'Porto', startDateOffset: 1.8, duration: 1.2, color: '#db2777' }),
            ]);
            const nodes = buildMobileDayStripNodes(buildMobileDayPlanSegments(buildMobileDayPlan(twoMoves)));

            // The day appears three times, once per city, with the two
            // journeys between them.
            expect(nodes.map((node) => node.kind))
                .toEqual(['segment', 'segment', 'transfer', 'segment', 'transfer', 'segment', 'segment']);
            expect(nodes.filter((node) => node.kind === 'transfer')
                .map((node) => (node.kind === 'transfer' ? node.transfer.item?.id : null)))
                .toEqual(['travel-a', 'travel-b']);
        });
    });
});
