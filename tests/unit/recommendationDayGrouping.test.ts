import { describe, expect, it } from 'vitest';

import { groupDaysByCity } from '../../components/recommendations/RecommendationDetailActions';
import type { MobileDayPlanDay } from '../../components/tripview/mobileDayPlanModel';

const day = (dayOffset: number, cityTitle: string | null): MobileDayPlanDay => ({
    dayOffset,
    city: cityTitle ? ({ title: cityTitle } as MobileDayPlanDay['city']) : null,
} as MobileDayPlanDay);

describe('components/recommendations — placing a kept idea', () => {
    it('groups the days under the city they belong to', () => {
        const groups = groupDaysByCity([
            day(0, 'Taipei'),
            day(1, 'Taipei'),
            day(2, 'Tainan'),
        ]);

        expect(groups.map((group) => group.cityName)).toEqual(['Taipei', 'Tainan']);
        expect(groups[0].days.map((entry) => entry.dayOffset)).toEqual([0, 1]);
    });

    it('keeps a return visit as its own group, because the itinerary does', () => {
        const groups = groupDaysByCity([
            day(0, 'Taipei'),
            day(1, 'Tainan'),
            day(2, 'Taipei'),
        ]);

        expect(groups).toHaveLength(3);
        expect(groups.map((group) => group.cityName)).toEqual(['Taipei', 'Tainan', 'Taipei']);
    });

    it('labels a day with no stay rather than dropping it', () => {
        const groups = groupDaysByCity([day(0, null)]);
        expect(groups[0].cityName).toBe('Unassigned');
        expect(groups[0].days).toHaveLength(1);
    });

    it('handles an empty itinerary', () => {
        expect(groupDaysByCity([])).toEqual([]);
    });
});
