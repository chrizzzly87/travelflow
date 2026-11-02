import { describe, expect, it } from 'vitest';

import type { ITimelineItem } from '../../types';
import {
    clampDayOffsetToStay,
    isDayTrip,
    listStayDayOffsets,
    resolveActivityStay,
    resolveDayTripReturnStay,
    resolveDefaultActivityDayOffset,
    resolveExplicitActivityStay,
    resolveStayForOffset,
} from '../../shared/activityStay';
import { removeTimelineItemWithLinkedItems, reorderSelectedCities } from '../../utils';

const city = (id: string, startDateOffset: number, duration: number): ITimelineItem => ({
    id, type: 'city', title: id, startDateOffset, duration, color: 'bg-sky-200',
});
const activity = (id: string, startDateOffset: number, extra: Partial<ITimelineItem> = {}): ITimelineItem => ({
    id, type: 'activity', title: id, startDateOffset, duration: 0.25, color: 'bg-sky-100', ...extra,
});

const lisbon = city('lisbon', 0, 3);
const porto = city('porto', 3, 3);
const cities = [lisbon, porto];

describe('resolveActivityStay', () => {
    it('falls back to the date window for activities without a stored stay', () => {
        expect(resolveActivityStay(activity('a', 1.5), cities)?.id).toBe('lisbon');
        expect(resolveActivityStay(activity('b', 4), cities)?.id).toBe('porto');
    });

    it('honours an explicit stay, including the departure morning it shares with the next stay', () => {
        // Day 4 (offset 3) belongs to Porto by window, but the traveller put this
        // morning outing under Lisbon before leaving.
        expect(resolveActivityStay(activity('a', 3.2, { stayCityId: 'lisbon' }), cities)?.id).toBe('lisbon');
    });

    it('ignores a stored stay that no longer exists or that the activity was dragged away from', () => {
        expect(resolveActivityStay(activity('a', 1, { stayCityId: 'gone' }), cities)?.id).toBe('lisbon');
        expect(resolveExplicitActivityStay(activity('a', 5, { stayCityId: 'lisbon' }), cities)).toBeNull();
        expect(resolveActivityStay(activity('a', 5, { stayCityId: 'lisbon' }), cities)?.id).toBe('porto');
    });
});

describe('day trips', () => {
    it('are recognised only on activities', () => {
        expect(isDayTrip(activity('a', 1, { activityKind: 'day-trip' }))).toBe(true);
        expect(isDayTrip(activity('a', 1))).toBe(false);
        expect(isDayTrip({ type: 'city', activityKind: 'day-trip' })).toBe(false);
    });

    it('return to their own stay unless another is picked', () => {
        const sintra = activity('sintra', 2, { activityKind: 'day-trip', stayCityId: 'lisbon' });
        expect(resolveDayTripReturnStay(sintra, cities)?.id).toBe('lisbon');
        expect(resolveDayTripReturnStay({ ...sintra, dayTripReturnCityId: 'porto' }, cities)?.id).toBe('porto');
    });
});

describe('stay days', () => {
    it('lists each day a stay covers and keeps a day inside the stay', () => {
        expect(listStayDayOffsets(lisbon)).toEqual([0, 1, 2]);
        expect(listStayDayOffsets(city('short', 2, 0.5))).toEqual([2]);
        expect(clampDayOffsetToStay(7, porto)).toBe(5);
        expect(clampDayOffsetToStay(0, porto)).toBe(3);
        expect(clampDayOffsetToStay(4.6, porto)).toBe(4);
    });
});

describe('resolveDefaultActivityDayOffset', () => {
    const items = [...cities, activity('pastries', 4.2, { stayCityId: 'porto' })];

    it('uses the first day of the selected stay, the selected activity\'s stay, or day 1', () => {
        expect(resolveDefaultActivityDayOffset({ items, selectedItemId: 'porto' })).toBe(3);
        expect(resolveDefaultActivityDayOffset({ items, selectedItemId: 'pastries' })).toBe(3);
        expect(resolveDefaultActivityDayOffset({ items, selectedItemId: null, selectedCityIds: ['porto'] })).toBe(3);
        expect(resolveDefaultActivityDayOffset({ items, selectedItemId: null })).toBe(0);
    });

    it('keeps an afternoon arrival on its own stay instead of the one it shares the day with', () => {
        // Porto starts mid-day 4; flooring to day 4 used to open the dialog on Lisbon.
        const halfDayItems = [city('lisbon', 0, 3.5), city('porto', 3.5, 3)];
        const offset = resolveDefaultActivityDayOffset({ items: halfDayItems, selectedItemId: 'porto' });
        expect(offset).toBe(3.5);
        expect(resolveStayForOffset(offset, halfDayItems)?.id).toBe('porto');
    });
});

describe('stay-aware item operations', () => {
    it('removes an activity with the stay it is explicitly tied to, not the one its dates fall in', () => {
        const items = [
            ...cities,
            activity('departure-walk', 3.1, { stayCityId: 'lisbon' }),
            activity('porto-food', 4),
        ];
        const withoutLisbon = removeTimelineItemWithLinkedItems(items, 'lisbon');
        expect(withoutLisbon.map((item) => item.id)).toEqual(['porto', 'porto-food']);
    });

    it('moves an activity with its explicit stay when stays are reordered', () => {
        const items = [
            ...cities,
            activity('departure-walk', 3.1, { stayCityId: 'lisbon' }),
        ];
        const reordered = reorderSelectedCities(items, ['lisbon', 'porto'], ['porto', 'lisbon']);
        const walk = reordered.find((item) => item.id === 'departure-walk');
        // Lisbon now starts on day 4 (offset 3), so the walk moves by +3.
        expect(walk?.startDateOffset).toBeCloseTo(6.1);
    });
});
