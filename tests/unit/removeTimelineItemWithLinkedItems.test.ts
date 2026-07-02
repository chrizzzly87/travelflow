import { describe, expect, it } from 'vitest';

import { removeTimelineItemWithLinkedItems } from '../../utils';
import { makeActivityItem, makeCityItem, makeTravelItem } from '../helpers/tripFixtures';
import type { ITimelineItem } from '../../types';

const ids = (items: ITimelineItem[]): string[] => items.map((item) => item.id).sort();

// Trip layout: A (days 0-2) --travel-ab--> B (days 2.2-4.2) --travel-bc--> C (days 4.4-6.4)
const buildTrip = (): ITimelineItem[] => [
    makeCityItem({ id: 'city-a', title: 'Amsterdam', startDateOffset: 0, duration: 2 }),
    makeTravelItem('travel-ab', 2, 'Travel to Berlin'),
    makeCityItem({ id: 'city-b', title: 'Berlin', startDateOffset: 2.2, duration: 2 }),
    makeTravelItem('travel-bc', 4.2, 'Travel to Copenhagen'),
    makeCityItem({ id: 'city-c', title: 'Copenhagen', startDateOffset: 4.4, duration: 2 }),
    makeActivityItem('activity-a', 'Amsterdam', 0.5),
    makeActivityItem('activity-b', 'Berlin', 2.5),
    makeActivityItem('activity-c', 'Copenhagen', 4.5),
];

describe('removeTimelineItemWithLinkedItems', () => {
    it('removes both adjacent travel segments when deleting a middle city', () => {
        const next = removeTimelineItemWithLinkedItems(buildTrip(), 'city-b');

        expect(ids(next)).toEqual(['activity-a', 'activity-c', 'city-a', 'city-c'].sort());
    });

    it('removes the outbound travel segment when deleting the first city', () => {
        const next = removeTimelineItemWithLinkedItems(buildTrip(), 'city-a');

        expect(ids(next)).toEqual(
            ['city-b', 'city-c', 'travel-bc', 'activity-b', 'activity-c'].sort()
        );
    });

    it('removes the inbound travel segment when deleting the last city', () => {
        const next = removeTimelineItemWithLinkedItems(buildTrip(), 'city-c');

        expect(ids(next)).toEqual(
            ['city-a', 'city-b', 'travel-ab', 'activity-a', 'activity-b'].sort()
        );
    });

    it('removes activities positionally owned by the deleted city and keeps the others', () => {
        const next = removeTimelineItemWithLinkedItems(buildTrip(), 'city-b');

        expect(next.some((item) => item.id === 'activity-b')).toBe(false);
        expect(next.some((item) => item.id === 'activity-a')).toBe(true);
        expect(next.some((item) => item.id === 'activity-c')).toBe(true);
    });

    it('removes travel-empty boundary segments as well', () => {
        const items = buildTrip().map((item) =>
            item.id === 'travel-ab' ? { ...item, type: 'travel-empty' as const, transportMode: 'na' as const } : item
        );

        const next = removeTimelineItemWithLinkedItems(items, 'city-b');

        expect(next.some((item) => item.id === 'travel-ab')).toBe(false);
        expect(next.some((item) => item.id === 'travel-bc')).toBe(false);
    });

    it('removes all travel items when the last remaining city is deleted', () => {
        const items = [
            makeCityItem({ id: 'city-a', title: 'Amsterdam', startDateOffset: 0, duration: 2 }),
            makeTravelItem('travel-stale', 2, 'Stale travel'),
        ];

        const next = removeTimelineItemWithLinkedItems(items, 'city-a');

        expect(next).toEqual([]);
    });

    it('deletes an activity without touching anything else', () => {
        const next = removeTimelineItemWithLinkedItems(buildTrip(), 'activity-b');

        expect(ids(next)).toEqual(
            ['city-a', 'city-b', 'city-c', 'travel-ab', 'travel-bc', 'activity-a', 'activity-c'].sort()
        );
    });

    it('deletes a travel item without touching anything else', () => {
        const next = removeTimelineItemWithLinkedItems(buildTrip(), 'travel-ab');

        expect(ids(next)).toEqual(
            ['city-a', 'city-b', 'city-c', 'travel-bc', 'activity-a', 'activity-b', 'activity-c'].sort()
        );
    });

    it('returns the input array unchanged when the id is unknown', () => {
        const items = buildTrip();

        expect(removeTimelineItemWithLinkedItems(items, 'missing')).toBe(items);
    });
});
